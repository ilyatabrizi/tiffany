"""The back office, tested through its HTTP API.

    TIFFANY_DATA=/tmp/tf-data php -S 127.0.0.1:8132 -t .
    TIFFANY_DATA=/tmp/tf-data python3 api_test.py http://127.0.0.1:8132

Run against a FRESH data folder: it creates the CEO account with the setup
key it reads from that folder, exactly as a person would from cPanel."""
import io
import json
import os
import re
import sys

import requests
from PIL import Image

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8132'
DATA = os.environ['TIFFANY_DATA']
ok = bad = 0


def check(name, cond, extra=''):
    global ok, bad
    if cond:
        ok += 1
        print('  ok  ', name)
    else:
        bad += 1
        print('  FAIL', name, extra)


def key():
    return re.search(r'[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}', open(f'{DATA}/SETUP-KEY.txt').read()).group(0)


class Panel:
    def __init__(self):
        self.s = requests.Session()
        self.csrf = ''

    def __call__(self, a, **kw):
        r = self.s.post(f'{BASE}/api/admin.php', json={'a': a, **kw},
                        headers={'X-CSRF': self.csrf} if self.csrf else {})
        try:
            body = r.json()
        except ValueError:
            body = {'raw': r.text[:200]}
        if body.get('csrf'):
            self.csrf = body['csrf']
        return r.status_code, body

    def upload(self, data, name='photo.jpg'):
        r = self.s.post(f'{BASE}/api/admin.php', data={'a': 'upload'},
                        files={'photo': (name, data, 'image/jpeg')}, headers={'X-CSRF': self.csrf})
        return r.status_code, r.json()


def jpeg(w, h, orientation=1, colour=(200, 40, 60)):
    """A photo as a phone takes it: landscape pixels, an EXIF note saying 'turn me'."""
    im = Image.new('RGB', (w, h), colour)
    im.paste((255, 255, 255), (0, 0, w // 8, h))   # a white band down the LEFT of the raw pixels
    exif = Image.Exif()
    exif[0x0112] = orientation
    buf = io.BytesIO()
    im.save(buf, 'JPEG', exif=exif.tobytes(), quality=90)
    return buf.getvalue()


print('\nsetup')
ceo = Panel()
code, st = ceo('state')
check('fresh install asks for setup', st.get('setup') is True and st.get('user') is None)
code, r = ceo('setup', key='WRONG-KEYS-0000-0000', name='Amir', email='ceo@tiffany.test', password='a-long-pass-1')
check('wrong key refused', code == 422 and r.get('field') == 'key')
k1 = key()
code, r = ceo('setup', key=k1.lower().replace('-', ' '), name='Amir', email='CEO@Tiffany.test', password='a-long-pass-1')
check('setup with the key (any case, spaces) makes a CEO', code == 200 and r['user']['role'] == 'ceo', str(r))
check('email stored lower-case', r['user']['email'] == 'ceo@tiffany.test')
check('key rotates after use', key() != k1)
code, r = Panel()('setup', key=key(), name='X', email='x@x.test', password='a-long-pass-1')
check('second setup refused', code == 409)

print('\nlogin')
p = Panel()
code, r = p('login', email='ceo@tiffany.test', password='nope-nope-nope')
check('wrong password refused', code == 401 and r['error'] == 'wrong')
code, r = p('login', email='ceo@tiffany.test', password='a-long-pass-1')
check('right password signs in', code == 200 and r['user']['name'] == 'Amir')
code, r = Panel()('products')
check('no session, no data', code == 401)
bare = requests.post(f'{BASE}/api/admin.php', json={'a': 'products'}, cookies=p.s.cookies)
check('session without CSRF token refused', bare.status_code == 403)

print('\nphotos')
code, r = ceo.upload(jpeg(1600, 1200, orientation=6))
check('upload accepted', code == 200 and re.fullmatch(r'uploads/p/[a-f0-9]{20}', r.get('image', '')), str(r))
img = r['image']
big = Image.open(f'{img}-960.webp')
small = Image.open(f'{img}-480.webp')
check('960 and 480 WebP made, 4:5', big.size == (960, 1200) and small.size == (480, 600), f'{big.size} {small.size}')
# The raw pixels had the white band on the left; orientation 6 = turn 90° clockwise,
# so after the fix the band runs along the TOP.
top = big.crop((0, 0, 960, 40)).convert('L').getextrema()[1]
bottom = big.crop((0, 1160, 960, 1200)).convert('L').getextrema()[1]
check('phone photo stood upright (EXIF orientation honoured)', top > 230 and bottom < 200, f'top {top} bottom {bottom}')
code, r = ceo.upload(b'<?php echo 1; ?>', name='shell.php')
check('a non-image is refused', code == 422)

print('\nproducts')
new = {
    'name': {'fa': 'هودی کرم', 'en': 'Cream Hoodie', 'tr': ''},
    'cat': 'hoodie', 'col': '', 'price': '۲٬۴۵۰٬۰۰۰', 'images': [img, 'uploads/p/' + 'f' * 20],
    'sizes': ['L', 'S', 'M'], 'stock': {'S': 2, 'M': 0, 'L': 1}, 'fit': 'relaxed', 'badge': 'new',
    'colours': [{'hex': '#efe6d8', 'fa': 'کرم', 'en': 'Cream', 'tr': 'Krem'}],
    'note': {'fa': 'هودی نخی گرم.'}, 'visible': True,
}
code, r = ceo('product_save', product=new)
check('product added', code == 200, str(r)[:200])
prod = r['product']
check('id from the English name', prod['id'] == 'cream-hoodie')
check('Persian digits and separators in the price', prod['price'] == 2450000)
check('sizes put in order', prod['sizes'] == ['S', 'M', 'L'])
check('a photo that does not exist is dropped', prod['images'] == [img])
check('colour hex upper-cased', prod['colours'][0]['hex'] == '#EFE6D8')
code, r = ceo('product_save', product={**new, 'name': {'fa': ''}})
check('no name, no product', code == 422 and r['field'] == 'name')
code, r = ceo('product_save', product={**new, 'images': []})
check('no photo, no product', code == 422 and r['field'] == 'images')
cat = requests.get(f'{BASE}/api/catalog.php').json()
mine = next((x for x in cat['products'] if x['id'] == 'cream-hoodie'), None)
check('it is in the shop', mine is not None and len(cat['products']) == 18)
check('sold-out size public, counts private', mine['soldout'] == ['M'] and 'stock' not in mine, str(mine and mine.get('soldout')))
etag = requests.get(f'{BASE}/api/catalog.php').headers['ETag']
check('catalogue revalidates (304)', requests.get(f'{BASE}/api/catalog.php', headers={'If-None-Match': etag}).status_code == 304)
code, r = ceo('product_visible', id='cream-hoodie', visible=False)
cat = requests.get(f'{BASE}/api/catalog.php').json()
check('hidden products leave the shop', all(x['id'] != 'cream-hoodie' for x in cat['products']))
check('…and the catalogue ETag moves', requests.get(f'{BASE}/api/catalog.php').headers['ETag'] != etag)
ceo('product_visible', id='cream-hoodie', visible=True)

print('\nordering')
order = {'items': [{'id': 'cream-hoodie', 'size': 'S', 'colour': '#EFE6D8', 'qty': 1},
                   {'id': 'alphabet-tee', 'size': 'M', 'colour': '#A9C9E8', 'qty': 2}],
         'name': 'مریم احمدی', 'phone': '۰۹۱۲ ۱۲۳ ۴۵۶۷', 'city': 'تبریز',
         'address': 'خیابان ولیعصر، کوچه‌ی ۳، پلاک ۱۲', 'postal': '5157933511', 'price': 1}
shop = requests.Session()
r = shop.post(f'{BASE}/api/order.php', json=order)
check('closed store takes no orders', r.status_code == 403 and r.json()['error'] == 'closed')
code, r = ceo('settings_save', store_open=True)
check('CEO opens the store', r['settings']['store_open'] is True)
r = shop.post(f'{BASE}/api/order.php', json={**order, 'items': [{'id': 'cream-hoodie', 'size': 'M', 'colour': '#EFE6D8', 'qty': 1}]})
check('a sold-out size cannot be ordered', r.status_code == 422 and 'تموم' in r.json()['message'])
r = shop.post(f'{BASE}/api/order.php', json=order)
o = r.json()
check('order placed', r.status_code == 200 and re.fullmatch(r'TF-\d{5}', o.get('code', '')), r.text[:200])
check('the server prices it, not the browser', o['total'] == 2450000 + 2 * 1680000, str(o))
code, r = ceo('product', id='cream-hoodie')
check('stock went down', r['product']['stock'] == {'S': 1, 'M': 0, 'L': 1}, str(r['product']['stock']))
r = shop.post(f'{BASE}/api/order.php', json={**order, 'phone': '12345'})
check('a bad phone is refused', r.status_code == 422 and r.json()['field'] == 'phone')
r = shop.post(f'{BASE}/api/order.php', json={**order, 'items': [{'id': 'nope', 'size': 'M', 'qty': 1}]})
check('an unknown product is refused', r.status_code == 422)
r = shop.post(f'{BASE}/api/order.php', json=order, headers={'Origin': 'https://elsewhere.example'})
check('cross-site order refused', r.status_code == 403)

print('\ntracking')
t = shop.post(f'{BASE}/api/track.php', json={'phone': '09121234567', 'codes': [o['code']]}).json()
check('customer sees the status', t['orders'][o['code']]['status'] == 'new')
t = shop.post(f'{BASE}/api/track.php', json={'phone': '09120000000', 'codes': [o['code']]}).json()
check('another phone sees nothing', t['orders'] == {})

print('\norders in the panel')
code, r = ceo('orders')
check('order listed with counts', r['orders'][0]['code'] == o['code'] and r['counts'].get('new') == 1)
code, r = ceo('orders', q='0912123')
check('search by phone', len(r['orders']) == 1)
code, r = ceo('order_status', code=o['code'], status='confirmed')
check('confirm', r['order']['status'] == 'confirmed')
t = shop.post(f'{BASE}/api/track.php', json={'phone': '09121234567', 'codes': [o['code']]}).json()
check('…and the customer sees it', t['orders'][o['code']]['status'] == 'confirmed')
code, r = ceo('order_note', code=o['code'], note='تحویل بعد از ساعت ۵')
check('internal note', r['order']['admin_note'] == 'تحویل بعد از ساعت ۵')
r2 = shop.post(f'{BASE}/api/order.php', json={**order, 'items': [order['items'][0]]}).json()
code, r = ceo('order_status', code=r2['code'], status='cancelled')
code, r = ceo('product', id='cream-hoodie')
check('cancelling puts the piece back', r['product']['stock']['S'] == 1, str(r['product']['stock']))
code, r = ceo('order_status', code=r2['code'], status='new')
check('a cancelled order stays cancelled', code == 422)

print('\nvisits')
ua = {'User-Agent': 'Mozilla/5.0 (iPhone) Safari'}
for k in ['home', 'shop', 'p:cream-hoodie', 'p:cream-hoodie', 'p:alphabet-tee']:
    requests.post(f'{BASE}/api/hit.php', data=json.dumps({'k': k}), headers=ua)
requests.post(f'{BASE}/api/hit.php', data=json.dumps({'k': 'home'}), headers={'User-Agent': 'Googlebot/2.1'})
requests.post(f'{BASE}/api/hit.php', data=json.dumps({'k': '<script>'}), headers=ua)
code, r = ceo('traffic', days=7)
check('views counted, bots and junk ignored', r['views'] == 5, str(r['views']))
check('one visitor, however many pages', r['visitors'] == 1, str(r['visitors']))
check('most-viewed product first', r['products'][0]['id'] == 'cream-hoodie' and r['products'][0]['n'] == 2)

print('\ndashboard')
code, d = ceo('dashboard', days=30)
check('revenue = live orders only', d['totals']['revenue'] == 2450000 + 2 * 1680000, str(d['totals']))
check('cancelled counted apart', d['totals']['cancelled'] == 1)
check('today matches', d['today']['revenue'] == d['totals']['revenue'] and d['today']['orders'] == 1)
check('top piece by quantity', d['top'][0]['id'] == 'alphabet-tee' and d['top'][0]['qty'] == 2)
check('30 days in the series', len(d['series']) == 30 and d['series'][-1]['revenue'] == d['totals']['revenue'])
check('conversion = orders / visitors', d['totals']['conversion'] == 100.0, str(d['totals']['conversion']))
check('low stock flagged', any(x['id'] == 'cream-hoodie' and 'M' in x['out'] for x in d['low_stock']))
code, c = ceo('customers')
check('customer listed once, with spend', len(c['customers']) == 1 and c['customers'][0]['orders'] == 2
      and c['customers'][0]['spent'] == d['totals']['revenue'], str(c))

print('\ncookie sheet and devices')
IOS = {'type': 'mobile', 'os': 'ios', 'brand': 'apple', 'browser': 'safari', 'app': 'web', 'lang': 'fa'}
AND = {'type': 'mobile', 'os': 'android', 'brand': 'samsung', 'browser': 'samsung', 'app': 'app', 'lang': 'fa'}
ua2 = {'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546E) SamsungBrowser/26.0'}
ua3 = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/129'}
requests.post(f'{BASE}/api/hit.php', data=json.dumps({'k': 'home', 'd': IOS}), headers=ua)
code, r = ceo('traffic', days=7)
check('no cookie, no device line kept', r['devices']['known'] == 0, str(r['devices']))
x = requests.post(f'{BASE}/api/consent.php', json={'c': 'yes'}, headers={**ua, 'Origin': 'https://evil.example'})
check('another site cannot answer for the shop', x.status_code == 403)
x = requests.post(f'{BASE}/api/consent.php', json={'c': 'maybe'}, headers=ua)
check('only yes or no', x.status_code == 422)
yes = requests.Session()
x = yes.post(f'{BASE}/api/consent.php', json={'c': 'yes', 'd': {**IOS, 'model': 'iPhone15,2', 'browser': 'netscape'}}, headers=ua)
sc = x.headers.get('Set-Cookie', '')
check('yes sets tf_c=1 for a year, readable by the page', x.status_code == 200 and 'tf_c=1' in sc
      and 'Max-Age=31536000' in sc and 'path=/' in sc.lower() and 'httponly' not in sc.lower(), sc)
yes.post(f'{BASE}/api/hit.php', data=json.dumps({'k': 'shop', 'd': IOS}), headers=ua)
yes.post(f'{BASE}/api/hit.php', data=json.dumps({'k': 'bag', 'd': IOS}), headers=ua)
yes2 = requests.Session()
yes2.post(f'{BASE}/api/consent.php', json={'c': 'yes'}, headers=ua2)
yes2.post(f'{BASE}/api/hit.php', data=json.dumps({'k': 'home', 'd': AND}), headers=ua2)
no = requests.Session()
x = no.post(f'{BASE}/api/consent.php', json={'c': 'no', 'd': IOS}, headers=ua3)
check('no sets tf_c=0 for six months', 'tf_c=0' in x.headers.get('Set-Cookie', '')
      and 'Max-Age=15724800' in x.headers.get('Set-Cookie', ''), x.headers.get('Set-Cookie', ''))
no.post(f'{BASE}/api/hit.php', data=json.dumps({'k': 'home', 'd': {**IOS, 'type': 'desktop'}}), headers=ua3)
forged = requests.post(f'{BASE}/api/hit.php', data=json.dumps({'k': 'home', 'd': {'type': 'mobile', 'os': 'evil<script>'}}),
                       headers={**ua3, 'Cookie': 'tf_c=1'})
code, r = ceo('traffic', days=7)
dv = r['devices']
vals = lambda dim: {x['v']: x['n'] for x in dv[dim]}
check('two consenting visitors, each counted once a day', dv['known'] == 2, str(dv))
check('yes and no tallied', dv['consent'] == {'yes': 2, 'no': 1}, str(dv['consent']))
check('brands', vals('brand') == {'apple': 1, 'samsung': 1}, str(vals('brand')))
check('systems', vals('os') == {'ios': 1, 'android': 1}, str(vals('os')))
check('an unknown browser word is dropped, the rest of the line kept', vals('browser') == {'samsung': 1}, str(vals('browser')))
check('installed app vs browser', vals('app') == {'web': 1, 'app': 1}, str(vals('app')))
check('a no keeps the desktop line out', 'desktop' not in vals('type'))
check('nothing outside the word list is stored', all(x['v'] in ('fa',) for x in dv['lang'])
      and 'model' not in dv and all('<' not in x['v'] for d in ('type', 'os', 'brand', 'browser') for x in dv[d]))

print('\nteam and roles')
code, r = ceo('team_save', name='Sara', email='sara@tiffany.test', role='admin', password='sara-pass-123')
check('CEO adds an admin', code == 200)
code, r = ceo('team_save', name='Dup', email='SARA@tiffany.test', role='admin', password='sara-pass-123')
check('same email twice refused', code == 422 and r['field'] == 'email')
adm = Panel()
code, r = adm('login', email='sara@tiffany.test', password='sara-pass-123')
check('admin signs in', code == 200 and r['user']['role'] == 'admin')
code, d = adm('dashboard', days=30)
check('admin sees orders but no money', d['totals']['orders'] == 1 and d['totals']['revenue'] is None
      and d['today']['revenue'] is None and d['categories'] is None and d['top'][0]['revenue'] is None)
code, c = adm('customers')
check('…and no customer spend', c['customers'][0]['spent'] is None)
for a in ['settings_save', 'team', 'log']:
    code, r = adm(a, store_open=False)
    check(f'admin cannot {a}', code == 403)
code, r = adm('product_save', product={**new, 'name': {'fa': 'دامن تست'}, 'images': [img], 'cat': 'skirts'})
check('admin can add products', code == 200)
code, r = ceo('team')
sara = next(u for u in r['team'] if u['email'] == 'sara@tiffany.test')
code, r = ceo('team_save', id=sara['id'], name='Sara', email='sara@tiffany.test', role='admin', active=False)
code, r = adm('products')
check('deactivating someone signs them out at once', code == 401)
code, r = ceo('team_save', id=1, name='Amir', email='ceo@tiffany.test', role='admin')
check('the CEO cannot demote themselves', code == 422)
code, r = ceo('log')
check('activity log records who did what', any(x['action'] == 'order_status' and x['who'] == 'Amir' for x in r['log']))

print('\npasswords')
other = Panel()
other('login', email='ceo@tiffany.test', password='a-long-pass-1')
code, r = ceo('password', current='wrong', password='new-long-pass-2')
check('password change needs the current one', code == 422 and r['field'] == 'current')
code, r = ceo('password', current='a-long-pass-1', password='new-long-pass-2')
check('password changed', code == 200)
check('this device stays in', ceo('products')[0] == 200)
check('every other device is out', other('products')[0] == 401)
k2 = key()
rec = Panel()
code, r = rec('recover', key=k2, email='ceo@tiffany.test', password='third-long-pass-3')
check('forgotten password: reset with the setup key', code == 200 and r['user']['role'] == 'ceo')
check('…which rotates the key again', key() != k2)
check('…and signs every old session out', ceo('products')[0] == 401)
ceo = rec
print('\nbrute force')
ceo('team_save', name='Lock', email='lock@tiffany.test', role='admin', password='lock-pass-123')
lock = Panel()
codes = [lock('login', email='lock@tiffany.test', password=f'guess-{i}')[0] for i in range(7)]
check('guessing is locked out after 6 tries', codes[-1] == 429, str(codes))
code, r = lock('login', email='lock@tiffany.test', password='lock-pass-123')
check('even the right password waits out the lock', code == 429)

code, r = ceo('logout')
check('sign out', code == 200 and ceo('products')[0] == 401)

print('\ncatalogue import')
ceo = Panel()
ceo('login', email='ceo@tiffany.test', password='third-long-pass-3')
def piece(i, sizes, cat='trousers', price=1000000):
    return {'id': f'imp-{i}', 'name': {'fa': f'قطعه {i}', 'en': f'Piece {i}'}, 'cat': cat, 'col': 'aw27',
            'price': price, 'images': ['assets/img/aw-dark-jeans'], 'sizes': sizes, 'stock': None,
            'colours': [{'hex': '#161B26', 'fa': 'جین تیره', 'en': 'Dark denim'}], 'visible': True}
imp = os.path.join(DATA, 'catalog-import.json')
with open(imp, 'w') as fh:
    json.dump([piece(1, ['34', '36', '42']), piece(2, ['37', '40'], 'shoes'), piece(3, ['OS', 'S'], 'accessories')], fh)
cat = requests.get(f'{BASE}/api/catalog.php').json()['products']
check('import replaces every product', [p['id'] for p in cat] == ['imp-1', 'imp-2', 'imp-3'], str([p['id'] for p in cat]))
check('waist and shoe sizes accepted, in order', cat[0]['sizes'] == ['34', '36', '42'] and cat[1]['sizes'] == ['37', '40'])
check('one size wins over letters', cat[2]['sizes'] == ['OS'])
check('the collection is aw27', all(p['col'] == 'aw27' for p in cat))
requests.get(f'{BASE}/api/catalog.php')
code, r = ceo('log')
check('imported once, logged once', sum(1 for x in r['log'] if x['action'] == 'catalog_import') == 1)
with open(imp, 'w') as fh:
    json.dump([piece(4, ['S']), piece(5, ['S'], price=0)], fh)
cat = requests.get(f'{BASE}/api/catalog.php').json()['products']
check('a file with one bad piece changes nothing', [p['id'] for p in cat] == ['imp-1', 'imp-2', 'imp-3'])
check('…and says why in error.log', 'catalog-import piece #1: price' in open(os.path.join(DATA, 'error.log')).read())
code, r = ceo('product_save', product={**piece(9, ['38', '40']), 'id': ''})
check('the panel saves numeric sizes too', code == 200 and r['product']['sizes'] == ['38', '40'], str(r)[:200])
os.remove(imp)

print('\nhardening (2026-10-16 review)')
import sqlite3
import concurrent.futures as cf
SESS = os.path.join(DATA, 'sessions')
def db(q, *a):
    con = sqlite3.connect(os.path.join(DATA, 'tiffany.sqlite'))
    try:
        rows = con.execute(q, a).fetchall()
        con.commit()
        return rows
    finally:
        con.close()

# Anonymous requests leave no session files behind, made-up cookies neither.
before = len(os.listdir(SESS))
for i in range(25):
    requests.post(f'{BASE}/api/admin.php', json={'a': 'nope'})
    requests.post(f'{BASE}/api/admin.php', json={'a': 'state'}, cookies={'tf_admin': f'madeup{i:026d}'})
check('anonymous and made-up sessions leave no files', len(os.listdir(SESS)) == before,
      f'{before} → {len(os.listdir(SESS))}')

# A deleted person's old cookie must not wake up as the next account (SQLite
# hands the deleted id to the next row).
ceo('team_save', name='Reza', email='reza@tiffany.test', role='admin', password='reza-pass-123')
reza = Panel()
code, r = reza('login', email='reza@tiffany.test', password='reza-pass-123')
check('Reza signs in', code == 200)
rid = r['user']['id']
ceo('team_delete', id=rid)
ceo('team_save', name='Mina', email='mina@tiffany.test', role='ceo', password='mina-pass-123')
mina_id = [u for u in ceo('team')[1]['team'] if u['email'] == 'mina@tiffany.test'][0]['id']
code, r = reza('state')
check("a deleted person's cookie stays signed out", r.get('user') is None,
      f'new id {mina_id} (old {rid}): {r.get("user")}')
check('…and cannot reach the team', reza('team')[0] == 401)

# A burst of parallel wrong passwords: no 500s, and the lock holds after it.
ceo('team_save', name='Burst', email='burst@tiffany.test', role='admin', password='burst-pass-123')
def guess(i):
    return requests.post(f'{BASE}/api/admin.php', json={'a': 'login', 'email': 'burst@tiffany.test',
                                                       'password': f'wrong-{i}'}).status_code
with cf.ThreadPoolExecutor(20) as ex:
    codes = list(ex.map(guess, range(40)))
check('40 parallel guesses: no server errors', 500 not in codes, str(sorted(set(codes))))
check('…and the next try is locked', guess(99) == 429)
db("DELETE FROM attempts WHERE k LIKE 'login:%'")   # (so later sections can sign in)

# Stock edited in the panel moves by the edit, on top of what orders took.
code, r = ceo('product_save', product={**new, 'name': {'fa': 'تست موجودی', 'en': 'Stock Test'},
                                       'sizes': ['S'], 'stock': {'S': 5}, 'id': ''})
sid = r['product']['id']
opened = ceo('product', id=sid)[1]['product']
r = requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09350000001',
                  'items': [{'id': sid, 'size': 'S', 'colour': '#EFE6D8', 'qty': 2}]})
check('an order takes 2 while the editor is open', r.status_code == 200, r.text[:160])
code, r = ceo('product_save', product={**opened, 'note': {'fa': 'غلط املایی درست شد'}, 'stock_base': opened['stock']})
check('saving a typo fix keeps what the order took', code == 200 and r['product']['stock'] == {'S': 3}, str(r)[:160])
opened = r['product']
import time
time.sleep(1.1)                   # versions are whole seconds
code, r = ceo('product_save', product={**opened, 'stock': {'S': 8}, 'stock_base': {'S': 3}})
check('adding 5 in the editor adds 5', r['product']['stock'] == {'S': 8}, str(r['product']['stock']))
code, r = ceo('product_save', product={**opened, 'stock': {'S': 1}})
check('an old copy without a base is refused, not saved', code == 409 and r['error'] == 'stale', f'{code} {r}')

# Two people cancelling one order at the same moment restock it once.
r = requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09350000002',
                  'items': [{'id': sid, 'size': 'S', 'colour': '#EFE6D8', 'qty': 1}]}).json()
left = ceo('product', id=sid)[1]['product']['stock']['S']
two = [Panel() for _ in range(4)]
for t in two:
    t('login', email='ceo@tiffany.test', password='third-long-pass-3')
with cf.ThreadPoolExecutor(4) as ex:
    codes = list(ex.map(lambda t: t('order_status', code=r['code'], status='cancelled')[0], two))
after = ceo('product', id=sid)[1]['product']['stock']['S']
check('4 cancels at once: one wins', codes.count(200) == 1, str(codes))
check('…and the piece goes back once', after == left + 1, f'{left} → {after}')

# The visit counter only counts the shop's own pages.
for k in ['zzzz', 'p:no-such-piece', 'c:nope', 'p:' + sid, 'about']:
    requests.post(f'{BASE}/api/hit.php', data=json.dumps({'k': k}), headers=ua)
pages = {row[0] for row in db('SELECT page FROM pageviews')}
check('made-up pages are not stored', not ({'zzzz', 'p:no-such-piece', 'c:nope'} & pages), str(pages))
check('real pages are', {'p:' + sid, 'about'} <= pages, str(pages))

# One order cannot empty the shelves; one phone cannot pile up orders.
big = [{'id': sid, 'size': 'S', 'colour': '#EFE6D8', 'qty': 5}] * 1 + \
      [{'id': 'cream-hoodie', 'size': 'L', 'colour': '#EFE6D8', 'qty': 5},
       {'id': 'alphabet-tee', 'size': 'M', 'colour': '#A9C9E8', 'qty': 5},
       {'id': 'alphabet-tee', 'size': 'S', 'colour': '#A9C9E8', 'qty': 5},
       {'id': 'alphabet-tee', 'size': 'L', 'colour': '#A9C9E8', 'qty': 5}]
r = requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09350000003', 'items': big})
check('more than 20 pieces in one order is refused', r.status_code == 422 and r.json()['field'] == 'count', r.text[:160])
r = requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09350000005',
                  'items': [{'id': sid, 'size': 'S', 'colour': '#EFE6D8', 'qty': 6}]})
check('6 of one line is refused, not quietly cut to 5', r.status_code == 422 and r.json()['field'] == 'count', r.text[:160])
ok_order = requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09350000006',
                         'items': [{'id': sid, 'size': 'S', 'colour': '#EFE6D8', 'qty': 2}]}).json()
check('a placed order answers with its priced lines', ok_order.get('items') == [
    {'id': sid, 'size': 'S', 'colour': '#EFE6D8', 'qty': 2, 'price': 2450000}], str(ok_order.get('items')))
one = [{'id': sid, 'size': 'S', 'colour': '#EFE6D8', 'qty': 1}]
codes = [requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09350000004', 'items': one}).status_code
         for _ in range(4)]
check('a 4th unconfirmed order from one phone waits', codes == [200, 200, 200, 422], str(codes))
r = requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09350000004', 'items': one})
check('…and says so (not «wrong number»)', r.json().get('field') == 'pending', r.text[:120])

# The panel's report ranges default to 30 days.
check('dashboard without days is 30 days', ceo('dashboard')[1].get('days') == 30)

# A catalogue file with a repeated or missing id changes nothing.
before_ids = [p['id'] for p in requests.get(f'{BASE}/api/catalog.php').json()['products']]
with open(imp, 'w') as fh:
    json.dump([piece(7, ['S']), piece(7, ['M'])], fh)
after_ids = [p['id'] for p in requests.get(f'{BASE}/api/catalog.php').json()['products']]
check('an import with a repeated id changes nothing', after_ids == before_ids)
check('…and says why', "repeated id 'imp-7'" in open(os.path.join(DATA, 'error.log')).read())
os.remove(imp)

if os.environ.get('SMS_MOCK_LOG'):
    print('\norder SMS (against tests/sms_mock.php)')
    MOCK = os.environ['SMS_MOCK_LOG']
    open(MOCK, 'w').close()
    def sent():                       # the messages, not the balance checks
        return [x for x in (json.loads(l) for l in open(MOCK) if l.strip()) if x['path'] == '/v1/send/verify']
    def wait_for(n, tries=30):
        import time
        for _ in range(tries):
            if len(sent()) >= n:
                break
            time.sleep(0.1)
        return sent()
    db("DELETE FROM attempts WHERE k LIKE 'order:%'")
    db("UPDATE products SET data = json_set(data, '$.stock', json('{\"S\":100}')) WHERE id = ?", sid)
    code, st = ceo('settings')
    check('no SMS file, no SMS: the panel says it is not connected', st['sms']['configured'] is False, str(st.get('sms')))
    with open(os.path.join(DATA, 'sms.json'), 'w') as fh:
        json.dump({'api_key': 'test-key', 'customer_template': 807432, 'owner_template': 307865,
                   'owner_mobile': '09141012567', 'endpoint': 'http://127.0.0.1:8139/v1/'}, fh)
    code, st = ceo('settings')
    check('with the file: connected, on, owner from the file',
          st['sms'] == {'configured': True, 'on': True, 'owner': '09141012567'}, str(st.get('sms')))
    check('the key never reaches the panel', 'test-key' not in json.dumps(st))
    check('the balance comes from sms.ir', ceo('sms_credit')[1].get('credit') == 42)
    adm = Panel()
    adm('login', email='burst@tiffany.test', password='burst-pass-123')
    check('an admin cannot see the SMS balance or send a test', adm('sms_credit')[0] == 403 and adm('sms_test')[0] == 403)
    sample = [{'id': sid, 'size': 'S', 'colour': '#EFE6D8', 'qty': 1}]
    r = requests.post(f'{BASE}/api/order.php', json={**order, 'name': 'سارا رضایی', 'phone': '۰۹۳۵ ۱۱۱ ۲۲۳۳', 'items': sample}).json()
    log = wait_for(2)
    cust = [x for x in log if x['body']['templateId'] == 807432]
    own = [x for x in log if x['body']['templateId'] == 307865]
    check('a new order texts the customer: first name and code', len(cust) == 1 and cust[0]['body']['mobile'] == '09351112233'
          and cust[0]['body']['parameters'] == [{'name': 'NAME', 'value': 'سارا'}, {'name': 'CODE', 'value': r['code']}], str(cust))
    check('…and the owner: code and amount', len(own) == 1 and own[0]['body']['mobile'] == '09141012567'
          and own[0]['body']['parameters'] == [{'name': 'CODE', 'value': r['code']}, {'name': 'AMOUNT', 'value': f"{r['total']:,}"}], str(own))
    check('…with the key in the header, on the verify endpoint', all(x['key'] == 'test-key' and x['path'] == '/v1/send/verify' for x in log))
    ceo('order_status', code=r['code'], status='confirmed')
    log = wait_for(3)
    check('confirming the order texts the customer once', len(log) == 3 and log[2]['body']['templateId'] == 807432
          and log[2]['body']['mobile'] == '09351112233', str(log[2:]))
    code, rr = ceo('settings_save', sms_on=False)
    check('the CEO switches SMS off (and the shop stays as it was)', rr['sms']['on'] is False and rr['settings']['store_open'] is True)
    requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09351112244', 'items': sample})
    import time; time.sleep(0.6)
    check('switched off: no SMS', len(sent()) == 3, str(len(sent())))
    ceo('settings_save', sms_on=True)
    code, rr = ceo('settings_save', sms_owner='123')
    check('a wrong owner number is refused', code == 422 and rr['field'] == 'sms_owner')
    code, rr = ceo('settings_save', sms_owner='۰۹۱۲ ۰۰۰ ۱۱۱۱')
    check('the owner number is saved normalised', rr['sms']['owner'] == '09120001111', str(rr.get('sms')))
    code, rr = ceo('sms_test')
    log = wait_for(4)
    check('a test SMS goes to the owner with TF-00000', code == 200 and log[-1]['body']['mobile'] == '09120001111'
          and log[-1]['body']['parameters'][0] == {'name': 'CODE', 'value': 'TF-00000'}, str(log[-1:]))
    ceo('settings_save', sms_owner='')
    requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09351112255', 'items': sample})
    log = wait_for(5)
    time.sleep(0.4)
    check('owner number cleared: only the customer is texted', len(sent()) == 5 and sent()[-1]['body']['templateId'] == 807432)
    ceo('settings_save', sms_owner='09990000000')          # the stand-in fails this one
    r = requests.post(f'{BASE}/api/order.php', json={**order, 'phone': '09351112266', 'items': sample})
    wait_for(7)
    time.sleep(0.3)
    check('a failed SMS never fails the order', r.status_code == 200, f'{r.status_code} {r.text[:200]}')
    check('…and goes to error.log without the full number', 'sms owner to 0999…00' in open(os.path.join(DATA, 'error.log')).read())
    os.remove(os.path.join(DATA, 'sms.json'))

print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
