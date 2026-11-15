// util.js — small shared helpers: a seedable RNG and math the whole game uses.
// Every random draw in the game goes through these so the screenshot scenes
// (?shot=) can rebuild a scene deterministically from one seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Pick one element of an array with a random function.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// A point just outside one edge of the arena, for spawning enemies.
export function edgePoint(rng, w, h, margin) {
  const side = Math.floor(rng() * 4);
  if (side === 0) return { x: -margin, y: rng() * h };
  if (side === 1) return { x: w + margin, y: rng() * h };
  if (side === 2) return { x: rng() * w, y: -margin };
  return { x: rng() * w, y: h + margin };
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ':' + String(s).padStart(2, '0');
}
