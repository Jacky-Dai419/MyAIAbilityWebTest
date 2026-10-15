import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./vendor/iso-kit.mjs";
import { SPEC, pose, readoutOf } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

const WIDTH = 700;
const HEIGHT = 460;
const TAU = Math.PI * 2;

const pitch = (teeth, module) => (module * teeth) / 2;
const M = { barrel: 0.5, center: 0.46, third: 0.44, fourth: 0.38, motion: 0.34, escape: 0.76 };

const wheel = {
  barrel: pitch(SPEC.teeth.barrel, M.barrel),
  centerPinion: pitch(SPEC.teeth.centerPinion, M.barrel),
  center: pitch(SPEC.teeth.center, M.center),
  thirdPinion: pitch(SPEC.teeth.thirdPinion, M.center),
  third: pitch(SPEC.teeth.third, M.third),
  fourthPinion: pitch(SPEC.teeth.fourthPinion, M.third),
  fourth: pitch(SPEC.teeth.fourth, M.fourth),
  escapePinion: pitch(SPEC.teeth.escapePinion, M.fourth),
  escape: pitch(SPEC.teeth.escape, M.escape),
  cannon: pitch(SPEC.teeth.cannon, M.motion),
  minute: pitch(SPEC.teeth.minute, M.motion),
  minutePinion: pitch(SPEC.teeth.minutePinion, M.motion),
  hour: pitch(SPEC.teeth.hour, M.motion),
};

const meshDist = {
  barrel: wheel.barrel + wheel.centerPinion,
  center: wheel.center + wheel.thirdPinion,
  third: wheel.third + wheel.fourthPinion,
  fourth: wheel.fourth + wheel.escapePinion,
  motion: wheel.cannon + wheel.minute,
};

const polar = (origin, angle, distance) => [origin[0] + Math.cos(angle) * distance, origin[1] + Math.sin(angle) * distance];
const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const BAL_R = 10.4;
const centerAt = [0, 0];
const barrelAt = polar(centerAt, 2.45, meshDist.barrel);
const thirdAt = polar(centerAt, 0.85, meshDist.center);
const fourthAt = polar(thirdAt, -0.55, meshDist.third);
const escapeAt = polar(fourthAt, 0.95, meshDist.fourth);
const balanceAt = polar(escapeAt, 0.15, wheel.escape + BAL_R + 2.4);
const palletAt = polar(escapeAt, 0.15, wheel.escape + 3.4);
const minuteAt = polar(centerAt, -1.35, meshDist.motion);

const Z = {
  barrel: 4.4,
  barrelH: 1.7,
  center: 6.45,
  centerH: 0.9,
  third: 7.7,
  thirdH: 0.85,
  fourth: 8.9,
  fourthH: 0.85,
  escape: 10.1,
  escapeH: 0.9,
  pallet: 10.1,
  balance: 11.4,
  balanceH: 1.0,
  motion: 12.75,
  motionH: 0.7,
  hour: 13.6,
  hands: 14.5,
  plateTop: 4.2,
};

const hubs = [barrelAt, centerAt, thirdAt, fourthAt, escapeAt, balanceAt, minuteAt];
const mainCenter = [
  hubs.reduce((sum, point) => sum + point[0], 0) / hubs.length,
  hubs.reduce((sum, point) => sum + point[1], 0) / hubs.length,
];
const tips = [
  [barrelAt, wheel.barrel],
  [centerAt, wheel.center],
  [thirdAt, wheel.third],
  [fourthAt, wheel.fourth],
  [escapeAt, wheel.escape],
  [balanceAt, BAL_R],
  [minuteAt, wheel.minute],
];
const MAIN_R = tips.reduce((reach, [point, radius]) => Math.max(reach, gap(point, mainCenter) + radius), 0) + 7;
const margin = 22;
const PLATE = {
  x: mainCenter[0] - MAIN_R - margin,
  y: mainCenter[1] - MAIN_R - margin,
  w: MAIN_R * 2 + margin * 2 + 18,
  d: MAIN_R * 2 + margin * 2,
  r: 8,
};
const PLATE_H = 8;
const FOOT_H = 4;

const MOVE = {
  hands: [0, 3, 10],
  crown: [12, 0, 2],
  escapement: [8, 6, 9],
  train: [-4, 8, 8],
  barrel: [-10, -6, 8],
};

function assertLayout() {
  const pairs = [
    [barrelAt, centerAt, meshDist.barrel, "barrel mesh"],
    [centerAt, thirdAt, meshDist.center, "center mesh"],
    [thirdAt, fourthAt, meshDist.third, "third mesh"],
    [fourthAt, escapeAt, meshDist.fourth, "fourth mesh"],
    [centerAt, minuteAt, meshDist.motion, "motion mesh"],
  ];
  for (const [a, b, want, name] of pairs) {
    const got = gap(a, b);
    if (Math.abs(got - want) > 1e-6) throw new Error(`${name}: ${got} != ${want}`);
  }
  const discs = [
    ["barrel", barrelAt, wheel.barrel, Z.barrel, Z.barrelH],
    ["centerPinion", centerAt, wheel.centerPinion, Z.barrel, Z.barrelH],
    ["center", centerAt, wheel.center, Z.center, Z.centerH],
    ["thirdPinion", thirdAt, wheel.thirdPinion, Z.center, 1.25],
    ["third", thirdAt, wheel.third, Z.third, Z.thirdH],
    ["fourthPinion", fourthAt, wheel.fourthPinion, Z.third, 1.2],
    ["fourth", fourthAt, wheel.fourth, Z.fourth, Z.fourthH],
    ["escapePinion", escapeAt, wheel.escapePinion, Z.fourth, 1.15],
    ["escape", escapeAt, wheel.escape, Z.escape, Z.escapeH],
    ["balance", balanceAt, BAL_R, Z.balance, Z.balanceH],
    ["cannon", centerAt, wheel.cannon, Z.motion, Z.motionH],
    ["minute", minuteAt, wheel.minute, Z.motion, Z.motionH],
    ["hour", centerAt, wheel.hour, Z.hour, 0.8],
  ];
  const meshes = new Set(["barrel|centerPinion", "center|thirdPinion", "third|fourthPinion", "fourth|escapePinion", "cannon|minute"]);
  for (let i = 0; i < discs.length; i++) {
    for (let j = i + 1; j < discs.length; j++) {
      const A = discs[i];
      const B = discs[j];
      const zOverlap = A[3] < B[3] + B[4] - 0.05 && B[3] < A[3] + A[4] - 0.05;
      if (!zOverlap) continue;
      const key = `${A[0]}|${B[0]}`;
      const need = A[2] + B[2];
      const got = gap(A[1], B[1]);
      if (meshes.has(key)) {
        if (got + 0.05 < need) throw new Error(`mesh bodies intersect ${key}`);
      } else if (got < need - 0.02) {
        throw new Error(`overlap ${key}: gap ${got.toFixed(2)} need ${need.toFixed(2)}`);
      }
    }
  }
  const arbors = [centerAt, fourthAt, escapeAt, balanceAt];
  for (const arbor of arbors) {
    for (const disc of discs) {
      if (gap(disc[1], arbor) < 0.2) continue;
      const z0 = Z.plateTop;
      const z1 = Z.hands;
      if (disc[3] > z1 || disc[3] + disc[4] < z0) continue;
      if (gap(disc[1], arbor) < disc[2] + 0.62) {
        throw new Error(`arbor through ${disc[0]} at ${arbor.map((n) => n.toFixed(1)).join(",")}`);
      }
    }
  }
}
assertLayout();

const fitPoints = [
  ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
  [centerAt[0], centerAt[1], Z.hands + 2],
  [balanceAt[0], balanceAt[1], Z.balance + Z.balanceH + 2],
  [fourthAt[0], fourthAt[1], Z.hands + 1],
  ...Object.values(MOVE).flatMap((move) => [
    [centerAt[0] + move[0], centerAt[1] + move[1], Z.hands + move[2]],
    [balanceAt[0] + move[0], balanceAt[1] + move[1], Z.balance + move[2]],
  ]),
];
const P = k.fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 28, azimuth: 42, elevation: 42 });
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function screws(points, z, radius = 2) {
  return L(points.map(([x, y]) => k.ring(x, y, radius, z, P, 14)).join(""), { tone: "lo" }) + D(points.map(([x, y]) => at([x, y, z])), { size: 0.46 });
}

function rectRing(cx, cy, length, width, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const ax = (c * length) / 2;
  const ay = (s * length) / 2;
  const px = (-s * width) / 2;
  const py = (c * width) / 2;
  return [
    [cx - ax - px, cy - ay - py],
    [cx + ax - px, cy + ay - py],
    [cx + ax + px, cy + ay + py],
    [cx - ax + px, cy - ay + py],
  ];
}

function arm(from, to, width, z, height) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  return S(k.extrude(rectRing(mid[0], mid[1], len, width, Math.atan2(dy, dx)), z, height, P, { bevel: 0.28 }), { tone: "mid" });
}

function gearBody(id, [x, y], radius, z, height, { tone = "hi", lit = false, steps = 48 } = {}) {
  const spec = GEARS[id];
  const tip = radius + spec.module;
  const root = Math.max(0.45, radius - spec.module * 1.15);
  return [
    S(k.cylinder(x, y, radius, z, height, P, steps, 0.28), { tone, crease: "lo", lit }),
    L(k.ring(x, y, tip, z + height, P, Math.max(steps, 36)), { tone: "mid" }),
    L(k.ring(x, y, root, z + height, P, Math.max(24, Math.round(steps / 2))), { tone: "mid" }),
    `<g data-live="teeth" data-id="${id}"></g>`,
  ].join("");
}

function arbor(x, y, z0, z1, radius = 0.58) {
  if (z1 - z0 < 0.2) return "";
  return S(k.cylinder(x, y, radius, z0, z1 - z0, P, 14), { tone: "mid", crease: "none" });
}

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  const seam = k.sideSeam(PLATE, -5, P, 8);
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.5), { tone: "mid", inner: L(seam, { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  out.push(screws(k.corners(PLATE, 12), 0));
  const strip = { x: PLATE.x + 14, y: PLATE.y + PLATE.d - 13, w: Math.min(110, PLATE.w - 36), d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.55, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.4, 0.55, [1.5, 2.3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const label = { x: PLATE.x + 14, y: PLATE.y + 12, w: 34, d: 14, r: 1.3 };
  out.push(S(k.slabOf(label, 0, 0.7, P, 4), { tone: "lo", crease: "none" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 5, label.y + 5.5], 0.75, P, "x"), "18000", { size: 2.5, tone: "mid" }));
  out.push(S(k.cylinder(mainCenter[0], mainCenter[1], MAIN_R + 2.4, 0, 1.6, P, 72, 0.35), { tone: "lo" }));
  out.push(S(k.cylinder(mainCenter[0], mainCenter[1], MAIN_R, Z.plateTop - 2.6, 2.6, P, 80, 0.45), { tone: "mid" }));
  out.push(L(k.ring(mainCenter[0], mainCenter[1], MAIN_R - 1.8, Z.plateTop, P, 80), { tone: "faint" }));
  out.push(L(k.sideArc(mainCenter[0], mainCenter[1], MAIN_R, Z.plateTop - 1.2, P, 40), { tone: "faint" }));
  out.push(screws([0.5, 2.1, 3.7, 5.3].map((angle) => polar(mainCenter, angle, MAIN_R - 5)), Z.plateTop, 1.45));
  const bolt = [];
  for (let step = 0; step < 18; step++) bolt.push(at([...polar(mainCenter, (step / 18) * TAU, MAIN_R - 3.4), Z.plateTop]));
  out.push(D(bolt, { size: 0.38, tone: "mid" }));
  return out.join("");
}

const GEARS = {
  barrel: { x: barrelAt[0], y: barrelAt[1], pitch: wheel.barrel, module: M.barrel, z: Z.barrel + Z.barrelH, n: SPEC.teeth.barrel },
  ratchet: { x: barrelAt[0], y: barrelAt[1], pitch: 4.6, module: 0.42, z: Z.barrel + Z.barrelH + 1.15, n: 16 },
  centerPinion: { x: centerAt[0], y: centerAt[1], pitch: wheel.centerPinion, module: M.barrel, z: Z.barrel + 2.3, n: SPEC.teeth.centerPinion },
  center: { x: centerAt[0], y: centerAt[1], pitch: wheel.center, module: M.center, z: Z.center + Z.centerH, n: SPEC.teeth.center },
  thirdPinion: { x: thirdAt[0], y: thirdAt[1], pitch: wheel.thirdPinion, module: M.center, z: Z.center + 1.25, n: SPEC.teeth.thirdPinion },
  third: { x: thirdAt[0], y: thirdAt[1], pitch: wheel.third, module: M.third, z: Z.third + Z.thirdH, n: SPEC.teeth.third },
  fourthPinion: { x: fourthAt[0], y: fourthAt[1], pitch: wheel.fourthPinion, module: M.third, z: Z.third + 1.2, n: SPEC.teeth.fourthPinion },
  fourth: { x: fourthAt[0], y: fourthAt[1], pitch: wheel.fourth, module: M.fourth, z: Z.fourth + Z.fourthH, n: SPEC.teeth.fourth },
  escapePinion: { x: escapeAt[0], y: escapeAt[1], pitch: wheel.escapePinion, module: M.fourth, z: Z.fourth + 1.15, n: SPEC.teeth.escapePinion },
  escape: { x: escapeAt[0], y: escapeAt[1], pitch: wheel.escape, module: M.escape, z: Z.escape + Z.escapeH, n: SPEC.teeth.escape },
  cannon: { x: centerAt[0], y: centerAt[1], pitch: wheel.cannon, module: M.motion, z: Z.motion + Z.motionH, n: SPEC.teeth.cannon },
  minute: { x: minuteAt[0], y: minuteAt[1], pitch: wheel.minute, module: M.motion, z: Z.motion + Z.motionH, n: SPEC.teeth.minute },
  hour: { x: centerAt[0], y: centerAt[1], pitch: wheel.hour, module: M.motion, z: Z.hour + 0.8, n: SPEC.teeth.hour },
};

function barrelGroup() {
  const [x, y] = barrelAt;
  const out = [];
  out.push(arbor(x, y, Z.plateTop, Z.barrel));
  out.push(gearBody("barrel", barrelAt, wheel.barrel, Z.barrel, Z.barrelH, { tone: "hi", steps: 64 }));
  out.push(S(k.cylinder(x, y, 4.6, Z.barrel + Z.barrelH, 1.15, P, 32, 0.2), { tone: "mid" }));
  out.push(gearBody("ratchet", barrelAt, 4.6, Z.barrel + Z.barrelH, 1.15, { tone: "mid", steps: 32 }));
  const clickAngle = 2.4;
  const click = polar(barrelAt, clickAngle, 7.4);
  out.push(S(k.extrude(rectRing(click[0], click[1], 4.8, 1.35, clickAngle + 0.9), Z.barrel + Z.barrelH + 0.15, 0.9, P, { bevel: 0.2 }), { tone: "mid" }));
  out.push(screws([polar(barrelAt, clickAngle + 0.5, 9.6)], Z.barrel + Z.barrelH + 1.05, 1.15));
  const rim = polar(barrelAt, -2.3, wheel.barrel + 6);
  out.push(arm(barrelAt, rim, 3.4, Z.barrel + Z.barrelH + 1.2, 0.7));
  out.push(L(k.ring(x, y, 1.3, Z.barrel + Z.barrelH + 2.85, P, 16), { tone: "lo" }));
  out.push(D([at([x, y, Z.barrel + Z.barrelH + 2.85])], { size: 0.48, tone: "hi" }));
  return out.join("");
}

function trainGroup() {
  const out = [];
  out.push(arbor(centerAt[0], centerAt[1], Z.plateTop, Z.center));
  out.push(gearBody("centerPinion", centerAt, wheel.centerPinion, Z.barrel, Z.barrelH, { tone: "hi", steps: 20 }));
  out.push(gearBody("center", centerAt, wheel.center, Z.center, Z.centerH, { tone: "hi", steps: 64 }));
  out.push(arbor(thirdAt[0], thirdAt[1], Z.plateTop, Z.third));
  out.push(gearBody("thirdPinion", thirdAt, wheel.thirdPinion, Z.center, 1.25, { tone: "hi", steps: 18 }));
  out.push(gearBody("third", thirdAt, wheel.third, Z.third, Z.thirdH, { tone: "hi", steps: 56 }));
  out.push(arbor(fourthAt[0], fourthAt[1], Z.plateTop, Z.hands));
  out.push(gearBody("fourthPinion", fourthAt, wheel.fourthPinion, Z.third, 1.2, { tone: "hi", steps: 18 }));
  out.push(gearBody("fourth", fourthAt, wheel.fourth, Z.fourth, Z.fourthH, { tone: "hi", steps: 64 }));
  const cock = polar(thirdAt, -2.2, 7);
  out.push(arm(thirdAt, cock, 3.1, Z.third + Z.thirdH + 0.2, 0.7));
  out.push(L(k.ring(thirdAt[0], thirdAt[1], 1.15, Z.third + Z.thirdH + 1.65, P, 14), { tone: "lo" }));
  out.push(D([at([thirdAt[0], thirdAt[1], Z.third + Z.thirdH + 1.65])], { size: 0.42 }));
  return out.join("");
}

function escapeGroup() {
  const [x, y] = escapeAt;
  const out = [];
  out.push(arbor(x, y, Z.plateTop, Z.escape));
  out.push(gearBody("escapePinion", escapeAt, wheel.escapePinion, Z.fourth, 1.15, { tone: "hi", steps: 16 }));
  out.push(gearBody("escape", escapeAt, wheel.escape, Z.escape, Z.escapeH, { tone: "hi", steps: 32 }));
  out.push(arbor(palletAt[0], palletAt[1], Z.plateTop, Z.pallet));
  out.push(`<g data-live="pallet"></g>`);
  out.push(L(k.ring(palletAt[0], palletAt[1], 1.05, Z.pallet + 1.2, P, 14), { tone: "lo" }));
  return out.join("");
}

function balanceGroup() {
  const [x, y] = balanceAt;
  const top = Z.balance + Z.balanceH;
  const out = [];
  out.push(arbor(x, y, Z.plateTop, Z.balance));
  out.push(S(k.cylinder(x, y, 2.15, Z.balance - 1.15, 1.15, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, BAL_R, Z.balance, Z.balanceH, P, 64, 0.35), { tone: "hi", crease: "lo", lit: true }));
  out.push(L(k.ring(x, y, BAL_R - 0.35, top, P, 64), { tone: "lo" }));
  out.push(L(k.ring(x, y, 1.7, top, P, 20), { tone: "mid" }));
  out.push(`<g data-live="spokes"></g>`);
  out.push(S(k.cylinder(x, y, 1.45, top, 0.7, P, 16), { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.65, top + 0.75, P, 18), { tone: "lo" }));
  out.push(`<g data-live="spring"></g>`);
  const stud = spiralEnd(0);
  out.push(S(k.cylinder(stud[0], stud[1], 0.7, top + 0.55, 0.85, P, 12), { tone: "mid" }));
  out.push(D([at([stud[0], stud[1], top + 1.4])], { size: 0.5, tone: "hi" }));
  const far = polar(balanceAt, -2.4, 7);
  out.push(arm(balanceAt, far, 3.2, top + 0.55, 0.75));
  out.push(L(k.ring(x, y, 1.2, top + 2.6, P, 14), { tone: "lo" }));
  out.push(D([at([x, y, top + 2.6])], { size: 0.45, tone: "hi" }));
  return out.join("");
}

function spiralEnd() {
  const turns = 7.25;
  const a = turns * TAU;
  return [balanceAt[0] + Math.sin(a) * 8.1, balanceAt[1] - Math.cos(a) * 8.1];
}

function handsGroup() {
  const out = [];
  out.push(gearBody("cannon", centerAt, wheel.cannon, Z.motion, Z.motionH, { tone: "hi", steps: 20 }));
  out.push(arbor(minuteAt[0], minuteAt[1], Z.motion, Z.motion + Z.motionH));
  out.push(gearBody("minute", minuteAt, wheel.minute, Z.motion, Z.motionH, { tone: "hi", steps: 36 }));
  out.push(S(k.cylinder(minuteAt[0], minuteAt[1], wheel.minutePinion, Z.hour, 0.75, P, 16), { tone: "mid" }));
  out.push(gearBody("hour", centerAt, wheel.hour, Z.hour, 0.8, { tone: "hi", steps: 40 }));
  out.push(L(k.ring(centerAt[0], centerAt[1], 1.15, Z.hands, P, 16), { tone: "mid" }));
  out.push(L(k.ring(fourthAt[0], fourthAt[1], 0.95, Z.hands, P, 14), { tone: "mid" }));
  out.push(`<g data-live="hands"></g>`);
  return out.join("");
}

function crownGroup() {
  const y = mainCenter[1];
  const x = mainCenter[0] + MAIN_R + 2;
  const out = [];
  out.push(S(k.extrude(rectRing(mainCenter[0] + MAIN_R - 7, y, 14, 1.8, 0), Z.barrel, 1.35, P, { bevel: 0.22 }), { tone: "mid" }));
  const crownZ = Z.barrel + 3;
  out.push(S(k.cylinder(x + 4, y, 3.6, Z.barrel - 0.4, 3.4, P, 32, 0.3), { tone: "hi" }));
  out.push(L(k.knurl(x + 4, y, 3.6, Z.barrel, Z.barrel + 2.6, 26, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x + 4, y, 3.6, crownZ, P, 36), { tone: "mid" }));
  out.push(L(k.lineOnTop([x + 4, y], [x + 4 + 3.6, y], crownZ, P), { tone: "hi" }));
  out.push(D([at([x + 4, y, crownZ])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

function depthKey(point) {
  return k.depthOf(point, P);
}

function group(piece, part, point, body) {
  const move = MOVE[piece] || [0, 0, 0];
  const lift = depthKey(move) - depthKey([0, 0, 0]);
  return `<g class="it" data-piece="${piece}" data-part="${part}" data-k="${depthKey(point).toFixed(4)}" data-lift="${lift.toFixed(4)}">${body}</g>`;
}

const start = pose(10 * 3600 + 10 * 60 + 30, 3);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "一只打开的机械表机芯，放在铺有尺的底板上。发条盒、轮系、擒纵叉、摆轮和指针按真实齿数联动。拖动可上条，空格可拆开。",
  body: [
    group("bench", "bench", [0, 0, 0], bench()),
    group("barrel", "barrel", [barrelAt[0], barrelAt[1], Z.barrel], barrelGroup()),
    group("train", "train", [thirdAt[0], thirdAt[1], Z.third], trainGroup()),
    group("escapement", "escape", [escapeAt[0], escapeAt[1], Z.escape], escapeGroup()),
    group("escapement", "balance", [balanceAt[0], balanceAt[1], Z.balance], balanceGroup()),
    group("hands", "hands", [centerAt[0], centerAt[1], Z.hands], handsGroup()),
    group("crown", "crown", [mainCenter[0] + MAIN_R + 6, mainCenter[1], Z.barrel], crownGroup()),
  ],
});

const LAYOUT = {
  gears: GEARS,
  balance: { x: balanceAt[0], y: balanceAt[1], z: Z.balance + Z.balanceH, springZ: Z.balance + Z.balanceH + 0.78 },
  pallet: { x: palletAt[0], y: palletAt[1], z: Z.pallet, aim: Math.atan2(escapeAt[1] - palletAt[1], escapeAt[0] - palletAt[0]) },
  escape: { x: escapeAt[0], y: escapeAt[1] },
  center: { x: centerAt[0], y: centerAt[1] },
  fourth: { x: fourthAt[0], y: fourthAt[1] },
  handsZ: Z.hands,
  spring: { turns: 7.25, r0: 1.65, r1: 8.1 },
  spoke: { inner: 1.7, outer: BAL_R - 0.35 },
  move: MOVE,
};

const CHAPTERS = [
  {
    title: "整只机芯",
    part: "",
    apart: false,
    rate: 1,
    text: "机械表靠发条走时，不靠电池。能量从条盒出来，轮系把转速降下来，擒纵一拍一拍地放，摆轮决定每一拍有多长。右下角的时间，就是这套齿数算出来的。",
  },
  {
    title: "表冠",
    part: "crown",
    apart: false,
    rate: 1,
    windTo: 4.2,
    text: "右边滚花的是表冠。左右拖动它，就是在给发条上劲。这只教学机芯上满是 5 圈。上满以后，大约能走 40 小时。",
  },
  {
    title: "发条盒",
    part: "barrel",
    apart: true,
    rate: 1,
    text: "发条收在条盒里。条盒 48 个齿，咬着中心齿轴的 6 个齿，传动比是 8。所以条盒转一圈，中心轮走 8 小时。棘轮跟着上条转。止逆把发条卡住，不让它一下子弹回去。走时的时候，是条盒在慢慢转。",
  },
  {
    title: "轮系",
    part: "train",
    apart: true,
    rate: 1,
    text: "轮系做的是除法。中心轮 48 齿，三轮 45 齿，四轮 60 齿，齿轴都是 6 叶。中心轮到四轮是 60 比 1。中心轮一小时转一圈，四轮就一分钟转一圈。秒针装在四轮的轴上，不在表的正中。",
  },
  {
    title: "擒纵",
    part: "escape",
    apart: true,
    rate: 0.22,
    text: "齿轮如果直接连着发条，劲几秒钟就放完了。擒纵轮有 15 个齿。每半个齿被叉瓦卡住，停一下，再放一下。一停一放是一拍。这只表每秒 5 拍，一小时 18000 拍。嘀嗒声就是这一下。",
  },
  {
    title: "摆轮",
    part: "balance",
    apart: true,
    rate: 0.22,
    text: "真正量时间的，是摆轮和游丝。游丝把摆轮拉回来。它每秒摆 2.5 次，来回都算，就是 5 拍。摆幅大约 270 度。摆得稳，每一拍一样长，秒针才走得稳。",
  },
  {
    title: "指针",
    part: "hands",
    apart: true,
    rate: 1,
    text: "指针只是把角度读出来。分针跟着中心轮，一小时一圈。时针经过跨轮，再缩小 12 倍，十二小时才转一圈。秒针跟着四轮，一分钟一圈。三根针的位置，来自同一套齿数。",
  },
  {
    title: "合起来",
    part: "",
    apart: false,
    rate: 1,
    text: "发条出能量，轮系降速，擒纵切成一拍一拍，摆轮规定每一拍的长度。右下角先是时分秒，后面是还剩多少小时动力。空格可以拆开，左右键可以上条。",
  },
];

const live = `
const P = ${JSON.stringify(P)};
const LAYOUT = ${JSON.stringify(LAYOUT)};
const CHAPTERS = ${JSON.stringify(CHAPTERS)};
const SPEC_FULL = ${SPEC.fullTurns};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const captionTitle = document.querySelector("[data-chapter-title]");
const captionText = document.querySelector("[data-chapter-text]");
const playBtn = document.querySelector('[data-act="play"]');
const apartBtn = document.querySelector('[data-act="apart"]');
const slowBtn = document.querySelector('[data-act="slow"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const PARTS = ["crown", "barrel", "train", "escape", "balance", "hands"];
const STAGGER = ["hands", "crown", "escapement", "train", "barrel"];
let wind = 3;
let windTarget = 3;
let elapsed = 10 * 3600 + 10 * 60 + 30;
let rate = 1;
let slow = false;
let winding = false;
let windIdle = 0;
let apart = false;
let focus = "";
let playing = false;
let chapter = -1;
let chapterTimer = 0;
let lastBeat = -1;
let audio = null;
let frame = 0;
let last = 0;
let clock = 0;
let touring = !still.matches;
let visible = false;
let idleTimer = 0;
let dragging = false;
let lastX = 0;
const springs = {};
STAGGER.forEach((name) => { springs[name] = { x: 0, v: 0, target: 0, at: 0 }; });

function tipOf(spec) { return spec.pitch + spec.module; }
function rootOf(spec) { return Math.max(0.45, spec.pitch - spec.module * 1.15); }
function teethOf(spec, angle) {
  const tip = tipOf(spec);
  const len = tip - rootOf(spec);
  const ticks = radialTicks(spec.x, spec.y, tip, spec.n, 1, spec.z, [len, len], P, angle);
  const ring = lineSvg(ticks.major, { tone: spec.n <= 16 ? "hi" : "mid" });
  return ring;
}
function handPath(x, y, z, angle, length, back) {
  const sx = Math.sin(angle);
  const sy = -Math.cos(angle);
  return lineOnTop([x - sx * back, y - sy * back], [x + sx * length, y + sy * length], z, P);
}
function springPath(inner) {
  const b = LAYOUT.balance;
  const s = LAYOUT.spring;
  const steps = 96;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const radius = s.r0 + (s.r1 - s.r0) * u;
    const angle = inner * (1 - u) + u * s.turns * TAU;
    pts.push(iso([b.x + Math.sin(angle) * radius, b.y - Math.cos(angle) * radius, b.springZ], P));
  }
  return lineSvg(pathOf(pts), { tone: "mid" });
}
function spokePath(angle) {
  const b = LAYOUT.balance;
  let d = "";
  for (let i = 0; i < 3; i++) {
    const a = angle + (i * TAU) / 3;
    d += lineOnTop(
      [b.x + Math.sin(a) * LAYOUT.spoke.inner, b.y - Math.cos(a) * LAYOUT.spoke.inner],
      [b.x + Math.sin(a) * LAYOUT.spoke.outer, b.y - Math.cos(a) * LAYOUT.spoke.outer],
      b.z,
      P,
    );
  }
  return lineSvg(d, { tone: "mid" });
}
function palletHtml(offset) {
  const p = LAYOUT.pallet;
  const angle = p.aim + offset;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const length = 8.4;
  const width = 1.45;
  const ring = [
    [p.x - c * 1.2 - -s * width / 2, p.y - s * 1.2 - c * width / 2],
    [p.x + c * length - -s * width / 2, p.y + s * length - c * width / 2],
    [p.x + c * length + -s * width / 2, p.y + s * length + c * width / 2],
    [p.x - c * 1.2 + -s * width / 2, p.y - s * 1.2 + c * width / 2],
  ];
  const parts = [solidSvg(extrude(ring, p.z, 1.05, P, { bevel: 0.18 }), { tone: "hi" })];
  for (const side of [-0.42, 0.42]) {
    const a = angle + side;
    const x = p.x + c * (length - 0.3) + Math.cos(a) * 0.15;
    const y = p.y + s * (length - 0.3) + Math.sin(a) * 0.15;
    parts.push(solidSvg(cylinder(x, y, 0.72, p.z + 0.15, 1.15, P, 12), { tone: "hi" }));
  }
  return parts.join("");
}
function drawHands(state) {
  const c = LAYOUT.center;
  const f = LAYOUT.fourth;
  const z = LAYOUT.handsZ;
  const a = state.angle;
  return [
    '<path class="iso-line" data-tone="hi" data-free="" style="stroke-width:1.15" d="' + handPath(c.x, c.y, z - 0.35, a.hour, 8.5, 1.8) + '"/>',
    '<path class="iso-line" data-tone="hi" data-free="" style="stroke-width:0.9" d="' + handPath(c.x, c.y, z, a.center, 12.4, 2.2) + '"/>',
    '<path class="iso-line" data-tone="hi" data-free="" style="stroke-width:0.85" d="' + handPath(f.x, f.y, z, a.second, 9.2, 2.4) + '"/>',
  ].join("");
}
function applyFocus() {
  svg.querySelectorAll("[data-part]").forEach((el) => el.removeAttribute("data-on"));
  if (focus) {
    stage.setAttribute("data-focus", "");
    svg.querySelectorAll('[data-part="' + focus + '"]').forEach((el) => el.setAttribute("data-on", ""));
  } else {
    stage.removeAttribute("data-focus");
  }
  document.querySelectorAll("[data-pick]").forEach((btn) => {
    if (btn.dataset.pick === focus) btn.setAttribute("data-on", "");
    else btn.removeAttribute("data-on");
  });
}
function describe() {
  const state = pose(elapsed, wind);
  const text = readoutOf(state, winding) + (apart ? " · 拆开" : "") + (focus ? " · " + focus : "");
  stage.setAttribute("aria-valuetext", text);
}
function select(part) {
  focus = part || "";
  applyFocus();
  describe();
}
function setApart(next) {
  apart = next;
  const order = apart ? STAGGER : STAGGER.slice().reverse();
  order.forEach((name, index) => {
    springs[name].target = apart ? 1 : 0;
    springs[name].at = clock + index * 0.04;
  });
  apartBtn.setAttribute("data-on", apart ? "" : "");
  if (!apart) apartBtn.removeAttribute("data-on");
  describe();
}
function stepSpring(spring, dt, calm) {
  if (clock < spring.at) return;
  if (calm) { spring.x = spring.target; spring.v = 0; return; }
  const stiff = 64;
  const damp = 14.2;
  for (let i = 0; i < 4; i++) {
    spring.v += ((spring.target - spring.x) * stiff - spring.v * damp) * (dt / 4);
    spring.x += spring.v * (dt / 4);
  }
  if (Math.abs(spring.target - spring.x) < 0.0005 && Math.abs(spring.v) < 0.0005) {
    spring.x = spring.target;
    spring.v = 0;
  }
}
function placeGroups() {
  const nodes = [...svg.querySelectorAll(".it[data-piece]")].filter((el) => el.dataset.piece !== "bench");
  nodes.forEach((el) => {
    const spring = springs[el.dataset.piece];
    const move = LAYOUT.move[el.dataset.piece];
    const share = spring ? spring.x : 0;
    if (!move || share === 0) el.removeAttribute("transform");
    else el.setAttribute("transform", translateAlong(P, [move[0] * share, move[1] * share, move[2] * share]));
    el.dataset.order = String(Number(el.dataset.k) + Number(el.dataset.lift) * share);
  });
  const changed = nodes.some((el, index) => index > 0 && Number(nodes[index - 1].dataset.order) > Number(el.dataset.order));
  if (changed) {
    nodes.sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
    const frag = document.createDocumentFragment();
    nodes.forEach((el) => frag.appendChild(el));
    svg.appendChild(frag);
  }
}
function tickAudio(state) {
  if (still.matches || !state.running || state.beatN === lastBeat) return;
  if (lastBeat >= 0 && audio) {
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = state.beatN % 2 ? 1800 : 2400;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }
  lastBeat = state.beatN;
}
function ensureAudio() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audio = new Ctx();
  }
  if (audio && audio.state === "suspended") audio.resume();
}
function draw() {
  const state = pose(elapsed, wind);
  const angles = {
    barrel: state.angle.barrel,
    ratchet: state.angle.ratchet,
    centerPinion: -state.angle.barrel * (SPEC.teeth.barrel / SPEC.teeth.centerPinion),
    center: state.angle.center,
    thirdPinion: state.angle.third,
    third: state.angle.third,
    fourthPinion: state.angle.fourth,
    fourth: state.angle.fourth,
    escapePinion: state.angle.escape,
    escape: state.angle.escape,
    cannon: state.angle.center,
    minute: state.angle.minuteWheel,
    hour: state.angle.hour,
  };
  svg.querySelectorAll('[data-live="teeth"]').forEach((el) => {
    const spec = LAYOUT.gears[el.dataset.id];
    el.innerHTML = teethOf(spec, angles[el.dataset.id] || 0);
  });
  const spokes = svg.querySelector('[data-live="spokes"]');
  const spring = svg.querySelector('[data-live="spring"]');
  const pallet = svg.querySelector('[data-live="pallet"]');
  const hands = svg.querySelector('[data-live="hands"]');
  if (spokes) spokes.innerHTML = spokePath(state.balance);
  if (spring) spring.innerHTML = springPath(state.balance);
  if (pallet) pallet.innerHTML = palletHtml(state.pallet);
  if (hands) hands.innerHTML = drawHands(state);
  const text = readoutOf(state, winding);
  if (readout.textContent !== text) readout.textContent = text;
  tickAudio(state);
  return state;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  clock += calm ? 0 : dt;
  if (touring && !playing && windTarget < 2) windTarget = 3.5;
  wind = calm ? windTarget : wind + (windTarget - wind) * (1 - Math.exp(-dt / 0.35));
  if (Math.abs(windTarget - wind) < 0.004) wind = windTarget;
  const stateBefore = pose(elapsed, wind);
  if (stateBefore.running) elapsed += dt * rate;
  STAGGER.forEach((name) => stepSpring(springs[name], dt, calm));
  placeGroups();
  draw();
  if (winding) {
    windIdle += dt;
    if (windIdle > 0.8) { winding = false; windIdle = 0; }
  }
  const moving = STAGGER.some((name) => springs[name].x !== springs[name].target) || Math.abs(wind - windTarget) > 0.004 || playing || touring || pose(elapsed, wind).running;
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
function user() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches && !playing; run(); }, 3600);
  run();
}
function stopLecture() {
  playing = false;
  clearTimeout(chapterTimer);
  chapter = -1;
  if (window.speechSynthesis) speechSynthesis.cancel();
  playBtn.textContent = "播放讲解";
  playBtn.removeAttribute("data-on");
  rate = slow ? 0.22 : 1;
  select("");
  captionTitle.textContent = "待机";
  captionText.textContent = "拖动上条，或播放讲解。讲到哪个零件，画面就点亮哪个零件。";
}
function showChapter(index) {
  if (!playing) return;
  if (index >= CHAPTERS.length) { stopLecture(); setApart(false); return; }
  chapter = index;
  const item = CHAPTERS[index];
  captionTitle.textContent = item.title;
  captionText.textContent = item.text;
  select(item.part);
  rate = item.rate;
  slow = item.rate < 0.5;
  if (slow) slowBtn.setAttribute("data-on", "");
  else slowBtn.removeAttribute("data-on");
  if (item.windTo) windTarget = item.windTo;
  if (item.apart !== apart) setApart(item.apart);
  clearTimeout(chapterTimer);
  let done = false;
  const finish = () => {
    if (done || chapter !== index || !playing) return;
    done = true;
    showChapter(index + 1);
  };
  try {
    if (window.speechSynthesis) {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(item.text);
      utter.lang = "zh-CN";
      utter.rate = 1;
      utter.onend = finish;
      utter.onerror = () => {};
      speechSynthesis.speak(utter);
    }
  } catch (error) {}
  chapterTimer = setTimeout(finish, Math.min(32000, Math.max(9000, item.text.length * 280)));
  run();
}
function startLecture() {
  if (playing) { stopLecture(); return; }
  ensureAudio();
  playing = true;
  touring = false;
  playBtn.textContent = "停止讲解";
  playBtn.setAttribute("data-on", "");
  if (pose(elapsed, wind).reserveHours < 8) windTarget = 4;
  showChapter(0);
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointerdown", (event) => {
  dragging = true;
  lastX = event.clientX;
  stage.setPointerCapture(event.pointerId);
  ensureAudio();
  user();
  winding = true;
});
stage.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const box = stage.getBoundingClientRect();
  windTarget = clamp(windTarget + ((event.clientX - lastX) / Math.max(box.width, 1)) * 7.5, 0, SPEC_FULL);
  lastX = event.clientX;
  winding = true;
  windIdle = 0;
  user();
});
const endDrag = () => { dragging = false; };
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    const step = event.shiftKey ? 1 : 0.25;
    windTarget = clamp(windTarget + (event.key === "ArrowRight" ? step : -step), 0, SPEC_FULL);
    winding = true;
    windIdle = 0;
    ensureAudio();
    user();
  } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    const here = Math.max(0, PARTS.indexOf(focus));
    const next = event.key === "ArrowDown" ? Math.min(PARTS.length - 1, here + 1) : Math.max(0, here - 1);
    user();
    select(PARTS[focus ? next : 0]);
  } else if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    user();
    setApart(!apart);
  } else if (event.key === "Enter") {
    event.preventDefault();
    startLecture();
  } else if (event.key === "Escape") {
    user();
    stopLecture();
    select("");
    setApart(false);
  }
});
playBtn.addEventListener("click", () => { ensureAudio(); startLecture(); });
apartBtn.addEventListener("click", () => { user(); setApart(!apart); });
slowBtn.addEventListener("click", () => {
  user();
  slow = !slow;
  rate = slow ? 0.22 : 1;
  if (slow) slowBtn.setAttribute("data-on", "");
  else slowBtn.removeAttribute("data-on");
  run();
});
document.querySelectorAll("[data-pick]").forEach((btn) => {
  btn.addEventListener("click", () => { user(); select(btn.dataset.pick === focus ? "" : btn.dataset.pick); });
});
if (still.matches) touring = false;
applyFocus();
draw();
describe();
run();
`;

const extra = `
<style>
  body{font-family:"PingFang SC","Noto Sans SC","WenQuanYi Micro Hei","Microsoft YaHei",ui-sans-serif,system-ui,sans-serif}
  .iso-stage{touch-action:pan-y;cursor:ew-resize}
  .iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
  .iso-stage[data-focus] [data-part]:not([data-on]){--anatomy-hi:var(--anatomy-mid);--anatomy-mid:var(--anatomy-lo)}
  .iso-stage[data-focus] [data-part="bench"]:not([data-on]){--anatomy-hi:var(--anatomy-mid)}
  .iso-stage[data-focus] [data-part][data-on]{--anatomy-hi:var(--anatomy-lit);--anatomy-mid:var(--anatomy-hi)}
  .iso-stage[data-focus] [data-part][data-on] .iso-top{fill:var(--anatomy-lit-top)}
  .iso-stage[data-focus] [data-part][data-on] .iso-shade{fill:var(--anatomy-lit-shade)}
  .lecture{display:grid;gap:12px;margin-top:18px}
  .lecture-bar,.lecture-parts{display:flex;flex-wrap:wrap;gap:8px}
  .lecture button{font:inherit;font-size:13px;padding:6px 12px;border-radius:999px;border:1px solid var(--anatomy-mid);background:transparent;color:var(--anatomy-text);cursor:pointer}
  .lecture button[data-on]{color:var(--anatomy-strong);border-color:var(--anatomy-strong)}
  .lecture-now{margin:0;min-height:5.6em;color:var(--anatomy-text);font-size:15px;line-height:1.7}
  .lecture-now strong{display:block;margin-bottom:4px;color:var(--anatomy-strong);font-size:12px;letter-spacing:.12em}
  .lecture-note{margin:0;color:var(--anatomy-muted);font-size:12px;line-height:1.6}
  .lecture-note a{color:var(--anatomy-text)}
</style>`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "机芯走时",
  hint: "拖动上条 · 空格拆开",
  readout: readoutOf(start, false),
  keys: [
    { mark: "lit", label: "摆轮：每秒摆 2.5 次，决定每一拍有多长" },
    { mark: "raised", label: "轮系：中心轮到四轮是 60 比 1" },
    { mark: "dim", label: "条盒：上满 5 圈，约走 40 小时" },
  ],
  caption:
    "教学机芯。条盒 48 齿对中心齿轴 6 叶，一圈条盒走 8 小时，上满 5 圈约 40 小时。中心轮 48、三轮 45、四轮 60，齿轴都是 6 叶，中心轮到秒轮正好 60 比 1。擒纵轮 15 齿，每秒 5 拍，合每小时 18000 次。时分秒和剩余动力都由这组数算出。",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="机械表机芯。左右键上条，上下键选择零件，空格拆开，回车播放讲解">${svg}</div>`,
});

const panel = `<section class="lecture" aria-label="讲解">
  <div class="lecture-bar">
    <button type="button" data-act="play">播放讲解</button>
    <button type="button" data-act="apart">拆开</button>
    <button type="button" data-act="slow">慢放</button>
  </div>
  <p class="lecture-now"><strong data-chapter-title>待机</strong><span data-chapter-text>拖动上条，或播放讲解。讲到哪个零件，画面就点亮哪个零件。</span></p>
  <div class="lecture-parts">
    <button type="button" data-pick="crown">表冠</button>
    <button type="button" data-pick="barrel">发条盒</button>
    <button type="button" data-pick="train">轮系</button>
    <button type="button" data-pick="escape">擒纵</button>
    <button type="button" data-pick="balance">摆轮</button>
    <button type="button" data-pick="hands">指针</button>
  </div>
  <p class="lecture-note">这是按 Anatomy 的方法做的交互剖视，再加上一步一步的讲解。语音用浏览器朗读。它是教学模型，不是某一款实表的零件图；拍频、齿数和走时彼此一致，但具体夹角和外观仍应再核对。 <a href="../index.html">返回 AI 协作力扫描</a></p>
</section>`;

function kitSource() {
  return readFileSync(join(HERE, "vendor/iso-kit.mjs"), "utf8").replace(/^export /gm, "");
}
function modelSource() {
  return readFileSync(join(HERE, "model.mjs"), "utf8")
    .replace(/^export /gm, "")
    .replace(/\nif \(process\.argv\[1\][\s\S]*$/, "\n");
}

const file = theme === "light" ? "index.html" : "dark.html";
const html = k.pageHtml({
  title: "机械表如何计时",
  theme,
  width: 760,
  body: extra + plate + panel,
  script: kitSource() + modelSource() + live,
});
writeFileSync(join(HERE, file), html);
const solids = (svg.match(/iso-solid/g) || []).length;
console.log("wrote", file, "solids", solids, "mainR", MAIN_R.toFixed(1), "plate", PLATE.w.toFixed(0), readoutOf(start, false));
