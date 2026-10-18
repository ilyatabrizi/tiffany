/* Tickets — پشتیبانی. A customer writes to the team: words, photos, files, a
   voice note, and a piece from the shop beside the message. Only the team
   answers, from the panel; the answer shows up here (and as an SMS once the
   studio's template is approved).

     #/tickets            my tickets (or, signed out, how to start)
     #/tickets/new        a new one
     #/tickets/T-12345    one thread, with the reply box fixed at the bottom

   Files go to api/tickets.php and come back as signed links that work for a
   few hours (api/file.php). Photos are shrunk on the phone first when they
   are big, so a 12-megapixel shot does not hit the host's upload limit. */
import { BRAND } from '../config.js';
import { PRODUCTS, getProduct } from '../data.js';
import { icon } from '../icons.js';
import { esc, num, toman, relDay, timeOf } from '../util.js';
import { imgSrc, openSheet, closeSheet, toast, empty } from '../ui.js';
import {
  account, call, send, sayError, signInSheet, signUpSheet, refreshUnread,
} from '../account.js';
import { canRecord, record, clock } from '../recorder.js';
import { go } from '../router.js';
import { L, lang } from '../i18n.js';

const STATUS = {
  open: () => L('در انتظار پاسخ', 'Waiting for the team', 'Ekip yanıtı bekleniyor'),
  answered: () => L('پاسخ داده شد', 'Answered', 'Yanıtlandı'),
  closed: () => L('بسته شد', 'Closed', 'Kapatıldı'),
};
const TEAM = () => L('تیم تیفانی', 'TIFFANY team', 'TIFFANY ekibi');
const when = (ts) => { const d = new Date(ts * 1000); return `${relDay(d)} ${timeOf(d)}`; };
const kb = (n) => (n >= 1048576 ? `${num(Math.round(n / 104857.6) / 10)} MB` : `${num(Math.max(1, Math.round(n / 1024)))} KB`);
const pname = (p) => (p ? (typeof p.name === 'string' ? p.name : (p.name?.[lang] || p.name?.fa || '')) : '');
const spinner = () => '<div class="tk-wait"><span class="spin"></span></div>';
const waLink = (text) => `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(text)}`;

/* ---------------------------------------------------------------- signed out */
function signedOut() {
  return `${empty('chat', L('پشتیبانی تیفانی', 'TIFFANY support', 'TIFFANY destek'),
    L('سؤال، مشکل سفارش یا درخواستی داری؟ یه تیکت بفرست؛ می‌تونی عکس، فایل، پیام صوتی و محصول هم کنارش بذاری. برای این کار اول وارد حسابت شو.',
      'A question, an order problem or a request? Send a ticket — with photos, files, a voice note or a piece from the shop. Sign in first.',
      'Bir sorun, sipariş sorunu veya talebin mi var? Fotoğraf, dosya, sesli mesaj veya ürünle birlikte talep gönder. Önce giriş yap.'),
    `<div class="tk-cta">
      <button class="btn btn-ink" type="button" data-tk="signin">${esc(L('ورود', 'Sign in', 'Giriş yap'))}</button>
      <button class="btn btn-line" type="button" data-tk="signup">${esc(L('ثبت‌نام', 'Sign up', 'Kaydol'))}</button>
    </div>
    <a class="wa-line" href="${waLink(L('سلام، یه سؤال داشتم.', 'Hello, I have a question.', 'Merhaba, bir sorum var.'))}" target="_blank" rel="noopener">
      ${icon('chat', 17)}<span>${esc(L('یا از واتساپ بپرس', 'Or ask on WhatsApp', 'Ya da WhatsApp’tan sor'))}</span></a>`)}`;
}

/* --------------------------------------------------------------------- list */
function listHtml(tickets) {
  return `
    <button class="btn btn-ink btn-block tk-new" type="button" data-act="nav" data-to="/tickets/new">
      ${icon('plus', 18)}${esc(L('تیکت جدید', 'New ticket', 'Yeni talep'))}</button>
    ${tickets.length ? `<div class="tk-list">${tickets.map((t) => `
      <button class="tk-item ${t.unread ? 'unread' : ''}" type="button" data-act="nav" data-to="/tickets/${esc(t.code)}">
        <span class="tk-row"><b class="tk-subj">${esc(t.subject)}</b>
          <span class="tk-pill ${t.status}">${esc(STATUS[t.status]())}</span></span>
        <span class="tk-row tk-meta"><span class="tk-last">${t.last_from === 's' ? `${esc(TEAM())}: ` : ''}${esc(t.last || lastKind(t.last_kind))}</span>
          <span class="tk-when">${esc(relDay(new Date(t.updated_at * 1000)))}</span></span>
        <span class="tk-code" dir="ltr">${esc(t.code)}</span>
        ${t.unread ? `<i class="tk-dot" aria-label="${esc(L(`${num(t.unread)} پیام تازه`, `${t.unread} new`, `${t.unread} yeni`))}"></i>` : ''}
      </button>`).join('')}</div>`
    : `<p class="tiny tk-none">${esc(L('هنوز تیکتی نفرستادی.', 'No tickets yet.', 'Henüz talep yok.'))}</p>`}`;
}

const lastKind = (k) => ({
  image: L('عکس', 'Photo', 'Fotoğraf'),
  voice: L('پیام صوتی', 'Voice note', 'Sesli mesaj'),
  audio: L('فایل صوتی', 'Audio', 'Ses'),
  video: L('ویدیو', 'Video', 'Video'),
  file: L('فایل', 'File', 'Dosya'),
})[k] || '';

/* ------------------------------------------------------------------- thread */
function productCard(p, id) {
  const local = getProduct(id);
  const name = local ? local.name : pname(p);
  const img = local ? local.img : p?.img;
  const price = local ? local.price : p?.price;
  if (!name) return '';
  return `<a class="msg-prod" href="#/p/${esc(id)}">
    ${img ? `<img src="${esc(imgSrc(img, 480))}" alt="" loading="lazy" width="40" height="50">` : ''}
    <span><b>${esc(name)}</b>${price ? `<span>${toman(price)}</span>` : ''}</span>${icon('chevL', 15, 'chev')}</a>`;
}

function fileHtml(f) {
  const url = esc(f.url);
  if (f.kind === 'image') {
    return `<a class="msg-img" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${esc(f.name)}" loading="lazy"
      ${f.w ? `width="${f.w}" height="${f.h}"` : ''}></a>`;
  }
  if (f.kind === 'audio') {
    return `<div class="msg-audio">${f.voice ? `<span class="tiny">${icon('mic', 14)}${esc(L('پیام صوتی', 'Voice note', 'Sesli mesaj'))}${f.secs ? ` · ${clock(f.secs, num)}` : ''}</span>` : ''}
      <audio controls preload="none" src="${url}"></audio>
      <a class="tiny msg-dl" href="${url}" download="${esc(f.name)}">${esc(L('اگه پخش نشد، دانلودش کن', 'Won’t play? Download it', 'Çalmıyorsa indir'))}</a></div>`;
  }
  if (f.kind === 'video') {
    return `<div class="msg-video"><video controls playsinline preload="metadata" src="${url}"></video>
      <a class="tiny msg-dl" href="${url}" download="${esc(f.name)}">${esc(L('دانلود ویدیو', 'Download video', 'Videoyu indir'))}</a></div>`;
  }
  return `<a class="msg-file" href="${url}" download="${esc(f.name)}">${icon('doc', 18)}
    <span><b>${esc(f.name)}</b><span class="tiny">${kb(f.size)}</span></span>${icon('download', 16)}</a>`;
}

function messagesHtml(d) {
  return d.messages.map((m) => `
    <div class="msg ${m.side === 'c' ? 'mine' : 'theirs'}">
      ${m.side === 's' ? `<span class="msg-who">${esc(TEAM())}</span>` : ''}
      ${m.product ? productCard(d.products?.[m.product], m.product) : ''}
      ${m.files.length ? `<div class="msg-files">${m.files.map(fileHtml).join('')}</div>` : ''}
      ${m.body ? `<p class="msg-body">${esc(m.body)}</p>` : ''}
      <span class="msg-time">${esc(when(m.at))}</span>
    </div>`).join('');
}

/* ----------------------------------------------------------------- composer */
const ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';

function composerHtml({ fixed }) {
  return `
  <div class="comp ${fixed ? 'comp-fixed' : ''}" id="comp">
    <div class="comp-chips" id="compChips" hidden></div>
    <div class="comp-rec" id="compRec" hidden>
      <i class="rec-dot" aria-hidden="true"></i><span class="rec-time" id="recTime">0:00</span>
      <span class="rec-label">${esc(L('در حال ضبط…', 'Recording…', 'Kaydediliyor…'))}</span>
      <button class="btn btn-quiet btn-s" type="button" data-c="rec-cancel">${esc(L('لغو', 'Cancel', 'İptal'))}</button>
      <button class="btn btn-ink btn-s" type="button" data-c="rec-stop">${esc(L('تمام', 'Done', 'Bitti'))}</button>
    </div>
    <div class="comp-row" id="compRow">
      <button class="comp-btn" type="button" data-c="file" aria-label="${esc(L('عکس یا فایل', 'Photo or file', 'Fotoğraf veya dosya'))}">${icon('clip', 21)}</button>
      <button class="comp-btn" type="button" data-c="product" aria-label="${esc(L('افزودن محصول', 'Add a piece', 'Ürün ekle'))}">${icon('hanger', 21)}</button>
      <textarea id="compText" rows="1" maxlength="3000" placeholder="${esc(L('پیامت رو بنویس…', 'Write your message…', 'Mesajını yaz…'))}"
        aria-label="${esc(L('متن پیام', 'Message', 'Mesaj'))}"></textarea>
      <button class="comp-btn comp-mic" type="button" data-c="mic" aria-label="${esc(L('پیام صوتی', 'Voice note', 'Sesli mesaj'))}" ${canRecord() ? '' : 'hidden'}>${icon('mic', 21)}</button>
      <button class="comp-send" type="button" data-c="send" aria-label="${esc(L('فرستادن', 'Send', 'Gönder'))}">${icon('send', 19)}${fixed ? ''
    : `<span>${esc(L('فرستادن تیکت', 'Send ticket', 'Talebi gönder'))}</span>`}</button>
    </div>
    <div class="comp-progress" id="compProg" hidden><i></i></div>
    <input type="file" id="compFile" multiple hidden accept="${ACCEPT}">
  </div>`;
}

/** Big phone photos are redrawn smaller before they go up (the browser
    applies the EXIF turn while decoding). Anything else goes as it is. */
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.6e6) return file;
  try {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.src = url;
    await im.decode();
    const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k);
    c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise((r) => { c.toBlob(r, 'image/jpeg', 0.86); });
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

function productPicker(onPick) {
  const list = PRODUCTS;
  const row = (p) => `<button class="pick-row" type="button" data-pick="${esc(p.id)}">
    <img src="${esc(imgSrc(p.img, 480))}" alt="" loading="lazy" width="40" height="50">
    <span><b>${esc(p.name)}</b><span class="tiny">${toman(p.price)}</span></span></button>`;
  openSheet(`
    <h2>${esc(L('کدوم محصول؟', 'Which piece?', 'Hangi ürün?'))}</h2>
    <p class="lede">${esc(L('محصولی که سؤالت درباره‌شه رو انتخاب کن تا کنار پیامت بیاد.', 'Pick the piece your message is about.', 'Mesajının ilgili olduğu ürünü seç.'))}</p>
    <div class="field"><input id="pickQ" type="search" placeholder="${esc(L('جستجوی اسم محصول', 'Search the shop', 'Ürün ara'))}"></div>
    <div class="pick-list" id="pickList">${list.map(row).join('')}</div>`,
  {
    label: L('انتخاب محصول', 'Choose a piece', 'Ürün seç'),
    onMount(sheet) {
      const box = sheet.querySelector('#pickList');
      sheet.querySelector('#pickQ').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        const hits = list.filter((p) => !q || `${p.name} ${p.id}`.toLowerCase().includes(q));
        box.innerHTML = hits.length ? hits.map(row).join('') : `<p class="tiny">${esc(L('چیزی پیدا نشد.', 'Nothing found.', 'Bulunamadı.'))}</p>`;
      });
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        closeSheet();
        onPick(b.dataset.pick);
      });
    },
  });
}

/** Wire one composer. `submit(form, onProgress)` sends; resolves to clear it. */
function wireComposer(root, { submit, signal, product = '' }) {
  const c = { files: [], voice: null, product, busy: false };
  const text = root.querySelector('#compText');
  const chips = root.querySelector('#compChips');
  const rowEl = root.querySelector('#compRow');
  const recEl = root.querySelector('#compRec');
  const prog = root.querySelector('#compProg');
  const input = root.querySelector('#compFile');
  const mic = root.querySelector('[data-c="mic"]');
  const sendBtn = root.querySelector('[data-c="send"]');
  let rec = null;
  const urls = new Set();

  const hasSomething = () => Boolean(text.value.trim() || c.files.length || c.voice || c.product);
  const paint = () => {
    const p = c.product ? getProduct(c.product) : null;
    const parts = [];
    if (p) {
      parts.push(`<span class="chip-c">${p.img ? `<img src="${esc(imgSrc(p.img, 480))}" alt="">` : ''}<span>${esc(p.name)}</span>
        <button type="button" data-rm="product" aria-label="${esc(L('برداشتن', 'Remove', 'Kaldır'))}">${icon('close', 14)}</button></span>`);
    }
    c.files.forEach((f, i) => {
      const thumb = f.preview ? `<img src="${esc(f.preview)}" alt="">` : icon(f.type.startsWith('video') ? 'play' : f.type.startsWith('audio') ? 'mic' : 'doc', 16);
      parts.push(`<span class="chip-c">${thumb}<span>${esc(f.name)} · ${kb(f.size)}</span>
        <button type="button" data-rm="${i}" aria-label="${esc(L('برداشتن', 'Remove', 'Kaldır'))}">${icon('close', 14)}</button></span>`);
    });
    if (c.voice) {
      parts.push(`<span class="chip-c chip-voice"><button type="button" data-c="play" aria-label="${esc(L('گوش دادن', 'Play', 'Dinle'))}">${icon('play', 15)}</button>
        <span>${esc(L('پیام صوتی', 'Voice note', 'Sesli mesaj'))} · ${clock(c.voice.secs, num)}</span>
        <button type="button" data-rm="voice" aria-label="${esc(L('پاک کردن', 'Delete', 'Sil'))}">${icon('close', 14)}</button></span>`);
    }
    chips.innerHTML = parts.join('');
    chips.hidden = !parts.length;
    /* In a thread the microphone and send share one place, like a chat app;
       on the new-ticket page both are always there. */
    const some = hasSomething();
    const swap = Boolean(root.querySelector('.comp-fixed'));
    if (mic) mic.hidden = !canRecord() || (swap && some);
    sendBtn.hidden = swap && canRecord() && !some;
    sendBtn.disabled = c.busy;
  };
  const grow = () => { text.style.height = 'auto'; text.style.height = `${Math.min(140, text.scrollHeight)}px`; };
  text.addEventListener('input', () => { grow(); paint(); });

  input.addEventListener('change', async () => {
    const picked = [...input.files];
    input.value = '';
    for (const f0 of picked) {
      if (c.files.length >= account.caps.files) {
        toast(L(`هر پیام حداکثر ${num(account.caps.files)} فایل.`, `Up to ${account.caps.files} files per message.`, `Mesaj başına en fazla ${account.caps.files} dosya.`), 'info', 3200);
        break;
      }
      const f = await shrink(f0);
      if (f.size > account.caps.file) {
        toast(L(`«${f.name}» بزرگ‌تر از ${num(Math.floor(account.caps.file / 1048576))} مگابایته.`,
          `“${f.name}” is over ${Math.floor(account.caps.file / 1048576)} MB.`,
          `“${f.name}” ${Math.floor(account.caps.file / 1048576)} MB'tan büyük.`), 'info', 3600);
        continue;
      }
      if (f.type.startsWith('image/')) { f.preview = URL.createObjectURL(f); urls.add(f.preview); }
      c.files.push(f);
    }
    paint();
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-c],[data-rm]');
    if (!b || c.busy) return;
    if (b.dataset.rm) {
      const k = b.dataset.rm;
      if (k === 'product') c.product = '';
      else if (k === 'voice') c.voice = null;
      else c.files.splice(Number(k), 1);
      paint();
      return;
    }
    const act = b.dataset.c;
    if (act === 'file') input.click();
    else if (act === 'product') productPicker((id) => { c.product = id; paint(); });
    else if (act === 'play' && c.voice) {
      const a = new Audio(c.voice.url);
      a.play().catch(() => {});
    } else if (act === 'mic') {
      try {
        rec = await record({
          max: 300,
          onTick: (s) => { root.querySelector('#recTime').textContent = clock(s, num); },
          onAutoStop: () => root.querySelector('[data-c="rec-stop"]')?.click(),
        });
        rowEl.hidden = true;
        recEl.hidden = false;
      } catch {
        toast(L('اجازه‌ی میکروفون داده نشد. از تنظیمات مرورگر اجازه بده.', 'No microphone permission — allow it in the browser settings.',
          'Mikrofon izni yok — tarayıcı ayarlarından izin ver.'), 'info', 4200);
      }
    } else if (act === 'rec-stop' && rec) {
      const v = await rec.stop();
      rec = null;
      recEl.hidden = true;
      rowEl.hidden = false;
      if (v.secs < 1 || !v.blob.size) { paint(); return; }
      if (v.blob.size > account.caps.file) {
        toast(L('پیام صوتی خیلی طولانیه.', 'That voice note is too long.', 'Sesli mesaj çok uzun.'), 'info');
        paint();
        return;
      }
      v.url = URL.createObjectURL(v.blob);
      urls.add(v.url);
      c.voice = v;
      paint();
    } else if (act === 'rec-cancel' && rec) {
      rec.cancel();
      rec = null;
      recEl.hidden = true;
      rowEl.hidden = false;
      paint();
    } else if (act === 'send') {
      if (!hasSomething()) {
        toast(L('یه چیزی بنویس، یا فایل یا پیام صوتی بفرست.', 'Write something, or add a file or a voice note.', 'Bir şey yaz ya da dosya veya sesli mesaj ekle.'), 'info');
        text.focus();
        return;
      }
      const fd = new FormData();
      fd.append('body', text.value.trim());
      fd.append('product', c.product);
      c.files.forEach((f) => fd.append('files[]', f, f.name));
      if (c.voice) {
        const ext = c.voice.mime.includes('mp4') ? 'm4a' : c.voice.mime.includes('ogg') ? 'ogg' : 'webm';
        fd.append('voice', c.voice.blob, `voice.${ext}`);
        fd.append('voice_secs', String(c.voice.secs));
      }
      c.busy = true;
      paint();
      prog.hidden = false;
      const bar = prog.querySelector('i');
      bar.style.width = '4%';
      try {
        await submit(fd, (x) => { bar.style.width = `${Math.max(4, Math.round(x * 100))}%`; });
        text.value = '';
        grow();
        c.files = [];
        c.voice = null;
        c.product = '';
      } catch (err) {
        toast(sayError(err), 'info', 4200);
      } finally {
        c.busy = false;
        prog.hidden = true;
        paint();
      }
    }
  });
  signal.addEventListener('abort', () => { rec?.cancel(); urls.forEach((u) => URL.revokeObjectURL(u)); });
  paint();
  return c;
}

/* --------------------------------------------------------------------- view */
const head = (title, sub = '') => `
  <div class="topgap"></div>
  <header class="tk-head"><h1 class="serif">${esc(title)}</h1>${sub ? `<p class="lede">${esc(sub)}</p>` : ''}</header>`;

export default {
  tab: 'tickets',
  title: L('پشتیبانی', 'Support', 'Destek'),
  /* A thread has no big heading to scroll past: its bar (with the way back)
     is there from the start. */
  topbarAt: (parts) => (parts[1] && parts[1] !== 'new' ? -1 : 40),
  back: (parts) => Boolean(parts[1]),
  hideTabs: (parts) => Boolean(parts[1] && parts[1] !== 'new'),

  meta(parts) {
    if (parts[1] === 'new') return { title: L('تیکت جدید', 'New ticket', 'Yeni talep') };
    if (parts[1]) return { title: parts[1] };
    return {};
  },

  render(parts) {
    const sub = parts[1];
    if (!sub) {
      return `${head(L('پشتیبانی', 'Support', 'Destek'),
        L('سؤال‌ها و درخواست‌هات، با جواب تیم تیفانی.', 'Your questions and requests, with the TIFFANY team’s answers.', 'Soruların ve taleplerin, TIFFANY ekibinin yanıtlarıyla.'))}
        <div class="tk-body" id="tkBody">${spinner()}</div>`;
    }
    if (sub === 'new') {
      return `${head(L('تیکت جدید', 'New ticket', 'Yeni talep'),
        L('بنویس چی شده؛ اگه لازمه عکس، فایل، پیام صوتی یا محصولی که درباره‌شه رو هم بذار.',
          'Tell us what happened — add photos, files, a voice note or the piece it is about if that helps.',
          'Ne olduğunu yaz — gerekirse fotoğraf, dosya, sesli mesaj veya ilgili ürünü ekle.'))}
        <div class="tk-body" id="tkBody">${spinner()}</div>`;
    }
    return `<div class="topgap-bar"></div><div class="tk-thread" id="tkBody">${spinner()}</div>`;
  },

  mount(app, signal, parts = []) {
    const sub = parts[1];
    const body = app.querySelector('#tkBody');
    const wire = (fn) => app.addEventListener('click', fn, { signal });
    wire((e) => {
      const b = e.target.closest('[data-tk]');
      if (!b) return;
      if (b.dataset.tk === 'signin') signInSheet();
      if (b.dataset.tk === 'signup') signUpSheet();
    });

    const draw = () => {
      if (signal.aborted) return;
      if (!account.loaded) { body.innerHTML = spinner(); return; }
      if (!account.user) { body.innerHTML = signedOut(); return; }
      if (!sub) drawList();
      else if (sub === 'new') drawNew();
      else drawThread();
    };
    document.addEventListener('account:changed', draw, { signal });

    async function drawList() {
      body.innerHTML = spinner();
      try {
        const j = await call('tickets.php', 'list');
        if (signal.aborted) return;
        body.innerHTML = listHtml(j.tickets);
      } catch (err) {
        if (!signal.aborted) body.innerHTML = `<p class="tiny tk-none">${esc(sayError(err))}</p>`;
      }
    }

    function drawNew() {
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      body.innerHTML = `
        <div class="field"><label for="tkSubj">${esc(L('موضوع (اختیاری)', 'Subject (optional)', 'Konu (isteğe bağlı)'))}</label>
          <input id="tkSubj" maxlength="80" placeholder="${esc(L('مثلاً: سایز کاپشن چرم', 'e.g. Leather jacket size', 'ör. Deri mont bedeni'))}"></div>
        ${composerHtml({ fixed: false })}`;
      wireComposer(body, {
        signal,
        product: getProduct(q.get('p')) ? q.get('p') : '',
        async submit(fd, onProgress) {
          fd.append('a', 'create');
          fd.append('subject', body.querySelector('#tkSubj').value.trim());
          const j = await send('tickets.php', fd, onProgress);
          toast(L('تیکتت رسید؛ تیم تیفانی به‌زودی جواب می‌ده.', 'Sent — the TIFFANY team will answer soon.', 'Gönderildi — TIFFANY ekibi yakında yanıtlayacak.'), 'check', 3200);
          go(`/tickets/${j.ticket.code}`, { replace: true });
        },
      });
      body.querySelector('#compText').focus({ preventScroll: true });
    }

    let shown = -1;
    async function drawThread(quiet = false) {
      let j;
      try {
        j = await call('tickets.php', 'get', { code: sub });
      } catch (err) {
        if (signal.aborted) return;
        if (!quiet) body.innerHTML = empty('chat', err.code === 'not_found' ? L('پیدا نشد', 'Not found', 'Bulunamadı') : sayError(err), '');
        return;
      }
      if (signal.aborted) return;
      const t = j.ticket;
      const count = j.messages.length;
      if (quiet && count === shown) return;
      const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 80;
      if (!quiet) {
        body.innerHTML = `
          <header class="tk-thead">
            <div><h1 class="serif">${esc(t.subject)}</h1>
              <p class="tiny"><span dir="ltr">${esc(t.code)}</span> · ${esc(when(t.created_at))}</p></div>
            <span class="tk-pill ${t.status}" id="tkStatus">${esc(STATUS[t.status]())}</span>
          </header>
          <div class="msgs" id="msgs"></div>
          <div class="tk-foot" id="tkFoot"></div>
          ${composerHtml({ fixed: true })}`;
        wireComposer(body, {
          signal,
          async submit(fd, onProgress) {
            fd.append('a', 'reply');
            fd.append('code', t.code);
            const r = await send('tickets.php', fd, onProgress);
            paintThread(r, true);
          },
        });
        /* The fixed reply box changes height; the thread keeps clear of it. */
        const comp = body.querySelector('#comp');
        const ro = new ResizeObserver(() => app.style.setProperty('--comp-h', `${comp.offsetHeight}px`));
        ro.observe(comp);
        signal.addEventListener('abort', () => { ro.disconnect(); app.style.removeProperty('--comp-h'); });
      }
      paintThread(j, !quiet || atBottom);
      refreshUnread();                     // the unread dot on the tab
    }

    function paintThread(j, toBottom) {
      shown = j.messages.length;
      const t = j.ticket;
      body.querySelector('#msgs').innerHTML = messagesHtml(j);
      const st = body.querySelector('#tkStatus');
      st.className = `tk-pill ${t.status}`;
      st.textContent = STATUS[t.status]();
      body.querySelector('#tkFoot').innerHTML = t.status === 'closed'
        ? `<p class="tiny">${esc(L('این تیکت بسته شده؛ اگه بنویسی دوباره باز می‌شه.', 'This ticket is closed; writing again reopens it.', 'Bu talep kapalı; yazarsan yeniden açılır.'))}</p>`
        : `<button class="link-more" type="button" id="tkClose">${esc(L('مشکلم حل شد، ببندش', 'Solved — close it', 'Çözüldü — kapat'))}</button>`;
      body.querySelector('#tkClose')?.addEventListener('click', async () => {
        try { paintThread(await call('tickets.php', 'close', { code: t.code }), false); } catch (err) { toast(sayError(err), 'info'); }
      });
      if (toBottom) requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' }));
    }

    if (sub && sub !== 'new') {
      /* New answers while the thread is open: a quiet look every 20 seconds. */
      const timer = setInterval(() => {
        if (!document.hidden && account.user) drawThread(true);
      }, 20000);
      signal.addEventListener('abort', () => clearInterval(timer));
    }
    draw();
  },
};
