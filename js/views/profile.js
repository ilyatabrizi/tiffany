/* Profile — who you are, what you saved, and the switch that decides how the
   whole shop looks. (The colour switch is gone at the studio's request; every
   photograph now follows the one rule: greyscale until touched.) */
import { BRAND } from '../config.js';
import { SIZES } from '../data.js';
import { icon } from '../icons.js';
import { esc, num, typed } from '../util.js';
import { state, patch, bagCount } from '../store.js';
import {
  openSheet, closeSheet, toast, recommendSize, fitSaved, alphaSig, trustSeal,
} from '../ui.js';
import { standalone } from '../install.js';
import { consent } from '../consent.js';
import { account } from '../account.js';
import { L } from '../i18n.js';

const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'T';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const CM = L('سانتی‌متر', 'cm', 'cm');

/* --------------------------------------------------------------- the fit */
export function fitSheet() {
  const f = state.fit;
  openSheet(`
    <h2>${esc(L('اندازه‌های من', 'Your fit', 'Ölçülerim'))}</h2>
    <p class="lede">${esc(L(
      'سه تا اندازه، که فقط روی همین گوشی می‌مونه. بعدش هر صفحه‌ی محصول خودش بهت می‌گه توی استودیو چه سایزی دستت می‌دادیم.',
      'Three measurements, kept on this phone only. After that every product page names the size the studio would hand you.',
      'Yalnızca bu telefonda kalan üç ölçü. Sonra her ürün sayfası, atölyede sana hangi bedeni vereceğimizi söyler.'))}</p>
    <form id="fitForm" novalidate>
      <div class="field-row">
        <div class="field"><label for="fBust">${esc(L(`دور سینه (${CM})`, `Bust (${CM})`, `Göğüs (${CM})`))}</label>
          <input id="fBust" name="bust" inputmode="numeric" value="${esc(f.bust)}"></div>
        <div class="field"><label for="fWaist">${esc(L(`دور کمر (${CM})`, `Waist (${CM})`, `Bel (${CM})`))}</label>
          <input id="fWaist" name="waist" inputmode="numeric" value="${esc(f.waist)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="fHip">${esc(L(`دور باسن (${CM})`, `Hip (${CM})`, `Kalça (${CM})`))}</label>
          <input id="fHip" name="hip" inputmode="numeric" value="${esc(f.hip)}"></div>
        <div class="field"><label for="fHeight">${esc(L(`قد (${CM})`, `Height (${CM})`, `Boy (${CM})`))}</label>
          <input id="fHeight" name="height" inputmode="numeric" value="${esc(f.height)}"></div>
      </div>
      <p class="tiny" id="fitOut" style="min-height:20px"></p>
      <div style="height:12px"></div>
      <button class="btn btn-ink btn-block" type="submit">${esc(L('ثبت اندازه‌ها', 'Save measurements', 'Ölçüleri kaydet'))}</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${esc(L('بی‌خیال', 'Never mind', 'Vazgeç'))}</button>
    </form>`,
  {
    label: L('اندازه‌های من', 'Your fit', 'Ölçülerim'),
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
        const s = rec ? `<span dir="ltr">${esc(rec.size)}</span>` : '';
        out.innerHTML = rec
          ? L(`به نظر میاد سایز ${s} اندازه‌ت باشه.`, `Looks like a ${s} for you.`, `Sana ${s} beden uygun görünüyor.`)
          : '';
      };
      sheet.querySelectorAll('input').forEach((i) =>
        i.addEventListener('input', preview));
      preview();

      sheet.querySelector('#fitForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        /* Kept in Latin digits whatever keyboard typed them (۹۰ → 90). */
        patch('fit', {
          bust: typed(d.get('bust')),
          waist: typed(d.get('waist')),
          hip: typed(d.get('hip')),
          height: typed(d.get('height')),
        });
        closeSheet();
        toast(L('اندازه‌ها ذخیره شد', 'Measurements saved', 'Ölçüler kaydedildi'), 'ruler');
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
    <h2>${esc(L('اطلاعات ارسال', 'Delivery details', 'Teslimat bilgileri'))}</h2>
    <p class="lede">${esc(L(
      'موقع تکمیل خرید خودش پر می‌شه. فقط روی همین گوشی ذخیره می‌شه، جای دیگه نه.',
      'Fills in checkout for you. Stored on this phone and nowhere else.',
      'Ödeme sırasında kendiliğinden dolar. Sadece bu telefonda saklanır, başka hiçbir yerde değil.'))}</p>
    <form id="adForm" novalidate>
      <div class="field"><label for="aName">${esc(L('اسم و فامیل', 'Full name', 'Ad soyad'))}</label>
        <input id="aName" name="name" autocomplete="name" value="${esc(p.name)}"></div>
      <div class="field"><label for="aPhone">${esc(L('شماره موبایل', 'Phone', 'Telefon'))}</label>
        <input id="aPhone" name="phone" inputmode="tel" autocomplete="tel" dir="ltr"
               value="${esc(p.phone)}" placeholder="${L('۰۹۱۲ ۰۰۰ ۰۰۰۰', '0912 000 0000', '0912 000 0000')}"></div>
      <div class="field"><label for="aLine">${esc(L('آدرس', 'Address', 'Adres'))}</label>
        <textarea id="aLine" name="line" autocomplete="street-address">${esc(a.line)}</textarea></div>
      <div class="field-row">
        <div class="field"><label for="aCity">${esc(L('شهر', 'City', 'Şehir'))}</label>
          <input id="aCity" name="city" autocomplete="address-level2" value="${esc(a.city)}"></div>
        <div class="field"><label for="aPostal">${esc(L('کد پستی', 'Post code', 'Posta kodu'))}</label>
          <input id="aPostal" name="postal" inputmode="numeric" dir="ltr"
                 value="${esc(a.postal)}"></div>
      </div>
      <div style="height:12px"></div>
      <button class="btn btn-ink btn-block" type="submit">${esc(L('ذخیره', 'Save', 'Kaydet'))}</button>
    </form>`,
  {
    label: L('اطلاعات ارسال', 'Delivery details', 'Teslimat bilgileri'),
    onMount(sheet) {
      sheet.querySelector('#adForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const g = (k) => String(d.get(k) || '').trim();
        patch('profile', { name: g('name'), phone: g('phone') });
        patch('address', { line: g('line'), city: g('city'), postal: g('postal') });
        closeSheet();
        toast(L('اطلاعات ذخیره شد', 'Details saved', 'Bilgiler kaydedildi'), 'check');
        document.dispatchEvent(new CustomEvent('view:refresh'));
      });
    },
  });
}

/* ----------------------------------------------------------------- links */
const igRow = () => `
  <a class="row" href="${BRAND.instagramUrl}" target="_blank" rel="noopener">
    ${icon('instagram', 19)}<span class="row-label" dir="ltr">@${BRAND.instagram}</span>
    ${icon('chevL', 16, 'chev')}</a>`;

const pageRow = (to, ico, label) => `
  <a class="row" href="#${to}">${icon(ico, 19)}<span class="row-label">${esc(label)}</span>
    ${icon('chevL', 16, 'chev')}</a>`;

function resetSheet() {
  openSheet(`
    <h2>${esc(L('پاک کردن همه چی', 'Clear everything', 'Her şeyi temizle'))}</h2>
    <p class="lede">${esc(L(
      'سبد، ذخیره‌شده‌ها، سفارش‌ها و اندازه‌هات از این گوشی پاک می‌شه. دیگه برنمی‌گرده.',
      'Your bag, saved pieces, orders and measurements are wiped from this phone. There is no undo.',
      'Sepetin, kaydettiklerin, siparişlerin ve ölçülerin bu telefondan silinir. Geri alınamaz.'))}</p>
    <button class="btn btn-ink btn-block" id="yes" type="button">${esc(L('آره، پاکش کن', 'Yes, clear it', 'Evet, temizle'))}</button>
    <div style="height:9px"></div>
    <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${esc(L('بی‌خیال', 'Never mind', 'Vazgeç'))}</button>`,
  {
    label: L('پاک کردن اطلاعات', 'Clear data', 'Verileri temizle'),
    onMount(sheet) {
      sheet.querySelector('#yes').addEventListener('click', () => {
        try { localStorage.removeItem('tiffany.v1'); } catch { /* private mode */ }
        location.reload();
      });
    },
  });
}

/* ------------------------------------------------------------------ view */
const THEMES = [
  { id: 'auto', name: L('خودکار', 'Auto', 'Otomatik') },
  { id: 'light', name: L('روشن', 'Light', 'Açık') },
  { id: 'dark', name: L('تیره', 'Dark', 'Koyu') },
];

/* One forward chevron for every row; CSS turns it round for left-to-right. */
const fwd = () => icon('chevL', 16, 'chev');

export default {
  tab: 'profile',
  title: L('پروفایل', 'Profile', 'Profil'),
  topbarAt: 20,

  render() {
    const p = state.profile;
    const named = Boolean(p.name);
    const u = account.user;
    /* Signed in, the header is the account; otherwise it is what this phone
       remembers, with the way into an account just under it. */
    const headerHtml = u ? `
    <header class="phead">
      <div class="avatar">${esc(initials(u.name))}</div>
      <div style="flex:1;min-width:0">
        <h1 class="serif" style="font-size:24px">${esc(u.name)}</h1>
        <p class="tiny" style="margin:2px 0 0"><span dir="ltr">${esc(u.phone)}</span> ·
          ${icon('check', 13)}${esc(L('تأییدشده', 'confirmed', 'doğrulandı'))}</p>
      </div>
      <button class="btn btn-line btn-s" data-act="account" type="button">${esc(L('حساب', 'Account', 'Hesap'))}</button>
    </header>` : `
    <header class="phead">
      <div class="avatar">${esc(initials(p.name))}</div>
      <div style="flex:1;min-width:0">
        <h1 class="serif" style="font-size:24px">${named ? esc(p.name) : esc(L('خوش اومدی', 'Welcome', 'Hoş geldin'))}</h1>
        <p class="tiny" style="margin:2px 0 0">${named && p.phone ? `<span dir="ltr">${esc(p.phone)}</span>`
          : esc(L('هنوز وارد حسابت نشدی.', 'You are not signed in.', 'Henüz giriş yapmadın.'))}</p>
      </div>
    </header>
    ${account.loaded ? `<section class="acct-box" aria-label="${esc(L('حساب تیفانی', 'TIFFANY account', 'TIFFANY hesabı'))}">
      <h2>${esc(L('حساب تیفانی', 'Your TIFFANY account', 'TIFFANY hesabın'))}</h2>
      <ul class="acct-perks">
        <li>${icon('ticket', 17)}<span>${esc(L('تیکت پشتیبانی بفرست و جواب تیم رو همین‌جا بگیر؛ وقتی جواب بیاد پیامک می‌گیری.',
          'Send support tickets and read the team’s answers here — with a text when one arrives.',
          'Destek talebi gönder, ekibin yanıtını burada oku — yanıt gelince SMS alırsın.'))}</span></li>
        <li>${icon('bag', 17)}<span>${esc(L('موقع خرید، اسم و شماره‌ت خودش پر می‌شه.',
          'Checkout fills in your name and number.',
          'Ödemede adın ve numaran kendiliğinden dolar.'))}</span></li>
        <li>${icon('lock', 17)}<span>${esc(L('فقط با شماره موبایل و رمز خودت؛ شماره یه بار با پیامک تأیید می‌شه.',
          'Just your mobile number and a password; the number is confirmed once by SMS.',
          'Yalnızca cep numaran ve şifren; numara bir kez SMS ile doğrulanır.'))}</span></li>
      </ul>
      <div class="acct-two">
        <button class="btn btn-ink" data-act="signin" type="button">${esc(L('ورود', 'Sign in', 'Giriş yap'))}</button>
        <button class="btn btn-line" data-act="signup" type="button">${esc(L('ساخت حساب', 'Create account', 'Hesap oluştur'))}</button>
      </div>
    </section>` : ''}`;
    return `
    <div class="topgap"></div>
    ${headerHtml}

    <div class="stats">
      <div class="stat"><b>${num(state.wish.length)}</b><span>${esc(L('ذخیره‌شده', 'Saved', 'Kayıtlı'))}</span></div>
      <div class="stat"><b>${num(state.orders.length)}</b><span>${esc(L('سفارش', 'Orders', 'Sipariş'))}</span></div>
      <div class="stat"><b>${num(bagCount())}</b><span>${esc(L('توی سبد', 'In bag', 'Sepette'))}</span></div>
    </div>

    <div class="rows">
      <button class="row" data-act="nav" data-to="/saved" type="button">
        ${icon('heart', 19)}<span class="row-label">${esc(L('ذخیره‌شده‌ها', 'Saved pieces', 'Kaydedilenler'))}</span>
        <span class="row-val">${num(state.wish.length)}</span>${fwd()}</button>

      <button class="row" data-act="nav" data-to="/orders" type="button">
        ${icon('box', 19)}<span class="row-label">${esc(L('سفارش‌ها', 'Orders', 'Siparişler'))}</span>
        <span class="row-val">${num(state.orders.length)}</span>${fwd()}</button>

      <button class="row" data-act="nav" data-to="/tickets" type="button">
        ${icon('ticket', 19)}<span class="row-label">${esc(L('پشتیبانی و تیکت‌ها', 'Support tickets', 'Destek talepleri'))}</span>
        <span class="row-val">${u && account.unread ? esc(L(`${num(account.unread)} جواب تازه`, `${account.unread} new`, `${account.unread} yeni`)) : ''}</span>${fwd()}</button>

      <button class="row" data-act="fit" type="button">
        ${icon('ruler', 19)}<span class="row-label">${esc(L('اندازه‌های من', 'Your fit', 'Ölçülerim'))}</span>
        <span class="row-val" dir="ltr">${fitSaved()
          ? `${esc(state.fit.bust || '–')}/${esc(state.fit.waist || '–')}/${esc(state.fit.hip || '–')}`
          : '—'}</span>${fwd()}</button>

      <button class="row" data-act="address" type="button">
        ${icon('pin', 19)}<span class="row-label">${esc(L('اطلاعات ارسال', 'Delivery details', 'Teslimat bilgileri'))}</span>
        <span class="row-val">${state.address.city ? esc(state.address.city) : esc(L('ثبت نشده', 'Not set', 'Girilmedi'))}</span>
        ${fwd()}</button>
    </div>

    <div class="rows">
      <div class="row" style="cursor:default">
        ${icon('contrast', 19)}<span class="row-label">${esc(L('ظاهر', 'Appearance', 'Görünüm'))}</span>
        <span class="segset" id="themeSet">
          ${THEMES.map((t) => `<button data-theme-mode="${t.id}" type="button"
            class="${state.prefs.theme === t.id ? 'on' : ''}">${esc(t.name)}</button>`).join('')}
        </span>
      </div>
    </div>

    <div class="rows">
      ${standalone() ? '' : `
      <button class="row" data-act="install" type="button">
        ${icon('download', 19)}<span class="row-label">${esc(L('اضافه کردن به صفحه‌ی اصلی گوشی', 'Add to home screen', 'Ana ekrana ekle'))}</span>
        ${fwd()}</button>`}
      ${igRow()}
    </div>

    <div class="rows">
      ${pageRow('/about', 'info', L('درباره‌ی ما', 'About us', 'Hakkımızda'))}
      ${pageRow('/contact', 'store', L('شعبه‌ها و تماس', 'Stores & contact', 'Mağazalar ve iletişim'))}
      ${pageRow('/terms', 'doc', L('قوانین و شرایط', 'Terms & policies', 'Koşullar ve politikalar'))}
      <button class="row" data-act="consent" type="button">
        ${icon('shield', 19)}<span class="row-label">${esc(L('کوکی‌ها و حریم خصوصی', 'Cookies and privacy', 'Çerezler ve gizlilik'))}</span>
        <span class="row-val">${esc(({
          yes: L('قبول', 'Accepted', 'Kabul edildi'),
          no: L('فقط ضروری‌ها', 'Essentials only', 'Yalnızca gerekli'),
        })[consent()] || '—')}</span>${fwd()}</button>
    </div>

    <div class="rows">
      <button class="row" data-act="reset" type="button">
        ${icon('trash', 19)}<span class="row-label">${esc(L('پاک کردن همه چی', 'Clear everything', 'Her şeyi temizle'))}</span>
        ${fwd()}</button>
    </div>

    <div class="footer">
      <div class="footer-mark"></div>
      <p><span dir="ltr">${BRAND.full}</span> — ${esc(BRAND.country)}</p>
      ${trustSeal()}
      <div class="footer-rule"></div>
      ${alphaSig()}
      <p class="footer-legal" dir="ltr">© ${new Date().getFullYear()} ${BRAND.full}</p>
    </div>`;
  },

  mount(app, signal) {
    app.addEventListener('click', (e) => {
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

export { addressSheet, resetSheet };
