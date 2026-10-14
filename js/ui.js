/* The shared pieces: image helpers, the three card shapes, the size engine,
   sheets, toasts. Views compose these and never build the same DOM twice. */
import { SIZES, colById, getProduct, NO_COL, soldOut } from './data.js';
import { icon } from './icons.js';
import { $, esc, toman, clamp } from './util.js';
import { isWished, toggleWish, state } from './store.js';
import { L } from './i18n.js';

/* ---------------------------------------------------------------- images */
/* A bare name is one of the shop's own frames (assets/img); a path is a
   photo uploaded from the back office (uploads/p/…), made at 480 and 960. */
const base = (name) => (name.includes('/') ? name : `assets/img/${name}`);
/** One file of a frame: imgSrc('p-rib-tee', 480) or imgSrc('uploads/p/…', 480). */
export const imgSrc = (name, w) => `${base(name)}-${w}.webp`;
export const shot = (name, sizes, widths = [480, 960]) =>
  `srcset="${widths.map((w) => `${base(name)}-${w}.webp ${w}w`).join(', ')}"
   src="${base(name)}-${widths[0]}.webp" sizes="${sizes}"`;

export const bigShot = (name, sizes) => shot(name, sizes, [720, 1080]);

/* ----------------------------------------------------------------- cards */
/* The wish button is a sibling of the card button, never a child: nested
   interactive elements are invalid markup and unreachable by keyboard. */
export function productCard(p, { sizes = '(max-width:620px) 44vw, 230px' } = {}) {
  const wished = isWished(p.id);
  const col = colById[p.col] || NO_COL;
  const out = soldOut(p);
  const badge = out ? L('تموم شد', 'Sold out', 'Tükendi') : p.badge;
  return `
  <div class="card ${out ? 'is-out' : ''}" style="--dot:${col.accent};--accent:${col.accent}">
    <button class="card-open" data-act="product" data-id="${p.id}" type="button">
      <span class="shot">
        <img ${shot(p.img, sizes)} alt="${esc(p.name)}" loading="lazy" decoding="async"
             width="480" height="600">
        ${badge ? `<span class="card-badge">${esc(badge)}</span>` : ''}
      </span>
      <span class="card-body">
        <span class="card-name">${esc(p.name)}</span>
        <span class="card-meta">
          ${col.id ? `<span class="card-dot" title="${esc(col.name)}"></span>` : ''}
          <span class="card-price">${toman(p.price)}</span>
        </span>
      </span>
    </button>
    <button class="card-wish ${wished ? 'on' : ''}" data-act="wish" data-id="${p.id}"
            type="button" aria-pressed="${wished}"
            aria-label="${esc(L(`ذخیره کردن ${p.name}`, `Save ${p.name}`, `${p.name} kaydet`))}">${icon('heart', 17)}</button>
  </div>`;
}

export function collectionCard(c, sizes = '(max-width:520px) 76vw, 320px') {
  return `
  <button class="ccard" data-act="collection" data-id="${c.id}" type="button"
          style="--dot:${c.accent};--accent:${c.accent}">
    <span class="shot">
      <img ${shot(c.img, sizes)} alt="${esc(c.name)}" loading="lazy" decoding="async"
           width="480" height="640">
    </span>
    <span class="ccard-body">
      <span class="ccard-name">${esc(c.name)}</span>
      <span class="ccard-sub"><i class="ccard-swatch"></i>${esc(c.season)}</span>
    </span>
  </button>`;
}

export function lookTile(l, i) {
  return `
  <button class="look-tile" data-act="look" data-i="${i}" type="button">
    <figure style="margin:0">
      <span class="shot full-colour">
        <img ${bigShot(l.img, '118px')} alt="${esc(l.title)}" loading="lazy"
             decoding="async" width="720" height="1280">
      </span>
      <figcaption>${esc(l.title)}</figcaption>
    </figure>
  </button>`;
}

/* ------------------------------------------------------------ size engine */
/** Score every size against the measurements on file and name the closest.
    Cut is folded in at the end: a piece the studio cuts small gets nudged up,
    a relaxed one gets nudged down, which is what a shop assistant would say. */
export function recommendSize(product) {
  const f = state.fit;
  const have = ['bust', 'waist', 'hip'].filter((k) => Number(f[k]) > 0);
  /* Only letter sizes have a body chart; a piece may offer just some of them. */
  const offered = SIZES.map((s, i) => (product.sizes.includes(s.id) ? i : -1)).filter((i) => i >= 0);
  if (!offered.length || have.length === 0) return null;

  let best = null;
  SIZES.forEach((s, idx) => {
    let score = 0;
    have.forEach((k) => {
      const [lo, hi] = s[k];
      const v = Number(f[k]);
      score += v < lo ? lo - v : v > hi ? v - hi : 0;
    });
    if (!best || score < best.score) best = { idx, score, id: s.id };
  });

  let idx = best.idx;
  if (product.fit === 'small') idx = clamp(idx + 1, 0, SIZES.length - 1);
  if (product.fit === 'relaxed' && best.score === 0) idx = clamp(idx - 0, 0, SIZES.length - 1);
  /* The nearest size this piece is actually made in; between two, the larger. */
  idx = offered.reduce((a, b) => (Math.abs(b - idx) < Math.abs(a - idx)
    || (Math.abs(b - idx) === Math.abs(a - idx) && b > a) ? b : a));

  const why = product.fit === 'small'
    ? L('این یکی تنگ دوخته شده؛ واسه همین یه سایز بزرگ‌تر برات زدیم.',
      'This one is cut close — we have sized you up.',
      'Bu parça dar kesim; o yüzden bir beden büyüğünü önerdik.')
    : product.fit === 'relaxed'
      ? L('گشاد دوخته شده. اگه چسبون‌تر می‌خوای، یه سایز کوچیک‌تر بگیر.',
        'Cut relaxed. Size down if you want it closer to the body.',
        'Bol kesim. Daha vücuda oturan istersen bir beden küçük al.')
      : L('بر اساس اندازه‌هایی که توی پروفایلت ذخیره کردی.',
        'Based on the measurements saved in your profile.',
        'Profilinde kayıtlı ölçülere göre.');
  return { size: SIZES[idx].id, why };
}

export const fitSaved = () =>
  ['bust', 'waist', 'hip'].some((k) => Number(state.fit[k]) > 0);

/* ------------------------------------------------------------- wishlist */
export function flipWish(id) {
  const now = toggleWish(id);
  document.querySelectorAll(
    `[data-act="wish"][data-id="${id}"], [data-act="wish-top"][data-id="${id}"]`
  ).forEach((el) => {
    el.classList.toggle('on', now);
    if (el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', String(now));
  });
  const p = getProduct(id);
  const name = p ? p.name : L('این قطعه', 'piece', 'bu parça');
  toast(now
    ? L(`ذخیره شد — ${name}`, `Saved — ${name}`, `Kaydedildi — ${name}`)
    : L('از ذخیره‌ها درش آوردیم', 'Removed from saved', 'Kaydedilenlerden çıkarıldı'), 'heart');
  return now;
}

/* --------------------------------------------------------------- toasts */
export function toast(msg, ico = 'check', ms = 2300) {
  const dock = $('#toastDock');
  if (!dock) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(ico, 16)}<span>${esc(msg)}</span>`;
  dock.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, ms);
}

/* --------------------------------------------------------------- sheets */
/* onClose runs once, however the sheet goes: a button, the veil, a drag,
   Escape, a route change, or another sheet taking its place. */
let sheetClosed = null;
const runClosed = () => { const f = sheetClosed; sheetClosed = null; f?.(); };

export function openSheet(html, { onMount, onClose, label = '', cls = '', calm = false } = {}) {
  runClosed();
  sheetClosed = onClose || null;
  const root = $('#sheetRoot');
  root.innerHTML = `<div class="sheet-veil" data-act="sheet-close"></div>
    <div class="sheet ${cls}" role="dialog" aria-modal="true"
         ${label ? `aria-label="${esc(label)}"` : ''}>
      <div class="sheet-grip"></div>${html}</div>`;
  document.body.classList.add('locked');
  /* Not requestAnimationFrame: a backgrounded tab freezes rAF and the callback
     can land after a close, pinning the sheet open. Reading a layout property
     flushes the start transform synchronously instead. */
  void root.offsetHeight;
  root.classList.add('open');
  const sheet = root.querySelector('.sheet');
  dragToDismiss(sheet);
  onMount?.(sheet);
  /* A sheet the shop opens by itself (calm) takes focus as a whole, so no
     button sits there pre-ringed before anyone has touched anything. */
  if (calm) { sheet.tabIndex = -1; sheet.focus({ preventScroll: true }); } else {
    sheet.querySelector('input,textarea,select,button:not([data-act="sheet-close"])')
      ?.focus({ preventScroll: true });
  }
  return sheet;
}

/** Pull the sheet down past a third of its height and it goes. */
function dragToDismiss(sheet) {
  let y0 = null; let dy = 0;
  const start = (e) => {
    if (sheet.scrollTop > 0) return;
    y0 = e.touches ? e.touches[0].clientY : e.clientY;
    dy = 0;
    sheet.style.transition = 'none';
  };
  const move = (e) => {
    if (y0 === null) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dy = Math.max(0, y - y0);
    sheet.style.transform = `translate(-50%, ${dy}px)`;
  };
  const end = () => {
    if (y0 === null) return;
    y0 = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > Math.min(150, sheet.offsetHeight * 0.3)) closeSheet();
  };
  sheet.addEventListener('touchstart', start, { passive: true });
  sheet.addEventListener('touchmove', move, { passive: true });
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
}

export function closeSheet() {
  const root = $('#sheetRoot');
  if (!root || !root.classList.contains('open')) return;
  root.classList.remove('open');
  document.body.classList.remove('locked');
  runClosed();
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 480);
}
export const sheetIsOpen = () => $('#sheetRoot')?.classList.contains('open');

/* ------------------------------------------------------------ fragments */
export const empty = (ico, title, body, cta = '') => `
  <div class="empty">
    <div class="ring">${icon(ico, 24)}</div>
    <h3 class="serif">${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}${cta}
  </div>`;

export const secHead = (title, more = '') => `
  <div class="sec-head">
    <h2 class="serif">${esc(title)}</h2>
    ${more}
  </div>`;

/* The agency signature. Its own block, not a few words tacked onto the
   copyright — the lockup already reads "alpha", so the words beside it carry
   the rest of the phrase rather than saying the name twice.

   Always English and always left-to-right, in every language the shop
   speaks: it is Alpha's lockup, not a line of the shop's copy. */
export const alphaSig = () => `
  <a class="alphasig" href="https://alphaa.agency" target="_blank" rel="noopener"
     dir="ltr" lang="en" aria-label="Powered by Alpha Agency">
    <span class="alphasig__mark" aria-hidden="true"></span>
    <span class="alphasig__txt">
      <span class="alphasig__by">Powered by</span>
      <span class="alphasig__name">Alpha Agency</span>
    </span>
  </a>`;

export const moreLink = (to, label = L('همه', 'See all', 'Tümü')) =>
  `<button class="link-more" data-act="nav" data-to="${to}" type="button">
     ${esc(label)}${icon('arrow', 14)}</button>`;
