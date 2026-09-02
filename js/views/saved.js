/* Saved pieces — the wishlist, reachable from the profile and the heart. */
import { getProduct } from '../data.js';
import { state } from '../store.js';
import { productCard, empty } from '../ui.js';
import { num } from '../util.js';

export default {
  tab: 'profile',
  back: true,
  title: 'Saved',
  topbarAt: 20,

  render() {
    const items = state.wish.map(getProduct).filter(Boolean);
    if (!items.length) {
      return `<div class="wrap"><div class="topgap"></div>
        <h1 class="serif" style="font-size:30px">Saved</h1></div>
        ${empty('heart', 'Nothing saved yet',
          'Tap the heart on a piece and it waits for you here.',
          '<button class="btn btn-ink btn-s" data-act="nav" data-to="/shop" type="button">Browse the shop</button>')}`;
    }
    return `
    <div class="wrap"><div class="topgap"></div>
      <h1 class="serif" style="font-size:30px">Saved</h1>
      <p class="lede" style="margin-bottom:18px">${num(items.length)}
        piece${items.length === 1 ? '' : 's'} waiting.</p>
    </div>
    <div class="grid-p">${items.map((p) => productCard(p)).join('')}</div>
    <div style="height:30px"></div>`;
  },
};
