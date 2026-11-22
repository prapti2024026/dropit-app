// Gesture logic for DropIt, kept separate from React so it can be tested and described in the paper.
//
// 1. Every camera frame, MediaPipe gives a raw label (Closed_Fist, Open_Palm, None, ...).
// 2. mapLabel() turns it into one of: "fist", "open", "none".
// 3. GestureStateMachine applies temporal voting: a hand state only becomes "stable"
//    when it wins at least VOTE_MIN of the last VOTE_WINDOW frames. This removes flicker.
// 4. Events come from TRANSITIONS between stable states, like a real grab and release:
//      open hand -> fist      = "grab"  (sender picks the file up)
//      fist      -> open hand = "drop"  (receiver lets the file go)
//    A transition only counts if the previous state was seen within TRANSITION_MS,
//    so a hand that has been resting open for a long time cannot trigger a drop by itself.

export const VOTE_WINDOW = 12;      // frames considered (about 0.4 s at 30 fps)
export const VOTE_MIN = 8;          // frames that must agree before a state is accepted
export const TRANSITION_MS = 1500;  // max gap between the two states of a grab / drop
export const EVENT_COOLDOWN_MS = 1500;
export const MIN_SCORE = 0.55;      // MediaPipe category score below this is treated as "none"

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
    windowSize = VOTE_WINDOW,
    minVotes = VOTE_MIN,
    transitionMs = TRANSITION_MS,
    cooldownMs = EVENT_COOLDOWN_MS
  } = {}) {
    this.windowSize = windowSize;
    this.minVotes = minVotes;
    this.transitionMs = transitionMs;
    this.cooldownMs = cooldownMs;
    this.reset();
  }

  reset() {
    this.window = [];
    this.stable = "none";
    this.lastSeen = { fist: -Infinity, open: -Infinity, none: -Infinity };
    this.lastEventAt = -Infinity;
  }

  // Feed one frame. Returns { stable, votes, event } where event is "grab", "drop" or null.
  push(label, now) {
    this.window.push(label);
    if (this.window.length > this.windowSize) this.window.shift();

    const counts = { fist: 0, open: 0, none: 0 };
    for (const item of this.window) counts[item] = (counts[item] || 0) + 1;

    let leader = "none";
    for (const key of ["fist", "open", "none"]) {
      if (counts[key] > counts[leader]) leader = key;
    }

    let event = null;
    const previous = this.stable;

    // Hysteresis: keep the old state until a new one clearly wins the vote
    if (counts[leader] >= this.minVotes && leader !== previous) {
      this.stable = leader;
      const coolingDown = now - this.lastEventAt < this.cooldownMs;

      if (!coolingDown && leader === "fist" && now - this.lastSeen.open <= this.transitionMs) {
        event = "grab";
      } else if (!coolingDown && leader === "open" && now - this.lastSeen.fist <= this.transitionMs) {
        event = "drop";
      }
      if (event) this.lastEventAt = now;
    }

    this.lastSeen[this.stable] = now;

    return {
      stable: this.stable,
      votes: counts[this.stable] / this.windowSize,
      event
    };
  }
}
