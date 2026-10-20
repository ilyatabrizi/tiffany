"""The service worker in control, as on the live shop.

On localhost the worker stands aside (sw.js, DEV), so the other browser tests
never see it. Here the shop is served under a made-up name that Chromium is
told to treat as secure, so the worker installs and takes over, and the
addresses that pass through it are checked:

    TIFFANY_DATA=/tmp/tf-sw php -S 127.0.0.1:8196 tests/router.php
    python3 sw_e2e.py 8196

/join is the host's redirect to /#/join; a fetch inside a worker never keeps
the #, so before 2026-10-20 (v15) the worker landed it on the home page."""
import sys

from playwright.sync_api import sync_playwright

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8196
ORIGIN = f'http://shop.test:{PORT}'
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
ok = bad = 0


def check(name, cond, info=''):
    global ok, bad
    if cond:
        ok += 1
        print(f'  ok   {name}')
    else:
        bad += 1
        print(f'  FAIL {name}  {info}')


with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=CHROME, args=[
        '--host-resolver-rules=MAP shop.test 127.0.0.1', f'--unsafely-treat-insecure-origin-as-secure={ORIGIN}'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, service_workers='allow')
    ctx.add_init_script("try{localStorage.setItem('tiffany.a2hs','{\"done\":true}');"
                        "sessionStorage.setItem('tiffany.consent.later','later')}catch(e){}")
    p = ctx.new_page()
    p.goto(ORIGIN + '/')
    p.wait_for_selector('#boot', state='detached', timeout=20000)
    p.wait_for_function('navigator.serviceWorker.ready.then(() => true)', timeout=20000)
    p.wait_for_timeout(2500)
    p.reload()
    p.wait_for_selector('#boot', state='detached', timeout=20000)
    check('the worker is in control after a reload', p.evaluate('Boolean(navigator.serviceWorker.controller)'))
    p.goto(ORIGIN + '/join')
    p.wait_for_timeout(3500)
    tab = p.locator('.sheet-root.open .auth-tabs [aria-selected="true"]')
    check('/join through the worker: the profile, with the create-account sheet open',
          p.evaluate('location.hash') == '#/profile' and tab.count() == 1 and tab.inner_text().strip() == 'ساخت حساب',
          p.evaluate('location.href'))
    p.goto(ORIGIN + '/p/waxed-trench')
    p.wait_for_timeout(3000)
    check('a crawlable product address through the worker still opens the product',
          p.locator('.pdp, #pdpSizes').count() > 0, p.evaluate('location.href'))
    ctx.set_offline(True)
    p.goto(ORIGIN + '/join')
    p.wait_for_timeout(3000)
    check('offline: /join still opens the profile from the cached shop', p.evaluate('location.hash') == '#/profile',
          p.evaluate('location.href'))
    br.close()

print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
