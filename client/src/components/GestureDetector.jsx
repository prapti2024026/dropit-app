import { useEffect, useRef, useState } from "react";
import { Camera, Grab, Hand, Loader2, VideoOff } from "lucide-react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { GestureStateMachine, mapLabel } from "../lib/gestures";
import "./GestureDetector.css";

// WASM files are copied into /public/mediapipe/wasm by `npm install` (see scripts/prepare-mediapipe.mjs).
// If that folder is missing, the CDN copy is used instead.
const LOCAL_WASM = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const CDN_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";

// Built-in MediaPipe gesture model (labels include Closed_Fist, Open_Palm, None).
// `npm install` tries to save a copy in public/models so the app does not depend on Google's server.
// A custom DropIt model trained with MediaPipe Model Maker can be used by setting VITE_GESTURE_MODEL_URL.
const MODEL_URLS = [
  import.meta.env.VITE_GESTURE_MODEL_URL,
  `${import.meta.env.BASE_URL}models/gesture_recognizer.task`,
  "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"
].filter(Boolean);

const createRecognizer = async () => {
  let lastError;
  for (const wasmBase of [LOCAL_WASM, CDN_WASM]) {
    let vision;
    try {
      vision = await FilesetResolver.forVisionTasks(wasmBase);
    } catch (error) {
      lastError = error;
      continue;
    }
    for (const modelAssetPath of MODEL_URLS) {
      for (const delegate of ["GPU", "CPU"]) {
        try {
          return await GestureRecognizer.createFromOptions(vision, {
            baseOptions: { modelAssetPath, delegate },
            runningMode: "VIDEO",
            numHands: 1
          });
        } catch (error) {
          lastError = error;
        }
      }
    }
  }
  const error = new Error("Could not load the gesture model. Check the internet connection and reload.");
  error.cause = lastError;
  throw error;
};

const LABEL_TEXT = { fist: "Fist", open: "Open hand", none: "No hand" };

/**
 * Runs the webcam + MediaPipe gesture recognizer and reports:
 *  - onEvent("grab" | "drop")  when a real grab (open -> fist) or release (fist -> open) happens
 *  - onStable(state, votes)    the smoothed hand state, for on-screen feedback
 * `armed` only changes what the preview shows; the pages decide whether an event does anything.
 */
// Steps shown under the camera for the gesture the page is waiting for
const STEPS = {
  grab: [
    { state: "open", text: "Open hand" },
    { state: "fist", text: "Close fist" }
  ],
  drop: [
    { state: "fist", text: "Make a fist" },
    { state: "open", text: "Open hand" }
  ]
};

const GestureDetector = ({ onEvent, onStable, hint, armed, armedText, idleText, target = "grab" }) => {
  const videoRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const onStableRef = useRef(onStable);

  const [status, setStatus] = useState("loading"); // loading | running | error
  const [errorText, setErrorText] = useState("");
  const [stable, setStable] = useState("none");
  const [votes, setVotes] = useState(0);
  const [perf, setPerf] = useState({ fps: 0, ms: 0 });
  const [flash, setFlash] = useState(null);
  const [primed, setPrimed] = useState(null);

  useEffect(() => {
    onEventRef.current = onEvent;
    onStableRef.current = onStable;
  }, [onEvent, onStable]);

  useEffect(() => {
    let cancelled = false;
    let recognizer = null;
    let stream = null;
    let frameId = null;
    const machine = new GestureStateMachine();

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not available. Open DropIt over HTTPS (or localhost) and allow camera access.");
        }

        // Camera first, so the user sees themselves while the model loads
        stream = await navigator.mediaDevices.getUserMedia({
          // A small frame is plenty for one hand and keeps inference fast on phones
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 30 } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        recognizer = await createRecognizer();
        if (cancelled) {
          recognizer.close();
          return;
        }
        setStatus("running");

        let lastVideoTime = -1;
        let frames = 0;
        let msTotal = 0;
        let windowStart = performance.now();
        let lastStable = "none";
        let lastPrimed = null;

        const loop = () => {
          if (cancelled) return;
          frameId = requestAnimationFrame(loop);

          if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
          lastVideoTime = video.currentTime;

          const t0 = performance.now();
          const result = recognizer.recognizeForVideo(video, t0);
          const t1 = performance.now();

          const top = result.gestures?.[0]?.[0];
          const label = mapLabel(top?.categoryName, top?.score);
          const state = machine.push(label, t1);

          if (state.event) {
            setFlash(state.event);
            setTimeout(() => setFlash(null), 900);
            onEventRef.current?.(state.event);
          }

          if (state.stable !== lastStable) {
            lastStable = state.stable;
            setStable(state.stable);
          }
          if (state.primed !== lastPrimed) {
            lastPrimed = state.primed;
            setPrimed(state.primed);
          }
          onStableRef.current?.(state.stable, state.votes);

          frames += 1;
          msTotal += t1 - t0;
          if (t1 - windowStart >= 1000) {
            setVotes(state.votes);
            setPerf({ fps: Math.round((frames * 1000) / (t1 - windowStart)), ms: Math.round(msTotal / frames) });
            frames = 0;
            msTotal = 0;
            windowStart = t1;
          }
        };

        loop();
      } catch (error) {
        if (cancelled) return;
        stream?.getTracks().forEach((track) => track.stop()); // no gestures, so no reason to keep the camera on
        console.error("Gesture detector error:", error);
        setStatus("error");
        setErrorText(
          error?.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in your browser settings and reload."
            : error?.message || "Could not start the gesture camera."
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
      recognizer?.close();
    };
  }, []);

  const StepIcon = target === "grab" ? Grab : Hand;

  return (
    <section className={`gesture-panel ${target} ${armed ? "armed" : ""}`} aria-label="Gesture camera">
      <header className="gesture-head">
        <span className={`icon-tile ${target}`}>
          <Camera />
        </span>
        <div>
          <h2>Gesture camera</h2>
          <p>{hint}</p>
        </div>
        <span className={`gesture-live ${status}`}>
          {status === "running" ? "Live" : status === "loading" ? "Starting" : "Off"}
        </span>
      </header>

      <div className="gesture-video-wrap">
        <video ref={videoRef} className="gesture-video" autoPlay muted playsInline />
        {status === "loading" && (
          <div className="gesture-cover">
            <Loader2 className="spin" size={28} />
            <span>Starting camera and gesture model…</span>
          </div>
        )}
        {status === "error" && (
          <div className="gesture-cover">
            <VideoOff size={28} />
            <span>{errorText}</span>
          </div>
        )}
        {status === "running" && (
          <span className={`gesture-pill ${stable}`}>
            {LABEL_TEXT[stable]}
          </span>
        )}
        {flash && (
          <div className={`gesture-flash ${flash}`}>
            <StepIcon size={44} />
            {flash === "grab" ? "GRAB" : "DROP"}
          </div>
        )}
      </div>

      {status === "running" && (
        <>
          {armed ? (
            <ol className="gesture-steps" aria-label="Gesture steps">
              {STEPS[target].map((step, index) => {
                const first = index === 0;
                // Step 1 is done once the first hand state is seen; then step 2 is the one to do
                const done = first && primed === target;
                const active = first ? primed !== target : primed === target;
                return (
                  <li key={step.state} className={`${done ? "done" : ""} ${active ? "active" : ""}`}>
                    <span className="gesture-step-num">{done ? "✓" : index + 1}</span>
                    {step.text}
                  </li>
                );
              })}
            </ol>
          ) : null}
          <p className={`gesture-line ${armed ? "ready" : ""}`}>{armed ? armedText : idleText}</p>
          <div className="gesture-meter">
            <div className="gesture-votes" title="How many recent frames agree">
              <div style={{ width: `${Math.round(votes * 100)}%` }} />
            </div>
            <span>
              {perf.fps} fps · {perf.ms} ms
            </span>
          </div>
        </>
      )}
    </section>
  );
};

export default GestureDetector;
