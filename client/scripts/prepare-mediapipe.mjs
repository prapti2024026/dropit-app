// Prepares the files the gesture recognizer needs so the app (and the installed PWA)
// can load them from its own server instead of a CDN:
//   1. copies MediaPipe's WebAssembly files into public/mediapipe/wasm
//   2. downloads the gesture model into public/models (skipped if already there or offline)
// Runs automatically after `npm install` (see "postinstall" in package.json).
import { cpSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmTarget = join(root, "public", "mediapipe", "wasm");
const modelTarget = join(root, "public", "models", "gesture_recognizer.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

if (existsSync(source)) {
  mkdirSync(wasmTarget, { recursive: true });
  for (const name of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]) {
    cpSync(join(source, name), join(wasmTarget, name));
  }
  console.log("[mediapipe] WASM files copied to public/mediapipe/wasm");
} else {
  console.warn("[mediapipe] @mediapipe/tasks-vision is not installed yet; skipping WASM copy.");
}

if (existsSync(modelTarget)) {
  console.log("[mediapipe] Gesture model already in public/models");
} else {
  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    mkdirSync(dirname(modelTarget), { recursive: true });
    writeFileSync(modelTarget, Buffer.from(await response.arrayBuffer()));
    console.log("[mediapipe] Gesture model saved to public/models/gesture_recognizer.task");
  } catch (error) {
    // Not fatal: the app falls back to loading the model from Google's server at runtime
    console.warn(`[mediapipe] Could not download the gesture model (${error.message}). The app will load it online.`);
  }
}
