/* Card-to-card through «تأیید شد» (tayidshod.ir) — added 2026-10-19.

   Checkout asks /api/pay.php?a=state whether to offer it. After the order is
   placed the phone goes to tayidshod's payment page; the customer transfers
   from their bank app and taps «واریز کردم»; TIFFANY confirms in the Bale
   bot. tayidshod's «برگشت به فروشگاه» lands on /#/orders?pay=CODE&k=KEY,
   where the Orders tab asks the server for the answer (js/views/orders.js).

   Each card-to-card order on this phone keeps its own payment key (payKey):
   it is what lets this phone, and only this phone, see that order's payment
   and go back to its page. The money itself is only ever marked on the
   server, by tayidshod's signed webhook. */
import { esc } from './util.js';
import { icon } from './icons.js';
import { L } from './i18n.js';

/* ------------------------------------------------------------- the offer */
let offer = null;        // { c2c, test, at }
let asking = null;

/** May this checkout offer card-to-card? Kept a minute; a slow or failed
    answer is «no» (card on delivery always works). */
export function payOptions({ wait = 4000 } = {}) {
  if (offer && Date.now() - offer.at < 60000) return Promise.resolve(offer);
  asking ??= (async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch('api/pay.php?a=state', { cache: 'no-store', signal: ctl.signal });
      clearTimeout(t);
      const j = await r.json();
      offer = { c2c: Boolean(j.c2c), test: Boolean(j.test), at: Date.now() };
    } catch {
      offer = { c2c: false, test: false, at: Date.now() - 45000 };   // ask again in 15 s
    }
    asking = null;
    return offer;
  })();
  return Promise.race([asking, new Promise((r) => { setTimeout(() => r(offer || { c2c: false, test: false }), wait); })]);
}

/** Forget the offer (the server just said no to it). */
export const forgetOffer = () => { offer = null; };

/* ------------------------------------------------------------- the words */
const WORDS = {
  pending: () => L('منتظر پرداخت', 'Awaiting payment', 'Ödeme bekleniyor'),
  claimed: () => L('پرداخت در حال بررسی', 'Payment being checked', 'Ödeme kontrol ediliyor'),
  paid: () => L('پرداخت شد', 'Paid', 'Ödendi'),
  rejected: () => L('واریز پیدا نشد', 'Transfer not found', 'Havale bulunamadı'),
  mismatch: () => L('پرداخت در حال بررسی', 'Payment being checked', 'Ödeme kontrol ediliyor'),
  short: () => L('پرداخت در حال بررسی', 'Payment being checked', 'Ödeme kontrol ediliyor'),
  odd: () => L('پرداخت در حال بررسی', 'Payment being checked', 'Ödeme kontrol ediliyor'),
  expired: () => L('مهلت پرداخت تموم شد', 'Payment time ran out', 'Ödeme süresi doldu'),
  canceled: () => L('پرداخت لغو شد', 'Payment cancelled', 'Ödeme iptal edildi'),
};

const NOTES = {
  pending: () => L(
    'هنوز پرداخت نکردی. توی صفحه‌ی پرداخت، مبلغ دقیق رو از اپ بانکت کارت‌به‌کارت کن و «واریز کردم» رو بزن؛ تا ۳۰ دقیقه بعد از ثبت وقت داری.',
    'Not paid yet. On the payment page, transfer the exact amount from your bank app and tap «واریز کردم». You have 30 minutes from placing the order.',
    'Henüz ödenmedi. Ödeme sayfasında tam tutarı banka uygulamandan havale et ve «واریز کردم»a dokun. Siparişten sonra 30 dakikan var.'),
  claimed: () => L(
    'واریزت ثبت شد. تیم تیفانی رسیدنش رو تأیید می‌کنه و همین‌جا «پرداخت شد» می‌شه؛ معمولاً چند دقیقه.',
    'Your transfer is in. The TIFFANY team confirms it arrived and this turns to «Paid» — usually within minutes.',
    'Havalen kaydedildi. TIFFANY ekibi ulaştığını onaylayınca burada «Ödendi» görünür; genelde birkaç dakika.'),
  paid: () => L(
    'پرداختت تأیید شد. سفارشت رو آماده می‌کنیم.',
    'Your payment is confirmed. We are getting your order ready.',
    'Ödemen onaylandı. Siparişini hazırlıyoruz.'),
  rejected: () => L(
    'تیم تیفانی واریزت رو پیدا نکرد. اگه پول از حسابت کم شده، از تیکت یا واتس‌اپ رسید بانکی رو بفرست؛ وگرنه از صفحه‌ی پرداخت دوباره امتحان کن.',
    'The TIFFANY team could not find your transfer. If the money left your account, send the bank receipt through Tickets or WhatsApp; otherwise try again from the payment page.',
    'TIFFANY ekibi havaleni bulamadı. Para hesabından çıktıysa banka dekontunu Destek’ten ya da WhatsApp’tan gönder; değilse ödeme sayfasından tekrar dene.'),
  mismatch: () => L(
    'مبلغی که واریز شد با سفارش دقیق جور نبود. تیم تیفانی بررسیش می‌کنه و اگه لازم باشه باهات تماس می‌گیره.',
    'The amount that arrived did not exactly match the order. The TIFFANY team will look at it and call you if needed.',
    'Gelen tutar siparişle tam eşleşmedi. TIFFANY ekibi bakacak ve gerekirse seni arayacak.'),
  short: () => L(
    'تیم تیفانی پرداختت رو بررسی می‌کنه و اگه لازم باشه باهات تماس می‌گیره.',
    'The TIFFANY team is checking your payment and will call you if needed.',
    'TIFFANY ekibi ödemeni kontrol ediyor; gerekirse seni arayacak.'),
  expired: () => L(
    'مهلت ۳۰ دقیقه‌ای تموم شد. اگه واریز کرده بودی، توی صفحه‌ی پرداخت «واریز کرده بودم» رو بزن؛ وگرنه تیم تیفانی برای پرداخت باهات تماس می‌گیره.',
    'The 30 minutes ran out. If you did transfer, tap «واریز کرده بودم» on the payment page; otherwise the TIFFANY team will call you about paying.',
    '30 dakikalık süre doldu. Havale yaptıysan ödeme sayfasında «واریز کرده بودم»a dokun; yapmadıysan TIFFANY ekibi ödeme için seni arayacak.'),
  canceled: () => L(
    'این پرداخت بسته شد. اگه سؤالی داری از تیکت یا واتس‌اپ بپرس.',
    'This payment was closed. Questions? Ask through Tickets or WhatsApp.',
    'Bu ödeme kapatıldı. Sorun varsa Destek’ten ya da WhatsApp’tan sor.'),
};
NOTES.odd = NOTES.short;

/** A card-to-card order on this phone, not (yet) paid: what its payment says. */
export const isC2c = (o) => o && o.pay === 'c2c';
export const payWord = (o) => (o.paid ? WORDS.paid() : (WORDS[o.payState] || WORDS.pending)());

/** Where this phone goes to pay (the server sends it on, or back here). */
export const payHref = (o) => `api/pay.php?a=go&o=${encodeURIComponent(o.code)}&k=${encodeURIComponent(o.payKey || '')}`;

/** The payment box on an order's sheet. */
export function payBox(o) {
  if (!isC2c(o)) return '';
  const st = o.paid ? 'paid' : (o.payState || 'pending');
  const note = (NOTES[st] || NOTES.pending)();
  const can = !o.paid && o.payKey && o.page !== false && o.status !== 'cancelled'
    && ['pending', 'claimed', 'rejected', 'mismatch', 'expired'].includes(st);
  return `
    <div class="paybox ${o.paid ? 'is-paid' : ''}">
      ${icon(o.paid ? 'check' : 'card', 18)}
      <div>
        <b>${esc(L('کارت‌به‌کارت', 'Card-to-card', 'Kartla havale'))} · ${esc(payWord(o))}</b>
        <p>${esc(note)}</p>
        ${can ? `<a class="btn btn-line btn-s" style="margin-top:11px" href="${esc(payHref(o))}" rel="noreferrer">${esc(
    st === 'pending' ? L('رفتن به صفحه‌ی پرداخت', 'Go to the payment page', 'Ödeme sayfasına git')
      : L('صفحه‌ی پرداخت', 'Payment page', 'Ödeme sayfası'))}</a>` : ''}
      </div>
    </div>`;
}

/** The server's answer for one order, by its code and payment key. */
export async function payStatus(code, key) {
  const r = await fetch(`api/pay.php?a=status&o=${encodeURIComponent(code)}&k=${encodeURIComponent(key)}`,
    { cache: 'no-store' });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  if (!j.ok || !j.order) throw new Error('no order');
  return j.order;
}
