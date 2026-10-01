/* Small helpers.

   Persian numerals come from two places and never from a loop in here:
   Intl formats with fa-IR, and IRANYekanXFaNum maps any Latin digit that
   slips through to ۰–۹ by itself. Nothing below converts a digit by hand,
   and nothing should. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A Latin run inside Persian text needs its own direction or the bidi
    algorithm drags punctuation to the wrong end. Size codes, the wordmark,
    the collection names and the handle all go through here. */
export const ltr = (s) => `<span dir="ltr">${esc(s)}</span>`;

/* --------------------------------------------------------------- numbers */
const NF = new Intl.NumberFormat('fa-IR');
export const num = (n) => NF.format(Math.round(n));
export const toman = (n) => `${NF.format(Math.round(n))} تومان`;

/* ----------------------------------------------------------------- dates */
const F = (opt) => new Intl.DateTimeFormat('fa-IR', opt);
const fFull = F({ day: 'numeric', month: 'long' });
const fShort = F({ day: 'numeric', month: 'long' });
const fTime = F({ hour: '2-digit', minute: '2-digit', hour12: false });
const fWeekday = F({ weekday: 'long' });

export function atDay(offset, hour = 0, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}
export const fullDate = (d) => `${fWeekday.format(d)} ${fFull.format(d)}`;
export const shortDate = (d) => fShort.format(d);
export const timeOf = (d) => fTime.format(d);

const startOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const daysFromNow = (d) =>
  Math.round((startOf(d) - startOf(new Date())) / 86400000);

/** «امروز» / «فردا» / «۴ روز دیگه» — the phrase somebody would actually say. */
export function relDay(d) {
  const n = daysFromNow(d);
  if (n === 0) return 'امروز';
  if (n === 1) return 'فردا';
  if (n === 2) return 'پس‌فردا';
  if (n === -1) return 'دیروز';
  if (n > 2 && n < 7) return `${num(n)} روز دیگه`;
  if (n < -1 && n > -7) return `${num(-n)} روز پیش`;
  return shortDate(d);
}

/* ------------------------------------------------------------------ misc */
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Deterministic 32-bit hash — seeds order numbers. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** TF-48210 — short enough to read out over the phone, and stays Latin. */
export const orderCode = (seed) => 'TF-' + String(10000 + (hash(String(seed)) % 89999));

/** A light tap where the platform allows one. iOS ignores it; Android does not. */
export const tap = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* denied */ } };
