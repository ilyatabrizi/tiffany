/* Orders and tracking.

   A real order (placed while online ordering is on) carries the status the
   team sets in the back office; opening this tab asks /api/track.php for the
   latest, keyed by the order code AND the phone it was placed with.
   A preview order (store switched off) still walks the stages on the clock,
   so the demo moves on its own. */
import { getProduct } from '../data.js';
import { icon } from '../icons.js';
import { esc, toman, num, fullDate, timeOf, relDay, COMMA } from '../util.js';
import { state, getOrder, save } from '../store.js';
import { shot, empty, openSheet, imgSrc } from '../ui.js';
import { lineOpt, totals } from './bag.js';
import { L } from '../i18n.js';

/* minutes after placing → the stage it reaches */
const STAGES = [
  { at: 0, name: L('ثبت شد', 'Order placed', 'Sipariş alındı'),
    note: L('سفارشت رسید دستمون. یه پیامک برات میاد.', 'We have it. You will get an SMS.', 'Siparişin bize ulaştı. Sana SMS gelecek.') },
  { at: 2, name: L('داریم آماده‌ش می‌کنیم', 'Preparing', 'Hazırlanıyor'),
    note: L('از انبار جمعش کردیم و داریم بسته‌بندیش می‌کنیم.', 'Picked and being wrapped at the studio.', 'Atölyede toplandı, paketleniyor.') },
  { at: 10, name: L('دست پیک', 'With the courier', 'Kuryede'),
    note: L('دادیمش دست پیک و راه افتاد.', 'Handed over and on the road.', 'Kuryeye teslim edildi, yolda.') },
  { at: 30, name: L('توی راه', 'Out for delivery', 'Dağıtımda'),
    note: L('پیک قبل از رسیدن بهت زنگ می‌زنه.', 'The courier will call before arriving.', 'Kurye gelmeden önce seni arayacak.') },
  { at: 120, name: L('تحویل شد', 'Delivered', 'Teslim edildi'),
    note: L('تا ۷ روز می‌تونی عوضش کنی.', 'Exchanges are open for 7 days.', '7 gün içinde değişim yapabilirsin.') },
];

/* The back office's statuses on this page's five steps. */
const FROM_STATUS = { new: 0, confirmed: 1, shipped: 2, delivered: 4 };
const cancelled = (o) => o.server && o.status === 'cancelled';
const CANCELLED = () => L('لغو شد', 'Cancelled', 'İptal edildi');

export function stageOf(order) {
  if (order.server) return FROM_STATUS[order.status] ?? 0;
  const mins = (Date.now() - order.placed) / 60000;
  let i = 0;
  STAGES.forEach((s, idx) => { if (mins >= s.at) i = idx; });
  return i;
}

const ETA = (order) => {
  const d = new Date(order.placed + 3 * 86400000);
  return `${fullDate(d)}${COMMA}${relDay(d)}`;
};

function orderCard(o) {
  const i = stageOf(o);
  const stage = cancelled(o) ? { name: CANCELLED() } : STAGES[i];
  const items = o.items.map((l) => getProduct(l.id)).filter(Boolean);
  const placed = new Date(o.placed);
  return `
  <button class="order" data-act="order" data-code="${esc(o.code)}" type="button"
          style="--dot:${i === STAGES.length - 1 || cancelled(o) ? 'var(--muted)' : 'var(--c-cherry)'}">
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
      <span>${toman(o.total)}</span>
    </span>
  </button>`;
}

function trackSheet(o, { sample = false } = {}) {
  const now = sample ? 2 : stageOf(o);
  const items = o.items.map((l) => ({ l, p: getProduct(l.id) })).filter((x) => x.p);
  openSheet(`
    <h2>${sample ? esc(L('نمونه‌ی پیگیری', 'Sample tracking', 'Örnek takip')) : `<span dir="ltr">${esc(o.code)}</span>`}</h2>
    <p class="lede">${sample
      ? esc(L('وقتی یه سفارش توی راهه، این شکلی می‌بینیش.', 'This is what an order on its way looks like.',
        'Yoldaki bir sipariş böyle görünür.'))
      : cancelled(o)
        ? esc(L('این سفارش لغو شد. اگه سؤالی داری با شعبه‌ها تماس بگیر.',
          'This order was cancelled. Questions? Call any of our stores.',
          'Bu sipariş iptal edildi. Sorun varsa mağazalarımızı ara.'))
        : esc(L(`حدوداً ${ETA(o)} می‌رسه.`, `Estimated delivery ${ETA(o)}.`, `Tahmini teslimat: ${ETA(o)}.`))}</p>

    ${cancelled(o) ? '' : `<div class="track" style="--accent:var(--c-cherry)">
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
            <span class="line-price">${toman(p.price * l.qty)}</span></div>
        </div>
      </div>`).join('')}
    ${totals(o.subtotal, o.shipping)}` : ''}

    ${!sample && o.address?.line ? `
    <p class="eyebrow" style="margin:16px 0 6px">${esc(L('می‌فرستیم به', 'Delivering to', 'Teslimat adresi'))}</p>
    <p class="lede" style="margin:0">${esc(o.address.line)}${COMMA}${esc(o.address.city)}</p>` : ''}

    <div class="topgap"></div>
    <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${esc(L('بستن', 'Close', 'Kapat'))}</button>`,
  { label: L('پیگیری سفارش', 'Track order', 'Sipariş takibi') });
}

const SAMPLE = () => ({
  code: 'TF-00000',
  placed: Date.now() - 12 * 60000,
  items: [],
  subtotal: 0, shipping: 0, total: 0,
  address: null,
});

/** Ask the shop where the real orders are; refresh the list if anything moved. */
async function trackReal(signal) {
  const byPhone = {};
  state.orders.filter((o) => o.server && o.phone && !['delivered', 'cancelled'].includes(o.status))
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
        if (o && o.status !== s.status) { o.status = s.status; moved = true; }
      }
    } catch { return; }       // offline or left the page: keep what we had
  }
  if (moved && !signal?.aborted) {
    save();
    document.dispatchEvent(new CustomEvent('view:refresh'));
  }
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
          L('سفارش که بدی، پیک از همین‌جا پیداش می‌شه.', 'Once you order, this is where the courier turns up.',
            'Sipariş verdiğinde kurye burada görünecek.'),
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
    app.addEventListener('click', (e) => {
      const card = e.target.closest('[data-act="order"]');
      if (card) {
        const o = getOrder(card.dataset.code);
        if (o) trackSheet(o);
        return;
      }
      if (e.target.closest('[data-act="sample"]')) trackSheet(SAMPLE(), { sample: true });
    }, { signal });

    /* Preview stages move with the clock; real ones move when the team moves
       them. A minute tick does both. */
    const t = setInterval(() => {
      document.dispatchEvent(new CustomEvent('view:refresh'));
    }, 60000);
    signal?.addEventListener('abort', () => clearInterval(t));
    trackReal(signal);
  },
};
