/* Boot, routing, the two glass bars, and one click delegate for the lot. */
import { L, dir } from './i18n.js';
import { BRAND } from './config.js';
import { icon } from './icons.js';
import { $, $$, num } from './util.js';
import {
  start, onRoute, go, back, parse, savedScroll, keepScroll as rememberAt,
} from './router.js';
import { flipWish, closeSheet, sheetIsOpen, toast } from './ui.js';
import {
  state, bagCount, isWished, save, LINE_MAX, ORDER_MAX,
} from './store.js';
import { getProduct, isOneSize } from './data.js';
import { promptInstall, shouldOfferInstall, installSheet } from './install.js';
import { needsConsent, askConsent } from './consent.js';
import { mountColour, applyColourPref } from './colour.js';
import { openLooks, closeLooks, isLooksOpen, looksItemTo, looksLinkTo } from './looks.js';
import { loadCatalogue, beacon, live } from './live.js';
import {
  account, loadAccount, refreshUnread, signInSheet, signUpSheet, accountSheet,
} from './account.js';

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
import tickets from './views/tickets.js';

const VIEWS = {
  '/': home, '/shop': shop, '/bag': bag, '/orders': orders, '/profile': profile,
  '/saved': saved, '/p': product, '/c': collection, '/tickets': tickets,
  '/about': about, '/contact': contact, '/terms': terms,
};

/* Each tab owns one of the five colours. It is the only colour in the chrome,
   and it only shows on the tab you are standing on. Tickets (2026-10-18) is
   the sixth tab and takes no colour of its own: it is the shop's ink.

   The labels are English in every language the shop speaks — the studio asked
   for it, and like the wordmark they read as names. Order still follows the
   page: Home sits at the start edge, right in Persian, left in the others. */
const TABS = [
  { id: 'home', to: '/', label: 'Home', ico: 'home', c: 'var(--c-blush)' },
  { id: 'shop', to: '/shop', label: 'Shop', ico: 'hanger', c: 'var(--c-sky)' },
  { id: 'bag', to: '/bag', label: 'Bag', ico: 'bag', c: 'var(--c-cherry)' },
  { id: 'orders', to: '/orders', label: 'Orders', ico: 'box', c: 'var(--c-rust)' },
  { id: 'tickets', to: '/tickets', label: 'Tickets', ico: 'ticket', c: 'var(--ink)' },
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
let current = null;   // eslint-disable-line no-unused-vars -- the view on screen

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
  const put = (tab, n) => {
    const dot = tabbar.querySelector(`[data-tab="${tab}"] .tab-dot`);
    if (!dot) return;
    dot.hidden = !n;
    dot.textContent = num(n);
  };
  put('bag', bagCount());
  put('tickets', account.user ? account.unread : 0);   // tickets with an answer not yet opened
}

/* ---------------------------------------------------------------- topbar */
function wireTopbar(view, parts, signal) {
  const meta = view.meta ? view.meta(parts) : {};
  const title = meta.title || view.title || BRAND.name;
  const at = (typeof view.topbarAt === 'function' ? view.topbarAt(parts) : view.topbarAt) ?? 60;
  const isHome = title === BRAND.name;

  topTitle.textContent = isHome ? BRAND.name : title;
  topTitle.classList.toggle('mark', isHome);
  /* The wordmark is Latin; everything else in the bar follows the page. */
  topTitle.setAttribute('dir', isHome ? 'ltr' : dir);
  topBack.hidden = !(typeof view.back === 'function' ? view.back(parts) : view.back);
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
let shownHash = '';
let shownPath = '';

function render(route, { keepScroll = false, how = 'push' } = {}) {
  /* Until 2026-10-20 the whole season was one collection, «aw27»; links to it
     shared since then open the shop, which is that whole season now. */
  if (route.path === '/c/aw27') { go('/shop', { replace: true }); return; }
  const key =['p', 'c', 'tickets'].includes(route.parts[0]) ? '/' + route.parts[0] : route.path;
  const view = VIEWS[key] || VIEWS['/'];
  const y = window.scrollY;
  /* Remember where the page being left was scrolled to, so a step back
     returns to the same spot in the grid rather than to the top. */
  if (!keepScroll) rememberAt(shownHash, y);
  const samePath = route.path === shownPath;
  current = key;
  shownHash = location.hash || '#/';
  shownPath = route.path;

  viewAbort?.abort();
  viewAbort = new AbortController();
  closeSheet();
  if (isLooksOpen()) closeLooks();

  app.innerHTML = view.render(route.parts, route.q);
  view.mount?.(app, viewAbort.signal, route.parts);
  mountColour(app, viewAbort.signal);

  wireTopbar(view, route.parts, viewAbort.signal);
  movePill(view.tab ?? '');
  badgeTabs();
  /* A product page floats its own buy bar in the tab bar's place — two glass
     bars stacked at the bottom of a phone is one too many. */
  tabbar.classList.toggle('hide', Boolean(typeof view.hideTabs === 'function' ? view.hideTabs(route.parts) : view.hideTabs));

  /* A refresh stays put; a step back returns to where that page was left; a
     new filter on the same page keeps the place; anything else starts at
     the top. */
  const back = how === 'back' ? savedScroll(shownHash) : undefined;
  window.scrollTo({
    top: keepScroll ? y : back !== undefined ? back : (samePath && how !== 'start' ? y : 0),
    behavior: 'auto',
  });

  /* The same titles the crawlable pages (seo.php) give, so a search engine
     that runs the page reads one title, not two. */
  const t = view.meta?.(route.parts)?.title || view.title || BRAND.name;
  document.title = t === BRAND.name
    ? L('TIFFANY by Vanda | تیفانی، پوشاک زنانه — کالکشن پاییز و زمستون ۲۰۲۷',
      'TIFFANY by Vanda | Womenswear — Autumn / Winter 2027', 'TIFFANY by Vanda | Kadın giyim — Sonbahar / Kış 2027')
    : `${t} | ${BRAND.full}`;
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
    case 'signin': signInSheet(); break;
    case 'signup': signUpSheet(); break;
    case 'account': accountSheet(); break;
    default: break;
  }
}, false);

/* A page opened at a crawlable address (/p/…, /c/…, /shop) carries
   <base href="/"> from seo.php, so a plain «#/terms» link there would load
   /#/terms as a new page. Inside the shop it is a step like any other. */
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (!document.querySelector('base')) return;
  const a = e.target.closest('a[href^="#/"]');
  if (!a || a.target) return;
  e.preventDefault();
  go(a.getAttribute('href').slice(1));
});

/* The look viewer's chips live outside #app, so they get their own hook. */
document.addEventListener('click', (e) => {
  const v = e.target.closest('[data-vitem]');
  if (v) looksItemTo(v.dataset.vitem);
  const k = e.target.closest('[data-vlink]');
  if (k && /^\/(p|c)\/[a-z0-9-]+$|^\/shop(\?.*)?$/.test(k.dataset.vlink)) looksLinkTo(k.dataset.vlink);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (isLooksOpen()) closeLooks();
  else if (sheetIsOpen()) closeSheet();
});

document.addEventListener('bag:changed', badgeTabs);
document.addEventListener('account:unread', badgeTabs);
/* Signing in or out redraws the profile (its header is the account); the
   tickets page redraws itself. Never on top of an open sheet: a redraw
   closes sheets, and the visitor may be in the middle of one. */
document.addEventListener('account:changed', () => {
  badgeTabs();
  if (parse().parts[0] === 'profile' && !sheetIsOpen()) refresh();
});
document.addEventListener('view:refresh', refresh);
document.addEventListener('colour:changed', refresh);

async function share() {
  /* A piece, a collection or the shop list is shared by its own address
     (seo.php), which shows its name, price and photo in a chat preview. */
  const r = parse();
  const url = /^\/(p|c)\/[a-z0-9-]+$|^\/shop$/.test(r.path) ? `${location.origin}${r.path}` : location.href;
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
/* The veil lifts once three things are true: the fonts are in (a font that
   never resolves gives up after 2.6s), the catalogue is in (its own 9s
   limit), and the opening has finished playing and then held, finished,
   for HOLD ms, so the wordmark and Alpha's line sit still a moment before
   the shop appears. The hold counts from the end of the animation, not from
   the load, so a slow catalogue does not stack a second wait on top. */
const HOLD = 1500;
const OPENING_MS = 1150;      // the wipe ends at 1.12s, Alpha's line at 1.15s
function liftVeil(ready, onGone) {
  const boot = $('#boot');
  if (!boot) { onGone(); return; }
  let lifted = false;
  const lift = () => {
    if (lifted) return;
    lifted = true;
    boot.classList.add('gone');
    setTimeout(() => { boot.remove(); onGone(); }, 560);
  };
  const fonts = document.fonts?.ready
    ? Promise.race([document.fonts.ready, new Promise((r) => { setTimeout(r, 2600); })])
    : Promise.resolve();
  /* The animations' own finish line; already-finished ones resolve at once.
     Without getAnimations, the opening's length from page start stands in. */
  const anims = boot.getAnimations ? boot.getAnimations({ subtree: true }) : null;
  const played = anims
    ? Promise.all(anims.map((a) => a.finished.catch(() => {})))
    : new Promise((r) => { setTimeout(r, Math.max(0, OPENING_MS - performance.now())); });
  const held = played.then(() => new Promise((r) => { setTimeout(r, HOLD); }));
  Promise.all([fonts.catch(() => {}), ready.catch(() => {}), held]).then(lift);
  setTimeout(lift, 12000);    // nothing may trap the shop behind the veil
}

/* ---------------------------------------------------- what the phone kept */
/* The bag and the saved list outlive a catalogue. Once a fresh one is in,
   lines whose piece, size or colour is gone are dropped, old-style lines
   (a translated size or colour name instead of its code) are rewritten to
   the codes the server expects, and doubles are merged. */
let tidied = 0;
function tidyStored() {
  const merged = new Map();
  for (const l of state.bag) {
    const p = l && getProduct(l.id);
    const size = p && (isOneSize(l.size) ? 'OS' : l.size);
    const c = p && p.colours.find((x) => x.hex === l.colour || x.all.includes(l.colour));
    if (!p || !p.sizes.includes(size) || !c) { tidied += 1; continue; }
    const key = `${p.id}|${size}|${c.hex}`;
    const qty = Math.min(LINE_MAX, (merged.get(key)?.qty || 0) + Math.max(1, Math.floor(Number(l.qty) || 1)));
    merged.set(key, { id: p.id, size, colour: c.hex, qty });
  }
  /* An old bag could hold more than one order may: keep the first twenty. */
  const bag = [];
  let total = 0;
  for (const l of merged.values()) {
    const qty = Math.min(l.qty, ORDER_MAX - total);
    if (qty < l.qty) tidied += 1;
    if (qty > 0) { bag.push({ ...l, qty }); total += qty; }
  }
  const wish = state.wish.filter((id) => getProduct(id));
  if (JSON.stringify(bag) !== JSON.stringify(state.bag) || wish.length !== state.wish.length) {
    state.bag = bag;
    state.wish = wish;
    save();
  }
}

/* ------------------------------------------------------------ the popups */
/* Once the veil is gone: the cookie question first (if this browser has not
   answered it), then the home-screen sheet on phones (js/install.js decides
   whether it is due). Never on top of something the visitor opened
   themselves — a sheet, the stories — and never while the tab is hidden. */
function popups() {
  if (tidied) {
    toast(L('چند قطعه که دیگه موجود نیستن از سبدت برداشته شدن.',
      'A few pieces that are no longer available were taken out of your bag.',
      'Artık mevcut olmayan birkaç parça sepetinden çıkarıldı.'), 'info', 3600);
    tidied = 0;
  }
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
  if (live.fresh) tidyStored();
  onRoute((r, how) => render(r, { how }));
  start();
  loadAccount();
});

/* A new answer from the team puts a dot on the Tickets tab, checked every
   two minutes while the shop is open and on screen. */
setInterval(() => { if (!document.hidden && account.user) refreshUnread(); }, 120000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && account.user) refreshUnread(); });

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
