"""Cashback through HTTP: an order of the minimum or more, placed signed in,
earns a share of what is paid as credit; the credit is spendable once the
order is delivered and comes off the next order.

    SMS_MOCK_LOG=/tmp/sms.log php -S 127.0.0.1:8139 tests/sms_mock.php
    mkdir /tmp/tf-cb && cp catalog/real/catalog-import.json /tmp/tf-cb/
    TIFFANY_DATA=/tmp/tf-cb php -S 127.0.0.1:8136 -t .
    SMS_MOCK_LOG=/tmp/sms.log TIFFANY_DATA=/tmp/tf-cb python3 credit_test.py http://127.0.0.1:8136

A FRESH data folder with the real catalogue; the SMS stand-in on :8139."""
import concurrent.futures as cf
import json
import os
import re
import sqlite3
import sys

import requests

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8136').rstrip('/')
DATA = os.environ['TIFFANY_DATA']
MOCK = os.environ['SMS_MOCK_LOG']
OTP_TPL = 555001
ok = bad = 0


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
    try:
        lines = open(MOCK).read().splitlines()
    except FileNotFoundError:
        return None
    for x in reversed([json.loads(l) for l in lines]):
        if x['path'] == '/v1/send/verify' and x['body']['mobile'] == phone and x['body']['templateId'] == OTP_TPL:
            return x['body']['parameters'][0]['value']
    return None


class Panel:
    def __init__(self):
        self.s = requests.Session()
        self.csrf = ''

    def __call__(self, a, **kw):
        r = self.s.post(f'{BASE}/api/admin.php', json={'a': a, **kw}, headers={'X-CSRF': self.csrf})
        body = r.json() if r.headers.get('Content-Type', '').startswith('application/json') else {'raw': r.text[:200]}
        if body.get('csrf'):
            self.csrf = body['csrf']
        return r.status_code, body


class Shopper:
    """A phone: its own cookies; signed in once it joins."""

    def __init__(self, phone=None):
        self.s = requests.Session()
        self.csrf = ''
        self.phone = phone

    def acc(self, a, **kw):
        r = self.s.post(f'{BASE}/api/account.php', json={'a': a, **kw}, headers={'X-CSRF': self.csrf})
        body = r.json()
        if body.get('csrf'):
            self.csrf = body['csrf']
        return r.status_code, body

    def join(self, name):
        self.acc('otp', purpose='signup', phone=self.phone)
        return self.acc('signup', phone=self.phone, code=last_code(self.phone), name=name, password='tiffany-1')

    def credit(self):
        return self.acc('state')[1]['credit']

    def login(self):
        return self.acc('login', phone=self.phone, password='tiffany-1')

    def order(self, items, use_credit=False, csrf=True, pay='card', phone=None, expect=None):
        h = {'Content-Type': 'application/json'}
        if csrf and self.csrf:
            h['X-CSRF'] = self.csrf
        r = self.s.post(f'{BASE}/api/order.php', headers=h, data=json.dumps({
            'items': items, 'name': 'مشتری تست', 'phone': phone or self.phone or '09120000000',
            'province': 'آذربایجان شرقی', 'city': 'تبریز',
            'address': 'خیابان امام، کوچه‌ی ۵، پلاک ۸', 'postal': '5166615731', 'pay': pay, 'use_credit': use_credit,
            **({} if expect is None else {'expect_balance': expect})}))
        return r.status_code, r.json()


def fresh_tries():
    db("DELETE FROM attempts")


def set_price(pid, price):
    db("UPDATE products SET price = ?, data = json_set(data, '$.price', ?) WHERE id = ?", price, price, pid)


# ------------------------------------------------------------------ setup
requests.get(f'{BASE}/api/catalog.php')
ceo = Panel()
ceo('state')
k = re.search(r'[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}', open(f'{DATA}/SETUP-KEY.txt').read()).group(0)
assert ceo('setup', key=k, name='مدیر تست', email='ceo@tiffany.test', password='ceo-pass-123')[0] == 200
ceo('team_save', name='ادمین تست', email='admin@tiffany.test', role='admin', password='admin-pass-123')
adm = Panel()
adm('state')
adm('login', email='admin@tiffany.test', password='admin-pass-123')
with open(os.path.join(DATA, 'sms.json'), 'w') as fh:
    json.dump({'api_key': 'test-key', 'customer_template': 807432, 'owner_template': 307865,
               'owner_mobile': '09141012567', 'endpoint': 'http://127.0.0.1:8139/v1/'}, fh)
ceo('settings_save', sms_tpl_otp=str(OTP_TPL), store_open=True)
cat = {p['id']: p for p in requests.get(f'{BASE}/api/catalog.php').json()['products']}
set_price('red-bandana', 2500000)
set_price('canvas-cap', 2490000)
set_price('four-colour-bandana', 200000)


def line(pid, qty=1, size=None):
    p = cat[pid]
    return {'id': pid, 'size': size or p['sizes'][0], 'colour': p['colours'][0]['hex'], 'qty': qty}


def status(code, to, who=None):
    return (who or ceo)('order_status', code=code, status=to)


print('\nthe rule')
s = requests.get(f'{BASE}/api/catalog.php').json()['settings']
check('the shop is told: on, 6%, from 5,000,000 toman', s['cashback'] == {'on': True, 'pct': 6, 'min': 5000000}, str(s))
check('the database is on version 8, orders carry customer_id, credit and cashback',
      db('PRAGMA user_version')[0][0] == 8
      and {'customer_id', 'credit', 'cashback'} <= {c[1] for c in db('PRAGMA table_info(orders)')})

print('\nwithout an account')
guest = Shopper('09121230000')
code, r = guest.order([line('red-bandana', 2)])
check('a guest order of 5,000,000 is placed, but earns nothing (no account)',
      code == 200 and r['cashback'] == 0 and r['credit'] == 0 and r['balance'] is None, str(r)[:200])
code, r = guest.order([line('red-bandana')], use_credit=True)
check('a guest cannot ask to spend credit', code == 422 and r.get('field') == 'credit', str(r)[:200])
check('signed out, the account state carries no credit', guest.acc('state')[1]['credit'] is None)

print('\nsigned in: earning')
fresh_tries()
alice = Shopper('09121110001')
check('Alice makes an account', alice.join('آلیس')[0] == 200)
check('a new account starts with nothing', alice.credit() == {'balance': 0, 'pending': 0, 'orders': []}, str(alice.credit()))
code, r = alice.order([line('red-bandana'), line('canvas-cap')])
check('4,990,000 (just under): no cashback', code == 200 and r['total'] == 4990000 and r['cashback'] == 0, str(r)[:200])
a0 = r['code']
code, r = alice.order([line('red-bandana', 2)])
check('5,000,000 exactly: 300,000 cashback, nothing spent', code == 200 and r['total'] == 5000000
      and r['cashback'] == 300000 and r['credit'] == 0, str(r)[:200])
a1 = r['code']
check('…the answer carries the account: 0 to spend, 300,000 on the way',
      r['balance']['balance'] == 0 and r['balance']['pending'] == 300000, str(r.get('balance')))
check('…stored with the account on the order', db('SELECT customer_id, credit, cashback FROM orders WHERE code = ?', a1)[0]
      == (db("SELECT id FROM customers WHERE phone = '09121110001'")[0][0], 0, 300000))
for to in ['confirmed', 'shipped']:
    status(a1, to)
    check(f'«{to}»: still on the way', alice.credit()['balance'] == 0 and alice.credit()['pending'] == 300000)
code, r = status(a1, 'delivered')
check('delivered: 300,000 to spend', code == 200 and alice.credit()['balance'] == 300000 and alice.credit()['pending'] == 0,
      str(alice.credit()))
check('the panel shows the order\'s credit and cashback', r['order']['cashback'] == 300000 and r['order']['credit'] == 0
      and r['order']['customer_id'] > 0)

print('\nspending')
code, r = alice.order([line('red-bandana')], use_credit=True, csrf=False)
check('spending without the account\'s CSRF token: refused', code == 403 and r['error'] == 'csrf', str(r)[:200])
code, r = alice.order([line('waxed-trench', size='M')], use_credit=True)
want_cb = (34990000 - 300000) * 6 // 100
check('the credit comes off a 34,990,000 order: 34,690,000 to pay',
      code == 200 and r['credit'] == 300000 and r['total'] == 34690000 and r['subtotal'] == 34990000, str(r)[:200])
check(f'…cashback on what is paid, not on the credit ({want_cb:,})', r['cashback'] == want_cb, str(r['cashback']))
a2 = r['code']
check('…the balance is spent', alice.credit()['balance'] == 0 and alice.credit()['pending'] == want_cb, str(alice.credit()))
code, r = alice.order([line('red-bandana')], use_credit=True)
check('asking for credit with none left spends nothing', code == 200 and r['credit'] == 0 and r['total'] == 2500000, str(r)[:200])
status(r['code'], 'cancelled')
code, r = status(a2, 'cancelled')
check('cancelling an order the credit was spent on gives it back, and drops its cashback',
      code == 200 and alice.credit()['balance'] == 300000 and alice.credit()['pending'] == 0, str(alice.credit()))

print('\ncredit that covers everything')
code, r = alice.order([line('four-colour-bandana')], use_credit=True, pay='c2c')
check('200,000 of 300,000: nothing left to pay, paid by credit, no payment page', code == 200 and r['total'] == 0
      and r['credit'] == 200000 and r['pay'] == 'credit' and 'pay_url' not in r and r['cashback'] == 0, str(r)[:300])
check('…100,000 left', alice.credit()['balance'] == 100000)
code, r = ceo('order', code=r['code'])
check('…the panel sees it paid by credit', r['order']['pay'] == 'credit' and r['order']['total'] == 0)

print('\nthe balance the phone showed')
fresh_tries()
code, r = alice.order([line('red-bandana')], use_credit=True, expect=90000)
check('a balance that moved since the phone showed it is refused, and nothing is spent',
      code == 422 and r.get('field') == 'credit_changed' and alice.credit()['balance'] == 100000, f'{code} {r}')
code, r = alice.order([line('red-bandana')], use_credit=True, expect=100000)
check('…the balance the phone showed goes through', code == 200 and r['credit'] == 100000, str(r)[:200])
status(r['code'], 'cancelled')
check('…(cancelled: the 100,000 is back)', alice.credit()['balance'] == 100000)

print('\ntwo orders at the same moment, from two phones signed in to one account')
fresh_tries()
bob = Shopper('09121110002')
bob.join('باب')
code, r = bob.order([line('red-bandana', 2)])
status(r['code'], 'delivered')
check('Bob has 300,000', bob.credit()['balance'] == 300000)
bob2 = Shopper('09121110002')
code, r = bob2.login()
check('…and is signed in on a second phone (its own session)', code == 200 and bob2.credit()['balance'] == 300000, f'{code} {r}')
with cf.ThreadPoolExecutor(2) as ex:
    res = list(ex.map(lambda who: who.order([line('four-colour-bandana', 2)], use_credit=True), [bob, bob2]))
spent = sorted(x[1].get('credit', -1) for x in res)
check('the same credit is never spent twice', [x[0] for x in res] == [200, 200] and spent == [0, 300000], str(spent))
check('…and the balance is 0, not below', bob.credit()['balance'] == 0, str(bob.credit()))

print('\na return after the credit was spent')
fresh_tries()
carol = Shopper('09121110003')
carol.join('کارول')
code, r = carol.order([line('red-bandana', 2)])
c1 = r['code']
status(c1, 'delivered')
code, r = carol.order([line('red-bandana')], use_credit=True)
check('Carol spends her 300,000', r['credit'] == 300000 and carol.credit()['balance'] == 0)
code, r = status(c1, 'cancelled')
check('the first order comes back (returned): its cashback is taken back', code == 200)
check('…the shop never shows a negative balance', carol.credit()['balance'] == 0, str(carol.credit()))
code, r = adm('customer', phone='09121110003')
check('…the panel does (−300,000), for anyone in the team', code == 200 and r['account']['balance'] == -300000, str(r.get('account')))
code, r = carol.order([line('red-bandana', 2)])
status(r['code'], 'delivered')
check('her next 300,000 fills the hole first', carol.credit()['balance'] == 0)

print('\nthe settings')
code, r = adm('settings_save', cb_on=False)
check('only the CEO changes the cashback', code == 403)
for v in ['0', '51', '6.5', 'abc', '']:
    code, r = ceo('settings_save', cb_pct=v)
    check(f'a percentage of «{v}» is refused', code == 422 and r['field'] == 'cb_pct', str(r)[:120])
code, r = ceo('settings_save', cb_min='500')
check('a minimum under 1,000 toman is refused', code == 422 and r['field'] == 'cb_min')
code, r = ceo('settings_save', cb_pct='۱۰', cb_min='1,000,000')
check('10% from 1,000,000 (Persian digits and commas read)', code == 200
      and r['settings']['cashback'] == {'on': True, 'pct': 10, 'min': 1000000}, str(r.get('settings')))
code, r = alice.order([line('red-bandana')])
check('…a 2,500,000 order now earns 250,000', r['cashback'] == 250000, str(r)[:200])
status(r['code'], 'cancelled')
code, r = ceo('settings_save', cb_on=False)
check('switched off', code == 200 and r['settings']['cashback']['on'] is False)
code, r = alice.order([line('red-bandana', 2)], use_credit=True)
check('off: nothing new is earned, but the credit already there is still spent',
      r['cashback'] == 0 and r['credit'] == 100000 and r['total'] == 4900000, str(r)[:200])
status(r['code'], 'cancelled')
check('…and comes back when that order is cancelled', alice.credit()['balance'] == 100000)
code, r = ceo('settings_save', cb_pct='7', cb_min='5000000.00')
check('a decimal minimum is refused, and the percentage sent with it is not kept either',
      code == 422 and r.get('field') == 'cb_min'
      and requests.get(f'{BASE}/api/catalog.php').json()['settings']['cashback']['pct'] == 10, f'{code} {r}')
ceo('settings_save', cb_on=True, cb_pct='6', cb_min='5.000.000')
check('back to on, 6%, 5,000,000 (written 5.000.000)', requests.get(f'{BASE}/api/catalog.php').json()['settings']['cashback']
      == {'on': True, 'pct': 6, 'min': 5000000})
check('the panel log names the changes', {'cashback_on', 'cashback_off', 'cashback_pct', 'cashback_min'}
      <= {l['action'] for l in ceo('log')[1]['log']})

print('\nwhat the account sees')
c = alice.credit()
check('the account lists the orders behind its credit, newest first',
      [o['code'] for o in c['orders']][:1] != [] and all(set(o) == {'code', 'status', 'spent', 'cashback', 'at'} for o in c['orders'])
      and c['orders'] == sorted(c['orders'], key=lambda o: -o['at']), str(c['orders'][:2]))
check('an order that earned and spent nothing is not listed', a0 not in [o['code'] for o in c['orders']])
check('nothing went to error.log', not os.path.exists(os.path.join(DATA, 'error.log'))
      or not open(os.path.join(DATA, 'error.log')).read().strip(),
      open(os.path.join(DATA, 'error.log')).read()[-300:] if os.path.exists(os.path.join(DATA, 'error.log')) else '')

print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
