"""Cashback in a real browser: the note over the bag, signing up from it, the
credit on the profile, the switch that spends it, the order sheets, the
terms, and tiffanybv.com/join.

    SMS_MOCK_LOG=/tmp/sms.log php -S 127.0.0.1:8139 tests/sms_mock.php
    mkdir /tmp/tf-cbe && cp catalog/real/catalog-import.json /tmp/tf-cbe/
    TIFFANY_DATA=/tmp/tf-cbe php -S 127.0.0.1:8137 tests/router.php
    SMS_MOCK_LOG=/tmp/sms.log TIFFANY_DATA=/tmp/tf-cbe python3 credit_e2e.py http://127.0.0.1:8137"""
import json
import os
import re
import sqlite3
import sys

import requests
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8137').rstrip('/')
DATA = os.environ['TIFFANY_DATA']
MOCK = os.environ['SMS_MOCK_LOG']
SHOTS = os.environ.get('SHOTS', '/tmp/credit-shots')
os.makedirs(SHOTS, exist_ok=True)
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


def db(q, *a):
    con = sqlite3.connect(os.path.join(DATA, 'tiffany.sqlite'), timeout=20)
    try:
        rows = con.execute(q, a).fetchall()
        con.commit()
        return rows
    finally:
        con.close()


def last_code(phone):
    for x in reversed([json.loads(l) for l in open(MOCK).read().splitlines()]):
        if x['path'] == '/v1/send/verify' and x['body']['mobile'] == phone and x['body']['templateId'] == 555001:
            return x['body']['parameters'][0]['value']
    return None


requests.get(BASE + '/api/catalog.php')
panel = requests.Session()
panel.post(BASE + '/api/admin.php', json={'a': 'state'})
key = re.search(r'[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}', open(os.path.join(DATA, 'SETUP-KEY.txt')).read()).group(0)
csrf = panel.post(BASE + '/api/admin.php', json={'a': 'setup', 'key': key, 'name': 'مدیر', 'email': 'ceo@tiffany.test',
                                                   'password': 'ceo-pass-123'}).json()['csrf']


def adm(a, **kw):
    return panel.post(BASE + '/api/admin.php', json={'a': a, **kw}, headers={'X-CSRF': csrf}).json()


with open(os.path.join(DATA, 'sms.json'), 'w') as fh:
    json.dump({'api_key': 'test-key', 'customer_template': 807432, 'owner_template': 307865,
               'owner_mobile': '09141012567', 'endpoint': 'http://127.0.0.1:8139/v1/'}, fh)
adm('settings_save', sms_tpl_otp='555001', store_open=True)
FA = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')


def fa(n):
    return f'{n:,}'.replace(',', '٬').translate(FA)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(**PHONE)
    ctx.add_init_script(QUIET)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)

    def go(h, wait=700):
        page.evaluate(f'location.hash = {h!r}')
        page.wait_for_timeout(wait)

    def add(pid, size=None):
        go(f'#/p/{pid}')
        if size:
            page.locator(f'#pdpSizes [data-size="{size}"]').click()
        page.locator('.buybar [data-act="add"]').click()
        page.wait_for_timeout(500)
        if page.locator('.sheet-root.open [data-size]').count():
            page.locator('.sheet-root.open [data-size]:not([disabled])').first.click()
            page.wait_for_timeout(500)

    page.goto(BASE + '/')
    page.wait_for_selector('#boot', state='detached', timeout=15000)

    print('\nthe bag, signed out')
    add('red-bandana')
    go('#/bag')
    note = page.inner_text('.cbnote')
    check('under 5,000,000: how far to the cashback, with a bar', f'{fa(3010000)} تومان دیگه تا ۶٪ اعتبار برگشتی' in note
          and page.locator('.cbbar').count() == 1, note)
    page.screenshot(path=f'{SHOTS}/01-bag-under.png')
    add('waxed-trench', 'M')
    go('#/bag')
    note = page.inner_text('.cbnote')
    want = (1990000 + 34990000) * 6 // 100
    check(f'over it: what the bag earns ({fa(want)}), and to sign in for it', f'{fa(want)} تومان اعتبار برگشتی' in note
          and page.locator('.cbnote [data-act="signup"]').count() == 1, note)
    check('no credit switch while signed out', page.locator('[data-credit]').count() == 0)
    page.screenshot(path=f'{SHOTS}/02-bag-over-guest.png')

    print('\nsigning up from the bag')
    page.locator('.cbnote [data-act="signup"]').click()
    page.wait_for_selector('#ac-name')
    page.fill('#ac-name', 'سارا رضایی')
    page.fill('#ac-phone', '09121110009')
    page.fill('#ac-password', 'tiffany-1')
    page.click('#acForm [type=submit]')
    page.wait_for_selector('#ac-code')
    page.wait_for_timeout(300)
    page.fill('#ac-code', last_code('09121110009'))
    page.wait_for_function("(document.querySelector('.cbnote') || {}).innerText?.includes('بعد از تحویل')", timeout=10000)
    note = page.inner_text('.cbnote')
    check('back on the bag, signed in: it earns, after delivery', 'بعد از تحویل سفارش به حسابت اضافه می‌شه' in note
          and page.locator('.cbnote [data-act="signup"]').count() == 0, note)

    print('\nthe first order')
    page.locator('[data-act="checkout"]').click()
    page.wait_for_selector('#coForm')
    check('checkout says the cashback too', fa(want) in page.inner_text('.sheet .cbline'))
    page.select_option('#coProvince', 'آذربایجان شرقی')
    page.fill('#coLine', 'خیابان امام، کوچه‌ی ۵، پلاک ۸')
    page.fill('#coCity', 'تبریز')
    page.fill('#coPostal', '5166615731')
    page.screenshot(path=f'{SHOTS}/03-checkout.png')
    page.locator('#coForm [type="submit"]').click()
    page.wait_for_function("location.hash === '#/orders'", timeout=10000)
    page.wait_for_timeout(900)
    code1 = db('SELECT code FROM orders ORDER BY id DESC LIMIT 1')[0][0]
    page.locator('.order').first.click()
    page.wait_for_selector('.sheet .cbline')
    check('the order sheet: cashback on its way', f'{fa(want)} تومان اعتبار برگشتی' in page.inner_text('.sheet .cbline')
          and 'بعد از تحویل' in page.inner_text('.sheet .cbline'))
    page.keyboard.press('Escape')
    adm('order_status', code=code1, status='delivered')

    print('\nthe credit, after delivery')
    page.reload()
    page.wait_for_selector('#boot', state='detached', timeout=15000)
    go('#/profile', 1200)
    box = page.inner_text('.credit-box')
    check(f'the profile shows {fa(want)} TIFFANY credit', f'{fa(want)} تومان' in box and 'اعتبار تیفانی' in box, box)
    page.screenshot(path=f'{SHOTS}/04-profile-credit.png')
    add('mohair-trousers', 'M')
    go('#/bag')
    sw = page.locator('[data-credit]')
    check('the bag has the switch, on', sw.count() == 1 and sw.get_attribute('aria-checked') == 'true')
    tot = page.inner_text('.totals')
    check('the credit comes off: 9,990,000 − credit', f'−{fa(want)} تومان' in tot and fa(9990000 - want) in tot
          and 'مبلغ قابل پرداخت' in tot, tot)
    check('the checkout button says what is left to pay', fa(9990000 - want) in page.inner_text('[data-act="checkout"]'))
    page.screenshot(path=f'{SHOTS}/05-bag-credit.png')
    sw.click()
    page.wait_for_timeout(500)
    tot = page.inner_text('.totals')
    check('switched off: the full price again', '−' not in tot and fa(9990000) in tot
          and page.locator('[data-credit]').get_attribute('aria-checked') == 'false', tot)
    page.locator('[data-credit]').click()
    page.wait_for_timeout(400)
    page.locator('[data-act="checkout"]').click()
    page.wait_for_selector('#coForm')
    check('checkout carries the credit', f'−{fa(want)}' in page.inner_text('.sheet .totals'))
    # A phone whose balance is out of date (spent on another phone, a return):
    # the request says what it showed; here it is made to show 1 toman less.
    before = db('SELECT COUNT(*) FROM orders')[0][0]

    def stale(route):
        body = json.loads(route.request.post_data)
        body['expect_balance'] = body['expect_balance'] - 1
        route.continue_(post_data=json.dumps(body, ensure_ascii=False))
    page.route('**/api/order.php', stale)
    page.locator('#coForm [type="submit"]').click()
    page.wait_for_function("[...document.querySelectorAll('.toast')].some(t => t.innerText.includes('اعتبار حسابت همین الان تغییر کرده'))",
                           timeout=10000)
    page.wait_for_timeout(900)
    page.unroute('**/api/order.php')
    # (the refused request is the one 422 the browser logs here)
    errors[:] = [e for e in errors if 'status of 422' not in e]
    check('a balance that moved is refused: told so, the sheet closes, nothing ordered, the bag is kept',
          page.locator('#coForm').count() == 0 and db('SELECT COUNT(*) FROM orders')[0][0] == before
          and page.evaluate('location.hash') == '#/bag' and fa(9990000 - want) in page.inner_text('.totals'))
    page.locator('[data-act="checkout"]').click()
    page.wait_for_selector('#coForm')
    page.locator('#coForm [type="submit"]').click()
    page.wait_for_function("location.hash === '#/orders'", timeout=10000)
    page.wait_for_timeout(900)
    row = db('SELECT credit, total, cashback FROM orders ORDER BY id DESC LIMIT 1')[0]
    check('the server spent exactly that credit', row == (want, 9990000 - want, (9990000 - want) * 6 // 100), str(row))
    page.locator('.order').first.click()
    page.wait_for_selector('.sheet .totals')
    check('the order sheet shows the credit line', f'−{fa(want)}' in page.inner_text('.sheet .totals'))
    page.screenshot(path=f'{SHOTS}/06-order-credit.png')
    page.keyboard.press('Escape')
    go('#/profile', 1000)
    check('the profile: nothing left to spend, the new cashback on its way', page.inner_text('.credit-amt').strip() == f'{fa(0)} تومان'
          and fa((9990000 - want) * 6 // 100) in page.inner_text('.credit-pending'), page.inner_text('.credit-box'))

    print('\nterms and the QR address')
    go('#/terms', 900)
    sec = page.inner_text('#cashback')
    check('the terms: the rule with the shop\'s numbers', '۶٪' in sec and fa(5000000) in sec and 'بعد از تحویل' in sec, sec[:200])
    page.goto(BASE + '/join')
    page.wait_for_timeout(1800)
    check('tiffanybv.com/join while signed in: the account sheet over the profile', page.evaluate('location.hash') == '#/profile'
          and page.locator('.sheet-root.open #acOut').count() == 1, page.url)
    ctx2 = browser.new_context(**PHONE)
    ctx2.add_init_script(QUIET)
    p2 = ctx2.new_page()
    p2.on('pageerror', lambda e: errors.append(str(e)))
    p2.goto(BASE + '/join')
    p2.wait_for_selector('.sheet-root.open .auth-tabs', timeout=8000)
    check('…and for a new visitor: the create-account sheet', p2.inner_text('.auth-tabs [aria-selected="true"]').strip() == 'ساخت حساب'
          and p2.evaluate('location.pathname + location.hash') == '/#/profile')
    p2.screenshot(path=f'{SHOTS}/07-join.png')
    ctx2.close()

    print('\nEnglish and dark')
    ctx3 = browser.new_context(**PHONE, color_scheme='dark')
    ctx3.add_init_script(QUIET + "try{sessionStorage.setItem('tiffany.lang','en')}catch(e){}")
    p3 = ctx3.new_page()
    p3.on('pageerror', lambda e: errors.append(str(e)))
    p3.goto(BASE + '/#/p/waxed-trench')
    p3.wait_for_selector('#boot', state='detached', timeout=15000)
    p3.locator('#pdpSizes [data-size="M"]').click()
    p3.locator('.buybar [data-act="add"]').click()
    p3.wait_for_timeout(500)
    p3.evaluate("location.hash = '#/bag'")
    p3.wait_for_timeout(800)
    n = p3.inner_text('.cbnote')
    check('English: the note reads in English', 'cashback' in n and not re.search(r'[؀-ۿ]', n), n)
    p3.screenshot(path=f'{SHOTS}/08-bag-en-dark.png')
    ctx3.close()

    check('no script errors', not errors, str(errors[:3]))
    browser.close()

print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
