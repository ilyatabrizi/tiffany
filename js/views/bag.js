/* The bag, and the checkout that empties it.

   With online ordering switched on in the back office, checkout sends the
   order to /api/order.php, paid by card on delivery or — when the CEO has it
   switched on — by card-to-card right away through «تأیید شد» (js/pay.js):
   the phone then goes to tayidshod's payment page.
   Switched off, checkout says so and points to Instagram and the stores; it
   never pretends an order went through. When the shop could not ask the
   server just now (a shaky connection), the order is still sent and the
   server decides. */
import { BRAND } from '../config.js';
import { getProduct, colourLabel, sizeLabel, isOneSize } from '../data.js';
import { icon } from '../icons.js';
import { esc, toman, num, tap } from '../util.js';
import {
  state, setQty, clearBag, addOrder, patch, LINE_MAX, ORDER_MAX,
} from '../store.js';
import { shot, empty, openSheet, closeSheet, toast } from '../ui.js';
import { go } from '../router.js';
import { L } from '../i18n.js';
import { live } from '../live.js';
import { payOptions, forgetOffer } from '../pay.js';
import { account, takeCredit, loadAccount } from '../account.js';
import { cbOn, pctText, minText, spending, setSpending, creditFor, earns } from '../credit.js';
import { provinceSelect, postalDigits, postalOk, mobileOk, fullNameOk, postLine } from '../post.js';

export const subtotal = () => state.bag.reduce((n, l) => {
  const p = getProduct(l.id);
  return n + (p ? p.price * l.qty : 0);
}, 0);

/* Pieces that are still in the shop; a line whose piece is gone counts for
   nothing and shows as «no longer available» with a way to take it out. */
const liveLines = () => state.bag.filter((l) => getProduct(l.id));
const pieces = () => liveLines().reduce((n, l) => n + l.qty, 0);

/* Free on every order since 2026-10-07; BRAND.shipping is the one knob. */
const shippingFor = (sub) => (sub === 0 ? 0 : BRAND.shipping);

/** «M — سفید»: the size code stays Latin, the colour reads in this language. */
export const lineOpt = (p, l) =>
  `${isOneSize(l.size) ? esc(sizeLabel(l.size)) : `<span dir="ltr">${esc(l.size)}</span>`} — ${esc(
    p.colours?.length ? colourLabel(p, l.colour) : (l.colourName || l.colour))}`;

/* With credit spent, the last line is what is left to pay. */
const totals = (sub, ship, credit = 0) => `
  <div class="totals">
    <div class="trow"><span>${esc(L('جمع', 'Subtotal', 'Ara toplam'))}</span><b>${toman(sub)}</b></div>
    <div class="trow"><span>${esc(L('ارسال', 'Delivery', 'Teslimat'))}</span><b>${ship ? toman(ship) : esc(L('رایگان', 'Free', 'Ücretsiz'))}</b></div>
    ${credit > 0 ? `<div class="trow credit"><span>${esc(L('اعتبار تیفانی', 'TIFFANY credit', 'TIFFANY kredisi'))}</span><b>−${toman(credit)}</b></div>` : ''}
    <div class="trow big"><span>${esc(credit > 0 ? L('مبلغ قابل پرداخت', 'To pay', 'Ödenecek') : L('مبلغ کل', 'Total', 'Toplam'))}</span><b>${toman(sub + ship - credit)}</b></div>
  </div>`;
export { totals };

/* ---------------------------------------------------------------- cashback */
/** Above the lines: how far to the cashback, or what this bag earns. */
function cashbackNote(gross, credit) {
  if (!cbOn()) return '';
  const min = live.cashback.min;
  if (gross < min) {
    const left = min - gross;
    return `
    <div class="cbnote">
      ${icon('gift', 18)}
      <div>
        <b>${esc(L(`${toman(left)} دیگه تا ${pctText()} اعتبار برگشتی`,
    `${toman(left)} more for ${pctText()} cashback`,
    `${toman(left)} daha alışveriş yap, ${pctText()} kredi kazan`))}</b>
        <span>${esc(L(`خریدهای ${minText()} به بالا، ${pctText()} مبلغ پرداختی رو به‌صورت اعتبار به حسابت برمی‌گردونن.`,
    `Orders of ${minText()} or more give ${pctText()} of what you pay back as credit to your account.`,
    `${minText()} ve üzeri siparişlerde ödenen tutarın ${pctText()} kadarı hesabına kredi olarak eklenir.`))}</span>
        <i class="cbbar" style="--p:${Math.max(4, Math.min(100, Math.round((gross / min) * 100)))}%"></i>
      </div>
    </div>`;
  }
  const back = earns(gross, credit);
  if (!back) return '';
  if (!account.user) {
    return `
    <div class="cbnote on">
      ${icon('gift', 18)}
      <div>
        <b>${esc(L(`این خرید ${toman(back)} اعتبار برگشتی داره`, `This order earns ${toman(back)} cashback`,
    `Bu sipariş ${toman(back)} kredi kazandırır`))}</b>
        <span>${esc(L('برای گرفتنش، قبل از خرید وارد حسابت شو یا یه حساب بساز.',
    'Sign in or create an account before checkout to get it.',
    'Almak için ödemeden önce giriş yap ya da hesap oluştur.'))}</span>
        <span class="cbacts">
          <button class="btn btn-ink btn-s" data-act="signin" type="button">${esc(L('ورود', 'Sign in', 'Giriş yap'))}</button>
          <button class="btn btn-line btn-s" data-act="signup" type="button">${esc(L('ساخت حساب', 'Create account', 'Hesap oluştur'))}</button>
        </span>
      </div>
    </div>`;
  }
  return `
    <div class="cbnote on">
      ${icon('gift', 18)}
      <div>
        <b>${esc(L(`این خرید ${toman(back)} اعتبار برگشتی داره`, `This order earns ${toman(back)} cashback`,
    `Bu sipariş ${toman(back)} kredi kazandırır`))}</b>
        <span>${esc(L('بعد از تحویل سفارش به حسابت اضافه می‌شه و توی خرید بعدی همین‌جا ازش استفاده می‌کنی.',
    'It is added to your account once the order is delivered, and comes off your next order right here.',
    'Sipariş teslim edilince hesabına eklenir; sonraki siparişinde burada kullanırsın.'))}</span>
      </div>
    </div>`;
}

/** Signed in with credit: the switch that spends it on this order. */
function creditSwitch() {
  const have = account.user ? account.credit.balance : 0;
  if (have <= 0) return '';
  const on = spending();
  return `
    <button class="cbswitch" data-credit type="button" role="switch" aria-checked="${on}">
      ${icon('gift', 18)}
      <span><b>${esc(L('استفاده از اعتبار تیفانی', 'Use my TIFFANY credit', 'TIFFANY kredimi kullan'))}</b>
        <span>${esc(L(`${toman(have)} اعتبار داری`, `You have ${toman(have)}`, `${toman(have)} kredin var`))}</span></span>
      <i class="knob" aria-hidden="true"></i>
    </button>`;
}

function lineHTML(l) {
  const p = getProduct(l.id);
  if (!p) {
    return `
  <div class="line line-gone" data-line="${esc(l.id)}|${esc(l.size)}|${esc(l.colour)}">
    <span class="shot"></span>
    <div>
      <div class="line-name">${esc(L('این قطعه دیگه موجود نیست', 'This piece is no longer available', 'Bu parça artık mevcut değil'))}</div>
      <div class="line-foot">
        <button class="btn btn-line btn-s" data-qty="-99" type="button">${esc(L('برداشتن از سبد', 'Remove', 'Sepetten çıkar'))}</button>
      </div>
    </div>
  </div>`;
  }
  return `
  <div class="line" data-line="${esc(l.id)}|${esc(l.size)}|${esc(l.colour)}">
    <button class="shot" data-act="product" data-id="${p.id}" type="button">
      <img ${shot(p.img, '78px')} alt="${esc(p.name)}" loading="lazy" decoding="async"
           width="480" height="600">
    </button>
    <div>
      <div class="line-name">${esc(p.name)}</div>
      <div class="line-opt">${lineOpt(p, l)}</div>
      <div class="line-foot">
        <div class="stepper">
          <button data-qty="-1" type="button" aria-label="${esc(L('یکی کمتر', 'One fewer', 'Bir azalt'))}">${icon('minus', 15)}</button>
          <b>${num(l.qty)}</b>
          <button data-qty="1" type="button" aria-label="${esc(L('یکی بیشتر', 'One more', 'Bir artır'))}">${icon('plus', 15)}</button>
        </div>
        <span class="line-price">${toman(p.price * l.qty)}</span>
      </div>
    </div>
  </div>`;
}

const ORDER_ERR = {
  name: () => L('اسم و فامیل رو کامل بنویس.', 'Please give your first and last name.', 'Lütfen adını ve soyadını yaz.'),
  phone: () => L('شماره موبایل درست نیست.', 'That mobile number does not look right.', 'Cep numarası doğru görünmüyor.'),
  province: () => L('استان رو انتخاب کن.', 'Please choose your province.', 'Lütfen ilini seç.'),
  city: () => L('شهر رو بنویس.', 'Please add your city.', 'Lütfen şehrini yaz.'),
  address: () => L('آدرس کامل رو بنویس: خیابون، کوچه، پلاک و واحد.', 'Please give your full address: street, building and unit.',
    'Lütfen açık adresini yaz: sokak, bina ve daire.'),
  postal: () => L('کد پستی ۱۰ رقمی رو درست بنویس.', 'Please give your 10-digit postal code.', 'Lütfen 10 haneli posta kodunu yaz.'),
  pay: () => L('کارت‌به‌کارت همین الان در دسترس نیست؛ «کارت، موقع تحویل» رو انتخاب کن.',
    'Card-to-card is not available right now — please choose card on delivery.',
    'Kartla havale şu an kullanılamıyor; lütfen kapıda kartı seç.'),
  credit: () => L('برای استفاده از اعتبار اول وارد حسابت شو.', 'Sign in first to use your credit.',
    'Kredini kullanmak için önce giriş yap.'),
  credit_changed: () => L('اعتبار حسابت همین الان تغییر کرده؛ مبلغ جدید رو توی سبد ببین و دوباره ثبت کن.',
    'Your credit has just changed — check the new amount in the bag and place the order again.',
    'Kredin az önce değişti; sepetteki yeni tutara bak ve siparişi yeniden ver.'),
};

/** What to tell the customer when the server says no. */
function orderError(status, j) {
  if (status === 403 && j.error === 'closed') {
    return L('خرید آنلاین الان بسته‌ست؛ از شعبه‌ها یا اینستاگرام سفارش بده.',
      'Online ordering is closed right now — order in store or on Instagram.',
      'Online sipariş şu an kapalı; mağazadan ya da Instagram’dan sipariş ver.');
  }
  if (status === 429) return L('چند دقیقه دیگه دوباره امتحان کن.', 'Please try again in a few minutes.', 'Birkaç dakika sonra tekrar dene.');
  if (status === 403 && j.error === 'csrf') {
    return L('حسابت نیاز به ورود دوباره داره؛ یه بار خارج شو و دوباره وارد شو.',
      'Your sign-in needs refreshing — sign out and in again.',
      'Oturumunun yenilenmesi gerekiyor; çıkış yapıp tekrar giriş yap.');
  }
  if (status === 422 && j.field === 'pending') {
    return L('برای این شماره چند سفارش منتظر تأییده؛ تیم تیفانی به‌زودی باهات تماس می‌گیره.',
      'A few orders from this number are still waiting to be confirmed — the TIFFANY team will call you shortly.',
      'Bu numaradan birkaç sipariş onay bekliyor; TIFFANY ekibi kısa süre içinde seni arayacak.');
  }
  if (status === 422 && j.field === 'count') {
    return L(`از هر قطعه حداکثر ${num(LINE_MAX)} تا و توی هر سفارش حداکثر ${num(ORDER_MAX)} قطعه.`,
      `Up to ${LINE_MAX} of a piece and ${ORDER_MAX} pieces per order.`,
      `Bir parçadan en fazla ${LINE_MAX}, siparişte en fazla ${ORDER_MAX} adet.`);
  }
  if (status === 422 && ORDER_ERR[j.field]) return ORDER_ERR[j.field]();
  if (status === 422 && j.field === 'items') {
    return L(j.message || 'یکی از قطعه‌های سبدت دیگه موجود نیست.',
      'One of the pieces in your bag is no longer available in that size.',
      'Sepetindeki parçalardan biri o bedende artık yok.');
  }
  return L('سفارش ثبت نشد؛ دوباره امتحان کن.', 'The order did not go through — please try again.', 'Sipariş alınamadı; tekrar dene.');
}

/* While online ordering is switched off: say so plainly, keep the bag, and
   point to where an order can be placed today. */
function closedSheet() {
  openSheet(`
    <h2>${esc(L('خرید آنلاین به‌زودی', 'Online ordering opens soon', 'Online sipariş yakında'))}</h2>
    <p class="lede">${esc(L(
    'سفارش آنلاین هنوز باز نشده. تا اون موقع می‌تونی از اینستاگرام یا شعبه‌های تیفانی سفارش بدی؛ سبدت همین‌جا می‌مونه.',
    'Online ordering is not open yet. Until then you can order on Instagram or at a TIFFANY store — your bag stays right here.',
    'Online sipariş henüz açılmadı. O zamana kadar Instagram’dan ya da TIFFANY mağazalarından sipariş verebilirsin; sepetin burada kalır.'))}</p>
    <div style="height:6px"></div>
    <a class="btn btn-ink btn-block" href="${esc(BRAND.instagramUrl)}" target="_blank" rel="noopener">${esc(L('سفارش از اینستاگرام', 'Order on Instagram', 'Instagram’dan sipariş ver'))}</a>
    <div style="height:9px"></div>
    <button class="btn btn-line btn-block" data-act="nav" data-to="/contact" type="button">${esc(L('شعبه‌ها و تماس', 'Stores and contact', 'Mağazalar ve iletişim'))}</button>
    <div style="height:9px"></div>
    <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${esc(L('بستن', 'Close', 'Kapat'))}</button>`,
  { label: L('خرید آنلاین به‌زودی', 'Online ordering opens soon', 'Online sipariş yakında') });
}

/* One order on its way to the server at a time, whichever sheet sent it:
   closing the sheet mid-request and checking out again must not order twice. */
let placing = false;
let opening = false;

/* What the customer reads above the form, for the way they pay. */
const payLede = (pay) => (pay === 'c2c'
  ? L(`بعد از ثبت، می‌ری صفحه‌ی پرداخت «تأیید شد»: مبلغ رو از اپ بانکت کارت‌به‌کارت می‌کنی و «واریز کردم» رو می‌زنی. ارسال با پست، رایگان به سراسر ایران؛ نهایتاً ${num(live.deliveryDays)} روز کاری.`,
    `Next you go to the Tayid Shod payment page: transfer the amount from your bank app and tap «واریز کردم». Free delivery by Iran Post anywhere in Iran, ${live.deliveryDays} working days at most.`,
    `Sonra Tayid Shod ödeme sayfasına geçersin: tutarı banka uygulamandan havale edip «واریز کردم»a dokunursun. İran Postası ile İran'ın her yerine ücretsiz teslimat, en geç ${live.deliveryDays} iş günü.`)
  : L(`پرداخت با کارت موقع تحویل. ارسال با پست، رایگان به سراسر ایران؛ نهایتاً ${num(live.deliveryDays)} روز کاری.`,
    `Pay by card on delivery. Free delivery by Iran Post anywhere in Iran, ${live.deliveryDays} working days at most.`,
    `Teslimatta kartla ödeme. İran Postası ile İran'ın her yerine ücretsiz teslimat, en geç ${live.deliveryDays} iş günü.`));
const payButton = (pay) => (pay === 'c2c'
  ? L('ثبت سفارش و پرداخت', 'Place order and pay', 'Siparişi ver ve öde')
  : L('ثبت سفارش', 'Place order', 'Siparişi ver'));
/* Credit that covers the whole order: nothing to pay, nothing to choose. */
const creditLede = () => L(`کل مبلغ با اعتبار تیفانیت پرداخت می‌شه. ارسال با پست، رایگان به سراسر ایران؛ نهایتاً ${num(live.deliveryDays)} روز کاری.`,
  `Your TIFFANY credit covers all of it. Free delivery by Iran Post anywhere in Iran, ${live.deliveryDays} working days at most.`,
  `Tutarın tamamı TIFFANY kredinle ödenir. İran Postası ile İran'ın her yerine ücretsiz teslimat, en geç ${live.deliveryDays} iş günü.`);

/** Under the checkout totals: the cashback this order earns. */
function cashbackLine(gross, credit) {
  const back = earns(gross, credit);
  if (!back) return '';
  return account.user
    ? `<p class="cbline">${icon('gift', 16)}<span>${esc(L(`${toman(back)} اعتبار برگشتی، بعد از تحویل سفارش به حسابت اضافه می‌شه.`,
      `${toman(back)} cashback, added to your account once the order is delivered.`,
      `${toman(back)} kredi, sipariş teslim edilince hesabına eklenir.`))}</span></p>`
    : `<p class="cbline">${icon('gift', 16)}<span>${esc(L(`با ورود به حسابت قبل از ثبت سفارش، ${toman(back)} اعتبار برگشتی می‌گیری.`,
      `Sign in before you order to get ${toman(back)} cashback.`,
      `Sipariş vermeden önce giriş yaparsan ${toman(back)} kredi kazanırsın.`))}</span>
      <button class="link-more" data-act="signin" type="button">${esc(L('ورود', 'Sign in', 'Giriş yap'))}</button></p>`;
}

/* With the store switched on (back office → Settings), the order goes to the
   shop for real: the server prices it, keeps it and the team sees it in the
   panel. */
async function checkoutSheet() {
  if (live.fresh && !live.storeOpen) { closedSheet(); return; }
  if (opening) return;
  opening = true;
  const offer = await payOptions().finally(() => { opening = false; });
  const sub = subtotal();
  const ship = shippingFor(sub);
  const gross = sub + ship;
  const credit = creditFor(gross);
  const free = gross > 0 && credit >= gross;
  const { profile, address } = state;
  /* Card-to-card first when it is on: paid now, nothing to collect at the door. */
  let pay = offer.c2c && !free ? 'c2c' : 'card';

  openSheet(`
    <h2>${esc(L('تکمیل خرید', 'Checkout', 'Ödeme'))}</h2>
    <p class="lede" id="coLede">${esc(free ? creditLede() : payLede(pay))}</p>

    <form id="coForm" novalidate>
      <p class="eyebrow" style="margin:18px 0 10px">${esc(L('برای کی', 'Who it is for', 'Kimin için'))}</p>
      <div class="field"><label for="coName">${esc(L('اسم و فامیل', 'Full name', 'Ad soyad'))}</label>
        <input id="coName" name="name" autocomplete="name" value="${esc(profile.name)}" required></div>
      <div class="field"><label for="coPhone">${esc(L('شماره موبایل', 'Phone', 'Telefon'))}</label>
        <input id="coPhone" name="phone" inputmode="tel" autocomplete="tel" dir="ltr"
               placeholder="${L('۰۹۱۲ ۰۰۰ ۰۰۰۰', '0912 000 0000', '0912 000 0000')}" value="${esc(profile.phone)}" required></div>

      <p class="eyebrow" style="margin:20px 0 10px">${esc(L('کجا بفرستیم', 'Where it goes', 'Nereye gönderelim'))}</p>
      <p class="post-note">${icon('truck', 16)}<span>${esc(postLine())}</span></p>
      <div class="field-row">
        <div class="field"><label for="coProvince">${esc(L('استان', 'Province', 'İl'))}</label>
          ${provinceSelect('coProvince', address.province)}</div>
        <div class="field"><label for="coCity">${esc(L('شهر', 'City', 'Şehir'))}</label>
          <input id="coCity" name="city" autocomplete="address-level2"
                 value="${esc(address.city)}" required></div>
      </div>
      <div class="field"><label for="coLine">${esc(L('آدرس کامل', 'Full address', 'Açık adres'))}</label>
        <textarea id="coLine" name="line" autocomplete="street-address"
                  placeholder="${esc(L('خیابون، کوچه، پلاک، واحد', 'Street, lane, building, unit', 'Cadde, sokak, bina, daire'))}" required>${esc(address.line)}</textarea></div>
      <div class="field"><label for="coPostal">${esc(L('کد پستی ۱۰ رقمی', '10-digit postal code', '10 haneli posta kodu'))}</label>
        <input id="coPostal" name="postal" inputmode="numeric" dir="ltr" maxlength="14"
               autocomplete="postal-code" placeholder="0000000000" value="${esc(address.postal)}" required>
        <p class="tiny field-hint">${esc(L('پست بدون کد پستی بسته رو نمی‌فرسته؛ روی قبض برق یا گاز خونه نوشته شده.',
    'Iran Post needs it on the parcel; it is printed on your electricity or gas bill.',
    'İran Postası koliye bunu yazar; elektrik ya da doğalgaz faturanda yazılıdır.'))}</p></div>
      <div class="field"><label for="coNote">${esc(L('توضیح برای ارسال (اختیاری)', 'Delivery note (optional)', 'Teslimat notu (isteğe bağlı)'))}</label>
        <input id="coNote" name="note" maxlength="300" value=""
               placeholder="${esc(L('مثلاً: زنگ واحد ۴ خرابه، به موبایل زنگ بزنید', 'e.g. unit 4’s bell is broken, call me', 'örn. 4 nolu zil bozuk, beni arayın'))}"></div>
      <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>

      <p class="eyebrow" style="margin:20px 0 10px">${esc(L('پرداخت', 'Payment', 'Ödeme yöntemi'))}</p>
      ${free ? `<p class="cbline">${icon('gift', 16)}<span>${esc(L('با اعتبار تیفانی', 'With TIFFANY credit', 'TIFFANY kredisiyle'))}</span></p>` : `
      <div class="sizes" id="coPay" role="radiogroup" aria-label="${esc(L('پرداخت', 'Payment', 'Ödeme yöntemi'))}">
        ${offer.c2c ? `<button class="chip ${pay === 'c2c' ? 'on' : ''}" data-pay="c2c" type="button" role="radio" aria-checked="${pay === 'c2c'}">${icon('card', 15)}${esc(L('کارت‌به‌کارت، همین الان', 'Card-to-card, now', 'Kartla havale, şimdi'))}${offer.test ? ` · ${esc(L('آزمایشی', 'test', 'test'))}` : ''}</button>` : ''}
        <button class="chip ${pay === 'card' ? 'on' : ''}" data-pay="card" type="button" role="radio" aria-checked="${pay === 'card'}">${icon('truck', 15)}${esc(L('کارت، موقع تحویل', 'Card, on delivery', 'Kapıda kart'))}</button>
        ${offer.c2c ? '' : `<button class="chip" type="button" disabled aria-disabled="true">${icon('lock', 15)}${esc(L('پرداخت آنلاین · به‌زودی', 'Pay online · soon', 'Online ödeme · yakında'))}</button>`}
      </div>`}

      ${totals(sub, ship, credit)}
      ${cashbackLine(gross, credit)}

      <button class="btn btn-ink btn-block" type="submit">${esc(payButton(pay))}</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${esc(L('فعلاً نه', 'Not yet', 'Şimdi değil'))}</button>
    </form>`,
  {
    label: L('تکمیل خرید', 'Checkout', 'Ödeme'),
    onMount(sheet) {
      const choose = (to) => {
        pay = to;
        sheet.querySelectorAll('[data-pay]').forEach((b) => {
          b.classList.toggle('on', b.dataset.pay === to);
          b.setAttribute('aria-checked', String(b.dataset.pay === to));
        });
        sheet.querySelector('#coLede').textContent = payLede(to);
        sheet.querySelector('#coForm [type="submit"]').textContent = payButton(to);
      };
      sheet.querySelector('#coPay')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pay]');
        if (b && !b.disabled) { tap(); choose(b.dataset.pay); }
      });
      /* The server said card-to-card is not on offer after all: take it away
         and leave the customer on card on delivery. */
      const dropC2c = () => {
        forgetOffer();
        sheet.querySelector('[data-pay="c2c"]')?.remove();
        choose('card');
      };
      sheet.querySelector('#coForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (placing) {
          toast(L('سفارشت داره ثبت می‌شه…', 'Your order is on its way…', 'Siparişin gönderiliyor…'), 'info');
          return;
        }
        const form = e.target;
        const f = new FormData(form);
        const get = (k) => String(f.get(k) || '').trim();
        /* What the post office needs, checked here first; the field that is
           wrong is pointed at, and the server checks it all again. */
        const wrong = [
          ['coName', 'name', !fullNameOk(get('name'))],
          ['coPhone', 'phone', !mobileOk(get('phone'))],
          ['coProvince', 'province', !get('province')],
          ['coCity', 'city', get('city').length < 2],
          ['coLine', 'address', get('line').length < 10],
          ['coPostal', 'postal', !postalOk(get('postal'))],
        ].find((x) => x[2]);
        form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
        if (wrong) {
          const el = form.querySelector(`#${wrong[0]}`);
          el.setAttribute('aria-invalid', 'true');
          el.focus();
          toast(ORDER_ERR[wrong[1]](), 'info', 3600);
          return;
        }
        patch('profile', { name: get('name'), phone: get('phone') });
        patch('address', { line: get('line'), city: get('city'), province: get('province'), postal: postalDigits(get('postal')) });

        if (state.bag.some((l) => !getProduct(l.id))) {
          toast(L('اول قطعه‌هایی که دیگه موجود نیستن رو از سبد بردار.',
            'Please remove the pieces that are no longer available first.',
            'Önce artık mevcut olmayan parçaları sepetten çıkar.'), 'info', 3600);
          return;
        }

        let placed;
        /* What is sent is what is kept: a copy taken now, not the bag as it is
           when the answer comes back. */
        const lines = state.bag.map((l) => ({ ...l }));
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        placing = true;
        const ctl = new AbortController();
        /* Card-to-card waits on tayidshod too (at most ~15 s there): 45 s
           before the phone gives up, so a slow answer is not taken for a
           failed order and placed twice. */
        const giveUp = setTimeout(() => ctl.abort(), 45000);
        try {
          const r = await fetch('api/order.php', {
            method: 'POST',
            signal: ctl.signal,
            credentials: 'same-origin',
            /* Signed in, the order is the account's (cashback); spending its
               credit takes the account's CSRF token too. */
            headers: { 'Content-Type': 'application/json', ...(account.csrf ? { 'X-CSRF': account.csrf } : {}) },
            body: JSON.stringify({
              items: lines.map(({ id, size, colour, qty }) => ({ id, size, colour, qty })),
              name: get('name'), phone: get('phone'), province: get('province'), city: get('city'),
              address: get('line'), postal: postalDigits(get('postal')), note: get('note'), website: get('website'), pay,
              use_credit: credit > 0,
              ...(credit > 0 ? { expect_balance: account.credit.balance } : {}),
            }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.ok) {
            if (j.error === 'closed') live.storeOpen = false;
            if (j.field === 'pay') dropC2c();
            toast(orderError(r.status, j), 'info', 4200);
            /* The account's credit moved (another phone, a return), or the
               shop no longer knows this phone as signed in: fetch the account
               again and redraw the bag with what is true now. */
            if (j.field === 'credit_changed' || j.field === 'credit') {
              closeSheet();
              loadAccount().finally(() => document.dispatchEvent(new CustomEvent('bag:changed')));
            }
            return;
          }
          if (j.balance) takeCredit(j.balance);
          placed = {
            code: j.code, placed: j.created_at * 1000, pay: ['c2c', 'credit'].includes(j.pay) ? j.pay : 'card',
            subtotal: j.subtotal, shipping: j.shipping, total: j.total,
            credit: Number(j.credit) || 0, cashback: Number(j.cashback) || 0,
            server: true, status: j.status, phone: get('phone'), lines: j.items || [],
          };
          if (placed.pay === 'c2c') Object.assign(placed, { payKey: j.pay_key, payState: 'pending', paid: false, payUrl: j.pay_url });
          if (pay === 'c2c' && placed.pay === 'card') { placed.fellBack = true; forgetOffer(); }
        } catch {
          toast(L('اینترنت وصل نیست؟ دوباره امتحان کن.', 'No connection? Please try again.', 'Bağlantı yok mu? Tekrar dene.'), 'info');
          return;
        } finally {
          clearTimeout(giveUp);
          placing = false;
          btn.disabled = false;
        }
        /* Each line keeps what it was sold as — name, photo, colour and the
           price the server charged — so the order reads the same after the
           catalogue moves. */
        const charged = placed.lines;
        const { payUrl, fellBack } = placed;
        delete placed.lines;
        delete placed.payUrl;
        delete placed.fellBack;
        addOrder({
          ...placed,
          items: lines.map((l) => {
            const p = getProduct(l.id);
            const s = charged.find((x) => x.id === l.id && x.size === l.size && x.colour === l.colour);
            return {
              ...l, name: p?.name || '', img: p?.img || '', price: s?.price || p?.price || 0,
              colourName: p ? colourLabel(p, l.colour) : '',
            };
          }),
          address: { ...state.address },
          step: 0,
        });
        clearBag();
        tap(18);
        closeSheet();
        document.dispatchEvent(new CustomEvent('bag:changed'));
        go('/orders');
        const code = placed.code;
        /* Card-to-card: on to tayidshod's page. The Orders tab stays behind
           it in the history, so the phone's back gesture lands there. */
        if (placed.pay === 'c2c' && payUrl) {
          toast(L(`سفارش ⁦${code}⁩ ثبت شد؛ می‌ریم صفحه‌ی پرداخت…`, `Order ${code} placed — on to the payment page…`,
            `${code} numaralı sipariş alındı; ödeme sayfasına geçiliyor…`), 'check', 3200);
          setTimeout(() => { location.assign(payUrl); }, 700);
          return;
        }
        setTimeout(() => toast(fellBack
          ? L(`سفارش ⁦${code}⁩ ثبت شد. کارت‌به‌کارت همین الان در دسترس نبود؛ موقع تحویل با کارت پرداخت کن.`,
            `Order ${code} placed. Card-to-card was not available just now — please pay by card on delivery.`,
            `${code} numaralı sipariş alındı. Kartla havale şu an kullanılamadı; teslimatta kartla öde.`)
          : L(`سفارش ⁦${code}⁩ ثبت شد`, `Order ${code} placed`, `${code} numaralı sipariş alındı`),
        fellBack ? 'info' : 'check', fellBack ? 6500 : 3200), 260);
      });
    },
  });
}

export default {
  tab: 'bag',
  title: L('سبد', 'Bag', 'Sepet'),
  topbarAt: 20,

  render() {
    const h1 = `<h1 class="serif" style="font-size:30px">${esc(L('سبد', 'Bag', 'Sepet'))}</h1>`;
    if (!state.bag.length) {
      return `<div class="wrap"><div class="topgap"></div>${h1}</div>
        ${empty('bag', L('سبدت خالیه', 'Nothing in the bag yet', 'Sepetin henüz boş'), '',
          `<button class="btn btn-ink btn-s" data-act="nav" data-to="/shop" type="button">${esc(L('بریم خرید', 'Start shopping', 'Alışverişe başla'))}</button>`)}`;
    }

    const sub = subtotal();
    const ship = shippingFor(sub);
    const count = pieces();
    const credit = creditFor(sub + ship);

    return `
    <div class="wrap">
      <div class="topgap"></div>
      ${h1}
      <p class="lede" style="margin-bottom:6px">${esc(L(
        `${num(count)} قطعه توی سبدت.`,
        `${num(count)} item${count === 1 ? '' : 's'} in your bag.`,
        `Sepetinde ${num(count)} parça.`))}</p>

      <p class="shipnote">${icon('truck', 17)}<span>${esc(postLine())}</span></p>
      ${cashbackNote(sub + ship, credit)}

      <div style="height:8px"></div>
      ${state.bag.map(lineHTML).join('')}

      ${creditSwitch()}
      ${totals(sub, ship, credit)}

      <div style="height:14px"></div>
      <button class="btn btn-ink btn-block" data-act="checkout" type="button" ${count ? '' : 'disabled'}>
        ${esc(L('تکمیل خرید', 'Checkout', 'Ödemeye geç'))} — ${toman(sub + ship - credit)}</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="nav" data-to="/shop" type="button">
        ${esc(L('ادامه‌ی خرید', 'Keep looking', 'Alışverişe devam et'))}</button>
      <div style="height:30px"></div>
    </div>`;
  },

  mount(app, signal) {
    /* Ask early whether card-to-card is on, so checkout opens without a wait. */
    if (live.storeOpen && state.bag.length) payOptions().catch(() => {});
    app.addEventListener('click', (e) => {
      const q = e.target.closest('[data-qty]');
      if (q) {
        const row = q.closest('[data-line]');
        const [id, size, colour] = row.dataset.line.split('|');
        const line = state.bag.find((l) => l.id === id && l.size === size && l.colour === colour);
        if (!line) return;
        const step = Number(q.dataset.qty);
        if (!setQty(id, size, colour, line.qty + step)) {
          if (step > 0) {
            toast(L(`از هر قطعه حداکثر ${num(LINE_MAX)} تا و توی هر سفارش حداکثر ${num(ORDER_MAX)} قطعه.`,
              `Up to ${LINE_MAX} of a piece and ${ORDER_MAX} pieces per order.`,
              `Bir parçadan en fazla ${LINE_MAX}, siparişte en fazla ${ORDER_MAX} adet.`), 'info', 3200);
          }
          return;
        }
        tap();
        document.dispatchEvent(new CustomEvent('bag:changed'));
        document.dispatchEvent(new CustomEvent('view:refresh'));
        return;
      }
      if (e.target.closest('[data-credit]')) {
        tap();
        setSpending(!spending());
        document.dispatchEvent(new CustomEvent('view:refresh'));
        return;
      }
      if (e.target.closest('[data-act="checkout"]')) checkoutSheet();
    }, { signal });
  },
};
