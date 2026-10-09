#!/usr/bin/env python3
"""The two sheets that open with the shop: the cookie question, then the
home-screen sheet — on every kind of phone that matters here.

    TIFFANY_DATA=/tmp/tf php -S localhost:8131 -t .
    CHROME_PATH=... python3 popups_e2e.py [base]

Screenshots go to docs/shots/pop-*.webp. Every console error is a failure."""
import json
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8131').rstrip('/')
SHOTS = pathlib.Path(__file__).resolve().parent / 'docs' / 'shots'
PHONE = {'width': 390, 'height': 844}

UA = {
    'iphone': ('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 '
               '(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'),
    'android': ('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/129.0.0.0 Mobile Safari/537.36'),
    'samsung': ('Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546E) AppleWebKit/537.36 (KHTML, like '
                'Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36'),
    'insta': ('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, '
              'like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_5; fa_IR; fa; '
              'scale=3.00; 1179x2556; 0)'),
    'insta_android': ('Mozilla/5.0 (Linux; Android 13; SM-S911B Build/TP1A.220624.014; wv) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile '
                      'Safari/537.36 Instagram 350.0.0.0 Android'),
    'desktop': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/129.0.0.0 Safari/537.36'),
}

# Chromium may decide on its own that the page is installable; the tests
# below fire their own beforeinstallprompt when they want one.
HOLD_PROMPT = """addEventListener('beforeinstallprompt', (e) => {
  if (!e.__fake) e.stopImmediatePropagation();
}, true);
/* sendBeacon bodies never reach the test's request log; keep a copy. */
(() => {
  const sb = navigator.sendBeacon.bind(navigator);
  window.__beacons = [];
  navigator.sendBeacon = (u, d) => { if (String(u).includes('hit.php')) window.__beacons.push(d); return sb(u, d); };
})();"""

ok = 0
bad = []
noise = []


def check(name, cond, extra=''):
    global ok
    if cond:
        ok += 1
    else:
        bad.append(f'{name} {extra}'.strip())
    print(('  ok   ' if cond else '  FAIL ') + name + (f'  {extra}' if extra and not cond else ''))


def shot(page, name):
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.wait_for_timeout(650)
    raw = SHOTS / f'{name}.png'
    page.screenshot(path=str(raw))
    try:
        from PIL import Image
        im = Image.open(raw).convert('RGB')
        w = 585
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(
            raw.with_suffix('.webp'), 'WEBP', quality=84, method=6)
        raw.unlink()
    except ImportError:
        pass


def phone(browser, kind, scheme='light', lang=None, standalone=False):
    mobile = kind != 'desktop'
    ctx = browser.new_context(
        viewport=PHONE if mobile else {'width': 1280, 'height': 860},
        device_scale_factor=2, is_mobile=mobile, has_touch=mobile,
        user_agent=UA[kind], color_scheme=scheme)
    ctx.add_init_script(HOLD_PROMPT)
    if lang:
        ctx.add_init_script(f"try{{sessionStorage.setItem('tiffany.lang','{lang}')}}catch(e){{}}")
    if standalone:
        ctx.add_init_script("""const mm = window.matchMedia.bind(window);
          window.matchMedia = (q) => q.includes('display-mode: standalone')
            ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q);""")
    page = ctx.new_page()
    hits = []
    page.on('console', lambda m: noise.append(f'{kind} console.{m.type}: {m.text}')
            if m.type == 'error' else None)
    page.on('pageerror', lambda e: noise.append(f'{kind} pageerror: {e}'))
    return ctx, page, hits


def sheet(page, cls, timeout=12000):
    try:
        page.wait_for_selector(f'.sheet-root.open .{cls}', timeout=timeout)
        page.wait_for_timeout(600)
        return True
    except Exception:
        return False


def beacons(page, since=0):
    """Page-view bodies sent since index `since`, decoded."""
    return [json.loads(t) for t in page.evaluate(
        f"Promise.all(window.__beacons.slice({since}).map((b) => b.text()))")]


def sent_count(page):
    return page.evaluate('window.__beacons.length')


def cookie_val(ctx):
    return next((c['value'] for c in ctx.cookies() if c['name'] == 'tf_c'), None)


def fits(page):
    return page.evaluate("""(() => {
      const s = document.querySelector('.sheet-root.open .sheet');
      return document.documentElement.scrollWidth <= innerWidth + 1
        && (!s || s.scrollWidth <= s.clientWidth + 1);
    })()""")


def no_sheet_for(page, ms):
    page.wait_for_timeout(ms)
    return not page.evaluate("document.querySelector('#sheetRoot').classList.contains('open')")


def run():
    with sync_playwright() as pw:
        exe = os.environ.get('CHROME_PATH')
        browser = (pw.chromium.launch(executable_path=exe) if exe
                   else pw.chromium.launch(channel='chrome'))

        # ------------------------------------------------------------ iPhone
        print('\niPhone, Safari — first visit')
        ctx, p, hits = phone(browser, 'iphone')
        p.goto(BASE + '/', wait_until='domcontentloaded')
        check('cookie sheet opens by itself', sheet(p, 'pop-consent'))
        txt = p.inner_text('.pop-consent')
        check('it names what is collected', all(w in txt for w in ['نوع دستگاه', 'برند گوشی', 'سیستم‌عامل', 'مرورگر']))
        check('it says what is never collected', 'اسم، شماره، آدرس و موقعیت' in txt)
        check('two answers on it', p.locator('.pop-consent [data-consent]').count() == 2)
        check('the sheet fits a phone', fits(p))
        check('the veil is up when it shows', p.evaluate("!document.querySelector('#boot')"))
        shot(p, 'pop-cookies-fa')
        p.click('.pop-consent summary')
        check('«بیشتر بدونم» opens the small print', 'tf_c' in p.inner_text('.pop-more'))
        p.click('.pop-consent summary')
        before = sent_count(p)
        p.click('[data-consent="yes"]')
        check('install sheet follows the answer', sheet(p, 'pop-install'))
        check('cookie is set to yes by the server', cookie_val(ctx) == '1', str(cookie_val(ctx)))
        steps = p.inner_text('.pop-install .steps')
        check('iPhone gets the Safari steps', 'Add to Home Screen' in steps and 'اشتراک‌گذاری' in steps, steps[:80])
        check('Safari’s own glyphs are drawn in', p.locator('.pop-install .steps .key').count() >= 3)
        check('«دیگه نشون نده» is offered', p.locator('[data-inst="never"]').count() == 1)
        check('the install sheet fits a phone', fits(p))
        shot(p, 'pop-install-ios-fa')
        p.click('.pop-install .btn-ink')
        p.wait_for_timeout(700)
        memo = json.loads(p.evaluate("localStorage.getItem('tiffany.a2hs')") or '{}')
        check('the showing is remembered', memo.get('n') == 1 and memo.get('at'), str(memo))
        p.evaluate("location.hash = '#/shop'")
        p.wait_for_timeout(900)
        sent = beacons(p, before)
        check('page views now carry the device line', any(
            (h.get('d') or {}).get('os') == 'ios' and h['d'].get('brand') == 'apple'
            and h['d'].get('type') == 'mobile' and h['d'].get('browser') == 'safari' for h in sent), str(sent))
        check('…and nothing else', all(set((h.get('d') or {}).keys()) <= {'type', 'os', 'brand', 'browser', 'app', 'lang'} for h in sent))
        p.reload(wait_until='domcontentloaded')
        check('next visit: neither sheet comes back', no_sheet_for(p, 6000))
        p.evaluate("location.hash = '#/profile'")
        p.wait_for_timeout(900)
        row = p.locator('[data-act="consent"]')
        check('profile shows the answer', 'قبول' in row.inner_text(), row.inner_text())
        row.click()
        check('profile row reopens the cookie sheet', sheet(p, 'pop-consent'))
        check('…with the current answer on it', 'الان: قبول کردی' in p.inner_text('.pop-consent'))
        p.click('[data-consent="no"]')
        p.wait_for_timeout(900)
        check('changed to no', cookie_val(ctx) == '0')
        check('profile row follows', 'فقط ضروری‌ها' in p.locator('[data-act="consent"]').inner_text())
        before = sent_count(p)
        p.evaluate("location.hash = '#/shop'")
        p.wait_for_timeout(900)
        sent = beacons(p, before)
        check('after no, page views carry no device line', sent and all('d' not in h for h in sent), str(sent))
        p.evaluate("location.hash = '#/terms'")
        p.wait_for_timeout(700)
        check('terms explain the cookie', 'tf_c' in p.inner_text('#app') and 'قبول دارم' in p.inner_text('#app'))
        ctx.close()

        # ------------------------------------------------- dark, and swiped away
        print('\niPhone, dark — swiped away')
        ctx, p, hits = phone(browser, 'iphone', scheme='dark')
        p.goto(BASE + '/', wait_until='domcontentloaded')
        check('cookie sheet (dark)', sheet(p, 'pop-consent'))
        shot(p, 'pop-cookies-dark')
        p.click('.sheet-veil', position={'x': 30, 'y': 60})
        check('closing without an answer still leads on', sheet(p, 'pop-install'))
        check('no cookie without an answer', cookie_val(ctx) is None)
        shot(p, 'pop-install-ios-dark')
        p.click('[data-inst="never"]')
        p.wait_for_timeout(600)
        check('«دیگه نشون نده» sticks', json.loads(p.evaluate("localStorage.getItem('tiffany.a2hs')"))['done'] is True)
        p.reload(wait_until='domcontentloaded')
        check('same visit: not asked again', no_sheet_for(p, 6000))
        ctx.close()

        # ------------------------------------------------------------ Android
        print('\nAndroid, Chrome')
        ctx, p, hits = phone(browser, 'android')
        p.goto(BASE + '/', wait_until='domcontentloaded')
        check('cookie sheet', sheet(p, 'pop-consent'))
        p.click('[data-consent="no"]')
        check('install sheet', sheet(p, 'pop-install'))
        check('cookie set to no', cookie_val(ctx) == '0')
        steps = p.inner_text('.pop-install .steps')
        check('Chrome’s menu steps', 'Install app' in steps and 'نصب برنامه' in steps, steps[:80])
        shot(p, 'pop-install-android-fa')
        p.evaluate("""(() => {
          const e = new Event('beforeinstallprompt'); e.__fake = true;
          e.prompt = () => { window.__prompted = true; };
          e.userChoice = Promise.resolve({ outcome: 'accepted' });
          dispatchEvent(e);
        })()""")
        p.wait_for_timeout(500)
        check('when Chrome says installable, the steps become one button',
              p.locator('[data-inst="go"]').count() == 1 and p.locator('.pop-install .steps').count() == 0)
        shot(p, 'pop-install-android-native')
        p.click('[data-inst="go"]')
        p.wait_for_timeout(700)
        check('the button opens Chrome’s own install dialog', p.evaluate('window.__prompted === true'))
        check('accepted install is remembered', json.loads(p.evaluate("localStorage.getItem('tiffany.a2hs')")).get('done') is True)
        check('sheet closed after install', not p.evaluate("document.querySelector('#sheetRoot').classList.contains('open')"))
        ctx.close()

        print('\nAndroid, Samsung Internet — accepts')
        ctx, p, hits = phone(browser, 'samsung')
        p.goto(BASE + '/', wait_until='domcontentloaded')
        check('cookie sheet', sheet(p, 'pop-consent'))
        p.click('[data-consent="yes"]')
        check('install sheet', sheet(p, 'pop-install'))
        steps = p.inner_text('.pop-install .steps')
        check('Samsung’s own menu path', 'Add page to' in steps, steps[:80])
        p.click('.pop-install .btn-ink')
        p.wait_for_timeout(300)
        before = sent_count(p)
        p.evaluate("location.hash = '#/shop'")
        p.wait_for_timeout(900)
        sent = beacons(p, before)
        check('Samsung phone, Samsung browser', any((h.get('d') or {}).get('brand') == 'samsung'
              and h['d'].get('browser') == 'samsung' and h['d'].get('os') == 'android' for h in sent), str(sent))
        ctx.close()

        # ---------------------------------------------------------- Instagram
        print('\nInstagram’s in-app browser')
        ctx, p, hits = phone(browser, 'insta')
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE)
        p.goto(BASE + '/', wait_until='domcontentloaded')
        check('cookie sheet', sheet(p, 'pop-consent'))
        p.click('[data-consent="yes"]')
        check('install sheet', sheet(p, 'pop-install'))
        txt = p.inner_text('.pop-install')
        check('says: open it in the browser first', 'اول سایت رو توی مرورگر باز کن' in txt and 'اینستاگرام' in txt, txt[:90])
        check('iPhone path: ⋯ then external browser', 'Open in external browser' in txt)
        shot(p, 'pop-install-instagram')
        p.click('[data-inst="copy"]')
        p.wait_for_timeout(500)
        clip = p.evaluate('navigator.clipboard.readText()')
        check('copy-link puts the shop’s address on the clipboard', clip.rstrip('/') == BASE, clip)
        ctx.close()

        ctx, p, hits = phone(browser, 'insta_android')
        p.goto(BASE + '/', wait_until='domcontentloaded')
        sheet(p, 'pop-consent')
        p.click('[data-consent="no"]')
        check('Instagram on Android', sheet(p, 'pop-install'))
        check('Android path: open in Chrome', 'Open in Chrome' in p.inner_text('.pop-install'))
        ctx.close()

        # ------------------------------------------------- English, standalone
        print('\nEnglish')
        ctx, p, hits = phone(browser, 'iphone', lang='en')
        p.goto(BASE + '/', wait_until='domcontentloaded')
        check('cookie sheet in English', sheet(p, 'pop-consent') and 'Cookies and device info' in p.inner_text('.pop-consent'))
        check('reads left to right', p.evaluate("getComputedStyle(document.querySelector('.pop-consent')).direction") == 'ltr')
        shot(p, 'pop-cookies-en')
        p.click('[data-consent="yes"]')
        check('install sheet in English', sheet(p, 'pop-install') and 'Put TIFFANY on your home screen' in p.inner_text('.pop-install'))
        shot(p, 'pop-install-ios-en')
        ctx.close()

        print('\nAlready on the home screen')
        ctx, p, hits = phone(browser, 'iphone', standalone=True)
        p.goto(BASE + '/', wait_until='domcontentloaded')
        check('cookie sheet still asks', sheet(p, 'pop-consent'))
        p.click('[data-consent="yes"]')
        check('no install sheet when already installed', no_sheet_for(p, 3500))
        before = sent_count(p)
        p.evaluate("location.hash = '#/shop'")
        p.wait_for_timeout(900)
        sent = beacons(p, before)
        check('counted as the installed app', any((h.get('d') or {}).get('app') == 'app' for h in sent), str(sent))
        ctx.close()

        print('\nComputer')
        ctx, p, hits = phone(browser, 'desktop')
        p.goto(BASE + '/', wait_until='domcontentloaded')
        check('cookie sheet on a computer too', sheet(p, 'pop-consent'))
        shot(p, 'pop-cookies-desktop')
        p.click('[data-consent="yes"]')
        check('no home-screen sheet on a computer', no_sheet_for(p, 3500))
        ctx.close()

        browser.close()

    print(f'\n{ok} checks passed, {len(bad)} failed')
    if noise:
        print('\nCONSOLE')
        for n in noise:
            print('  -', n)
    if bad:
        print('\nFAILURES')
        for b in bad:
            print('  -', b)
    sys.exit(1 if bad or noise else 0)


if __name__ == '__main__':
    run()
