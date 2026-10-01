/* Add to Home Screen.

   Chrome hands over a beforeinstallprompt event; iOS Safari never will, and
   that is where most of this audience lives — so the fallback is the actual
   three-step instruction, not a dead button. */
import { openSheet, toast } from './ui.js';

let deferred = null;

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => { deferred = null; toast('نصب شد', 'check'); });

export const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function promptInstall() {
  if (standalone()) { toast('همین الان هم نصب است', 'check'); return; }
  if (deferred) {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome !== 'accepted') toast('هر وقت خواستی از پروفایل اضافه‌اش کن');
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openSheet(`
    <h2>افزودن <span dir="ltr">TIFFANY</span> به صفحهٔ خانه</h2>
    <p class="lede">بدون هیچ فروشگاه اپی نصب می‌شود و مثل یک اپ باز می‌شود —
      آفلاین، تمام‌صفحه، بدون نوار مرورگر.</p>
    <ol class="steps">
      ${(ios ? [
        'توی نوار پایین سافاری، دکمهٔ هم‌رسانی را بزن.',
        'گزینهٔ <b dir="ltr">Add to Home Screen</b> را انتخاب کن.',
        'روی <b dir="ltr">Add</b> بزن — نشان برند روی صفحه‌ات می‌نشیند.',
      ] : [
        'منوی مرورگر (سه نقطه) را باز کن.',
        'گزینهٔ <b>نصب برنامه</b> یا <b>افزودن به صفحهٔ اصلی</b> را بزن.',
        'تأیید کن — نشان برند روی صفحه‌ات می‌نشیند.',
      ]).map((t, i) => `<li><i>${i + 1}</i><span>${t}</span></li>`).join('')}
    </ol>
    <button class="btn btn-ink btn-block" data-act="sheet-close" type="button">باشه</button>`,
  { label: 'نصب' });
}
