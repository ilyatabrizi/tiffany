"""Rush and traffic tests against a LOCAL copy of the shop (never the live host).

    PHP_CLI_SERVER_WORKERS=16 TIFFANY_DATA=/tmp/tf php -S 127.0.0.1:8140 -t .
    TIFFANY_DATA=/tmp/tf python3 load_test.py http://127.0.0.1:8140

Each simulated customer connects from its own loopback address (127.0.x.y),
so the server's per-address limits see many people, not one. What is checked
is correctness under pressure — no lost or doubled orders, stock that never
goes below zero, no server errors — plus latency and throughput figures for
this machine."""
import http.client
import json
import os
import random
import sqlite3
import statistics
import sys
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8140').rstrip('/')
U = urllib.parse.urlparse(BASE)
DATA = os.environ['TIFFANY_DATA']
ok = bad = 0
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari'


def check(name, cond, extra=''):
    global ok, bad
    ok, bad = (ok + 1, bad) if cond else (ok, bad + 1)
    print(('  ok   ' if cond else '  FAIL ') + name + (f'  [{extra}]' if extra else ''))


def sql(q, *a):
    con = sqlite3.connect(os.path.join(DATA, 'tiffany.sqlite'), timeout=30)
    try:
        rows = con.execute(q, a).fetchall()
        con.commit()
        return rows
    finally:
        con.close()


_ip = 0
_ip_lock = threading.Lock()


def next_ip():
    global _ip
    with _ip_lock:
        _ip += 1
        n = _ip
    return f'127.0.{1 + n // 250}.{1 + n % 250}'


def req(method, path, body=None, ip=None, headers=None):
    """One request from one address. Returns (status, seconds, bytes)."""
    h = {'User-Agent': UA, 'Host': U.netloc, **(headers or {})}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h['Content-Type'] = 'application/json'
    t0 = time.perf_counter()
    try:
        c = http.client.HTTPConnection(U.hostname, U.port, timeout=60,
                                       source_address=(ip or next_ip(), 0))
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        payload = r.read()
        c.close()
        return r.status, time.perf_counter() - t0, payload
    except Exception as e:                   # a dropped connection counts as an error
        return 0, time.perf_counter() - t0, str(e).encode()


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(len(xs) * p))] * 1000 if xs else 0


def summary(name, res, secs):
    lat = [r[1] for r in res]
    codes = {}
    for r in res:
        codes[r[0]] = codes.get(r[0], 0) + 1
    print(f'  {name}: {len(res)} requests in {secs:.1f}s = {len(res) / secs:.0f}/s · '
          f'p50 {pct(lat, .5):.0f} ms · p95 {pct(lat, .95):.0f} ms · p99 {pct(lat, .99):.0f} ms · {codes}')
    return codes


def order_body(pid, size, colour, phone, qty=1):
    return {'items': [{'id': pid, 'size': size, 'colour': colour, 'qty': qty}],
            'name': 'مشتری آزمایشی', 'phone': phone, 'city': 'تبریز',
            'address': 'خیابان امام، کوچه‌ی ۵، پلاک ۸', 'postal': ''}


req('GET', '/api/catalog.php')               # the server makes its database
sql("INSERT OR REPLACE INTO settings (k, v) VALUES ('store_open', '1')")

# ------------------------------------------------------------------ rush
print('\nrush: 300 people, 60 at a time, for the last 10 of one piece')
sql("""UPDATE products SET data = json_set(data, '$.stock', json('{"S":10,"M":0,"L":0}'))
       WHERE id = 'leather-jacket'""")
before = sql('SELECT COUNT(*) FROM orders')[0][0]
phones = [f'0912{i:07d}' for i in range(300)]
t0 = time.perf_counter()
with ThreadPoolExecutor(60) as ex:
    res = list(ex.map(lambda ph: req('POST', '/api/order.php', order_body('leather-jacket', 'S', '#111111', ph)), phones))
codes = summary('orders', res, time.perf_counter() - t0)
stock = json.loads(sql("SELECT json_extract(data, '$.stock') FROM products WHERE id = 'leather-jacket'")[0][0])
made = sql('SELECT COUNT(*) FROM orders')[0][0] - before
check('exactly 10 orders win the last 10 pieces', codes.get(200) == 10 and made == 10, f'{codes.get(200)} ok, {made} stored')
check('everyone else is told it sold out (422)', codes.get(422) == 290, str(codes))
check('no server errors, no dropped connections', not any(k >= 500 or k == 0 for k in codes))
check('stock ends at exactly 0, never below', stock.get('S') == 0, str(stock))
check('every order code is unique', sql('SELECT COUNT(DISTINCT code) = COUNT(*) FROM orders')[0][0] == 1)

# -------------------------------------------------- orders while staff work
print('\nbusy hour: 800 orders while the team cancels orders and edits stock')
sql("""UPDATE products SET data = json_set(data, '$.stock', json('{"OS":5000}'))
       WHERE id = 'cotton-cap'""")
import re
import requests

panel = requests.Session()
csrf = {'v': ''}


def api(a, **kw):
    r = panel.post(f'{BASE}/api/admin.php', json={'a': a, **kw}, headers={'X-CSRF': csrf['v']})
    j = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
    if j.get('csrf'):
        csrf['v'] = j['csrf']
    return r.status_code, j


api('state')                                # (writes the setup key file)
key = re.search(r'[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}', open(os.path.join(DATA, 'SETUP-KEY.txt')).read()).group(0)
code, _ = api('setup', key=key, name='Load Test', email='load@tiffany.test', password='load-test-pass-1')
assert code == 200, 'could not make the CEO account'
stop = threading.Event()
staff_log = {'cancelled_qty': 0, 'calls': 0, 'errors': []}


def staff():
    """The team at work while customers order: cancels every third new
    cotton-cap order (each cancel puts its pieces back) and saves the piece
    from an editor opened a moment earlier, changing only its note."""
    n = 0
    while not stop.is_set():
        code, j = api('orders', status='new')
        staff_log['calls'] += 1
        if code != 200:
            staff_log['errors'].append(code)
        for o in (j.get('orders') or [])[:3]:
            n += 1
            if n % 3 == 0 and o['items'][0]['id'] == 'cotton-cap':
                c, _ = api('order_status', code=o['code'], status='cancelled')
                staff_log['calls'] += 1
                if c == 200:
                    staff_log['cancelled_qty'] += sum(i['qty'] for i in o['items'])
                elif c not in (409, 422):
                    staff_log['errors'].append(c)
        c, j = api('product', id='cotton-cap')
        if c == 200:
            pr = j['product']
            time.sleep(0.05)                       # orders land while the editor is open
            c, _ = api('product_save', product={**pr, 'note': {'fa': f'یادداشت {n}'}, 'stock_base': pr['stock']})
            staff_log['calls'] += 2
            if c != 200:
                staff_log['errors'].append(c)


colours = ['#C2185B', '#1F2A44', '#6B4430']
worker = threading.Thread(target=staff)
worker.start()
t0 = time.perf_counter()
with ThreadPoolExecutor(50) as ex:
    res = list(ex.map(lambda i: req('POST', '/api/order.php',
                                    order_body('cotton-cap', 'OS', colours[i % 3], f'0935{i:07d}', qty=1 + i % 3)),
                      range(800)))
stop.set()
worker.join()
codes = summary('orders', res, time.perf_counter() - t0)
took = sum(1 + i % 3 for i, r in enumerate(res) if r[0] == 200)
stock = json.loads(sql("SELECT json_extract(data, '$.stock') FROM products WHERE id = 'cotton-cap'")[0][0])
want = 5000 - took + staff_log['cancelled_qty']
check('all 800 orders go through', codes.get(200) == 800, str(codes))
check('the team worked alongside without errors', not staff_log['errors'],
      f"{staff_log['calls']} panel calls, errors {staff_log['errors'][:5]}")
check('stock = 5000 − ordered + cancelled, exactly', stock['OS'] == want,
      f"5000 − {took} + {staff_log['cancelled_qty']} = {want}, shelf says {stock['OS']}")

print('\nbrowsing traffic: 80 visitors at once for 20 seconds')
paths = ['/', '/js/app.js', '/css/app.css', '/api/catalog.php', '/assets/img/aw-leather-jacket-480.webp',
         '/manifest.webmanifest']
etag = None
res_all = []
lock = threading.Lock()
end = time.time() + 20


def visitor(_):
    ip = next_ip()
    out = []
    while time.time() < end:
        for p in paths:
            out.append(req('GET', p, ip=ip))
        out.append(req('POST', '/api/hit.php', {'k': random.choice(['home', 'shop', 'p:leather-jacket', 'bag'])}, ip=ip))
    with lock:
        res_all.extend(out)


t0 = time.perf_counter()
with ThreadPoolExecutor(80) as ex:
    list(ex.map(visitor, range(80)))
codes = summary('all requests', res_all, time.perf_counter() - t0)
cat = [r for r in res_all if b'"products"' in r[2][:400]]
check('no server errors or dropped connections while browsing', not any(k >= 500 or k == 0 for k in codes), str(codes))
check('the catalogue always answers in full', all(json.loads(r[2])['ok'] for r in cat), f'{len(cat)} catalogue answers')
views = sql('SELECT SUM(views) FROM daily')[0][0] or 0
hits = sum(1 for r in res_all if r[0] == 204)
check('every page view that was accepted was counted', views >= hits * 0.99, f'{views} counted, {hits} accepted')

# ------------------------------------------------------------- hit flood
print('\nflood: 3000 page-view pings from ONE address, 100 at a time')
ip = next_ip()
t0 = time.perf_counter()
with ThreadPoolExecutor(100) as ex:
    res = list(ex.map(lambda i: req('POST', '/api/hit.php', {'k': 'home'}, ip=ip), range(3000)))
codes = summary('pings', res, time.perf_counter() - t0)
check('no server errors under the flood', not any(k >= 500 or k == 0 for k in codes), str(codes))
n_ip = sql("SELECT COUNT(*) FROM attempts WHERE k LIKE 'hit:%' AND k = ?", 'hit:' + ip)[0][0]
check('one address counts at most 1500 an hour', n_ip <= 1500, str(n_ip))

print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
