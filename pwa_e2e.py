"""The shop opened from the home screen behaves as an app: it never zooms.

Two ways a phone says "opened from the home screen" are checked: iPhone's
navigator.standalone, and the display-mode media query (Android, desktop
installs). A real two-finger pinch is sent through Chromium's own touch input, and the page's zoom (visualViewport.scale)
is read back. In a browser tab the page must stay zoomable.

    TIFFANY_DATA=/tmp/tf-pwa php -S 127.0.0.1:8152 tests/router.php
    python3 pwa_e2e.py 8152
"""
import sys

from playwright.sync_api import sync_playwright

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8152
BASE = f'http://127.0.0.1:{PORT}'
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
PHONE = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
QUIET = ("try{localStorage.setItem('tiffany.a2hs','{\"done\":true}');"
         "sessionStorage.setItem('tiffany.consent.later','later')}catch(e){}")
ok = bad = 0


def check(name, cond, info=''):
    global ok, bad
    if cond:
        ok += 1
        print(f'  ok   {name}')
    else:
        bad += 1
        print(f'  FAIL {name}  {info}')


def touch(cdp, kind, pts):
    cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [
        {'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})


def pinch(page, cdp):
    """Two fingers moving apart, through Chromium's own touch input."""
    page.evaluate('scrollTo(0, 0)')
    page.wait_for_timeout(200)
    touch(cdp, 'touchStart', [(180, 400), (210, 440)])
    for k in range(1, 21):
        touch(cdp, 'touchMove', [(180 - 6 * k, 400 - 8 * k), (210 + 6 * k, 440 + 8 * k)])
        page.wait_for_timeout(16)
    touch(cdp, 'touchEnd', [])
    page.wait_for_timeout(700)
    return page.evaluate('visualViewport.scale')


def swipe_up(page, cdp):
    touch(cdp, 'touchStart', [(195, 700)])
    for k in range(1, 21):
        touch(cdp, 'touchMove', [(195, 700 - 25 * k)])
        page.wait_for_timeout(16)
    touch(cdp, 'touchEnd', [])
    page.wait_for_timeout(700)
    return page.evaluate('scrollY')


def open_shop(br, mode):
    ctx = br.new_context(**PHONE)
    ctx.add_init_script(QUIET)
    if mode == 'ios':
        ctx.add_init_script("Object.defineProperty(navigator, 'standalone', { get: () => true });")
    if mode == 'android':     # what an installed app answers to the display-mode query
        ctx.add_init_script("""(() => { const mm = window.matchMedia.bind(window);
            window.matchMedia = (q) => /display-mode:\\s*standalone/.test(q)
              ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {},
                  addEventListener() {}, removeEventListener() {} } : mm(q); })();""")
    p = ctx.new_page()
    cdp = ctx.new_cdp_session(p)
    p.goto(BASE + '/#/shop')
    p.wait_for_selector('#boot', state='detached', timeout=20000)
    p.wait_for_timeout(800)
    return ctx, p, cdp


with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=CHROME)

    print('\nin a browser tab')
    ctx, p, cdp = open_shop(br, 'web')
    vp = p.get_attribute('meta[name=viewport]', 'content')
    check('the viewport still allows zoom', 'maximum-scale=5' in vp and 'user-scalable=no' not in vp, vp)
    check('not marked as the app', not p.evaluate("document.documentElement.classList.contains('app')"))
    s = pinch(p, cdp)
    check('a pinch zooms the page (anyone can enlarge it)', s > 1.2, str(s))
    check('the same test can see a zoom (so the app checks below mean something)', s > 1.2)
    ctx.close()

    for mode, label in [('ios', 'from the iPhone home screen (navigator.standalone)'),
                        ('android', 'installed on Android / desktop (display-mode: standalone)')]:
        print(f'\n{label}')
        ctx, p, cdp = open_shop(br, mode)
        vp = p.get_attribute('meta[name=viewport]', 'content')
        check('marked as the app', p.evaluate("document.documentElement.classList.contains('app')"))
        check('the viewport is locked at 1x', all(x in vp for x in ['maximum-scale=1', 'minimum-scale=1', 'user-scalable=no', 'viewport-fit=cover']), vp)
        check('no pinch or double-tap zoom on the page (touch-action)',
              p.evaluate("getComputedStyle(document.documentElement).touchAction") == 'pan-x pan-y'
              and p.evaluate("getComputedStyle(document.body).touchAction") == 'pan-x pan-y')
        check("Safari's pinch gesture is cancelled", p.evaluate(
            "(() => { const e = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; })()"))
        s = pinch(p, cdp)
        check('a real two-finger pinch does not zoom', s == 1, str(s))
        p.evaluate('scrollTo(0, 0)')
        y = swipe_up(p, cdp)
        check('a one-finger swipe still scrolls the page', y > 150, str(y))
        p.evaluate("location.hash = '#/p/waxed-trench'")
        p.wait_for_timeout(1500)
        check('the product page opens as usual', p.locator('#pdpSizes').count() == 1)
        p.evaluate("location.hash = '#/profile'")
        p.wait_for_timeout(1200)
        s = pinch(p, cdp)
        check('…and stays unzoomable on other pages', s == 1, str(s))
        ctx.close()
    br.close()

print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
