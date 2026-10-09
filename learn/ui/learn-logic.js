// learn/ui/learn-logic.js
// Pure helpers for the Learn UI. No DOM access, so they run in the browser
// and in node:test alike.

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ANON_ID_KEY = 'learn_anon_id';

// crypto.randomUUID only exists in secure contexts (https, localhost), so fall
// back to getRandomValues for plain-http LAN URLs.
export function generateUuid(cryptoObj = globalThis.crypto) {
  if (typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID();
  const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Returns { id, persistent }. persistent is false when storage is blocked
// (private mode, cleared site data), so the UI can say progress won't be kept.
export function getOrCreateAnonId(storage, cryptoObj = globalThis.crypto) {
  try {
    const existing = storage.getItem(ANON_ID_KEY);
    if (existing && UUID_V4.test(existing)) return { id: existing, persistent: true };
    const id = generateUuid(cryptoObj);
    storage.setItem(ANON_ID_KEY, id);
    return { id, persistent: true };
  } catch {
    return { id: generateUuid(cryptoObj), persistent: false };
  }
}

// Average of the lesson's concept scores, 0–100, rounded.
export function lessonMastery(scoreById, lesson) {
  const scores = lesson.conceptIds.map(id => scoreById.get(id) || 0);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// First lesson that isn't completed, or null when the unit is done.
export function nextLesson(lessons, statusById) {
  return lessons.find(l => statusById.get(l.id) !== 'completed') || null;
}

// ===== Matching items =====
// state: { selected: { side, value } | null, pairs: [{ left, right }] }

export function shuffledRights(pairs, random = Math.random) {
  const rights = pairs.map(p => p.right);
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = rights.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [rights[i], rights[j]] = [rights[j], rights[i]];
    }
    // Avoid showing the answer key in order
    if (rights.length < 2 || rights.some((r, i) => r !== pairs[i].right)) break;
  }
  return rights;
}

export const emptyMatching = () => ({ selected: null, pairs: [] });

// Selecting a paired item unpairs it. Selecting one side then the other pairs
// them. Selecting the same side again moves (or clears) the selection.
export function selectMatching(state, side, value) {
  const existing = state.pairs.find(p => p[side] === value);
  if (existing) {
    return { selected: null, pairs: state.pairs.filter(p => p !== existing) };
  }
  const sel = state.selected;
  if (!sel || sel.side === side) {
    const same = sel && sel.value === value;
    return { ...state, selected: same ? null : { side, value } };
  }
  const pair = side === 'left' ? { left: value, right: sel.value } : { left: sel.value, right: value };
  return { selected: null, pairs: [...state.pairs, pair] };
}

// 1-based badge number for an item, or null if it isn't paired yet.
export function pairNumber(state, side, value) {
  const i = state.pairs.findIndex(p => p[side] === value);
  return i === -1 ? null : i + 1;
}

export function isMatchingComplete(state, item) {
  return state.pairs.length === item.pairs.length;
}
