/* Delivery by Iran Post: free, anywhere in Iran.

   What the post office needs on a parcel, and what checkout asks for: the
   full name (first and last), a mobile number, the province and city, the
   full address, and the ten-digit postal code. The server checks the same
   things (api/order.php); here they are caught before anything is sent. */
import { esc, typed, num } from './util.js';
import { L } from './i18n.js';
import { live } from './live.js';

/* The 31 provinces: the Persian name is what is sent and kept (as the post
   office writes it); the other two are how the page shows it. */
export const PROVINCES = [
  ['آذربایجان شرقی', 'East Azerbaijan', 'Doğu Azerbaycan'],
  ['آذربایجان غربی', 'West Azerbaijan', 'Batı Azerbaycan'],
  ['اردبیل', 'Ardabil', 'Erdebil'],
  ['اصفهان', 'Isfahan', 'İsfahan'],
  ['البرز', 'Alborz', 'Elburz'],
  ['ایلام', 'Ilam', 'İlam'],
  ['بوشهر', 'Bushehr', 'Buşehr'],
  ['تهران', 'Tehran', 'Tahran'],
  ['چهارمحال و بختیاری', 'Chaharmahal and Bakhtiari', 'Çaharmahal ve Bahtiyari'],
  ['خراسان جنوبی', 'South Khorasan', 'Güney Horasan'],
  ['خراسان رضوی', 'Razavi Khorasan', 'Razavi Horasan'],
  ['خراسان شمالی', 'North Khorasan', 'Kuzey Horasan'],
  ['خوزستان', 'Khuzestan', 'Huzistan'],
  ['زنجان', 'Zanjan', 'Zencan'],
  ['سمنان', 'Semnan', 'Semnan'],
  ['سیستان و بلوچستان', 'Sistan and Baluchestan', 'Sistan ve Belucistan'],
  ['فارس', 'Fars', 'Fars'],
  ['قزوین', 'Qazvin', 'Kazvin'],
  ['قم', 'Qom', 'Kum'],
  ['کردستان', 'Kurdistan', 'Kürdistan'],
  ['کرمان', 'Kerman', 'Kirman'],
  ['کرمانشاه', 'Kermanshah', 'Kirmanşah'],
  ['کهگیلویه و بویراحمد', 'Kohgiluyeh and Boyer-Ahmad', 'Kohgiluye ve Boyer Ahmed'],
  ['گلستان', 'Golestan', 'Gülistan'],
  ['گیلان', 'Gilan', 'Gilan'],
  ['لرستان', 'Lorestan', 'Lorestan'],
  ['مازندران', 'Mazandaran', 'Mazenderan'],
  ['مرکزی', 'Markazi', 'Merkezi'],
  ['هرمزگان', 'Hormozgan', 'Hürmüzgan'],
  ['همدان', 'Hamadan', 'Hemedan'],
  ['یزد', 'Yazd', 'Yezd'],
];

/** A province in this page's language ('' stays ''). */
export const provinceName = (fa) => {
  const p = PROVINCES.find((x) => x[0] === fa);
  return p ? L(...p) : String(fa || '');
};

/** The province picker; `value` is the Persian name kept for this phone. */
export const provinceSelect = (id, value = '') => `<select id="${id}" name="province" required>
    <option value="" ${value ? '' : 'selected'} disabled>${esc(L('انتخاب کن', 'Choose', 'Seç'))}</option>
    ${PROVINCES.map((p) => `<option value="${esc(p[0])}" ${p[0] === value ? 'selected' : ''}>${esc(L(...p))}</option>`).join('')}
  </select>`;

/** The postal code as ten Latin digits, from whatever was typed (Persian digits, spaces, dashes). */
export const postalDigits = (s) => typed(s).replace(/\D/g, '');
export const postalOk = (s) => { const d = postalDigits(s); return d.length === 10 && !/^(\d)\1{9}$/.test(d); };
/** An Iranian mobile as 09xxxxxxxxx, or '' — the same rule as tf_phone() on the server. */
export const mobileOk = (s) => {
  let d = postalDigits(s);
  if (d.startsWith('0098')) d = `0${d.slice(4)}`;
  else if (d.startsWith('98') && d.length === 12) d = `0${d.slice(2)}`;
  else if (d.length === 10 && d[0] === '9') d = `0${d}`;
  return /^09\d{9}$/.test(d);
};
/** First and last name: two words at least. */
export const fullNameOk = (s) => {
  const n = String(s || '').trim().replace(/\s+/g, ' ');     // as the server counts it (tf_line)
  return n.length >= 4 && n.split(' ').length >= 2;
};

/** The one line every page says about delivery (the days are the back office's setting). */
export const postLine = () => L(
  `ارسال با پست، رایگان به سراسر ایران؛ نهایتاً ${num(live.deliveryDays)} روز کاری.`,
  `Free delivery by Iran Post anywhere in Iran, ${live.deliveryDays} working days at most.`,
  `İran Postası ile İran'ın her yerine ücretsiz teslimat, en geç ${live.deliveryDays} iş günü.`);

/** Where a parcel is followed once the team gives its tracking code. */
export const POST_TRACKING = 'https://tracking.post.ir/';
