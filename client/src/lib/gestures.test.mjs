// Run with:  npm run test:gestures
// Checks the voting + transition rules that decide when a grab or drop fires.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GestureStateMachine, mapLabel } from "./gestures.js";

const FPS = 30;
const repeat = (label, count) => Array(count).fill(label);

const run = (sequence) => {
  const machine = new GestureStateMachine();
  const events = [];
  sequence.forEach((label, index) => {
    const result = machine.push(label, (index * 1000) / FPS);
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

test("a hand resting open never fires", () => {
  assert.deepEqual(run(repeat("open", 300)), []);
});

test("flickering labels never fire", () => {
  assert.deepEqual(run(Array.from({ length: 300 }, (_, i) => (i % 3 ? "open" : "fist"))), []);
});

test("a long pause between open and fist does not count", () => {
  assert.deepEqual(run([...repeat("open", 20), ...repeat("none", 80), ...repeat("fist", 20)]), []);
});

test("labels are mapped and low scores ignored", () => {
  assert.equal(mapLabel("Closed_Fist", 0.9), "fist");
  assert.equal(mapLabel("Open_Palm", 0.9), "open");
  assert.equal(mapLabel("Open_Palm", 0.2), "none");
  assert.equal(mapLabel("Victory", 0.99), "none");
});
