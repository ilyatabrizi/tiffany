/* Small helpers.

   Numerals come from Intl in the page's own locale and never from a loop in
   here: fa-IR gives ۰–۹ and the ٬ separator (and IRANYekanXFaNum maps any Latin
   digit that slips through), en-GB and tr-TR give Latin digits with their own
   separators. Nothing below converts a digit by hand, and nothing should. */
import { L, locale, isFa, COMMA } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A Latin run inside Persian text needs its own direction or the bidi
    algorithm drags punctuation to the wrong end. Size codes, the wordmark,
    the collection names and the handle all go through here. */
export const ltr = (s) => `<span dir="ltr">${esc(s)}</span>`;

/* --------------------------------------------------------------- numbers */
const NF = new Intl.NumberFormat(locale);
export const num = (n) => NF.format(Math.round(n));

/** A number someone TYPED: a Persian or Arabic keyboard sends ۹۰ or ٩٠, which
    Number() cannot read. This is input, not display — display stays Intl's. */
const FA_D = '۰۱۲۳۴۵۶۷۸۹';
const AR_D = '٠١٢٣٤٥٦٧٨٩';
export const typed = (s) => String(s ?? '').replace(/[۰-۹٠-٩]/g,
  (d) => String(FA_D.includes(d) ? FA_D.indexOf(d) : AR_D.indexOf(d))).trim();
export const toman = (n) => `${NF.format(Math.round(n))} ${L('تومان', 'Toman', 'Toman')}`;

/* ----------------------------------------------------------------- dates */
const F = (opt) => new Intl.DateTimeFormat(locale, opt);
const fDay = F({ day: 'numeric', month: 'long' });
const fWeekday = F({ weekday: 'long' });
const fLong = F({ weekday: 'long', day: 'numeric', month: 'long' });
const fTime = F({ hour: '2-digit', minute: '2-digit', hour12: false });

export function atDay(offset, hour = 0, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}
/* Persian reads «دوشنبه ۲۰ مهر»; the other two let Intl order it. */
export const fullDate = (d) => (isFa ? `${fWeekday.format(d)} ${fDay.format(d)}` : fLong.format(d));
export const shortDate = (d) => fDay.format(d);
export const timeOf = (d) => fTime.format(d);

const startOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const daysFromNow = (d) =>
  Math.round((startOf(d) - startOf(new Date())) / 86400000);

/** «امروز» / «فردا» / «۴ روز دیگه» — the phrase somebody would actually say. */
export function relDay(d) {
  const n = daysFromNow(d);
  if (n === 0) return L('امروز', 'today', 'bugün');
  if (n === 1) return L('فردا', 'tomorrow', 'yarın');
  if (n === 2) return L('پس‌فردا', 'in 2 days', 'öbür gün');
  if (n === -1) return L('دیروز', 'yesterday', 'dün');
  if (n > 2 && n < 7) return L(`${num(n)} روز دیگه`, `in ${num(n)} days`, `${num(n)} gün sonra`);
  if (n < -1 && n > -7) return L(`${num(-n)} روز پیش`, `${num(-n)} days ago`, `${num(-n)} gün önce`);
  return shortDate(d);
}

export { COMMA };

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
