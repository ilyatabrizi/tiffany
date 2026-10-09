/* The live shop: the catalogue and the store's switches, from the server.

   /api/catalog.php is asked once per page load (it answers 304 when nothing
   changed). The last good answer is kept on the phone, so a shaky
   connection still opens the shop with yesterday's catalogue rather than an
   empty one. Nothing here is cached by the service worker — prices must
   never be stale. */
import { setCatalogue } from './data.js';

export const live = {
  loaded: false,       // a catalogue arrived (from the network or the last good copy)
  fresh: false,        // …and it came from the network just now
  storeOpen: false,    // the CEO has switched online ordering on
  deliveryDays: 3,
};

const KEEP = 'tiffany.catalog';

export async function loadCatalogue() {
  let data = null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch('api/catalog.php', { cache: 'no-cache', signal: ctl.signal });
    clearTimeout(t);
    if (r.ok) {
      data = await r.json();
      live.fresh = true;
      try { localStorage.setItem(KEEP, JSON.stringify(data)); } catch { /* full or private */ }
    }
  } catch { /* offline, or the host is down */ }
  if (!data) {
    try { data = JSON.parse(localStorage.getItem(KEEP) || 'null'); } catch { data = null; }
  }
  if (!data || !Array.isArray(data.products)) return live;
  setCatalogue(data.products);
  live.loaded = true;
  live.storeOpen = Boolean(data.settings?.store_open) && live.fresh;
  live.deliveryDays = Number(data.settings?.delivery_days) || 3;
  return live;
}

/** One page view for the back office's «بازدید سایت». No cookies, no IDs. */
export function beacon(route) {
  const [a, b] = route.parts;
  const k = !a ? 'home' : (a === 'p' || a === 'c') && b ? `${a}:${b}` : a;
  if (!/^[a-z]{1,12}(:[a-z0-9-]{1,60})?$/.test(k)) return;
  try {
    const body = new Blob([JSON.stringify({ k })], { type: 'text/plain' });
    if (!navigator.sendBeacon?.('api/hit.php', body)) {
      fetch('api/hit.php', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch { /* never let counting break the shop */ }
}
