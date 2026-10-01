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
      <div class="line-opt"><span dir="ltr">${esc(l.size)}</span> — ${esc(l.colour)}</div>
      <div class="line-foot">
        <div class="stepper">
          <button data-qty="-1" type="button" aria-label="یکی کمتر">${icon('minus', 15)}</button>
          <b>${num(l.qty)}</b>
          <button data-qty="1" type="button" aria-label="یکی بیشتر">${icon('plus', 15)}</button>
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
    <h2>تکمیل خرید</h2>
    <p class="lede">فقط پیش‌نمایش است — پولی کم نمی‌شود و چیزی ارسال نمی‌شود.</p>

    <form id="coForm" novalidate>
      <p class="eyebrow" style="margin:18px 0 10px">برای چه کسی</p>
      <div class="field"><label for="coName">نام و نام خانوادگی</label>
        <input id="coName" name="name" autocomplete="name" value="${esc(profile.name)}" required></div>
      <div class="field"><label for="coPhone">شمارهٔ موبایل</label>
        <input id="coPhone" name="phone" inputmode="tel" autocomplete="tel" dir="ltr"
               placeholder="۰۹۱۲ ۰۰۰ ۰۰۰۰" value="${esc(profile.phone)}" required></div>

      <p class="eyebrow" style="margin:20px 0 10px">کجا بفرستیم</p>
      <div class="field"><label for="coLine">نشانی</label>
        <textarea id="coLine" name="line" autocomplete="street-address"
                  placeholder="خیابان، پلاک، واحد" required>${esc(address.line)}</textarea></div>
      <div class="field-row">
        <div class="field"><label for="coCity">شهر</label>
          <input id="coCity" name="city" autocomplete="address-level2"
                 value="${esc(address.city)}" required></div>
        <div class="field"><label for="coPostal">کد پستی</label>
          <input id="coPostal" name="postal" inputmode="numeric" dir="ltr"
                 autocomplete="postal-code" value="${esc(address.postal)}"></div>
      </div>

      <p class="eyebrow" style="margin:20px 0 10px">پرداخت</p>
      <div class="sizes">
        <button class="chip on" data-pay="card" type="button">${icon('card', 15)}کارت، موقع تحویل</button>
        <button class="chip" data-pay="online" type="button">${icon('lock', 15)}پرداخت آنلاین</button>
      </div>

      <div class="totals">
        <div class="trow"><span>جمع</span><b>${toman(sub)}</b></div>
        <div class="trow"><span>ارسال</span><b>${ship ? toman(ship) : 'رایگان'}</b></div>
        <div class="trow big"><span>مبلغ کل</span><b>${toman(sub + ship)}</b></div>
      </div>

      <button class="btn btn-ink btn-block" type="submit">ثبت سفارش</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">فعلاً نه</button>
    </form>`,
  {
    label: 'تکمیل خرید',
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
          toast('اسم، شماره، نشانی و شهر را پر کن', 'info');
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
        setTimeout(() => toast(`سفارش ${code} ثبت شد`, 'check', 3200), 260);
      });
    },
  });
}

export default {
  tab: 'bag',
  title: 'سبد',
  topbarAt: 20,

  render() {
    if (!state.bag.length) {
      return `<div class="wrap"><div class="topgap"></div>
        <h1 class="serif" style="font-size:30px">سبد</h1></div>
        ${empty('bag', 'سبدت خالی است',
          'هر مدل تیراژ کمی دارد؛ سایزی که تمام شود، تمام است.',
          '<button class="btn btn-ink btn-s" data-act="nav" data-to="/shop" type="button">شروع خرید</button>')}`;
    }

    const sub = subtotal();
    const ship = shippingFor(sub);
    const left = Math.max(0, BRAND.freeShipping - sub);
    const pct = Math.min(100, (sub / BRAND.freeShipping) * 100);

    return `
    <div class="wrap">
      <div class="topgap"></div>
      <h1 class="serif" style="font-size:30px">سبد</h1>
      <p class="lede" style="margin-bottom:6px">${num(state.bag.reduce((n, l) => n + l.qty, 0))}
        قطعه، ۶۰ دقیقه برایت نگه داشته می‌شود.</p>

      <div class="freebar">
        <p class="tiny" style="margin:0 0 7px">${left
          ? `${toman(left)} دیگر تا ارسال رایگان`
          : 'ارسال با ماست'}</p>
        <div class="freebar-track"><div class="freebar-fill" style="width:${pct}%"></div></div>
      </div>

      <div style="height:8px"></div>
      ${state.bag.map(lineHTML).join('')}

      <div class="totals">
        <div class="trow"><span>جمع</span><b>${toman(sub)}</b></div>
        <div class="trow"><span>ارسال</span><b>${ship ? toman(ship) : 'رایگان'}</b></div>
        <div class="trow big"><span>مبلغ کل</span><b>${toman(sub + ship)}</b></div>
      </div>

      <div style="height:14px"></div>
      <button class="btn btn-ink btn-block" data-act="checkout" type="button">
        تکمیل خرید — ${toman(sub + ship)}</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="nav" data-to="/shop" type="button">
        ادامهٔ خرید</button>
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
