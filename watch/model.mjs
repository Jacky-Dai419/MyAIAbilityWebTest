// Teaching caliber. Every readout, hand and gear angle comes from these counts.
// 18,000 vph = 5 beats/s. Escape wheel 15 teeth, two beats per tooth.
// Barrel 48 / center pinion 6 = 8, so one barrel turn is 8 hours. Five turns ≈ 40 h.
// Center 48 / third pinion 6 = 8. Third 45 / fourth pinion 6 = 7.5. Product = 60,
// so the fourth wheel (seconds) turns once a minute and the center wheel once an hour.
// Fourth 60 / escape pinion 6 = 10, so the escape wheel turns once per 6 seconds.
// Motion works (10/30)×(8/32) = 1/12.

export const SPEC = {
  beatHz: 5,
  vph: 18000,
  escapeTeeth: 15,
  fullTurns: 5,
  hoursPerBarrelTurn: 8,
  reserveHours: 40,
  amplitudeDeg: 270,
  teeth: {
    barrel: 48,
    centerPinion: 6,
    center: 48,
    thirdPinion: 6,
    third: 45,
    fourthPinion: 6,
    fourth: 60,
    escapePinion: 6,
    escape: 15,
    cannon: 10,
    minute: 30,
    minutePinion: 8,
    hour: 32,
  },
};

const TAU = Math.PI * 2;
const R_BARREL = SPEC.teeth.barrel / SPEC.teeth.centerPinion;
const R_CENTER = SPEC.teeth.center / SPEC.teeth.thirdPinion;
const R_THIRD = SPEC.teeth.third / SPEC.teeth.fourthPinion;
const R_ESCAPE = SPEC.teeth.fourth / SPEC.teeth.escapePinion;
const R_HOUR = (SPEC.teeth.cannon / SPEC.teeth.minute) * (SPEC.teeth.minutePinion / SPEC.teeth.hour);

function smooth(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** @param {number} elapsed seconds of watch time since 12:00:00 @param {number} wind barrel-arbor turns, 0–5 */
export function pose(elapsed, wind) {
  const turns = Math.min(SPEC.fullTurns, Math.max(0, wind));
  const cap = turns * SPEC.hoursPerBarrelTurn * 3600;
  const run = Math.min(Math.max(0, elapsed), cap);
  const running = turns > 0 && elapsed < cap - 0.04;
  const beatF = run * SPEC.beatHz;
  const beatN = Math.floor(beatF + 1e-9);
  const frac = beatF - beatN;
  const jump = smooth(0.06, 0.24, frac);
  const escapeBeats = (running ? beatN + jump : beatN);
  const escapeRev = escapeBeats / (SPEC.escapeTeeth * 2);
  const fourthRev = escapeRev / R_ESCAPE;
  const centerRev = fourthRev / (R_CENTER * R_THIRD);
  const barrelRev = centerRev / R_BARREL;
  const reserveHours = Math.max(0, turns * SPEC.hoursPerBarrelTurn - run / 3600);
  const osc = run * (SPEC.beatHz / 2);
  const balance = (SPEC.amplitudeDeg * Math.PI) / 180 * Math.sin(osc * TAU);
  const side = beatN % 2 === 0 ? -1 : 1;
  const pallet = side * 0.16 * (0.25 + 0.75 * (running ? jump : 1));
  const aCenter = -centerRev * TAU;
  const aThird = -aCenter * R_CENTER;
  const aFourth = -aThird * R_THIRD;
  const aEscape = -aFourth * R_ESCAPE;
  return {
    run,
    running,
    wind: turns,
    beatN,
    reserveHours,
    balance,
    pallet,
    angle: {
      barrel: barrelRev * TAU,
      ratchet: turns * TAU,
      center: aCenter,
      third: aThird,
      fourth: aFourth,
      escape: aEscape,
      minuteWheel: -aCenter * (SPEC.teeth.cannon / SPEC.teeth.minute),
      hour: aCenter * R_HOUR,
      second: aFourth,
    },
  };
}

export function readoutOf(state, winding) {
  const hm = Math.floor(state.run / 3600) % 12;
  const hh = hm === 0 ? 12 : hm;
  const mm = Math.floor(state.run / 60) % 60;
  const ss = Math.floor(state.run % 60);
  const pad = (n) => String(n).padStart(2, "0");
  const time = `${hh}:${pad(mm)}:${pad(ss)}`;
  const power = `${state.reserveHours.toFixed(1)} 时`;
  if (state.reserveHours <= 0.02) return "停走 · 余 0 时";
  if (winding) return `上条 ${state.wind.toFixed(1)} 圈 · 余 ${power}`;
  return `${time} · 余 ${power}`;
}

if (process.argv[1] && process.argv[1].endsWith("model.mjs")) {
  const hour = pose(3600, 5);
  const almost = Math.abs(hour.angle.center + Math.PI * 2);
  const fourth = Math.abs(hour.angle.fourth + 60 * Math.PI * 2);
  const escape = Math.abs(hour.angle.escape - 600 * Math.PI * 2);
  const barrel = Math.abs(hour.angle.barrel - (1 / 8) * Math.PI * 2);
  const left = Math.abs(hour.reserveHours - 39);
  const beats = pose(1, 5).beatN;
  const ratio = (48 / 6) * (45 / 6);
  if (ratio !== 60) throw new Error("center-to-fourth ratio");
  if (almost > 1e-6) throw new Error("center wheel should turn once per hour " + almost);
  if (fourth > 1e-6) throw new Error("fourth wheel should turn 60 times per hour " + fourth);
  if (escape > 1e-4) throw new Error("escape wheel should turn 600 times per hour " + escape);
  if (barrel > 1e-6) throw new Error("barrel should turn 1/8 per hour " + barrel);
  if (left > 1e-9) throw new Error("reserve " + hour.reserveHours);
  if (beats !== 5) throw new Error("beats in one second " + beats);
  if ((10 / 30) * (8 / 32) !== 1 / 12) throw new Error("hour ratio");
  const stopped = pose(40 * 3600 + 10, 5);
  if (stopped.running) throw new Error("should stop when unwound");
  if (readoutOf(stopped, false) !== "停走 · 余 0 时") throw new Error(readoutOf(stopped, false));
  console.log("model ok", readoutOf(pose(10 * 3600 + 10 * 60 + 30, 3), false));
}
