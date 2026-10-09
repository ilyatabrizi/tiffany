/* What kind of phone this is — worked out here, in the browser, from what
   the browser already says about itself. Two uses:

   1. the install sheet picks the right steps (iPhone Safari, Android menu,
      the Instagram in-app browser that cannot install anything at all);
   2. with a yes on the cookie sheet, a short line of plain words — type,
      system, brand, browser, installed or not, language — goes with each
      page view so the back office can count devices. The server keeps only
      words from its own list (api/lib/boot.php, TF_DEV), as daily tallies.

   Nothing here identifies a person: no model number, no screen size, no
   fingerprint, no location. */
import { lang } from './i18n.js';

const ua = navigator.userAgent || '';

/* iPadOS asks for desktop sites and says "Macintosh"; touch gives it away. */
const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;

export const standalone = () =>
  matchMedia('(display-mode: standalone)').matches
  || matchMedia('(display-mode: fullscreen)').matches
  || navigator.standalone === true;

function osOf() {
  if (/iPhone|iPod|iPad/.test(ua) || touchMac) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macos';
  if (/Linux/.test(ua)) return 'linux';
  return 'other';
}

function typeOf(os) {
  if (/iPad/.test(ua) || touchMac) return 'tablet';
  if (os === 'android') return /Mobile/.test(ua) ? 'mobile' : 'tablet';
  if (/iPhone|iPod|Mobi/.test(ua)) return 'mobile';
  return 'desktop';
}

/* In-app browsers first: they all also say Safari or Chrome. */
function browserOf() {
  if (/Instagram/.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return 'facebook';
  if (/Telegram/.test(ua)) return 'telegram';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/EdgA|EdgiOS|Edg\//.test(ua)) return 'edge';
  if (/OPR\/|OPiOS|Opera/.test(ua)) return 'opera';
  if (/YaBrowser/.test(ua)) return 'yandex';
  if (/Firefox|FxiOS/.test(ua)) return 'firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

/* Android hides the model in its user agent now ("Android 10; K"); Chrome
   still hands it over through client hints, and Samsung Internet keeps it
   in the agent string. Only the maker is kept — never the model itself. */
const BRANDS = [
  ['samsung', /^SM-|SAMSUNG|Galaxy/i],
  ['honor', /HONOR/i],
  ['huawei', /HUAWEI|^[A-Z]{3}-[A-Z]{1,3}\d/],
  ['xiaomi', /Xiaomi|Redmi|POCO|^Mi |^MI |^M\d{4}[A-Z]|^\d{5,}[A-Z0-9]*$|^2\d{3}[0-9A-Z]{4,}/i],
  ['google', /Pixel/i],
  ['oneplus', /OnePlus|^(LE|IN|KB|NE|BE|HD|GM|AC|DN|EB)\d{4}$/],
  ['realme', /^RMX\d|realme/i],
  ['oppo', /^CPH\d|OPPO/i],
  ['vivo', /^V\d{4}|vivo/i],
  ['nokia', /Nokia|^TA-\d/i],
  ['motorola', /moto|^XT\d{4}/i],
  ['lg', /^LM-|^LG-/],
  ['tecno', /TECNO|Infinix|itel/i],
];

export function brandFromModel(model) {
  const m = String(model || '').trim();
  if (!m || m === 'K') return 'other';
  return (BRANDS.find(([, re]) => re.test(m)) || ['other'])[0];
}

function modelFromUa() {
  const m = ua.match(/Android [\d.]+;\s*(?:[a-z]{2}[-_][a-z]{2};\s*)?(?:SAMSUNG\s+)?([^;)]+?)(?:\s+Build\/|\)|;)/i);
  return m ? m[1] : '';
}

const os = osOf();
const type = typeOf(os);
const browser = browserOf();

/** The platform, for the install sheet. */
export const device = {
  os,
  type,
  browser,
  phone: type !== 'desktop',
  ios: os === 'ios',
  android: os === 'android',
  inApp: ['instagram', 'facebook', 'telegram'].includes(browser),
  iosSafari: os === 'ios' && browser === 'safari',
};

let brand = os === 'ios' || os === 'macos' ? 'apple' : os === 'android' ? brandFromModel(modelFromUa()) : '';

/** Ask Chrome for the maker once; everything else keeps what the agent said. */
export async function sharpenBrand() {
  if (os !== 'android' || brand !== 'other') return;
  try {
    const hints = await navigator.userAgentData?.getHighEntropyValues?.(['model']);
    if (hints?.model) brand = brandFromModel(hints.model);
  } catch { /* hints refused — "other" stands */ }
}

/** The line that goes with a page view when the visitor said yes. */
export function deviceLine() {
  const d = { type, os, browser, app: standalone() ? 'app' : 'web', lang };
  if (brand) d.brand = brand;
  return d;
}
