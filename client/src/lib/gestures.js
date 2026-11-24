// Gesture logic for DropIt, kept separate from React so it can be tested and described in the paper.
//
// 1. Every camera frame, MediaPipe gives a raw label (Closed_Fist, Open_Palm, None, ...).
// 2. mapLabel() turns it into one of: "fist", "open", "none".
// 3. GestureStateMachine smooths the labels over a short TIME window (not a frame count),
//    so it behaves the same on a fast laptop (30 fps) and a slow phone (8 fps):
//    a hand state becomes "stable" when it is at least STABLE_RATIO of the frames seen in the
//    last STABLE_MS, with at least MIN_FRAMES frames. Otherwise the previous state is kept.
// 4. Events come from TRANSITIONS between stable hand states, like a real grab and release:
//      open hand -> fist      = "grab"  (sender picks the file up)
//      fist      -> open hand = "drop"  (receiver lets the file go)
//    The first state only has to have been seen within ARM_MS before the second one, and
//    "no hand" frames in between (motion blur while closing the hand) are ignored.
//    A hand that rests in one state never fires, and flicker never becomes stable.

export const STABLE_MS = 300;       // smoothing window
export const STABLE_RATIO = 0.6;    // share of frames in the window that must agree
export const MIN_FRAMES = 2;        // never decide from a single frame
export const ARM_MS = 2000;         // max gap between the two hand states of a grab / drop
export const EVENT_COOLDOWN_MS = 1000;
export const MIN_SCORE = 0.5;       // MediaPipe category score below this is treated as "none"

export const mapLabel = (categoryName, score = 1, minScore = MIN_SCORE) => {
  if (!categoryName || score < minScore) return "none";
  const name = String(categoryName).toLowerCase();
  // Built-in MediaPipe labels, plus labels a custom DropIt model may use later
  if (name === "closed_fist" || name === "fist" || name === "grab") return "fist";
  if (name === "open_palm" || name === "open" || name === "drop" || name === "release") return "open";
  return "none";
};

export class GestureStateMachine {
  constructor({
    stableMs = STABLE_MS,
    stableRatio = STABLE_RATIO,
    minFrames = MIN_FRAMES,
    armMs = ARM_MS,
    cooldownMs = EVENT_COOLDOWN_MS
  } = {}) {
    Object.assign(this, { stableMs, stableRatio, minFrames, armMs, cooldownMs });
    this.reset();
  }

  reset() {
    this.frames = []; // { label, t }
    this.stable = "none";
    this.lastStableAt = { fist: -Infinity, open: -Infinity, none: -Infinity };
    this.lastEventAt = -Infinity;
  }

  // Feed one frame. Returns { stable, votes, event, primed }:
  //  event  = "grab" | "drop" | null
  //  primed = the event that will fire if the hand switches state now ("grab" after an open hand,
  //           "drop" after a fist), for on-screen step hints
  push(label, now) {
    this.frames.push({ label, t: now });
    while (this.frames.length && now - this.frames[0].t > this.stableMs) this.frames.shift();

    const counts = { fist: 0, open: 0, none: 0 };
    for (const frame of this.frames) counts[frame.label] = (counts[frame.label] || 0) + 1;
    const total = this.frames.length;

    let leader = "none";
    for (const key of ["fist", "open", "none"]) if (counts[key] > counts[leader]) leader = key;

    let event = null;
    const enough = counts[leader] >= this.minFrames && counts[leader] / total >= this.stableRatio;

    if (enough && leader !== this.stable) {
      this.stable = leader;
      const coolingDown = now - this.lastEventAt < this.cooldownMs;
      if (!coolingDown && leader === "fist" && now - this.lastStableAt.open <= this.armMs) event = "grab";
      if (!coolingDown && leader === "open" && now - this.lastStableAt.fist <= this.armMs) event = "drop";
      if (event) {
        this.lastEventAt = now;
        // The finished gesture must not also start the opposite one (grab then instantly drop)
        this.lastStableAt.open = -Infinity;
        this.lastStableAt.fist = -Infinity;
      }
    }

    this.lastStableAt[this.stable] = now;

    let primed = null;
    const recentOpen = now - this.lastStableAt.open <= this.armMs;
    const recentFist = now - this.lastStableAt.fist <= this.armMs;
    if (this.stable === "open" || (this.stable === "none" && recentOpen && !recentFist)) primed = "grab";
    else if (this.stable === "fist" || (this.stable === "none" && recentFist && !recentOpen)) primed = "drop";

    return {
      stable: this.stable,
      votes: total ? counts[this.stable] / total : 0,
      event,
      primed
    };
  }
}
