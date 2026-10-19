"""Card-to-card through «تأیید شد» — through HTTP, against a tayidshod stand-in.

    TZ_MOCK_STATE=/tmp/tz.json php -S 127.0.0.1:8141 tests/tayidshod_mock.php
    TIFFANY_TZ_BASE=http://127.0.0.1:8141 TIFFANY_DATA=/tmp/tf-pay php -S 127.0.0.1:8140 -t .
    TIFFANY_DATA=/tmp/tf-pay python3 pay_test.py http://127.0.0.1:8140 http://127.0.0.1:8141

A FRESH data folder: the CEO account is made with the setup key read from it."""
import json
import os
import re
import sqlite3
import sys
from urllib.parse import urlparse, parse_qs

import requests

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8140'
TZ = sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:8141'
DATA = os.environ['TIFFANY_DATA']
ok = bad = 0
LIVE = 'sk_live_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6'
TEST = 'sk_test_' + 'Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4'
SECRET = 'whsec_' + 'Qq11Ww22Ee33Rr44Tt55Yy66Uu77Ii88'


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


def mock(path, **kw):
    return requests.post(f'{TZ}/mock/{path}', json=kw).json()


def hook(oid, event, secret=SECRET, **kw):
    return mock('hook', id=oid, event=event, secret=secret, **kw)


class Panel:
    def __init__(self):
        self.s = requests.Session()
        self.csrf = ''

    def __call__(self, a, **kw):
        r = self.s.post(f'{BASE}/api/admin.php', json={'a': a, **kw}, headers={'X-CSRF': self.csrf})
        try:
            body = r.json()
        except ValueError:
            body = {'raw': r.text[:200]}
        if body.get('csrf'):
            self.csrf = body['csrf']
        return r.status_code, body


ORDER = {'items': [{'id': 'alphabet-tee', 'size': 'M', 'colour': '#A9C9E8', 'qty': 1}],
         'name': 'سارا محمدی', 'phone': '09121112233', 'city': 'تهران',
         'address': 'خیابان ولیعصر، کوچه‌ی ۳، پلاک ۱۲'}
phones = iter(f'0912{n:07d}' for n in range(1000001, 1000999))


def place(sess=None, pay='c2c', **kw):
    db("DELETE FROM attempts WHERE k LIKE 'order:%'")    # this suite places more than one address may in an hour
    s = sess or requests.Session()
    r = s.post(f'{BASE}/api/order.php', json={**ORDER, 'phone': next(phones), 'pay': pay, **kw})
    try:
        return r.status_code, r.json()
    except ValueError:
        return r.status_code, {'raw': r.text[:300]}


def ref(code):
    return db('SELECT pay_ref FROM orders WHERE code = ?', code)[0][0]


def state(code):
    return db('SELECT pay_state, paid FROM orders WHERE code = ?', code)[0]


def pay_get(a, code, key, follow=False):
    return requests.get(f'{BASE}/api/pay.php', params={'a': a, 'o': code, 'k': key}, allow_redirects=follow)


print('\nbefore anything is set')
ceo = Panel()
ceo('state')
k = re.search(r'[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}', open(f'{DATA}/SETUP-KEY.txt').read()).group(0)
code, _ = ceo('setup', key=k, name='مدیر تست', email='ceo@tiffany.test', password='ceo-pass-123')
check('CEO account made', code == 200)
code, r = ceo('settings_save', store_open=True)
check('store open', r['settings']['store_open'] is True)
check('database is on version 5', db('PRAGMA user_version')[0][0] == 5)
cols = {c[1] for c in db('PRAGMA table_info(orders)')}
check('orders carry the payment columns', {'pay_state', 'pay_ref', 'pay_amount', 'pay_url', 'pay_mode', 'paid', 'paid_at'} <= cols)
r = requests.get(f'{BASE}/api/pay.php?a=state').json()
check('checkout offers no card-to-card yet', r == {'ok': True, 'c2c': False, 'test': False}, str(r))
code, r = place()
check('a card-to-card order is refused while it is off', code == 422 and r.get('field') == 'pay', str(r))
r = requests.post(f'{BASE}/api/pay-hook.php', data='{"event":"ping"}', headers={'Content-Type': 'application/json'})
check('webhook answers 503 until the secret is set', r.status_code == 503, r.text)
code, r = ceo('settings')
check('settings show the payment card, empty', r['pay']['mode'] == '' and r['pay']['key_tail'] == '' and r['pay']['on'] is False, str(r.get('pay')))
code, r = ceo('settings_save', tz_on=True)
check('cannot switch it on without key and secret', code == 422 and r.get('field') == 'tz_on')

print('\nthe CEO pastes the keys')
code, r = ceo('pay_save', key='pk_live_nope')
check('a wrong-looking key is refused', code == 422 and r.get('field') == 'key')
code, r = ceo('pay_save', secret='secret-123')
check('a wrong-looking secret is refused', code == 422 and r.get('field') == 'secret')
code, r = ceo('pay_save', key=TEST, secret=SECRET)
check('test key and secret saved', code == 200 and r['pay']['mode'] == 'test' and r['pay']['key_tail'] == TEST[-4:]
      and r['pay']['secret_tail'] == SECRET[-4:], str(r))
check('the connection is checked at once', (r['pay'].get('account') or {}).get('ok') is True
      and r['pay']['account']['shop'] == 'تیفانی (آزمایشی)', str(r['pay'].get('account')))
check('the key never comes back', TEST not in json.dumps(r) and SECRET not in json.dumps(r))
check('…nor in the settings page', TEST not in json.dumps(ceo('settings')[1]))
code, r = ceo('settings_save', tz_on=True)
check('switched on', code == 200 and r['pay']['on'] is True)
adm = Panel()
ceo('team_save', name='ادمین', email='adm@tiffany.test', role='admin', password='adm-pass-123', active=True)
adm('login', email='adm@tiffany.test', password='adm-pass-123')
check('an admin cannot touch the keys', adm('pay_save', key=LIVE)[0] == 403 and adm('pay_check')[0] == 403)
check('…nor see them in settings', 'pay' not in adm('settings')[1])

print('\ntest key: staff only')
r = requests.get(f'{BASE}/api/pay.php?a=state').json()
check('a customer does not see a test key', r['c2c'] is False, str(r))
code, r = place()
check('…and cannot order with it', code == 422 and r.get('field') == 'pay')
r = ceo.s.get(f'{BASE}/api/pay.php?a=state').json()
check('signed-in staff see it, marked test', r == {'ok': True, 'c2c': True, 'test': True}, str(r))
code, t = place(ceo.s)
check('staff test order gets a payment page', code == 200 and t.get('pay') == 'c2c' and t.get('pay_url', '').startswith(TZ + '/p/'), str(t))
check('…kept as a test payment', db('SELECT pay_mode FROM orders WHERE code = ?', t['code'])[0][0] == 'test')

print('\nlive key: everyone')
code, r = ceo('pay_save', key=LIVE)
check('live key saved', r['pay']['mode'] == 'live' and r['pay']['key_tail'] == LIVE[-4:])
r = requests.get(f'{BASE}/api/pay.php?a=state').json()
check('customers see card-to-card', r == {'ok': True, 'c2c': True, 'test': False}, str(r))
shop = requests.Session()
code, a = place(shop)
check('order placed with card-to-card', code == 200 and a['pay'] == 'c2c' and re.fullmatch(r'[a-f0-9]{24}', a.get('pay_key', '')), str(a))
sent = [x for x in requests.get(f'{TZ}/mock/log').json() if x['path'] == '/api/v1/orders' and x['method'] == 'POST'][-1]
b = sent['body']
check('tayidshod is asked for the server\'s total', b['amount'] == a['total'] == 1680000, str(b))
check('…with the order code as order_id', b['order_id'] == a['code'])
check('…the webhook and return links of this shop', b['callback_url'] == f'{BASE}/api/pay-hook.php'
      and b['return_url'] == f'{BASE}/api/pay.php?a=back&o={a["code"]}&k={a["pay_key"]}', str(b))
check('…the customer\'s name and mobile, 30 minutes', b['customer']['mobile'].startswith('0912') and b['expires_in'] == 30)
check('…with the live key in the header only', sent['auth'] == 'Bearer ' + LIVE)
code, r = ceo('order', code=a['code'])
o = r['order']
check('panel: card-to-card, pending, unique amount', o['pay'] == 'c2c' and o['pay_state'] == 'pending' and o['paid'] is False
      and a['total'] + 11 <= o['pay_amount'] <= a['total'] + 999 and o['pay_mode'] == 'live' and o['pay_ref'].startswith('ord_'), str(o))
rid = ref(a['code'])

print('\nwebhook signatures')
check('no signature: 401', hook(rid, 'order.paid', sig='')['status'] == 401)
check('wrong secret: 401', hook(rid, 'order.paid', secret='whsec_' + 'wrong' * 4)['status'] == 401)
check('a body changed after signing: 401', hook(rid, 'order.paid', sig='sha256=' + '0' * 64)['status'] == 401)
check('…and nothing moved', state(a['code']) == ('pending', 0))
r = hook('', 'ping', to=f'{BASE}/api/pay-hook.php')
check('ping answers pong', r['status'] == 200 and r['body']['result'] == 'pong', str(r))
check('…and the panel sees it arrived', ceo('settings')[1]['pay']['ping'] > 0)
r = hook('ord_unknown123', 'order.paid', to=f'{BASE}/api/pay-hook.php')
check('an order we do not know: 200, nothing done', r['status'] == 200 and r['body']['result'] == 'unknown order', str(r))

print('\nthe payment walks')
mock('set', id=rid, status='claimed')
r = hook(rid, 'order.claimed')
check('claimed', r['status'] == 200 and state(a['code']) == ('claimed', 0), str(r))
tr = requests.post(f'{BASE}/api/track.php', json={'phone': o['phone'], 'codes': [a['code']]}).json()
check('tracking shows the payment', tr['orders'][a['code']]['pay_state'] == 'claimed' and tr['orders'][a['code']]['paid'] is False, str(tr))
mock('set', id=rid, status='paid', deposit={'amount': o['pay_amount']})
r = hook(rid, 'order.paid')
check('paid', r['body']['result'] == 'paid' and state(a['code']) == ('paid', 1), str(r))
check('…with the time', db('SELECT paid_at FROM orders WHERE code = ?', a['code'])[0][0] > 0)
r = hook(rid, 'order.paid')
check('the same webhook again changes nothing', r['body']['result'] == 'already paid')
r = hook(rid, 'order.expired')
check('a paid order never goes back', state(a['code']) == ('paid', 1), str(r))
code, r = ceo('log')
check('the team log says it was paid', any(l['action'] == 'order_paid' and a['code'] in l['detail'] for l in r['log']))
tr = requests.post(f'{BASE}/api/track.php', json={'phone': o['phone'], 'codes': [a['code']]}).json()
check('tracking: paid', tr['orders'][a['code']]['paid'] is True)

print('\nmoney that does not add up')
code, b2 = place()
mock('set', id=ref(b2['code']), status='paid', mode='test')
check('paid in test mode for a live order: odd, not paid', hook(ref(b2['code']), 'order.paid')['body']['result'] == 'mode mismatch'
      and state(b2['code']) == ('odd', 0))
code, b3 = place()
r3 = ref(b3['code'])
mock('set', id=r3, status='paid', pay_amount=1680001)
check('another amount: odd', hook(r3, 'order.paid')['body']['result'] == 'amount mismatch' and state(b3['code']) == ('odd', 0))
code, b4 = place()
r4 = ref(b4['code'])
mock('set', id=r4, status='paid', deposit={'amount': 1000000})
check('a smaller deposit confirmed: short, not paid', hook(r4, 'order.paid')['body']['result'] == 'short deposit'
      and state(b4['code']) == ('short', 0))

print('\nthe customer comes back')
code, c = place()
rc = ref(c['code'])
mock('set', id=rc, status='rejected')
hook(rc, 'order.rejected')
r = pay_get('status', c['code'], c['pay_key'])
j = r.json()
check('status with the token', r.status_code == 200 and j['order']['pay_state'] == 'rejected' and j['order']['page'] is True, r.text[:200])
check('…carries what the phone needs to show it', j['order']['total'] == c['total'] and j['order']['items'][0]['id'] == 'alphabet-tee'
      and 'pay_url' not in j['order'] and 'pay_ref' not in j['order'])
check('a wrong token: 404', pay_get('status', c['code'], '0' * 24).status_code == 404)
check('another order\'s token: 404', pay_get('status', c['code'], a['pay_key']).status_code == 404)
check('nonsense: 404', pay_get('status', "TF-1' OR 1=1", c['pay_key']).status_code == 404)
r = pay_get('go', c['code'], c['pay_key'])
check('«pay» goes to the payment page while it has a use', r.status_code == 302 and r.headers['Location'].startswith(TZ + '/p/'), r.headers.get('Location'))
r = pay_get('back', c['code'], c['pay_key'])
loc = r.headers.get('Location', '')
check('«back to shop» lands on the Orders tab with the answer', r.status_code == 302 and loc == f'/#/orders?pay={c["code"]}&k={c["pay_key"]}', loc)
check('a bad link still lands in the shop, with nothing', pay_get('back', c['code'], 'x').headers.get('Location') == '/#/orders')
r = pay_get('go', a['code'], a['pay_key'])
check('a paid order has no payment page any more', r.status_code == 302 and r.headers['Location'].startswith('/#/orders?pay='))

print('\na late webhook')
code, d = place()
rd = ref(d['code'])
mock('set', id=rd, status='paid', deposit=None)
j = pay_get('status', d['code'], d['pay_key']).json()
check('the return check asks tayidshod and finds it paid', j['order']['paid'] is True and state(d['code']) == ('paid', 1), str(j))
code, e = place()
re_ = ref(e['code'])
mock('set', id=re_, status='claimed')
code, r = adm('order_pay_check', code=e['code'])
check('the panel can ask too (any staff)', code == 200 and r['order']['pay_state'] == 'claimed', str(r))
check('…only for card-to-card orders', adm('order_pay_check', code=place(pay='card')[1]['code'])[0] == 422)

print('\ncancelled in the panel')
code, f = place()
rf = ref(f['code'])
code, r = ceo('product', id='alphabet-tee')
before = r['product'].get('stock')
code, r = ceo('order_status', code=f['code'], status='cancelled')
check('cancelled', code == 200 and r['order']['status'] == 'cancelled')
import time
for _ in range(20):
    if state(f['code'])[0] == 'canceled':
        break
    time.sleep(0.2)
calls = [x for x in requests.get(f'{TZ}/mock/log').json() if x['path'] == f'/api/v1/orders/{rf}/cancel']
check('…its payment page is closed at tayidshod', len(calls) == 1 and state(f['code']) == ('canceled', 0), str(state(f['code'])))
check('…and it has no payment page for the customer', pay_get('status', f['code'], f['pay_key']).json()['order']['page'] is False)

print('\nwhen tayidshod says no')
mock('next', fail='cards_full', http=409)
code, g = place()
check('the order is still placed, paid on delivery', code == 200 and g['pay'] == 'card' and g.get('pay_note') == 'fallback'
      and 'pay_url' not in g, str(g))
row = db('SELECT pay, pay_state, admin_note FROM orders WHERE code = ?', g['code'])[0]
check('…the team sees why', row[0] == 'card' and row[1] == 'failed' and 'cards_full' in row[2], str(row))
r = requests.get(f'{BASE}/api/pay.php?a=state').json()
check('…and card-to-card rests for a while (cards full)', r['c2c'] is False)
check('…which the panel shows', ceo('settings')[1]['pay']['paused_until'] > 0)
ceo('pay_save', key=LIVE)
check('saving the key again lifts the rest', requests.get(f'{BASE}/api/pay.php?a=state').json()['c2c'] is True)
mock('next', pay_amount_delta=-2000)
code, h = place()
check('a payment amount below the total is never sent to the customer', h['pay'] == 'card' and state(h['code'])[0] == 'failed', str(h))
mock('next', pay_url='https://evil.example/p/ord_x')
code, h = place()
check('a payment page on another site is never sent to the customer', h['pay'] == 'card', str(h))
mock('next', mode='test')
code, h = place()
check('a test payment for a live key is never sent', h['pay'] == 'card', str(h))
mock('next', fail='no_card', http=422)
code, h = place()
check('any other refusal: paid on delivery too', h['pay'] == 'card')
r = requests.get(f'{BASE}/api/pay.php?a=state').json()
check('…without resting card-to-card', r['c2c'] is True)

print('\nthe account closes live orders')
ceo('pay_save', key=LIVE)
mock('next', closed='اشتراک فعال نیست')
code, r = ceo('pay_check')
check('the check reports it', r['pay']['account']['open'] is False and r['pay']['account']['reason'] == 'اشتراک فعال نیست', str(r['pay']))
check('…and the checkout stops offering it', requests.get(f'{BASE}/api/pay.php?a=state').json()['c2c'] is False)
mock('next')
ceo('pay_check')
check('open again after the next check', requests.get(f'{BASE}/api/pay.php?a=state').json()['c2c'] is True)
ceo('pay_save', key='sk_live_' + 'REVOKED' + 'a' * 22)   # built here so no scanner mistakes it for a real key
code, r = ceo('pay_check')
check('a revoked key: the check says unauthorized', r['pay']['account']['ok'] is False and r['pay']['account']['code'] == 'unauthorized', str(r['pay']))
check('…and nothing is offered', requests.get(f'{BASE}/api/pay.php?a=state').json()['c2c'] is False)
ceo('pay_save', key=LIVE)

print('\nthe secret changes')
code, i = place()
ri = ref(i['code'])
ceo('pay_save', secret='whsec_' + 'N3wN3wN3wN3wN3wN3wN3wN3w')
mock('set', id=ri, status='paid')
check('a webhook signed with the old secret is refused', hook(ri, 'order.paid')['status'] == 401 and state(i['code'])[1] == 0)
check('…the new one works', hook(ri, 'order.paid', secret='whsec_' + 'N3wN3wN3wN3wN3wN3wN3wN3w')['body']['result'] == 'paid')

print('\nswitched off')
ceo('settings_save', tz_on=False)
check('checkout stops offering it', requests.get(f'{BASE}/api/pay.php?a=state').json()['c2c'] is False)
check('…a card-to-card order is refused', place()[0] == 422)
check('…card on delivery still works', place(pay='card')[1].get('pay') == 'card')
check('…webhooks for orders already made still land', hook(ref(c['code']), 'order.expired',
      secret='whsec_' + 'N3wN3wN3wN3wN3wN3wN3wN3w')['body']['result'] == 'ok' and state(c['code'])[0] == 'expired')

print('\nlimits')
codes = [pay_get('status', c['code'], '1' * 24).status_code for _ in range(125)]
check('the payment links are rate-limited per address', 429 in codes)
bads = [hook(rid, 'order.paid', secret='whsec_' + 'bad' * 7)['status'] for _ in range(32)]
check('repeated bad signatures are shut out', bads[-1] == 429, str(bads[-3:]))

print(f'\n{ok} ok, {bad} failed')
sys.exit(1 if bad else 0)
