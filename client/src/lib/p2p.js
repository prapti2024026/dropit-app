// Direct browser-to-browser transfer for big files (WebRTC data channel).
// The server only relays the connection details (see server/p2p.js); the bytes go straight
// from the sender's browser to the receiver's, so there is no size limit from our storage.
import axios from "axios";
import { createSHA256 } from "hash-wasm";
import { API_URL, authHeaders } from "./api";

const CHUNK_BYTES = 64 * 1024; // safe message size for every browser
const READ_BYTES = 4 * 1024 * 1024; // read the file 4 MB at a time
const HIGH_WATER = 8 * 1024 * 1024; // pause sending when this much is queued
const LOW_WATER = 2 * 1024 * 1024;
const POLL_MS = 1200;

// Public STUN servers find each side's internet address. An optional TURN relay (for strict
// networks such as some mobile carriers) can be added with VITE_TURN_URL / _USERNAME / _CREDENTIAL.
const iceServers = () => {
  const servers = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
  const turn = import.meta.env.VITE_TURN_URL;
  if (turn) {
    servers.push({
      urls: turn.split(",").map((url) => url.trim()),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL
    });
  }
  return servers;
};

const api = (method, path, data) =>
  axios({ method, url: `${API_URL}/api/p2p${path}`, data, headers: authHeaders() }).then((r) => r.data);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Collect all connection candidates up front, so one offer/answer exchange is enough
const gatherIce = (pc, timeoutMs = 4000) =>
  new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => pc.iceGatheringState === "complete" && done();
    pc.addEventListener("icegatheringstatechange", check);
    const timer = setTimeout(done, timeoutMs); // good enough: host + STUN candidates arrive fast
  });

const waitOpen = (channel, pc, timeoutMs = 30000) =>
  new Promise((resolve, reject) => {
    if (channel.readyState === "open") return resolve();
    const timer = setTimeout(() => reject(new Error(NETWORK_HELP)), timeoutMs);
    channel.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed") {
        clearTimeout(timer);
        reject(new Error(NETWORK_HELP));
      }
    });
  });

export const NETWORK_HELP =
  "A direct connection could not be made between the two networks. Try both devices on the same Wi-Fi, or turn off VPN, and try again.";

export const isDirectSupported = () => typeof window !== "undefined" && "RTCPeerConnection" in window;

const speedTracker = () => {
  const started = performance.now();
  return (done, total) => {
    const seconds = Math.max(0.001, (performance.now() - started) / 1000);
    const bytesPerSecond = done / seconds;
    return { done, total, ratio: total ? done / total : 0, bytesPerSecond, secondsLeft: bytesPerSecond ? (total - done) / bytesPerSecond : null };
  };
};

// ---------------- sender ----------------

// Returns a controller: { promise, cancel() }.
// onStatus(stage, info): "waiting" (for the DROP) → "connecting" → "sending" → "verifying" → "done"
export const sendDirect = ({ file, name, isFolder, receiver, onStatus, onProgress }) => {
  let cancelled = false;
  let transferId = null;
  let pc = null;

  const promise = (async () => {
    pc = new RTCPeerConnection({ iceServers: iceServers() });
    const channel = pc.createDataChannel("dropit-file", { ordered: true });
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = LOW_WATER;

    await pc.setLocalDescription(await pc.createOffer());
    await gatherIce(pc);

    const created = await api("post", "/offers", {
      receiverId: receiver.id,
      name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      isFolder,
      offer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }
    });
    transferId = created.transfer.id;
    onStatus?.("waiting", created.transfer);

    // Wait for the receiver's DROP (their answer)
    let session;
    for (;;) {
      if (cancelled) throw new Error("cancelled");
      await sleep(POLL_MS);
      session = (await api("get", `/${transferId}`)).transfer;
      if (session.state === "answered" && session.answer) break;
      if (["failed", "cancelled"].includes(session.state)) throw new Error(session.reason || `Transfer ${session.state}`);
    }

    onStatus?.("connecting", session);
    await pc.setRemoteDescription(session.answer);
    await waitOpen(channel, pc);

    // Stream: header, the bytes in order, then the SHA-256 of everything sent
    onStatus?.("sending", session);
    const hasher = await createSHA256();
    hasher.init();
    const track = speedTracker();
    channel.send(JSON.stringify({ t: "meta", name, size: file.size, mimeType: file.type, isFolder }));

    let sent = 0;
    for (let offset = 0; offset < file.size; offset += READ_BYTES) {
      if (cancelled) throw new Error("cancelled");
      const block = new Uint8Array(await file.slice(offset, offset + READ_BYTES).arrayBuffer());
      hasher.update(block);
      for (let start = 0; start < block.length; start += CHUNK_BYTES) {
        if (channel.readyState !== "open") throw new Error("The receiver disconnected");
        if (channel.bufferedAmount > HIGH_WATER) {
          await new Promise((resolve) => {
            channel.onbufferedamountlow = () => {
              channel.onbufferedamountlow = null;
              resolve();
            };
          });
        }
        const piece = block.subarray(start, start + CHUNK_BYTES);
        channel.send(piece);
        sent += piece.length;
      }
      onProgress?.(track(sent, file.size));
    }
    const sha256 = hasher.digest("hex");
    channel.send(JSON.stringify({ t: "end", sha256 }));
    onStatus?.("verifying", session);

    // The receiver replies with its own hash once everything is written
    const ack = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The receiver did not confirm the file")), 10 * 60 * 1000);
      channel.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const message = JSON.parse(event.data);
        if (message.t === "ack") {
          clearTimeout(timer);
          resolve(message);
        }
      };
      channel.onclose = () => reject(new Error("The receiver disconnected before confirming"));
    });

    const result = { sha256, verified: ack.ok && ack.sha256 === sha256, transferId };
    onStatus?.("done", result);
    return result;
  })()
    .catch(async (error) => {
      if (transferId) {
        if (cancelled) await api("delete", `/${transferId}`).catch(() => {});
        else await api("post", `/${transferId}/finish`, { ok: false, reason: error.message }).catch(() => {});
      }
      throw error;
    })
    .finally(() => setTimeout(() => pc?.close(), 1500));

  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (transferId) api("delete", `/${transferId}`).catch(() => {});
      pc?.close();
    }
  };
};

// ---------------- receiver ----------------

export const directInbox = () => api("get", "/incoming");

// Big files go to the browser's private disk storage (OPFS) when available, else to memory
const createSink = async (id, size) => {
  try {
    // Writing to disk briefly needs room for two copies (a temporary one, then the final file).
    // Private windows get little storage, so they fall back to memory below.
    const estimate = await navigator.storage?.estimate?.().catch(() => null);
    const free = estimate ? estimate.quota - estimate.usage : 0;
    if (navigator.storage?.getDirectory && free > size * 2.2 + 64 * 1024 * 1024) {
      const root = await navigator.storage.getDirectory();
      // Remove leftovers from earlier transfers
      for await (const [entry] of root.entries?.() || []) {
        if (entry.startsWith("dropit-") && entry !== `dropit-${id}`) await root.removeEntry(entry).catch(() => {});
      }
      const handle = await root.getFileHandle(`dropit-${id}`, { create: true });
      if (handle.createWritable) {
        const writable = await handle.createWritable();
        // Disk writes are slow one by one, so pieces are gathered into 8 MB blocks first
        const BLOCK = 8 * 1024 * 1024;
        let pending = [];
        let pendingBytes = 0;
        let chain = Promise.resolve();
        const flush = () => {
          if (!pendingBytes) return chain;
          const block = new Blob(pending);
          pending = [];
          pendingBytes = 0;
          chain = chain.then(() => writable.write(block));
          return chain;
        };
        return {
          kind: "disk",
          write: (chunk) => {
            pending.push(chunk);
            pendingBytes += chunk.byteLength;
            if (pendingBytes >= BLOCK) flush();
          },
          finish: async (type) => {
            await flush();
            await writable.close();
            const stored = await handle.getFile();
            return new File([stored], stored.name, { type: type || "application/octet-stream" });
          }
        };
      }
    }
  } catch (error) {
    console.warn("Disk storage not available, keeping the file in memory:", error);
  }
  if (size > 4 * 1024 * 1024 * 1024) {
    throw new Error("Not enough browser storage for a file this big. Receive it in a normal (not private) Chrome or Edge window.");
  }
  // Memory fallback: pieces are packed into 8 MB blobs, which the browser can keep on disk itself
  const BLOCK = 8 * 1024 * 1024;
  const blocks = [];
  let pending = [];
  let pendingBytes = 0;
  const pack = () => {
    if (!pendingBytes) return;
    blocks.push(new Blob(pending));
    pending = [];
    pendingBytes = 0;
  };
  return {
    kind: "memory",
    write: (chunk) => {
      pending.push(chunk);
      pendingBytes += chunk.byteLength;
      if (pendingBytes >= BLOCK) pack();
    },
    finish: async (type) => {
      pack();
      return new Blob(blocks, { type: type || "application/octet-stream" });
    }
  };
};

// Claim the oldest waiting direct transfer and receive it. Resolves { meta, blob, sha256, verified }.
export const receiveDirect = async ({ id, onStatus, onProgress } = {}) => {
  const claim = await api("post", "/claim", id ? { id } : {});
  if (!claim.success) return null;
  const transfer = claim.transfer;
  onStatus?.("connecting", transfer);

  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  try {
    const channelPromise = new Promise((resolve) => {
      pc.ondatachannel = (event) => resolve(event.channel);
    });
    await pc.setRemoteDescription(transfer.offer);
    await pc.setLocalDescription(await pc.createAnswer());
    await gatherIce(pc);
    await api("post", `/${transfer.id}/answer`, { answer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });

    const channel = await Promise.race([
      channelPromise,
      sleep(45000).then(() => {
        throw new Error(NETWORK_HELP);
      })
    ]);
    channel.binaryType = "arraybuffer";

    const sink = await createSink(transfer.id, transfer.size);
    const hasher = await createSHA256();
    hasher.init();
    const track = speedTracker();
    let received = 0;
    let lastReport = 0;
    onStatus?.("receiving", transfer);

    const result = await new Promise((resolve, reject) => {
      let finished = false;
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "failed" && !finished) reject(new Error("The connection dropped during the transfer"));
      });
      channel.onclose = () => !finished && reject(new Error("The sender closed the connection"));
      channel.onmessage = async (event) => {
        try {
          if (typeof event.data === "string") {
            const message = JSON.parse(event.data);
            if (message.t !== "end") return;
            finished = true;
            onStatus?.("verifying", transfer);
            const sha256 = hasher.digest("hex");
            const blob = await sink.finish(transfer.mimeType);
            const verified = sha256 === message.sha256 && received === transfer.size;
            channel.send(JSON.stringify({ t: "ack", ok: verified, sha256 }));
            resolve({ blob, sha256, verified, expected: message.sha256 });
            return;
          }
          const chunk = new Uint8Array(event.data);
          hasher.update(chunk);
          received += chunk.length;
          sink.write(chunk);
          const now = performance.now();
          if (now - lastReport > 200 || received === transfer.size) {
            lastReport = now;
            onProgress?.(track(received, transfer.size));
          }
        } catch (error) {
          finished = true;
          reject(error);
        }
      };
    });

    await api("post", `/${transfer.id}/finish`, { ok: true, sha256: result.sha256, verified: result.verified }).catch(() => {});
    onStatus?.("done", transfer);
    return {
      meta: {
        id: transfer.id,
        originalName: transfer.name,
        size: transfer.size,
        mimeType: transfer.mimeType,
        isFolder: transfer.isFolder,
        sender: transfer.sender,
        sha256: result.expected,
        direct: true
      },
      blob: result.blob,
      integrity: result.verified ? "verified" : "mismatch"
    };
  } catch (error) {
    await api("post", `/${transfer.id}/finish`, { ok: false, reason: error.message }).catch(() => {});
    throw error;
  } finally {
    setTimeout(() => pc.close(), 1500);
  }
};
