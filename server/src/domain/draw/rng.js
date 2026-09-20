/**
 * Deterministic pseudo-random generator (mulberry32).
 *
 * The draw engine never calls Math.random directly: every draw carries a seed
 * so that a simulation can be replayed, audited and — if the admin is happy —
 * published with exactly the same outcome.
 */
export function createRng(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed ?? Date.now()));
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomSeed() {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
