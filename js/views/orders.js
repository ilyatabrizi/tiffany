/* Orders and tracking.

   A real order (placed while online ordering is on) carries the status the
   team sets in the back office; opening this tab asks /api/track.php for the
   latest, keyed by the order code AND the phone it was placed with.
   An order kept from the old preview checkout (before the shop took real
   orders) was never sent anywhere, and says so; it does not move.

   A card-to-card order (js/pay.js) also shows where its payment stands, and
   this tab is where tayidshod's «برگشت به فروشگاه» lands:
   /#/orders?pay=CODE&k=KEY asks the server for that order's answer, takes the
   key out of the address bar, and opens the order with it. */
import { getProduct } from '../data.js';
import { icon } from '../icons.js';
import { esc, toman, num, fullDate, timeOf, relDay, COMMA } from '../util.js';
import { state, getOrder, save, addOrder } from '../store.js';
import {
  shot, empty, openSheet, imgSrc, sheetIsOpen, toast,
} from '../ui.js';
import {
  isC2c, payWord, payBox, payStatus,
} from '../pay.js';
import { isLooksOpen } from '../looks.js';
import { lineOpt, totals } from './bag.js';
import { L } from '../i18n.js';
import { provinceName, POST_TRACKING } from '../post.js';
import { live } from '../live.js';

/* minutes after placing → the stage it reaches */
const STAGES = [
  { at: 0, name: L('ثبت شد', 'Order placed', 'Sipariş alındı'),
    note: L('سفارشت رسید دستمون و به‌زودی بررسیش می‌کنیم.', 'We have it and will look at it shortly.', 'Siparişin bize ulaştı, kısa süre içinde bakacağız.') },
  { at: 2, name: L('داریم آماده‌ش می‌کنیم', 'Preparing', 'Hazırlanıyor'),
    note: L('از انبار جمعش کردیم و داریم بسته‌بندیش می‌کنیم.', 'Picked and being wrapped at the studio.', 'Atölyede toplandı, paketleniyor.') },
  { at: 10, name: L('تحویل پست شد', 'With Iran Post', 'İran Postası’nda'),
    note: L('بسته رو تحویل پست دادیم؛ کد رهگیریش همین‌جا میاد.', 'Handed to Iran Post — its tracking code shows up here.',
      'Koli İran Postası’na verildi; takip kodu burada görünür.') },
  { at: 30, name: L('توی راه', 'On its way', 'Yolda'),
    note: L('پست، رایگان و به سراسر ایران می‌رسونه.', 'Iran Post delivers it free, anywhere in Iran.',
      'İran Postası ücretsiz, İran’ın her yerine getirir.') },
  { at: 120, name: L('تحویل شد', 'Delivered', 'Teslim edildi'),
    note: L('تا ۷ روز می‌تونی عوضش کنی.', 'Exchanges are open for 7 days.', '7 gün içinde değişim yapabilirsin.') },
];

/* The back office's statuses on this page's five steps. */
const FROM_STATUS = { new: 0, confirmed: 1, shipped: 2, delivered: 4 };
const cancelled = (o) => o.server && o.status === 'cancelled';
const CANCELLED = () => L('لغو شد', 'Cancelled', 'İptal edildi');
const PREVIEW = () => L('پیش‌نمایش؛ ارسال نشد', 'Preview — never sent', 'Önizleme — gönderilmedi');

/** The sample on the empty page walks the stages on the clock; a real order
    sits where the team put it; an old preview order never moves. */
export function stageOf(order, { sample = false } = {}) {
  if (order.server) return FROM_STATUS[order.status] ?? 0;
  if (!sample) return 0;
  const mins = (Date.now() - order.placed) / 60000;
  let i = 0;
  STAGES.forEach((s, idx) => { if (mins >= s.at) i = idx; });
  return i;
}

/** A line of an order with the piece it was: today's catalogue when the piece
    is still there, else what the line kept when it was placed. */
function pieceOf(l) {
  const p = getProduct(l.id);
  if (p) return p;
  if (!l.name || !l.img) return null;
  return { id: l.id, name: l.name, img: l.img, price: l.price || 0, colours: [] };
}
const linePrice = (l, p) => (l.price ? l.price : p.price) * l.qty;

/* The promise is in working days: Fridays do not count (the terms say so;
   public holidays are not known here, so this stays «حدوداً»). */
const ETA = (order) => {
  const d = new Date(order.placed);
  for (let n = live.deliveryDays || 3; n > 0;) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 5) n -= 1;
  }
  return `${fullDate(d)}${COMMA}${relDay(d)}`;
};

/* Not paid yet, card-to-card: the payment is the news, not the stage. */
const awaitingPay = (o) => isC2c(o) && !o.paid && !cancelled(o);

function orderCard(o) {
  const i = stageOf(o);
  const stage = cancelled(o) ? { name: CANCELLED() } : !o.server ? { name: PREVIEW() }
    : awaitingPay(o) ? { name: payWord(o) } : STAGES[i];
  const items = o.items.map(pieceOf).filter(Boolean);
  const placed = new Date(o.placed);
  return `
  <button class="order" data-act="order" data-code="${esc(o.code)}" type="button"
          style="--dot:${i === STAGES.length - 1 || cancelled(o) || !o.server ? 'var(--muted)' : 'var(--c-cherry)'}">
    <span class="order-top">
      <span class="order-code" dir="ltr">${esc(o.code)}</span>
      <span class="status"><i></i>${esc(stage.name)}</span>
    </span>
    <span class="order-thumbs">
      ${items.slice(0, 5).map((p) => `<img src="${imgSrc(p.img, 480)}"
        alt="${esc(p.name)}" loading="lazy" decoding="async" width="42" height="52">`).join('')}
      ${items.length > 5 ? `<span class="tiny" style="align-self:center">${num(items.length - 5)}+</span>` : ''}
    </span>
    <span class="order-foot">
      <span>${esc(L(`${fullDate(placed)}، ساعت ${timeOf(placed)}`,
        `${fullDate(placed)}, ${timeOf(placed)}`, `${fullDate(placed)}, ${timeOf(placed)}`))}</span>
      <span>${o.pay === 'credit' ? esc(L('با اعتبار', 'Paid with credit', 'Krediyle ödendi')) : toman(o.total)}</span>
    </span>
  </button>`;
}

/** What an order's cashback is doing: on its way, in the account, or gone. */
function cashbackOf(o) {
  const cb = Number(o.cashback) || 0;
  if (!o.server || cb <= 0) return '';
  const [head, note] = cancelled(o)
    ? [L(`${toman(cb)} اعتبار برگشتی`, `${toman(cb)} cashback`, `${toman(cb)} kredi`),
      L('سفارش لغو شد، پس این اعتبار به حسابت اضافه نمی‌شه.', 'The order was cancelled, so this credit is not added.',
        'Sipariş iptal edildi; bu kredi eklenmez.')]
    : o.status === 'delivered'
      ? [L(`${toman(cb)} اعتبار به حسابت اضافه شد`, `${toman(cb)} credit added to your account`, `${toman(cb)} kredi hesabına eklendi`),
        L('توی خرید بعدی، داخل سبد ازش استفاده کن.', 'Use it in the bag on your next order.', 'Sonraki siparişinde sepette kullan.')]
      : [L(`${toman(cb)} اعتبار برگشتی`, `${toman(cb)} cashback`, `${toman(cb)} kredi`),
        L('بعد از تحویل سفارش به حسابت اضافه می‌شه.', 'Added to your account once the order is delivered.',
          'Sipariş teslim edilince hesabına eklenir.')];
  return `<p class="cbline">${icon('gift', 16)}<span><b>${esc(head)}</b> ${esc(note)}</span></p>`;
}

function trackSheet(o, { sample = false } = {}) {
  const now = sample ? 2 : stageOf(o);
  const preview = !sample && !o.server;
  const items = o.items.map((l) => ({ l, p: pieceOf(l) })).filter((x) => x.p);
  openSheet(`
    <h2>${sample ? esc(L('نمونه‌ی پیگیری', 'Sample tracking', 'Örnek takip')) : `<span dir="ltr">${esc(o.code)}</span>`}</h2>
    <p class="lede">${sample
      ? esc(L('وقتی یه سفارش توی راهه، این شکلی می‌بینیش.', 'This is what an order on its way looks like.',
        'Yoldaki bir sipariş böyle görünür.'))
      : preview
        ? esc(L('این سفارش توی پیش‌نمایش فروشگاه ثبت شده بود و برای تیفانی فرستاده نشد.',
          'This order was made in the shop’s preview and was never sent to TIFFANY.',
          'Bu sipariş mağazanın önizlemesinde verildi ve TIFFANY’ye hiç gönderilmedi.'))
        : cancelled(o)
          ? esc(L('این سفارش لغو شد. اگه سؤالی داری با شعبه‌ها تماس بگیر.',
            'This order was cancelled. Questions? Call any of our stores.',
            'Bu sipariş iptal edildi. Sorun varsa mağazalarımızı ara.'))
          : esc(L(`حدوداً ${ETA(o)} می‌رسه.`, `Estimated delivery ${ETA(o)}.`, `Tahmini teslimat: ${ETA(o)}.`))}</p>

    ${sample ? '' : payBox(o)}
    ${sample ? '' : postBox(o)}

    ${cancelled(o) || preview ? '' : `<div class="track" style="--accent:var(--c-cherry)">
      ${STAGES.map((s, i) => `
        <div class="step ${i < now ? 'done' : ''} ${i === now ? 'now' : ''}">
          <b>${esc(s.name)}</b><span>${esc(s.note)}</span>
        </div>`).join('')}
    </div>`}

    ${items.length ? `
    <p class="eyebrow" style="margin:12px 0 4px">${esc(L('توی این سفارش', 'In this order', 'Bu siparişte'))}</p>
    ${items.map(({ l, p }) => `
      <div class="line">
        <span class="shot"><img ${shot(p.img, '78px')} alt="${esc(p.name)}"
          loading="lazy" decoding="async" width="480" height="600"></span>
        <div>
          <div class="line-name">${esc(p.name)}</div>
          <div class="line-opt">${lineOpt(p, l)} — ${esc(L(`${num(l.qty)} تا`, `× ${num(l.qty)}`, `${num(l.qty)} adet`))}</div>
          <div class="line-foot"><span></span>
            <span class="line-price">${toman(linePrice(l, p))}</span></div>
        </div>
      </div>`).join('')}
    ${totals(o.subtotal, o.shipping, Number(o.credit) || 0)}
    ${cashbackOf(o)}` : ''}

    ${!sample && o.address?.line ? `
    <p class="eyebrow" style="margin:16px 0 6px">${esc(L('می‌فرستیم به', 'Delivering to', 'Teslimat adresi'))}</p>
    <p class="lede" style="margin:0">${esc([o.address.line, o.address.city, provinceName(o.address.province)]
    .filter(Boolean).join(COMMA))}${o.address.postal ? `<br><span class="tiny">${esc(L('کد پستی', 'Postal code', 'Posta kodu'))}
      <span dir="ltr">${esc(o.address.postal)}</span></span>` : ''}</p>` : ''}

    <div class="topgap"></div>
    <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${esc(L('بستن', 'Close', 'Kapat'))}</button>`,
  {
    label: L('پیگیری سفارش', 'Track order', 'Sipariş takibi'),
    onMount(sheet) {
      sheet.querySelector('[data-act="post-copy"]')?.addEventListener('click', async (e) => {
        const code = e.currentTarget.dataset.code;
        try {
          await navigator.clipboard.writeText(code);
          toast(L('کد رهگیری کپی شد', 'Tracking code copied', 'Takip kodu kopyalandı'), 'copy');
        } catch {
          toast(code, 'copy', 5000);
        }
      });
    },
  });
}

/** Once the team posts the parcel: Iran Post's tracking code, to copy and
    follow on the post office's own site. */
function postBox(o) {
  const code = String(o.postCode || '');
  if (!o.server || !code || cancelled(o)) return '';
  return `
    <div class="post-box">
      <p class="eyebrow">${icon('truck', 15)}${esc(L('کد رهگیری پست', 'Iran Post tracking code', 'İran Postası takip kodu'))}</p>
      <b class="post-code" dir="ltr">${esc(code)}</b>
      <p class="tiny">${esc(L('کد رو کپی کن و توی سایت رهگیری پست بزن.', 'Copy the code and paste it on Iran Post’s tracking site.',
    'Kodu kopyala ve İran Postası’nın takip sitesine yapıştır.'))}</p>
      <div class="post-acts">
        <button class="btn btn-line btn-s" data-act="post-copy" data-code="${esc(code)}" type="button">${icon('copy', 16)}<span>${esc(L('کپی کد', 'Copy code', 'Kodu kopyala'))}</span></button>
        <a class="btn btn-line btn-s" href="${POST_TRACKING}" target="_blank" rel="noopener">${esc(L('پیگیری در سایت پست', 'Track on post.ir', 'post.ir’de takip et'))}</a>
      </div>
    </div>`;
}

const SAMPLE = () => ({
  code: 'TF-00000',
  placed: Date.now() - 12 * 60000,
  items: [],
  subtotal: 0, shipping: 0, total: 0,
  address: null,
});

/** Ask the shop where the real orders are; refresh the list if anything moved.
    Not twice within half a minute, however often the tab is drawn: many
    phones share one address on Iranian networks, and the server counts per
    address. */
let trackedAt = 0;
async function trackReal(signal) {
  if (Date.now() - trackedAt < 30000) return;
  trackedAt = Date.now();
  const byPhone = {};
  /* Delivered orders are still asked about for 30 days: a return («مرجوع شد»)
     cancels one and takes its cashback, and a tracking code may come late. */
  const recent = (o) => o.status === 'delivered' && Date.now() - o.placed < 30 * 86400000;
  state.orders.filter((o) => o.server && o.phone && (!['delivered', 'cancelled'].includes(o.status) || awaitingPay(o) || recent(o)))
    .forEach((o) => { (byPhone[o.phone] ||= []).push(o.code); });
  let moved = false;
  for (const [phone, codes] of Object.entries(byPhone)) {
    try {
      const r = await fetch('api/track.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, codes }), signal,
      });
      const j = await r.json();
      for (const [code, s] of Object.entries(j.orders || {})) {
        const o = getOrder(code);
        if (!o) continue;
        if (o.status !== s.status) { o.status = s.status; moved = true; }
        if ((s.post_code || '') !== (o.postCode || '')) { o.postCode = s.post_code || ''; moved = true; }
        if (isC2c(o) && (o.payState !== s.pay_state || Boolean(o.paid) !== Boolean(s.paid))) {
          o.payState = s.pay_state;
          o.paid = Boolean(s.paid);
          moved = true;
        }
      }
    } catch { return; }       // offline or left the page: keep what we had
  }
  if (moved && !signal?.aborted) {
    save();
    if (!sheetIsOpen() && !isLooksOpen()) document.dispatchEvent(new CustomEvent('view:refresh'));
  }
}

/** Back from tayidshod's payment page: the server's answer for that order,
    and the order opened on it. An order paid on another browser than the
    one it was placed in (Instagram's own, say) is added to this phone. */
async function landFromPayment(code, key) {
  const here = () => location.hash.startsWith('#/orders');
  let s;
  try { s = await payStatus(code, key); } catch {
    if (here()) {
      toast(L('وضعیت پرداخت رو الان نتونستیم بگیریم؛ چند دقیقه بعد همین‌جا رو ببین.',
        'We could not get the payment status just now — look here again in a few minutes.',
        'Ödeme durumu şu an alınamadı; birkaç dakika sonra buraya tekrar bak.'), 'info', 4500);
    }
    return;
  }
  let o = getOrder(code);
  if (!o) {
    o = addOrder({
      code, placed: s.created_at * 1000, pay: s.pay, payKey: key, server: true, status: s.status,
      subtotal: s.subtotal, shipping: s.shipping, total: s.total, phone: s.phone,
      credit: Number(s.credit) || 0, cashback: Number(s.cashback) || 0,
      items: s.items.map((i) => ({
        id: i.id, size: i.size, colour: i.colour, qty: i.qty, name: i.name, img: i.img,
        price: i.price, colourName: i.colour_name,
      })),
      address: null,
      step: 0,
    });
  }
  Object.assign(o, {
    pay: s.pay, status: s.status, payState: s.pay_state, paid: s.paid, page: s.page, payKey: o.payKey || key,
  });
  save();
  if (!here()) return;          // the customer has moved on; the order is still kept up to date
  document.dispatchEvent(new CustomEvent('view:refresh'));
  trackSheet(o);
}

export default {
  tab: 'orders',
  title: L('سفارش‌ها', 'Orders', 'Siparişler'),
  topbarAt: 20,

  render() {
    const h1 = `<h1 class="serif" style="font-size:30px">${esc(L('سفارش‌ها', 'Orders', 'Siparişler'))}</h1>`;
    if (!state.orders.length) {
      return `<div class="wrap"><div class="topgap"></div>${h1}</div>
        ${empty('box', L('هنوز سفارشی نداری', 'No orders yet', 'Henüz siparişin yok'),
          L('سفارش که بدی، از همین‌جا تا در خونه دنبالش می‌کنی؛ ارسال با پست، رایگان به سراسر ایران.',
            'Once you order, follow it here to your door — free delivery by Iran Post anywhere in Iran.',
            'Sipariş verdiğinde kapına kadar buradan takip et; İran Postası ile ücretsiz teslimat.'),
          `<button class="btn btn-ink btn-s" data-act="nav" data-to="/shop" type="button">${esc(L('بریم خرید', 'Shop the season', 'Alışverişe başla'))}</button>
           <div style="height:9px"></div>
           <button class="btn btn-line btn-s" data-act="sample" type="button">${esc(L('ببین پیگیری چه شکلیه', 'See how tracking looks', 'Takip nasıl görünüyor'))}</button>`)}`;
    }
    return `
    <div class="wrap">
      <div class="topgap"></div>
      ${h1}
      <p class="lede" style="margin-bottom:18px">${esc(L(
        `${num(state.orders.length)} تا سفارش روی همین گوشی.`,
        `${num(state.orders.length)} order${state.orders.length === 1 ? '' : 's'} on this phone.`,
        `Bu telefonda ${num(state.orders.length)} sipariş.`))}</p>
      ${state.orders.map(orderCard).join('')}
      <div style="height:30px"></div>
    </div>`;
  },

  mount(app, signal) {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const code = q.get('pay');
    const key = q.get('k');
    const landing = code && key && /^TF-\d{5}$/.test(code) && /^[a-f0-9]{24}$/.test(key);
    if (landing) {
      /* The key leaves the address bar (and the history) at once. */
      history.replaceState(history.state, '', '#/orders');
      landFromPayment(code, key);
    } else if (code) {
      history.replaceState(history.state, '', '#/orders');
    }

    app.addEventListener('click', (e) => {
      const card = e.target.closest('[data-act="order"]');
      if (card) {
        const o = getOrder(card.dataset.code);
        if (o) trackSheet(o);
        return;
      }
      if (e.target.closest('[data-act="sample"]')) trackSheet(SAMPLE(), { sample: true });
    }, { signal });

    /* Real orders move when the team moves them: opening the tab asks, and
       so does a tick every three minutes while it stays open — never in a
       hidden tab, and the list is only redrawn when something moved and no
       sheet (a tracking sheet being read, the cookie question) is open. */
    /* Not while landing from a payment: that answer is on its way, and a
       redraw from here would close the sheet it opens. */
    if (!landing) trackReal(signal);
    const t = setInterval(() => {
      if (!document.hidden) trackReal(signal);
    }, 180000);
    signal?.addEventListener('abort', () => clearInterval(t));
  },
};
