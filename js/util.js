/* Small helpers. English throughout — this brand sells in Iran but talks in
   English, so numbers are grouped the en-US way and prices carry the word
   Toman rather than a symbol nobody would recognise. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* --------------------------------------------------------------- numbers */
const NF = new Intl.NumberFormat('en-US');
export const num = (n) => NF.format(Math.round(n));
export const toman = (n) => `${NF.format(Math.round(n))} Toman`;

/* ----------------------------------------------------------------- dates */
const F = (opt) => new Intl.DateTimeFormat('en-GB', opt);
const fFull = F({ weekday: 'short', day: 'numeric', month: 'short' });
const fShort = F({ day: 'numeric', month: 'short' });
const fTime = F({ hour: '2-digit', minute: '2-digit', hour12: false });

export function atDay(offset, hour = 0, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}
export const fullDate = (d) => fFull.format(d);
export const shortDate = (d) => fShort.format(d);
export const timeOf = (d) => fTime.format(d);

const startOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const daysFromNow = (d) =>
  Math.round((startOf(d) - startOf(new Date())) / 86400000);

/** "Today" / "Tomorrow" / "in 4 days" — the phrase a person would use. */
export function relDay(d) {
  const n = daysFromNow(d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return `In ${n} days`;
  if (n < -1 && n > -7) return `${-n} days ago`;
  return shortDate(d);
}

/* ------------------------------------------------------------------ misc */
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Deterministic 32-bit hash — seeds order numbers and courier codes. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** TF-48210 — short enough to read out over the phone. */
export const orderCode = (seed) => 'TF-' + String(10000 + (hash(String(seed)) % 89999));

/** A light tap where the platform allows one. iOS ignores it; Android does not. */
export const tap = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* denied */ } };
