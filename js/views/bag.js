/* The bag, and the checkout that empties it.

   Nothing here talks to a payment gateway — placing an order writes a record
   into localStorage and lands it in Orders. That is the whole point of a
   preview: the studio can walk the flow end to end without a merchant account. */
import { BRAND } from '../config.js';
import { getProduct } from '../data.js';
import { icon } from '../icons.js';
import { esc, toman, num, orderCode, atDay, tap } from '../util.js';
import {
  state, setQty, clearBag, addOrder, patch,
} from '../store.js';
import { shot, empty, openSheet, closeSheet, toast } from '../ui.js';
import { go } from '../router.js';

export const subtotal = () => state.bag.reduce((n, l) => {
  const p = getProduct(l.id);
  return n + (p ? p.price * l.qty : 0);
}, 0);

const shippingFor = (sub) => (sub >= BRAND.freeShipping || sub === 0 ? 0 : BRAND.shipping);

function lineHTML(l) {
  const p = getProduct(l.id);
  if (!p) return '';
  return `
  <div class="line" data-line="${l.id}|${l.size}|${l.colour}">
    <button class="shot" data-act="product" data-id="${p.id}" type="button">
      <img ${shot(p.img, '78px')} alt="${esc(p.name)}" loading="lazy" decoding="async"
           width="480" height="600">
    </button>
    <div>
      <div class="line-name">${esc(p.name)}</div>
      <div class="line-opt">${esc(l.size)} · ${esc(l.colour)}</div>
      <div class="line-foot">
        <div class="stepper">
          <button data-qty="-1" type="button" aria-label="One fewer">${icon('minus', 15)}</button>
          <b>${num(l.qty)}</b>
          <button data-qty="1" type="button" aria-label="One more">${icon('plus', 15)}</button>
        </div>
        <span class="line-price">${toman(p.price * l.qty)}</span>
      </div>
    </div>
  </div>`;
}

function checkoutSheet() {
  const sub = subtotal();
  const ship = shippingFor(sub);
  const { profile, address } = state;

  openSheet(`
    <h2>Checkout</h2>
    <p class="lede">Preview only — no card is charged and nothing is sent.</p>

    <form id="coForm" novalidate>
      <p class="eyebrow" style="margin:18px 0 10px">Who it is for</p>
      <div class="field"><label for="coName">Full name</label>
        <input id="coName" name="name" autocomplete="name" value="${esc(profile.name)}" required></div>
      <div class="field"><label for="coPhone">Phone</label>
        <input id="coPhone" name="phone" inputmode="tel" autocomplete="tel"
               placeholder="09xx xxx xxxx" value="${esc(profile.phone)}" required></div>

      <p class="eyebrow" style="margin:20px 0 10px">Where it goes</p>
      <div class="field"><label for="coLine">Address</label>
        <textarea id="coLine" name="line" autocomplete="street-address"
                  placeholder="Street, building, unit" required>${esc(address.line)}</textarea></div>
      <div class="field-row">
        <div class="field"><label for="coCity">City</label>
          <input id="coCity" name="city" autocomplete="address-level2"
                 value="${esc(address.city)}" required></div>
        <div class="field"><label for="coPostal">Post code</label>
          <input id="coPostal" name="postal" inputmode="numeric"
                 autocomplete="postal-code" value="${esc(address.postal)}"></div>
      </div>

      <p class="eyebrow" style="margin:20px 0 10px">Payment</p>
      <div class="sizes">
        <button class="chip on" data-pay="card" type="button">${icon('card', 15)}Card, on delivery</button>
        <button class="chip" data-pay="online" type="button">${icon('lock', 15)}Pay online</button>
      </div>

      <div class="totals">
        <div class="trow"><span>Subtotal</span><b>${toman(sub)}</b></div>
        <div class="trow"><span>Delivery</span><b>${ship ? toman(ship) : 'Free'}</b></div>
        <div class="trow big"><span>Total</span><b>${toman(sub + ship)}</b></div>
      </div>

      <button class="btn btn-ink btn-block" type="submit">Place order</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">Not yet</button>
    </form>`,
  {
    label: 'Checkout',
    onMount(sheet) {
      let pay = 'card';
      sheet.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pay]');
        if (!b) return;
        pay = b.dataset.pay;
        sheet.querySelectorAll('[data-pay]').forEach((x) => x.classList.toggle('on', x === b));
      });

      sheet.querySelector('#coForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const get = (k) => String(f.get(k) || '').trim();
        if (!get('name') || !get('phone') || !get('line') || !get('city')) {
          toast('Fill in name, phone, address and city', 'info');
          return;
        }
        patch('profile', { name: get('name'), phone: get('phone') });
        patch('address', { line: get('line'), city: get('city'), postal: get('postal') });

        const code = orderCode(Date.now() + get('phone'));
        addOrder({
          code,
          placed: Date.now(),
          pay,
          items: state.bag.map((l) => ({ ...l })),
          subtotal: sub,
          shipping: ship,
          total: sub + ship,
          address: { ...state.address },
          step: 0,
        });
        clearBag();
        tap(18);
        closeSheet();
        document.dispatchEvent(new CustomEvent('bag:changed'));
        go('/orders');
        setTimeout(() => toast(`Order ${code} placed`, 'check', 3200), 260);
      });
    },
  });
}

export default {
  tab: 'bag',
  title: 'Bag',
  topbarAt: 20,

  render() {
    if (!state.bag.length) {
      return `<div class="wrap"><div class="topgap"></div>
        <h1 class="serif" style="font-size:30px">Bag</h1></div>
        ${empty('bag', 'Nothing in the bag yet',
          'Everything is cut in one small run — when a size goes, it goes.',
          '<button class="btn btn-ink btn-s" data-act="nav" data-to="/shop" type="button">Start shopping</button>')}`;
    }

    const sub = subtotal();
    const ship = shippingFor(sub);
    const left = Math.max(0, BRAND.freeShipping - sub);
    const pct = Math.min(100, (sub / BRAND.freeShipping) * 100);

    return `
    <div class="wrap">
      <div class="topgap"></div>
      <h1 class="serif" style="font-size:30px">Bag</h1>
      <p class="lede" style="margin-bottom:6px">${num(state.bag.reduce((n, l) => n + l.qty, 0))}
        item${state.bag.reduce((n, l) => n + l.qty, 0) === 1 ? '' : 's'} held for 60 minutes.</p>

      <div class="freebar">
        <p class="tiny" style="margin:0 0 7px">${left
          ? `${toman(left)} more for free delivery`
          : 'Delivery is on us'}</p>
        <div class="freebar-track"><div class="freebar-fill" style="width:${pct}%"></div></div>
      </div>

      <div style="height:8px"></div>
      ${state.bag.map(lineHTML).join('')}

      <div class="totals">
        <div class="trow"><span>Subtotal</span><b>${toman(sub)}</b></div>
        <div class="trow"><span>Delivery</span><b>${ship ? toman(ship) : 'Free'}</b></div>
        <div class="trow big"><span>Total</span><b>${toman(sub + ship)}</b></div>
      </div>

      <div style="height:14px"></div>
      <button class="btn btn-ink btn-block" data-act="checkout" type="button">
        Checkout · ${toman(sub + ship)}</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="nav" data-to="/shop" type="button">
        Keep looking</button>
      <div style="height:30px"></div>
    </div>`;
  },

  mount(app, signal) {
    app.addEventListener('click', (e) => {
      const q = e.target.closest('[data-qty]');
      if (q) {
        const row = q.closest('[data-line]');
        const [id, size, colour] = row.dataset.line.split('|');
        const line = state.bag.find((l) => l.id === id && l.size === size && l.colour === colour);
        if (!line) return;
        setQty(id, size, colour, line.qty + Number(q.dataset.qty));
        tap();
        document.dispatchEvent(new CustomEvent('bag:changed'));
        document.dispatchEvent(new CustomEvent('view:refresh'));
        return;
      }
      if (e.target.closest('[data-act="checkout"]')) checkoutSheet();
    }, { signal });
  },
};
