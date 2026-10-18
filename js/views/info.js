/* The three pages a shop owes its customers — and that eNamad reads before
   it issues a trust seal: who we are, where to find us, and the terms.

   Everything here is the studio's own, as sent on 2026-10-07: the About text
   (word for word, the brand name spelled one way throughout), the four
   shops, their hours and postal codes, the email, free delivery and the
   three-working-day promise. The terms add the 7-day exchange the product
   pages already promised. Persian first; English and Turkish follow it. */
import { BRAND, STORES } from '../config.js';
import { icon } from '../icons.js';
import { esc, num, ltr } from '../util.js';
import { shot } from '../ui.js';
import { L, isFa } from '../i18n.js';

const DAYS = BRAND.deliveryDays;
const DAYS_FA = '۳';

/* ------------------------------------------------------------ the bits */
const head = (eyebrow, title) => `
  <div class="topgap"></div>
  <header class="info-head">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="serif">${esc(title)}</h1>
  </header>`;

const linkRow = (to, ico, label) => `
  <a class="row" href="#${to}">${icon(ico, 19)}<span class="row-label">${esc(label)}</span>
    ${icon('chevL', 16, 'chev')}</a>`;

const igRow = () => `
  <a class="row" href="${BRAND.instagramUrl}" target="_blank" rel="noopener">
    ${icon('instagram', 19)}<span class="row-label" dir="ltr">@${BRAND.instagram}</span>
    ${icon('chevL', 16, 'chev')}</a>`;

const mailRow = () => `
  <a class="row" href="mailto:${BRAND.email}">
    ${icon('mail', 19)}<span class="row-label" dir="ltr">${esc(BRAND.email)}</span>
    ${icon('chevL', 16, 'chev')}</a>`;

const hoursText = (h) => (isFa
  ? `${ltr(h[0])} تا ${ltr(h[1])}`
  : `${esc(h[0])}–${esc(h[1])}`);

const branch = (s) => `
  <section class="branch" id="store-${s.id}">
    <p class="eyebrow">${esc(s.city)}</p>
    <h3>${esc(s.name)}</h3>
    <p class="bline">${icon('pin', 17)}<span>${esc(s.address)}</span></p>
    ${s.phone ? `<a class="bline" href="tel:${s.tel}">${icon('phone', 17)}${ltr(s.phone)}</a>` : ''}
    ${s.hours ? `<p class="bline">${icon('clock', 17)}<span>${esc(L('ساعت کاری:', 'Open', 'Açık:'))}
      ${hoursText(s.hours)}</span></p>` : ''}
    ${s.postal ? `<p class="bline">${icon('mail', 17)}<span>${esc(L('کد پستی:', 'Postcode', 'Posta kodu:'))}
      ${ltr(s.postal)}</span></p>` : ''}
  </section>`;

/* ---------------------------------------------------------------- about */
const ABOUT = {
  lead: L(
    'تیفانی یک برند پوشاک زنانه با تمرکز بر استایل مدرن، جوان و شهری است؛ برندی برای دخترانی که دوست دارند متفاوت باشند، اما بدون اینکه برای دیده‌شدن تلاش کنند.',
    'TIFFANY is a womenswear brand built around modern, young, city style — a brand for girls who like to be different, without trying to be seen.',
    'TIFFANY; modern, genç ve şehirli stile odaklanan bir kadın giyim markası. Farklı olmayı seven ama görünmek için çaba harcamayan kızlar için bir marka.'),
  body: L(
    'ما در تیفانی، انتخاب لباس را بخشی از سبک زندگی می‌دانیم؛ ترکیبی از ترندهای روز، کیفیت، جسارت و سلیقه شخصی.',
    'At TIFFANY we see choosing clothes as part of a way of life: a mix of current trends, quality, nerve and personal taste.',
    'TIFFANY’de kıyafet seçmeyi yaşam tarzının bir parçası olarak görüyoruz: güncel trendler, kalite, cesaret ve kişisel zevkin bir karışımı.'),
  aim: L(
    'هدف تیفانی ساختن استایلی است که خودت باشی، اما نسخه‌ی بهتر و جسورترِ خودت.',
    'Our aim is a style that is still you — just a better, bolder version of you.',
    'Amacımız, hâlâ sen olduğun ama daha iyi ve daha cesur bir versiyonun olduğun bir stil yaratmak.'),
};

const cities = () => [...new Set(STORES.map((s) => s.city))];

export const about = {
  tab: '',
  back: true,
  topbarAt: 40,
  title: L('درباره‌ی ما', 'About us', 'Hakkımızda'),

  render() {
    return `
    ${head(L('از ۱۳۹۹', 'Since 2020', '2020’den beri'), L('درباره‌ی ما', 'About us', 'Hakkımızda'))}
    <article class="info">
      <span class="shot full-colour info-photo">
        <img ${shot('aw27-ed', '(max-width:520px) 92vw, 470px')}
             alt="${esc(L('کمپین تیفانی', 'TIFFANY campaign', 'TIFFANY kampanyası'))}"
             decoding="async" width="480" height="300">
      </span>
      <p class="info-lead">${esc(ABOUT.lead)}</p>
      <p class="lede">${esc(ABOUT.body)}</p>
      <blockquote class="info-quote">${esc(ABOUT.aim)}</blockquote>

      <div class="facts">
        <div class="fact"><b>${L('۱۳۹۹', '2020', '2020')}</b><span>${esc(L('شروع کار', 'Founded', 'Kuruluş'))}</span></div>
        <div class="fact"><b>${num(STORES.length)}</b><span>${esc(L('شعبه', 'Stores', 'Mağaza'))}</span></div>
        <div class="fact"><b>${esc(L('رایگان', 'Free', 'Ücretsiz'))}</b><span>${esc(L('ارسال', 'Delivery', 'Teslimat'))}</span></div>
      </div>
    </article>

    <div class="rows">
      ${linkRow('/contact', 'store', L(`شعبه‌ها در ${cities().join(' و ')}`,
        `Stores in ${cities().join(' and ')}`, `${cities().join(' ve ')} mağazaları`))}
      ${linkRow('/terms', 'doc', L('قوانین و شرایط', 'Terms & policies', 'Koşullar ve politikalar'))}
      ${igRow()}
    </div>
    <div style="height:34px"></div>`;
  },
};

/* --------------------------------------------------------------- stores */
export const contact = {
  tab: '',
  back: true,
  topbarAt: 40,
  title: L('شعبه‌ها و تماس', 'Stores & contact', 'Mağazalar ve iletişim'),

  render() {
    const n = num(STORES.length);
    const where = cities();
    return `
    ${head(L(`${n} شعبه در ${where.join(' و ')}`, `${n} stores in ${where.join(' and ')}`,
      `${where.join(' ve ')}’de ${n} mağaza`), L('شعبه‌ها و تماس', 'Stores & contact', 'Mağazalar ve iletişim'))}
    <div class="info">
      <div class="branches">${STORES.map(branch).join('')}</div>
    </div>

    <div class="info"><p class="eyebrow" style="margin:30px 0 0">${esc(L('خرید آنلاین', 'Online orders', 'Online siparişler'))}</p></div>
    <div class="rows" style="margin-top:12px">
      ${mailRow()}
      ${igRow()}
      ${linkRow('/terms', 'doc', L('قوانین و شرایط', 'Terms & policies', 'Koşullar ve politikalar'))}
    </div>
    <div style="height:34px"></div>`;
  },
};

/* ---------------------------------------------------------------- terms */
const SECTIONS = () => [
  {
    h: L('ارسال', 'Delivery', 'Teslimat'),
    p: [
      L('ارسال همه‌ی سفارش‌ها رایگانه.', 'Delivery is free on every order.', 'Tüm siparişlerde teslimat ücretsiz.'),
      L(`سفارشت نهایتاً ظرف ${DAYS_FA} روز کاری به دستت می‌رسه. جمعه‌ها و تعطیلی‌های رسمی جزو روز کاری حساب نمی‌شن.`,
        `Your order reaches you within ${DAYS} working days at most. Fridays and public holidays are not working days.`,
        `Siparişin en geç ${DAYS} iş günü içinde sana ulaşır. Cuma ve resmî tatiller iş gününden sayılmaz.`),
    ],
  },
  {
    h: L('تعویض و مرجوعی', 'Exchanges and returns', 'Değişim ve iade'),
    p: [
      L('تا ۷ روز بعد از تحویل می‌تونی لباس رو عوض یا مرجوع کنی، به شرطی که پوشیده نشده باشه و برچسبش سالم باشه.',
        'You can exchange or return a piece within 7 days of delivery, as long as it is unworn with its tags intact.',
        'Teslimattan sonraki 7 gün içinde, giyilmemiş ve etiketi sağlam olmak şartıyla ürünü değiştirebilir ya da iade edebilirsin.'),
      L('اگه چیزی ایراد داشت یا اشتباهی برات فرستاده شد، هزینه‌ی برگشتش با ماست.',
        'If a piece is faulty or we sent the wrong one, we pay to bring it back.',
        'Ürün kusurluysa ya da sana yanlış ürün gönderildiyse, geri dönüş masrafı bize ait.'),
      L('برای تعویض یا مرجوعی کافیه به یکی از شعبه‌ها زنگ بزنی یا ایمیل بدی.',
        'To exchange or return, call any of our stores or send us an email.',
        'Değişim ya da iade için mağazalarımızdan birini araman ya da e-posta göndermen yeterli.'),
    ],
  },
  {
    h: L('پرداخت و قیمت', 'Payment and prices', 'Ödeme ve fiyatlar'),
    p: [
      L('همه‌ی قیمت‌ها به تومانه.', 'All prices are in Toman.', 'Tüm fiyatlar Toman cinsindendir.'),
      L('پرداخت آنلاین از طریق درگاه امن بانکی انجام می‌شه و اطلاعات کارتت فقط توی صفحه‌ی بانک وارد می‌شه، نه توی سایت ما.',
        'Online payment goes through a secure bank gateway; your card details are entered on the bank’s page only, never on our site.',
        'Online ödeme güvenli bir banka ödeme sayfası üzerinden yapılır; kart bilgilerin yalnızca bankanın sayfasına girilir, asla bizim sitemize değil.'),
    ],
  },
  {
    h: L('حریم خصوصی', 'Privacy', 'Gizlilik'),
    p: [
      L('اسم، شماره و آدرسی که موقع خرید وارد می‌کنی فقط برای رسوندن سفارشت استفاده می‌شه و به هیچ‌کس دیگه داده نمی‌شه.',
        'The name, number and address you give at checkout are used only to deliver your order and are never shared with anyone else.',
        'Ödeme sırasında verdiğin ad, telefon ve adres yalnızca siparişini teslim etmek için kullanılır ve başka hiç kimseyle paylaşılmaz.'),
      L('سبد، ذخیره‌شده‌ها و اندازه‌هات فقط روی گوشی خودت می‌مونه.',
        'Your bag, saved pieces and measurements stay on your own phone.',
        'Sepetin, kaydettiklerin ve ölçülerin yalnızca kendi telefonunda kalır.'),
      L('اگه حساب بسازی، اسم و شماره‌ت (که با کد پیامکی تأیید می‌شه) و نسخه‌ی رمزنگاری‌شده‌ی رمزت پیش ما می‌مونه. تیکت‌ها و فایل‌هایی که می‌فرستی رو فقط خودت و تیم تیفانی می‌بینین، و اطلاعات مکانی عکس‌ها قبل از ذخیره پاک می‌شه. برای اینکه وارد بمونی، یه کوکی ضروری به اسم tf_shop روی گوشیت ذخیره می‌شه.',
        'If you make an account, we keep your name, your number (confirmed by an SMS code) and an encrypted form of your password. Only you and the TIFFANY team see your tickets and the files you send, and location data is removed from photos before they are kept. To keep you signed in, one essential cookie, tf_shop, is stored on your phone.',
        'Hesap açarsan adını, numaranı (SMS koduyla doğrulanır) ve şifrenin şifrelenmiş halini saklarız. Taleplerini ve gönderdiğin dosyaları yalnızca sen ve TIFFANY ekibi görür; fotoğraflardaki konum bilgisi saklanmadan önce silinir. Girişte kalman için telefonunda tf_shop adlı tek bir zorunlu çerez saklanır.'),
      L('تعداد بازدیدها بدون کوکی و بدون ذخیره‌ی آی‌پی شمرده می‌شه.',
        'Visits are counted without cookies and without storing IP addresses.',
        'Ziyaretler çerez kullanılmadan ve IP adresi saklanmadan sayılır.'),
      L('اگه توی پیغام کوکی‌ها «قبول دارم» رو بزنی، نوع دستگاه، برند گوشی، سیستم‌عامل، مرورگر، نصب بودن اپ و زبان سایت به‌صورت ناشناس و فقط در قالب آمار روزانه ثبت می‌شه. اسم، شماره، آدرس و موقعیت مکانیت هیچ‌وقت ثبت نمی‌شه.',
        'If you tap Accept on the cookie note, your device type, phone brand, system, browser, whether the app is installed and the site language are recorded anonymously, as daily totals only. Your name, number, address and location are never recorded.',
        'Çerez notunda Kabul et’e dokunursan cihaz türün, telefon markan, işletim sistemin, tarayıcın, uygulamanın yüklü olup olmadığı ve site dili anonim olarak, yalnızca günlük toplamlar halinde kaydedilir. Adın, numaran, adresin ve konumun asla kaydedilmez.'),
      L('جوابت توی یه کوکی کوچیک به اسم tf_c روی گوشیت می‌مونه و هر وقت خواستی از «پروفایل ← کوکی‌ها و حریم خصوصی» عوضش کن.',
        'Your answer is kept in one small cookie, tf_c, on your phone; change it any time from Profile → Cookies and privacy.',
        'Cevabın telefonunda tf_c adlı küçük bir çerezde saklanır; istediğin zaman Profil → Çerezler ve gizlilik bölümünden değiştirebilirsin.'),
    ],
  },
];

export const terms = {
  tab: '',
  back: true,
  topbarAt: 40,
  title: L('قوانین و شرایط', 'Terms & policies', 'Koşullar ve politikalar'),

  render() {
    return `
    ${head(BRAND.full, L('قوانین و شرایط', 'Terms & policies', 'Koşullar ve politikalar'))}
    <article class="info terms">
      ${SECTIONS().map((s) => `
        <section>
          <h2>${esc(s.h)}</h2>
          <ul>${s.p.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </section>`).join('')}
      <h2>${esc(L('سؤالی داری؟', 'Questions?', 'Merak ettiğin bir şey mi var?'))}</h2>
    </article>
    <div class="rows" style="margin-top:12px">
      ${linkRow('/contact', 'store', L('شعبه‌ها و تماس', 'Stores & contact', 'Mağazalar ve iletişim'))}
      ${mailRow()}
    </div>
    <div style="height:34px"></div>`;
  },
};
