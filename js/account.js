/* The customer's account: signed in or not, and the three sheets that change
   that — sign in, sign up (with the SMS code), and a forgotten password.

   The account is the phone number, proven once by a six-digit code from
   sms.ir. It is what tickets need (the team's answers have to reach someone)
   and it fills in the checkout name and number. Everything else the shop
   keeps — the bag, saved pieces, measurements, the address — stays on the
   phone as before. */
import { icon } from './icons.js';
import { esc, num, typed } from './util.js';
import { state, patch } from './store.js';
import { openSheet, closeSheet, toast } from './ui.js';
import { L, isFa } from './i18n.js';
import { live } from './live.js';

export const account = {
  loaded: false,
  user: null,          // { name, phone, since }
  csrf: '',
  otp: false,          // can the shop text a code right now?
  unread: 0,           // tickets with an answer not yet opened
  caps: { file: 5 * 1048576, files: 6 },
  /* Cashback credit: spendable now, on the way (orders not yet delivered),
     and the orders behind it. */
  credit: { balance: 0, pending: 0, orders: [] },
};

const NO_CREDIT = () => ({ balance: 0, pending: 0, orders: [] });
/** Keep the credit an answer carries (signed out: none). */
export function takeCredit(c) {
  account.credit = c && typeof c === 'object'
    ? { balance: Math.max(0, Number(c.balance) || 0), pending: Math.max(0, Number(c.pending) || 0),
      orders: Array.isArray(c.orders) ? c.orders : [] }
    : NO_CREDIT();
}

const changed = () => document.dispatchEvent(new CustomEvent('account:changed'));

/* ------------------------------------------------------------- the calls */
export class ApiError extends Error {
  constructor(code, status, body = {}) { super(code); this.code = code; this.status = status; this.body = body; }
}

function settle(status, j) {
  if (status >= 200 && status < 300 && j.ok) {
    if (j.csrf) account.csrf = j.csrf;
    if ('unread' in j) account.unread = Number(j.unread) || 0;
    if ('credit' in j) takeCredit(j.credit);
    return j;
  }
  if (status === 401 && j.error === 'signin' && account.user) {
    account.user = null;
    account.csrf = '';
    takeCredit(null);
    changed();
  }
  throw new ApiError(j.error || 'server', status, j);
}

/** One JSON call to api/account.php or api/tickets.php. */
export async function call(file, a, data = {}) {
  let r;
  let j = {};
  try {
    r = await fetch(`api/${file}`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF': account.csrf },
      body: JSON.stringify({ a, ...data }),
    });
  } catch { throw new ApiError('network', 0); }
  try { j = await r.json(); } catch { /* not JSON: a host error page */ }
  return settle(r.status, j);
}

/** A message with files, with upload progress (0…1). */
export function send(file, form, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `api/${file}`);
    x.setRequestHeader('X-CSRF', account.csrf);
    x.timeout = 180000;
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    x.onload = () => {
      let j = {};
      try { j = JSON.parse(x.responseText); } catch { /* */ }
      try { resolve(settle(x.status, j)); } catch (e) { reject(e); }
    };
    x.onerror = () => reject(new ApiError('network', 0));
    x.ontimeout = () => reject(new ApiError('network', 0));
    x.send(form);
  });
}

export async function loadAccount() {
  try {
    const j = await call('account.php', 'state');
    account.user = j.user;
    account.csrf = j.csrf || '';
    account.otp = Boolean(j.otp);
    account.unread = Number(j.unread) || 0;
    if (j.caps) account.caps = j.caps;
  } catch { /* offline: signed out for now */ }
  account.loaded = true;
  changed();
  return account;
}

/** Only the unread count (the dot on the Tickets tab); never re-draws a page. */
export async function refreshUnread() {
  if (!account.user) return;
  try {
    const j = await call('account.php', 'state');
    if (!j.user) { account.user = null; changed(); return; }
    account.unread = Number(j.unread) || 0;
  } catch { /* keep the last count */ }
  document.dispatchEvent(new CustomEvent('account:unread'));
}

/* ---------------------------------------------------- what went wrong */
const MB = () => num(Math.max(1, Math.floor(account.caps.file / 1048576)));

/** The words for a refusal, in the page's language. Persian comes from the
    server as it is (it names the file); the other two use their own. */
export function sayError(e) {
  if (!(e instanceof ApiError)) return L('یه مشکلی پیش اومد؛ دوباره امتحان کن.', 'Something went wrong — try again.', 'Bir sorun çıktı — tekrar dene.');
  const why = e.body?.why;
  const field = e.body?.field;
  if (e.code === 'invalid' && isFa && e.body.message) return e.body.message;
  const W = {
    phone: L('شماره موبایل درست نیست.', 'That mobile number is not right.', 'Bu cep numarası doğru değil.'),
    taken: L('با این شماره قبلاً ثبت‌نام شده؛ وارد شو.', 'This number already has an account — sign in.', 'Bu numarayla zaten hesap var — giriş yap.'),
    unknown: L('با این شماره حسابی نداریم؛ اول ثبت‌نام کن.', 'No account with this number — sign up first.', 'Bu numarayla hesap yok — önce kaydol.'),
    name: L('اسم و فامیلت رو بنویس.', 'Write your full name.', 'Adını ve soyadını yaz.'),
    short: L('رمز باید حداقل ۶ کاراکتر باشه.', 'The password needs at least 6 characters.', 'Şifre en az 6 karakter olmalı.'),
    long: L('رمز خیلی بلنده.', 'That password is too long.', 'Şifre çok uzun.'),
    expired: L('کد منقضی شده؛ یه کد تازه بگیر.', 'The code has expired — ask for a new one.', 'Kodun süresi doldu — yenisini iste.'),
    spent: L('این کد چند بار اشتباه زده شد؛ یه کد تازه بگیر.', 'Too many wrong tries — ask for a new code.', 'Çok fazla yanlış deneme — yeni kod iste.'),
    empty: L('یه چیزی بنویس، یا فایل یا پیام صوتی بفرست.', 'Write something, or send a file or a voice note.', 'Bir şey yaz ya da dosya veya sesli mesaj gönder.'),
    gone: L('این محصول توی سایت نیست.', 'That piece is no longer in the shop.', 'Bu parça artık mağazada yok.'),
    open: L('پنج تا تیکت باز داری؛ توی همون‌ها بنویس.', 'You have five open tickets — write in one of those.', 'Beş açık talebin var — onlardan birine yaz.'),
    big: L(`فایل بزرگ‌تر از ${MB()} مگابایته.`, `A file is over ${MB()} MB.`, `Bir dosya ${MB()} MB'tan büyük.`),
    type: L('این نوع فایل رو نمی‌شه فرستاد.', 'That kind of file cannot be sent.', 'Bu tür dosya gönderilemez.'),
    count: L('هر پیام حداکثر ۶ فایل.', 'Up to 6 files per message.', 'Mesaj başına en fazla 6 dosya.'),
    upload: L('یکی از فایل‌ها آپلود نشد؛ دوباره امتحان کن.', 'A file did not upload — try again.', 'Bir dosya yüklenemedi — tekrar dene.'),
  };
  if (e.code === 'invalid') {
    if (why === 'wrong') {
      return field === 'current'
        ? L('رمز فعلی درست نیست.', 'Your current password is not right.', 'Mevcut şifren doğru değil.')
        : L('کد درست نیست.', 'That code is not right.', 'Kod doğru değil.');
    }
    return W[why] || e.body.message;
  }
  return ({
    wrong: L('شماره یا رمز درست نیست.', 'Wrong number or password.', 'Numara ya da şifre yanlış.'),
    too_many: L('تلاش‌ها زیاد شد؛ چند دقیقه صبر کن و دوباره امتحان کن.', 'Too many tries — wait a few minutes.', 'Çok fazla deneme — birkaç dakika bekle.'),
    wait: L(`یه کمی صبر کن؛ ${num(e.body?.wait || 60)} ثانیه‌ی دیگه کد تازه می‌گیری.`,
      `Wait ${e.body?.wait || 60} seconds for a new code.`, `Yeni kod için ${e.body?.wait || 60} saniye bekle.`),
    sms: L('پیامک فرستاده نشد؛ چند دقیقه‌ی دیگه دوباره امتحان کن.', 'The SMS did not go — try again in a few minutes.', 'SMS gönderilemedi — birkaç dakika sonra tekrar dene.'),
    otp_off: L('ثبت‌نام با کد پیامکی به‌زودی فعال می‌شه.', 'Sign-up by SMS code opens soon.', 'SMS koduyla kayıt yakında açılıyor.'),
    too_big: L(`حجم کل فایل‌ها زیاده؛ هر فایل حداکثر ${MB()} مگابایت.`, `Too much at once — each file up to ${MB()} MB.`, `Toplam boyut fazla — dosya başına en fazla ${MB()} MB.`),
    not_found: L('پیدا نشد.', 'Not found.', 'Bulunamadı.'),
    signin: L('اول وارد حسابت شو.', 'Sign in first.', 'Önce giriş yap.'),
    csrf: L('صفحه رو تازه کن و دوباره امتحان کن.', 'Refresh the page and try again.', 'Sayfayı yenile ve tekrar dene.'),
    quota: L('امروز فایل زیادی فرستادی؛ فردا دوباره امتحان کن.', 'That is a lot of files for one day — try again tomorrow.', 'Bugün çok dosya gönderdin — yarın tekrar dene.'),
    network: L('به اینترنت وصل نیستی؟ دوباره امتحان کن.', 'No connection? Try again.', 'Bağlantı yok mu? Tekrar dene.'),
  })[e.code] || L('یه مشکلی پیش اومد؛ دوباره امتحان کن.', 'Something went wrong — try again.', 'Bir sorun çıktı — tekrar dene.');
}

/** Put the message under the field it is about (or under the button). */
function showError(sheet, e) {
  sheet.querySelectorAll('.field.err').forEach((f) => f.classList.remove('err'));
  const msg = sayError(e);
  const f = e?.body?.field && sheet.querySelector(`[data-field="${e.body.field}"]`);
  const out = f ? f.querySelector('.field-msg') : sheet.querySelector('.form-msg');
  if (f) f.classList.add('err');
  if (out) out.textContent = msg; else toast(msg, 'info', 3600);
}

/* ---------------------------------------------------------------- sheets */
/* One sheet for both doors. A switch at the top says which one you are at
   (ورود / ساخت حساب); every field carries its icon; a password can be shown;
   sign-up and a forgotten password go in two numbered steps — your details,
   then the six-digit code — so it is always clear what comes next. */
const field = (name, label, input, hint = '') => `
  <div class="field" data-field="${name}"><label for="ac-${name}">${esc(label)}</label>${input}
    <p class="field-msg" role="alert"></p>${hint ? `<p class="tiny field-hint">${esc(hint)}</p>` : ''}</div>`;
/** An input with its icon in front (and, for a password, the eye after). */
const ibox = (ico, input, after = '') => `<div class="ibox">${icon(ico, 18, 'ibox-ico')}${input}${after}</div>`;
const phoneIn = (v = '') => ibox('phone', `<input id="ac-phone" name="phone" inputmode="tel" autocomplete="tel" dir="ltr"
  value="${esc(v)}" placeholder="0912 000 0000">`);
const nameIn = (v = '') => ibox('user', `<input id="ac-name" name="name" autocomplete="name" value="${esc(v)}"
  placeholder="${esc(L('مثلاً: مریم احمدی', 'e.g. Maryam Ahmadi', 'örn. Maryam Ahmadi'))}">`);
const passIn = (auto, id = 'password') => ibox('lock',
  `<input id="ac-${id}" name="${id}" type="password" dir="ltr" autocomplete="${auto}">`,
  `<button class="pw-eye" type="button" aria-pressed="false" aria-label="${esc(L('نمایش رمز', 'Show password', 'Şifreyi göster'))}">${icon('eye', 18)}</button>`);
const codeIn = () => `<input id="ac-code" name="code" inputmode="numeric" autocomplete="one-time-code" dir="ltr"
  maxlength="9" class="code-in" placeholder="• • • • • •">`;
const PRIVACY = () => `<p class="auth-privacy">${icon('lock', 14)}<span>${esc(L(
  'شماره‌ت فقط برای ورود، و خبر دادن درباره‌ی سفارش و تیکت‌هات استفاده می‌شه.',
  'Your number is only used to sign you in and to tell you about your orders and tickets.',
  'Numaran yalnızca giriş için ve siparişlerin ile taleplerin hakkında bilgi vermek için kullanılır.'))}</span></p>`;

/** The switch between the two doors; none lit while resetting a password. */
const tabs = (on) => `<div class="auth-tabs" role="tablist" aria-label="${esc(L('حساب', 'Account', 'Hesap'))}">
  <button role="tab" type="button" data-go="signin" aria-selected="${on === 'signin'}" class="${on === 'signin' ? 'on' : ''}">${esc(L('ورود', 'Sign in', 'Giriş'))}</button>
  <button role="tab" type="button" data-go="signup" aria-selected="${on === 'signup'}" class="${on === 'signup' ? 'on' : ''}">${esc(L('ساخت حساب', 'Create account', 'Hesap oluştur'))}</button>
</div>`;
const head = (title, sub = '') => `<div class="auth-head">
  <span class="auth-badge">${icon('user', 22)}</span>
  <div><h2>${esc(title)}</h2>${sub ? `<p class="auth-sub">${esc(sub)}</p>` : ''}</div></div>`;
/** Step n of 2, with its name; the bar fills with the step. */
const steps = (n, names) => `<ol class="auth-steps" aria-label="${esc(L(`مرحله‌ی ${num(n)} از ۲`, `Step ${n} of 2`, `Adım ${n}/2`))}">
  ${names.map((t, i) => `<li class="${i + 1 < n ? 'done' : i + 1 === n ? 'on' : ''}"><b>${num(i + 1)}</b><span>${esc(t)}</span></li>`).join('')}</ol>`;

/** Signed in: remember who, fill in checkout, say hello. */
function welcome(j, then) {
  account.user = j.user;
  account.unread = Number(j.unread) || 0;
  if (!state.profile.name) patch('profile', { name: j.user.name });
  if (!state.profile.phone) patch('profile', { phone: j.user.phone });
  closeSheet();
  toast(L(`خوش اومدی، ${j.user.name.split(/\s+/)[0]}`, `Welcome, ${j.user.name.split(/\s+/)[0]}`, `Hoş geldin, ${j.user.name.split(/\s+/)[0]}`), 'check');
  changed();
  then?.();
}

const SOON = () => `<div class="note-box">${icon('clock', 18)}<p>${esc(L(
  'ساختن حساب با کد پیامکی به‌زودی فعال می‌شه. تا اون موقع می‌تونی از واتساپ یا اینستاگرام باهامون در تماس باشی.',
  'Accounts with an SMS code open soon. Until then, reach us on WhatsApp or Instagram.',
  'SMS koduyla hesap açma yakında başlıyor. O zamana kadar bize WhatsApp veya Instagram’dan ulaşabilirsin.'))}</p></div>`;

/** The doors, the show-password eyes and a busy state on the main button. */
function wire(sheet, then) {
  sheet.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) {
      ({ signin: signInSheet, signup: signUpSheet, reset: resetSheet })[go.dataset.go]({ then });
      return;
    }
    const eye = e.target.closest('.pw-eye');
    if (eye) {
      const input = eye.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', String(show));
      eye.setAttribute('aria-label', show ? L('پنهان کردن رمز', 'Hide password', 'Şifreyi gizle') : L('نمایش رمز', 'Show password', 'Şifreyi göster'));
      eye.innerHTML = icon(show ? 'eyeOff' : 'eye', 18);
      input.focus();
    }
  });
}
const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('busy', on); };

export function signInSheet({ then, why = '' } = {}) {
  openSheet(`
    ${head(L('حساب تیفانی', 'Your TIFFANY account', 'TIFFANY hesabın'))}
    ${tabs('signin')}
    <p class="lede auth-lede">${esc(why || L('با شماره موبایل و رمزت وارد شو.', 'Sign in with your mobile number and password.', 'Cep numaran ve şifrenle giriş yap.'))}</p>
    <form id="acForm" novalidate>
      ${field('phone', L('شماره موبایل', 'Mobile number', 'Cep numarası'), phoneIn(state.profile.phone))}
      ${field('password', L('رمز', 'Password', 'Şifre'), passIn('current-password'))}
      <div class="auth-forgot"><button class="link-more" type="button" data-go="reset">${esc(L('رمزت یادت رفته؟', 'Forgot your password?', 'Şifreni mi unuttun?'))}</button></div>
      <p class="form-msg" role="alert"></p>
      <button class="btn btn-ink btn-block auth-go" type="submit">${esc(L('ورود به حساب', 'Sign in', 'Giriş yap'))}</button>
    </form>
    <p class="auth-switch">${esc(L('حساب نداری؟', 'New here?', 'Hesabın yok mu?'))}
      <button class="link-more" type="button" data-go="signup">${esc(L('یه حساب بساز', 'Create an account', 'Hesap oluştur'))}</button></p>
    ${PRIVACY()}`,
  {
    label: L('ورود به حساب', 'Sign in', 'Giriş'),
    cls: 'auth',
    onMount(sheet) {
      wire(sheet, then);
      const form = sheet.querySelector('#acForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type=submit]');
        busy(btn, true);
        try {
          const j = await call('account.php', 'login', { phone: typed(form.phone.value), password: form.password.value });
          welcome(j, then);
        } catch (err) { showError(sheet, err); } finally { busy(btn, false); }
      });
    },
  });
}

/** Step two of sign-up and reset: the code that was just texted, a resend
    timer, and the button that finishes the job. */
function codeStep(sheet, { phone, purpose, extra = '', submit, back }) {
  const box = sheet.querySelector('#acBody');
  box.innerHTML = `
    ${steps(2, purpose === 'signup'
    ? [L('اطلاعات تو', 'Your details', 'Bilgilerin'), L('کد پیامکی', 'SMS code', 'SMS kodu')]
    : [L('شماره موبایل', 'Mobile number', 'Cep numarası'), L('کد و رمز جدید', 'Code and new password', 'Kod ve yeni şifre')])}
    <p class="lede auth-lede">${L(`کد ۶ رقمی‌ای که به <b dir="ltr">${esc(phone)}</b> پیامک شد رو بنویس.`,
    `Type the 6-digit code we texted to <b dir="ltr">${esc(phone)}</b>.`,
    `<b dir="ltr">${esc(phone)}</b> numarasına gönderdiğimiz 6 haneli kodu yaz.`)}</p>
    <form id="acCode" novalidate>
      ${field('code', L('کد تأیید', 'Verification code', 'Doğrulama kodu'), codeIn())}
      ${extra}
      <p class="form-msg" role="alert"></p>
      <button class="btn btn-ink btn-block auth-go" type="submit">${esc(purpose === 'signup'
    ? L('تأیید و ساخت حساب', 'Confirm and create my account', 'Onayla ve hesabımı oluştur')
    : L('ذخیره‌ی رمز و ورود', 'Save the password and sign in', 'Şifreyi kaydet ve giriş yap'))}</button>
    </form>
    <div class="sheet-links">
      <button class="link-more" type="button" id="acResend" disabled></button>
      <button class="link-more" type="button" id="acBack">${esc(L('عوض کردن شماره', 'Change the number', 'Numarayı değiştir'))}</button>
    </div>`;
  const resend = box.querySelector('#acResend');
  let left = 60;
  const paint = () => {
    resend.disabled = left > 0;
    resend.textContent = left > 0
      ? L(`ارسال دوباره تا ${num(left)} ثانیه‌ی دیگه`, `Resend in ${left}s`, `${left} sn sonra tekrar gönder`)
      : L('ارسال دوباره‌ی کد', 'Send the code again', 'Kodu tekrar gönder');
  };
  paint();
  const timer = setInterval(() => { left = Math.max(0, left - 1); paint(); if (!sheet.isConnected) clearInterval(timer); }, 1000);
  resend.addEventListener('click', async () => {
    resend.disabled = true;
    try {
      await call('account.php', 'otp', { purpose, phone });
      left = 60;
      paint();
      toast(L('کد تازه پیامک شد', 'A new code is on its way', 'Yeni kod gönderildi'), 'check');
    } catch (err) {
      if (err.code === 'wait') { left = Number(err.body.wait) || 60; paint(); }
      showError(sheet, err);
    }
  });
  box.querySelector('#acBack').addEventListener('click', () => { clearInterval(timer); back(); });
  const form = box.querySelector('#acCode');
  const code = form.code;
  code.focus();
  /* Six digits typed (or pasted, or filled in from the SMS) is enough. */
  code.addEventListener('input', () => {
    const d = typed(code.value).replace(/\D/g, '');
    if (d.length === 6 && !form.querySelector('[name=password]')) form.requestSubmit();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    busy(btn, true);
    try {
      await submit(typed(code.value).replace(/\D/g, ''), form);
      clearInterval(timer);
    } catch (err) { showError(sheet, err); } finally { busy(btn, false); }
  });
}

/** What an account is for; with the cashback on, that too. */
function signUpLede() {
  const cb = live.cashback;
  if (!cb?.on || !(cb.pct > 0)) {
    return L('با یه حساب، تیکت می‌فرستی و جواب تیم رو همین‌جا می‌گیری، و موقع خرید اسم و شماره‌ت خودش پر می‌شه.',
      'With an account you can send tickets and get the team’s answers here, and checkout fills in your name and number.',
      'Bir hesapla talep gönderip ekibin yanıtlarını burada alırsın; ödeme sırasında adın ve numaran kendiliğinden dolar.');
  }
  const min = `${num(cb.min)} ${L('تومان', 'Toman', 'Toman')}`;
  return L(`با یه حساب، از خریدهای ${min} به بالا ${num(cb.pct)}٪ اعتبار برگشتی می‌گیری، تیکت می‌فرستی و جواب تیم رو همین‌جا می‌گیری، و موقع خرید اسم و شماره‌ت خودش پر می‌شه.`,
    `With an account, orders of ${min} or more give ${cb.pct}% back as credit, you can send tickets and get the team’s answers here, and checkout fills in your name and number.`,
    `Bir hesapla ${min} ve üzeri siparişlerde %${cb.pct} kredi kazanırsın, talep gönderip ekibin yanıtlarını burada alırsın ve ödemede adın ile numaran kendiliğinden dolar.`);
}

export function signUpSheet({ then, calm = false } = {}) {
  openSheet(`
    ${head(L('حساب تیفانی', 'Your TIFFANY account', 'TIFFANY hesabın'))}
    ${tabs('signup')}
    <div id="acBody">
      ${account.otp ? `${steps(1, [L('اطلاعات تو', 'Your details', 'Bilgilerin'), L('کد پیامکی', 'SMS code', 'SMS kodu')])}
      <p class="lede auth-lede">${esc(signUpLede())}</p>
      <form id="acForm" novalidate>
        ${field('name', L('اسم و فامیل', 'Full name', 'Ad soyad'), nameIn(state.profile.name))}
        ${field('phone', L('شماره موبایل', 'Mobile number', 'Cep numarası'), phoneIn(state.profile.phone),
    L('یه کد ۶ رقمی به این شماره پیامک می‌شه.', 'We text a 6-digit code to this number.', 'Bu numaraya 6 haneli bir kod göndereceğiz.'))}
        ${field('password', L('رمز (حداقل ۶ کاراکتر)', 'Password (6+ characters)', 'Şifre (en az 6 karakter)'), passIn('new-password'))}
        <p class="form-msg" role="alert"></p>
        <button class="btn btn-ink btn-block auth-go" type="submit">${esc(L('ادامه و دریافت کد', 'Continue and get the code', 'Devam et ve kodu al'))}</button>
      </form>` : SOON()}
      <p class="auth-switch">${esc(L('حساب داری؟', 'Already have an account?', 'Hesabın var mı?'))}
        <button class="link-more" type="button" data-go="signin">${esc(L('وارد شو', 'Sign in', 'Giriş yap'))}</button></p>
    </div>
    ${PRIVACY()}`,
  {
    label: L('ساخت حساب', 'Create an account', 'Hesap oluştur'),
    cls: 'auth',
    calm,
    onMount(sheet) {
      wire(sheet, then);
      const form = sheet.querySelector('#acForm');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = { name: form.name.value.trim(), phone: typed(form.phone.value), password: form.password.value };
        const btn = form.querySelector('[type=submit]');
        busy(btn, true);
        try {
          await call('account.php', 'otp', { purpose: 'signup', ...d });
          const shown = d.phone.replace(/\s+/g, '');
          codeStep(sheet, {
            phone: shown,
            purpose: 'signup',
            back: () => signUpSheet({ then }),
            async submit(code) {
              const j = await call('account.php', 'signup', { ...d, code });
              welcome(j, then);
            },
          });
        } catch (err) { showError(sheet, err); } finally { busy(btn, false); }
      });
    },
  });
}

export function resetSheet({ then } = {}) {
  openSheet(`
    ${head(L('بازیابی رمز', 'Reset your password', 'Şifreni sıfırla'))}
    <div id="acBody">
      ${account.otp ? `${steps(1, [L('شماره موبایل', 'Mobile number', 'Cep numarası'), L('کد و رمز جدید', 'Code and new password', 'Kod ve yeni şifre')])}
      <p class="lede auth-lede">${esc(L('شماره‌ای که باهاش حساب ساختی رو بنویس؛ یه کد برات پیامک می‌کنیم و با اون یه رمز تازه می‌سازی.',
    'Type the number your account uses; we text you a code to set a new password with.',
    'Hesabının numarasını yaz; yeni şifre belirlemen için bir kod göndereceğiz.'))}</p>
      <form id="acForm" novalidate>
        ${field('phone', L('شماره موبایل', 'Mobile number', 'Cep numarası'), phoneIn(state.profile.phone))}
        <p class="form-msg" role="alert"></p>
        <button class="btn btn-ink btn-block auth-go" type="submit">${esc(L('ارسال کد', 'Text me the code', 'Kodu gönder'))}</button>
      </form>` : SOON()}
      <p class="auth-switch"><button class="link-more" type="button" data-go="signin">${esc(L('برگشت به ورود', 'Back to sign in', 'Girişe dön'))}</button></p>
    </div>`,
  {
    label: L('بازیابی رمز', 'Reset your password', 'Şifreni sıfırla'),
    cls: 'auth',
    onMount(sheet) {
      wire(sheet, then);
      const form = sheet.querySelector('#acForm');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = typed(form.phone.value).replace(/\s+/g, '');
        const btn = form.querySelector('[type=submit]');
        busy(btn, true);
        try {
          await call('account.php', 'otp', { purpose: 'reset', phone });
          codeStep(sheet, {
            phone,
            purpose: 'reset',
            extra: field('password', L('رمز جدید (حداقل ۶ کاراکتر)', 'New password (6+ characters)', 'Yeni şifre (en az 6 karakter)'), passIn('new-password')),
            back: () => resetSheet({ then }),
            async submit(code, f) {
              const j = await call('account.php', 'reset', { phone, code, password: f.password.value });
              welcome(j, then);
            },
          });
        } catch (err) { showError(sheet, err); } finally { busy(btn, false); }
      });
    },
  });
}

/** Signed in: the name, a new password, and signing out. */
export function accountSheet({ calm = false } = {}) {
  const u = account.user;
  if (!u) { signInSheet(); return; }
  let renamed = false;
  openSheet(`
    <div class="auth-head">
      <span class="auth-badge">${icon('user', 22)}</span>
      <div><h2>${esc(L('حساب من', 'My account', 'Hesabım'))}</h2>
        <p class="auth-sub"><span dir="ltr">${esc(u.phone)}</span> · ${icon('check', 13)}${esc(L('تأییدشده با پیامک', 'confirmed by SMS', 'SMS ile doğrulandı'))}</p></div>
    </div>
    <form id="acName" novalidate>
      ${field('name', L('اسم و فامیل', 'Full name', 'Ad soyad'), nameIn(u.name))}
      <button class="btn btn-line btn-s" type="submit">${esc(L('ذخیره‌ی اسم', 'Save name', 'Adı kaydet'))}</button>
    </form>
    <div class="sheet-rule"></div>
    <form id="acPass" novalidate>
      ${field('current', L('رمز فعلی', 'Current password', 'Mevcut şifre'), passIn('current-password', 'current'))}
      ${field('password', L('رمز جدید', 'New password', 'Yeni şifre'), passIn('new-password'),
    L('با عوض کردن رمز، از گوشی‌های دیگه خارج می‌شی.', 'Changing it signs your other phones out.', 'Değiştirmek diğer telefonlardan çıkış yapar.'))}
      <p class="form-msg" role="alert"></p>
      <button class="btn btn-line btn-s" type="submit">${esc(L('عوض کردن رمز', 'Change password', 'Şifreyi değiştir'))}</button>
    </form>
    <div class="sheet-rule"></div>
    <button class="btn btn-quiet btn-block" type="button" id="acOut">${icon('arrow', 17)}${esc(L('خروج از حساب', 'Sign out', 'Çıkış yap'))}</button>`,
  {
    label: L('حساب من', 'My account', 'Hesabım'),
    cls: 'auth',
    calm,
    /* The profile header shows the name: redraw it once the sheet is gone. */
    onClose() { if (renamed) setTimeout(() => document.dispatchEvent(new CustomEvent('view:refresh')), 0); },
    onMount(sheet) {
      wire(sheet);
      sheet.querySelector('#acName').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const j = await call('account.php', 'profile', { name: e.target.name.value });
          account.user = j.user;
          patch('profile', { name: j.user.name });
          renamed = true;
          toast(L('اسم ذخیره شد', 'Name saved', 'Ad kaydedildi'), 'check');
        } catch (err) { showError(sheet, err); }
      });
      sheet.querySelector('#acPass').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await call('account.php', 'password', { current: e.target.current.value, password: e.target.password.value });
          e.target.reset();
          toast(L('رمز عوض شد', 'Password changed', 'Şifre değiştirildi'), 'check');
        } catch (err) { showError(sheet, err); }
      });
      sheet.querySelector('#acOut').addEventListener('click', signOut);
    },
  });
}

export async function signOut() {
  try { await call('account.php', 'logout'); } catch { /* out anyway */ }
  account.user = null;
  account.csrf = '';
  account.unread = 0;
  takeCredit(null);
  closeSheet();
  toast(L('از حسابت خارج شدی', 'Signed out', 'Çıkış yapıldı'), 'check');
  changed();
}
