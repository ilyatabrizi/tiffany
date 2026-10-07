/* Saved pieces — the wishlist, reachable from the profile and the heart. */
import { getProduct } from '../data.js';
import { state } from '../store.js';
import { productCard, empty } from '../ui.js';
import { esc, num } from '../util.js';
import { L } from '../i18n.js';

export default {
  tab: 'profile',
  back: true,
  title: L('ذخیره‌شده‌ها', 'Saved', 'Kaydedilenler'),
  topbarAt: 20,

  render() {
    const items = state.wish.map(getProduct).filter(Boolean);
    const h1 = `<h1 class="serif" style="font-size:30px">${esc(L('ذخیره‌شده‌ها', 'Saved', 'Kaydedilenler'))}</h1>`;
    if (!items.length) {
      return `<div class="wrap"><div class="topgap"></div>${h1}</div>
        ${empty('heart', L('هنوز چیزی ذخیره نکردی', 'Nothing saved yet', 'Henüz bir şey kaydetmedin'),
          L('قلب هر قطعه رو که بزنی، همین‌جا منتظرت می‌مونه.',
            'Tap the heart on any piece and it waits for you here.',
            'Bir parçanın kalbine dokun, seni burada beklesin.'),
          `<button class="btn btn-ink btn-s" data-act="nav" data-to="/shop" type="button">${esc(L('یه سر به فروشگاه بزن', 'Have a look around', 'Mağazaya bir göz at'))}</button>`)}`;
    }
    return `
    <div class="wrap"><div class="topgap"></div>
      ${h1}
      <p class="lede" style="margin-bottom:18px">${esc(L(
        `${num(items.length)} تا قطعه منتظرته.`,
        `${num(items.length)} piece${items.length === 1 ? '' : 's'} waiting for you.`,
        `${num(items.length)} parça seni bekliyor.`))}</p>
    </div>
    <div class="grid-p">${items.map((p) => productCard(p)).join('')}</div>
    <div style="height:30px"></div>`;
  },
};
