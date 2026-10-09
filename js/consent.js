/* The cookie sheet: one question, asked once.

   Yes  -> the server sets tf_c=1 (a year) and, from then on, each page view
           carries a short device line (js/device.js) that the back office
           counts by day: phone or computer, brand, system, browser,
           installed or not, language. No names, numbers or places.
   No   -> tf_c=0 (six months). The shop works exactly the same; page views
           are still counted the anonymous way they always were.
   Swiped away without an answer -> asked again on the next visit, not this one.

   The cookie is set by the server (api/consent.php), not here: Safari keeps
   script-written cookies for seven days only, so the sheet would come back
   every week. Profile -> «کوکی‌ها و حریم خصوصی» opens it again any time. */
import { openSheet, closeSheet, toast } from './ui.js';
import { icon } from './icons.js';
import { L } from './i18n.js';
import { deviceLine, sharpenBrand } from './device.js';

const LATER = 'tiffany.consent.later';

/** 'yes', 'no', or null when this browser has not answered yet. */
export function consent() {
  const m = document.cookie.match(/(?:^|;\s*)tf_c=([01])(?:;|$)/);
  return m ? (m[1] === '1' ? 'yes' : 'no') : null;
}
export const consented = () => consent() === 'yes';

export function needsConsent() {
  if (consent()) return false;
  try { return !sessionStorage.getItem(LATER); } catch { return true; }
}

async function answer(c) {
  if (c === 'yes') await sharpenBrand();
  try {
    const r = await fetch('api/consent.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c === 'yes' ? { c, d: deviceLine() } : { c }),
      credentials: 'same-origin',
    });
    if (r.ok && consent()) return;
  } catch { /* offline: fall through */ }
  /* The server could not be reached: remember the answer here instead, so
     the question does not come straight back. */
  const days = c === 'yes' ? 365 : 182;
  document.cookie = `tf_c=${c === 'yes' ? 1 : 0}; Max-Age=${days * 86400}; Path=/; SameSite=Lax`
    + (location.protocol === 'https:' ? '; Secure' : '');
}

const ITEMS = () => [
  ['device', L('نوع دستگاه و برند گوشی', 'Device type and phone brand', 'Cihaz türü ve telefon markası'),
    L('مثلاً آیفون یا سامسونگ', 'e.g. iPhone or Samsung', 'örneğin iPhone ya da Samsung')],
  ['globe', L('سیستم‌عامل و مرورگر', 'System and browser', 'İşletim sistemi ve tarayıcı'),
    L('مثلاً iOS و سافاری', 'e.g. iOS and Safari', 'örneğin iOS ve Safari')],
  ['download', L('اپ یا مرورگر، و زبان سایت', 'App or browser, and site language', 'Uygulama mı tarayıcı mı, site dili'),
    L('اینکه سایت رو از صفحه‌ی اصلی گوشیت باز کردی یا نه',
      'whether you opened the shop from your home screen',
      'mağazayı ana ekranından açıp açmadığın')],
];

/**
 * Open the sheet. `then` runs after it closes, answered or not.
 * `settings` is the profile row: it shows the current answer and says so
 * when it changes.
 */
export function askConsent({ then, settings = false } = {}) {
  const now = consent();
  let answered = false;
  const status = settings && now ? `
    <p class="pop-status">${icon(now === 'yes' ? 'check' : 'lock', 15)}<span>${now === 'yes'
      ? L('الان: قبول کردی', 'Right now: accepted', 'Şu an: kabul edildi')
      : L('الان: فقط ضروری‌ها', 'Right now: essentials only', 'Şu an: yalnızca gerekli olanlar')}</span></p>` : '';

  openSheet(`
    <div class="pop-badge" aria-hidden="true">${icon('shield', 24)}</div>
    <h2>${L('کوکی‌ها و اطلاعات دستگاه', 'Cookies and device info', 'Çerezler ve cihaz bilgisi')}</h2>
    ${status}
    <p class="lede">${L(
      'با اجازه‌ت، چند تا اطلاعات کلی از دستگاهت ثبت می‌کنیم تا بدونیم سایت روی چه گوشی‌هایی باز می‌شه و بهترش کنیم.',
      'With your OK, we note a few general details about your device, so we know which phones open the shop and can make it better.',
      'İzin verirsen cihazınla ilgili birkaç genel bilgiyi kaydederiz; böylece mağazanın hangi telefonlarda açıldığını görür ve siteyi iyileştiririz.')}</p>
    <ul class="pop-list">
      ${ITEMS().map(([ico, t, s]) => `<li>${icon(ico, 19)}<span><b>${t}</b><small>${s}</small></span></li>`).join('')}
    </ul>
    <p class="pop-note">${icon('lock', 15)}<span>${L(
      'اسم، شماره، آدرس و موقعیت مکانیت ثبت نمی‌شه. همه‌چی ناشناسه و فقط به‌صورت آمار کلی دیده می‌شه.',
      'Your name, number, address and location are never recorded. It is all anonymous and only seen as totals.',
      'Adın, numaran, adresin ve konumun kaydedilmez. Hepsi anonimdir ve yalnızca toplam olarak görülür.')}</span></p>
    <details class="pop-more">
      <summary>${L('بیشتر بدونم', 'Tell me more', 'Daha fazla bilgi')}${icon('chevD', 14)}</summary>
      <p>${L(
        'فقط یه کوکی کوچیک به اسم <b dir="ltr">tf_c</b> روی گوشیت می‌مونه که جوابت رو یادش بمونه. سبد، ذخیره‌شده‌ها و اندازه‌هات مثل قبل فقط روی گوشی خودت می‌مونه. هر وقت خواستی از «پروفایل ← کوکی‌ها و حریم خصوصی» نظرت رو عوض کن.',
        'Just one small cookie, <b>tf_c</b>, stays on your phone to remember your answer. Your bag, saved pieces and measurements stay on your own phone, as before. Change your mind any time from Profile → Cookies and privacy.',
        'Cevabını hatırlamak için telefonunda yalnızca <b>tf_c</b> adlı küçük bir çerez kalır. Sepetin, kaydettiklerin ve ölçülerin eskisi gibi yalnızca kendi telefonunda kalır. Fikrini istediğin zaman Profil → Çerezler ve gizlilik bölümünden değiştirebilirsin.')}</p>
    </details>
    <div class="pop-acts">
      <button class="btn btn-ink btn-block" data-consent="yes" type="button">${L('قبول دارم', 'Accept', 'Kabul et')}</button>
      <button class="btn btn-quiet btn-block" data-consent="no" type="button">${L('فقط ضروری‌ها', 'Essentials only', 'Yalnızca gerekli olanlar')}</button>
    </div>`,
  {
    label: L('کوکی‌ها', 'Cookies', 'Çerezler'),
    cls: 'pop pop-consent',
    calm: true,
    onMount(sheet) {
      sheet.querySelectorAll('[data-consent]').forEach((b) => b.addEventListener('click', async () => {
        const c = b.dataset.consent;
        answered = true;
        sheet.querySelectorAll('[data-consent]').forEach((x) => { x.disabled = true; });
        await answer(c);
        closeSheet();
        if (settings) {
          toast(c === 'yes'
            ? L('ممنون! ذخیره شد', 'Thanks — saved', 'Teşekkürler, kaydedildi')
            : L('باشه، فقط ضروری‌ها', 'Done — essentials only', 'Tamam, yalnızca gerekli olanlar'), 'check');
          document.dispatchEvent(new CustomEvent('view:refresh'));
        }
      }));
    },
    onClose() {
      /* Once per visit at most, answered or not (a browser that blocks
         cookies outright would otherwise be asked on every page). */
      if (!settings) {
        try { sessionStorage.setItem(LATER, answered ? 'answered' : 'later'); } catch { /* private mode */ }
      }
      if (then) setTimeout(then, 0);
    },
  });
}
