"""The back office and the shop, end to end, in a real browser.

    TIFFANY_DATA=/tmp/tf-e2e php -S 127.0.0.1:8133 -t .
    TIFFANY_DATA=/tmp/tf-e2e python3 admin_e2e.py http://127.0.0.1:8133

Needs a FRESH data folder. It sets the panel up with the key from that
folder, adds a product with a photo, opens the store, buys it on the shop,
moves the order along in the panel and watches the customer see it."""
import io
import os
import re
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8133').rstrip('/')
ADMIN = BASE + '/admin/'
DATA = os.environ['TIFFANY_DATA']
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'docs', 'shots')
PHONE = {'viewport': {'width': 390, 'height': 844}, 'device_scale_factor': 2, 'is_mobile': True, 'has_touch': True}
ok = bad = 0
noise = []


def check(name, cond, extra=''):
    global ok, bad
    if cond:
        ok += 1
        print('  ok  ', name)
    else:
        bad += 1
        print('  FAIL', name, extra)


def watch(page):
    page.on('console', lambda m: noise.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: noise.append(f'pageerror: {e}'))
    page.on('dialog', lambda d: d.accept())


def shot(page, name, full=False):
    os.makedirs(SHOTS, exist_ok=True)
    raw = os.path.join(SHOTS, name + '.png')
    page.screenshot(path=raw, full_page=full)
    im = Image.open(raw).convert('RGB')
    im.resize((585, round(im.height * 585 / im.width)), Image.LANCZOS).save(raw[:-4] + '.webp', 'WEBP', quality=84)
    os.remove(raw)


def photo_file():
    im = Image.new('RGB', (1200, 1500), (236, 226, 210))
    for y in range(300, 1200):
        for x in range(380, 820, 4):
            im.putpixel((x, y), (120, 90, 70))
    path = os.path.join(DATA, 'test-photo.jpg')
    im.save(path, 'JPEG', quality=88)
    return path


def key():
    return re.search(r'[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}', open(f'{DATA}/SETUP-KEY.txt').read()).group(0)


with sync_playwright() as pw:
    exe = os.environ.get('CHROME_PATH')
    browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()

    # ---------------------------------------------------------------- setup
    print('\nsetup')
    ceo = browser.new_context(**PHONE)
    a = ceo.new_page()
    watch(a)
    a.goto(ADMIN, wait_until='networkidle')
    a.wait_for_timeout(500)
    check('first visit shows the setup screen', a.locator('#f-key').count() == 1)
    shot(a, '30-admin-setup')
    a.fill('#f-key', 'ABCD-ABCD-ABCD-ABCD')
    a.fill('#f-name', 'امیر وندحدی')
    a.fill('#f-email', 'amir@tiffany.test')
    a.fill('#f-password', 'tiffany-ceo-2026')
    a.fill('#f-again', 'tiffany-ceo-2026')
    a.click('button[type=submit]')
    a.wait_for_timeout(700)
    check('a wrong key is caught at its field', 'درست نیست' in a.inner_text('[data-field="key"]'))
    a.fill('#f-key', key())
    a.click('button[type=submit]')
    a.wait_for_timeout(1500)
    check('setup lands on the dashboard', a.locator('.greet h2').inner_text().startswith('سلام'))
    check('the store starts switched off', 'فروش آنلاین خاموشه' in a.inner_text('#main'))

    # ------------------------------------------------------------- product
    print('\nnew product')
    a.goto(ADMIN + '#/products')
    a.wait_for_timeout(900)
    check('the seeded catalogue is in the panel', a.locator('.pcard').count() == 17, str(a.locator('.pcard').count()))
    a.click('a[href="#/products/new"]')
    a.wait_for_timeout(700)
    a.click('#save')
    a.wait_for_timeout(600)
    check('saving an empty form points at what is missing', a.locator('.field.err, .form-sec.err, [data-field].err').count() >= 1)
    a.set_input_files('#file', photo_file())
    a.wait_for_function("document.querySelectorAll('#photos .photo:not(.busy) img').length === 1", timeout=20000)
    check('photo uploaded and shown', a.locator('#photos .photo .cover').count() == 1)
    a.fill('#f-name', 'هودی کرم')
    a.select_option('#f-cat', 'hoodie')
    a.fill('#f-price', '۲۴۵۰۰۰۰')
    check('price formats as you type', a.input_value('#f-price') == '۲٬۴۵۰٬۰۰۰', a.input_value('#f-price'))
    for s in ['S', 'M']:
        a.click(f'#sizes [data-size="{s}"]')
    a.check('#f-track', force=True)
    a.wait_for_timeout(200)
    a.fill('#st-S', '3')
    a.fill('#st-M', '0')
    a.fill('#colours [data-ck="fa"]', 'کرم')
    a.fill('[data-t="note.fa"]', 'هودی نخی گرم و نرم.')
    a.click('details.more summary')
    a.fill('[data-t="name.en"]', 'Cream Hoodie')
    shot(a, '31-admin-editor', full=True)
    a.click('#save')
    a.wait_for_timeout(1500)
    check('saved; editor reopens on the new id', a.evaluate('location.hash') == '#/products/cream-hoodie', a.evaluate('location.hash'))

    # --------------------------------------------------------------- shop
    print('\nthe shop sees it')
    shop_ctx = browser.new_context(**PHONE)
    shop_ctx.add_init_script("try{localStorage.setItem('tiffany.a2hs','{\"done\":true}');"
                             "sessionStorage.setItem('tiffany.consent.later','later')}catch(e){}")
    s = shop_ctx.new_page()
    watch(s)
    s.goto(BASE + '/#/shop?c=hoodie', wait_until='networkidle')
    s.wait_for_selector('#boot', state='detached', timeout=8000)
    names = s.locator('.grid-p .card-name').all_inner_texts()
    check('the new piece is in its category', names == ['هودی کرم'], str(names))
    src = s.locator('.grid-p .card img').first.get_attribute('src') or ''
    check('with the uploaded photo', src.startswith('uploads/p/') and src.endswith('-480.webp'), src)
    s.click('.grid-p .card-open')
    s.wait_for_timeout(900)
    check('sold-out size is shown but cannot be picked',
          s.locator('#pdpSizes [data-size="M"]').is_disabled() and not s.locator('#pdpSizes [data-size="S"]').is_disabled())
    s.click('.buybar [data-act="add"]')
    s.wait_for_timeout(700)
    if s.locator('.sheet-root.open').count():
        check('size sheet offers only what is left', s.locator('.sheet [data-size="M"]').is_disabled())
        s.click('.sheet [data-size="S"]')
        s.wait_for_timeout(600)
    s.goto(BASE + '/#/bag')
    s.wait_for_timeout(700)
    s.click('[data-act="checkout"]')
    s.wait_for_timeout(700)
    check('closed store: checkout says ordering opens soon, no form',
          'خرید آنلاین به‌زودی' in s.inner_text('.sheet') and s.locator('#coForm').count() == 0)
    s.click('.sheet [data-act="sheet-close"]')
    s.wait_for_timeout(400)

    # ---------------------------------------------------------- open shop
    print('\nopen the store')
    a.goto(ADMIN + '#/settings')
    a.wait_for_timeout(900)
    a.check('#store', force=True)
    a.wait_for_timeout(900)
    check('CEO switches online ordering on', a.inner_text('#storeWord') == 'روشنه')
    shot(a, '32-admin-settings', full=True)

    s.goto(BASE + '/', wait_until='networkidle')
    s.wait_for_selector('#boot', state='detached', timeout=8000)
    s.goto(BASE + '/#/bag')
    s.wait_for_timeout(800)
    s.click('[data-act="checkout"]')
    s.wait_for_timeout(700)
    sheet = s.inner_text('.sheet')
    check('open store: real checkout, card on delivery', 'پیش‌نمایش' not in sheet and 'موقع تحویل' in sheet)
    s.fill('#coName', 'مریم احمدی')
    s.fill('#coPhone', '۰۹۱۲ ۳۴۵ ۶۷۸۹')
    s.select_option('#coProvince', 'آذربایجان شرقی')
    s.fill('#coLine', 'تبریز، ولیعصر، کوچه‌ی ۳، پلاک ۱۲')
    s.fill('#coCity', 'تبریز')
    s.fill('#coPostal', '5157933511')
    s.click('#coForm button[type="submit"]')
    s.wait_for_timeout(1800)
    check('order placed, customer lands on Orders', s.evaluate('location.hash') == '#/orders')
    code = s.locator('.order-code').first.inner_text().strip()
    check('a real order code', re.fullmatch(r'TF-\d{5}', code) is not None, code)
    check('bag emptied', s.evaluate('JSON.parse(localStorage.getItem("tiffany.v1")).bag.length') == 0)

    # ------------------------------------------------------------- orders
    print('\nthe team handles it')
    a.goto(ADMIN + '#/')
    a.wait_for_timeout(1200)
    check('dashboard: new-order alert', 'سفارش جدید منتظر تأییده' in a.inner_text('#main'))
    check('the bottom bar badges it', a.locator('#navBadge').inner_text() == '۱')
    check('today’s sales show the order', '۲٫۵ میلیون' in a.inner_text('.tiles'), a.inner_text('.tiles')[:120])
    check('income chart drawn with one column', a.locator('.chart.money .bar').count() == 1)
    shot(a, '33-admin-dashboard', full=True)
    a.goto(ADMIN + '#/orders?status=new')
    a.wait_for_timeout(1000)
    check('order in the list', code in a.inner_text('#main'))
    shot(a, '34-admin-orders')
    a.click(f'[data-code="{code}"]')
    a.wait_for_timeout(900)
    check('order sheet has the customer', '۰۹۱۲۳۴۵۶۷۸۹' in a.inner_text('.sheet') or '09123456789' in a.locator('.sheet').text_content())
    shot(a, '35-admin-order')
    a.click('.sheet [data-to="confirmed"]')
    a.wait_for_timeout(1000)
    check('confirmed', 'تأیید شده' in a.inner_text('.sheet .pill'))
    check('the sheet has the province and the postal code', 'آذربایجان شرقی' in a.inner_text('.sheet')
          and '5157933511' in a.locator('.sheet').text_content())
    a.fill('.sheet #f-post', '12345')
    a.click('.sheet #postForm button')
    a.wait_for_timeout(700)
    check('a short Iran Post code is refused, on the field', a.locator('.sheet [data-field="post"].err').count() == 1)
    a.fill('.sheet #f-post', '۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹۰۱۲۳۴')
    a.click('.sheet #postForm button')
    a.wait_for_timeout(800)
    check('the Iran Post tracking code is saved', a.input_value('.sheet #f-post') == '123456789012345678901234')
    a.fill('.sheet #f-note', 'زنگ زدم، عصر تحویل بگیره')
    a.click('.sheet #noteForm button')
    a.wait_for_timeout(700)
    a.keyboard.press('Escape')

    s.goto(BASE + '/#/shop')
    s.wait_for_timeout(600)
    s.goto(BASE + '/#/orders')          # opening the tab asks the shop for news
    s.reload(wait_until='networkidle')  # (a fresh visit, not the 30 s throttle)
    s.wait_for_selector('#boot', state='detached', timeout=8000)
    s.wait_for_timeout(1200)
    status = s.locator('.order .status').first.inner_text()
    check('the customer sees «being prepared»', 'آماده' in status, status)
    s.locator('.order').first.click()
    s.wait_for_selector('.sheet .post-box')
    box = s.inner_text('.sheet .post-box')
    check('…and the Iran Post tracking code, with the post office’s tracking site',
          '123456789012345678901234' in box
          and s.get_attribute('.sheet .post-box a', 'href') == 'https://tracking.post.ir/', box)
    check('…and where it goes, province included', 'آذربایجان شرقی' in s.inner_text('.sheet'))
    shot(s, '37-customer-post-code')
    s.keyboard.press('Escape')

    # ----------------------------------------------------------- the rest
    print('\ncustomers, visits, stock')
    a.goto(ADMIN + '#/customers')
    a.wait_for_timeout(900)
    check('customer listed', 'مریم احمدی' in a.inner_text('#main'))
    # a few visitors answer the shop's cookie sheet, from different phones
    import json as _json
    import urllib.request
    for i, (ans, line) in enumerate([
        ('yes', {'type': 'mobile', 'os': 'ios', 'brand': 'apple', 'browser': 'safari', 'app': 'web', 'lang': 'fa'}),
        ('yes', {'type': 'mobile', 'os': 'ios', 'brand': 'apple', 'browser': 'instagram', 'app': 'web', 'lang': 'fa'}),
        ('yes', {'type': 'mobile', 'os': 'ios', 'brand': 'apple', 'browser': 'safari', 'app': 'app', 'lang': 'fa'}),
        ('yes', {'type': 'mobile', 'os': 'android', 'brand': 'samsung', 'browser': 'samsung', 'app': 'web', 'lang': 'fa'}),
        ('yes', {'type': 'mobile', 'os': 'android', 'brand': 'xiaomi', 'browser': 'chrome', 'app': 'app', 'lang': 'en'}),
        ('yes', {'type': 'desktop', 'os': 'windows', 'browser': 'chrome', 'app': 'web', 'lang': 'fa'}),
        ('no', None),
    ]):
        req = urllib.request.Request(BASE + '/api/consent.php', method='POST',
                                     data=_json.dumps({'c': ans, **({'d': line} if line else {})}).encode(),
                                     headers={'Content-Type': 'application/json',
                                              'User-Agent': f'Mozilla/5.0 (test phone {i}) Mobile Safari'})
        urllib.request.urlopen(req).read()
    a.goto(ADMIN + '#/traffic')
    a.wait_for_timeout(1000)
    dev = a.inner_text('#main')
    check('device card: brands, systems, browsers', all(w in dev for w in ['دستگاه بازدیدکننده‌ها', 'سامسونگ', 'شیائومی', 'اندروید', 'داخل اینستاگرام', 'اپ روی صفحه‌ی اصلی']))
    check('cookie acceptance shown', '۸۶٪' in dev or '86%' in dev, dev[:200])
    check('visits counted from the shop', int(re.sub(r'\D', '', a.locator('.tile .v').first.text_content().translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789'))) or 0) >= 1)
    check('the viewed piece is ranked', 'هودی کرم' in a.inner_text('#main'))
    shot(a, '36-admin-traffic', full=True)
    a.goto(ADMIN + '#/products/cream-hoodie')
    a.wait_for_timeout(900)
    check('stock went down to 2', a.input_value('#st-S') == '2', a.input_value('#st-S'))

    print('\nteam')
    a.goto(ADMIN + '#/settings')
    a.wait_for_timeout(900)
    a.click('#addMember')
    a.wait_for_timeout(500)
    a.fill('.sheet #f-name', 'سارا')
    a.fill('.sheet #f-email', 'sara@tiffany.test')
    a.fill('.sheet #f-password', 'sara-temp-pass')
    a.click('.sheet button[type=submit]')
    a.wait_for_timeout(1200)
    check('admin added to the team', 'sara@tiffany.test' in a.inner_text('#main'))
    adm_ctx = browser.new_context(**PHONE)
    b = adm_ctx.new_page()
    watch(b)
    b.goto(ADMIN, wait_until='networkidle')
    b.fill('#f-email', 'sara@tiffany.test')
    b.fill('#f-password', 'sara-temp-pass')
    b.click('button[type=submit]')
    b.wait_for_timeout(1500)
    dash = b.inner_text('#main')
    check('admin: dashboard without money', 'فروش امروز' not in dash and 'گزارش سفارش‌ها' in dash)
    b.goto(ADMIN + '#/settings')
    b.wait_for_timeout(900)
    check('admin: no team, no store switch', b.locator('#addMember').count() == 0 and b.locator('#store').count() == 0)
    b.goto(ADMIN + '#/products')
    b.wait_for_timeout(900)
    b.uncheck('[data-vis="cream-hoodie"]', force=True)
    b.wait_for_timeout(900)
    s.goto(BASE + '/', wait_until='networkidle')
    s.wait_for_selector('#boot', state='detached', timeout=8000)
    s.goto(BASE + '/#/shop?c=hoodie')
    s.wait_for_timeout(800)
    check('a hidden piece leaves the shop', s.locator('.grid-p .card').count() == 0)

    print('\nsign out')
    a.goto(ADMIN + '#/settings')
    a.wait_for_timeout(800)
    a.click('#bye')
    a.wait_for_timeout(900)
    check('signed out to the login screen', a.locator('#f-email').count() == 1 and a.locator('#f-key').count() == 0)

    dark = browser.new_context(**PHONE, color_scheme='dark')
    d = dark.new_page()
    d.goto(ADMIN, wait_until='networkidle')
    d.fill('#f-email', 'amir@tiffany.test')
    d.fill('#f-password', 'tiffany-ceo-2026')
    d.click('button[type=submit]')
    d.wait_for_timeout(1600)
    shot(d, '37-admin-dashboard-dark', full=True)
    desk = browser.new_context(viewport={'width': 1280, 'height': 860})
    desk.add_cookies(dark.cookies())
    w = desk.new_page()
    w.goto(ADMIN + '#/', wait_until='networkidle')
    w.wait_for_timeout(1400)
    shot(w, '38-admin-desktop')
    browser.close()

# 422 is the panel refusing the deliberately empty form above — expected.
real = [n for n in noise if 'favicon' not in n.lower() and 'status of 422' not in n]
print(f'\n{ok} passed, {bad} failed')
if real:
    print('\nCONSOLE')
    for n in dict.fromkeys(real):
        print('  -', n)
sys.exit(1 if bad or real else 0)
