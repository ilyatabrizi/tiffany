"""Card-to-card («تأیید شد») in a real browser: checkout, the payment page,
the way back, the Orders tab, and the panel.

    TZ_MOCK_STATE=/tmp/tz.json php -S 127.0.0.1:8141 tests/tayidshod_mock.php
    TIFFANY_TZ_BASE=http://127.0.0.1:8141 TIFFANY_DATA=/tmp/tf-pe php -S localhost:8143 -t .
    TIFFANY_DATA=/tmp/tf-pe python3 pay_e2e.py http://localhost:8143 http://127.0.0.1:8141

The data folder needs catalog-import.json (the real catalogue)."""
import json
import os
import re
import sqlite3
import sys

import requests
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8143').rstrip('/')
TZ = sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:8141'
DATA = os.environ['TIFFANY_DATA']
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
PHONE = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
QUIET = ("try{localStorage.setItem('tiffany.a2hs','{\"done\":true}');"
         "sessionStorage.setItem('tiffany.consent.later','later')}catch(e){}")
SHOTS = os.environ.get('SHOTS', '/tmp/pay-shots')
os.makedirs(SHOTS, exist_ok=True)
LIVE = 'sk_live_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6'
SECRET = 'whsec_' + 'Qq11Ww22Ee33Rr44Tt55Yy66Uu77Ii88'
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
    con = sqlite3.connect(os.path.join(DATA, 'tiffany.sqlite'), timeout=20)
    try:
        rows = con.execute(q, a).fetchall()
        con.commit()
        return rows
    finally:
        con.close()


def shot(page, name, full=False):
    page.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)


def ready(page):
    page.wait_for_selector('#boot', state='detached', timeout=15000)


def hook(oid, event):
    return requests.post(f'{TZ}/mock/hook', json={'id': oid, 'event': event, 'secret': SECRET}).json()


def overflow(page):
    return page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')


requests.get(BASE + '/api/catalog.php')
panel = requests.Session()
csrf = {'v': ''}


def adm(a, **kw):
    r = panel.post(BASE + '/api/admin.php', json={'a': a, **kw}, headers={'X-CSRF': csrf['v']}).json()
    csrf['v'] = r.get('csrf') or csrf['v']
    return r


adm('state')
key = re.search(r'[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}', open(os.path.join(DATA, 'SETUP-KEY.txt')).read()).group(0)
assert adm('setup', key=key, name='آمیر وندا', email='ceo@tiffany.test', password='ceo-pass-123')['ok']
adm('settings_save', store_open=True)
BAG = json.dumps({'bag': [{'id': 'oiled-leather-jacket', 'size': 'M', 'colour': '#111111', 'qty': 1},
                          {'id': 'cotton-cap', 'size': 'OS', 'colour': '#C2185B', 'qty': 2}],
                  'profile': {'name': 'سارا محمدی', 'phone': '09121112233', 'email': ''},
                  'address': {'line': 'خیابان ولیعصر، کوچه‌ی ۳، پلاک ۱۲', 'city': 'تهران', 'province': 'تهران',
                              'postal': '1966914111'}},
                 ensure_ascii=False)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME)

    def phone():
        ctx = browser.new_context(**PHONE)
        ctx.add_init_script(QUIET)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        return ctx, page

    print('\nswitched off: checkout as before')
    ctx, page = phone()
    page.goto(BASE + '/#/')
    page.evaluate(f"localStorage.setItem('tiffany.v1', {json.dumps(BAG)})")
    page.goto(BASE + '/#/bag')
    page.reload()
    ready(page)
    page.click('[data-act="checkout"]')
    page.wait_for_selector('#coForm')
    check('card on delivery only, «online soon» still greyed', page.locator('[data-pay="c2c"]').count() == 0
          and page.locator('[data-pay="card"].on').count() == 1 and page.locator('#coPay .chip[disabled]').count() == 1)
    ctx.close()

    print('\nswitched on')
    assert adm('pay_save', key=LIVE, secret=SECRET)['pay']['account']['ok']
    assert adm('settings_save', tz_on=True)['pay']['on']
    ctx, page = phone()
    page.goto(BASE + '/#/')
    page.evaluate(f"localStorage.setItem('tiffany.v1', {json.dumps(BAG)})")
    page.goto(BASE + '/#/bag')
    page.reload()
    ready(page)
    page.click('[data-act="checkout"]')
    page.wait_for_selector('#coForm')
    check('card-to-card is offered, chosen first', page.locator('[data-pay="c2c"].on').count() == 1
          and page.locator('[data-pay="card"]').count() == 1 and page.locator('#coPay .chip[disabled]').count() == 0)
    check('…the text says what happens next', 'تأیید شد' in page.inner_text('#coLede')
          and page.inner_text('#coForm [type=submit]') == 'ثبت سفارش و پرداخت')
    check('…nothing wider than the phone', overflow(page) <= 0)
    page.locator('#coPay').scroll_into_view_if_needed()
    shot(page, '01-checkout-c2c')
    page.click('[data-pay="card"]')
    check('picking card on delivery changes the words', 'موقع تحویل' in page.inner_text('#coLede')
          and page.inner_text('#coForm [type=submit]') == 'ثبت سفارش' and page.get_attribute('[data-pay="card"]', 'aria-checked') == 'true')
    page.click('[data-pay="c2c"]')
    with page.expect_navigation(url=re.compile(r'^' + re.escape(TZ) + r'/p/ord_'), timeout=15000):
        page.click('#coForm [type=submit]')
    check('placing the order goes to the payment page', page.url.startswith(TZ + '/p/'))
    code, oid, pay_amount = sql("SELECT code, pay_ref, pay_amount FROM orders WHERE pay = 'c2c' ORDER BY id DESC LIMIT 1")[0]
    check('…for this order\'s unique amount', str(pay_amount) in page.inner_text('h1'), page.inner_text('h1'))
    shot(page, '02-tayidshod')

    print('\nthe customer says they paid, and comes back')
    requests.post(f'{TZ}/mock/set', json={'id': oid, 'status': 'claimed'})
    check('claimed webhook lands', hook(oid, 'order.claimed')['status'] == 200)
    page.click('#back')
    page.wait_for_selector('.sheet .paybox', timeout=15000)
    ready(page)
    page.wait_for_timeout(500)
    check('back in the shop, on Orders', page.url.endswith('#/orders'), page.url)
    check('…the key is gone from the address bar', '&k=' not in page.url)
    txt = page.inner_text('.sheet')
    check('…the order opens with its payment: being checked', 'پرداخت در حال بررسی' in txt and code in txt, txt[:200])
    check('…and the button back to the page', page.locator('.paybox a.btn').count() == 1)
    shot(page, '03-back-claimed')
    page.keyboard.press('Escape')
    page.wait_for_timeout(400)
    check('the order card says the same', 'پرداخت در حال بررسی' in page.inner_text('.order'))
    shot(page, '04-orders-list')

    print('\nTIFFANY taps «رسید»')
    requests.post(f'{TZ}/mock/set', json={'id': oid, 'status': 'paid', 'deposit': {'amount': pay_amount}})
    check('paid webhook lands', hook(oid, 'order.paid')['body']['result'] == 'paid')
    page.reload()
    ready(page)
    page.wait_for_function("!document.querySelector('.order .status').textContent.includes('بررسی')", timeout=10000)
    check('the order card moves on to its stage', 'ثبت شد' in page.inner_text('.order .status'), page.inner_text('.order .status'))
    page.click('.order')
    page.wait_for_selector('.sheet .paybox')
    check('…and its sheet says paid, no button', 'پرداخت شد' in page.inner_text('.paybox') and page.locator('.paybox a.btn').count() == 0)
    shot(page, '05-paid')
    ctx.close()

    print('\npaid in another browser (Instagram\'s), back in this one')
    ctx, page = phone()
    k = re.search(r'k=([a-f0-9]{24})', requests.get(f'{BASE}/api/pay.php', params={'a': 'back', 'o': code, 'k': 'x'},
                                                     allow_redirects=False).headers.get('Location', '') or '')
    check('a wrong key lands on Orders with nothing', k is None)
    ret = [x for x in requests.get(f'{TZ}/mock/log').json() if x['path'] == '/api/v1/orders' and x['method'] == 'POST'][-1]['body']['return_url']
    page.goto(ret)
    page.wait_for_selector('.sheet .paybox', timeout=15000)
    check('the order is added to this phone, paid', 'پرداخت شد' in page.inner_text('.paybox') and code in page.inner_text('.sheet'))
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    check('…with its pieces', page.locator('.order-thumbs img').count() == 2)
    ctx.close()

    print('\nthe panel')
    dt = browser.new_context(viewport={'width': 1280, 'height': 860})
    pp = dt.new_page()
    pp.on('pageerror', lambda e: errors.append('panel: ' + str(e)))
    pp.goto(BASE + '/admin/')
    pp.wait_for_selector('#f-email')
    pp.fill('#f-email', 'ceo@tiffany.test')
    pp.fill('#f-password', 'ceo-pass-123')
    pp.click('button[type=submit]')
    pp.wait_for_selector('#main .greet')
    pp.goto(BASE + '/admin/#/settings')
    pp.wait_for_selector('#payCardBox')
    t = pp.inner_text('#payCardBox')
    check('settings: the card-to-card card, on, live, connected', 'روشنه' in t and 'کلید اصلی' in t and 'وصله به' in t, t[:300])
    check('…only the last four of the key', LIVE[-4:] in pp.get_attribute('#f-key', 'placeholder') and LIVE not in pp.content())
    check('…the secret never in the page', SECRET not in pp.content())
    shot(pp, '06-panel-settings', full=True)
    pp.click('#payTest')
    pp.wait_for_timeout(800)
    check('«بررسی اتصال» works', 'وصله به' in pp.inner_text('#payCardBox'))
    pp.goto(BASE + '/admin/#/orders')
    pp.wait_for_selector('#olist')
    check('the order list shows the payment', 'پرداخت شد' in pp.inner_text('#olist'))
    pp.click(f'[data-code="{code}"]')
    pp.wait_for_selector('.paynote')
    t = pp.inner_text('.sheet') if pp.locator('.sheet').count() else pp.inner_text('body')
    check('the order sheet: paid, the exact amount, tayidshod id', 'پرداخت شد' in t and oid in t, t[:400])
    pp.wait_for_timeout(700)
    pp.locator('.paynote').scroll_into_view_if_needed()
    shot(pp, '07-panel-order')
    dt.close()

    print('\nan admin (not CEO) on a phone')
    adm('team_save', name='ادمین', email='adm@tiffany.test', role='admin', password='adm-pass-123', active=True)
    mob = browser.new_context(**PHONE)
    mp = mob.new_page()
    mp.on('pageerror', lambda e: errors.append('panel phone: ' + str(e)))
    mp.goto(BASE + '/admin/')
    mp.wait_for_selector('#f-email')
    mp.fill('#f-email', 'adm@tiffany.test')
    mp.fill('#f-password', 'adm-pass-123')
    mp.click('button[type=submit]')
    mp.wait_for_selector('#main .greet')
    mp.goto(BASE + '/admin/#/settings')
    mp.wait_for_selector('#bye')
    check('no payment keys for an admin', mp.locator('#payCardBox').count() == 0)
    mp.goto(BASE + '/admin/#/orders')
    mp.wait_for_selector('#olist')
    check('the order list fits a phone', overflow(mp) <= 0)
    shot(mp, '08-panel-phone-orders')
    mob.close()

check('no script errors', not errors, str(errors[:5]))
print(f'\n{ok} ok, {bad} failed')
sys.exit(1 if bad else 0)
