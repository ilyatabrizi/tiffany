/* Boot, routing, the two glass bars, and one click delegate for the lot. */
import { BRAND } from './config.js';
import { icon } from './icons.js';
import { $, $$ } from './util.js';
import { start, onRoute, go, back, parse, recallScroll } from './router.js';
import { flipWish, closeSheet, sheetIsOpen, toast } from './ui.js';
import { state, bagCount, isWished } from './store.js';
import { promptInstall, standalone } from './install.js';
import { mountColour, applyColourPref } from './colour.js';
import { openLooks, closeLooks, isLooksOpen, looksItemTo } from './looks.js';

import home from './views/home.js';
import shop from './views/shop.js';
import collection from './views/collection.js';
import product, { addToBagFlow } from './views/product.js';
import bag from './views/bag.js';
import orders from './views/orders.js';
import saved from './views/saved.js';
import profile, { addressSheet, aboutSheet, resetSheet } from './views/profile.js';
import { fitSheet } from './views/profile.js';

const VIEWS = {
  '/': home, '/shop': shop, '/bag': bag, '/orders': orders, '/profile': profile,
  '/saved': saved, '/p': product, '/c': collection,
};

/* Each tab owns one of the five colours. It is the only colour in the chrome,
   and it only shows on the tab you are standing on. */
const TABS = [
  { id: 'home', to: '/', label: 'Home', ico: 'home', c: 'var(--c-blush)' },
  { id: 'shop', to: '/shop', label: 'Shop', ico: 'hanger', c: 'var(--c-sky)' },
  { id: 'bag', to: '/bag', label: 'Bag', ico: 'bag', c: 'var(--c-cherry)' },
  { id: 'orders', to: '/orders', label: 'Orders', ico: 'box', c: 'var(--c-rust)' },
  { id: 'profile', to: '/profile', label: 'Profile', ico: 'user', c: 'var(--c-lilac)' },
];

const app = $('#app');
const topbar = $('#topbar');
const topTitle = $('#topbarTitle');
const topBack = $('#topbarBack');
const topAct = $('#topbarAct');
const tabbar = $('#tabbar');
const pill = $('#tabPill');

/* Views bind listeners to #app and to window; #app survives every render, so
   without this every navigation would leave another live handler behind. One
   controller per render, aborted before the next. */
let viewAbort = null;
let current = null;

/* ------------------------------------------------------------------ tabs */
function buildTabs() {
  TABS.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.type = 'button';
    b.dataset.tab = t.id;
    b.dataset.act = 'nav';
    b.dataset.to = t.to;
    b.style.setProperty('--tab-c', t.c);
    b.innerHTML = `${icon(t.ico, 22)}<span class="tab-label">${t.label}</span>
      <span class="tab-dot" hidden></span>`;
    tabbar.appendChild(b);
  });
}

/* A detail view belongs to whichever tab you reached it from — the pill stays
   put rather than blinking out and leaving five grey icons. */
let lastTab = 'home';
let pillPlaced = false;

function movePill(id) {
  if (id) lastTab = id;
  const key = id || lastTab;
  const btn = tabbar.querySelector(`[data-tab="${key}"]`);
  if (!btn) { pill.style.opacity = '0'; return; }

  const tab = TABS.find((t) => t.id === key);
  if (tab) document.documentElement.style.setProperty('--accent', tab.c);

  /* The first placement must not animate: the pill starts at width 0 on the
     left and would sweep the whole bar while the app is still opening. */
  if (!pillPlaced) pill.style.transition = 'none';
  pill.style.opacity = '1';
  pill.style.width = btn.offsetWidth + 'px';
  pill.style.transform = `translateX(${btn.offsetLeft - pill.offsetLeft}px)`;
  if (!pillPlaced) {
    void pill.offsetWidth;
    pill.style.transition = '';
    pillPlaced = true;
  }
  $$('.tab', tabbar).forEach((b) => b.classList.toggle('on', b === btn));
}

function badgeTabs() {
  const n = bagCount();
  const dot = tabbar.querySelector('[data-tab="bag"] .tab-dot');
  if (!dot) return;
  dot.hidden = !n;
  dot.textContent = String(n);
}

/* ---------------------------------------------------------------- topbar */
function wireTopbar(view, parts, signal) {
  const meta = view.meta ? view.meta(parts) : {};
  const title = meta.title || view.title || BRAND.name;
  const at = view.topbarAt ?? 60;
  const isHome = title === BRAND.name;

  topTitle.textContent = isHome ? BRAND.name : title;
  topTitle.classList.toggle('mark', isHome);
  topBack.hidden = !view.back;
  topAct.hidden = !meta.wishId;
  if (meta.wishId) {
    topAct.dataset.act = 'wish-top';
    topAct.dataset.id = meta.wishId;
    topAct.innerHTML = icon('heart', 19);
    topAct.setAttribute('aria-pressed', String(isWished(meta.wishId)));
    topAct.setAttribute('aria-label', 'Save this piece');
    topAct.classList.toggle('on', isWished(meta.wishId));
  }

  const onScroll = () => topbar.classList.toggle('show', window.scrollY > at);
  addEventListener('scroll', onScroll, { passive: true, signal });
  onScroll();
}

/* ---------------------------------------------------------------- render */
function render(route, { keepScroll = false } = {}) {
  const key = ['p', 'c'].includes(route.parts[0]) ? '/' + route.parts[0] : route.path;
  const view = VIEWS[key] || VIEWS['/'];
  const same = current === key;
  const y = window.scrollY;
  current = key;

  viewAbort?.abort();
  viewAbort = new AbortController();
  closeSheet();

  app.innerHTML = view.render(route.parts, route.q);
  view.mount?.(app, viewAbort.signal);
  mountColour(app, viewAbort.signal);

  wireTopbar(view, route.parts, viewAbort.signal);
  movePill(view.tab ?? '');
  badgeTabs();
  /* A product page floats its own buy bar in the tab bar's place — two glass
     bars stacked at the bottom of a phone is one too many. */
  tabbar.classList.toggle('hide', Boolean(view.hideTabs));

  const memKey = route.path + location.search;
  window.scrollTo({
    top: keepScroll ? y : (same ? recallScroll(memKey) : 0),
    behavior: 'auto',
  });

  const t = view.meta?.(route.parts)?.title || view.title || BRAND.name;
  document.title = t === BRAND.name
    ? `${BRAND.name} ${BRAND.sub} — ${BRAND.tagline}`
    : `${t} — ${BRAND.name}`;
}

const refresh = () => render(parse(), { keepScroll: true });

/* -------------------------------------------------------------- delegate */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;

  switch (act) {
    case 'nav': e.preventDefault(); go(t.dataset.to); break;
    case 'product': e.preventDefault(); go('/p/' + t.dataset.id); break;
    case 'collection': e.preventDefault(); go('/c/' + t.dataset.id); break;
    case 'wish':
    case 'wish-top': e.preventDefault(); e.stopPropagation(); flipWish(t.dataset.id); break;
    case 'back': e.preventDefault(); back(); break;
    case 'sheet-close': closeSheet(); break;
    case 'add': addToBagFlow(t.dataset.id); break;
    case 'look': openLooks(Number(t.dataset.i) || 0); break;
    case 'viewer-close': closeLooks(); break;
    case 'install': promptInstall(); break;
    case 'fit': closeSheet(); setTimeout(fitSheet, 220); break;
    case 'address': addressSheet(); break;
    case 'about': aboutSheet(); break;
    case 'reset': resetSheet(); break;
    case 'share': share(); break;
    default: break;
  }
}, false);

/* The look viewer's chips live outside #app, so they get their own hook. */
document.addEventListener('click', (e) => {
  const v = e.target.closest('[data-vitem]');
  if (v) looksItemTo(v.dataset.vitem);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (isLooksOpen()) closeLooks();
  else if (sheetIsOpen()) closeSheet();
});

document.addEventListener('bag:changed', badgeTabs);
document.addEventListener('view:refresh', refresh);
document.addEventListener('colour:changed', refresh);

async function share() {
  const url = location.href;
  try {
    if (navigator.share) { await navigator.share({ title: BRAND.full, url }); return; }
    await navigator.clipboard.writeText(url);
    toast('Link copied', 'check');
  } catch { /* the user dismissed it */ }
}

/* ------------------------------------------------------------ appearance */
function applyTheme() {
  document.documentElement.dataset.theme = state.prefs.theme || 'auto';
}

/* -------------------------------------------------------------- the boot */
function liftVeil() {
  const boot = $('#boot');
  if (!boot) return;
  let lifted = false;
  const lift = () => (lifted ? null : (lifted = true, setTimeout(() => {
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 560);
  }, standalone() ? 780 : 620)));
  if (document.fonts?.ready) document.fonts.ready.then(lift).catch(lift); else lift();
  setTimeout(lift, 2600);   // a font that never resolves must not trap the app
}

addEventListener('resize', () => {
  const on = tabbar.querySelector('.tab.on');
  if (on) movePill(on.dataset.tab);
});

applyTheme();
applyColourPref();
buildTabs();
liftVeil();
onRoute((r) => render(r));
start();

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
