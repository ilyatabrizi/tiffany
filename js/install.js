/* Add to Home Screen.

   The sheet opens by itself a moment after the shop opens, on phones only,
   and only where it can actually help:

   - Chrome / Samsung Internet / Edge on Android hand over a
     beforeinstallprompt event -> one button, the real install dialog;
   - iPhone and iPad never do -> the three steps, with Safari's own icons;
   - Android without the event yet -> the steps for that browser's menu (and
     if the event turns up while the sheet is open, the button replaces them);
   - Instagram, Facebook and Telegram's built-in browsers cannot install
     anything -> how to open the shop in the real browser first, plus a
     copy-link button.

   It never comes back once the shop is on the home screen, or after «دیگه
   نشون نده». Otherwise it waits four days after each showing and gives up
   after three; Profile -> «اضافه کردن به صفحه‌ی اصلی گوشی» is always there. */
import { openSheet, closeSheet, toast } from './ui.js';
import { icon } from './icons.js';
import { L } from './i18n.js';
import { device, standalone } from './device.js';

export { standalone };

const KEY = 'tiffany.a2hs';
const SNOOZE = 4 * 864e5;
const MAX_ASKS = 3;

let deferred = null;

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  document.dispatchEvent(new CustomEvent('install:ready'));
});
addEventListener('appinstalled', () => {
  deferred = null;
  remember({ done: true });
  closeSheet();
  toast(L('نصب شد', 'Installed', 'Yüklendi'), 'check');
});

function memo() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function remember(p) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...memo(), ...p })); } catch { /* private mode */ }
}

/** Should the sheet open by itself on this visit? */
export function shouldOfferInstall() {
  if (!device.phone || standalone()) return false;
  const m = memo();
  if (m.done || (m.n || 0) >= MAX_ASKS) return false;
  return !m.at || Date.now() - m.at > SNOOZE;
}

/* ----------------------------------------------------------------- copy */
const ico = (name) => `<span class="key">${icon(name, 15)}</span>`;
const en = (s) => `<b dir="ltr" lang="en">${s}</b>`;
/* Persian steps name the Persian menu item, with the English one the phone
   may show on a quiet line under it — mixing both inside one sentence turns
   the punctuation round. */
const also = (...labels) => `<small class="also" dir="ltr" lang="en">${labels.join(' · ')}</small>`;

function iosSteps() {
  const share = ico('share');
  const first = device.iosSafari
    ? L(`دکمه‌ی اشتراک‌گذاری ${share} رو بزن. توی سافاری پایین صفحه‌ست؛ اگه نمی‌بینیش، اول ${ico('dots')} رو بزن.`,
      `Tap Share ${share}. In Safari it sits in the bottom bar; if you can’t see it, tap ${ico('dots')} first.`,
      `Paylaş ${share} düğmesine dokun. Safari’de alt çubuktadır; göremiyorsan önce ${ico('dots')} simgesine dokun.`)
    : L(`دکمه‌ی اشتراک‌گذاری ${share} مرورگرت رو بزن؛ معمولاً کنار نوار آدرسه.`,
      `Tap your browser’s Share button ${share}, usually next to the address bar.`,
      `Tarayıcının Paylaş ${share} düğmesine dokun; genellikle adres çubuğunun yanındadır.`);
  return [
    first,
    L(`یه کم پایین‌تر برو و ${en('Add to Home Screen')} ${ico('addsq')} رو بزن.`,
      `Scroll down a little and choose ${en('Add to Home Screen')} ${ico('addsq')}.`,
      `Biraz aşağı kaydır ve ${en('Ana Ekrana Ekle')} ${ico('addsq')} seçeneğine dokun.`),
    L(`بالای صفحه ${en('Add')} رو بزن. تمام! آیکون TIFFANY میاد کنار بقیه‌ی اپ‌هات.`,
      `Tap ${en('Add')} at the top. Done — TIFFANY sits with your other apps.`,
      `Üstteki ${en('Ekle')}’ye dokun. Bu kadar, TIFFANY diğer uygulamalarının yanında.`),
  ];
}

function androidSteps() {
  if (device.browser === 'samsung') {
    return [
      L(`منوی ${ico('menu')} پایین صفحه رو بزن.`, `Tap the menu ${ico('menu')} in the bottom bar.`,
        `Alt çubuktaki menüye ${ico('menu')} dokun.`),
      L(`گزینه‌ی «افزودن صفحه به» و بعد «صفحه‌ی اصلی» رو بزن.${also('Add page to → Home screen')}`,
        `Choose ${en('Add page to')}, then ${en('Home screen')}.`,
        `${en('Sayfayı ekle')} ve ardından ${en('Ana ekran')} seçeneğine dokun.`),
      L('«افزودن» رو تأیید کن. آیکون TIFFANY میاد روی صفحه‌ی اصلیت.',
        'Confirm with Add — TIFFANY lands on your home screen.',
        'Ekle ile onayla; TIFFANY ana ekranına gelir.'),
    ];
  }
  return [
    L(`منوی مرورگر ${ico('kebab')} رو بزن؛ بالای صفحه، کنار نوار آدرسه.`,
      `Tap the browser menu ${ico('kebab')}, next to the address bar.`,
      `Adres çubuğunun yanındaki tarayıcı menüsüne ${ico('kebab')} dokun.`),
    L(`گزینه‌ی «نصب برنامه» یا «افزودن به صفحه‌ی اصلی» رو بزن.${also('Install app', 'Add to Home screen')}`,
      `Choose ${en('Install app')} or ${en('Add to Home screen')}.`,
      `${en('Uygulamayı yükle')} ya da ${en('Ana ekrana ekle')} seçeneğine dokun.`),
    L('«نصب» رو تأیید کن. آیکون TIFFANY میاد روی صفحه‌ی اصلیت.',
      'Confirm with Install — TIFFANY lands on your home screen.',
      'Yükle ile onayla; TIFFANY ana ekranına gelir.'),
  ];
}

function inAppSteps() {
  const browser = device.ios ? 'Safari' : 'Chrome';
  const menu = ico(device.ios ? 'dots' : 'kebab');
  return [
    L(`گوشه‌ی بالای صفحه ${menu} رو بزن.`, `Tap ${menu} in the top corner.`, `Üst köşedeki ${menu} simgesine dokun.`),
    L(`گزینه‌ی «باز کردن در مرورگر» رو بزن.${also(device.ios ? 'Open in external browser' : `Open in ${browser}`)}`,
      `Choose ${en(device.ios ? 'Open in external browser' : `Open in ${browser}`)}.`,
      `${en(device.ios ? 'Harici tarayıcıda aç' : `${browser}’da aç`)} seçeneğine dokun.`),
    L(`توی ${device.ios ? 'سافاری' : 'کروم'} همین پیغام دوباره میاد؛ از اونجا TIFFANY رو اضافه کن.`,
      `This note shows up again in ${browser} — add TIFFANY from there.`,
      `Bu not ${browser}’da yeniden çıkar; TIFFANY’yi oradan ekle.`),
  ];
}

function perks() {
  return `<ul class="inst-perks">
    <li>${icon('bolt', 17)}<span>${L('یه لمس تا فروشگاه', 'One tap to the shop', 'Mağazaya tek dokunuş')}</span></li>
    <li>${icon('expand', 17)}<span>${L('تمام‌صفحه، بدون نوار مرورگر', 'Full screen, no browser bar', 'Tam ekran, tarayıcı çubuğu yok')}</span></li>
    <li>${icon('download', 17)}<span>${L('بدون اپ‌استور، تقریباً بی‌حجم', 'No app store, next to no space', 'Mağaza yok, neredeyse yer kaplamaz')}</span></li>
  </ul>`;
}

/** The body below the app tile: steps, or the native button. */
function body(kind) {
  if (kind === 'native') {
    return `
      ${perks()}
      <div class="pop-acts">
        <button class="btn btn-ink btn-block" data-inst="go" type="button">${icon('download', 18)}<span>${L('نصب TIFFANY', 'Install TIFFANY', 'TIFFANY’yi yükle')}</span></button>
        <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${L('بعداً', 'Later', 'Sonra')}</button>
      </div>`;
  }
  const steps = kind === 'inapp' ? inAppSteps() : kind === 'ios' ? iosSteps()
    : kind === 'android' ? androidSteps() : null;
  const desktop = L(
    'توی نوار آدرس، آیکون نصب رو بزن؛ یا از منوی مرورگر گزینه‌ی نصب یا «افزودن به داک» رو انتخاب کن.',
    'Click the install icon in the address bar, or choose Install / Add to Dock from the browser menu.',
    'Adres çubuğundaki yükleme simgesine tıkla ya da tarayıcı menüsünden Yükle / Dock’a Ekle’yi seç.');
  return `
    ${kind === 'inapp' ? '' : perks()}
    ${steps
    ? `<ol class="steps">${steps.map((t, i) => `<li><i>${i + 1}</i><span>${t}</span></li>`).join('')}</ol>`
    : `<p class="lede">${desktop}</p>`}
    <div class="pop-acts">
      ${kind === 'inapp'
    ? `<button class="btn btn-ink btn-block" data-inst="copy" type="button">${icon('copy', 18)}<span>${L('کپی لینک سایت', 'Copy the shop’s link', 'Bağlantıyı kopyala')}</span></button>
         <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${L('بعداً', 'Later', 'Sonra')}</button>`
    : `<button class="btn btn-ink btn-block" data-act="sheet-close" type="button">${L('فهمیدم', 'Got it', 'Anladım')}</button>`}
    </div>`;
}

function kindNow() {
  if (device.inApp) return 'inapp';
  if (deferred) return 'native';
  if (device.ios) return 'ios';
  if (device.android) return 'android';
  return 'desktop';
}

/**
 * Open the install sheet. `auto` is the one that opens by itself: it counts
 * towards the snooze and offers «دیگه نشون نده».
 */
export function installSheet({ auto = false, then } = {}) {
  if (auto) {
    const m = memo();
    remember({ at: Date.now(), n: (m.n || 0) + 1 });
  }
  let kind = kindNow();
  let off = null;
  const host = location.host || 'tiffanybv.com';
  const title = kind === 'inapp'
    ? L('اول سایت رو توی مرورگر باز کن', 'Open the shop in your browser first', 'Önce mağazayı tarayıcıda aç')
    : L('TIFFANY رو بیار روی صفحه‌ی اصلی گوشیت', 'Put TIFFANY on your home screen', 'TIFFANY’yi ana ekranına ekle');
  const lede = kind === 'inapp'
    ? L(`مرورگر داخل ${({ instagram: 'اینستاگرام', facebook: 'فیسبوک', telegram: 'تلگرام' })[device.browser]} نمی‌تونه سایت رو به صفحه‌ی اصلی اضافه کنه. با سه تا لمس توی ${device.ios ? 'سافاری' : 'کروم'} بازش کن.`,
      `The browser inside ${({ instagram: 'Instagram', facebook: 'Facebook', telegram: 'Telegram' })[device.browser]} can’t add sites to your home screen. Three taps open it in ${device.ios ? 'Safari' : 'Chrome'}.`,
      `${({ instagram: 'Instagram', facebook: 'Facebook', telegram: 'Telegram' })[device.browser]} içindeki tarayıcı siteleri ana ekrana ekleyemez. Üç dokunuşla ${device.ios ? 'Safari' : 'Chrome'}’da aç.`)
    : L('مثل یه اپ، با یه لمس باز می‌شه.', 'It opens like an app, in one tap.', 'Bir uygulama gibi, tek dokunuşla açılır.');

  openSheet(`
    <div class="inst-app">
      <img src="assets/icons/icon-192.png" width="56" height="56" alt="">
      <span><b dir="ltr">TIFFANY</b><small dir="ltr">${host}</small></span>
    </div>
    <h2>${title.replace('TIFFANY', '<span dir="ltr">TIFFANY</span>')}</h2>
    <p class="lede">${lede}</p>
    <div class="inst-body">${body(kind)}</div>
    ${auto ? `<button class="pop-never" data-inst="never" type="button">${L('دیگه نشون نده', 'Don’t show this again', 'Bir daha gösterme')}</button>` : ''}`,
  {
    label: L('اضافه کردن به صفحه‌ی اصلی', 'Add to home screen', 'Ana ekrana ekle'),
    cls: 'pop pop-install',
    calm: true,
    onMount(sheet) {
      const box = sheet.querySelector('.inst-body');
      /* Chrome decides a page is installable a little after it loads; when it
         does, the steps give way to the real button. */
      const upgrade = () => {
        if (kind === 'android' || kind === 'desktop') { kind = 'native'; box.innerHTML = body(kind); }
      };
      document.addEventListener('install:ready', upgrade);
      sheet.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-inst]');
        if (!b) return;
        const what = b.dataset.inst;
        if (what === 'never') { remember({ done: true }); closeSheet(); return; }
        if (what === 'copy') {
          const url = `${location.origin}${location.pathname}`;
          try {
            await navigator.clipboard.writeText(url);
            toast(L(`لینک کپی شد؛ توی ${device.ios ? 'سافاری' : 'کروم'} بچسبونش`,
              `Link copied — paste it into ${device.ios ? 'Safari' : 'Chrome'}`,
              `Bağlantı kopyalandı; ${device.ios ? 'Safari' : 'Chrome'}’a yapıştır`), 'check', 3200);
          } catch {
            toast(url, 'copy', 4200);
          }
          return;
        }
        if (what === 'go' && deferred) {
          const ev = deferred;
          deferred = null;
          ev.prompt();
          const { outcome } = await ev.userChoice;
          if (outcome === 'accepted') remember({ done: true });
          closeSheet();
        }
      });
      off = () => document.removeEventListener('install:ready', upgrade);
    },
    onClose() {
      off?.();
      if (then) setTimeout(then, 0);
    },
  });
}

/** The profile row. */
export function promptInstall() {
  if (standalone()) {
    toast(L('الان هم روی صفحه‌ی اصلیته', 'Already on your home screen', 'Zaten ana ekranında'), 'check');
    return;
  }
  installSheet();
}
