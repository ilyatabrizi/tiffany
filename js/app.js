/* Boot, routing, the two glass bars, and one click delegate for the lot. */
import { L, dir } from './i18n.js';
import { BRAND } from './config.js';
import { icon } from './icons.js';
import { $, $$, num } from './util.js';
import { start, onRoute, go, back, parse, recallScroll } from './router.js';
import { flipWish, closeSheet, sheetIsOpen, toast } from './ui.js';
import { state, bagCount, isWished } from './store.js';
import { promptInstall, standalone, shouldOfferInstall, installSheet } from './install.js';
import { needsConsent, askConsent } from './consent.js';
import { mountColour, applyColourPref } from './colour.js';
import { openLooks, closeLooks, isLooksOpen, looksItemTo } from './looks.js';
import { loadCatalogue, beacon } from './live.js';

import home from './views/home.js';
import shop from './views/shop.js';
import collection from './views/collection.js';
import product, { addToBagFlow } from './views/product.js';
import bag from './views/bag.js';
import orders from './views/orders.js';
import saved from './views/saved.js';
import profile, { addressSheet, resetSheet } from './views/profile.js';
import { about, contact, terms } from './views/info.js';
import { fitSheet } from './views/profile.js';

const VIEWS = {
  '/': home, '/shop': shop, '/bag': bag, '/orders': orders, '/profile': profile,
  '/saved': saved, '/p': product, '/c': collection,
  '/about': about, '/contact': contact, '/terms': terms,
};

/* Each tab owns one of the five colours. It is the only colour in the chrome,
   and it only shows on the tab you are standing on.

   The labels are English in every language the shop speaks — the studio asked
   for it, and like the wordmark they read as names. Order still follows the
   page: Home sits at the start edge, right in Persian, left in the others. */
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
    b.innerHTML = `${icon(t.ico, 22)}<span class="tab-label" lang="en">${t.label}</span>
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
  dot.textContent = num(n);
}

/* ---------------------------------------------------------------- topbar */
function wireTopbar(view, parts, signal) {
  const meta = view.meta ? view.meta(parts) : {};
  const title = meta.title || view.title || BRAND.name;
  const at = view.topbarAt ?? 60;
  const isHome = title === BRAND.name;

  topTitle.textContent = isHome ? BRAND.name : title;
  topTitle.classList.toggle('mark', isHome);
  /* The wordmark is Latin; everything else in the bar follows the page. */
  topTitle.setAttribute('dir', isHome ? 'ltr' : dir);
  topBack.hidden = !view.back;
  topAct.hidden = !meta.wishId;
  if (meta.wishId) {
    topAct.dataset.act = 'wish-top';
    topAct.dataset.id = meta.wishId;
    topAct.innerHTML = icon('heart', 19);
    topAct.setAttribute('aria-pressed', String(isWished(meta.wishId)));
    topAct.setAttribute('aria-label', L('ذخیره کردن این قطعه', 'Save this piece', 'Bu parçayı kaydet'));
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
  document.title = t === BRAND.name ? `${BRAND.name} ${BRAND.sub}` : `${t} — ${BRAND.name}`;
  if (!keepScroll) beacon(route);
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
    case 'consent': askConsent({ settings: true }); break;
    case 'fit': closeSheet(); setTimeout(fitSheet, 220); break;
    case 'address': addressSheet(); break;
    case 'about': go('/about'); break;
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
    toast(L('لینک کپی شد', 'Link copied', 'Bağlantı kopyalandı'), 'check');
  } catch { /* the user dismissed it */ }
}

/* ------------------------------------------------------------ appearance */
function applyTheme() {
  document.documentElement.dataset.theme = state.prefs.theme || 'auto';
}

/* -------------------------------------------------------------- the boot */
/* The veil lifts once the fonts AND the catalogue are in (a font that never
   resolves gives up after 2.6s; the catalogue has its own 9s limit), then
   holds long enough to read Alpha's line. */
function liftVeil(ready, onGone) {
  const boot = $('#boot');
  if (!boot) { onGone(); return; }
  let lifted = false;
  const lift = () => (lifted ? null : (lifted = true, setTimeout(() => {
    boot.classList.add('gone');
    setTimeout(() => { boot.remove(); onGone(); }, 560);
  }, standalone() ? 1150 : 1000)));
  const fonts = document.fonts?.ready
    ? Promise.race([document.fonts.ready, new Promise((r) => { setTimeout(r, 2600); })])
    : Promise.resolve();
  Promise.all([fonts.catch(() => {}), ready.catch(() => {})]).then(lift);
  setTimeout(lift, 12000);    // nothing may trap the shop behind the veil
}

/* ------------------------------------------------------------ the popups */
/* Once the veil is gone: the cookie question first (if this browser has not
   answered it), then the home-screen sheet on phones (js/install.js decides
   whether it is due). Never on top of something the visitor opened
   themselves — a sheet, the stories — and never while the tab is hidden. */
function popups() {
  let tries = 0;
  const when = (fn, ms) => setTimeout(function wait() {
    if (document.hidden || sheetIsOpen() || isLooksOpen()) {
      if (++tries < 12) setTimeout(wait, 2500);
      return;
    }
    fn();
  }, ms);
  const install = () => { if (shouldOfferInstall()) when(() => installSheet({ auto: true }), 900); };
  if (needsConsent()) when(() => askConsent({ then: install }), 600);
  else install();
}

addEventListener('resize', () => {
  const on = tabbar.querySelector('.tab.on');
  if (on) movePill(on.dataset.tab);
});

/* The shell's own labels are written in Persian in index.html; the other two
   languages swap them here, before anything can read them. */
function labelShell() {
  topBack.setAttribute('aria-label', L('برگشت', 'Back', 'Geri'));
  tabbar.setAttribute('aria-label', L('منوی اصلی', 'Main navigation', 'Ana menü'));
  $('#viewer')?.setAttribute('aria-label', L('استوری‌ها', 'Stories', 'Hikâyeler'));
}

applyTheme();
applyColourPref();
labelShell();
buildTabs();
const catalogue = loadCatalogue();
liftVeil(catalogue, popups);
catalogue.finally(() => {
  onRoute((r) => render(r));
  start();
});

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
