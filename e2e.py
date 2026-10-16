#!/usr/bin/env python3
"""Walk the whole shop in a real browser and shout if anything is off.

    python3 serve.py &          # or the preview task
    python3 e2e.py              # checks + screenshots into docs/shots/
    python3 e2e.py --shots-only

Uses Playwright against the system Chrome — no browser download. Every console
error and every failed request anywhere in the run is a failure, not a warning.
"""

import os
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8131'
SHOTS = pathlib.Path(__file__).resolve().parent / 'docs' / 'shots'
VIEW = {'width': 390, 'height': 844}
QUIET = ("try{localStorage.setItem('tiffany.a2hs','{\"done\":true}');"
         "sessionStorage.setItem('tiffany.consent.later','later')}catch(e){}")

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
        # The system Chrome on a Mac; CHROME_PATH points anywhere else (a CI
        # box, a container with its own Chromium).
        exe = os.environ.get('CHROME_PATH')
        browser = (pw.chromium.launch(executable_path=exe) if exe
                   else pw.chromium.launch(channel='chrome'))
        ctx = browser.new_context(viewport=VIEW, device_scale_factor=2,
                                  is_mobile=True, has_touch=True,
                                  user_agent=('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like '
                                              'Mac OS X) AppleWebKit/605.1.15 (KHTML, like '
                                              'Gecko) Version/17.0 Mobile/15E148 Safari/604.1'))
        # The two opening sheets (cookies, home screen) have their own run in
        # popups_e2e.py; here they would only stand in front of everything.
        ctx.add_init_script(QUIET)
        page = ctx.new_page()
        page.on('console', lambda m: noise.append(f'console.{m.type}: {m.text}')
                if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: noise.append(f'pageerror: {e}'))
        page.on('requestfailed', lambda r: noise.append(
            f'request failed: {r.url} — {r.failure}'))

        # ------------------------------------------------------------ boot
        # The veil is lifted by app.js; with app.js held back it stays put, so
        # the opening frame can be measured and photographed at rest.
        print('\nboot')
        for scheme in ['light', 'dark']:
            bctx = browser.new_context(viewport=VIEW, device_scale_factor=2,
                                       is_mobile=True, has_touch=True, color_scheme=scheme)
            bp = bctx.new_page()
            bp.route('**/js/app.js', lambda r: r.abort())
            bp.goto(BASE, wait_until='domcontentloaded')
            bp.wait_for_timeout(1600)
            b = bp.evaluate("""(() => {
                const m = document.querySelector('.boot-mark').getBoundingClientRect();
                const s = document.querySelector('.boot-sig');
                const r = s.getBoundingClientRect();
                const k = s.querySelector('.alphasig__mark');
                const kb = getComputedStyle(k, '::before'), ka = getComputedStyle(k, '::after');
                return {
                  text: s.innerText.replace(/\\s+/g, ' ').trim(),
                  dir: getComputedStyle(s).direction,
                  opacity: getComputedStyle(s).opacity,
                  oneLine: r.height < 30,
                  below: r.top - m.bottom,
                  markMid: Math.abs((m.left + m.right) / 2 - innerWidth / 2) + Math.abs((m.top + m.bottom) / 2 - innerHeight / 2),
                  sigMid: Math.abs((r.left + r.right) / 2 - innerWidth / 2),
                  logoH: Math.round(k.getBoundingClientRect().height),
                  letters: kb.maskImage || kb.webkitMaskImage, bars: ka.maskImage || ka.webkitMaskImage,
                  barColour: ka.backgroundColor,
                };
            })()""")
            if scheme == 'light':
                check('boot: Alpha line reads «Powered by Alpha Agency»', b['text'] == 'Powered by Alpha Agency', b['text'])
                check('boot: the line is English, left to right', b['dir'] == 'ltr')
                check('boot: one line', b['oneLine'])
                check('boot: it sits under the wordmark', 16 <= b['below'] <= 40, f"{b['below']:.0f}px")
                check('boot: the wordmark stays dead centre', b['markMid'] < 2, f"{b['markMid']:.1f}px off")
                check('boot: the line is centred under it', b['sigMid'] < 2, f"{b['sigMid']:.1f}px off")
                check('boot: Alpha mark is small', 16 <= b['logoH'] <= 22, f"{b['logoH']}px")
                check('boot: Alpha mark keeps both layers',
                      'alpha-letters' in (b['letters'] or '') and 'alpha-bars' in (b['bars'] or '')
                      and b['barColour'] == 'rgb(255, 204, 0)', str(b))
            check(f'boot ({scheme}): the line has settled in', b['opacity'] == '1', b['opacity'])
            shot(bp, '00-boot' if scheme == 'light' else '00-boot-dark')
            bctx.close()

        # ------------------------------------------------------------ home
        print('\nhome')
        # Clock the veil: when the opening finishes, and when the veil starts
        # to lift. It should sit still, finished, for 1.5s before lifting.
        page.add_init_script("""addEventListener('DOMContentLoaded', () => {
            const b = document.getElementById('boot'); if (!b) return;
            const t = window.__veil = { end: 0, gone: 0 };
            b.getAnimations({ subtree: true }).forEach((a) => a.finished.then(() => {
              t.end = Math.max(t.end, performance.now()); }));
            new MutationObserver(() => { if (!t.gone && b.classList.contains('gone')) t.gone = performance.now(); })
              .observe(b, { attributes: true });
        });""")
        page.goto(BASE, wait_until='networkidle')
        page.wait_for_selector('#boot', state='detached', timeout=8000)   # the boot veil lifts
        check('boot veil lifted', page.locator('#boot').count() == 0)
        v = page.evaluate('window.__veil') or {}
        held = (v.get('gone') or 0) - (v.get('end') or 0)
        check('boot: the finished opening holds 1–2s before the veil lifts',
              v.get('end') and 1400 <= held <= 2000, f'{held:.0f}ms (opening ended {v.get("end", 0):.0f}ms)')
        check('page is Persian and right-to-left', page.evaluate(
            "document.documentElement.lang + '/' + document.documentElement.dir") == 'fa/rtl')
        check('IRANYekanX is the body face', page.evaluate(
            "document.fonts.check('400 15px IRANYekanX')"))
        # Cormorant has no Persian in it; the stack must fall through for any
        # Persian word, and hold the serif for a Latin collection name.
        check('Persian never asks Cormorant for a glyph', page.evaluate(
            "getComputedStyle(document.body).fontFamily.startsWith('IRANYekanX')"))
        # The studio asked for the tab bar in English, in every language.
        check('tabs read in English', page.evaluate(
            "[...document.querySelectorAll('.tab-label')].map(e=>e.textContent).join()")
            == 'Home,Shop,Bag,Orders,Profile')
        check('Home sits at the right edge of a Persian page', page.evaluate(
            "(()=>{const t=[...document.querySelectorAll('.tab')];"
            "return t[0].getBoundingClientRect().left > t[4].getBoundingClientRect().left})()"))
        check('hero CTAs read خرید and استوری‌ها', page.evaluate(
            "[...document.querySelectorAll('.hero-cta .btn')].map(e=>e.textContent.trim()).join('|')")
            == 'خرید|استوری\u200cها')
        check('language button in the hero', page.locator('.hero .lang-btn').is_visible())
        check('it says فارسی', page.locator('.lang-btn').inner_text().strip() == 'فارسی')
        # Latin digits must never reach the page: Intl formats fa-IR and the
        # font would map anything that slipped through, which hides the bug.
        prices = page.evaluate(
            "[...document.querySelectorAll('.card-price')].map(e=>e.textContent).join()")
        check('every price is in Persian numerals',
              not any(c in prices for c in '0123456789'), prices[:60])
        check('thousands use the Persian separator', '\u066c' in prices, prices[:60])
        # · and ۰ are the same circle in this face — one must never sit beside
        # the other, so the separator is banned outright.
        body = page.inner_text('#app')
        check('no middot anywhere near a numeral', '\u00b7' not in body)
        check('wordmark drawn', page.locator('.hero-mark').is_visible())
        check('campaign film present', page.locator('.hero video').count() == 1)
        check('the film is running', page.evaluate(
            "(()=>{const v=document.querySelector('.hero video');"
            "return !v.paused && v.currentTime > 0})()"))
        # the poster used to be the only positioned layer, so it painted over a
        # playing video and the hero was a still. never again.
        check('the film paints over its poster', page.evaluate(
            "(()=>{const e=document.elementFromPoint(195,300);return e&&e.tagName})()")
            == 'VIDEO')
        check('nothing floats over the film', page.locator('.hero-sound').count() == 0)
        check('one collection: Autumn / Winter 2027', page.locator('.ccard').count() == 1)
        check('new-in rail filled', page.locator('.rail-p .card').count() >= 6)
        check('seven looks', page.locator('.look-tile').count() == 7)
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
        check('agency signature in the footer', page.locator('.alphasig').count() == 1)
        sig = page.locator('.alphasig__txt').inner_text().replace('\n', ' ').strip()
        check('signature is in English', sig.lower() == 'powered by alpha agency', sig)
        check('signature runs left to right',
              page.locator('.alphasig').get_attribute('dir') == 'ltr')
        ig = page.evaluate("""(() => {
            const s = document.querySelector('.footer .ig span');
            return { text: s.textContent, dir: getComputedStyle(s).direction };
        })()""")
        check('handle reads @tiffanyiran, left to right',
              ig['text'] == '@tiffanyiran' and ig['dir'] == 'ltr', str(ig))
        foot = page.inner_text('.footer')
        gone = [t for t in ['نسخه', 'لباس زنانه', 'ارسال رایگان'] if t in foot]
        check('footer carries no notice, tagline or delivery line', not gone, str(gone))
        check('signature points at Alpha',
              page.locator('.alphasig').get_attribute('href') == 'https://alphaa.agency')
        # the lockup is two masks: letters follow --ink and invert, bars keep
        # Alpha's yellow. If either layer stops painting the mark disappears.
        layers = page.evaluate("""(() => {
            const e = document.querySelector('.alphasig__mark');
            const b = getComputedStyle(e, '::before'), a = getComputedStyle(e, '::after');
            return {
              letters: b.maskImage || b.webkitMaskImage,
              bars: a.maskImage || a.webkitMaskImage,
              barColour: a.backgroundColor,
              w: Math.round(e.getBoundingClientRect().width),
            };
        })()""")
        check('both signature layers are masked',
              'alpha-letters' in (layers['letters'] or '')
              and 'alpha-bars' in (layers['bars'] or ''), str(layers))
        check('the bars keep Alpha yellow', layers['barColour'] == 'rgb(255, 204, 0)',
              layers['barColour'])
        check('the lockup is legibly sized', layers['w'] >= 70, f"{layers['w']}px")
        shot(page, '04-home-foot')

        # ------------------------------------------------------------ shop
        print('\nshop')
        goto(page, '#/shop')
        total = page.locator('.grid-p .card').count()
        check('shop lists every piece', total == 28, f'got {total}')
        CATS = ['همه', 'بافت', 'تیشرت', 'تاپ', 'هودی و سوشرت', 'وست', 'شومیز', 'شلوار',
                'دامن', 'کاپشن', 'ژاکت', 'اکسسوری', 'کفش']
        chips = page.evaluate("[...document.querySelectorAll('.seg .chip')].map(e=>e.textContent.trim())")
        check("the studio's twelve categories, in their order", chips == CATS, str(chips))
        stocked = page.evaluate("""(async () => {
            const d = await import('./js/data.js');
            return d.PRODUCTS.every(p => d.CATEGORIES.some(c => c.id === p.cat && c.id !== 'all'));
        })()""")
        check('every piece sits in one of them', stocked)
        check('no piece count in the bar', page.locator('.count').inner_text().strip() == '',
              page.locator('.count').inner_text())
        bar = page.locator('.shopbar').bounding_box()
        first = page.locator('.grid-p .card').first.bounding_box()
        check('sticky bar does not sit on the first row',
              first['y'] >= bar['y'] + bar['height'] - 1,
              f"bar ends {bar['y'] + bar['height']:.0f}, card starts {first['y']:.0f}")
        shot(page, '05-shop')

        page.locator('.seg .chip', has_text='شلوار').click()
        page.wait_for_timeout(500)
        trousers = page.locator('.grid-p .card').count()
        check('trousers filter narrows', trousers == 5, f'{trousers} of {total}')
        check('url carries the filter', 'c=trousers' in page.evaluate('location.hash'))
        page.locator('.seg .chip', has_text='کاپشن').click()
        page.wait_for_timeout(500)
        jackets = page.locator('.grid-p .card').count()
        check('jackets filter', jackets == 6, f'{jackets}')
        page.locator('.seg .chip', has_text='دامن').click()
        page.wait_for_timeout(500)
        soon_txt = page.inner_text('.empty') if page.locator('.empty').count() else ''
        check('an unstocked category says coming soon', 'به‌زودی' in soon_txt, soon_txt[:60])
        page.locator('.seg .chip', has_text='شلوار').click()
        page.wait_for_timeout(500)

        page.locator('[data-act="filters"]').click()
        page.wait_for_timeout(600)
        check('filter sheet opens', page.locator('.sheet-root.open').count() == 1)
        shot(page, '06-shop-filter')
        page.locator('.sheet [data-fset="col"][data-val="aw27"]').click()
        page.wait_for_timeout(600)
        check('collection filter applied', 'col=aw27' in page.evaluate('location.hash'))
        aw = page.locator('.grid-p .card').count()
        check('collection trousers only', aw == 5, f'{aw}')

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
        check('specs: fabric, then delivery', page.locator('.spec details').count() == 2)
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
        out = page.locator('#fitOut').inner_text()
        check('fit preview names a size', 'M' in out, out)
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
        ship = page.locator('.trow').nth(1).inner_text()
        check('delivery is free on any bag', 'رایگان' in ship, ship)
        note = page.locator('.shipnote').inner_text() if page.locator('.shipnote').count() else ''
        check('bag names the 3-working-day promise', '۳ روز کاری' in note, note)
        check('no free-delivery progress bar', page.locator('.freebar').count() == 0)
        shot(page, '10-bag')

        page.locator('.line').first.locator('[data-qty="1"]').click()
        page.wait_for_timeout(500)
        qty = page.locator('.line').first.locator('.stepper b').inner_text().strip()
        # the stepper counts in Persian, like everything else on the page
        check('stepper adds one', qty == '\u06f2', f'{qty} (want ۲)')
        total_txt = page.locator('.trow.big b').inner_text()
        check('bag total in Persian numerals with ٬',
              '\u066c' in total_txt and not any(c in total_txt for c in '0123456789'),
              total_txt)

        # -------------------------------------------------------- checkout
        print('\ncheckout')
        page.locator('[data-act="checkout"]').click()
        page.wait_for_timeout(700)
        check('checkout sheet opens', page.locator('#coForm').count() == 1)
        shot(page, '11-checkout')
        page.fill('#coName', 'وندا تبریزی')
        page.fill('#coPhone', '۰۹۱۲۰۰۰۰۰۰۰')
        page.fill('#coLine', 'خیابان ولیعصر، پلاک ۱۲، واحد ۴')
        page.fill('#coCity', 'تهران')
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
        check('seven slides', page.locator('.viewer-slide').count() == 7)
        # scrollLeft in an RTL track is signed differently per engine; the
        # viewer probes it rather than assuming. Prove paging still lands.
        page.evaluate("""(() => {
            const t = document.querySelector('#viewerTrack');
            t.scrollLeft = Math.sign(t.scrollLeft || -1) * t.clientWidth * 2;
        })()""")
        page.wait_for_timeout(900)
        lit = page.evaluate(
            "[...document.querySelectorAll('.viewer-bars i')].findIndex(b=>b.classList.contains('on'))")
        check('paging the RTL track lands on a slide', lit == 2, f'bar {lit}')
        check('slide one is shoppable', page.locator('.viewer-slide').first
              .locator('.vitem').count() >= 2)
        shot(page, '14-looks')
        page.locator('[data-vitem]').first.click()
        page.wait_for_timeout(800)
        check('chip jumps to the piece', page.evaluate('location.hash').startswith('#/p/'))
        check('viewer closed behind it', page.locator('#viewer.open').count() == 0)

        # ----------------------------------------------------- collections
        print('\ncollection')
        goto(page, '#/c/aw27')
        check('collection page renders', page.locator('.display').count() == 1)
        check('collection has a way back', page.locator('.pdp-back').is_visible())
        check('tab bar stays on a collection',
              'hide' not in (page.locator('#tabbar').get_attribute('class') or ''))
        check('its pieces are listed', page.locator('.grid-p .card').count() == 28)
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
        check('name carried from checkout', 'وندا' in page.locator('.phead h1').inner_text())
        check('stats row', page.locator('.stat').count() == 3)
        check('fit shown', '—' != page.locator(
            '[data-act="fit"] .row-val').inner_text().strip())
        page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        page.wait_for_timeout(400)
        check('signature signs the profile too', page.locator('.alphasig').count() == 1)
        page.evaluate('window.scrollTo(0, 0)')
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

        # The colour switch is gone; the rule is fixed at "on touch".
        check('profile has no colour switch', page.locator('[data-colour-mode]').count() == 0)
        links = page.evaluate("[...document.querySelectorAll('a.row[href^=\"#/\"]')].map(a=>a.getAttribute('href'))")
        check('profile links the three pages', links == ['#/about', '#/contact', '#/terms'], str(links))
        check('the preview notice is gone from the profile',
              'پیش‌نمایش' not in page.inner_text('#app'))

        # ----------------------------------------------- about, stores, terms
        print('\ninfo pages')
        goto(page, '#/')
        page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        foot = page.evaluate("[...document.querySelectorAll('.footer-links a')].map(a=>a.getAttribute('href'))")
        check('footer links the three pages', foot == ['#/about', '#/contact', '#/terms'], str(foot))
        page.locator('.footer-links a').first.click()
        page.wait_for_timeout(700)
        check('footer link opens About', page.evaluate('location.hash') == '#/about')
        body = page.inner_text('#app')
        for frag in ['تیفانی یک برند پوشاک زنانه', 'ترندهای روز، کیفیت، جسارت',
                     'نسخه‌ی بهتر و جسورترِ خودت', '۱۳۹۹']:
            check(f'about carries «{frag}»', frag in body)
        check('the brand is spelled one way', 'طیفانی' not in body)
        check('About has a back button', page.locator('#topbarBack').get_attribute('hidden') is None)
        shot(page, '25-about')

        goto(page, '#/contact')
        body = page.inner_text('#app')
        check('four branches', page.locator('.branch').count() == 4)
        for frag in ['سعادت‌آباد، میدان کتاب', 'تراس سنتر', 'میدان فهمیده', 'لاله پارک',
                     'نگین پارک', 'اطلس', 'فلکه‌ی بزرگ', 'بانک صادرات']:
            check(f'contact names «{frag}»', frag in body)
        tels = page.evaluate("[...document.querySelectorAll('a[href^=\"tel:\"]')].map(a=>a.getAttribute('href'))")
        check('two landlines, dialable', tels == ['tel:+984136600185', 'tel:+984133249176'], str(tels))
        # The Persian face draws Latin digits as Persian; the text node keeps them.
        raw = page.evaluate("document.querySelector('#app').textContent")
        for d in ['041-36600185', '041-33249176', '5158489885', '5157638919', '5157933511',
                  '10:00', '22:30', '23:00']:
            check(f'contact carries {d}', d in raw)
        check('email link', page.locator('a[href="mailto:Ameervanda@gmail.com"]').count() == 1)
        hours = page.evaluate("[...document.querySelectorAll('.branch')].map(b=>(b.textContent.match(/\\d\\d:\\d\\d/g)||[]).join('-'))")
        check('hours per branch', hours == ['', '10:00-22:30', '10:00-22:30', '10:00-23:00'], str(hours))
        shot(page, '26-contact')

        goto(page, '#/terms')
        body = page.inner_text('#app')
        for frag in ['ارسال همه‌ی سفارش‌ها رایگانه', '۳ روز کاری', '۷ روز', 'حریم خصوصی']:
            check(f'terms carry «{frag}»', frag in body)
        shot(page, '27-terms')

        goto(page, '#/p/leather-jacket')
        page.evaluate("document.querySelectorAll('.spec details').forEach(d => d.open = true)")
        spec = page.inner_text('.spec')
        check('product page: free delivery in 3 working days', 'ارسال رایگانه' in spec and '۳ روز کاری' in spec)
        check('product page: no old threshold', '۳٬۵۰۰٬۰۰۰' not in spec)
        check('product page links the terms', page.locator('.spec a[href="#/terms"]').count() == 1)
        check('colour rule is on touch', page.evaluate(
            'document.documentElement.dataset.colour') == 'touch')
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
        check('unknown product handled', 'توی کالکشن نیست' in page.inner_text('#app'))

        # Every phrase the studio asked to be rid of, on every route.
        REMOVED = ['لوک', 'خرید کالکشن', 'تازه‌رسیده', 'رنگ مال لباس', 'لباس زنانه',
                   'دوخت ایران', 'ارسال رایگان برای خرید', 'نسخهٔ پیش‌نمایش. عکس',
                   'قطعه —', 'تیراژ کمی دارد', 'ساخته شده در']
        found = []
        for r in ['#/', '#/shop', '#/bag', '#/orders', '#/profile', '#/saved',
                  '#/c/aw27', '#/p/leather-jacket', '#/about', '#/contact', '#/terms']:
            goto(page, r, 600)
            text = page.inner_text('body')
            found += [f'{r}: {t}' for t in REMOVED if t in text]
        check('none of the removed copy is left', not found, str(found[:4]))
        goto(page, '#/shop', 500)
        check('no «۱۷ قطعه» count', '۱۷ قطعه' not in page.inner_text('body'))
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

        # A Latin comma or question mark sitting in a Persian sentence is the
        # shape a missed translation leaves behind. Sweep every route for it.
        FA = r'[\u0600-\u06FF\u200c]'
        BAD = re.compile(FA + r'\s*[,;?]|[,;?]\s*' + FA)
        leftovers = []
        for r in ['#/', '#/shop', '#/bag', '#/orders', '#/profile', '#/saved',
                  '#/c/aw27', '#/p/leather-jacket',
                  '#/p/karl-lagerfeld-bag', '#/p/cotton-shirt']:
            goto(page, r, 600)
            for m in BAD.finditer(page.inner_text('#app')):
                leftovers.append(f'{r}: {m.group(0)!r}')
        check('no Latin punctuation inside Persian', not leftovers, str(leftovers[:3]))

        # every image the app asked for actually arrived
        broken = page.evaluate("""[...document.images]
            .filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc)""")
        check('no broken images', not broken, str(broken[:3]))

        # ------------------------------------------------------- languages
        print('\nlanguages')
        goto(page, '#/')
        page.wait_for_timeout(600)
        page.locator('.lang-btn').click()
        page.wait_for_timeout(400)
        check('language menu opens', page.locator('#langMenu').is_visible())
        check('three languages offered', page.evaluate(
            "[...document.querySelectorAll('.lang-opt')].map(e=>e.dataset.lang).join()")
            == 'fa,en,tr')
        shot(page, '22-lang-menu')
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
        check('Escape closes it', not page.locator('#langMenu').is_visible())

        ARABIC = re.compile(r'[\u0600-\u06FF]')
        ROUTES = ['#/', '#/shop', '#/bag', '#/orders', '#/profile', '#/saved',
                  '#/c/aw27', '#/p/leather-jacket', '#/p/karl-lagerfeld-bag',
                  '#/about', '#/contact', '#/terms', '#/shop?c=shoes']

        def switch_to(code):
            page.locator('.lang-btn').click()
            page.wait_for_timeout(300)
            with page.expect_navigation():
                page.locator(f'.lang-opt[data-lang="{code}"]').click()
            page.wait_for_timeout(1900)

        for code, sep, word in [('en', ',', 'Toman'), ('tr', '.', 'Toman')]:
            print(f'\n  {code}')
            goto(page, '#/')
            switch_to(code)
            check(f'{code}: page language and direction', page.evaluate(
                "document.documentElement.lang + '/' + document.documentElement.dir")
                == f'{code}/ltr')
            check(f'{code}: Inter is the body face', page.evaluate(
                "getComputedStyle(document.body).fontFamily.startsWith('InterVar')"))
            check(f'{code}: tabs still English', page.evaluate(
                "[...document.querySelectorAll('.tab-label')].map(e=>e.textContent).join()")
                == 'Home,Shop,Bag,Orders,Profile')
            check(f'{code}: Home sits at the left edge', page.evaluate(
                "(()=>{const t=[...document.querySelectorAll('.tab')];"
                "return t[0].getBoundingClientRect().left < t[4].getBoundingClientRect().left})()"))
            prices = page.evaluate(
                "[...document.querySelectorAll('.card-price')].map(e=>e.textContent).join('|')")
            check(f'{code}: prices in Latin digits', bool(re.search(r'\d' + re.escape(sep) + r'\d{3}', prices))
                  and word in prices and not ARABIC.search(prices), prices[:60])
            check(f'{code}: the film still runs', page.evaluate(
                "(()=>{const v=document.querySelector('.hero video');"
                "return v && !v.paused})()"))
            shot(page, f'23-home-{code}')
            leaks = []
            # What the visitor typed (the checkout name, the city) is theirs and
            # stays as typed; everything else on the page must be translated.
            SITE_TEXT = """(() => {
                const own = [...document.querySelectorAll('.phead, .row-val, .avatar')];
                own.forEach(e => { e.dataset.d = e.style.display; e.style.display = 'none'; });
                const t = document.body.innerText;
                own.forEach(e => { e.style.display = e.dataset.d; });
                return t;
            })()"""
            for r in ROUTES:
                goto(page, r, 650)
                m = ARABIC.search(page.evaluate(SITE_TEXT))
                if m:
                    leaks.append(r + ': ' + m.group(0))
            check(f'{code}: no Persian left on any route', not leaks, str(leaks[:3]))
            goto(page, '#/orders')
            page.locator('.order').first.click()
            page.wait_for_timeout(700)
            opt = page.locator('.sheet .line-opt').first.inner_text()
            check(f'{code}: a Persian order reads in {code}', not ARABIC.search(opt), opt)
            page.locator('.sheet [data-act="sheet-close"]').click()
            page.wait_for_timeout(400)
            if code == 'tr':
                goto(page, '#/c/aw27')
                ok_tr = page.evaluate("document.fonts.check('400 15px InterVar', 'ğşİ')")
                check('tr: Turkish letters have a face', ok_tr)
                shot(page, '24-collection-tr')
            goto(page, '#/')
            page.evaluate('document.querySelector(\'[data-act="look"]\').click()')
            page.wait_for_timeout(800)
            page.evaluate("""(() => {
                const t = document.querySelector('#viewerTrack');
                t.scrollLeft = t.clientWidth * 2;
            })()""")
            page.wait_for_timeout(800)
            lit = page.evaluate(
                "[...document.querySelectorAll('.viewer-bars i')].findIndex(b=>b.classList.contains('on'))")
            check(f'{code}: paging the LTR track lands on a slide', lit == 2, f'bar {lit}')
            page.keyboard.press('Escape')
            page.wait_for_timeout(400)

        # the choice lasts the visit, not forever
        goto(page, '#/')
        switch_to('fa')
        check('back to Persian', page.evaluate(
            "document.documentElement.lang + '/' + document.documentElement.dir") == 'fa/rtl')
        switch_to('en')
        fresh = browser.new_context(viewport=VIEW, device_scale_factor=2,
                                    is_mobile=True, has_touch=True)
        p2 = fresh.new_page()
        p2.goto(BASE, wait_until='networkidle')
        p2.wait_for_timeout(1500)
        check('a fresh visit opens in Persian', p2.evaluate(
            "document.documentElement.lang + '/' + document.documentElement.dir") == 'fa/rtl')
        fresh.close()

        ctx.close()
        browser.close()


if __name__ == '__main__':
    run('--shots-only' in sys.argv)
    # A request the browser itself abandons (a reload for a language switch, a
    # clip the engine cannot decode) is not a failure of the site.
    real = [n for n in noise if 'favicon' not in n.lower() and 'ERR_ABORTED' not in n]
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
