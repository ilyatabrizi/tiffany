/* Add to Home Screen.

   Chrome hands over a beforeinstallprompt event; iOS Safari never will, and
   that is where most of this audience lives — so the fallback is the actual
   three-step instruction, not a dead button. */
import { openSheet, toast } from './ui.js';
import { L } from './i18n.js';

let deferred = null;

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => {
  deferred = null;
  toast(L('نصب شد', 'Installed', 'Yüklendi'), 'check');
});

export const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function promptInstall() {
  if (standalone()) { toast(L('الان هم نصبه', 'Already installed', 'Zaten yüklü'), 'check'); return; }
  if (deferred) {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome !== 'accepted') {
      toast(L('هر وقت خواستی از پروفایل اضافه‌ش کن', 'Add it from your profile any time',
        'İstediğin zaman profilinden ekleyebilirsin'));
    }
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const steps = ios
    ? L([
      'توی نوار پایین سافاری، دکمه‌ی اشتراک‌گذاری رو بزن.',
      'گزینه‌ی <b dir="ltr">Add to Home Screen</b> رو انتخاب کن.',
      'روی <b dir="ltr">Add</b> بزن؛ لوگوی برند میاد روی صفحه‌ت.',
    ], [
      'Tap the Share button in Safari’s bottom bar.',
      'Choose <b>Add to Home Screen</b>.',
      'Tap <b>Add</b> — the wordmark lands on your screen.',
    ], [
      'Safari’nin alt çubuğundaki Paylaş düğmesine dokun.',
      '<b>Ana Ekrana Ekle</b> seçeneğini seç.',
      '<b>Ekle</b>’ye dokun; logo ana ekranına gelir.',
    ])
    : L([
      'منوی مرورگر (سه نقطه) رو باز کن.',
      'گزینه‌ی <b>نصب برنامه</b> یا <b>افزودن به صفحه‌ی اصلی</b> رو بزن.',
      'تأیید کن؛ لوگوی برند میاد روی صفحه‌ت.',
    ], [
      'Open the browser menu (three dots).',
      'Choose <b>Install app</b> or <b>Add to Home screen</b>.',
      'Confirm — the wordmark lands on your screen.',
    ], [
      'Tarayıcı menüsünü (üç nokta) aç.',
      '<b>Uygulamayı yükle</b> ya da <b>Ana ekrana ekle</b> seçeneğine dokun.',
      'Onayla; logo ana ekranına gelir.',
    ]);
  openSheet(`
    <h2>${L('اضافه کردن <span dir="ltr">TIFFANY</span> به صفحه‌ی اصلی',
      'Add TIFFANY to your home screen', 'TIFFANY’yi ana ekrana ekle')}</h2>
    <p class="lede">${L(
      'بدون هیچ اپ‌استوری نصب می‌شه و مثل یه اپ باز می‌شه؛ آفلاین، تمام‌صفحه، بدون نوار مرورگر.',
      'It installs without an app store and opens like an app — offline, full screen, no browser bar.',
      'Uygulama mağazası gerekmeden yüklenir ve bir uygulama gibi açılır: çevrimdışı, tam ekran, tarayıcı çubuğu olmadan.')}</p>
    <ol class="steps">
      ${steps.map((t, i) => `<li><i>${i + 1}</i><span>${t}</span></li>`).join('')}
    </ol>
    <button class="btn btn-ink btn-block" data-act="sheet-close" type="button">${L('باشه', 'Got it', 'Tamam')}</button>`,
  { label: L('نصب', 'Install', 'Yükle') });
}
