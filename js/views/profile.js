/* Profile — who you are, what you saved, and the two switches that decide how
   the whole shop looks. */
import { BRAND } from '../config.js';
import { SIZES } from '../data.js';
import { icon } from '../icons.js';
import { esc, num } from '../util.js';
import { state, patch, bagCount } from '../store.js';
import {
  openSheet, closeSheet, toast, recommendSize, fitSaved, alphaSig,
} from '../ui.js';
import { applyColourPref } from '../colour.js';
import { promptInstall, standalone } from '../install.js';

const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'T';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

/* --------------------------------------------------------------- the fit */
export function fitSheet() {
  const f = state.fit;
  openSheet(`
    <h2>Your fit</h2>
    <p class="lede">Three measurements, kept on this phone only. Every product
      page then names the size we would hand you in the studio.</p>
    <form id="fitForm" novalidate>
      <div class="field-row">
        <div class="field"><label for="fBust">Bust (cm)</label>
          <input id="fBust" name="bust" inputmode="numeric" value="${esc(f.bust)}"></div>
        <div class="field"><label for="fWaist">Waist (cm)</label>
          <input id="fWaist" name="waist" inputmode="numeric" value="${esc(f.waist)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="fHip">Hip (cm)</label>
          <input id="fHip" name="hip" inputmode="numeric" value="${esc(f.hip)}"></div>
        <div class="field"><label for="fHeight">Height (cm)</label>
          <input id="fHeight" name="height" inputmode="numeric" value="${esc(f.height)}"></div>
      </div>
      <p class="tiny" id="fitOut" style="min-height:20px"></p>
      <div style="height:12px"></div>
      <button class="btn btn-ink btn-block" type="submit">Save my fit</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">Cancel</button>
    </form>`,
  {
    label: 'Your fit',
    onMount(sheet) {
      const out = sheet.querySelector('#fitOut');
      const preview = () => {
        const v = {};
        ['bust', 'waist', 'hip'].forEach((k) => {
          v[k] = sheet.querySelector(`#f${k[0].toUpperCase()}${k.slice(1)}`).value;
        });
        const before = { ...state.fit };
        Object.assign(state.fit, v);
        const rec = recommendSize({ sizes: SIZES.map((s) => s.id), fit: 'true' });
        Object.assign(state.fit, before);
        out.textContent = rec ? `Looks like a ${rec.size} in our ready-to-wear.` : '';
      };
      sheet.querySelectorAll('input').forEach((i) =>
        i.addEventListener('input', preview));
      preview();

      sheet.querySelector('#fitForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        patch('fit', {
          bust: String(d.get('bust') || '').trim(),
          waist: String(d.get('waist') || '').trim(),
          hip: String(d.get('hip') || '').trim(),
          height: String(d.get('height') || '').trim(),
        });
        closeSheet();
        toast('Fit saved', 'ruler');
        document.dispatchEvent(new CustomEvent('view:refresh'));
      });
    },
  });
}

/* ------------------------------------------------------------- addresses */
function addressSheet() {
  const a = state.address;
  const p = state.profile;
  openSheet(`
    <h2>Delivery details</h2>
    <p class="lede">Filled in for you at checkout. Stored on this phone, nowhere else.</p>
    <form id="adForm" novalidate>
      <div class="field"><label for="aName">Full name</label>
        <input id="aName" name="name" autocomplete="name" value="${esc(p.name)}"></div>
      <div class="field"><label for="aPhone">Phone</label>
        <input id="aPhone" name="phone" inputmode="tel" autocomplete="tel"
               value="${esc(p.phone)}" placeholder="09xx xxx xxxx"></div>
      <div class="field"><label for="aLine">Address</label>
        <textarea id="aLine" name="line" autocomplete="street-address">${esc(a.line)}</textarea></div>
      <div class="field-row">
        <div class="field"><label for="aCity">City</label>
          <input id="aCity" name="city" autocomplete="address-level2" value="${esc(a.city)}"></div>
        <div class="field"><label for="aPostal">Post code</label>
          <input id="aPostal" name="postal" inputmode="numeric" value="${esc(a.postal)}"></div>
      </div>
      <div style="height:12px"></div>
      <button class="btn btn-ink btn-block" type="submit">Save</button>
    </form>`,
  {
    label: 'Delivery details',
    onMount(sheet) {
      sheet.querySelector('#adForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const g = (k) => String(d.get(k) || '').trim();
        patch('profile', { name: g('name'), phone: g('phone') });
        patch('address', { line: g('line'), city: g('city'), postal: g('postal') });
        closeSheet();
        toast('Details saved', 'check');
        document.dispatchEvent(new CustomEvent('view:refresh'));
      });
    },
  });
}

/* ----------------------------------------------------------------- about */
const aboutSheet = () => openSheet(`
  <h2>${BRAND.full}</h2>
  <p class="lede">${BRAND.tagline} Three collections a year, cut in small runs,
    sold through the studio and through Instagram.</p>
  <div style="height:14px"></div>
  <a class="row" href="${BRAND.instagramUrl}" target="_blank" rel="noopener">
    ${icon('instagram', 19)}<span class="row-label">@${BRAND.instagram}</span>
    ${icon('arrow', 16, 'chev')}</a>
  <div class="notice">This is a preview build made by Alpha Agency. The
    photography is the studio’s own; every price, product name, fabric,
    measurement and delivery promise is placeholder copy and none of it is
    live. Nothing typed here leaves the phone.</div>
  <div style="height:18px"></div>
  <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">Close</button>`,
{ label: 'About' });

function resetSheet() {
  openSheet(`
    <h2>Clear everything</h2>
    <p class="lede">Bag, saved pieces, orders and your fit are removed from this
      phone. There is no undo.</p>
    <button class="btn btn-ink btn-block" id="yes" type="button">Yes, clear it</button>
    <div style="height:9px"></div>
    <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">Keep it</button>`,
  {
    label: 'Clear data',
    onMount(sheet) {
      sheet.querySelector('#yes').addEventListener('click', () => {
        try { localStorage.removeItem('tiffany.v1'); } catch { /* private mode */ }
        location.reload();
      });
    },
  });
}

/* ------------------------------------------------------------------ view */
const COLOUR_MODES = [
  { id: 'touch', name: 'On touch' },
  { id: 'always', name: 'Always' },
  { id: 'never', name: 'Never' },
];
const THEMES = [
  { id: 'auto', name: 'Auto' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

export default {
  tab: 'profile',
  title: 'Profile',
  topbarAt: 20,

  render() {
    const p = state.profile;
    const named = Boolean(p.name);
    return `
    <div class="topgap"></div>
    <header class="phead">
      <div class="avatar">${esc(initials(p.name))}</div>
      <div style="flex:1;min-width:0">
        <h1 class="serif" style="font-size:24px">${named ? esc(p.name) : 'Welcome'}</h1>
        <p class="tiny" style="margin:2px 0 0">${named
          ? esc(p.phone || 'Tap to add a phone number')
          : 'Add your details once and checkout fills itself in.'}</p>
      </div>
      <button class="btn btn-line btn-s" data-act="address" type="button">
        ${named ? 'Edit' : 'Add'}</button>
    </header>

    <div class="stats">
      <div class="stat"><b>${num(state.wish.length)}</b><span>Saved</span></div>
      <div class="stat"><b>${num(state.orders.length)}</b><span>Orders</span></div>
      <div class="stat"><b>${num(bagCount())}</b><span>In bag</span></div>
    </div>

    <div class="rows">
      <button class="row" data-act="nav" data-to="/saved" type="button">
        ${icon('heart', 19)}<span class="row-label">Saved pieces</span>
        <span class="row-val">${num(state.wish.length)}</span>${icon('chev', 16, 'chev')}</button>

      <button class="row" data-act="nav" data-to="/orders" type="button">
        ${icon('box', 19)}<span class="row-label">Orders</span>
        <span class="row-val">${num(state.orders.length)}</span>${icon('chev', 16, 'chev')}</button>

      <button class="row" data-act="fit" type="button">
        ${icon('ruler', 19)}<span class="row-label">Your fit</span>
        <span class="row-val">${fitSaved()
          ? `${esc(state.fit.bust || '–')}/${esc(state.fit.waist || '–')}/${esc(state.fit.hip || '–')}`
          : 'Not set'}</span>${icon('chev', 16, 'chev')}</button>

      <button class="row" data-act="address" type="button">
        ${icon('pin', 19)}<span class="row-label">Delivery details</span>
        <span class="row-val">${state.address.city ? esc(state.address.city) : 'Not set'}</span>
        ${icon('chev', 16, 'chev')}</button>
    </div>

    <div class="rows">
      <div class="row" style="cursor:default">
        ${icon('drop', 19)}<span class="row-label">Colour</span>
        <span class="segset" id="colourSet">
          ${COLOUR_MODES.map((m) => `<button data-colour-mode="${m.id}" type="button"
            class="${state.prefs.colour === m.id ? 'on' : ''}">${m.name}</button>`).join('')}
        </span>
      </div>
      <div class="row" style="cursor:default">
        ${icon('contrast', 19)}<span class="row-label">Appearance</span>
        <span class="segset" id="themeSet">
          ${THEMES.map((t) => `<button data-theme-mode="${t.id}" type="button"
            class="${state.prefs.theme === t.id ? 'on' : ''}">${t.name}</button>`).join('')}
        </span>
      </div>
    </div>

    <div class="rows">
      ${standalone() ? '' : `
      <button class="row" data-act="install" type="button">
        ${icon('download', 19)}<span class="row-label">Add to home screen</span>
        ${icon('chev', 16, 'chev')}</button>`}
      <a class="row" href="${BRAND.instagramUrl}" target="_blank" rel="noopener">
        ${icon('instagram', 19)}<span class="row-label">@${BRAND.instagram}</span>
        ${icon('arrow', 16, 'chev')}</a>
      <button class="row" data-act="about" type="button">
        ${icon('info', 19)}<span class="row-label">About this preview</span>
        ${icon('chev', 16, 'chev')}</button>
      <button class="row" data-act="reset" type="button">
        ${icon('trash', 19)}<span class="row-label">Clear everything</span>
        ${icon('chev', 16, 'chev')}</button>
    </div>

    <div class="footer">
      <div class="footer-mark"></div>
      <p>${BRAND.full} · ${BRAND.country}</p>
      <div class="footer-rule"></div>
      ${alphaSig()}
      <p class="footer-legal">© ${new Date().getFullYear()} ${BRAND.full}</p>
    </div>`;
  },

  mount(app, signal) {
    app.addEventListener('click', (e) => {
      const c = e.target.closest('[data-colour-mode]');
      if (c) {
        patch('prefs', { colour: c.dataset.colourMode });
        applyColourPref();
        app.querySelectorAll('[data-colour-mode]').forEach((b) =>
          b.classList.toggle('on', b === c));
        document.dispatchEvent(new CustomEvent('colour:changed'));
        return;
      }
      const t = e.target.closest('[data-theme-mode]');
      if (t) {
        patch('prefs', { theme: t.dataset.themeMode });
        document.documentElement.dataset.theme = t.dataset.themeMode;
        app.querySelectorAll('[data-theme-mode]').forEach((b) =>
          b.classList.toggle('on', b === t));
        document.dispatchEvent(new CustomEvent('theme:changed'));
      }
    }, { signal });
  },
};

export { addressSheet, aboutSheet, resetSheet };
