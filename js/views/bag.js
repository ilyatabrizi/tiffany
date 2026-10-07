/* The bag, and the checkout that empties it.

   Nothing here talks to a payment gateway — placing an order writes a record
   into localStorage and lands it in Orders. That is the whole point of a
   preview: the studio can walk the flow end to end without a merchant account. */
import { BRAND } from '../config.js';
import { getProduct, colourLabel, sizeLabel, isOneSize } from '../data.js';
import { icon } from '../icons.js';
import { esc, toman, num, orderCode, tap } from '../util.js';
import {
  state, setQty, clearBag, addOrder, patch,
} from '../store.js';
import { shot, empty, openSheet, closeSheet, toast } from '../ui.js';
import { go } from '../router.js';
import { L } from '../i18n.js';

export const subtotal = () => state.bag.reduce((n, l) => {
  const p = getProduct(l.id);
  return n + (p ? p.price * l.qty : 0);
}, 0);

/* Free on every order since 2026-10-07; BRAND.shipping is the one knob. */
const shippingFor = (sub) => (sub === 0 ? 0 : BRAND.shipping);

/** «M — سفید»: the size code stays Latin, the colour reads in this language. */
export const lineOpt = (p, l) =>
  `${isOneSize(l.size) ? esc(sizeLabel(l.size)) : `<span dir="ltr">${esc(l.size)}</span>`} — ${esc(colourLabel(p, l.colour))}`;

const totals = (sub, ship) => `
  <div class="totals">
    <div class="trow"><span>${esc(L('جمع', 'Subtotal', 'Ara toplam'))}</span><b>${toman(sub)}</b></div>
    <div class="trow"><span>${esc(L('ارسال', 'Delivery', 'Teslimat'))}</span><b>${ship ? toman(ship) : esc(L('رایگان', 'Free', 'Ücretsiz'))}</b></div>
    <div class="trow big"><span>${esc(L('مبلغ کل', 'Total', 'Toplam'))}</span><b>${toman(sub + ship)}</b></div>
  </div>`;
export { totals };

function lineHTML(l) {
  const p = getProduct(l.id);
  if (!p) return '';
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

function checkoutSheet() {
  const sub = subtotal();
  const ship = shippingFor(sub);
  const { profile, address } = state;

  openSheet(`
    <h2>${esc(L('تکمیل خرید', 'Checkout', 'Ödeme'))}</h2>
    <p class="lede">${esc(L(
      'این فقط پیش‌نمایشه؛ نه پولی کم می‌شه، نه چیزی فرستاده می‌شه.',
      'Preview only — no card is charged and nothing is sent.',
      'Yalnızca önizleme; karttan para çekilmez, hiçbir şey gönderilmez.'))}</p>

    <form id="coForm" novalidate>
      <p class="eyebrow" style="margin:18px 0 10px">${esc(L('برای کی', 'Who it is for', 'Kimin için'))}</p>
      <div class="field"><label for="coName">${esc(L('اسم و فامیل', 'Full name', 'Ad soyad'))}</label>
        <input id="coName" name="name" autocomplete="name" value="${esc(profile.name)}" required></div>
      <div class="field"><label for="coPhone">${esc(L('شماره موبایل', 'Phone', 'Telefon'))}</label>
        <input id="coPhone" name="phone" inputmode="tel" autocomplete="tel" dir="ltr"
               placeholder="${L('۰۹۱۲ ۰۰۰ ۰۰۰۰', '0912 000 0000', '0912 000 0000')}" value="${esc(profile.phone)}" required></div>

      <p class="eyebrow" style="margin:20px 0 10px">${esc(L('کجا بفرستیم', 'Where it goes', 'Nereye gönderelim'))}</p>
      <div class="field"><label for="coLine">${esc(L('آدرس', 'Address', 'Adres'))}</label>
        <textarea id="coLine" name="line" autocomplete="street-address"
                  placeholder="${esc(L('خیابون، پلاک، واحد', 'Street, building, unit', 'Sokak, bina, daire'))}" required>${esc(address.line)}</textarea></div>
      <div class="field-row">
        <div class="field"><label for="coCity">${esc(L('شهر', 'City', 'Şehir'))}</label>
          <input id="coCity" name="city" autocomplete="address-level2"
                 value="${esc(address.city)}" required></div>
        <div class="field"><label for="coPostal">${esc(L('کد پستی', 'Post code', 'Posta kodu'))}</label>
          <input id="coPostal" name="postal" inputmode="numeric" dir="ltr"
                 autocomplete="postal-code" value="${esc(address.postal)}"></div>
      </div>

      <p class="eyebrow" style="margin:20px 0 10px">${esc(L('پرداخت', 'Payment', 'Ödeme yöntemi'))}</p>
      <div class="sizes">
        <button class="chip on" data-pay="card" type="button">${icon('card', 15)}${esc(L('کارت، موقع تحویل', 'Card, on delivery', 'Kapıda kart'))}</button>
        <button class="chip" data-pay="online" type="button">${icon('lock', 15)}${esc(L('پرداخت آنلاین', 'Pay online', 'Online öde'))}</button>
      </div>

      ${totals(sub, ship)}

      <button class="btn btn-ink btn-block" type="submit">${esc(L('ثبت سفارش', 'Place order', 'Siparişi ver'))}</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="sheet-close" type="button">${esc(L('فعلاً نه', 'Not yet', 'Şimdi değil'))}</button>
    </form>`,
  {
    label: L('تکمیل خرید', 'Checkout', 'Ödeme'),
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
          toast(L('اسم، شماره، آدرس و شهر رو پر کن', 'Fill in name, phone, address and city',
            'Ad, telefon, adres ve şehri doldur'), 'info');
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
        setTimeout(() => toast(L(`سفارش \u2066${code}\u2069 ثبت شد`, `Order ${code} placed`,
          `${code} numaralı sipariş alındı`), 'check', 3200), 260);
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
    const count = state.bag.reduce((n, l) => n + l.qty, 0);

    return `
    <div class="wrap">
      <div class="topgap"></div>
      ${h1}
      <p class="lede" style="margin-bottom:6px">${L(
        `${num(count)} قطعه، ۶۰ دقیقه برات نگهش می‌داریم.`,
        `${num(count)} item${count === 1 ? '' : 's'} held for 60 minutes.`,
        `${num(count)} parça, 60 dakika senin için ayrıldı.`)}</p>

      <p class="shipnote">${icon('truck', 17)}<span>${esc(L(
        'ارسال رایگانه و نهایتاً ۳ روز کاری طول می‌کشه.',
        `Free delivery, ${BRAND.deliveryDays} working days at most.`,
        `Ücretsiz teslimat, en geç ${BRAND.deliveryDays} iş günü.`))}</span></p>

      <div style="height:8px"></div>
      ${state.bag.map(lineHTML).join('')}

      ${totals(sub, ship)}

      <div style="height:14px"></div>
      <button class="btn btn-ink btn-block" data-act="checkout" type="button">
        ${esc(L('تکمیل خرید', 'Checkout', 'Ödemeye geç'))} — ${toman(sub + ship)}</button>
      <div style="height:9px"></div>
      <button class="btn btn-quiet btn-block" data-act="nav" data-to="/shop" type="button">
        ${esc(L('ادامه‌ی خرید', 'Keep looking', 'Alışverişe devam et'))}</button>
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
