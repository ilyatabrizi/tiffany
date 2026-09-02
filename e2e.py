#!/usr/bin/env python3
"""Walk the whole shop in a real browser and shout if anything is off.

    python3 serve.py &          # or the preview task
    python3 e2e.py              # checks + screenshots into docs/shots/
    python3 e2e.py --shots-only

Uses Playwright against the system Chrome — no browser download. Every console
error and every failed request anywhere in the run is a failure, not a warning.
"""

import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8131'
SHOTS = pathlib.Path(__file__).resolve().parent / 'docs' / 'shots'
VIEW = {'width': 390, 'height': 844}

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
    """Captured at 2x, filed at 1.5x WebP — the repo does not need 10MB of PNG."""
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.wait_for_timeout(420)
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


def goto(page, hash_, settle=700):
    page.evaluate(f'location.hash = {hash_!r}')
    page.wait_for_timeout(settle)


def run(shots_only=False):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome')
        ctx = browser.new_context(viewport=VIEW, device_scale_factor=2,
                                  is_mobile=True, has_touch=True,
                                  user_agent=('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like '
                                              'Mac OS X) AppleWebKit/605.1.15 (KHTML, like '
                                              'Gecko) Version/17.0 Mobile/15E148 Safari/604.1'))
        page = ctx.new_page()
        page.on('console', lambda m: noise.append(f'console.{m.type}: {m.text}')
                if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: noise.append(f'pageerror: {e}'))
        page.on('requestfailed', lambda r: noise.append(
            f'request failed: {r.url} — {r.failure}'))

        # ------------------------------------------------------------ home
        print('\nhome')
        page.goto(BASE, wait_until='networkidle')
        page.wait_for_timeout(1800)          # the boot veil lifts
        check('boot veil lifted', page.locator('#boot').count() == 0)
        check('wordmark drawn', page.locator('.hero-mark').is_visible())
        check('campaign film present', page.locator('.hero video').count() == 1)
        check('three collections', page.locator('.ccard').count() == 3)
        check('new-in rail filled', page.locator('.rail-p .card').count() >= 6)
        check('six looks', page.locator('.look-tile').count() == 6)
        check('five tabs', page.locator('.tab').count() == 5)
        check('home tab lit', page.locator('.tab[data-tab="home"]').get_attribute('class').find('on') >= 0)
        cta = page.locator('.hero-cta .btn').first.bounding_box()
        tabbar = page.locator('#tabbar').bounding_box()
        check('hero CTA clears the tab bar', cta['y'] + cta['height'] <= tabbar['y'] + 1,
              f"cta ends {cta['y'] + cta['height']:.0f}, bar starts {tabbar['y']:.0f}")
        shot(page, '01-home')

        page.evaluate('window.scrollTo(0, 880)')
        shot(page, '02-home-collections')
        page.evaluate('window.scrollTo(0, 1700)')
        shot(page, '03-home-newin')
        page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        shot(page, '04-home-foot')

        # ------------------------------------------------------------ shop
        print('\nshop')
        goto(page, '#/shop')
        total = page.locator('.grid-p .card').count()
        check('shop lists every piece', total == 17, f'got {total}')
        check('category chips', page.locator('.seg .chip').count() == 6)
        bar = page.locator('.shopbar').bounding_box()
        first = page.locator('.grid-p .card').first.bounding_box()
        check('sticky bar does not sit on the first row',
              first['y'] >= bar['y'] + bar['height'] - 1,
              f"bar ends {bar['y'] + bar['height']:.0f}, card starts {first['y']:.0f}")
        shot(page, '05-shop')

        page.locator('.seg .chip', has_text='Skirts').click()
        page.wait_for_timeout(500)
        skirts = page.locator('.grid-p .card').count()
        check('skirts filter narrows', 0 < skirts < total, f'{skirts} of {total}')
        check('url carries the filter', 'c=skirts' in page.evaluate('location.hash'))

        page.locator('[data-act="filters"]').click()
        page.wait_for_timeout(600)
        check('filter sheet opens', page.locator('.sheet-root.open').count() == 1)
        shot(page, '06-shop-filter')
        page.locator('.sheet [data-fset="col"][data-val="desert"]').click()
        page.wait_for_timeout(600)
        check('collection filter applied', 'col=desert' in page.evaluate('location.hash'))
        desert = page.locator('.grid-p .card').count()
        check('desert skirts only', desert >= 1, f'{desert}')

        goto(page, '#/shop')
        check('filters cleared', page.locator('.grid-p .card').count() == total)

        # --------------------------------------------------------- product
        print('\nproduct')
        page.locator('.grid-p .card-open').first.click()
        page.wait_for_timeout(800)
        check('on a product page', page.evaluate('location.hash').startswith('#/p/'))
        check('gallery has frames', page.locator('.pdp-gallery .shot').count() >= 2)
        check('sizes offered', page.locator('#pdpSizes .size').count() >= 1)
        check('buy bar present', page.locator('.buybar').is_visible())
        check('tab bar steps aside for the buy bar',
              'hide' in (page.locator('#tabbar').get_attribute('class') or ''))
        buy = page.locator('.buybar [data-act="add"]').bounding_box()
        check('add button is reachable', buy['width'] > 200, str(buy))
        check('specs collapsed and expandable', page.locator('.spec details').count() == 4)
        shot(page, '07-product')

        page.locator('[data-act="guide"]').click()
        page.wait_for_timeout(600)
        check('size guide opens', page.locator('.guide-row').count() == 6)
        shot(page, '08-size-guide')
        page.locator('.sheet [data-act="fit"]').click()
        page.wait_for_timeout(800)
        check('fit sheet opens', page.locator('#fitForm').count() == 1)
        page.fill('#fBust', '90')
        page.fill('#fWaist', '73')
        page.fill('#fHip', '99')
        page.wait_for_timeout(300)
        check('fit preview names a size', 'M' in page.locator('#fitOut').inner_text(),
              page.locator('#fitOut').inner_text())
        shot(page, '09-fit')
        page.locator('#fitForm button[type="submit"]').click()
        page.wait_for_timeout(900)
        check('recommendation now on the page', page.locator('.size.rec').count() >= 1)

        # ------------------------------------------------------------- bag
        print('\nbag')
        page.locator('.buybar [data-act="add"]').click()
        page.wait_for_timeout(700)
        if page.locator('.sheet-root.open').count():
            page.locator('.sheet [data-size]').first.click()
            page.wait_for_timeout(700)
        check('bag badge appears', page.locator('.tab-dot:not([hidden])').count() == 1)

        goto(page, '#/shop')
        page.locator('.grid-p .card-open').nth(3).click()
        page.wait_for_timeout(700)
        page.locator('.buybar [data-act="add"]').click()
        page.wait_for_timeout(700)
        if page.locator('.sheet-root.open').count():
            page.locator('.sheet [data-size]').first.click()
            page.wait_for_timeout(700)

        goto(page, '#/bag')
        lines = page.locator('.line').count()
        check('two lines in the bag', lines == 2, f'{lines}')
        check('totals shown', page.locator('.trow.big').count() == 1)
        shot(page, '10-bag')

        page.locator('.line').first.locator('[data-qty="1"]').click()
        page.wait_for_timeout(500)
        qty = page.locator('.line').first.locator('.stepper b').inner_text()
        check('stepper adds one', qty.strip() == '2', qty)

        # -------------------------------------------------------- checkout
        print('\ncheckout')
        page.locator('[data-act="checkout"]').click()
        page.wait_for_timeout(700)
        check('checkout sheet opens', page.locator('#coForm').count() == 1)
        shot(page, '11-checkout')
        page.fill('#coName', 'Vanda T')
        page.fill('#coPhone', '0912 000 0000')
        page.fill('#coLine', '12 Studio Street, unit 4')
        page.fill('#coCity', 'Tehran')
        page.locator('#coForm button[type="submit"]').click()
        page.wait_for_timeout(1400)
        check('landed on orders', page.evaluate('location.hash') == '#/orders')
        check('one order recorded', page.locator('.order').count() == 1)
        card = page.locator('.order').first.bounding_box()
        check('order card fills the column', card['width'] > 320, f"{card['width']:.0f}px")
        check('bag emptied', page.evaluate(
            'JSON.parse(localStorage.getItem("tiffany.v1")).bag.length') == 0)
        shot(page, '12-orders')

        page.locator('.order').first.click()
        page.wait_for_timeout(700)
        check('tracking opens', page.locator('.track .step').count() == 5)
        check('a stage is current', page.locator('.step.now').count() == 1)
        shot(page, '13-tracking')
        page.locator('.sheet [data-act="sheet-close"]').click()
        page.wait_for_timeout(500)

        # ---------------------------------------------------------- looks
        print('\nlooks')
        goto(page, '#/')
        page.wait_for_timeout(500)
        page.evaluate('document.querySelector(\'[data-act="look"]\').click()')
        page.wait_for_timeout(900)
        check('viewer opens', page.locator('#viewer.open').count() == 1)
        check('six slides', page.locator('.viewer-slide').count() == 6)
        check('slide one is shoppable', page.locator('.viewer-slide').first
              .locator('.vitem').count() >= 2)
        shot(page, '14-looks')
        page.locator('[data-vitem]').first.click()
        page.wait_for_timeout(800)
        check('chip jumps to the piece', page.evaluate('location.hash').startswith('#/p/'))
        check('viewer closed behind it', page.locator('#viewer.open').count() == 0)

        # ----------------------------------------------------- collections
        print('\ncollection')
        goto(page, '#/c/noir')
        check('collection page renders', page.locator('.display').count() == 1)
        check('collection has a way back', page.locator('.pdp-back').is_visible())
        check('tab bar stays on a collection',
              'hide' not in (page.locator('#tabbar').get_attribute('class') or ''))
        check('its pieces are listed', page.locator('.grid-p .card').count() == 5)
        shot(page, '15-collection')

        # -------------------------------------------------------- wishlist
        print('\nsaved')
        page.locator('.card-wish').first.click()
        page.wait_for_timeout(500)
        check('heart fills', page.locator('.card-wish.on').count() >= 1)
        goto(page, '#/saved')
        check('saved page holds it', page.locator('.grid-p .card').count() == 1)
        shot(page, '16-saved')

        # --------------------------------------------------------- profile
        print('\nprofile')
        goto(page, '#/profile')
        check('name carried from checkout', 'Vanda' in page.locator('.phead h1').inner_text())
        check('stats row', page.locator('.stat').count() == 3)
        check('fit shown', 'Not set' not in page.locator(
            '[data-act="fit"] .row-val').inner_text())
        shot(page, '17-profile')

        page.locator('[data-theme-mode="dark"]').click()
        page.wait_for_timeout(700)
        check('dark applied', page.evaluate(
            'document.documentElement.dataset.theme') == 'dark')
        check('paper went dark', page.evaluate(
            "getComputedStyle(document.body).backgroundColor") == 'rgb(12, 12, 14)')
        shot(page, '18-profile-dark')
        goto(page, '#/')
        shot(page, '19-home-dark')
        goto(page, '#/shop')
        shot(page, '20-shop-dark')
        goto(page, '#/profile')
        page.locator('[data-theme-mode="light"]').click()
        page.wait_for_timeout(600)

        page.locator('[data-colour-mode="always"]').click()
        page.wait_for_timeout(600)
        check('colour mode saved', page.evaluate(
            'document.documentElement.dataset.colour') == 'always')
        goto(page, '#/shop')
        grey = page.evaluate(
            "getComputedStyle(document.querySelector('.card .shot img')).filter")
        check('always-on drops the greyscale', grey == 'none', grey)
        shot(page, '21-shop-colour-on')
        goto(page, '#/profile')
        page.locator('[data-colour-mode="touch"]').click()
        page.wait_for_timeout(500)
        goto(page, '#/shop')
        state = page.evaluate("""(() => {
            const shots = [...document.querySelectorAll('.card .shot')];
            const unlit = shots.find(s => !s.classList.contains('lit'));
            return {
              lit: shots.filter(s => s.classList.contains('lit')).length,
              total: shots.length,
              filter: unlit ? getComputedStyle(unlit.querySelector('img')).filter : null,
            };
        })()""")
        check('on-touch keeps the rest grey',
              state['filter'] and 'grayscale' in state['filter'], str(state))
        check('on-touch lights what is mid-screen',
              0 < state['lit'] < state['total'], str(state))

        # -------------------------------------------------------- the rest
        print('\nplumbing')
        goto(page, '#/p/does-not-exist')
        check('unknown product handled', 'Not in the line' in page.inner_text('#app'))
        goto(page, '#/c/nope')
        check('unknown collection handled', page.locator('.empty').count() == 1)
        goto(page, '#/nowhere')
        check('unknown route falls back home', page.locator('.hero').count() == 1)

        manifest = page.evaluate("""fetch('manifest.webmanifest')
            .then(r => r.ok ? r.json() : null)""")
        check('manifest served', bool(manifest) and manifest.get('short_name') == 'TIFFANY')
        sw = page.evaluate("fetch('sw.js').then(r => r.ok)")
        check('service worker served', sw is True)
        og = page.evaluate("fetch('assets/img/og.jpg').then(r => r.ok)")
        check('share card served', og is True)

        # every image the app asked for actually arrived
        broken = page.evaluate("""[...document.images]
            .filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc)""")
        check('no broken images', not broken, str(broken[:3]))

        ctx.close()
        browser.close()


if __name__ == '__main__':
    run('--shots-only' in sys.argv)
    real = [n for n in noise if 'favicon' not in n.lower()]
    print(f'\n{ok} checks passed, {len(bad)} failed')
    if bad:
        print('\nFAILURES')
        for b in bad:
            print('  -', b)
    if real:
        print('\nCONSOLE / NETWORK')
        for n in dict.fromkeys(real):
            print('  -', n)
    print(f'\nshots -> {SHOTS}')
    sys.exit(1 if (bad or real) else 0)
