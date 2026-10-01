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
    <h2>اندازه‌های من</h2>
    <p class="lede">سه تا اندازه، فقط روی همین گوشی می‌ماند. بعدش هر صفحهٔ
      محصول خودش می‌گوید توی استودیو چه سایزی دستت می‌دادیم.</p>
    <form id="fitForm" novalidate>
      <div class="field-row">
        <div class="field"><label for="fBust">دور سینه (سانتی‌متر)</label>
          <input id="fBust" name="bust" inputmode="numeric" value="${esc(f.bust)}"></div>
        <div class="field"><label for="fWaist">دور کمر (سانتی‌متر)</label>
          <input id="fWaist" name="waist" inputmode="numeric" value="${esc(f.waist)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="fHip">دور باسن (سانتی‌متر)</label>
          <input id="fHip" name="hip" inputmode="numeric" value="${esc(f.hip)}"></div>
        <div class="field"><label for="fHeight">قد (سانتی‌متر)</label>
          <input id="fHeight" name="height" inputmode="numeric" value="${esc(f.height)}"></div>
      </div>
      <p class="tiny" id="fitOut" style="min-height:20px"></p>
      <div style="height:12px"></div>
      <button class="btn btn-ink btn-block" type="submit">ثبت اندازه‌ها</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">بی‌خیال</button>
    </form>`,
  {
    label: 'اندازه‌های من',
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
        out.innerHTML = rec
          ? `به نظر می‌آید سایز <span dir="ltr">${rec.size}</span> بهت می‌خورد.` : '';
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
        toast('اندازه‌ها ذخیره شد', 'ruler');
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
    <h2>اطلاعات ارسال</h2>
    <p class="lede">موقع تکمیل خرید خودکار پر می‌شود. فقط روی همین گوشی ذخیره می‌شود، جای دیگری نه.</p>
    <form id="adForm" novalidate>
      <div class="field"><label for="aName">نام و نام خانوادگی</label>
        <input id="aName" name="name" autocomplete="name" value="${esc(p.name)}"></div>
      <div class="field"><label for="aPhone">شمارهٔ موبایل</label>
        <input id="aPhone" name="phone" inputmode="tel" autocomplete="tel" dir="ltr"
               value="${esc(p.phone)}" placeholder="۰۹۱۲ ۰۰۰ ۰۰۰۰"></div>
      <div class="field"><label for="aLine">نشانی</label>
        <textarea id="aLine" name="line" autocomplete="street-address">${esc(a.line)}</textarea></div>
      <div class="field-row">
        <div class="field"><label for="aCity">شهر</label>
          <input id="aCity" name="city" autocomplete="address-level2" value="${esc(a.city)}"></div>
        <div class="field"><label for="aPostal">کد پستی</label>
          <input id="aPostal" name="postal" inputmode="numeric" dir="ltr"
                 value="${esc(a.postal)}"></div>
      </div>
      <div style="height:12px"></div>
      <button class="btn btn-ink btn-block" type="submit">ذخیره</button>
    </form>`,
  {
    label: 'اطلاعات ارسال',
    onMount(sheet) {
      sheet.querySelector('#adForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const g = (k) => String(d.get(k) || '').trim();
        patch('profile', { name: g('name'), phone: g('phone') });
        patch('address', { line: g('line'), city: g('city'), postal: g('postal') });
        closeSheet();
        toast('اطلاعات ذخیره شد', 'check');
        document.dispatchEvent(new CustomEvent('view:refresh'));
      });
    },
  });
}

/* ----------------------------------------------------------------- about */
const aboutSheet = () => openSheet(`
  <h2 dir="ltr" style="text-align:start">${BRAND.full}</h2>
  <p class="lede">${BRAND.tagline} سالی سه کالکشن، در تیراژ کم، از خود استودیو
    و از اینستاگرام فروخته می‌شود.</p>
  <div style="height:14px"></div>
  <a class="row" href="${BRAND.instagramUrl}" target="_blank" rel="noopener">
    ${icon('instagram', 19)}<span class="row-label" dir="ltr">@${BRAND.instagram}</span>
    ${icon('arrow', 16, 'chev')}</a>
  <div class="notice">این یک نسخهٔ پیش‌نمایش است که Alpha Agency ساخته. عکس‌ها
    مال خود برند است؛ قیمت‌ها، اسم محصول‌ها، جنس پارچه، اندازه‌ها و قول‌های
    ارسال همگی نمونه‌اند و هیچ‌کدام واقعی نیست. هر چیزی هم اینجا تایپ کنی از
    گوشی‌ات بیرون نمی‌رود.</div>
  <div style="height:18px"></div>
  <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">بستن</button>`,
{ label: 'درباره' });

function resetSheet() {
  openSheet(`
    <h2>پاک کردن همه چیز</h2>
    <p class="lede">سبد، ذخیره‌شده‌ها، سفارش‌ها و اندازه‌هایت از این گوشی پاک
      می‌شود. برگشتی ندارد.</p>
    <button class="btn btn-ink btn-block" id="yes" type="button">آره، پاک کن</button>
    <div style="height:9px"></div>
    <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">بی‌خیال</button>`,
  {
    label: 'پاک کردن اطلاعات',
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
  { id: 'touch', name: 'با لمس' },
  { id: 'always', name: 'همیشه' },
  { id: 'never', name: 'هیچ‌وقت' },
];
const THEMES = [
  { id: 'auto', name: 'خودکار' },
  { id: 'light', name: 'روشن' },
  { id: 'dark', name: 'تیره' },
];

export default {
  tab: 'profile',
  title: 'پروفایل',
  topbarAt: 20,

  render() {
    const p = state.profile;
    const named = Boolean(p.name);
    return `
    <div class="topgap"></div>
    <header class="phead">
      <div class="avatar">${esc(initials(p.name))}</div>
      <div style="flex:1;min-width:0">
        <h1 class="serif" style="font-size:24px">${named ? esc(p.name) : 'خوش آمدی'}</h1>
        <p class="tiny" style="margin:2px 0 0">${named
          ? esc(p.phone || 'برای افزودن شماره بزن')
          : 'یک بار اطلاعاتت را بده، بعد تکمیل خرید خودش پر می‌شود.'}</p>
      </div>
      <button class="btn btn-line btn-s" data-act="address" type="button">
        ${named ? 'ویرایش' : 'افزودن'}</button>
    </header>

    <div class="stats">
      <div class="stat"><b>${num(state.wish.length)}</b><span>ذخیره‌شده</span></div>
      <div class="stat"><b>${num(state.orders.length)}</b><span>سفارش</span></div>
      <div class="stat"><b>${num(bagCount())}</b><span>توی سبد</span></div>
    </div>

    <div class="rows">
      <button class="row" data-act="nav" data-to="/saved" type="button">
        ${icon('heart', 19)}<span class="row-label">ذخیره‌شده‌ها</span>
        <span class="row-val">${num(state.wish.length)}</span>${icon('chev', 16, 'chev')}</button>

      <button class="row" data-act="nav" data-to="/orders" type="button">
        ${icon('box', 19)}<span class="row-label">سفارش‌ها</span>
        <span class="row-val">${num(state.orders.length)}</span>${icon('chev', 16, 'chev')}</button>

      <button class="row" data-act="fit" type="button">
        ${icon('ruler', 19)}<span class="row-label">اندازه‌های من</span>
        <span class="row-val" dir="ltr">${fitSaved()
          ? `${esc(state.fit.bust || '–')}/${esc(state.fit.waist || '–')}/${esc(state.fit.hip || '–')}`
          : '—'}</span>${icon('chevL', 16, 'chev')}</button>

      <button class="row" data-act="address" type="button">
        ${icon('pin', 19)}<span class="row-label">اطلاعات ارسال</span>
        <span class="row-val">${state.address.city ? esc(state.address.city) : 'ثبت نشده'}</span>
        ${icon('chevL', 16, 'chev')}</button>
    </div>

    <div class="rows">
      <div class="row" style="cursor:default">
        ${icon('drop', 19)}<span class="row-label">رنگ</span>
        <span class="segset" id="colourSet">
          ${COLOUR_MODES.map((m) => `<button data-colour-mode="${m.id}" type="button"
            class="${state.prefs.colour === m.id ? 'on' : ''}">${m.name}</button>`).join('')}
        </span>
      </div>
      <div class="row" style="cursor:default">
        ${icon('contrast', 19)}<span class="row-label">ظاهر</span>
        <span class="segset" id="themeSet">
          ${THEMES.map((t) => `<button data-theme-mode="${t.id}" type="button"
            class="${state.prefs.theme === t.id ? 'on' : ''}">${t.name}</button>`).join('')}
        </span>
      </div>
    </div>

    <div class="rows">
      ${standalone() ? '' : `
      <button class="row" data-act="install" type="button">
        ${icon('download', 19)}<span class="row-label">افزودن به صفحهٔ خانه</span>
        ${icon('chevL', 16, 'chev')}</button>`}
      <a class="row" href="${BRAND.instagramUrl}" target="_blank" rel="noopener">
        ${icon('instagram', 19)}<span class="row-label" dir="ltr">@${BRAND.instagram}</span>
        ${icon('chevL', 16, 'chev')}</a>
      <button class="row" data-act="about" type="button">
        ${icon('info', 19)}<span class="row-label">دربارهٔ این پیش‌نمایش</span>
        ${icon('chevL', 16, 'chev')}</button>
      <button class="row" data-act="reset" type="button">
        ${icon('trash', 19)}<span class="row-label">پاک کردن همه چیز</span>
        ${icon('chevL', 16, 'chev')}</button>
    </div>

    <div class="footer">
      <div class="footer-mark"></div>
      <p><span dir="ltr">${BRAND.full}</span> — ${BRAND.country}</p>
      <div class="footer-rule"></div>
      ${alphaSig()}
      <p class="footer-legal" dir="ltr">© ${new Date().getFullYear()} ${BRAND.full}</p>
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
