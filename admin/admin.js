/* TIFFANY — back office (پنل مدیریت).

   One page, hash-routed, talking to ../api/admin.php. Persian, right to left,
   built for a phone first: a bottom bar on the phone, a sidebar from 900px.

     #/            داشبورد — today, the money, what needs doing
     #/orders      سفارش‌ها — filter, open, move along, cancel
     #/products    محصولات — the catalogue; /new and /<id> edit one
     #/customers   مشتری‌ها — everyone who ordered; /<phone> one person
     #/tickets     تیکت‌ها — customers' questions; /<code> one thread, answered here
     #/stories     استوری‌ها — post a photo or video for 24 hours; the archive
     #/traffic     بازدید سایت
     #/settings    تنظیمات — the store switch, SMS, my password, the team

   Every value from the server goes through esc() before it touches HTML. */
import { canRecord, record, clock } from '../js/recorder.js';
import { LOOK_DEFS } from '../js/looks-data.js';

/* ---------------------------------------------------------------- basics */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = new Intl.NumberFormat('fa-IR');
const NF1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const num = (n) => NF.format(Math.round(Number(n) || 0));
const toman = (n) => `${num(n)} تومان`;
/** «۲۴٫۵ میلیون» — for tiles and axes; the full figure is always one tap away. */
function compact(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return `${NF1.format(v / 1e9)} میلیارد`;
  if (v >= 1e6) return `${NF1.format(v / 1e6)} میلیون`;
  if (v >= 1e4) return `${NF1.format(v / 1e3)} هزار`;
  return num(v);
}
const D_SHORT = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short' });
const D_LONG = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
const D_TIME = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const dayDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
function ago(ts) {
  const s = Math.round(Date.now() / 1000 - ts);
  if (s < 60) return 'همین الان';
  if (s < 3600) return `${num(s / 60)} دقیقه پیش`;
  if (s < 86400) return `${num(s / 3600)} ساعت پیش`;
  if (s < 172800) return 'دیروز';
  return D_SHORT.format(new Date(ts * 1000));
}
const img = (base, w = 480) => (base ? `../${base}-${w}.webp` : '');

/* ------------------------------------------------------------- the words */
const CATS = [['knit', 'بافت'], ['tee', 'تیشرت'], ['top', 'تاپ'], ['hoodie', 'هودی و سوشرت'],
  ['vest', 'وست'], ['shirt', 'شومیز'], ['trousers', 'شلوار'], ['skirts', 'دامن'], ['jacket', 'کاپشن'],
  ['cardigan', 'ژاکت'], ['accessories', 'اکسسوری'], ['shoes', 'کفش']];
const CAT = Object.fromEntries(CATS);
const COLS = [['', 'بدون کالکشن'],
  ['aw27-pink-mohair', 'Pink Mohair'],
  ['aw27-pink-fleece', 'Pink Fleece'],
  ['aw27-black-leather', 'Black Leather'],
  ['aw27-denim-red', 'Denim & Red'],
  ['aw27-aubergine', 'Aubergine'],
  ['aw27-brown-leather', 'Brown Leather'],
  ['aw27-grey-pink', 'Grey & Pink'],
  ['aw27-grey-red', 'Grey & Red'],
  ['aw27-olive-brown', 'Olive & Brown'],
  ['aw27-chocolate-wool', 'Chocolate Wool'],
  ['aw27-olive-khaki', 'Olive & Khaki']];
const COL_NAME = Object.fromEntries(COLS);
/* letter sizes, then trouser waist and shoe sizes (same list as TF_SIZES) */
const SIZES = ['XS', 'S', 'M', 'L', 'XL', '34', '36', '37', '38', '39', '40', '42'];
const FITS = [['true', 'اندازه‌ی معمول'], ['small', 'کوچیک‌تر از معمول'], ['relaxed', 'گشاد']];
const BADGES = [['', 'بدون برچسب'], ['new', 'جدید'], ['campaign', 'کمپین'], ['bestseller', 'پرفروش'],
  ['restock', 'دوباره موجود'], ['last', 'آخرین‌ها']];
const STATUS = { new: 'جدید', confirmed: 'تأیید شده', shipped: 'ارسال شده', delivered: 'تحویل شده', cancelled: 'لغو شده' };
const STEP = { new: 1, confirmed: 2, shipped: 3, delivered: 4, cancelled: 0 };
const NEXT = { new: ['confirmed', 'تأیید سفارش'], confirmed: ['shipped', 'ارسال شد'], shipped: ['delivered', 'تحویل شد'] };
const PAY = { card: 'کارت موقع تحویل', c2c: 'کارت‌به‌کارت («تأیید شد»)', online: 'پرداخت آنلاین' };
/* Card-to-card («تأیید شد»): where an order's payment stands. [short, the
   long line on the order sheet, pill colour] */
const PSTATE = {
  pending: ['منتظر واریز', 'مشتری هنوز «واریز کردم» رو نزده. مهلتش ۳۰ دقیقه بعد از ثبته.', 'new'],
  claimed: ['واریز اعلام شد', 'مشتری «واریز کردم» رو زده؛ توی ربات بله‌ی «تأیید شد»، اگه پول رسیده «رسید» رو بزن.', 'confirmed'],
  paid: ['پرداخت شد', 'پول رسید و توی «تأیید شد» تأییدش کردی.', 'delivered'],
  rejected: ['واریز نرسید', '«نرسید» زده شد. اگه بعداً پول رو دیدی، از داشبورد «تأیید شد» «تأیید دستی» کن.', 'out'],
  mismatch: ['مبلغ نادقیق', 'واریزی نزدیک به این سفارش رسیده ولی مبلغش دقیق نیست؛ توی داشبورد «تأیید شد» تصمیم بگیر.', 'confirmed'],
  expired: ['مهلت تموم شد', 'مهلت پرداخت تموم شد. مشتری تا ۲۴ ساعت می‌تونه «واریز کرده بودم» رو بزنه؛ وگرنه باهاش تماس بگیر یا سفارش رو لغو کن.', 'cancelled'],
  canceled: ['پرداخت لغو شد', 'صفحه‌ی پرداخت این سفارش بسته شد.', 'cancelled'],
  short: ['کم واریز شده', 'واریزی که تأیید شد کمتر از مبلغ سفارشه. قبل از ارسال بررسی کن.', 'out'],
  odd: ['بررسی کن', 'از «تأیید شد» پرداختی رسید که با این سفارش جور نیست (مبلغ، حالت آزمایشی/اصلی، یا سفارشی که کارت‌به‌کارت نشده بود). قبل از ارسال توی داشبورد «تأیید شد» بررسی کن.', 'out'],
  failed: ['ساخته نشد', 'صفحه‌ی پرداخت ساخته نشد و سفارش «کارت موقع تحویل» شد؛ دلیلش توی یادداشت داخلیه.', 'cancelled'],
};
const payPill = (o) => ((o.pay === 'c2c' || o.pay_state === 'odd') && PSTATE[o.pay_state]
  ? `<span class="pill ${PSTATE[o.pay_state][2]}">${PSTATE[o.pay_state][0]}</span>` : '');
const PAGES = { home: 'صفحه‌ی اصلی', shop: 'فروشگاه', bag: 'سبد خرید', orders: 'سفارش‌های مشتری', tickets: 'پشتیبانی و تیکت‌ها',
  profile: 'پروفایل', saved: 'ذخیره‌شده‌ها', about: 'درباره‌ی ما', contact: 'شعبه‌ها و تماس', terms: 'قوانین' };
/* The shop's cookie sheet: what each device word is called in the panel. */
const DEV = {
  type: { t: 'نوع دستگاه', v: { mobile: 'موبایل', tablet: 'تبلت', desktop: 'کامپیوتر' } },
  brand: { t: 'برند گوشی', v: { apple: 'اپل (آیفون و آیپد)', samsung: 'سامسونگ', xiaomi: 'شیائومی', huawei: 'هواوی', honor: 'آنر',
    google: 'گوگل پیکسل', oppo: 'اوپو', realme: 'ریلمی', vivo: 'ویوو', oneplus: 'وان‌پلاس', nokia: 'نوکیا',
    motorola: 'موتورولا', lg: 'ال‌جی', tecno: 'تکنو و اینفینیکس', other: 'بقیه' } },
  os: { t: 'سیستم‌عامل', v: { ios: 'iOS (آیفون و آیپد)', android: 'اندروید', windows: 'ویندوز', macos: 'مک', linux: 'لینوکس', chromeos: 'کروم‌اواس', other: 'بقیه' } },
  browser: { t: 'مرورگر', v: { chrome: 'کروم', safari: 'سافاری', samsung: 'سامسونگ اینترنت', firefox: 'فایرفاکس', edge: 'اج', opera: 'اپرا',
    yandex: 'یاندکس', instagram: 'داخل اینستاگرام', facebook: 'داخل فیسبوک', telegram: 'داخل تلگرام', other: 'بقیه' } },
  app: { t: 'از کجا باز کردن', v: { app: 'اپ روی صفحه‌ی اصلی', web: 'مرورگر' } },
  lang: { t: 'زبان سایت', v: { fa: 'فارسی', en: 'انگلیسی', tr: 'ترکی' } },
};
const PCT = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 0 });

const ACTIONS = { login: 'وارد پنل شد', setup: 'پنل رو راه‌اندازی کرد', recover: 'رمز رو با کلید بازیابی کرد',
  password: 'رمزش رو عوض کرد', product_add: 'محصول اضافه کرد', product_edit: 'محصول رو ویرایش کرد',
  product_show: 'محصول رو نمایش داد', product_hide: 'محصول رو مخفی کرد', product_delete: 'محصول رو حذف کرد',
  order_status: 'وضعیت سفارش رو عوض کرد', order_note: 'یادداشت سفارش نوشت',
  store_open: 'فروش آنلاین رو روشن کرد', store_close: 'فروش آنلاین رو خاموش کرد',
  catalog_import: 'کاتالوگ جدید رو یک‌جا وارد کرد',
  sms_on: 'پیامک‌ها رو روشن کرد', sms_off: 'پیامک‌ها رو خاموش کرد',
  sms_owner: 'شماره‌ی خبر سفارش جدید رو عوض کرد', sms_test: 'پیامک آزمایشی فرستاد',
  team_add: 'عضو تیم اضافه کرد', team_edit: 'عضو تیم رو ویرایش کرد', team_delete: 'عضو تیم رو حذف کرد',
  story_add: 'استوری گذاشت', story_edit: 'استوری رو ویرایش کرد', story_repost: 'استوری رو دوباره منتشر کرد',
  story_end: 'استوری رو از سایت برداشت', story_delete: 'استوری رو حذف کرد',
  look_save: 'استوری کمپین رو ویرایش کرد', look_reset: 'استوری کمپین رو به حالت اول برگردوند',
  ticket_reply: 'به تیکت جواب داد', ticket_close: 'تیکت رو بست', ticket_open: 'تیکت رو دوباره باز کرد',
  sms_template: 'شماره‌ی قالب پیامک رو عوض کرد',
  order_paid: 'پرداخت کارت‌به‌کارت سفارش رو تأیید کرد', order_pay_odd: 'پرداختی فرستاد که باید بررسی بشه',
  pay_failed: 'نتونست صفحه‌ی پرداخت بسازه', pay_key: 'کلید API «تأیید شد» رو گذاشت',
  pay_secret: 'رمز وب‌هوک «تأیید شد» رو گذاشت', pay_on: 'کارت‌به‌کارت رو روشن کرد', pay_off: 'کارت‌به‌کارت رو خاموش کرد' };
const ROLE = { ceo: 'مدیرعامل', admin: 'ادمین' };

/* ----------------------------------------------------------------- icons */
const P = {
  home: '<path d="M4 10.6 12 4l8 6.6V19a1.4 1.4 0 0 1-1.4 1.4h-3.2v-5.6H8.6v5.6H5.4A1.4 1.4 0 0 1 4 19z"/>',
  box: '<path d="M3.8 8.2 12 4l8.2 4.2v7.6L12 20l-8.2-4.2z"/><path d="M3.8 8.2 12 12.4l8.2-4.2M12 12.4V20"/>',
  hanger: '<path d="M12 8.4a2.2 2.2 0 1 1 2.2-2.2M12 8.4v2.2"/><path d="M12 10.6 4.3 16a1.5 1.5 0 0 0 .9 2.7h13.6a1.5 1.5 0 0 0 .9-2.7z"/>',
  users: '<circle cx="9" cy="8.6" r="3.2"/><path d="M3.4 19.4a5.6 5.6 0 0 1 11.2 0"/><path d="M15.6 5.6a3 3 0 0 1 0 6M17.4 14.2a5 5 0 0 1 3.2 5.2"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.4 7.4 0 0 0-2.6-1.5L14.2 2.6h-4l-.4 2.5a7.4 7.4 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.3 1 2-3.4z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="10.8" cy="10.8" r="6"/><path d="M15.2 15.2 20 20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M9 5l7 7-7 7"/>',
  fwd: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M5.4 7h13.2M9.6 7V5.4A1.4 1.4 0 0 1 11 4h2a1.4 1.4 0 0 1 1.4 1.4V7M7 7l.8 11.6a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3L17 7"/>',
  camera: '<path d="M4 8.4A1.4 1.4 0 0 1 5.4 7h2.2l1.6-2.2h5.6L16.4 7h2.2A1.4 1.4 0 0 1 20 8.4v9.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 17.6z"/><circle cx="12" cy="12.8" r="3.4"/>',
  out: '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.6a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.6V7.4A1.4 1.4 0 0 1 5.4 6H10"/>',
  phone: '<path d="M6.6 4h2.6l1.4 3.8-1.9 1.3a10.6 10.6 0 0 0 6.2 6.2l1.3-1.9 3.8 1.4v2.6a1.8 1.8 0 0 1-1.8 1.8A14.2 14.2 0 0 1 4.8 5.8 1.8 1.8 0 0 1 6.6 4z"/>',
  down: '<path d="M12 4v11M7.6 10.6 12 15l4.4-4.4"/><path d="M4.6 19.4h14.8"/>',
  chevD: '<path d="M5 9l7 7 7-7"/>',
  eye: '<path d="M2.6 12S6 5.6 12 5.6 21.4 12 21.4 12 18 18.4 12 18.4 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.8"/>',
  bag: '<path d="M5.6 8h12.8l.9 11.1a1.4 1.4 0 0 1-1.4 1.5H6.1a1.4 1.4 0 0 1-1.4-1.5z"/><path d="M8.8 10.4V7.2a3.2 3.2 0 0 1 6.4 0v3.2"/>',
  ticket: '<path d="M4 7.4A1.4 1.4 0 0 1 5.4 6h13.2A1.4 1.4 0 0 1 20 7.4v2.4a2.2 2.2 0 0 0 0 4.4v2.4a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 16.6v-2.4a2.2 2.2 0 0 0 0-4.4z"/><path d="M14.4 6.6v1.8M14.4 11.1v1.8M14.4 15.6v1.8"/>',
  story: '<rect x="6.4" y="3" width="11.2" height="18" rx="2.6"/><path d="M10.4 9.2v5.6l4.6-2.8z"/>',
  mic: '<rect x="9" y="3.6" width="6" height="10.4" rx="3"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8v2.8"/>',
  clip: '<path d="M19.6 11.4 12.3 18.7a4.6 4.6 0 0 1-6.5-6.5l7.7-7.7a3.1 3.1 0 0 1 4.4 4.4l-7.6 7.6a1.5 1.5 0 0 1-2.2-2.2l6.9-6.9"/>',
  doc: '<path d="M7 3.6h6.8l4.2 4.2v11.2a1.4 1.4 0 0 1-1.4 1.4H7a1.4 1.4 0 0 1-1.4-1.4V5A1.4 1.4 0 0 1 7 3.6z"/><path d="M13.6 3.8v4.2h4.2M9 12.4h6M9 15.8h6"/>',
  play: '<path d="M8.4 5.6v12.8L18.6 12z" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.2V12l3.2 2"/>',
  repeat: '<path d="M4.6 10.4a7.6 7.6 0 0 1 13.2-3.6M19.4 13.6a7.6 7.6 0 0 1-13.2 3.6"/><path d="M18.4 3.6v3.6h-3.6M5.6 20.4v-3.6h3.6"/>',
};
const icon = (n, s = 22) => `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none"
  stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* -------------------------------------------------------------- the API */
const API = '../api/admin.php';
const S = { user: null, csrf: '', products: null };

class ApiError extends Error {
  constructor(code, status, body = {}) { super(code); this.code = code; this.status = status; this.body = body; }
}
const SAY = {
  too_many: 'تلاش‌ها زیاد شد؛ چند دقیقه صبر کن و دوباره امتحان کن.',
  wrong: 'ایمیل یا رمز درست نیست.',
  role: 'این بخش فقط برای مدیرعامله.',
  csrf: 'نشستت منقضی شده؛ صفحه رو تازه کن.',
  origin: 'درخواست از جای دیگه‌ای اومده؛ صفحه رو تازه کن.',
  not_found: 'پیدا نشد؛ شاید حذف شده.',
  already_setup: 'پنل قبلاً راه‌اندازی شده؛ وارد شو.',
  stale: 'این مورد همین الان یه جای دیگه عوض شد؛ صفحه رو تازه کن و دوباره امتحان کن.',
  sms: 'پیامک فرستاده نشد؛ اعتبار پنل پیامک یا شماره رو چک کن.',
  too_big: 'حجم فایل‌ها بیشتر از حدیه که هاست قبول می‌کنه؛ فایل کوچیک‌تر بفرست.',
  network: 'به اینترنت وصل نیستی؟ دوباره امتحان کن.',
  server: 'یه مشکلی پیش اومد؛ دوباره امتحان کن.',
};
const say = (e) => (e.code === 'invalid' ? e.body.message : SAY[e.code]) || SAY.server;

async function api(a, data = {}, { quiet = false } = {}) {
  let res;
  try {
    res = await fetch(API, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF': S.csrf },
      body: JSON.stringify({ a, ...data }),
    });
  } catch {
    const e = new ApiError('network', 0);
    if (!quiet) toast(say(e), 'err');
    throw e;
  }
  let body = {};
  try { body = await res.json(); } catch { /* not JSON */ }
  if (res.ok && body.ok) {
    if (body.csrf) S.csrf = body.csrf;
    return body;
  }
  const e = new ApiError(body.error || 'server', res.status, body);
  if (res.status === 401 && !['state', 'login', 'setup', 'recover'].includes(a)) {
    S.user = null;
    renderAuth('login');
    throw e;
  }
  if (!quiet && e.code !== 'invalid') toast(say(e), 'err');
  throw e;
}

/** Photos go up one at a time with a progress bar; big phone shots shrink first. */
function upload(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('a', 'upload');
    fd.append('photo', file, file.name || 'photo.jpg');
    const x = new XMLHttpRequest();
    x.open('POST', API);
    x.setRequestHeader('X-CSRF', S.csrf);
    x.upload.onprogress = (ev) => ev.lengthComputable && onProgress(ev.loaded / ev.total);
    x.onload = () => {
      let b = {};
      try { b = JSON.parse(x.responseText); } catch { /* */ }
      if (x.status === 200 && b.ok) resolve(b.image);
      else reject(new ApiError(b.error || 'server', x.status, b));
    };
    x.onerror = () => reject(new ApiError('network', 0));
    x.send(fd);
  });
}

async function shrink(file) {
  if (file.size < 3.5e6 || !/^image\/(jpeg|png)$/.test(file.type)) return file;
  try {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.src = url;
    await im.decode();               // the browser applies the photo's EXIF turn here
    const scale = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * scale);
    c.height = Math.round(im.naturalHeight * scale);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

/* ------------------------------------------------------------- feedback */
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), kind === 'err' ? 5200 : 3000);
}

let sheetClose = null;
function openSheet(html, onMount, onClose) {
  const root = $('#sheet');
  root.innerHTML = `<div class="scrim" data-x></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  const prev = document.activeElement;
  let shut = false;
  const close = () => {
    if (shut) return;
    shut = true;
    root.classList.remove('open');
    setTimeout(() => { root.hidden = true; root.innerHTML = ''; }, 280);
    sheetClose = null;
    prev?.focus?.();
    onClose?.();
  };
  sheetClose = close;
  root.querySelector('[data-x]').addEventListener('click', close);
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  onMount?.(root.querySelector('.sheet'), close);
  root.querySelector('.sheet input, .sheet button, .sheet textarea')?.focus({ preventScroll: true });
  return close;
}
const closeSheet = () => sheetClose?.();
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

/** Put the server's "this field is wrong" next to that field. */
function showErrors(form, e) {
  $$('.field.err', form).forEach((f) => f.classList.remove('err'));
  if (!(e instanceof ApiError) || e.code !== 'invalid') return false;
  const f = form.querySelector(`[data-field="${e.body.field}"]`);
  if (f) {
    f.classList.add('err');
    const m = f.querySelector('.msg');
    if (m) m.textContent = e.body.message;
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else toast(e.body.message, 'err');
  return true;
}

const field = (name, label, input, hint = '') => `
  <div class="field" data-field="${name}"><label for="f-${name}">${label}</label>${input}
    <div class="msg"></div>${hint ? `<p class="hint" style="margin:6px 0 0">${hint}</p>` : ''}</div>`;
const sig = () => '<div class="sig" lang="en"><i></i><span>Powered by <b>Alpha Agency</b></span></div>';

/* ================================================================= auth */
const root = $('#root');

function renderAuth(mode) {
  closeSheet();
  root.className = 'auth';
  const head = `<i class="mark" role="img" aria-label="TIFFANY"></i><p class="kicker">پنل مدیریت</p>`;
  const keyHelp = `<div class="keyhelp">کلید راه‌اندازی توی cPanel هاست سایته: File Manager ← پوشه‌ی
    <code>tiffany-data</code> ← فایل <code>SETUP-KEY.txt</code>. بعد از هر بار استفاده عوض می‌شه.</div>`;
  if (mode === 'setup') {
    root.innerHTML = `<form class="auth-box" novalidate>${head}
      <h1>راه‌اندازی پنل</h1><p class="lede">اولین بار؟ حساب مدیرعامل رو بساز. بعداً از تنظیمات می‌تونی بقیه‌ی تیم رو اضافه کنی.</p>
      ${keyHelp}
      ${field('key', 'کلید راه‌اندازی', '<input class="input ltr-in" id="f-key" name="key" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX">')}
      ${field('name', 'اسمت', '<input class="input" id="f-name" name="name" autocomplete="name">')}
      ${field('email', 'ایمیل', '<input class="input ltr-in" id="f-email" name="email" type="email" autocomplete="username">')}
      ${field('password', 'رمز (حداقل ۸ کاراکتر)', '<input class="input ltr-in" id="f-password" name="password" type="password" autocomplete="new-password">')}
      ${field('again', 'تکرار رمز', '<input class="input ltr-in" id="f-again" name="again" type="password" autocomplete="new-password">')}
      <button class="btn block" type="submit">ساختن حساب و ورود</button>${sig()}</form>`;
  } else if (mode === 'recover') {
    root.innerHTML = `<form class="auth-box" novalidate>${head}
      <h1>رمز جدید</h1><p class="lede">با کلید راه‌اندازی، برای حساب مدیرعامل رمز تازه بساز.</p>
      ${keyHelp}
      ${field('key', 'کلید راه‌اندازی', '<input class="input ltr-in" id="f-key" name="key" autocomplete="off" spellcheck="false">')}
      ${field('email', 'ایمیل مدیرعامل', '<input class="input ltr-in" id="f-email" name="email" type="email" autocomplete="username">')}
      ${field('password', 'رمز جدید', '<input class="input ltr-in" id="f-password" name="password" type="password" autocomplete="new-password">')}
      ${field('again', 'تکرار رمز', '<input class="input ltr-in" id="f-again" name="again" type="password" autocomplete="new-password">')}
      <button class="btn block" type="submit">ذخیره و ورود</button>
      <p class="auth-foot"><a class="link" href="#" data-mode="login">برگشت به ورود</a></p>${sig()}</form>`;
  } else {
    root.innerHTML = `<form class="auth-box" novalidate>${head}
      <h1>ورود</h1><p class="lede">با ایمیل و رمزی که برات ساخته شده وارد شو.</p>
      ${field('email', 'ایمیل', '<input class="input ltr-in" id="f-email" name="email" type="email" autocomplete="username">')}
      ${field('password', 'رمز', '<input class="input ltr-in" id="f-password" name="password" type="password" autocomplete="current-password">')}
      <button class="btn block" type="submit">ورود</button>
      <p class="auth-foot"><a class="link" href="#" data-mode="recover">رمز مدیرعامل رو فراموش کردی؟</a></p>${sig()}</form>`;
  }
  const form = root.querySelector('form');
  form.querySelector('input')?.focus();
  root.querySelectorAll('[data-mode]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); renderAuth(a.dataset.mode);
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if ('again' in d && d.again !== d.password) {
      showErrors(form, new ApiError('invalid', 422, { field: 'again', message: 'دو تا رمز یکی نیستن.' }));
      return;
    }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const a = mode === 'setup' ? 'setup' : mode === 'recover' ? 'recover' : 'login';
      const r = await api(a, d);
      S.user = r.user;
      renderShell();
      location.hash = '#/';
      route();
      ping();
      if (mode !== 'login') toast(mode === 'setup' ? 'پنل آماده‌ست. خوش اومدی!' : 'رمز جدید ذخیره شد.');
    } catch (err) {
      if (!showErrors(form, err) && err.code === 'wrong') {
        showErrors(form, new ApiError('invalid', 422, { field: 'password', message: SAY.wrong }));
      }
    } finally { btn.disabled = false; }
  });
}

/* ================================================================ shell */
let main;
function renderShell() {
  root.className = '';
  const ceo = S.user.role === 'ceo';
  root.innerHTML = `
  <div class="shell">
    <nav class="nav" aria-label="منوی پنل">
      <div class="brand"><i class="mark" role="img" aria-label="TIFFANY"></i><span>پنل مدیریت</span></div>
      <a href="#/" data-nav="dash">${icon('home')}<span>داشبورد</span></a>
      <a href="#/orders" data-nav="orders">${icon('box')}<span>سفارش‌ها</span><b class="badge" id="navBadge" hidden></b></a>
      <a href="#/products" data-nav="products">${icon('hanger')}<span>محصولات</span></a>
      <a href="#/tickets" data-nav="tickets">${icon('ticket')}<span>تیکت‌ها</span><b class="badge" id="navTBadge" hidden></b></a>
      <a href="#/customers" data-nav="customers">${icon('users')}<span>مشتری‌ها</span></a>
      <a class="side-only" href="#/stories" data-nav="stories">${icon('story')}<span>استوری‌ها</span></a>
      <a class="side-only" href="#/traffic" data-nav="traffic">${icon('chart')}<span>بازدید سایت</span></a>
      <a class="side-only" href="#/settings" data-nav="settings">${icon('gear')}<span>تنظیمات</span></a>
      <div class="spacer side-only"></div>
      <a class="side-only" href="../" target="_blank" rel="noopener">${icon('ext')}<span>دیدن سایت</span></a>
      <button class="side-only" type="button" data-logout>${icon('out')}<span>خروج</span></button>
      <button class="more-btn" type="button" data-more>${icon('menu')}<span>بیشتر</span></button>
    </nav>
    <div>
      <header class="top">
        <a class="back" id="topBack" href="#/" hidden aria-label="برگشت">${icon('back', 20)}</a>
        <h1 id="title"></h1>
        <i class="mark" role="img" aria-label="TIFFANY"></i>
      </header>
      <main class="main" id="main" tabindex="-1"></main>
    </div>
  </div>`;
  main = $('#main');
  root.querySelector('[data-more]').addEventListener('click', moreSheet);
  root.querySelector('[data-logout]').addEventListener('click', logout);
  void ceo;
}

function moreSheet() {
  openSheet(`
    <h2>${esc(S.user.name)}</h2><p class="tiny" style="margin:0 0 12px">${ROLE[S.user.role]} · <span class="ltr">${esc(S.user.email)}</span></p>
    <div class="list">
      <a class="item" href="#/stories" data-close>${icon('story')}<div class="main-c"><div class="t">استوری‌ها</div><div class="s">عکس یا ویدیو برای ۲۴ ساعت</div></div>${icon('fwd', 18)}</a>
      <a class="item" href="#/traffic" data-close>${icon('chart')}<div class="main-c"><div class="t">بازدید سایت</div></div>${icon('fwd', 18)}</a>
      <a class="item" href="#/settings" data-close>${icon('gear')}<div class="main-c"><div class="t">تنظیمات</div><div class="s">فروش آنلاین، رمز، تیم</div></div>${icon('fwd', 18)}</a>
      <a class="item" href="../" target="_blank" rel="noopener">${icon('ext')}<div class="main-c"><div class="t">دیدن سایت</div></div></a>
      <button class="item" type="button" data-logout>${icon('out')}<div class="main-c"><div class="t">خروج</div></div></button>
    </div>${sig()}`, (sheet) => {
    sheet.querySelector('[data-logout]').addEventListener('click', logout);
  });
}

async function logout() {
  try { await api('logout'); } catch { /* signed out anyway */ }
  S.user = null;
  S.csrf = '';
  renderAuth('login');
}

function setTitle(t, back = '') {
  $('#title').textContent = t;
  document.title = `${t} — پنل TIFFANY`;
  const b = $('#topBack');
  b.hidden = !back;
  if (back) b.setAttribute('href', back);
}
function setNav(key) {
  $$('.nav [data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === key));
}
function setBadge(n, id = 'navBadge') {
  const b = $(`#${id}`);
  if (!b) return;
  b.hidden = !n;
  b.textContent = num(n);
}
const setTBadge = (n) => setBadge(n, 'navTBadge');

/* =============================================================== router */
const ROUTES = [
  [/^\/$/, viewDashboard, 'dash'],
  [/^\/orders$/, viewOrders, 'orders'],
  [/^\/products$/, viewProducts, 'products'],
  [/^\/products\/new$/, viewEditor, 'products'],
  [/^\/products\/([a-z0-9-]+)$/, viewEditor, 'products'],
  [/^\/customers$/, viewCustomers, 'customers'],
  [/^\/customers\/(09\d{9})$/, viewCustomer, 'customers'],
  [/^\/tickets$/, viewTickets, 'tickets'],
  [/^\/tickets\/(T-\d{5})$/, viewTicket, 'tickets'],
  [/^\/stories$/, viewStories, 'stories'],
  [/^\/traffic$/, viewTraffic, 'traffic'],
  [/^\/settings$/, viewSettings, 'settings'],
];
let current = null;
let dirty = false;
let lastHash = location.hash;

const parse = () => {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', q: new URLSearchParams(qs || '') };
};

async function route() {
  if (!S.user || !main) return;
  if (dirty && location.hash !== lastHash) {
    if (!confirm('تغییرات ذخیره نشده. بی‌خیالشون می‌شی؟')) {
      history.replaceState(null, '', lastHash);
      return;
    }
    dirty = false;
  }
  lastHash = location.hash;
  current?.abort();
  current = new AbortController();
  const { signal } = current;
  closeSheet();
  const { path, q } = parse();
  const hit = ROUTES.find(([re]) => re.test(path));
  if (!hit) { location.hash = '#/'; return; }
  const [re, fn, nav] = hit;
  setNav(nav);
  main.innerHTML = '<div class="boot" style="min-height:40vh"><div class="spin"></div></div>';
  window.scrollTo(0, 0);
  try {
    await fn(path.match(re).slice(1), q, signal);
  } catch (e) {
    if (signal.aborted || !(e instanceof ApiError) || !S.user) return;
    main.innerHTML = `<div class="empty">${icon('box')}<h3>${esc(say(e))}</h3>
      <button class="btn line s" type="button" onclick="location.reload()">دوباره</button></div>`;
  }
}
addEventListener('hashchange', route);
addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/** Write the query string without a new render (filters remember themselves). */
function setQuery(obj) {
  const { path, q } = parse();
  Object.entries(obj).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
  const s = q.toString();
  const next = `#${path}${s ? `?${s}` : ''}`;
  history.replaceState(null, '', next);
  lastHash = next;
}

/* =============================================================== charts */
/* One series per chart, columns from one baseline, never a second axis
   (dataviz rules). Time runs left to right like every calendar chart; the
   dates under it say so. Hover/focus a column for its value; every value is
   also in the table under the chart. Hues validated for light and dark. */
const charts = new Map();
let chartSeq = 0;

function barChart(series, { key, cls, fmt, unit, money = false }) {
  const id = `c${++chartSeq}`;
  charts.set(id, { series, key, fmt, unit, money });
  return `
  <p class="chart-unit" id="${id}-u"></p>
  <div class="chart ${cls}" id="${id}" tabindex="0" role="img"
       aria-label="${esc(unit)}، ${num(series.length)} روز اخیر"></div>
  <details class="tbl-toggle"><summary>${icon('chevD', 15)}نمایش به‌صورت جدول</summary>
    <table class="tbl"><thead><tr><th>روز</th><th class="n">${esc(unit)}</th></tr></thead><tbody>
    ${[...series].reverse().map((s) => `<tr><td>${esc(D_LONG.format(dayDate(s.day)))}</td><td class="n">${esc(fmt(s[key] || 0))}</td></tr>`).join('')}
    </tbody></table></details>`;
}

const niceTop = (max) => {
  if (max <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(max));
  const f = max / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
};

function drawCharts() {
  $$('.chart').forEach((el) => {
    const c = charts.get(el.id);
    if (!c) return;
    const W = Math.max(260, Math.round(el.clientWidth));
    const H = 190;
    const pl = 46;
    const pr = 4;
    const pt = 22;
    const pb = 24;
    const vals = c.series.map((s) => Number(s[c.key]) || 0);
    const max = Math.max(...vals);
    /* Money axes read in one unit named above the chart (millions of toman,
       say), so every tick is a bare number; counts tick in whole numbers. */
    let top = niceTop(max);
    let div = 1;
    let unitWord = c.unit;
    if (c.money) {
      [div, unitWord] = top >= 1e9 ? [1e9, 'میلیارد تومان'] : top >= 1e6 ? [1e6, 'میلیون تومان']
        : top >= 1e3 ? [1e3, 'هزار تومان'] : [1, 'تومان'];
    } else top = Math.max(2, top);
    const ticks = [0, top / 2, top].filter((v) => c.money || Number.isInteger(v));
    const lab = (v) => NF1.format(v / div);
    const u = document.getElementById(`${el.id}-u`);
    if (u) u.textContent = unitWord;
    const n = vals.length;
    const slot = (W - pl - pr) / n;
    const bw = Math.max(1.5, Math.min(24, slot - 2));
    const base = H - pb;
    const ph = base - pt;
    const y = (v) => base - (v / top) * ph;
    let g = '';
    /* SVG lays text out left to right; Persian labels get an RTL run, so
       their anchors are given in RTL terms (start = right edge). */
    const T = (x, yy, anchor, text, cls = 'axis-t') => `<text class="${cls}" x="${x}" y="${yy}" direction="rtl"
      text-anchor="${({ left: 'end', right: 'start', middle: 'middle' })[anchor]}">${esc(text)}</text>`;
    ticks.forEach((v) => {
      g += `<line class="gridline" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/>`
        + T(pl - 7, y(v) + 3.5, 'right', lab(v));
    });
    let bars = '';
    let hits = '';
    vals.forEach((v, i) => {
      const x = pl + i * slot + (slot - bw) / 2;
      const h = (v / top) * ph;
      if (h > 0) {
        const r = Math.min(bw >= 8 ? 4 : bw / 2, h);
        const yy = base - h;
        bars += `<path class="bar" data-i="${i}" d="M${x},${base}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${base}Z"/>`;
      }
      hits += `<rect class="hit" data-i="${i}" x="${pl + i * slot}" y="${pt - 10}" width="${slot}" height="${ph + 10}"/>`;
    });
    const mid = Math.floor((n - 1) / 2);
    const xl = [0, mid, n - 1].map((i) => T(i === 0 ? pl : i === n - 1 ? W - pr : pl + i * slot + slot / 2, H - 6,
      i === 0 ? 'left' : i === n - 1 ? 'right' : 'middle', D_SHORT.format(dayDate(c.series[i].day)))).join('');
    let peak = '';
    if (max > 0) {
      const i = vals.lastIndexOf(max);
      const cx = pl + i * slot + slot / 2;
      const anchor = cx < pl + 40 ? 'left' : cx > W - 40 ? 'right' : 'middle';
      const px = anchor === 'left' ? cx - slot / 2 : anchor === 'right' ? cx + slot / 2 : cx;
      peak = T(px, y(max) - 7, anchor, lab(max), 'peak-t');
    }
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${g}${bars}${peak}${xl}${hits}</svg>`;
    wireChart(el, c);
  });
}

function wireChart(el, c) {
  const tip = $('#tip');
  let active = -1;
  const show = (i) => {
    active = i;
    const s = c.series[i];
    const bar = el.querySelector(`.bar[data-i="${i}"]`);
    const hit = el.querySelector(`.hit[data-i="${i}"]`);
    el.classList.add('has-hover');
    el.querySelectorAll('.bar.on').forEach((b) => b.classList.remove('on'));
    bar?.classList.add('on');
    tip.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = c.fmt(Number(s[c.key]) || 0);
    const sp = document.createElement('span');
    sp.textContent = D_LONG.format(dayDate(s.day));
    tip.append(b, sp);
    const r = (bar || hit).getBoundingClientRect();
    const hr = hit.getBoundingClientRect();
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const left = Math.min(innerWidth - tw / 2 - 8, Math.max(tw / 2 + 8, hr.left + hr.width / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(r.top, hr.top + 10) - 8}px`;
  };
  const hide = () => {
    active = -1;
    tip.hidden = true;
    el.classList.remove('has-hover');
  };
  el.querySelectorAll('.hit').forEach((h) => {
    h.addEventListener('pointerenter', () => show(Number(h.dataset.i)));
    h.addEventListener('pointerdown', () => show(Number(h.dataset.i)));
  });
  el.addEventListener('pointerleave', hide);
  el.addEventListener('blur', hide);
  el.addEventListener('keydown', (e) => {
    const n = c.series.length;
    if (e.key === 'ArrowRight') { e.preventDefault(); show(Math.min(n - 1, active < 0 ? n - 1 : active + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(Math.max(0, active < 0 ? n - 1 : active - 1)); }
    if (e.key === 'Escape') hide();
  });
  el.addEventListener('focus', () => show(c.series.length - 1));
}
let rt;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawCharts, 150); });
addEventListener('scroll', () => { if (!$('#tip').hidden) $('#tip').hidden = true; }, { passive: true });

/* ============================================================ dashboard */
const tile = (k, v, d = '', title = '') => `<div class="tile"${title ? ` title="${esc(title)}"` : ''}>
  <div class="k">${k}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`;

function delta(cur, prev, days) {
  if (!prev) return cur ? `${num(days)} روز قبلش صفر بود` : `در ${num(days)} روز قبل هم صفر`;
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return `مثل ${num(days)} روز قبل`;
  return `<span class="${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${num(Math.abs(p))}٪</span> نسبت به ${num(days)} روز قبل`;
}

async function viewDashboard(_, q, signal) {
  setTitle('داشبورد');
  let days = Number(q.get('d'));
  if (![7, 30, 90].includes(days)) days = 30;
  const d = await api('dashboard', { days });
  if (signal.aborted) return;
  setBadge(d.pending);
  const t = d.totals;
  const money = d.money;
  const first = (S.user.name || '').split(/\s+/)[0];

  const alerts = [];
  if (money && !d.store_open) {
    alerts.push(`<a class="alert off" href="#/settings"><i class="dot"></i><span>فروش آنلاین خاموشه؛ مشتری‌ها فعلاً نمی‌تونن از سایت سفارش بدن.</span>${icon('fwd', 16)}</a>`);
  }
  if (d.pending) alerts.push(`<a class="alert" href="#/orders?status=new"><i class="dot"></i><span>${num(d.pending)} سفارش جدید منتظر تأییده</span>${icon('fwd', 16)}</a>`);
  if (d.to_ship) alerts.push(`<a class="alert warn" href="#/orders?status=confirmed"><i class="dot"></i><span>${num(d.to_ship)} سفارش تأییدشده منتظر ارساله</span>${icon('fwd', 16)}</a>`);
  if (d.low_stock.length) alerts.push(`<a class="alert warn" href="#/products?f=low"><i class="dot"></i><span>موجودی ${num(d.low_stock.length)} محصول کم یا تموم شده</span>${icon('fwd', 16)}</a>`);

  const seg = `<div class="seg" role="group" aria-label="بازه">
    ${[[7, '۷ روز'], [30, '۳۰ روز'], [90, '۹۰ روز']].map(([v, l]) => `<button type="button" data-days="${v}" class="${v === days ? 'on' : ''}" aria-pressed="${v === days}">${l}</button>`).join('')}</div>`;

  const hero = money
    ? `<div class="card hero"><div class="k">فروش ${num(days)} روز اخیر</div>
         <div class="v">${num(t.revenue)} <small>تومان</small></div><div class="d">${delta(t.revenue, t.prev_revenue, days)}</div></div>`
    : `<div class="card hero"><div class="k">سفارش‌های ${num(days)} روز اخیر</div>
         <div class="v">${num(t.orders)}</div><div class="d">${delta(t.orders, t.prev_orders, days)}</div></div>`;

  const stLine = Object.entries(d.statuses).filter(([, n]) => n).map(([s, n]) =>
    `<span class="pill ${s}">${STATUS[s]} · ${num(n)}</span>`).join(' ') || '<span class="tiny">هنوز سفارشی نیست.</span>';

  const top = d.top.length ? `<div class="list">${d.top.map((p, i) => `
    <a class="item" href="#/products/${esc(p.id)}"><span class="rank">${num(i + 1)}</span>
      <img class="thumb s" src="${esc(img(p.img))}" alt="" loading="lazy">
      <div class="main-c"><div class="t">${esc(p.name)}</div><div class="s">${num(p.qty)} عدد فروخته شده</div></div>
      ${money ? `<div class="end"><div class="t">${esc(compact(p.revenue))}</div><div class="s">تومان</div></div>` : ''}</a>`).join('')}</div>`
    : '<p class="tiny">توی این بازه هنوز چیزی فروخته نشده.</p>';

  let cats = '';
  if (money && d.categories && Object.keys(d.categories).length) {
    const mx = Math.max(...Object.values(d.categories));
    cats = `<div class="card sec"><div class="sec-head"><h2>فروش هر دسته</h2></div><div class="hbar">
      ${Object.entries(d.categories).map(([c, v]) => `<div class="hbar-row"><span>${esc(CAT[c] || c)}</span>
        <span class="track"><i class="fill" style="display:block;width:${Math.max(1.5, (v / mx) * 100)}%"></i></span>
        <span class="val">${esc(compact(v))}</span></div>`).join('')}</div></div>`;
  }

  main.innerHTML = `
    <div class="greet"><h2>سلام ${esc(first)}</h2><p>${esc(D_LONG.format(new Date()))}</p></div>
    ${alerts.length ? `<div class="alerts">${alerts.join('')}</div>` : ''}
    <div class="sec-head"><h2>امروز</h2></div>
    <div class="tiles">
      ${money ? tile('فروش امروز', `${esc(compact(d.today.revenue))} <small>تومان</small>`, '', toman(d.today.revenue)) : ''}
      ${tile('سفارش امروز', num(d.today.orders))}
      ${tile('بازدیدکننده امروز', num(d.today.visitors))}
      ${tile('بازدید صفحه‌ها', num(d.today.views))}
      ${money ? '' : tile('منتظر تأیید', num(d.pending))}
    </div>

    <section class="sec">
      <div class="sec-head"><h2>${money ? 'گزارش فروش' : 'گزارش سفارش‌ها'}</h2>${seg}</div>
      ${hero}
      <div class="tiles" style="margin-top:10px">
        ${money ? tile('میانگین هر سفارش', `${esc(compact(t.average || 0))} <small>تومان</small>`, '', toman(t.average || 0)) : ''}
        ${money ? tile('تعداد سفارش', num(t.orders), delta(t.orders, t.prev_orders, days)) : ''}
        ${tile('قطعه‌های فروخته‌شده', num(t.items))}
        ${tile('نرخ تبدیل', t.conversion === null ? '—' : `${NF1.format(t.conversion)}٪`, 'سفارش به ازای بازدیدکننده')}
        ${tile('لغوشده', num(t.cancelled))}
      </div>
      <div class="card sec" style="margin-top:10px">
        <div class="sec-head"><h2>${money ? 'فروش روزانه' : 'سفارش روزانه'}</h2></div>
        ${money
    ? barChart(d.series, { key: 'revenue', cls: 'money', fmt: toman, unit: 'فروش', money: true })
    : barChart(d.series, { key: 'orders', cls: 'money', fmt: (v) => `${num(v)} سفارش`, unit: 'تعداد سفارش' })}
      </div>
      <div class="card sec" style="margin-top:10px">
        <div class="sec-head"><h2>بازدیدکننده‌های روزانه</h2><a class="link" href="#/traffic">بیشتر</a></div>
        ${barChart(d.series, { key: 'visitors', cls: 'visits', fmt: (v) => `${num(v)} نفر`, unit: 'نفر' })}
      </div>
      <div class="cols" style="margin-top:10px">
        <div class="card"><div class="sec-head"><h2>پرفروش‌ترین‌ها</h2></div>${top}</div>
        <div class="stack">
          <div class="card"><div class="sec-head"><h2>وضعیت سفارش‌ها</h2></div><div style="display:flex;flex-wrap:wrap;gap:6px">${stLine}</div></div>
          ${cats ? cats.replace('card sec', 'card') : ''}
        </div>
      </div>
    </section>`;
  drawCharts();
  main.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => {
    location.hash = `#/?d=${b.dataset.days}`;
  }));
}

/* =============================================================== orders */
let ordersQuery = '';

function orderItem(o) {
  const n = o.items.reduce((s, i) => s + i.qty, 0);
  return `<button class="item" type="button" data-code="${esc(o.code)}">
    <div class="main-c"><div class="t"><span class="ltr">${esc(o.code)}</span> · ${esc(o.name)}</div>
      <div class="s">${esc(o.city)} · ${num(n)} قطعه · ${esc(ago(o.created_at))}</div></div>
    <div class="end"><div class="t">${esc(toman(o.total))}</div><div class="pills"><span class="pill ${o.status}">${STATUS[o.status]}</span>${payPill(o)}</div></div></button>`;
}

async function viewOrders(_, q, signal) {
  setTitle('سفارش‌ها');
  const status = q.get('status') || '';
  const search = q.get('q') || '';
  const d = await api('orders', { status, q: search });
  if (signal.aborted) return;
  ordersQuery = location.hash;
  setBadge(d.counts.new || 0);
  const all = Object.values(d.counts).reduce((a, b) => a + b, 0);
  main.innerHTML = `
    <div class="toolbar">
      <div class="search">${icon('search')}<input class="input" id="oq" type="search" placeholder="کد سفارش، اسم یا موبایل" value="${esc(search)}" aria-label="جستجو"></div>
      <button class="btn line s" type="button" id="csv">${icon('down', 18)}خروجی اکسل</button>
    </div>
    <div class="chips" style="margin-bottom:12px">
      <button class="chip ${status ? '' : 'on'}" data-st="">همه <b>${num(all)}</b></button>
      ${Object.keys(STATUS).map((s) => `<button class="chip ${status === s ? 'on' : ''}" data-st="${s}">${STATUS[s]} <b>${num(d.counts[s] || 0)}</b></button>`).join('')}
    </div>
    ${d.orders.length ? `<div class="list" id="olist">${d.orders.map(orderItem).join('')}</div>`
    : `<div class="empty">${icon('box')}<h3>${search || status ? 'چیزی پیدا نشد' : 'هنوز سفارشی نیومده'}</h3>
        <p>${search || status ? 'فیلتر یا جستجو رو عوض کن.' : 'وقتی فروش آنلاین روشن باشه، سفارش‌های سایت این‌جا میان.'}</p></div>`}`;

  main.querySelectorAll('[data-st]').forEach((c) => c.addEventListener('click', () => {
    const p = new URLSearchParams();
    if (c.dataset.st) p.set('status', c.dataset.st);
    if (search) p.set('q', search);
    location.hash = `#/orders${p.toString() ? `?${p}` : ''}`;
  }));
  let st;
  $('#oq').addEventListener('input', (e) => {
    clearTimeout(st);
    st = setTimeout(() => {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (e.target.value.trim()) p.set('q', e.target.value.trim());
      location.hash = `#/orders${p.toString() ? `?${p}` : ''}`;
    }, 450);
  });
  if (search) { const i = $('#oq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-code]');
    if (b) openOrder(b.dataset.code, () => route());
  }, { signal });
  $('#csv').addEventListener('click', () => exportCsv(d.orders));
}

function exportCsv(orders) {
  const head = ['کد', 'تاریخ', 'وضعیت', 'اسم', 'موبایل', 'شهر', 'آدرس', 'کد پستی', 'اقلام', 'مبلغ کل (تومان)', 'پرداخت'];
  /* A cell that starts like a formula (=, +, -, @) is text, not a formula:
     a customer's name must never run in someone's Excel. */
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  /* Spaced like 0912 345 6789, so a spreadsheet reads it as text and the
     leading zero stays. */
  const phone = (s) => String(s || '').replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3');
  const rows = orders.map((o) => [o.code, D_TIME.format(new Date(o.created_at * 1000)), STATUS[o.status], o.name,
    phone(o.phone), o.city, o.address, o.postal,
    o.items.map((i) => `${i.name} (${i.size}${i.colour_name ? `، ${i.colour_name}` : ''}) ×${i.qty}`).join(' | '),
    o.total, (PAY[o.pay] || o.pay) + (o.pay === 'c2c' && PSTATE[o.pay_state] ? ` — ${PSTATE[o.pay_state][0]}` : '')].map(cell).join(','));
  const blob = new Blob(['﻿' + [head.map(cell).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tiffany-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* The sheet stays open while the order moves along; the list behind it is
   refreshed once the sheet closes (if anything changed and we are still on
   the same page). */
async function openOrder(code, onChange) {
  let o;
  try { o = (await api('order', { code })).order; } catch { return; }
  let changed = false;
  const at = location.hash;
  const render = () => {
    const step = STEP[o.status];
    const next = NEXT[o.status];
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <h2><span class="ltr">${esc(o.code)}</span></h2><span class="pill ${o.status}">${STATUS[o.status]}</span></div>
    <p class="tiny" style="margin:2px 0 0">${esc(D_TIME.format(new Date(o.created_at * 1000)))}${o.updated_at !== o.created_at ? ` · آخرین تغییر ${esc(ago(o.updated_at))}` : ''}</p>
    ${o.status !== 'cancelled' ? `<div class="steps-mini" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    ${o.status !== 'cancelled' && o.status !== 'delivered' ? `<div class="actions">
      ${next ? `<button class="btn" type="button" data-to="${next[0]}">${next[1]}</button>` : ''}
      <button class="btn danger" type="button" data-to="cancelled">لغو سفارش</button></div>` : ''}
    <p class="label" style="margin-top:16px">مشتری</p>
    <dl class="kv">
      <div><dt>اسم</dt><dd>${esc(o.name)}</dd></div>
      <div><dt>موبایل</dt><dd><a class="callme" href="tel:${esc(o.phone)}">${icon('phone', 15)}<span class="ltr">${esc(o.phone)}</span></a></dd></div>
      <div><dt>شهر</dt><dd>${esc(o.city)}</dd></div>
      <div><dt>آدرس</dt><dd style="max-width:70%">${esc(o.address)}</dd></div>
      ${o.postal ? `<div><dt>کد پستی</dt><dd><span class="ltr">${esc(o.postal)}</span></dd></div>` : ''}
    </dl>
    <p class="label" style="margin-top:16px">اقلام</p>
    <div class="lines">${o.items.map((i) => `<div class="oline">
      <img class="thumb s" src="${esc(img(i.img))}" alt="" loading="lazy">
      <div class="main-c"><div style="font-weight:600">${esc(i.name)}</div>
        <div class="tiny"><span class="ltr">${esc(i.size === 'OS' ? 'فری‌سایز' : i.size)}</span>${i.colour ? ` · <i class="swatch" style="background:${esc(i.colour)}"></i>${esc(i.colour_name)}` : ''} · ${num(i.qty)} × ${esc(toman(i.price))}</div></div>
      <div style="white-space:nowrap">${esc(compact(i.line))}</div></div>`).join('')}</div>
    <dl class="kv">
      <div><dt>جمع</dt><dd>${esc(toman(o.subtotal))}</dd></div>
      <div><dt>ارسال</dt><dd>${o.shipping ? esc(toman(o.shipping)) : 'رایگان'}</dd></div>
      <div class="big"><dt>مبلغ کل</dt><dd>${esc(toman(o.total))}</dd></div>
      <div><dt>پرداخت</dt><dd>${esc(PAY[o.pay] || o.pay)}</dd></div>
    </dl>
    ${payPart(o)}
    ${o.note ? `<p class="label" style="margin-top:16px">یادداشت مشتری</p><p style="margin:0">${esc(o.note)}</p>` : ''}
    <form id="noteForm" style="margin-top:16px">${field('note', 'یادداشت داخلی (فقط تیم می‌بینه)',
    `<textarea class="input" id="f-note" name="note" rows="2">${esc(o.admin_note)}</textarea>`)}
      <button class="btn line s" type="submit">ذخیره‌ی یادداشت</button></form>
    <div style="height:8px"></div><button class="btn quiet block" type="button" data-close>بستن</button>`;
  };
  openSheet(render(), (sheet) => {
    const bind = () => {
      sheet.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', async () => {
        const to = b.dataset.to;
        const unpaid = o.pay === 'c2c' && !o.paid;
        if (to === 'cancelled' && !confirm(o.pay === 'c2c' && o.paid
          ? 'این سفارش کارت‌به‌کارت پرداخت شده. لغو بشه؟ قطعه‌هاش به موجودی برمی‌گردن، ولی پول رو باید خودت به مشتری برگردونی.'
          : 'این سفارش لغو بشه؟ قطعه‌هاش به موجودی برمی‌گردن و دیگه نمی‌شه برش گردوند.')) return;
        if (to !== 'cancelled' && unpaid && !confirm('پرداخت کارت‌به‌کارت این سفارش هنوز تأیید نشده. با این حال جلو بره؟')) return;
        b.disabled = true;
        try {
          o = (await api('order_status', { code: o.code, status: to })).order;
          toast(`سفارش ${o.code}: ${STATUS[o.status]}`);
          sheet.innerHTML = `<div class="grab"></div>${render()}`;
          bind();
          changed = true;
        } catch { b.disabled = false; }
      }));
      sheet.querySelector('#payCheck')?.addEventListener('click', async (e) => {
        e.target.disabled = true;
        try {
          const was = `${o.pay_state}|${o.paid}`;
          o = (await api('order_pay_check', { code: o.code })).order;
          toast(`${was === `${o.pay_state}|${o.paid}` ? 'تغییری نکرده' : 'به‌روز شد'}: ${PSTATE[o.pay_state]?.[0] || '—'}`);
          if (was !== `${o.pay_state}|${o.paid}`) changed = true;
          sheet.innerHTML = `<div class="grab"></div>${render()}`;
          bind();
        } catch { e.target.disabled = false; }
      });
      sheet.querySelector('#payLink')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(o.pay_url);
          toast('لینک پرداخت کپی شد؛ برای مشتری بفرست.');
        } catch { prompt('لینک پرداخت:', o.pay_url); }
      });
      sheet.querySelector('#noteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          o = (await api('order_note', { code: o.code, note: e.target.note.value })).order;
          toast('یادداشت ذخیره شد');
        } catch (err) { showErrors(e.target, err); }
      });
      sheet.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', closeSheet));
    };
    bind();
  }, () => { if (changed && location.hash === at) onChange?.(); });
}

/** The card-to-card part of an order sheet: where the money stands, the
    exact amount to look for in the bank, tayidshod's id, and a way to ask
    tayidshod again or send the customer their payment link. */
function payPart(o) {
  if (o.pay !== 'c2c' && !['failed', 'odd'].includes(o.pay_state)) return '';
  const st = PSTATE[o.pay_state] || ['—', '', 'cancelled'];
  const page = !o.paid && o.pay === 'c2c' && o.status !== 'cancelled' && o.pay_url
    && ['pending', 'claimed', 'rejected', 'mismatch', 'expired'].includes(o.pay_state);
  return `
    <p class="label" style="margin-top:16px">کارت‌به‌کارت («تأیید شد»)</p>
    <div class="paynote ${st[2]}"><b>${esc(st[0])}</b>${o.pay_mode === 'test' ? ' <span class="pill hidden-p">آزمایشی</span>' : ''}<br><span>${esc(st[1])}</span></div>
    ${o.pay === 'c2c' ? `<dl class="kv">
      ${o.pay_amount ? `<div><dt>مبلغ دقیق واریز</dt><dd>${esc(toman(o.pay_amount))}</dd></div>` : ''}
      ${o.pay_ref ? `<div><dt>شناسه در «تأیید شد»</dt><dd><span class="ltr">${esc(o.pay_ref)}</span></dd></div>` : ''}
      ${o.paid && o.paid_at ? `<div><dt>زمان تأیید</dt><dd>${esc(D_TIME.format(new Date(o.paid_at * 1000)))}</dd></div>` : ''}
    </dl>
    <div class="actions" style="gap:8px;margin-top:10px">
      ${!o.paid && o.pay_ref ? '<button class="btn line s" type="button" id="payCheck">بررسی وضعیت پرداخت</button>' : ''}
      ${page ? '<button class="btn line s" type="button" id="payLink">کپی لینک پرداخت</button>' : ''}
    </div>` : ''}`;
}

/* ============================================================= products */
const stockState = (p) => {
  if (!p.stock) return '';
  const vals = Object.values(p.stock);
  if (vals.every((n) => n <= 0)) return 'out';
  if (vals.some((n) => n <= 2)) return 'low';
  return '';
};

async function viewProducts(_, q, signal) {
  setTitle('محصولات');
  const d = await api('products');
  if (signal.aborted) return;
  S.products = d.products;
  const f = { q: q.get('q') || '', cat: q.get('cat') || '', f: q.get('f') || '' };
  main.innerHTML = `
    <div class="toolbar">
      <div class="search">${icon('search')}<input class="input" id="pq" type="search" placeholder="جستجوی اسم" value="${esc(f.q)}" aria-label="جستجو"></div>
      <select class="input" id="pcat" aria-label="دسته‌بندی"><option value="">همه‌ی دسته‌ها</option>
        ${CATS.map(([v, l]) => `<option value="${v}" ${f.cat === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select class="input" id="pf" aria-label="فیلتر"><option value="">همه</option>
        <option value="on" ${f.f === 'on' ? 'selected' : ''}>توی سایت</option>
        <option value="off" ${f.f === 'off' ? 'selected' : ''}>مخفی</option>
        <option value="low" ${f.f === 'low' ? 'selected' : ''}>موجودی کم یا تموم</option></select>
      <a class="btn s grow" href="#/products/new">${icon('plus', 18)}محصول جدید</a>
    </div>
    <p class="tiny" id="pcount" style="margin:0 0 10px"></p>
    <div class="pgrid" id="pgrid"></div>`;

  const paint = () => {
    const words = f.q.trim().toLowerCase();
    const list = S.products.filter((p) => (!f.cat || p.cat === f.cat)
      && (!f.f || (f.f === 'on' ? p.visible : f.f === 'off' ? !p.visible : stockState(p) !== ''))
      && (!words || `${p.name.fa} ${p.name.en} ${p.id}`.toLowerCase().includes(words)));
    $('#pcount').textContent = `${num(list.length)} محصول`;
    $('#pgrid').innerHTML = list.length ? list.map((p) => {
      const s = stockState(p);
      return `<div class="pcard ${p.visible ? '' : 'off'}">
        <a class="ph" href="#/products/${esc(p.id)}"><img src="${esc(img(p.images[0]))}" alt="" loading="lazy">
          <span class="flags">${p.visible ? '' : '<span class="pill hidden-p">مخفی</span>'}${s === 'out' ? '<span class="pill out">ناموجود</span>' : s === 'low' ? '<span class="pill confirmed">موجودی کم</span>' : ''}</span></a>
        <div class="body"><a class="t" href="#/products/${esc(p.id)}">${esc(p.name.fa)}</a>
          <div class="s">${esc(toman(p.price))}</div>
          <div class="s">${esc(CAT[p.cat] || '')} · <span class="ltr">${esc(p.sizes.map((z) => (z === 'OS' ? 'فری‌سایز' : z)).join(' '))}</span></div>
          <div class="row"><span class="tiny">توی سایت</span>
            <label class="switch" title="نمایش توی سایت"><input type="checkbox" data-vis="${esc(p.id)}" ${p.visible ? 'checked' : ''}>
            <span class="knob"></span><span class="sr">نمایش ${esc(p.name.fa)} توی سایت</span></label></div></div></div>`;
    }).join('') : `<div class="empty" style="grid-column:1/-1">${icon('hanger')}<h3>محصولی پیدا نشد</h3></div>`;
  };
  paint();
  let t;
  $('#pq').addEventListener('input', (e) => { f.q = e.target.value; clearTimeout(t); t = setTimeout(() => setQuery({ q: f.q }), 300); paint(); });
  $('#pcat').addEventListener('change', (e) => { f.cat = e.target.value; setQuery({ cat: f.cat }); paint(); });
  $('#pf').addEventListener('change', (e) => { f.f = e.target.value; setQuery({ f: f.f }); paint(); });
  main.addEventListener('change', async (e) => {
    const sw = e.target.closest('[data-vis]');
    if (!sw) return;
    try {
      const r = await api('product_visible', { id: sw.dataset.vis, visible: sw.checked });
      const i = S.products.findIndex((p) => p.id === r.product.id);
      S.products[i] = r.product;
      toast(r.product.visible ? 'محصول توی سایت نمایش داده می‌شه' : 'محصول از سایت برداشته شد');
      paint();
    } catch { sw.checked = !sw.checked; }
  }, { signal });
}

const blankProduct = () => ({
  name: { fa: '', en: '', tr: '' }, cat: '', col: '', price: '', images: [], sizes: [], stock: null,
  fit: 'true', badge: '', colours: [{ hex: '#111111', fa: 'مشکی', en: 'Black', tr: 'Siyah' }],
  note: { fa: '', en: '', tr: '' }, detail: { fa: '', en: '', tr: '' }, fabric: { fa: '', en: '', tr: '' },
  care: { fa: '', en: '', tr: '' }, visible: true,
});

async function viewEditor([id], q, signal) {
  const isNew = !id;
  let p;
  let stockBase = null;
  if (isNew) p = blankProduct();
  else {
    p = (await api('product', { id })).product;
    /* The stock this editor opened with. Saving sends it back, so the server
       applies only the change made here and keeps whatever orders took or
       cancellations returned in the meantime. */
    stockBase = p.stock ? { ...p.stock } : null;
    if (signal.aborted) return;
  }
  p = structuredClone(p);
  ['note', 'detail', 'fabric', 'care', 'name'].forEach((k) => { p[k] = { fa: '', en: '', tr: '', ...(p[k] || {}) }; });
  setTitle(isNew ? 'محصول جدید' : p.name.fa, '#/products');
  dirty = false;

  const t3 = (k, label, rows = 0) => `<div class="row2">
    ${['en', 'tr'].map((l) => `<div class="field"><label>${label} — ${l === 'en' ? 'انگلیسی' : 'ترکی'}</label>
      ${rows ? `<textarea class="input ltr-in" rows="${rows}" data-t="${k}.${l}">${esc(p[k][l])}</textarea>`
    : `<input class="input ltr-in" data-t="${k}.${l}" value="${esc(p[k][l])}">`}</div>`).join('')}</div>`;

  main.innerHTML = `
  <form id="ed" novalidate>
    <div class="cols">
      <div class="stack">
        <div class="card form-sec" data-field="images">
          <h3>عکس‌ها</h3>
          <p class="hint" style="margin-top:-6px">اولین عکس، عکس اصلیه. عکس‌ها خودشون عمودی (۴ به ۵) برش می‌خورن؛ موضوع رو وسط کادر بگیر.</p>
          <div class="photos" id="photos"></div>
          <div class="msg"></div>
          <input type="file" id="file" accept="image/*" multiple hidden>
        </div>
        <div class="card form-sec">
          <h3>اطلاعات اصلی</h3>
          ${field('name', 'اسم محصول', `<input class="input" id="f-name" data-t="name.fa" value="${esc(p.name.fa)}" placeholder="مثلاً هودی کرم">`)}
          <div class="row2">
            ${field('cat', 'دسته‌بندی', `<select class="input" id="f-cat" data-k="cat"><option value="">انتخاب کن</option>
              ${CATS.map(([v, l]) => `<option value="${v}" ${p.cat === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
            ${field('price', 'قیمت (تومان)', `<input class="input" id="f-price" data-k="price" inputmode="numeric" value="${p.price ? esc(num(p.price)) : ''}" placeholder="۱٬۲۵۰٬۰۰۰">`)}
          </div>
          <div class="row2">
            ${field('col', 'کالکشن', `<select class="input" id="f-col" data-k="col">${COLS.map(([v, l]) => `<option value="${v}" ${p.col === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
            ${field('badge', 'برچسب روی عکس', `<select class="input" id="f-badge" data-k="badge">${BADGES.map(([v, l]) => `<option value="${v}" ${p.badge === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
          </div>
          <label class="switch" style="margin-top:4px"><span>نمایش توی سایت<br><span class="tiny">خاموش باشه، فقط توی پنل دیده می‌شه.</span></span>
            <input type="checkbox" id="f-visible" ${p.visible ? 'checked' : ''}><span class="knob"></span></label>
        </div>
      </div>
      <div class="stack">
        <div class="card form-sec" data-field="sizes">
          <h3>سایز و موجودی</h3>
          <div class="sizes" id="sizes"></div><div class="msg"></div>
          ${field('fit', 'قالب', `<select class="input" id="f-fit" data-k="fit" style="margin-top:12px">${FITS.map(([v, l]) => `<option value="${v}" ${p.fit === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
          <label class="switch"><span>شمارش موجودی<br><span class="tiny">خاموش باشه، همیشه قابل سفارشه.</span></span>
            <input type="checkbox" id="f-track" ${p.stock ? 'checked' : ''}><span class="knob"></span></label>
          <div class="stock-grid" id="stock"></div>
        </div>
        <div class="card form-sec" data-field="colours">
          <h3>رنگ‌ها</h3>
          <div id="colours"></div><div class="msg"></div>
          <button class="btn line s" type="button" id="addColour">${icon('plus', 18)}رنگ دیگه</button>
        </div>
        <div class="card form-sec">
          <h3>توضیحات</h3>
          ${field('note', 'یه جمله زیر قیمت', `<textarea class="input" rows="2" data-t="note.fa">${esc(p.note.fa)}</textarea>`)}
          ${field('detail', 'جزئیات', `<textarea class="input" rows="3" data-t="detail.fa">${esc(p.detail.fa)}</textarea>`)}
          ${field('fabric', 'جنس', `<textarea class="input" rows="2" data-t="fabric.fa">${esc(p.fabric.fa)}</textarea>`)}
          ${field('care', 'نگهداری', `<textarea class="input" rows="2" data-t="care.fa">${esc(p.care.fa)}</textarea>`)}
          <details class="more"><summary>انگلیسی و ترکی (اختیاری)${icon('chevD', 18)}</summary><div class="in">
            <p class="hint">اگه خالی بمونه، سایت توی اون زبان متن فارسی رو نشون می‌ده.</p>
            ${t3('name', 'اسم')}${t3('note', 'جمله زیر قیمت', 2)}${t3('detail', 'جزئیات', 3)}${t3('fabric', 'جنس', 2)}${t3('care', 'نگهداری', 2)}
            <div id="colourT"></div></div></details>
        </div>
      </div>
    </div>
    ${isNew ? '' : `<div class="actions" style="margin-top:14px">
      <a class="btn line" href="../#/p/${esc(p.id)}" target="_blank" rel="noopener">${icon('eye', 18)}دیدن توی سایت</a>
      <button class="btn danger" type="button" id="del">${icon('trash', 18)}حذف محصول</button></div>`}
    <div class="sticky-save"><a class="btn quiet" href="#/products">انصراف</a>
      <button class="btn" type="submit" id="save">${isNew ? 'افزودن محصول' : 'ذخیره‌ی تغییرات'}</button></div>
  </form>`;

  const form = $('#ed');
  const touch = () => { dirty = true; };

  /* photos */
  const photos = $('#photos');
  const busy = new Set();
  const paintPhotos = () => {
    photos.innerHTML = p.images.map((im, i) => `<div class="photo">
      <img src="${esc(img(im))}" alt="">
      <div class="tools">
        <button type="button" data-mv="${i}" data-d="-1" aria-label="جلوتر" ${i === 0 ? 'hidden' : ''}>${icon('back', 15)}</button>
        <button type="button" data-rm="${i}" aria-label="حذف عکس">${icon('close', 15)}</button>
        <button type="button" data-mv="${i}" data-d="1" aria-label="عقب‌تر" ${i === p.images.length - 1 ? 'hidden' : ''}>${icon('fwd', 15)}</button>
      </div>${i === 0 ? '<span class="cover">اصلی</span>' : ''}</div>`).join('')
      + [...busy].map((b) => `<div class="photo busy"><img src="${esc(b.preview)}" alt=""><span class="bar"><i style="width:${Math.round(b.pct * 100)}%"></i></span></div>`).join('')
      + (p.images.length + busy.size < 10 ? `<button class="add-photo" type="button" id="addPhoto">${icon('camera')}<span>افزودن عکس</span></button>` : '');
  };
  paintPhotos();
  photos.addEventListener('click', (e) => {
    const add = e.target.closest('#addPhoto');
    if (add) { $('#file').click(); return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) { p.images.splice(Number(rm.dataset.rm), 1); touch(); paintPhotos(); return; }
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const i = Number(mv.dataset.mv);
      const j = i + Number(mv.dataset.d);
      [p.images[i], p.images[j]] = [p.images[j], p.images[i]];
      touch();
      paintPhotos();
    }
  });
  $('#file').addEventListener('change', async (e) => {
    const files = [...e.target.files].slice(0, 10 - p.images.length);
    e.target.value = '';
    for (const file of files) {
      const job = { preview: URL.createObjectURL(file), pct: 0 };
      busy.add(job);
      paintPhotos();
      try {
        const small = await shrink(file);
        const image = await upload(small, (pct) => { job.pct = pct; paintPhotos(); });
        p.images.push(image);
        touch();
      } catch (err) {
        toast(err.code === 'invalid' ? err.body.message : 'آپلود عکس نشد؛ دوباره امتحان کن.', 'err');
      } finally {
        busy.delete(job);
        URL.revokeObjectURL(job.preview);
        paintPhotos();
      }
    }
  });

  /* sizes and stock */
  const paintSizes = () => {
    $('#sizes').innerHTML = [...SIZES, 'OS'].map((z) => `<button type="button" class="chip ${p.sizes.includes(z) ? 'on' : ''}" data-size="${z}" aria-pressed="${p.sizes.includes(z)}">${z === 'OS' ? 'فری‌سایز' : z}</button>`).join('');
    const st = $('#stock');
    st.hidden = !p.stock;
    if (p.stock) {
      st.innerHTML = p.sizes.map((z) => `<div><label for="st-${z}">${z === 'OS' ? 'فری‌سایز' : z}</label>
        <input class="input" id="st-${z}" data-stock="${z}" inputmode="numeric" value="${esc(p.stock[z] ?? '')}" placeholder="۰"></div>`).join('')
        || '<p class="tiny">اول سایزها رو انتخاب کن.</p>';
    }
  };
  paintSizes();
  $('#sizes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    const z = b.dataset.size;
    if (z === 'OS') p.sizes = p.sizes.includes('OS') ? [] : ['OS'];
    else {
      p.sizes = p.sizes.filter((x) => x !== 'OS');
      p.sizes = p.sizes.includes(z) ? p.sizes.filter((x) => x !== z) : [...p.sizes, z];
      p.sizes.sort((a, c) => SIZES.indexOf(a) - SIZES.indexOf(c));
    }
    touch();
    paintSizes();
  });
  $('#f-track').addEventListener('change', (e) => {
    p.stock = e.target.checked ? Object.fromEntries(p.sizes.map((z) => [z, p.stock?.[z] ?? ''])) : null;
    touch();
    paintSizes();
  });
  $('#stock').addEventListener('input', (e) => {
    const i = e.target.closest('[data-stock]');
    if (i && p.stock) p.stock[i.dataset.stock] = i.value;
  });

  /* colours */
  const paintColours = () => {
    $('#colours').innerHTML = p.colours.map((c, i) => `<div class="colour-row">
      <input type="color" value="${esc(c.hex.toLowerCase())}" data-ci="${i}" data-ck="hex" aria-label="رنگ">
      <input class="input" value="${esc(c.fa)}" data-ci="${i}" data-ck="fa" placeholder="اسم رنگ، مثلاً کرم" aria-label="اسم رنگ">
      <button class="icon-btn" type="button" data-crm="${i}" aria-label="حذف رنگ">${icon('trash', 18)}</button></div>`).join('')
      || '<p class="tiny">حداقل یه رنگ لازمه.</p>';
    $('#colourT').innerHTML = p.colours.map((c, i) => `<div class="row2">
      ${['en', 'tr'].map((l) => `<div class="field"><label>رنگ «${esc(c.fa || '؟')}» — ${l === 'en' ? 'انگلیسی' : 'ترکی'}</label>
        <input class="input ltr-in" data-ci="${i}" data-ck="${l}" value="${esc(c[l] || '')}"></div>`).join('')}</div>`).join('');
  };
  paintColours();
  form.addEventListener('input', (e) => {
    const c = e.target.closest('[data-ci]');
    if (c) {
      const col = p.colours[Number(c.dataset.ci)];
      col[c.dataset.ck] = c.dataset.ck === 'hex' ? c.value.toUpperCase() : c.value;
    }
    const t = e.target.closest('[data-t]');
    if (t) { const [k, l] = t.dataset.t.split('.'); p[k][l] = t.value; }
    touch();
  });
  form.addEventListener('change', (e) => {
    const k = e.target.closest('[data-k]');
    if (k && k.dataset.k !== 'price') p[k.dataset.k] = k.value;
    if (e.target.id === 'f-visible') p.visible = e.target.checked;
    if (e.target.closest('[data-ck="fa"]')) paintColours();
    touch();
  });
  $('#f-price').addEventListener('input', (e) => {
    const digits = e.target.value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^0-9]/g, '');
    p.price = digits ? Number(digits) : '';
    const pos = e.target.value.length;
    e.target.value = digits ? num(Number(digits)) : '';
    if (pos === e.target.value.length) e.target.setSelectionRange(pos, pos);
  });
  $('#colours').addEventListener('click', (e) => {
    const b = e.target.closest('[data-crm]');
    if (!b) return;
    p.colours.splice(Number(b.dataset.crm), 1);
    touch();
    paintColours();
  });
  $('#addColour').addEventListener('click', () => {
    if (p.colours.length >= 12) return;
    p.colours.push({ hex: '#CCCCCC', fa: '', en: '', tr: '' });
    touch();
    paintColours();
    $$('#colours [data-ck="fa"]').pop()?.focus();
  });

  /* save / delete */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy.size) { toast('صبر کن آپلود عکس‌ها تموم بشه.'); return; }
    const btn = $('#save');
    btn.disabled = true;
    try {
      const out = { ...p, id: isNew ? '' : p.id, stock_base: isNew ? null : stockBase };
      const r = await api('product_save', { product: out });
      dirty = false;
      toast(isNew ? 'محصول اضافه شد' : 'ذخیره شد');
      location.hash = isNew ? `#/products/${r.product.id}` : '#/products';
    } catch (err) {
      showErrors(form, err);
    } finally { btn.disabled = false; }
  });
  $('#del')?.addEventListener('click', async () => {
    if (!confirm(`«${p.name.fa}» برای همیشه حذف بشه؟ سفارش‌های قبلی دست نمی‌خورن.`)) return;
    try {
      await api('product_delete', { id: p.id });
      dirty = false;
      toast('محصول حذف شد');
      location.hash = '#/products';
    } catch { /* toast shown */ }
  });
}

/* ============================================================ customers */
async function viewCustomers(_, q, signal) {
  setTitle('مشتری‌ها');
  const search = q.get('q') || '';
  const d = await api('customers', { q: search });
  if (signal.aborted) return;
  const money = S.user.role === 'ceo';
  main.innerHTML = `
    <div class="toolbar"><div class="search">${icon('search')}<input class="input" id="cq" type="search"
      placeholder="اسم، موبایل یا شهر" value="${esc(search)}" aria-label="جستجو"></div></div>
    <p class="tiny" style="margin:0 0 10px">${num(d.customers.length)} نفر · هر کسی که از سایت سفارش داده، با شماره‌ش</p>
    ${d.customers.length ? `<div class="list">${d.customers.map((c) => `
      <a class="item" href="#/customers/${esc(c.phone)}">
        <div class="main-c"><div class="t">${esc(c.name)}</div><div class="s"><span class="ltr">${esc(c.phone)}</span> · ${esc(c.city)}</div></div>
        <div class="end"><div class="t">${num(c.orders)} سفارش</div>
          <div class="s">${money ? `${esc(compact(c.spent))} تومان · ` : ''}${esc(ago(c.last))}</div></div></a>`).join('')}</div>`
    : `<div class="empty">${icon('users')}<h3>${search ? 'کسی پیدا نشد' : 'هنوز مشتری‌ای نیست'}</h3><p>${search ? '' : 'اولین سفارش که بیاد، مشتری این‌جا دیده می‌شه.'}</p></div>`}`;
  let t;
  $('#cq').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { location.hash = `#/customers${e.target.value.trim() ? `?q=${encodeURIComponent(e.target.value.trim())}` : ''}`; }, 450);
  });
  if (search) { const i = $('#cq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

async function viewCustomer([phone], q, signal) {
  const d = await api('customer', { phone });
  if (signal.aborted) return;
  const o = d.orders;
  const name = o[0]?.name || phone;
  setTitle(name, '#/customers');
  const money = S.user.role === 'ceo';
  const spent = o.filter((x) => x.status !== 'cancelled').reduce((s, x) => s + x.total, 0);
  main.innerHTML = `
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div><h2 style="margin:0;font-size:19px">${esc(name)}</h2><p class="tiny" style="margin:2px 0 0">${esc(o[0]?.city || '')}${o.length ? ` · مشتری از ${esc(D_SHORT.format(new Date(o[o.length - 1].created_at * 1000)))}` : ''}</p></div>
      <a class="btn line s" href="tel:${esc(phone)}">${icon('phone', 16)}<span class="ltr">${esc(phone)}</span></a></div>
      <div class="tiles" style="margin-top:12px">${tile('سفارش‌ها', num(o.length))}${money ? tile('جمع خرید', `${esc(compact(spent))} <small>تومان</small>`, '', toman(spent)) : ''}</div>
      ${o[0] ? `<p class="tiny" style="margin:12px 0 0">آخرین آدرس: ${esc(o[0].address)}</p>` : ''}</div>
    <div class="sec"><div class="sec-head"><h2>سفارش‌ها</h2></div><div class="list">${o.map(orderItem).join('')}</div></div>`;
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-code]');
    if (b) openOrder(b.dataset.code, () => route());
  }, { signal });
}

/* ============================================================== traffic */
async function viewTraffic(_, q, signal) {
  setTitle('بازدید سایت');
  let days = Number(q.get('d'));
  if (![7, 30, 90].includes(days)) days = 30;
  const d = await api('traffic', { days });
  if (signal.aborted) return;
  const label = (k) => {
    const [kind, id] = k.split(':');
    if (kind === 'c') return `کالکشن ${COL_NAME[id] || (id === 'aw27' ? 'Autumn / Winter 2027' : id)}`;
    return PAGES[kind] || k;
  };
  main.innerHTML = `
    <div class="sec-head"><h2>${num(days)} روز اخیر</h2><div class="seg">
      ${[[7, '۷ روز'], [30, '۳۰ روز'], [90, '۹۰ روز']].map(([v, l]) => `<button type="button" data-days="${v}" class="${v === days ? 'on' : ''}" aria-pressed="${v === days}">${l}</button>`).join('')}</div></div>
    <div class="tiles">
      ${tile('بازدیدکننده', num(d.visitors), 'هر نفر روزی یه بار شمرده می‌شه')}
      ${tile('بازدید صفحه', num(d.views))}
      ${tile('صفحه به ازای هر نفر', d.visitors ? NF1.format(d.views / d.visitors) : '—')}
    </div>
    <div class="card sec" style="margin-top:10px"><div class="sec-head"><h2>بازدیدکننده‌های روزانه</h2></div>
      ${barChart(d.series, { key: 'visitors', cls: 'visits', fmt: (v) => `${num(v)} نفر`, unit: 'نفر' })}</div>
    <div class="cols" style="margin-top:10px">
      <div class="card"><div class="sec-head"><h2>محصول‌هایی که بیشتر دیده شدن</h2></div>
        ${d.products.length ? `<div class="list">${d.products.map((p, i) => `<a class="item" href="#/products/${esc(p.id)}">
          <span class="rank">${num(i + 1)}</span><img class="thumb s" src="${esc(img(p.img))}" alt="" loading="lazy">
          <div class="main-c"><div class="t">${esc(p.name)}</div></div><div class="end"><div class="t">${num(p.n)}</div><div class="s">بازدید</div></div></a>`).join('')}</div>`
    : '<p class="tiny">هنوز بازدیدی ثبت نشده.</p>'}</div>
      <div class="card"><div class="sec-head"><h2>صفحه‌ها</h2></div>
        ${d.pages.length ? `<table class="tbl"><tbody>${d.pages.map((r) => `<tr><td>${esc(label(r.page))}</td><td class="n">${num(r.n)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="tiny">هنوز بازدیدی ثبت نشده.</p>'}</div>
    </div>
    ${devicesCard(d.devices, d.visitors)}
    <p class="tiny" style="margin-top:14px">برای حریم خصوصی، آی‌پی هیچ‌کس ذخیره نمی‌شه و ربات‌های گوگل و بقیه شمرده نمی‌شن. اطلاعات دستگاه فقط از کسایی ثبت می‌شه که توی پیغام کوکی سایت «قبول دارم» رو زدن، و فقط به‌صورت آمار کلی روزانه.</p>`;
  drawCharts();
  main.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/traffic?d=${b.dataset.days}`; }));
}

/* Device counts from the cookie sheet. Each list is one quantity compared
   across a handful of values, so it is a ranked horizontal bar in the one
   visits hue — no legend, the words sit on the bars' own rows. */
function devicesCard(dv, visitors) {
  if (!dv) return '';
  const known = dv.known || 0;
  const asked = dv.consent.yes + dv.consent.no;
  const appN = (dv.app.find((r) => r.v === 'app') || {}).n || 0;
  const tiles = `<div class="tiles">
      ${tile('قبول کردن کوکی', asked ? PCT.format(dv.consent.yes / asked) : '—', asked ? `${num(dv.consent.yes)} از ${num(asked)} نفری که جواب دادن` : 'هنوز کسی جواب نداده')}
      ${tile('اطلاعات دستگاه داریم از', num(known), visitors ? `${PCT.format(Math.min(1, known / visitors))} بازدیدکننده‌ها` : 'نفر')}
      ${tile('باز کردن از اپ نصب‌شده', known ? PCT.format(appN / known) : '—', known ? `${num(appN)} نفر از صفحه‌ی اصلی گوشی` : '')}
    </div>`;
  if (!known) {
    return `<div class="card sec" style="margin-top:10px"><div class="sec-head"><h2>دستگاه بازدیدکننده‌ها</h2></div>${tiles}
      <p class="tiny" style="margin-top:12px">هنوز اطلاعات دستگاهی ثبت نشده. از وقتی بازدیدکننده‌ها پیغام کوکی رو قبول کنن، اینجا پر می‌شه.</p></div>`;
  }
  const list = (dim) => {
    const rows = dv[dim].filter((r) => r.n > 0);
    if (!rows.length) return '';
    const total = rows.reduce((a, r) => a + r.n, 0);
    const mx = Math.max(...rows.map((r) => r.n));
    return `<div class="dev-group"><h3>${esc(DEV[dim].t)}</h3><div class="hbar visits">
      ${rows.slice(0, 8).map((r) => `<div class="hbar-row"><span>${esc(DEV[dim].v[r.v] || r.v)}</span>
        <span class="track"><i class="fill" style="display:block;width:${Math.max(1.5, (r.n / mx) * 100)}%"></i></span>
        <span class="val">${num(r.n)} نفر، ${PCT.format(r.n / total)}</span></div>`).join('')}</div></div>`;
  };
  return `<div class="card sec" style="margin-top:10px"><div class="sec-head"><h2>دستگاه بازدیدکننده‌ها</h2></div>
    ${tiles}
    <p class="tiny" style="margin:10px 0 0">هر بازدیدکننده روزی یه بار شمرده می‌شه؛ درصد از کل همون فهرسته.</p>
    <div class="dev-grid">${['type', 'brand', 'os', 'browser', 'app', 'lang'].map(list).join('')}</div></div>`;
}


/* ===================================================== form uploads */
/** A multipart action with an upload progress bar (0…1). */
function postForm(fd, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', API);
    x.setRequestHeader('X-CSRF', S.csrf);
    x.timeout = 300000;
    x.upload.onprogress = (ev) => ev.lengthComputable && onProgress?.(ev.loaded / ev.total);
    x.onload = () => {
      let b = {};
      try { b = JSON.parse(x.responseText); } catch { /* */ }
      if (x.status === 200 && b.ok) resolve(b);
      else reject(new ApiError(b.error || 'server', x.status, b));
    };
    x.onerror = () => reject(new ApiError('network', 0));
    x.ontimeout = () => reject(new ApiError('network', 0));
    x.send(fd);
  });
}

const mb = (n) => `${NF1.format(n / 1048576)} مگابایت`;

/** Pick up to `max` products (visible ones), with a search. */
async function pickProducts(chosen, max, onDone) {
  if (!S.products) S.products = (await api('products')).products;
  const list = S.products.filter((p) => p.visible);
  let picked = [...chosen];
  const row = (p) => `<button type="button" class="item pick ${picked.includes(p.id) ? 'on' : ''}" data-pid="${esc(p.id)}">
    <img class="thumb s" src="${esc(img(p.images[0]))}" alt="" loading="lazy">
    <div class="main-c"><div class="t">${esc(p.name.fa)}</div><div class="s">${esc(toman(p.price))}</div></div>
    <span class="tick">${picked.includes(p.id) ? '✓' : ''}</span></button>`;
  openSheet(`<h2>${max === 1 ? 'یه محصول انتخاب کن' : `محصول‌ها (حداکثر ${num(max)})`}</h2>
    <div class="search" style="margin:10px 0">${icon('search')}<input class="input" id="pkq" type="search" placeholder="جستجوی اسم"></div>
    <div class="list pick-list" id="pkl">${list.map(row).join('')}</div>
    <div style="height:10px"></div><button class="btn block" type="button" id="pkok">تمام</button>`, (sheet, close) => {
    const box = sheet.querySelector('#pkl');
    const paint = (q = '') => {
      const w = q.trim().toLowerCase();
      box.innerHTML = list.filter((p) => !w || `${p.name.fa} ${p.name.en} ${p.id}`.toLowerCase().includes(w)).map(row).join('')
        || '<p class="tiny">چیزی پیدا نشد.</p>';
    };
    sheet.querySelector('#pkq').addEventListener('input', (e) => paint(e.target.value));
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pid]');
      if (!b) return;
      const id = b.dataset.pid;
      if (max === 1) { picked = [id]; close(); onDone(picked); return; }
      if (picked.includes(id)) picked = picked.filter((x) => x !== id);
      else if (picked.length < max) picked.push(id);
      else toast(`حداکثر ${num(max)} محصول.`, 'err');
      paint(sheet.querySelector('#pkq').value);
    });
    sheet.querySelector('#pkok').addEventListener('click', () => { close(); onDone(picked); });
  });
}

/* ============================================================= stories */
/* A story's button: none, one piece, one collection, or any https address
   (Instagram, WhatsApp, another site), with its own words. The shop shows it
   white under the story's text; the server refuses anything that is not a
   shop page or an http(s) address. */
const LK = [['', 'بدون دکمه'], ['p', 'رفتن به یه محصول'], ['c', 'رفتن به یه کالکشن'],
  ['url', 'باز کردن یه آدرس (اینستاگرام، واتساپ، سایت دیگه)']];
const lkKind = (u) => (!u ? '' : u.startsWith('#/p/') ? 'p' : u.startsWith('#/c/') ? 'c' : 'url');

/** Draws the button control into box and returns what it holds. onPick, when
    given, is called to choose the piece (a sheet has to reopen itself after
    the product list, which takes the sheet's place). */
let lkSeq = 0;
function wireLink(box, init, onPick) {
  const k = { kind: lkKind(init?.url), url: init?.url || '', label: { fa: '', en: '', tr: '', ...(init?.label || {}) } };
  /* The new-story form and an edit sheet can be on screen together: each
     control gets its own id, so a label never points at the other one. */
  const sel = `lkKind${++lkSeq}`;
  box.innerHTML = `<div class="field" data-field="link"><label for="${sel}">دکمه‌ی روی استوری (اختیاری)</label>
      <select class="input" id="${sel}" data-lk-kind>${LK.map(([v, l]) => `<option value="${v}" ${k.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="lk-body"></div><div class="msg"></div></div>`;
  const body = box.querySelector('.lk-body');
  const paint = () => {
    const by = Object.fromEntries((S.products || []).map((p) => [p.id, p]));
    const words = `<div class="field" style="margin:12px 0 0"><label>متن روی دکمه</label>
        <input class="input" data-lw="fa" maxlength="30" value="${esc(k.label.fa)}"
          placeholder="${k.kind === 'p' ? 'مثلاً: خرید همین مدل' : k.kind === 'c' ? 'مثلاً: دیدن کالکشن' : 'مثلاً: پیج اینستاگرام'}">
        <p class="hint" style="margin:6px 0 0">خالی بمونه، روی دکمه نوشته می‌شه «ببین».</p></div>
      <details class="more"><summary>متن دکمه به انگلیسی و ترکی${icon('chevD', 18)}</summary><div class="in"><div class="row2">
        <div class="field"><label>انگلیسی</label><input class="input ltr-in" data-lw="en" maxlength="30" value="${esc(k.label.en)}"></div>
        <div class="field"><label>ترکی</label><input class="input ltr-in" data-lw="tr" maxlength="30" value="${esc(k.label.tr)}"></div></div></div></details>`;
    if (k.kind === 'p') {
      const id = k.url.slice(4);
      body.innerHTML = `<div class="st-items" style="margin-top:10px">${id ? `<span class="chip on">${esc(by[id]?.name.fa || id)}</span>` : ''}</div>
        <button class="btn line s" type="button" data-lk-pick>${icon('plus', 18)}${id ? 'عوض کردن محصول' : 'انتخاب محصول'}</button>${words}`;
    } else if (k.kind === 'c') {
      body.innerHTML = `<select class="input" data-lk-col style="margin-top:10px" aria-label="کالکشن">
          <option value="">یه کالکشن انتخاب کن</option>
          ${COLS.filter(([v]) => v).map(([v, l]) => `<option value="${v}" ${k.url === `#/c/${v}` ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>${words}`;
    } else if (k.kind === 'url') {
      body.innerHTML = `<input class="input ltr-in" type="url" inputmode="url" data-lk-url maxlength="300" style="margin-top:10px"
          placeholder="https://instagram.com/tiffanyiran" aria-label="آدرس" value="${esc(k.url.startsWith('#/') ? '' : k.url)}">${words}`;
    } else body.innerHTML = '';
  };
  box.querySelector('[data-lk-kind]').addEventListener('change', (e) => {
    if (e.target.value !== k.kind) { k.kind = e.target.value; k.url = ''; }
    paint();
  });
  body.addEventListener('input', (e) => {
    if (e.target.dataset.lw) k.label[e.target.dataset.lw] = e.target.value;
    if (e.target.matches('[data-lk-url]')) k.url = e.target.value.trim();
  });
  body.addEventListener('change', (e) => {
    if (e.target.matches('[data-lk-col]')) k.url = e.target.value ? `#/c/${e.target.value}` : '';
  });
  body.addEventListener('click', (e) => {
    if (!e.target.closest('[data-lk-pick]')) return;
    const cur = k.url.startsWith('#/p/') ? [k.url.slice(4)] : [];
    if (onPick) { onPick(k, cur); return; }
    pickProducts(cur, 1, (ids) => { if (ids[0]) k.url = `#/p/${ids[0]}`; paint(); });
  });
  paint();
  return {
    /** {} for no button; throws, with the words to show, when half filled in. */
    get() {
      if (!k.kind) return {};
      if (!k.url) {
        throw new Error(k.kind === 'p' ? 'برای دکمه یه محصول انتخاب کن.' : k.kind === 'c' ? 'برای دکمه یه کالکشن انتخاب کن.'
          : 'آدرس دکمه رو بنویس.');
      }
      if (k.kind === 'url' && !/^https?:\/\/[^\s"'<>`]+\.[^\s"'<>`]+$/i.test(k.url)) {
        throw new Error('آدرس باید کامل باشه و با https:// شروع بشه؛ مثلاً https://instagram.com/tiffanyiran');
      }
      return { url: k.url, label: { fa: k.label.fa.trim(), en: k.label.en.trim(), tr: k.label.tr.trim() } };
    },
    state: () => ({ url: k.url, label: { ...k.label } }),
  };
}
const linkErr = (form, err) => {
  const f = form.querySelector('[data-field="link"]');
  f?.classList.add('err');
  const m = f?.querySelector('.msg');
  if (m) m.textContent = err.message;
  f?.scrollIntoView({ block: 'center', behavior: 'smooth' });
};

/* A story is a photo or a video, up for 24 hours on the shop's home page
   (the strip and the hero's «استوری‌ها»), ahead of the campaign looks.
   Pieces can be tagged on it, like the looks. After 24 hours it moves to the
   archive here, where it can go up again for another 24. */
const left = (ts) => {
  const s = ts - Date.now() / 1000;
  if (s <= 0) return 'تموم شده';
  if (s < 3600) return `${num(Math.ceil(s / 60))} دقیقه مونده`;
  return `${num(Math.floor(s / 3600))} ساعت مونده`;
};
const storyThumb = (st) => {
  const base = st.kind === 'image' ? st.media : st.poster;
  return base ? `<img src="../${esc(base)}-540.webp" alt="" loading="lazy">` : `<span class="st-vid">${icon('play', 22)}</span>`;
};

/** A video's own size and a cover frame, made in this browser. Null when the
    browser cannot decode the video (the story still goes up, without a cover). */
function videoCover(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    let done = false;
    const end = (r) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(r); };
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    v.addEventListener('loadedmetadata', () => {
      const t = Math.min(0.5, (v.duration || 1) / 3);
      try { v.currentTime = t; } catch { end(null); }
    });
    v.addEventListener('seeked', () => {
      try {
        const c = document.createElement('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        c.toBlob((b) => end(b ? { blob: b, w: v.videoWidth, h: v.videoHeight, secs: v.duration } : null), 'image/jpeg', 0.86);
      } catch { end(null); }
    });
    v.addEventListener('error', () => end(null));
    setTimeout(() => end(null), 8000);
  });
}

async function viewStories(_, q, signal) {
  setTitle('استوری‌ها');
  const d = await api('stories');
  if (!S.products) S.products = (await api('products')).products;
  if (signal.aborted) return;
  const LE = d.looks || {};
  const card = (st, live) => `<div class="st-card" data-sid="${st.id}">
    <div class="st-ph">${storyThumb(st)}${st.kind === 'video' ? '<span class="pill hidden-p st-k">ویدیو</span>' : ''}</div>
    <div class="st-body">
      <div class="t">${esc(st.caption.fa || 'بدون متن')}</div>
      <div class="s">${live ? `${icon('clock', 14)} ${esc(left(st.expires_at))}` : esc(ago(st.expires_at))} · ${num(st.items.length)} محصول${st.link?.url ? ' · دکمه' : ''}${st.by ? ` · ${esc(st.by)}` : ''}</div>
      <div class="st-acts">
        <button class="btn line s" type="button" data-st="edit">ویرایش</button>
        ${live ? '<button class="btn line s" type="button" data-st="end">برداشتن از سایت</button>'
    : `<button class="btn line s" type="button" data-st="repost">${icon('repeat', 16)}دوباره، ۲۴ ساعت</button>`}
        <button class="btn line s danger-t" type="button" data-st="delete" aria-label="حذف">${icon('trash', 16)}</button>
      </div></div></div>`;
  main.innerHTML = `
    <form class="card st-new" id="stNew" novalidate>
      <div class="sec-head"><h2>استوری جدید</h2></div>
      <p class="hint" style="margin-top:-4px">عکس یا ویدیوی عمودی (۹ به ۱۶). ۲۴ ساعت روی صفحه‌ی اول سایت می‌مونه، بعد خودش می‌ره توی آرشیو.
        ویدیو MP4، تا ${esc(mb(d.cap))}. توی آیفون اگه ویدیو قبول نشد: Settings ← Camera ← Formats ← Most Compatible.</p>
      <div class="st-pick" data-field="media">
        <button class="add-photo st-drop" type="button" id="stPick">${icon('camera')}<span>انتخاب عکس یا ویدیو</span></button>
        <div class="st-prev" id="stPrev" hidden></div>
        <div class="msg"></div>
      </div>
      <input type="file" id="stFile" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" hidden>
      ${field('caption_fa', 'متن روی استوری (اختیاری)', '<input class="input" id="f-caption_fa" name="caption_fa" maxlength="140" placeholder="مثلاً: رسید جدید پاییزه">')}
      <details class="more"><summary>متن انگلیسی و ترکی (اختیاری)${icon('chevD', 18)}</summary><div class="in">
        <div class="row2"><div class="field"><label>انگلیسی</label><input class="input ltr-in" name="caption_en" maxlength="140"></div>
        <div class="field"><label>ترکی</label><input class="input ltr-in" name="caption_tr" maxlength="140"></div></div></div></details>
      <div class="field" data-field="items"><label>محصول‌های توی استوری (اختیاری، تا ۶ تا)</label>
        <div class="st-items" id="stItems"></div>
        <button class="btn line s" type="button" id="stAddItems">${icon('plus', 18)}انتخاب محصول</button><div class="msg"></div></div>
      <div id="stLinkBox"></div>
      <div class="bar st-bar" id="stBar" hidden><i></i></div>
      <button class="btn block" type="submit" id="stGo" disabled>انتشار برای ۲۴ ساعت</button>
    </form>
    <section class="sec"><div class="sec-head"><h2>الان توی سایت</h2><span class="tiny">${num(d.live.length)} استوری</span></div>
      ${d.live.length ? `<div class="st-grid">${d.live.map((x) => card(x, true)).join('')}</div>`
    : '<p class="tiny">الان استوری‌ای توی سایت نیست؛ فقط استوری‌های کمپین (پایین) نشون داده می‌شن.</p>'}</section>
    <section class="sec"><div class="sec-head"><h2>استوری‌های کمپین</h2><span class="tiny">همیشه توی سایت، بعد از استوری‌های ۲۴ ساعته</span></div>
      <p class="hint" style="margin-top:-4px">عکس‌های کالکشن. برای هرکدوم می‌تونی عنوان و متن رو عوض کنی، محصول‌هاش رو انتخاب کنی، دکمه بذاری یا مخفیش کنی.</p>
      <div class="st-grid">${LOOK_DEFS.map((def) => {
    const e = LE[def.id] || {};
    const n = (Array.isArray(e.items) ? e.items : def.items).length;
    return `<div class="st-card" data-lid="${esc(def.id)}">
        <div class="st-ph"><img src="../assets/img/${esc(def.img)}-720.webp" alt="" loading="lazy">${e.hidden ? '<span class="pill hidden-p st-k">مخفی</span>' : ''}</div>
        <div class="st-body"><div class="t">${esc(e.title?.fa || def.t[0])}</div>
          <div class="s">${num(n)} محصول${e.link ? ' · دکمه' : ''}${Object.keys(e).length ? ' · تغییر داده شده' : ''}</div>
          <div class="st-acts"><button class="btn line s" type="button" data-look-edit>ویرایش</button></div></div></div>`;
  }).join('')}</div></section>
    <section class="sec"><div class="sec-head"><h2>آرشیو</h2><span class="tiny">بعد از ۲۴ ساعت این‌جا میان</span></div>
      ${d.archive.length ? `<div class="st-grid">${d.archive.map((x) => card(x, false)).join('')}</div>` : '<p class="tiny">هنوز خالیه.</p>'}</section>`;

  const form = $('#stNew');
  let file = null;
  let cover = null;
  let items = [];
  const paintItems = () => {
    const by = Object.fromEntries((S.products || []).map((p) => [p.id, p]));
    $('#stItems').innerHTML = items.map((id) => `<span class="chip on">${esc(by[id]?.name.fa || id)}
      <button type="button" data-rmi="${esc(id)}" aria-label="برداشتن">${icon('close', 14)}</button></span>`).join('');
  };
  $('#stItems').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rmi]');
    if (b) { items = items.filter((x) => x !== b.dataset.rmi); paintItems(); }
  });
  $('#stAddItems').addEventListener('click', () => pickProducts(items, 6, (ids) => { items = ids; paintItems(); }));
  const link = wireLink($('#stLinkBox'), null);
  $('#stPick').addEventListener('click', () => $('#stFile').click());
  $('#stFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    showErrors(form, null);
    if (f.size > d.cap) {
      showErrors(form, new ApiError('invalid', 422, { field: 'media', message: `فایل بزرگ‌تر از ${mb(d.cap)}ه.` }));
      return;
    }
    file = f.type.startsWith('image/') ? await shrink(f) : f;
    cover = null;
    const prev = $('#stPrev');
    const url = URL.createObjectURL(file);
    prev.hidden = false;
    prev.innerHTML = file.type.startsWith('video/')
      ? `<video src="${url}" muted playsinline controls></video>` : `<img src="${url}" alt="">`;
    prev.insertAdjacentHTML('beforeend', `<button class="btn quiet s" type="button" id="stAgain">عوض کردن</button>`);
    $('#stAgain').addEventListener('click', () => $('#stFile').click());
    $('#stPick').hidden = true;
    if (file.type.startsWith('video/')) cover = await videoCover(file);
    $('#stGo').disabled = false;
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!file) return;
    showErrors(form, null);
    let lk;
    try { lk = link.get(); } catch (err) { linkErr(form, err); return; }
    const fd = new FormData(form);
    fd.append('a', 'story_add');
    fd.append('items', JSON.stringify(items));
    fd.append('link', JSON.stringify(lk));
    fd.append('media', file, file.name || 'story');
    if (cover) {
      fd.append('poster', cover.blob, 'cover.jpg');
      fd.append('w', String(cover.w));
      fd.append('h', String(cover.h));
    }
    const btn = $('#stGo');
    const bar = $('#stBar');
    btn.disabled = true;
    bar.hidden = false;
    try {
      await postForm(fd, (x) => { bar.querySelector('i').style.width = `${Math.round(x * 100)}%`; });
      toast('استوری منتشر شد؛ تا ۲۴ ساعت توی سایته.');
      route();
    } catch (err) {
      bar.hidden = true;
      btn.disabled = false;
      if (!showErrors(form, err)) toast(say(err), 'err');
    }
  });

  main.addEventListener('click', async (e) => {
    const le = e.target.closest('[data-look-edit]');
    if (le) {
      const def = LOOK_DEFS.find((x) => x.id === le.closest('[data-lid]').dataset.lid);
      if (def) lookSheet(def, LE[def.id] || null);
      return;
    }
    const b = e.target.closest('[data-st]');
    if (!b) return;
    const id = Number(b.closest('[data-sid]').dataset.sid);
    const st = [...d.live, ...d.archive].find((x) => x.id === id);
    const act = b.dataset.st;
    try {
      if (act === 'end') {
        if (!confirm('این استوری از سایت برداشته بشه؟ توی آرشیو می‌مونه.')) return;
        await api('story_end', { id });
        toast('از سایت برداشته شد');
      } else if (act === 'repost') {
        await api('story_repost', { id });
        toast('دوباره منتشر شد، برای ۲۴ ساعت');
      } else if (act === 'delete') {
        if (!confirm('این استوری برای همیشه حذف بشه؟ فایلش هم پاک می‌شه.')) return;
        await api('story_delete', { id });
        toast('حذف شد');
      } else if (act === 'edit') {
        storySheet(st);
        return;
      }
      route();
    } catch { /* toast shown */ }
  }, { signal });
}

function storySheet(st) {
  let items = [...st.items];
  let link = null;
  openSheet(`<h2>ویرایش استوری</h2>
    <form id="stEd" novalidate>
      ${field('caption_fa', 'متن روی استوری', `<input class="input" name="fa" maxlength="140" value="${esc(st.caption.fa)}">`)}
      <div class="row2"><div class="field"><label>انگلیسی</label><input class="input ltr-in" name="en" maxlength="140" value="${esc(st.caption.en)}"></div>
        <div class="field"><label>ترکی</label><input class="input ltr-in" name="tr" maxlength="140" value="${esc(st.caption.tr)}"></div></div>
      <div class="field" data-field="items"><label>محصول‌ها</label><div class="st-items" id="edItems"></div>
        <button class="btn line s" type="button" id="edPick">${icon('plus', 18)}انتخاب محصول</button><div class="msg"></div></div>
      <div id="edLinkBox"></div>
      <button class="btn block" type="submit">ذخیره</button>
    </form>`, async (sheet, close) => {
    if (!S.products) S.products = (await api('products')).products;
    const by = Object.fromEntries(S.products.map((p) => [p.id, p]));
    const paint = () => { sheet.querySelector('#edItems').innerHTML = items.map((id) => `<span class="chip on">${esc(by[id]?.name.fa || id)}</span>`).join(''); };
    paint();
    const form = sheet.querySelector('#stEd');
    const keep = () => ({ fa: form.fa.value, en: form.en.value, tr: form.tr.value });
    link = wireLink(sheet.querySelector('#edLinkBox'), st.link, (k, cur) => {
      const caption = keep();
      pickProducts(cur, 1, (ids) => storySheet({ ...st, items, caption,
        link: { url: ids[0] ? `#/p/${ids[0]}` : k.url, label: { ...k.label } } }));
    });
    sheet.querySelector('#edPick').addEventListener('click', () => {
      const caption = keep();
      const lk = link.state();
      pickProducts(items, 6, (ids) => { items = ids; storySheet({ ...st, items, caption, link: lk }); });
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      showErrors(f, null);
      let lk;
      try { lk = link.get(); } catch (err) { linkErr(f, err); return; }
      try {
        await api('story_edit', { id: st.id, caption: { fa: f.fa.value, en: f.en.value, tr: f.tr.value }, items, link: lk });
        toast('ذخیره شد');
        close();
        route();
      } catch (err) { showErrors(f, err); }
    });
  });
}

/* The studio's outfit stories (js/looks-data.js). What is saved here is laid
   over the story on the shop; «برگردوندن به حالت اول» drops it. Fields left as
   they came are not saved, so a later change in the code still shows. */
function lookSheet(def, edits, draft) {
  const e = draft || edits || {};
  const t = e.title || { fa: def.t[0], en: def.t[1], tr: def.t[2] };
  const c = e.caption || { fa: '', en: '', tr: '' };
  let items = Array.isArray(e.items) ? [...e.items] : [...def.items];
  let link = null;
  const input = (name, v, ltr = false, max = 60, ph = '') => `<input class="input${ltr ? ' ltr-in' : ''}" name="${name}" maxlength="${max}"
    value="${esc(v || '')}"${ph ? ` placeholder="${esc(ph)}"` : ''}>`;
  openSheet(`<h2>استوری کمپین</h2>
    <form id="lkEd" novalidate>
      <div class="lk-head"><img src="../assets/img/${esc(def.img)}-720.webp" alt="">
        <p class="hint">این استوری همیشه توی سایته. هر چیزی این‌جا عوض کنی، همون لحظه توی سایت عوض می‌شه.</p></div>
      ${field('title', 'عنوان', input('tfa', t.fa))}
      <details class="more"><summary>عنوان به انگلیسی و ترکی${icon('chevD', 18)}</summary><div class="in"><div class="row2">
        <div class="field"><label>انگلیسی</label>${input('ten', t.en, true)}</div>
        <div class="field"><label>ترکی</label>${input('ttr', t.tr, true)}</div></div></div></details>
      ${field('caption', 'متن زیر عنوان (اختیاری)', input('cfa', c.fa, false, 140, 'کالکشن جدید پاییز و زمستون.'))}
      <details class="more"><summary>متن به انگلیسی و ترکی${icon('chevD', 18)}</summary><div class="in"><div class="row2">
        <div class="field"><label>انگلیسی</label>${input('cen', c.en, true, 140)}</div>
        <div class="field"><label>ترکی</label>${input('ctr', c.tr, true, 140)}</div></div></div></details>
      <div class="field" data-field="items"><label>محصول‌های این استوری (تا ۸ تا)</label><div class="st-items" id="lkItems"></div>
        <button class="btn line s" type="button" id="lkPick">${icon('plus', 18)}انتخاب محصول</button><div class="msg"></div></div>
      <div id="lkLinkBox"></div>
      <label class="switch" style="margin:6px 0 14px"><span>نمایش توی سایت<br><span class="tiny">خاموش باشه، این استوری توی سایت دیده نمی‌شه.</span></span>
        <input type="checkbox" name="show" ${e.hidden ? '' : 'checked'}><span class="knob"></span></label>
      <button class="btn block" type="submit">ذخیره</button>
      ${edits ? '<button class="btn quiet block" type="button" id="lkReset" style="margin-top:8px">برگردوندن به حالت اول</button>' : ''}
    </form>`, async (sheet, close) => {
    if (!S.products) S.products = (await api('products')).products;
    const by = Object.fromEntries(S.products.map((p) => [p.id, p]));
    const form = sheet.querySelector('#lkEd');
    const paint = () => {
      sheet.querySelector('#lkItems').innerHTML = items.map((id) => `<span class="chip on">${esc(by[id]?.name.fa || id)}</span>`).join('')
        || '<span class="tiny">هیچ محصولی</span>';
    };
    paint();
    const now = () => ({
      title: { fa: form.tfa.value, en: form.ten.value, tr: form.ttr.value },
      caption: { fa: form.cfa.value, en: form.cen.value, tr: form.ctr.value },
      items, link: link.state(), hidden: !form.show.checked,
    });
    link = wireLink(sheet.querySelector('#lkLinkBox'), e.link, (k, cur) => {
      const d = now();
      pickProducts(cur, 1, (ids) => lookSheet(def, edits, { ...d,
        link: { url: ids[0] ? `#/p/${ids[0]}` : k.url, label: { ...k.label } } }));
    });
    sheet.querySelector('#lkPick').addEventListener('click', () => {
      const d = now();
      pickProducts(items, 8, (ids) => lookSheet(def, edits, { ...d, items: ids }));
    });
    sheet.querySelector('#lkReset')?.addEventListener('click', async () => {
      if (!confirm('همه‌ی تغییرهای این استوری پاک بشه و مثل اول بشه؟')) return;
      try {
        await api('look_reset', { id: def.id });
        toast('به حالت اول برگشت');
        close();
        route();
      } catch { /* toast shown */ }
    });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      showErrors(form, null);
      const look = {};
      const ti = { fa: form.tfa.value.trim(), en: form.ten.value.trim(), tr: form.ttr.value.trim() };
      if (!ti.fa) {
        showErrors(form, new ApiError('invalid', 422, { field: 'title', message: 'عنوان فارسی رو بنویس.' }));
        return;
      }
      if (ti.fa !== def.t[0] || ti.en !== def.t[1] || ti.tr !== def.t[2]) look.title = ti;
      const ca = { fa: form.cfa.value.trim(), en: form.cen.value.trim(), tr: form.ctr.value.trim() };
      if (ca.fa || ca.en || ca.tr) look.caption = ca;
      if (items.join(',') !== def.items.join(',')) look.items = items;
      try { const lk = link.get(); if (lk.url) look.link = lk; } catch (err) { linkErr(form, err); return; }
      if (!form.show.checked) look.hidden = true;
      try {
        await api('look_save', { id: def.id, look });
        toast(Object.keys(look).length ? 'ذخیره شد' : 'ذخیره شد؛ مثل حالت اوله');
        close();
        route();
      } catch (err) { if (!showErrors(form, err)) toast(say(err), 'err'); }
    });
  });
}

/* ============================================================= tickets */
/* Customers write from the shop's Tickets tab (signed in with their mobile
   number). Only the team answers, here. A customer's new message puts the
   ticket back in «منتظر جواب» and on the badge; an answer from here marks it
   «جواب داده شد» and, once the studio's SMS template is set, texts them. */
const TSTATUS = { open: 'منتظر جواب', answered: 'جواب داده شد', closed: 'بسته' };
const TPILL = { open: 'new', answered: 'delivered', closed: 'cancelled' };
const KIND = { image: 'عکس', voice: 'پیام صوتی', audio: 'فایل صوتی', video: 'ویدیو', file: 'فایل' };
const kb = (n) => (n >= 1048576 ? `${NF1.format(n / 1048576)} مگابایت` : `${num(Math.max(1, n / 1024))} کیلوبایت`);

async function viewTickets(_, q, signal) {
  setTitle('تیکت‌ها');
  const status = q.get('status') || '';
  const search = q.get('q') || '';
  const d = await api('tickets', { status, q: search });
  if (signal.aborted) return;
  setTBadge(d.counts.open || 0);
  const all = Object.values(d.counts).reduce((a, b) => a + b, 0);
  main.innerHTML = `
    <div class="toolbar"><div class="search">${icon('search')}<input class="input" id="tq" type="search"
      placeholder="کد تیکت، اسم، موبایل یا موضوع" value="${esc(search)}" aria-label="جستجو"></div></div>
    <div class="chips" style="margin-bottom:12px">
      <button class="chip ${status ? '' : 'on'}" data-ts="">همه <b>${num(all)}</b></button>
      ${Object.keys(TSTATUS).map((k) => `<button class="chip ${status === k ? 'on' : ''}" data-ts="${k}">${TSTATUS[k]} <b>${num(d.counts[k] || 0)}</b></button>`).join('')}
    </div>
    ${d.tickets.length ? `<div class="list">${d.tickets.map((t) => `
      <a class="item tk-it ${t.unread ? 'unread' : ''}" href="#/tickets/${esc(t.code)}">
        <div class="main-c"><div class="t">${t.unread ? '<i class="udot"></i>' : ''}${esc(t.subject)}</div>
          <div class="s">${esc(t.name)} · <span class="ltr">${esc(t.phone)}</span> · ${t.last_from === 's' ? 'تیم: ' : ''}${esc(t.last || KIND[t.last_kind] || '')}</div></div>
        <div class="end"><span class="pill ${TPILL[t.status]}">${TSTATUS[t.status]}</span>
          <div class="s">${esc(ago(t.updated_at))} · <span class="ltr">${esc(t.code)}</span></div></div></a>`).join('')}</div>`
    : `<div class="empty">${icon('ticket')}<h3>${search || status ? 'چیزی پیدا نشد' : 'هنوز تیکتی نیومده'}</h3>
        <p>${search || status ? 'فیلتر یا جستجو رو عوض کن.' : 'مشتری‌ها از صفحه‌ی «Tickets» سایت، بعد از ورود با موبایلشون، تیکت می‌فرستن.'}</p></div>`}`;
  main.querySelectorAll('[data-ts]').forEach((c) => c.addEventListener('click', () => {
    const p = new URLSearchParams();
    if (c.dataset.ts) p.set('status', c.dataset.ts);
    if (search) p.set('q', search);
    location.hash = `#/tickets${p.toString() ? `?${p}` : ''}`;
  }));
  let st;
  $('#tq').addEventListener('input', (e) => {
    clearTimeout(st);
    st = setTimeout(() => {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (e.target.value.trim()) p.set('q', e.target.value.trim());
      location.hash = `#/tickets${p.toString() ? `?${p}` : ''}`;
    }, 450);
  });
  if (search) { const i = $('#tq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

function tFile(f) {
  const url = esc(f.url);
  if (f.kind === 'image') return `<a class="tm-img" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${esc(f.name)}" loading="lazy"></a>`;
  if (f.kind === 'audio') {
    return `<div class="tm-audio"><span class="tiny">${icon('mic', 14)} ${f.voice ? 'پیام صوتی' : esc(f.name)}${f.secs ? ` · ${clock(f.secs, num)}` : ''}</span>
      <audio controls preload="none" src="${url}"></audio><a class="tiny link" href="${url}" download="${esc(f.name)}">دانلود</a></div>`;
  }
  if (f.kind === 'video') return `<div class="tm-audio"><video controls playsinline preload="metadata" src="${url}"></video><a class="tiny link" href="${url}" download="${esc(f.name)}">دانلود ویدیو</a></div>`;
  return `<a class="tm-file" href="${url}" download="${esc(f.name)}">${icon('doc', 18)}<span><b>${esc(f.name)}</b><span class="tiny">${kb(f.size)}</span></span>${icon('down', 16)}</a>`;
}

function tMessages(d) {
  return d.messages.map((m) => {
    const p = m.product ? d.products?.[m.product] : null;
    return `<div class="tm ${m.side === 's' ? 'staff' : 'cust'}">
      <span class="tm-who">${m.side === 's' ? esc(m.author || 'تیم') : esc(d.customer.name)}</span>
      ${p ? `<a class="tm-prod" href="#/products/${esc(p.id)}"><img class="thumb s" src="${esc(img(p.img))}" alt="">
        <span><b>${esc(p.name.fa)}</b><span class="tiny">${esc(toman(p.price))}${p.visible ? '' : ' · مخفی'}</span></span></a>` : ''}
      ${m.files.length ? `<div class="tm-files">${m.files.map(tFile).join('')}</div>` : ''}
      ${m.body ? `<p class="tm-body">${esc(m.body)}</p>` : ''}
      <span class="tm-at">${esc(D_TIME.format(new Date(m.at * 1000)))}</span></div>`;
  }).join('');
}

async function viewTicket([code], q, signal) {
  let d = await api('ticket', { code });
  if (signal.aborted) return;
  const t = () => d.ticket;
  setTitle(t().subject, '#/tickets');
  ping();
  main.innerHTML = `
    <div class="card tk-headc">
      <div class="tk-top"><div><h2>${esc(t().subject)}</h2>
        <p class="tiny"><span class="ltr">${esc(t().code)}</span> · ${esc(D_TIME.format(new Date(t().created_at * 1000)))}</p></div>
        <span class="pill" id="tkPill"></span></div>
      <div class="tk-cust">
        <span>${icon('users', 18)} ${esc(d.customer.name)}</span>
        <a class="callme" href="tel:${esc(d.customer.phone)}">${icon('phone', 15)}<span class="ltr">${esc(d.customer.phone)}</span></a>
        <a class="link" href="#/customers/${esc(d.customer.phone)}">${num(d.customer.orders)} سفارش</a>
      </div>
      <div class="actions" style="margin-top:12px" id="tkActs"></div>
    </div>
    <div class="tmsgs" id="tmsgs"></div>
    <form class="card treply" id="treply" novalidate>
      <div class="field" data-field="body" style="margin:0"><textarea class="input" id="f-body" name="body" rows="3" placeholder="جوابت رو بنویس…"></textarea><div class="msg"></div></div>
      <div class="tchips" id="tchips"></div>
      <div class="trec" id="trec" hidden><i class="rec-dot"></i><b id="trecT">0:00</b><span class="tiny">در حال ضبط…</span>
        <button class="btn quiet s" type="button" data-t="cancel">لغو</button><button class="btn s" type="button" data-t="stop">تمام</button></div>
      <div class="tbar" id="tbar">
        <button class="btn line s" type="button" data-t="file">${icon('clip', 17)}فایل یا عکس</button>
        <button class="btn line s" type="button" data-t="product">${icon('hanger', 17)}محصول</button>
        ${canRecord() ? `<button class="btn line s" type="button" data-t="mic">${icon('mic', 17)}پیام صوتی</button>` : ''}
        <button class="btn s grow" type="submit" id="tsend">فرستادن جواب</button>
      </div>
      <div class="bar" id="tprog" hidden><i></i></div>
      <p class="hint" id="tnote" style="margin:8px 0 0"></p>
      <input type="file" id="tfile" multiple hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt">
    </form>`;

  const paint = (scroll) => {
    $('#tkPill').className = `pill ${TPILL[t().status]}`;
    $('#tkPill').textContent = TSTATUS[t().status];
    $('#tkActs').innerHTML = t().status === 'closed'
      ? '<button class="btn line s" type="button" data-tst="open">باز کردن دوباره</button>'
      : '<button class="btn line s" type="button" data-tst="closed">بستن تیکت</button>';
    $('#tmsgs').innerHTML = tMessages(d);
    $('#tnote').textContent = d.notify
      ? 'مشتری با پیامک خبردار می‌شه که جواب دادی (هر تیکت حداکثر یه پیامک در ۱۵ دقیقه).'
      : 'جواب توی بخش تیکت‌های سایت به مشتری نشون داده می‌شه. (پیامک خبر جواب هنوز تنظیم نشده.)';
    if (scroll) $('#treply').scrollIntoView({ block: 'end' });
  };
  paint(true);

  main.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tst]');
    if (!b) return;
    try {
      d = await api('ticket_status', { code: t().code, status: b.dataset.tst });
      toast(t().status === 'closed' ? 'تیکت بسته شد' : 'تیکت دوباره باز شد');
      paint(false);
      ping();
    } catch { /* toast shown */ }
  }, { signal });

  /* the reply box */
  const caps = d.caps || { file: 5e6, files: 6 };
  const c = { files: [], voice: null, product: '' };
  let rec = null;
  const form = $('#treply');
  const chips = () => {
    const by = Object.fromEntries((S.products || []).map((p) => [p.id, p]));
    $('#tchips').innerHTML = [
      c.product ? `<span class="chip on">${icon('hanger', 15)}${esc(by[c.product]?.name.fa || c.product)}<button type="button" data-rm="p">${icon('close', 14)}</button></span>` : '',
      ...c.files.map((f, i) => `<span class="chip on">${esc(f.name)} · ${kb(f.size)}<button type="button" data-rm="${i}">${icon('close', 14)}</button></span>`),
      c.voice ? `<span class="chip on">${icon('mic', 15)}پیام صوتی · ${clock(c.voice.secs, num)}<button type="button" data-rm="v">${icon('close', 14)}</button></span>` : '',
    ].join('');
  };
  $('#tfile').addEventListener('change', async (e) => {
    for (const f0 of [...e.target.files]) {
      if (c.files.length >= caps.files) { toast(`هر پیام حداکثر ${num(caps.files)} فایل.`, 'err'); break; }
      const f = await shrink(f0);
      if (f.size > caps.file) { toast(`«${f.name}» بزرگ‌تر از ${mb(caps.file)}ه.`, 'err'); continue; }
      c.files.push(f);
    }
    e.target.value = '';
    chips();
  });
  form.addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const k = rm.dataset.rm;
      if (k === 'p') c.product = ''; else if (k === 'v') c.voice = null; else c.files.splice(Number(k), 1);
      chips();
      return;
    }
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const act = b.dataset.t;
    if (act === 'file') $('#tfile').click();
    else if (act === 'product') pickProducts(c.product ? [c.product] : [], 1, (ids) => { c.product = ids[0] || ''; chips(); });
    else if (act === 'mic') {
      try {
        rec = await record({ max: 300, onTick: (s) => { $('#trecT').textContent = clock(s, num); }, onAutoStop: () => form.querySelector('[data-t="stop"]').click() });
        $('#trec').hidden = false;
        $('#tbar').hidden = true;
      } catch { toast('اجازه‌ی میکروفون داده نشد.', 'err'); }
    } else if (act === 'stop' && rec) {
      const v = await rec.stop();
      rec = null;
      $('#trec').hidden = true;
      $('#tbar').hidden = false;
      if (v.secs >= 1 && v.blob.size) c.voice = v;
      chips();
    } else if (act === 'cancel' && rec) {
      rec.cancel();
      rec = null;
      $('#trec').hidden = true;
      $('#tbar').hidden = false;
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = form.body.value.trim();
    if (!body && !c.files.length && !c.voice && !c.product) {
      showErrors(form, new ApiError('invalid', 422, { field: 'body', message: 'جواب رو بنویس، یا فایل یا پیام صوتی بذار.' }));
      return;
    }
    const fd = new FormData();
    fd.append('a', 'ticket_reply');
    fd.append('code', t().code);
    fd.append('body', body);
    fd.append('product', c.product);
    c.files.forEach((f) => fd.append('files[]', f, f.name));
    if (c.voice) {
      const ext = c.voice.mime.includes('mp4') ? 'm4a' : c.voice.mime.includes('ogg') ? 'ogg' : 'webm';
      fd.append('voice', c.voice.blob, `voice.${ext}`);
      fd.append('voice_secs', String(c.voice.secs));
    }
    const btn = $('#tsend');
    const bar = $('#tprog');
    btn.disabled = true;
    bar.hidden = false;
    try {
      d = await postForm(fd, (x) => { bar.querySelector('i').style.width = `${Math.round(x * 100)}%`; });
      form.reset();
      c.files = []; c.voice = null; c.product = '';
      chips();
      showErrors(form, null);
      toast('جواب فرستاده شد');
      paint(true);
      ping();
    } catch (err) {
      if (!showErrors(form, err)) toast(say(err), 'err');
    } finally { btn.disabled = false; bar.hidden = true; }
  });

  /* A new message from the customer while this is open shows up by itself. */
  const timer = setInterval(async () => {
    if (document.hidden) return;
    try {
      const fresh = await api('ticket', { code: t().code }, { quiet: true });
      if (fresh.messages.length !== d.messages.length) { d = fresh; paint(true); }
    } catch { /* next time */ }
  }, 20000);
  signal.addEventListener('abort', () => { clearInterval(timer); rec?.cancel(); });
}

/* ============================================================= settings */
/* Card-to-card («تأیید شد»): the CEO pastes the API key and the webhook
   secret here (each kept only when a new one is typed; only the last four
   characters ever come back), switches it on, and checks the connection. */
function payCard(p) {
  const a = p.account;
  const conn = !p.mode ? 'هنوز کلید API گذاشته نشده.'
    : !a ? 'هنوز بررسی نشده.'
      : a.ok ? `وصله به «${esc(a.shop || '—')}» · ${a.mode === 'test' ? 'آزمایشی' : 'اصلی'} · سفارش واقعی: ${a.open ? 'بازه' : `متوقفه${a.reason ? ` (${esc(a.reason)})` : ''}`}`
        : `وصل نشد: ${esc(a.msg || a.code || 'خطا')}`;
  return `<div class="card" id="payCardBox">
    <div class="sec-head"><h2>کارت‌به‌کارت («تأیید شد»)</h2>${p.mode ? `<span class="pill ${p.mode === 'live' ? 'delivered' : 'hidden-p'}">${p.mode === 'live' ? 'کلید اصلی' : 'کلید آزمایشی'}</span>` : ''}</div>
    <label class="switch"><span><b id="payWord">${p.on ? 'روشنه' : 'خاموشه'}</b><br>
      <span class="tiny">مشتری موقع خرید می‌تونه همون لحظه کارت‌به‌کارت کنه. واریز رو توی ربات بله‌ی «تأیید شد» با «رسید» تأیید می‌کنی و سفارش این‌جا «پرداخت شد» می‌شه.
      ${p.mode === 'test' ? 'با کلید آزمایشی فقط خود تیم (وقتی توی پنل واردن) این گزینه رو می‌بینه.' : ''}</span></span>
      <input type="checkbox" id="payOn" ${p.on ? 'checked' : ''}><span class="knob"></span></label>
    <p class="tiny" id="payConn" style="margin:12px 0 0">${conn}${p.paused_until ? ` · تا ${esc(D_TIME.format(new Date(p.paused_until * 1000)))} موقتاً نشون داده نمی‌شه (جواب «تأیید شد»).` : ''}</p>
    <form id="payForm" novalidate style="margin-top:14px" autocomplete="off">
      <div class="row2">
        ${field('key', 'کلید API', `<input class="input ltr-in" id="f-key" name="key" type="password" autocomplete="off" spellcheck="false" placeholder="${p.key_tail ? `sk_····${esc(p.key_tail)}` : 'sk_live_…'}">`,
    p.key_tail ? 'ذخیره شده؛ فقط برای عوض کردن، کلید جدید بنویس.' : 'از داشبورد «تأیید شد»، بخش «API و ووکامرس».')}
        ${field('secret', 'رمز امضای وب‌هوک', `<input class="input ltr-in" id="f-secret" name="secret" type="password" autocomplete="off" spellcheck="false" placeholder="${p.secret_tail ? `whsec_····${esc(p.secret_tail)}` : 'whsec_…'}">`,
    p.secret_tail ? 'ذخیره شده.' : 'همون صفحه، «رمز امضا».')}
      </div>
      <div class="actions" style="gap:8px">
        <button class="btn line s" type="submit">ذخیره</button>
        <button class="btn line s" type="button" id="payTest" ${p.mode ? '' : 'disabled'}>بررسی اتصال</button>
      </div>
    </form>
    <p class="tiny" style="margin:14px 0 0">نشانی وب‌هوک (اختیاری؛ هر سفارش خودش این نشانی رو به «تأیید شد» می‌ده):<br>
      <span class="ltr" style="user-select:all">${esc(p.hook)}</span>${p.ping ? ` · آخرین پیام آزمایشی: ${esc(ago(p.ping))}` : ''}</p>
  </div>`;
}

function wirePay(p, signal) {
  const box = $('#payCardBox');
  if (!box) return;
  const redraw = (np) => {
    box.outerHTML = payCard(np);
    wirePay(np, signal);
  };
  $('#payOn').addEventListener('change', async (e) => {
    const want = e.target.checked;
    if (want && p.mode === 'live' && !confirm('کارت‌به‌کارت با کلید اصلی روشن بشه؟ از این لحظه مشتری‌ها موقع خرید می‌تونن کارت‌به‌کارت کنن.')) { e.target.checked = false; return; }
    try {
      const r = await api('settings_save', { tz_on: want });
      toast(r.pay.on ? 'کارت‌به‌کارت روشن شد' : 'کارت‌به‌کارت خاموش شد');
      redraw(r.pay);
    } catch (err) {
      e.target.checked = !want;
      if (err?.code === 'invalid') toast(err.body.message, 'err');
    }
  });
  $('#payForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = e.target.key.value.trim();
    const secret = e.target.secret.value.trim();
    try {
      const r = await api('pay_save', { key, secret });
      toast(r.pay.account?.ok ? 'ذخیره شد و وصله' : 'ذخیره شد');
      redraw(r.pay);
    } catch (err) { showErrors(e.target, err); }
  });
  $('#payTest').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const r = await api('pay_check');
      toast(r.pay.account?.ok ? 'اتصال برقراره' : 'وصل نشد');
      redraw(r.pay);
    } catch { e.target.disabled = false; }
  });
}

/* Order SMS (sms.ir): on/off, the mobile that hears about new orders, the
   balance, and one test message. The key itself never leaves the server. */
function smsCard(sms) {
  if (!sms || !sms.configured) {
    return `<div class="card"><div class="sec-head"><h2>پیامک سفارش</h2></div>
      <p class="tiny" style="margin:0">پیامک هنوز به سایت وصل نشده.</p></div>`;
  }
  return `<div class="card">
    <div class="sec-head"><h2>پیامک سفارش</h2><span class="tiny" id="smsCredit"></span></div>
    <label class="switch"><span><b id="smsWord">${sms.on ? 'روشنه' : 'خاموشه'}</b><br>
      <span class="tiny">بعد از ثبت هر سفارش و هر تغییر وضعیتش، مشتری پیامک می‌گیره؛ خبر هر سفارش جدید هم به شماره‌ی زیر می‌ره.</span></span>
      <input type="checkbox" id="smsOn" ${sms.on ? 'checked' : ''}><span class="knob"></span></label>
    <form id="tplForm" novalidate style="margin-top:14px">
      <div class="row2">
        ${field('sms_tpl_otp', 'قالب کد تأیید (ثبت‌نام و رمز)', `<input class="input ltr-in" id="f-sms_tpl_otp" name="sms_tpl_otp" inputmode="numeric" value="${sms.otp || ''}" placeholder="مثلاً 123456">`,
    sms.otp ? 'فعاله؛ مشتری‌ها با کد پیامکی ثبت‌نام می‌کنن.' : 'تا خالیه، مشتری‌ها نمی‌تونن حساب بسازن.')}
        ${field('sms_tpl_ticket', 'قالب خبر جواب تیکت', `<input class="input ltr-in" id="f-sms_tpl_ticket" name="sms_tpl_ticket" inputmode="numeric" value="${sms.ticket || ''}" placeholder="مثلاً 123457">`,
    'اختیاری؛ خالی باشه، جواب فقط توی سایت دیده می‌شه.')}
      </div>
      <button class="btn line s" type="submit">ذخیره‌ی شماره‌ی قالب‌ها</button>
    </form>
    <form id="smsForm" novalidate style="margin-top:12px">
      ${field('sms_owner', 'شماره‌ی خبر سفارش جدید', `<input class="input ltr-in" id="f-sms_owner" name="sms_owner" inputmode="tel" value="${esc(sms.owner || '')}" placeholder="09xxxxxxxxx">`, 'خالی بذاری، خبر سفارش جدید پیامک نمی‌شه.')}
      <div class="actions" style="gap:8px">
        <button class="btn line s" type="submit">ذخیره‌ی شماره</button>
        <button class="btn line s" type="button" id="smsTest">پیامک آزمایشی</button>
      </div>
    </form>
  </div>`;
}

function wireSms(sms, signal) {
  if (!sms || !sms.configured) return;
  api('sms_credit', {}, { quiet: true }).then((r) => {
    if (signal.aborted || r.credit == null) return;
    const el = $('#smsCredit');
    if (el) el.textContent = `اعتبار: ${NF.format(r.credit)}`;
  }).catch(() => {});
  $('#smsOn').addEventListener('change', async (e) => {
    const want = e.target.checked;
    try {
      const r = await api('settings_save', { sms_on: want });
      $('#smsWord').textContent = r.sms.on ? 'روشنه' : 'خاموشه';
      toast(r.sms.on ? 'پیامک‌ها روشن شد' : 'پیامک‌ها خاموش شد');
    } catch { e.target.checked = !want; }
  });
  $('#smsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api('settings_save', { sms_owner: e.target.sms_owner.value });
      e.target.sms_owner.value = r.sms.owner || '';
      showErrors(e.target, null);
      toast('شماره ذخیره شد');
    } catch (err) { showErrors(e.target, err); }
  });
  $('#tplForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api('settings_save', { sms_tpl_otp: e.target.sms_tpl_otp.value, sms_tpl_ticket: e.target.sms_tpl_ticket.value });
      e.target.sms_tpl_otp.value = r.sms.otp || '';
      e.target.sms_tpl_ticket.value = r.sms.ticket || '';
      showErrors(e.target, null);
      toast('شماره‌ی قالب‌ها ذخیره شد');
    } catch (err) { showErrors(e.target, err); }
  });
  $('#smsTest').addEventListener('click', async (e) => {
    if (!confirm('یه پیامک آزمایشی «سفارش جدید» به شماره‌ی ذخیره‌شده فرستاده بشه؟ از اعتبار پیامک کم می‌شه.')) return;
    e.target.disabled = true;
    try {
      await api('sms_test');
      toast('پیامک آزمایشی فرستاده شد');
    } catch (err) { showErrors($('#smsForm'), err); } finally { e.target.disabled = false; }
  });
}

async function viewSettings(_, q, signal) {
  setTitle('تنظیمات');
  const ceo = S.user.role === 'ceo';
  const [st, team, log] = await Promise.all([
    api('settings'),
    ceo ? api('team') : Promise.resolve(null),
    ceo ? api('log') : Promise.resolve(null),
  ]);
  if (signal.aborted) return;
  const open = st.settings.store_open;
  main.innerHTML = `
    <div class="stack">
      <div class="card">
        <div class="sec-head"><h2>فروش آنلاین</h2></div>
        ${ceo ? `<label class="switch"><span><b id="storeWord">${open ? 'روشنه' : 'خاموشه'}</b><br>
          <span class="tiny">وقتی روشنه، مشتری‌ها از سایت سفارش ثبت می‌کنن (پرداخت با کارت موقع تحویل، یا کارت‌به‌کارت اگه پایین روشنش کرده باشی) و سفارش‌ها این‌جا میان.
          تا محصول‌ها و قیمت‌های واقعی رو نذاشتی، خاموش بمونه.</span></span>
          <input type="checkbox" id="store" ${open ? 'checked' : ''}><span class="knob"></span></label>`
    : `<p style="margin:0">${open ? 'روشنه؛ سفارش‌های سایت این‌جا میان.' : 'خاموشه؛ فقط مدیرعامل می‌تونه روشنش کنه.'}</p>`}
      </div>

      ${ceo && st.pay ? payCard(st.pay) : ''}

      ${ceo ? smsCard(st.sms) : ''}

      <div class="card">
        <div class="sec-head"><h2>حساب من</h2><span class="pill ${ceo ? 'delivered' : 'new'}">${ROLE[S.user.role]}</span></div>
        <p style="margin:0 0 14px">${esc(S.user.name)} · <span class="ltr">${esc(S.user.email)}</span></p>
        <form id="pw" novalidate>
          ${field('current', 'رمز فعلی', '<input class="input ltr-in" id="f-current" name="current" type="password" autocomplete="current-password">')}
          <div class="row2">
            ${field('password', 'رمز جدید', '<input class="input ltr-in" id="f-password" name="password" type="password" autocomplete="new-password">')}
            ${field('again', 'تکرارش', '<input class="input ltr-in" id="f-again" name="again" type="password" autocomplete="new-password">')}
          </div>
          <p class="hint">با عوض کردن رمز، از همه‌ی دستگاه‌های دیگه خارج می‌شی.</p>
          <button class="btn line s" type="submit">عوض کردن رمز</button>
        </form>
      </div>

      ${ceo ? `<div class="card">
        <div class="sec-head"><h2>تیم</h2><button class="btn s" type="button" id="addMember">${icon('plus', 18)}عضو جدید</button></div>
        <p class="tiny" style="margin:-4px 0 12px">ادمین‌ها محصول، سفارش و مشتری رو می‌بینن و مدیریت می‌کنن، ولی آمار فروش، تنظیمات و تیم رو نه.</p>
        <div class="list">${team.team.map((u) => `<button class="item" type="button" data-user="${u.id}">
          <div class="main-c"><div class="t">${esc(u.name)}${u.id === team.me ? ' (خودت)' : ''}</div><div class="s"><span class="ltr">${esc(u.email)}</span></div></div>
          <div class="end"><span class="pill ${u.active ? (u.role === 'ceo' ? 'delivered' : 'new') : 'cancelled'}">${u.active ? ROLE[u.role] : 'غیرفعال'}</span>
          <div class="s">${u.last_login ? `آخرین ورود ${esc(ago(u.last_login))}` : 'هنوز وارد نشده'}</div></div></button>`).join('')}</div>
      </div>

      <div class="card">
        <div class="sec-head"><h2>کارهای اخیر تیم</h2></div>
        ${log.log.length ? `<div class="list">${log.log.slice(0, 40).map((l) => `<div class="item" style="padding:10px 12px">
          <div class="main-c"><div class="t" style="font-weight:500;font-size:13px">${esc(l.who)} ${esc(ACTIONS[l.action] || l.action)}</div>
          <div class="s">${esc(Object.entries(STATUS).reduce((s, [k, v]) => s.replace(`→ ${k}`, `← ${v}`), l.detail || ''))}</div></div>
          <div class="end"><div class="s">${esc(ago(l.at))}</div></div></div>`).join('')}</div>` : '<p class="tiny">هنوز چیزی ثبت نشده.</p>'}
      </div>` : ''}

      <button class="btn line block" type="button" id="bye">${icon('out', 18)}خروج از پنل</button>
    </div>${sig()}`;

  $('#bye').addEventListener('click', logout);
  if (ceo) wireSms(st.sms, signal);
  if (ceo && st.pay) wirePay(st.pay, signal);
  $('#store')?.addEventListener('change', async (e) => {
    const want = e.target.checked;
    if (want && !confirm('فروش آنلاین روشن بشه؟ از این لحظه مشتری‌ها می‌تونن از سایت سفارش ثبت کنن.')) { e.target.checked = false; return; }
    try {
      const r = await api('settings_save', { store_open: want });
      $('#storeWord').textContent = r.settings.store_open ? 'روشنه' : 'خاموشه';
      toast(r.settings.store_open ? 'فروش آنلاین روشن شد' : 'فروش آنلاین خاموش شد');
    } catch { e.target.checked = !want; }
  });
  $('#pw').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.again !== d.password) { showErrors(e.target, new ApiError('invalid', 422, { field: 'again', message: 'دو تا رمز یکی نیستن.' })); return; }
    try {
      await api('password', { current: d.current, password: d.password });
      e.target.reset();
      showErrors(e.target, null);
      toast('رمز عوض شد');
    } catch (err) { showErrors(e.target, err); }
  });
  if (ceo) {
    $('#addMember').addEventListener('click', () => memberSheet(null, team.me));
    main.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', () =>
      memberSheet(team.team.find((u) => u.id === Number(b.dataset.user)), team.me)));
  }
}

function memberSheet(u, me) {
  const isMe = u && u.id === me;
  openSheet(`
    <h2>${u ? 'ویرایش عضو' : 'عضو جدید'}</h2>
    <p class="tiny" style="margin:0 0 14px">${u ? 'هر تغییری، این شخص رو از همه‌ی دستگاه‌هاش خارج می‌کنه.' : 'یه رمز موقت بساز و خودت بهش بده؛ بعد از ورود، از تنظیمات عوضش می‌کنه.'}</p>
    <form id="mem" novalidate>
      ${field('name', 'اسم', `<input class="input" id="f-name" name="name" value="${esc(u?.name || '')}">`)}
      ${field('email', 'ایمیل', `<input class="input ltr-in" id="f-email" name="email" type="email" value="${esc(u?.email || '')}">`)}
      ${field('role', 'نقش', `<select class="input" id="f-role" name="role" ${isMe ? 'disabled' : ''}>
        <option value="admin" ${u?.role === 'admin' || !u ? 'selected' : ''}>ادمین — محصول، سفارش، مشتری</option>
        <option value="ceo" ${u?.role === 'ceo' ? 'selected' : ''}>مدیرعامل — همه‌چیز</option></select>`)}
      ${field('password', u ? 'رمز جدید (اختیاری)' : 'رمز موقت (حداقل ۸ کاراکتر)', '<input class="input ltr-in" id="f-password" name="password" type="text" autocomplete="off" spellcheck="false">')}
      ${u && !isMe ? `<label class="switch" style="margin-bottom:14px"><span>فعال<br><span class="tiny">غیرفعال باشه، نمی‌تونه وارد بشه.</span></span>
        <input type="checkbox" name="active" ${u.active ? 'checked' : ''}><span class="knob"></span></label>` : ''}
      <button class="btn block" type="submit">${u ? 'ذخیره' : 'افزودن به تیم'}</button>
      ${u && !isMe ? '<div style="height:8px"></div><button class="btn danger block" type="button" id="rmMember">حذف از تیم</button>' : ''}
    </form>`, (sheet, close) => {
    const form = sheet.querySelector('#mem');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const body = { name: d.name, email: d.email, role: isMe ? 'ceo' : d.role, password: d.password || '' };
      if (u) { body.id = u.id; body.active = isMe ? true : Boolean(d.active); }
      try {
        await api('team_save', body);
        toast(u ? 'ذخیره شد' : 'به تیم اضافه شد');
        close();
        route();
      } catch (err) { showErrors(form, err); }
    });
    sheet.querySelector('#rmMember')?.addEventListener('click', async () => {
      if (!confirm(`${u.name} از تیم حذف بشه؟`)) return;
      try { await api('team_delete', { id: u.id }); toast('حذف شد'); close(); route(); } catch { /* toast shown */ }
    });
  });
}

/* ================================================================= boot */
async function boot() {
  try {
    const st = await api('state', {}, { quiet: true });
    S.csrf = st.csrf || '';
    S.user = st.user;
    if (!S.user) { renderAuth(st.setup ? 'setup' : 'login'); return; }
    renderShell();
    route();
    ping();
  } catch {
    root.className = 'auth';
    root.innerHTML = `<div class="auth-box" style="text-align:center"><i class="mark"></i>
      <p class="lede" style="margin-top:20px">پنل الان در دسترس نیست. اینترنت رو چک کن و دوباره امتحان کن.</p>
      <button class="btn" type="button" onclick="location.reload()">دوباره</button></div>`;
  }
}

/* The «سفارش‌ها» and «تیکت‌ها» badges stay fresh while the panel is open. */
const ping = () => api('ping', {}, { quiet: true }).then((r) => { setBadge(r.pending); setTBadge(r.tickets); }).catch(() => {});
setInterval(() => { if (S.user && !document.hidden) ping(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.user) ping(); });

boot();
