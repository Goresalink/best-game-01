// storage.js — the best score, kept in localStorage so a returning player
// sees their record on the title screen. Nothing else is persisted.
const KEY = 'emberfall.best.v1';

export function loadBest() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function saveBest(score) {
  try {
    const prev = loadBest();
    if (score > prev) {
      window.localStorage.setItem(KEY, String(Math.floor(score)));
      return true;
    }
  } catch {
    // Storage unavailable (private mode, blocked): the game still plays.
  }
  return false;
}
