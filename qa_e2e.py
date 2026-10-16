"""Regression checks for the 2026-10-16 review, in a real browser.

    TIFFANY_DATA=/tmp/tf php -S localhost:8131 -t .     (with catalog-import.json in /tmp/tf)
    TIFFANY_DATA=/tmp/tf python3 qa_e2e.py

Each block below is one bug that was found and fixed; the check fails on the
code before the fix. Needs the server's data folder (TIFFANY_DATA) to switch
ordering on and off and to read what the server stored."""
import json
import os
import pathlib
import sqlite3
import sys

from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8131').rstrip('/')
DATA = pathlib.Path(os.environ['TIFFANY_DATA'])
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
PHONE = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
QUIET = ("try{localStorage.setItem('tiffany.a2hs','{\"done\":true}');"
         "sessionStorage.setItem('tiffany.consent.later','later')}catch(e){}")
ok = bad = 0
errors = []


def check(name, cond, extra=''):
    global ok, bad
    if cond:
        ok += 1
        print('  ok  ', name)
    else:
        bad += 1
        print('  FAIL', name, extra)


def sql(q, *a):
    con = sqlite3.connect(DATA / 'tiffany.sqlite')
    try:
        rows = con.execute(q, a).fetchall()
        con.commit()
        return rows
    finally:
        con.close()


def store(open_):
    sql("INSERT OR REPLACE INTO settings (k, v) VALUES ('store_open', ?)", '1' if open_ else '0')


def orders():
    return sql('SELECT COUNT(*) FROM orders')[0][0]


def ready(page):
    page.wait_for_selector('#boot', state='detached', timeout=10000)


def fresh(browser, saved=None, init=''):
    """A phone with an empty (or given) localStorage, on the shop's home."""
    ctx = browser.new_context(**PHONE)
    ctx.add_init_script(QUIET)
    if saved is not None:
        ctx.add_init_script("if(!sessionStorage.getItem('qa.seeded')){localStorage.setItem('tiffany.v1',"
                            + json.dumps(json.dumps(saved)) + ");sessionStorage.setItem('qa.seeded','1')}")
    if init:
        ctx.add_init_script(init)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '/', wait_until='domcontentloaded')
    ready(page)
    return ctx, page


def state(page):
    return page.evaluate("JSON.parse(localStorage.getItem('tiffany.v1') || '{}')")


def checkout(page, name='سارا رضایی', phone='09121110000'):
    page.fill('#coName', name)
    page.fill('#coPhone', phone)
    page.fill('#coLine', 'خیابان امام، کوچه‌ی ۵، پلاک ۸')
    page.fill('#coCity', 'تبریز')
    page.locator('#coForm button[type="submit"]').click()


def add_to_bag(page, pid, size=None):
    page.goto(f'{BASE}/#/p/{pid}')
    page.wait_for_timeout(600)
    if size:
        page.locator(f'#pdpSizes [data-size="{size}"]').click()
    page.locator('.buybar [data-act="add"]').click()
    page.wait_for_timeout(500)
    if page.locator('.sheet-root.open [data-size]').count():
        page.locator('.sheet-root.open [data-size]:not([disabled])').first.click()
        page.wait_for_timeout(500)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME)
    import urllib.request
    urllib.request.urlopen(BASE + '/api/catalog.php').read()   # the server makes its database
    store(False)

    # ------------------------------------------------------------ old bags
    print('\nbags and saved lists from the old catalogue')
    ctx, page = fresh(browser, saved={
        'bag': [{'id': 'rib-tee', 'size': 'M', 'colour': '#FFFFFF', 'qty': 2},            # gone piece
                {'id': 'striped-knit', 'size': 'فری‌سایز', 'colour': 'سفید و شکلاتی', 'qty': 1},  # old labels
                {'id': 'striped-knit', 'size': 'OS', 'colour': '#D9C7B0', 'qty': 1},       # same line, new style
                {'id': 'leather-jacket', 'size': 'XS', 'colour': '#111111', 'qty': 1}],    # size it is not made in
        'wish': ['rib-tee', 'leather-jacket', 'linen-dress'], 'orders': []})
    st = state(page)
    check('gone pieces and sizes leave the bag; old labels become codes; doubles merge',
          st['bag'] == [{'id': 'striped-knit', 'size': 'OS', 'colour': '#D9C7B0', 'qty': 2}], str(st['bag']))
    check('the saved list keeps only real pieces', st['wish'] == ['leather-jacket'], str(st['wish']))
    check('the visitor is told', 'برداشته شدن' in page.inner_text('#toastDock'))
    page.goto(BASE + '/#/bag')
    page.wait_for_timeout(600)
    check('the bag counts what it shows', '۲ قطعه' in page.inner_text('#app'))
    ctx.close()

    # -------------------------------------------- closed shop, no fake orders
    print('\ncheckout while ordering is off')
    ctx, page = fresh(browser)
    add_to_bag(page, 'leather-jacket', 'M')
    page.goto(BASE + '/#/bag')
    page.wait_for_timeout(500)
    page.locator('[data-act="checkout"]').click()
    page.wait_for_timeout(600)
    check('says ordering opens soon, offers no form', 'خرید آنلاین به‌زودی' in page.inner_text('.sheet')
          and page.locator('#coForm').count() == 0)
    check('no order is made up on the phone', state(page)['orders'] == [])
    ctx.close()

    # ---------------------------------------------- one order, however tapped
    print('\ndouble submit')
    store(True)
    n0 = orders()
    ctx, page = fresh(browser)
    add_to_bag(page, 'leather-jacket', 'M')
    page.route('**/api/order.php', lambda r: (page.wait_for_timeout(2500), r.continue_()))
    page.goto(BASE + '/#/bag')
    page.wait_for_timeout(500)
    page.locator('[data-act="checkout"]').click()
    page.wait_for_timeout(500)
    checkout(page)
    page.wait_for_timeout(200)
    page.keyboard.press('Escape')                 # walks away while it is sending
    page.wait_for_timeout(400)
    page.locator('[data-act="checkout"]').click()
    page.wait_for_timeout(500)
    if page.locator('#coForm').count():
        checkout(page)
    page.wait_for_timeout(4500)
    check('two taps while sending make one order', orders() == n0 + 1, f'{orders() - n0} orders')
    check('…and one order on the phone', len(state(page)['orders']) == 1, str(len(state(page)['orders'])))
    code = state(page)['orders'][0]['code']
    ctx.close()

    # ------------------------------------- the price paid, not today's price
    print('\norders keep what was paid')
    sql("UPDATE products SET price = 2500000, data = json_set(data, '$.price', 2500000) WHERE id = 'leather-jacket'")
    ctx, page = fresh(browser, saved={'bag': [], 'wish': [], 'orders': [
        {'code': code, 'placed': 1792150000000, 'server': True, 'status': 'new', 'phone': '09121110000',
         'subtotal': 1000000, 'shipping': 0, 'total': 1000000, 'address': {'line': 'x', 'city': 'y'},
         'items': [{'id': 'leather-jacket', 'size': 'M', 'colour': '#111111', 'qty': 1, 'price': 1000000,
                    'name': 'کاپشن چرم', 'img': 'assets/img/aw-leather-jacket', 'colourName': 'مشکی'}]}]})
    page.goto(BASE + '/#/orders')
    page.wait_for_timeout(700)
    page.locator('.order').first.click()
    page.wait_for_timeout(600)
    line = page.locator('.sheet .line-price').first.inner_text()
    check('a line shows the price paid after the price changes', '۱٬۰۰۰٬۰۰۰' in line, line)
    sql("UPDATE products SET price = 1000000, data = json_set(data, '$.price', 1000000) WHERE id = 'leather-jacket'")
    page.keyboard.press('Escape')
    ctx.close()

    # ------------------------------------------ an order from the old preview
    print('\norders from the old preview checkout')
    ctx, page = fresh(browser, saved={'bag': [], 'wish': [], 'orders': [
        {'code': 'TF-12345', 'placed': 1760000000000, 'pay': 'card', 'subtotal': 1000000, 'shipping': 0,
         'total': 1000000, 'items': [{'id': 'leather-jacket', 'size': 'M', 'colour': '#111111', 'qty': 1}],
         'address': {'line': 'x', 'city': 'y'}, 'step': 0}]})
    page.goto(BASE + '/#/orders')
    page.wait_for_timeout(600)
    check('says it was a preview that was never sent', 'پیش‌نمایش؛ ارسال نشد' in page.inner_text('.order'))
    page.locator('.order').first.click()
    page.wait_for_timeout(500)
    check('…and shows no delivery timeline', page.locator('.sheet .track').count() == 0)
    ctx.close()

    # ------------------------------------------------- shaky connection
    print('\ncheckout when the catalogue could not be fetched')
    ctx, page = fresh(browser)                    # saves a good catalogue on the phone
    add_to_bag(page, 'chocolate-jeans', 'S')
    page.route('**/api/catalog.php', lambda r: r.abort())
    page.reload()
    ready(page)
    n0 = orders()
    page.goto(BASE + '/#/bag')
    page.wait_for_timeout(500)
    page.locator('[data-act="checkout"]').click()
    page.wait_for_timeout(500)
    check('the form still opens (the server decides)', page.locator('#coForm').count() == 1)
    checkout(page, phone='09121110001')
    page.wait_for_timeout(1500)
    check('a real order reaches the shop', orders() == n0 + 1 and state(page)['orders'][0].get('server') is True)
    add_to_bag(page, 'chocolate-jeans', 'M')
    store(False)
    page.goto(BASE + '/#/bag')
    page.wait_for_timeout(500)
    page.locator('[data-act="checkout"]').click()
    page.wait_for_timeout(500)
    checkout(page, phone='09121110001')
    page.wait_for_timeout(1500)
    check('closed meanwhile: the shop says so and nothing is made up',
          orders() == n0 + 1 and len(state(page)['orders']) == 1 and 'بسته' in page.inner_text('#toastDock'))
    store(True)
    ctx.close()

    # ---------------------------------------------------------- bag limits
    print('\nbag limits match the server')
    ctx, page = fresh(browser)
    add_to_bag(page, 'cotton-cap')
    page.goto(BASE + '/#/bag')
    page.wait_for_timeout(500)
    for _ in range(6):
        page.locator('.line').first.locator('[data-qty="1"]').click()
        page.wait_for_timeout(250)
    check('five of one line at most', state(page)['bag'][0]['qty'] == 5, str(state(page)['bag']))
    check('…and the visitor is told why', 'حداکثر' in page.inner_text('#toastDock'))
    ctx.close()

    # ---------------------------------------------- Persian digits, sizes
    print('\nmeasurements typed on a Persian keyboard')
    ctx, page = fresh(browser)
    page.goto(BASE + '/#/profile')
    page.wait_for_timeout(500)
    page.locator('[data-act="fit"]').first.click()
    page.wait_for_timeout(700)
    page.fill('#fBust', '۹۰')
    page.fill('#fWaist', '۷۲')
    page.fill('#fHip', '۹۸')
    check('the sheet suggests a size', 'M' in page.inner_text('#fitOut'), page.inner_text('#fitOut'))
    page.locator('#fitForm button[type="submit"]').click()
    page.wait_for_timeout(500)
    check('stored in Latin digits', state(page)['fit']['bust'] == '90', str(state(page)['fit']))
    page.goto(BASE + '/#/p/leather-jacket')
    page.wait_for_timeout(700)
    fit = page.inner_text('.fitbox')
    check('the product page names the size', 'نمی‌دونی' not in fit and 'M' in fit, fit)
    ctx.close()

    # -------------------------------------------------- names JS already uses
    print('\naddresses that are built-in names')
    ctx, page = fresh(browser)
    n_err = len(errors)
    for h in ['#/p/constructor', '#/p/__proto__', '#/c/constructor', '#/c/toString', '#/p/hasOwnProperty']:
        page.goto(BASE + '/' + h)
        page.wait_for_timeout(400)
    check('no page crashes', len(errors) == n_err, str(errors[n_err:][:2]))
    check('…and the last one still shows a page', len(page.inner_text('#app').strip()) > 10)
    ctx.close()

    # ------------------------------------------------ back and scroll memory
    print('\nback buttons and scroll')
    ctx, page = fresh(browser)
    page.goto(BASE + '/#/shop')
    page.wait_for_timeout(700)
    page.evaluate('scrollTo(0, 1500)')
    page.wait_for_timeout(300)
    y0 = page.evaluate('scrollY')
    page.locator('.grid-p .card-open').nth(8).click()
    page.wait_for_timeout(700)
    page.locator('.pdp-back').click()
    page.wait_for_timeout(700)
    y1 = page.evaluate('scrollY')
    check('the in-page back returns to the same spot in the grid', abs(y1 - y0) < 40, f'{y0} → {y1}')
    page.locator('.grid-p .card-open').nth(9).click()
    page.wait_for_timeout(700)
    page.go_back()
    page.wait_for_timeout(700)
    y2 = page.evaluate('scrollY')
    check('…and so does the browser back', abs(y2 - y0) < 40, f'{y0} → {y2}')
    ctx.close()

    ctx = browser.new_context(**PHONE)
    ctx.add_init_script(QUIET)
    page = ctx.new_page()
    page.goto('data:text/html,<p>another site</p>')
    page.goto(BASE + '/#/p/leather-jacket')
    ready(page)
    page.locator('.pdp-back').click()
    page.wait_for_timeout(800)
    check('a back arrow on a page reached from elsewhere stays in the shop',
          page.url.startswith(BASE) and page.evaluate('location.hash') in ('#/', ''), page.url)
    ctx.close()

    ctx, page = fresh(browser)
    page.goto(BASE + '/#/shop')
    page.wait_for_timeout(400)
    page.goto(BASE + '/#/')
    page.wait_for_timeout(500)
    page.evaluate("document.querySelector('[data-act=\"look\"]').click()")
    page.wait_for_timeout(800)
    page.go_back()
    page.wait_for_timeout(700)
    check('the stories close when the page changes', page.locator('#viewer.open').count() == 0
          and not page.evaluate("document.body.classList.contains('locked')"))
    ctx.close()

    # --------------------------------------------------------- keyboard focus
    print('\nsheets and the keyboard')
    ctx, page = fresh(browser)
    page.goto(BASE + '/#/profile')
    page.wait_for_timeout(500)
    opener = page.locator('[data-act="fit"]').first
    opener.focus()
    page.keyboard.press('Enter')
    page.wait_for_timeout(700)
    for _ in range(14):
        page.keyboard.press('Tab')
    check('Tab stays inside the open sheet', page.evaluate("!!document.activeElement.closest('.sheet')"))
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)
    check('closing gives focus back to what opened it',
          page.evaluate("document.activeElement && document.activeElement.dataset.act") == 'fit')
    ctx.close()

    # ------------------------------------------ the orders tab's minute tick
    print('\nthe orders tab leaves an open sheet alone')
    ctx = browser.new_context(**PHONE)
    ctx.add_init_script(QUIET)
    page = ctx.new_page()
    page.clock.install()
    page.goto(BASE + '/#/orders', wait_until='domcontentloaded')
    page.clock.run_for(6000)
    page.wait_for_selector('#boot', state='detached', timeout=10000)
    page.locator('[data-act="sample"]').click()
    page.clock.run_for(800)
    page.clock.run_for(200000)                    # over three minutes of ticks
    check('a tracking sheet is still open after the ticks', page.locator('.sheet-root.open').count() == 1)
    ctx.close()

    # --------------------------------------------------------------- pages
    print('\npages')
    ctx, page = fresh(browser)
    page.goto(BASE + '/#/about')
    page.wait_for_timeout(1200)
    check('the About photo is the new collection and loads', page.evaluate(
        "(() => { const i = document.querySelector('.info-photo img'); return !!i && i.complete"
        " && i.naturalWidth > 0 && i.currentSrc.includes('aw27'); })()"))
    # The host answers a missing page anywhere with /404.html; mimic that at a
    # nested address, where a relative way home would loop.
    nf = (pathlib.Path(__file__).parent / '404.html').read_text()
    page.route('**/shop/missing', lambda r: r.fulfill(status=404, body=nf, content_type='text/html'))
    page.goto(BASE + '/shop/missing#/shop')
    page.wait_for_timeout(1500)
    check('the not-found page sends people to the shop root', page.url == BASE + '/#/shop', page.url)
    ctx.close()

    check('no script errors anywhere', not errors, str(errors[:3]))
    browser.close()

print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
