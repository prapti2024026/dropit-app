// Run with:  npm run test:gestures
// Checks the smoothing + transition rules that decide when a grab or drop fires.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GestureStateMachine, mapLabel } from "./gestures.js";

const repeat = (label, count) => Array(count).fill(label);

const run = (sequence, fps = 30) => {
  const machine = new GestureStateMachine();
  const events = [];
  sequence.forEach((label, index) => {
    const result = machine.push(label, (index * 1000) / fps);
    if (result.event) events.push(result.event);
  });
  return events;
};

test("open hand then fist is a grab", () => {
  assert.deepEqual(run([...repeat("open", 20), ...repeat("fist", 20)]), ["grab"]);
});

test("fist then open hand is a drop", () => {
  assert.deepEqual(run([...repeat("fist", 20), ...repeat("open", 20)]), ["drop"]);
});

test("a quick grab (0.3 s open, 0.3 s fist) fires on the first try", () => {
  assert.deepEqual(run([...repeat("open", 9), ...repeat("fist", 9)]), ["grab"]);
});

test("works the same on a slow phone camera (8 fps)", () => {
  assert.deepEqual(run([...repeat("open", 3), ...repeat("fist", 3)], 8), ["grab"]);
  assert.deepEqual(run([...repeat("fist", 3), ...repeat("open", 3)], 8), ["drop"]);
});

test("motion blur ('no hand' frames) while closing the hand is tolerated", () => {
  const seq = [...repeat("open", 10), "none", "none", "fist", "none", "none", "none", ...repeat("fist", 10)];
  assert.deepEqual(run(seq), ["grab"]);
});

test("a hand appearing as a fist straight away does not grab", () => {
  assert.deepEqual(run([...repeat("none", 30), ...repeat("fist", 60)]), []);
});

test("a hand resting open never fires", () => {
  assert.deepEqual(run(repeat("open", 300)), []);
});

test("flickering labels never fire", () => {
  assert.deepEqual(run(Array.from({ length: 300 }, (_, i) => (i % 3 ? "open" : "fist"))), []);
});

test("a long pause between open and fist does not count", () => {
  assert.deepEqual(run([...repeat("open", 20), ...repeat("none", 80), ...repeat("fist", 20)]), []);
});

test("a grab does not immediately count as a drop when the hand relaxes", () => {
  assert.deepEqual(run([...repeat("open", 15), ...repeat("fist", 15), ...repeat("open", 30)]), ["grab"]);
});

test("primed tells the UI which step comes next", () => {
  const machine = new GestureStateMachine();
  let state;
  for (let i = 0; i < 10; i += 1) state = machine.push("open", i * 33);
  assert.equal(state.primed, "grab");
  for (let i = 10; i < 20; i += 1) state = machine.push("fist", i * 33);
  assert.equal(state.event === "grab" || state.stable === "fist", true);
});

test("labels are mapped and low scores ignored", () => {
  assert.equal(mapLabel("Closed_Fist", 0.9), "fist");
  assert.equal(mapLabel("Open_Palm", 0.9), "open");
  assert.equal(mapLabel("Open_Palm", 0.2), "none");
  assert.equal(mapLabel("Victory", 0.99), "none");
});
