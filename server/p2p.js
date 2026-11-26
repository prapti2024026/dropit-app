// Direct (peer-to-peer) transfers for big files.
//
// The file itself never touches this server: the two browsers connect with WebRTC and stream
// the bytes over a data channel. The server only passes the connection details between them
// ("signaling") and writes the history rows when the receiver confirms the file arrived intact.
//
//   sender                         server                          receiver
//   POST /api/p2p/offers  ───────► session "waiting" (offer SDP)
//                                                    ◄───────────── GET  /api/p2p/incoming   (inbox)
//                                                    ◄───────────── POST /api/p2p/claim      (DROP gesture)
//                                  session "claimed" ─────────────► offer SDP
//                                                    ◄───────────── POST /api/p2p/:id/answer
//   GET /api/p2p/:id (poll) ◄────── session "answered" (answer SDP)
//   ══════════════════ WebRTC data channel: file bytes + SHA-256 ═════════════════
//                                                    ◄───────────── POST /api/p2p/:id/finish (verified)
//
// Sessions live in memory (one free server instance) and expire on their own.
import crypto from "crypto";
import express from "express";
import mongoose from "mongoose";

const WAITING_TTL_MS = 15 * 60 * 1000; // sender waits up to 15 min for the DROP
const CLAIM_TTL_MS = 2 * 60 * 1000; // receiver must answer within 2 min of claiming
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // a running transfer may take up to 6 h
const MAX_ACTIVE_PER_SENDER = 3;
const MAX_SDP_CHARS = 64 * 1024;
export const MAX_DIRECT_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB sanity limit

const isSdp = (value, type) =>
  value &&
  typeof value === "object" &&
  value.type === type &&
  typeof value.sdp === "string" &&
  value.sdp.length > 0 &&
  value.sdp.length <= MAX_SDP_CHARS;

export const createP2PRouter = ({ authenticate, User, File, getFileCategory }) => {
  const router = express.Router();
  const sessions = new Map();

  const expire = () => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      const age = now - session.createdAt;
      const stale =
        (session.state === "waiting" && age > WAITING_TTL_MS) ||
        (session.state === "claimed" && now - session.updatedAt > CLAIM_TTL_MS) ||
        age > SESSION_TTL_MS;
      const finishedLongAgo = ["done", "failed", "cancelled"].includes(session.state) && now - session.updatedAt > 10 * 60 * 1000;
      if (finishedLongAgo) sessions.delete(id);
      else if (stale && !["done", "failed", "cancelled"].includes(session.state)) {
        session.reason = session.state === "waiting" ? "The receiver did not drop in time" : "Timed out";
        session.state = "failed";
        session.updatedAt = now;
      }
    }
  };
  const timer = setInterval(expire, 30 * 1000);
  timer.unref?.();

  const set = (session, patch) => Object.assign(session, patch, { updatedAt: Date.now() });

  const publicView = (session, viewerId) => {
    const isSender = session.senderId === viewerId;
    return {
      id: session.id,
      state: session.state,
      reason: session.reason || null,
      name: session.name,
      size: session.size,
      mimeType: session.mimeType,
      isFolder: session.isFolder,
      sender: session.senderName,
      receiver: session.receiverName,
      createdAt: new Date(session.createdAt).toISOString(),
      // Each side only ever sees the other side's connection details
      answer: isSender ? session.answer || null : undefined,
      sha256: session.sha256 || null,
      verified: session.verified ?? null
    };
  };

  const mine = (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session || (session.senderId !== req.userId && session.receiverId !== req.userId)) {
      res.status(404).json({ success: false, message: "Transfer not found" });
      return null;
    }
    return session;
  };

  // Sender: announce a file and the WebRTC offer
  router.post("/offers", authenticate, async (req, res) => {
    try {
      expire();
      const { receiverId, name, size, mimeType, isFolder, offer } = req.body || {};
      if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
        return res.status(400).json({ success: false, message: "A valid receiver is required" });
      }
      if (!name || typeof name !== "string" || name.length > 255) {
        return res.status(400).json({ success: false, message: "A file name is required" });
      }
      const bytes = Number(size);
      if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_DIRECT_BYTES) {
        return res.status(400).json({ success: false, message: "File size is not valid" });
      }
      if (!isSdp(offer, "offer")) {
        return res.status(400).json({ success: false, message: "Connection offer is missing" });
      }
      const active = [...sessions.values()].filter(
        (s) => s.senderId === req.userId && ["waiting", "claimed", "answered"].includes(s.state)
      );
      if (active.length >= MAX_ACTIVE_PER_SENDER) {
        return res.status(429).json({ success: false, message: "Finish or cancel your other direct transfers first" });
      }

      const [sender, receiver] = await Promise.all([
        User.findById(req.userId).select("username"),
        User.findById(receiverId).select("username")
      ]);
      if (!receiver) return res.status(404).json({ success: false, message: "Receiver not found" });

      const now = Date.now();
      const session = {
        id: crypto.randomUUID(),
        senderId: req.userId,
        senderName: sender?.username || "someone",
        receiverId: String(receiver._id),
        receiverName: receiver.username,
        name: name.slice(0, 255),
        size: bytes,
        mimeType: typeof mimeType === "string" && mimeType ? mimeType.slice(0, 200) : "application/octet-stream",
        isFolder: Boolean(isFolder),
        offer: { type: "offer", sdp: offer.sdp },
        state: "waiting",
        createdAt: now,
        updatedAt: now
      };
      sessions.set(session.id, session);
      res.json({ success: true, transfer: publicView(session, req.userId) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Receiver: direct transfers waiting for my DROP (no connection details here)
  router.get("/incoming", authenticate, (req, res) => {
    expire();
    const waiting = [...sessions.values()]
      .filter((s) => s.receiverId === req.userId && s.state === "waiting")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => publicView(s, req.userId));
    res.json({ success: true, count: waiting.length, transfers: waiting });
  });

  // Receiver: take the oldest waiting transfer (the DROP gesture). Only one receiver can claim it.
  router.post("/claim", authenticate, (req, res) => {
    expire();
    const wanted = req.body?.id;
    const candidates = [...sessions.values()]
      .filter((s) => s.receiverId === req.userId && s.state === "waiting" && (!wanted || s.id === wanted))
      .sort((a, b) => a.createdAt - b.createdAt);
    const session = candidates[0];
    if (!session) return res.json({ success: false, message: "No direct transfer is waiting for you" });
    set(session, { state: "claimed" });
    res.json({ success: true, transfer: { ...publicView(session, req.userId), offer: session.offer } });
  });

  router.post("/:id/answer", authenticate, (req, res) => {
    const session = mine(req, res);
    if (!session) return;
    if (session.receiverId !== req.userId) return res.status(403).json({ success: false, message: "Only the receiver can answer" });
    if (session.state !== "claimed") return res.status(409).json({ success: false, message: `Transfer is ${session.state}` });
    if (!isSdp(req.body?.answer, "answer")) return res.status(400).json({ success: false, message: "Connection answer is missing" });
    set(session, { state: "answered", answer: { type: "answer", sdp: req.body.answer.sdp } });
    res.json({ success: true });
  });

  router.get("/:id", authenticate, (req, res) => {
    expire();
    const session = mine(req, res);
    if (!session) return;
    res.json({ success: true, transfer: publicView(session, req.userId) });
  });

  // Either side reports the end. The receiver's report (with its own SHA-256) is what counts.
  router.post("/:id/finish", authenticate, async (req, res) => {
    const session = mine(req, res);
    if (!session) return;
    if (["done", "failed", "cancelled"].includes(session.state)) {
      return res.json({ success: true, transfer: publicView(session, req.userId) });
    }

    const ok = req.body?.ok === true;
    const isReceiver = session.receiverId === req.userId;

    if (!ok || !isReceiver) {
      // A failure from either side, or a sender who finished first and waits for the receiver
      if (!ok) set(session, { state: "failed", reason: String(req.body?.reason || "Connection lost").slice(0, 200) });
      return res.json({ success: true, transfer: publicView(session, req.userId) });
    }

    const sha256 = typeof req.body?.sha256 === "string" ? req.body.sha256.toLowerCase().slice(0, 64) : null;
    const verified = req.body?.verified === true;
    set(session, { state: "done", sha256, verified });

    try {
      const deliveredAt = new Date();
      const common = {
        filename: `direct:${session.id}`,
        originalName: session.name,
        size: session.size,
        mimeType: session.mimeType,
        fileCategory: getFileCategory(session.mimeType, session.name),
        isFolder: session.isFolder,
        sha256,
        mode: "direct",
        expired: true // bytes were never stored on the server, so there is nothing to download later
      };
      const sendRow = await new File({
        ...common,
        userId: session.senderId,
        receiverId: session.receiverId,
        exchangedWith: session.receiverId,
        transferType: "send",
        dropped: true,
        deliveredAt
      }).save();
      await new File({
        ...common,
        userId: session.receiverId,
        receiverId: session.senderId,
        exchangedWith: session.senderId,
        transferType: "receive",
        dropped: true,
        deliveredAt,
        sourceFileId: sendRow._id
      }).save();
    } catch (error) {
      console.error("Could not save direct transfer history:", error.message);
    }

    res.json({ success: true, transfer: publicView(session, req.userId) });
  });

  router.delete("/:id", authenticate, (req, res) => {
    const session = mine(req, res);
    if (!session) return;
    if (!["done", "failed", "cancelled"].includes(session.state)) {
      set(session, {
        state: "cancelled",
        reason: session.senderId === req.userId ? "The sender cancelled" : "The receiver cancelled"
      });
    }
    res.json({ success: true });
  });

  return router;
};
