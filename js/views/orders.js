/* Orders and tracking.

   An order's stage is derived from how long ago it was placed, so a demo left
   open for ten minutes moves on its own instead of sitting on "placed"
   forever. Real fulfilment replaces STAGES and nothing else changes. */
import { getProduct } from '../data.js';
import { icon } from '../icons.js';
import { esc, toman, num, fullDate, timeOf, relDay } from '../util.js';
import { state, getOrder } from '../store.js';
import { shot, empty, openSheet } from '../ui.js';

/* minutes after placing → the stage it reaches */
const STAGES = [
  { at: 0, name: 'Order placed', note: 'We have it. You will get an SMS.' },
  { at: 2, name: 'Preparing', note: 'Picked and being wrapped at the studio.' },
  { at: 10, name: 'With the courier', note: 'Handed over and on the road.' },
  { at: 30, name: 'Out for delivery', note: 'The courier will call before arriving.' },
  { at: 120, name: 'Delivered', note: 'Exchanges are open for 7 days.' },
];

export function stageOf(order) {
  const mins = (Date.now() - order.placed) / 60000;
  let i = 0;
  STAGES.forEach((s, idx) => { if (mins >= s.at) i = idx; });
  return i;
}

const ETA = (order) => {
  const d = new Date(order.placed + 3 * 86400000);
  return `${fullDate(d)}, ${relDay(d).toLowerCase()}`;
};

function orderCard(o) {
  const i = stageOf(o);
  const stage = STAGES[i];
  const items = o.items.map((l) => getProduct(l.id)).filter(Boolean);
  return `
  <button class="order" data-act="order" data-code="${o.code}" type="button"
          style="--dot:${i === STAGES.length - 1 ? 'var(--muted)' : 'var(--c-cherry)'}">
    <span class="order-top">
      <span class="order-code">${esc(o.code)}</span>
      <span class="status"><i></i>${esc(stage.name)}</span>
    </span>
    <span class="order-thumbs">
      ${items.slice(0, 5).map((p) => `<img src="assets/img/${p.img}-480.webp"
        alt="${esc(p.name)}" loading="lazy" decoding="async" width="42" height="52">`).join('')}
      ${items.length > 5 ? `<span class="tiny" style="align-self:center">+${items.length - 5}</span>` : ''}
    </span>
    <span class="order-foot">
      <span>${fullDate(new Date(o.placed))}, ${timeOf(new Date(o.placed))}</span>
      <span>${toman(o.total)}</span>
    </span>
  </button>`;
}

function trackSheet(o, { sample = false } = {}) {
  const now = sample ? 2 : stageOf(o);
  const items = o.items.map((l) => ({ l, p: getProduct(l.id) })).filter((x) => x.p);
  openSheet(`
    <h2>${sample ? 'Sample tracking' : esc(o.code)}</h2>
    <p class="lede">${sample
      ? 'This is what an order looks like once it is on its way.'
      : `Estimated delivery ${esc(ETA(o))}.`}</p>

    <div class="track" style="--accent:var(--c-cherry)">
      ${STAGES.map((s, i) => `
        <div class="step ${i < now ? 'done' : ''} ${i === now ? 'now' : ''}">
          <b>${esc(s.name)}</b><span>${esc(s.note)}</span>
        </div>`).join('')}
    </div>

    ${items.length ? `
    <p class="eyebrow" style="margin:12px 0 4px">In this order</p>
    ${items.map(({ l, p }) => `
      <div class="line">
        <span class="shot"><img ${shot(p.img, '78px')} alt="${esc(p.name)}"
          loading="lazy" decoding="async" width="480" height="600"></span>
        <div>
          <div class="line-name">${esc(p.name)}</div>
          <div class="line-opt">${esc(l.size)} · ${esc(l.colour)} · ${num(l.qty)}</div>
          <div class="line-foot"><span></span>
            <span class="line-price">${toman(p.price * l.qty)}</span></div>
        </div>
      </div>`).join('')}
    <div class="totals">
      <div class="trow"><span>Subtotal</span><b>${toman(o.subtotal)}</b></div>
      <div class="trow"><span>Delivery</span><b>${o.shipping ? toman(o.shipping) : 'Free'}</b></div>
      <div class="trow big"><span>Total</span><b>${toman(o.total)}</b></div>
    </div>` : ''}

    ${!sample && o.address?.line ? `
    <p class="eyebrow" style="margin:16px 0 6px">Delivering to</p>
    <p class="lede" style="margin:0">${esc(o.address.line)}, ${esc(o.address.city)}</p>` : ''}

    <div class="topgap"></div>
    <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">Close</button>`,
  { label: 'Tracking' });
}

const SAMPLE = () => ({
  code: 'TF-00000',
  placed: Date.now() - 12 * 60000,
  items: [],
  subtotal: 0, shipping: 0, total: 0,
  address: null,
});

export default {
  tab: 'orders',
  title: 'Orders',
  topbarAt: 20,

  render() {
    if (!state.orders.length) {
      return `<div class="wrap"><div class="topgap"></div>
        <h1 class="serif" style="font-size:30px">Orders</h1></div>
        ${empty('box', 'No orders yet',
          'Once you order, this is where the courier turns up.',
          `<button class="btn btn-ink btn-s" data-act="nav" data-to="/shop" type="button">Shop the season</button>
           <div style="height:9px"></div>
           <button class="btn btn-line btn-s" data-act="sample" type="button">See how tracking looks</button>`)}`;
    }
    return `
    <div class="wrap">
      <div class="topgap"></div>
      <h1 class="serif" style="font-size:30px">Orders</h1>
      <p class="lede" style="margin-bottom:18px">${num(state.orders.length)}
        order${state.orders.length === 1 ? '' : 's'} on this phone.</p>
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

    /* Stages move with the clock; a minute tick keeps the list honest. */
    const t = setInterval(() => {
      document.dispatchEvent(new CustomEvent('view:refresh'));
    }, 60000);
    signal?.addEventListener('abort', () => clearInterval(t));
  },
};
