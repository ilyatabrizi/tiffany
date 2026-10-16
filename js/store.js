/* Everything the visitor does lives in one localStorage blob. No account, no
   server — this is a preview, and a phone that clears its storage starts
   fresh. */
import { STORE_KEY } from './config.js';

const EMPTY = {
  bag: [],            // { id, size, colour, qty }
  wish: [],           // product ids
  orders: [],         // { code, placed, items, total, address, status }
  profile: { name: '', phone: '', email: '' },
  fit: { bust: '', waist: '', hip: '', height: '' },
  address: { line: '', city: '', postal: '' },
  prefs: { colour: 'touch', theme: 'auto' },
  seen: { looks: false },
};

function read() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(EMPTY);
    const saved = JSON.parse(raw);
    const base = structuredClone(EMPTY);
    return {
      ...base, ...saved,
      profile: { ...base.profile, ...(saved.profile || {}) },
      fit: { ...base.fit, ...(saved.fit || {}) },
      address: { ...base.address, ...(saved.address || {}) },
      prefs: { ...base.prefs, ...(saved.prefs || {}) },
      seen: { ...base.seen, ...(saved.seen || {}) },
    };
  } catch { return structuredClone(EMPTY); }
}

export const state = read();

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn(state));
}

/* ------------------------------------------------------------------ bag */
/* The same limits the server holds an order to (api/order.php): five of one
   piece in one size and colour, twenty pieces in one order. */
export const LINE_MAX = 5;
export const ORDER_MAX = 20;
const lineKey = (id, size, colour) => `${id}|${size}|${colour}`;
export const bagCount = () => state.bag.reduce((n, l) => n + l.qty, 0);

/** Adds one; false when the line or the bag is already full. */
export function addToBag(id, size, colour, qty = 1) {
  if (bagCount() + qty > ORDER_MAX) return false;
  const key = lineKey(id, size, colour);
  const line = state.bag.find((l) => lineKey(l.id, l.size, l.colour) === key);
  if (line && line.qty + qty > LINE_MAX) return false;
  if (line) line.qty += qty;
  else state.bag.unshift({ id, size, colour, qty });
  save();
  return true;
}
export function setQty(id, size, colour, qty) {
  const key = lineKey(id, size, colour);
  const i = state.bag.findIndex((l) => lineKey(l.id, l.size, l.colour) === key);
  if (i < 0) return false;
  if (qty <= 0) { state.bag.splice(i, 1); save(); return true; }
  const others = bagCount() - state.bag[i].qty;
  const want = Math.min(LINE_MAX, qty, ORDER_MAX - others);
  if (want === state.bag[i].qty) return false;
  state.bag[i].qty = want;
  save();
  return true;
}
export const clearBag = () => { state.bag = []; save(); };

/* -------------------------------------------------------------- wishlist */
export const isWished = (id) => state.wish.includes(id);
export function toggleWish(id) {
  const i = state.wish.indexOf(id);
  if (i < 0) state.wish.unshift(id); else state.wish.splice(i, 1);
  save();
  return i < 0;
}

/* --------------------------------------------------------------- orders */
export function addOrder(order) {
  state.orders.unshift(order);
  save();
  return order;
}
export const getOrder = (code) => state.orders.find((o) => o.code === code) || null;

/* -------------------------------------------------------------- profile */
export function patch(slice, values) {
  Object.assign(state[slice], values);
  save();
}
