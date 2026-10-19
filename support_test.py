"""Customer accounts, SMS codes, tickets with files, and stories — through HTTP.

    SMS_MOCK_LOG=/tmp/sms.log php -S 127.0.0.1:8139 tests/sms_mock.php
    TIFFANY_DATA=/tmp/tf-sup php -d upload_max_filesize=5M -d post_max_size=8M \\
        -S 127.0.0.1:8134 -t .
    SMS_MOCK_LOG=/tmp/sms.log TIFFANY_DATA=/tmp/tf-sup python3 support_test.py http://127.0.0.1:8134

A FRESH data folder: the CEO account is made with the setup key read from it.
The SMS stand-in logs every message, which is how the test reads the codes a
customer would get on their phone."""
import hashlib
import hmac
import io
import json
import os
import re
import sqlite3
import sys
import time

import requests
from PIL import Image

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8134'
DATA = os.environ['TIFFANY_DATA']
MOCK = os.environ['SMS_MOCK_LOG']
ok = bad = 0
OTP_TPL, TICKET_TPL = 555001, 555002


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


def sms():
    try:
        lines = open(MOCK).read().splitlines()
    except FileNotFoundError:
        return []
    return [x for x in map(json.loads, lines) if x['path'] == '/v1/send/verify']


def last_code(phone):
    for x in reversed(sms()):
        if x['body']['mobile'] == phone and x['body']['templateId'] == OTP_TPL:
            return x['body']['parameters'][0]['value']
    return None


def jpeg_with_gps(w=1600, h=1200):
    """A phone photo: EXIF with an orientation and a GPS position."""
    im = Image.new('RGB', (w, h), (180, 60, 90))
    exif = Image.Exif()
    exif[0x0112] = 6                           # turned on its side
    exif[0x8825] = {1: 'N', 2: (35.0, 41.0, 0.0), 3: 'E', 4: (51.0, 25.0, 0.0)}
    b = io.BytesIO()
    im.save(b, 'JPEG', exif=exif.tobytes(), quality=90)
    return b.getvalue()


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

    def multi(self, a, data, files):
        r = self.s.post(f'{BASE}/api/admin.php', data={'a': a, **data}, files=files, headers={'X-CSRF': self.csrf})
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, {'raw': r.text[:300]}


class Shopper:
    def __init__(self):
        self.s = requests.Session()
        self.csrf = ''

    def acc(self, a, **kw):
        r = self.s.post(f'{BASE}/api/account.php', json={'a': a, **kw}, headers={'X-CSRF': self.csrf})
        try:
            body = r.json()
        except ValueError:
            body = {'raw': r.text[:200]}
        if 'csrf' in body:
            self.csrf = body['csrf'] or self.csrf
        return r.status_code, body

    def tix(self, a, files=None, **kw):
        if files is None:
            r = self.s.post(f'{BASE}/api/tickets.php', json={'a': a, **kw}, headers={'X-CSRF': self.csrf})
        else:
            r = self.s.post(f'{BASE}/api/tickets.php', data={'a': a, **kw}, files=files, headers={'X-CSRF': self.csrf})
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, {'raw': r.text[:300]}

    def join(self, phone, name='مریم احمدی', password='tiffany-1'):
        self.acc('otp', purpose='signup', phone=phone)
        return self.acc('signup', phone=phone, code=last_code(tf_phone(phone)), name=name, password=password)


def by_code(rows, code):
    return next((t for t in rows if t['code'] == code), {})


def tf_phone(p):
    d = re.sub(r'\D', '', p.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')))
    return '0' + d[2:] if d.startswith('98') and len(d) == 12 else d


# ------------------------------------------------------------- the panel
ceo = Panel()
ceo('state')
k = re.search(r'[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}', open(f'{DATA}/SETUP-KEY.txt').read()).group(0)
code, _ = ceo('setup', key=k, name='مدیر تست', email='ceo@tiffany.test', password='ceo-pass-123')
assert code == 200, 'setup failed'
ceo('team_save', name='ادمین تست', email='admin@tiffany.test', role='admin', password='admin-pass-123')
adm = Panel()
adm('state')
adm('login', email='admin@tiffany.test', password='admin-pass-123')

print('\nsign-up codes are off until the template is set')
a = Shopper()
code, st = a.acc('state')
check('state: nobody signed in, codes off, upload limits given',
      code == 200 and st['user'] is None and st['otp'] is False and st['caps']['file'] > 0, str(st))
code, r = a.acc('otp', purpose='signup', phone='09121112233')
check('no SMS set up: a code cannot be asked for (503)', code == 503 and r['error'] == 'otp_off', str(r))
with open(os.path.join(DATA, 'sms.json'), 'w') as fh:
    json.dump({'api_key': 'test-key', 'customer_template': 807432, 'owner_template': 307865,
               'owner_mobile': '09141012567', 'endpoint': 'http://127.0.0.1:8139/v1/'}, fh)
check('SMS set up but no code template yet: still off', a.acc('state')[1]['otp'] is False)
code, r = ceo('settings_save', sms_tpl_otp='abc')
check('a template id that is not a number is refused', code == 422 and r['field'] == 'sms_tpl_otp', str(r))
code, r = adm('settings_save', sms_tpl_otp=str(OTP_TPL))
check('only the CEO sets template ids', code == 403)
code, r = ceo('settings_save', sms_tpl_otp='۵۵۵۰۰۱', sms_tpl_ticket=str(TICKET_TPL))
check('the CEO saves both template ids (Persian digits read)', code == 200 and r['sms']['otp'] == OTP_TPL
      and r['sms']['ticket'] == TICKET_TPL, str(r.get('sms')))
check('now codes are on', a.acc('state')[1]['otp'] is True)

print('\nsigning up with a code')
code, r = a.acc('otp', purpose='signup', phone='12345')
check('a wrong number is refused, by field', code == 422 and r['field'] == 'phone' and r['why'] == 'phone', str(r))
code, r = a.acc('otp', purpose='signup', phone='۰۹۱۲ ۱۱۱ ۲۲۳۳', name='م', password='x')
check('a bad name is refused before any SMS', code == 422 and r['field'] == 'name' and not sms(), str(r))
code, r = a.acc('otp', purpose='signup', phone='۰۹۱۲ ۱۱۱ ۲۲۳۳', name='مریم احمدی', password='123')
check('…and a short password too', code == 422 and r['field'] == 'password' and not sms(), str(r))
code, r = a.acc('otp', purpose='signup', phone='۰۹۱۲ ۱۱۱ ۲۲۳۳', name='مریم احمدی', password='tiffany-1')
sent = sms()
check('a code is texted with the code template', code == 200 and r['wait'] == 60 and len(sent) == 1
      and sent[0]['body']['templateId'] == OTP_TPL and sent[0]['body']['mobile'] == '09121112233'
      and re.fullmatch(r'\d{6}', sent[0]['body']['parameters'][0]['value'])
      and sent[0]['body']['parameters'][0]['name'] == 'CODE', str(sent))
check('the code is never stored as it is', last_code('09121112233') not in json.dumps(db('SELECT * FROM otps')))
code, r = a.acc('otp', purpose='signup', phone='09121112233')
check('asking again at once: wait (429) with seconds left', code == 429 and r['error'] == 'wait' and 0 < r['wait'] <= 60, str(r))
good = last_code('09121112233')
wrong = '11111' if good != '11111' else '22222'
code, r = a.acc('signup', phone='09121112233', code=wrong, name='مریم احمدی', password='tiffany-1')
check('a wrong code is refused', code == 422 and r['field'] == 'code' and r['why'] == 'wrong', str(r))
code, r = a.acc('signup', phone='09121112233', code=''.join('۰۱۲۳۴۵۶۷۸۹'[int(c)] for c in good),
                name='مریم احمدی', password='tiffany-1')
cookie = a.s.cookies.get('tf_shop')
check('the right code (typed in Persian digits) makes the account and signs in', code == 200
      and r['user'] == {'name': 'مریم احمدی', 'phone': '09121112233', 'since': r['user']['since']} and cookie, str(r))
raw = requests.post(f'{BASE}/api/account.php', json={'a': 'login', 'phone': '09121112233', 'password': 'tiffany-1'})
sc = raw.headers.get('Set-Cookie', '')
check('the sign-in cookie is HttpOnly, SameSite=Strict, for /api/ only', 'tf_shop=' in sc and 'HttpOnly' in sc
      and 'SameSite=Strict' in sc and 'path=/api/' in sc, sc)
check('the password is bcrypt', db("SELECT pass FROM customers WHERE phone = '09121112233'")[0][0].startswith('$2y$'))
check('a used code is gone', not db("SELECT 1 FROM otps WHERE phone = '09121112233'"))
code, r = a.acc('signup', phone='09121112233', code=good, name='مریم', password='tiffany-1')
check('the same code cannot make a second account', code == 422 and r['why'] == 'taken', str(r))
b = Shopper()
code, r = b.acc('otp', purpose='signup', phone='09121112233')
check('a registered number gets no sign-up code', code == 422 and r['why'] == 'taken' and len(sms()) == 1, str(r))

print('\nfive guesses per code, three minutes')
c = Shopper()
c.acc('otp', purpose='signup', phone='09122223344')
right = last_code('09122223344')
guesses = [c.acc('signup', phone='09122223344', code=g, name='سارا', password='tiffany-2')[1].get('why')
           for g in [x for x in ('10000', '10001', '10002', '10003', '10004', '10005') if x != right][:5]]
code, r = c.acc('signup', phone='09122223344', code=right, name='سارا', password='tiffany-2')
check('after five wrong guesses even the right code is spent', guesses == ['wrong'] * 5 and r.get('why') == 'spent', f'{guesses} {r}')
db("UPDATE otps SET sent_at = sent_at - 61 WHERE phone = '09122223344'")
c.acc('otp', purpose='signup', phone='09122223344')
db("UPDATE otps SET expires_at = 1 WHERE phone = '09122223344'")
code, r = c.acc('signup', phone='09122223344', code=last_code('09122223344'), name='سارا', password='tiffany-2')
check('an expired code is refused', code == 422 and r['why'] == 'expired', str(r))
for _ in range(3):
    db("UPDATE otps SET sent_at = sent_at - 61 WHERE phone = '09122223344'")
    c.acc('otp', purpose='signup', phone='09122223344')
db("UPDATE otps SET sent_at = sent_at - 61 WHERE phone = '09122223344'")
code, r = c.acc('otp', purpose='signup', phone='09122223344')
check('a sixth code in an hour for one number is refused', code == 429 and r['error'] == 'too_many', str(r))
db("DELETE FROM attempts WHERE k LIKE 'otp%'")
con = sqlite3.connect(os.path.join(DATA, 'tiffany.sqlite'))
con.executemany("INSERT INTO attempts (k, at) VALUES ('otp:all:signup', ?)", [(int(time.time()),)] * 150)
con.commit()
con.close()
code, r = Shopper().acc('otp', purpose='signup', phone='09125556677')
check('the whole shop sends at most 150 codes an hour (the SMS credit is the studio’s)', code == 429, str(r))
check('…noted once in error.log, not once per try', Shopper().acc('otp', purpose='signup', phone='09125556678')[0] == 429
      and open(os.path.join(DATA, 'error.log')).read().count("sms codes (signup): the hour's budget is used up") == 1)
known = db('SELECT phone FROM customers WHERE active = 1 LIMIT 1')
if known:
    code, r = Shopper().acc('otp', purpose='reset', phone=known[0][0])
    check('…which never uses up the password-reset codes (their own budget)', code == 200, str(r))
db("DELETE FROM attempts WHERE k LIKE 'otp%'")
db("DELETE FROM otps")
code, r = c.acc('otp', purpose='signup', phone='09990000000')
check('a code SMS that fails says so (502) and leaves no code', code == 502 and r['error'] == 'sms'
      and not db("SELECT 1 FROM otps WHERE phone = '09990000000'"), str(r))

print('\nsigning in, out, and a forgotten password')
code, st = a.acc('state')
check('state knows who is signed in', st['user']['phone'] == '09121112233' and len(st['csrf']) == 64, str(st))
csrf = a.csrf
a.csrf = ''
check('signing out needs the token', a.acc('logout')[0] == 403)
a.csrf = csrf
code, r = a.acc('logout')
check('…and then works', code == 200 and a.acc('state')[1]['user'] is None)
code, r = a.acc('login', phone='09121112233', password='wrong-one')
check('a wrong password: 401', code == 401 and r['error'] == 'wrong')
code, r = a.acc('login', phone='09129999999', password='wrong-one')
check('an unknown number: the same 401', code == 401 and r['error'] == 'wrong')
code, r = a.acc('login', phone='۰۹۱۲۱۱۱۲۲۳۳', password='tiffany-1')
check('the right password signs in (Persian digits too)', code == 200 and r['user']['name'] == 'مریم احمدی', str(r))
other = Shopper()
other.acc('login', phone='09121112233', password='tiffany-1')
check('a second phone signed in too', other.acc('state')[1]['user'] is not None)
code, r = b.acc('otp', purpose='reset', phone='09127777777')
check('reset for a number with no account says so', code == 422 and r['why'] == 'unknown', str(r))
db("DELETE FROM attempts WHERE k LIKE 'otp%'")
code, r = b.acc('otp', purpose='reset', phone='09121112233')
check('reset sends a code to the account holder', code == 200 and last_code('09121112233') is not None)
code, r = b.acc('reset', phone='09121112233', code=last_code('09121112233'), password='new-pass-9')
check('the code sets a new password and signs this phone in', code == 200 and r['user']['phone'] == '09121112233', str(r))
check('…every other phone is signed out', other.acc('state')[1]['user'] is None and a.acc('state')[1]['user'] is None)
check('…and the old password is dead', a.acc('login', phone='09121112233', password='tiffany-1')[0] == 401)
code, r = a.acc('login', phone='09121112233', password='new-pass-9')
check('the new one works', code == 200)
code, r = a.acc('profile', name='مریم احمدی‌نژاد')
check('the name can be changed', code == 200 and r['user']['name'] == 'مریم احمدی‌نژاد', str(r))
code, r = a.acc('password', current='nope', password='newer-pass-1')
check('changing the password needs the current one', code == 422 and r['field'] == 'current')
db("DELETE FROM attempts WHERE k LIKE 'clogin%'")
x = Shopper()
tries = [x.acc('login', phone='09121112233', password=f'bad-{i}')[0] for i in range(7)]
check('six wrong passwords from one place lock that place out (429)', tries[:6] == [401] * 6 and tries[6] == 429, str(tries))
db("DELETE FROM attempts WHERE k LIKE 'clogin%'")
r = requests.post(f'{BASE}/api/account.php', json={'a': 'state'}, headers={'Origin': 'https://evil.example'})
check('another site cannot use the account API', r.status_code == 403)

print('\ntickets: only for a signed-in customer')
anon = Shopper()
check('signed out: 401', anon.tix('list')[0] == 401)
csrf = a.csrf
a.csrf = ''
check('without the token: 403', a.tix('list')[0] == 403)
a.csrf = csrf
code, r = a.tix('create', files={}, subject='', body='')
check('an empty message is refused', code == 422 and r['why'] == 'empty', str(r))
code, r = a.tix('create', files={}, subject='سایز کاپشن', body='سلام، کاپشن چرم سایز M هم میاد؟', product='rib-tee')
t1 = r.get('ticket', {})
check('a text ticket with a product is made', code == 200 and re.fullmatch(r'T-\d{5}', t1.get('code', ''))
      and t1['status'] == 'open' and r['messages'][0]['body'].startswith('سلام')
      and r['messages'][0]['product'] == 'rib-tee' and 'rib-tee' in r['products'], str(r)[:400])
check('…the customer never sees team names', all(m['author'] == '' for m in r['messages']))
code, r = a.tix('create', files={}, body='یه سؤال', product='no-such-piece')
check('a product that is not in the shop is refused', code == 422 and r['field'] == 'product', str(r))

photo = jpeg_with_gps()
webm = b'\x1a\x45\xdf\xa3' + b'\x9f\x42\x86\x81\x01' + os.urandom(3000)
pdf = b'%PDF-1.4\n' + b'1 0 obj <<>> endobj\n' * 40 + b'%%EOF'
code, r = a.tix('create', files=[('files[]', ('IMG_2041.JPG', photo, 'image/jpeg')),
                                 ('files[]', ('فاکتور.pdf', pdf, 'application/pdf')),
                                 ('voice', ('blob', webm, 'audio/webm'))],
                subject='', body='', voice_secs='14')
t2 = r.get('ticket', {})
fs = (r.get('messages') or [{}])[0].get('files', [])
check('photo, PDF and a voice note go up together', code == 200 and [f['kind'] for f in fs] == ['image', 'file', 'audio'], str(r)[:500])
check('…an empty subject is filled in', t2.get('subject') == 'پیام بدون متن', str(t2))
img = fs[0] if fs else {}
check('…the photo is redrawn upright (EXIF turn applied)', img.get('w') == 1200 and img.get('h') == 1600, str(img))
check('…the voice note knows its length', fs[2]['voice'] is True and fs[2]['secs'] == 14 and fs[2]['mime'] == 'audio/webm', str(fs[2:]))
g = requests.get(BASE + img['url'])
served = Image.open(io.BytesIO(g.content)) if g.status_code == 200 else None
check('the photo link works, as a JPEG with no EXIF left (no GPS position)', served is not None
      and g.headers['Content-Type'] == 'image/jpeg' and b'Exif' not in g.content
      and not served.getexif().get_ifd(0x8825) and served.size == (1200, 1600), f'{g.status_code} {g.headers.get("Content-Type")}')
check('…sent in a sandbox, never sniffed', 'sandbox' in g.headers.get('Content-Security-Policy', '')
      and g.headers.get('X-Content-Type-Options') == 'nosniff' and g.headers['Content-Disposition'].startswith('inline'))
g = requests.get(BASE + fs[1]['url'])
check('the PDF downloads (attachment, its Persian name kept)', g.content == pdf
      and g.headers['Content-Disposition'].startswith('attachment') and "UTF-8''" in g.headers['Content-Disposition'])
g = requests.get(BASE + fs[2]['url'], headers={'Range': 'bytes=0-99'})
check('audio answers byte ranges (Safari needs them)', g.status_code == 206 and len(g.content) == 100
      and g.headers['Content-Range'] == f'bytes 0-99/{len(webm)}', f'{g.status_code} {g.headers.get("Content-Range")}')
g = requests.get(BASE + fs[2]['url'], headers={'Range': 'bytes=-10'})
check('…including the last bytes', g.status_code == 206 and g.content == webm[-10:])
fid = re.search(r'f=([a-f0-9]{20})', fs[0]['url']).group(1)
bad_sig = requests.get(f'{BASE}/api/file.php?f={fid}&e={int(time.time()) + 9000}&s={"0" * 32}')
check('a link with a made-up signature: 404', bad_sig.status_code == 404)
secret = db("SELECT v FROM settings WHERE k = 'file_secret'")[0][0]
past = int(time.time()) - 10
sig = hmac.new(secret.encode(), f'{fid}|{past}'.encode(), hashlib.sha256).hexdigest()[:32]
check('a correctly signed but expired link: 410', requests.get(f'{BASE}/api/file.php?f={fid}&e={past}&s={sig}').status_code == 410)
check('the files sit outside the web root, private (0600)',
      all(oct(os.stat(os.path.join(dp, f)).st_mode)[-3:] == '600' for dp, _, fn in os.walk(os.path.join(DATA, 'files')) for f in fn)
      and not os.path.exists('uploads/t'))

html = b'<html><script>alert(1)</script></html>'
code, r = a.tix('reply', code=t1['code'], body='x', files=[('files[]', ('note.pdf', html, 'application/pdf'))])
check('a web page dressed up as a PDF is refused', code == 422 and r['why'] == 'type', str(r))
svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
code, r = a.tix('reply', code=t1['code'], body='x', files=[('files[]', ('a.svg', svg, 'image/svg+xml'))])
check('…and so is an SVG', code == 422 and r['why'] == 'type')
code, r = a.tix('reply', code=t1['code'], body='x', files=[('files[]', (f'{i}.pdf', pdf, 'application/pdf')) for i in range(7)])
check('seven files in one message: refused', code == 422 and r['why'] == 'count', str(r))
code, r = a.tix('reply', code=t1['code'], body='x', files=[('files[]', ('big.pdf', b'%PDF-' + b'0' * (6 * 1024 * 1024), 'application/pdf'))])
check('a file over the host limit: refused by name', code == 422 and r['why'] == 'big' and 'big.pdf' in r['message'], str(r)[:300])
r2 = a.s.post(f'{BASE}/api/tickets.php', data={'a': 'reply', 'code': t1['code']}, headers={'X-CSRF': a.csrf},
              files=[('files[]', ('huge.pdf', b'%PDF-' + b'0' * (9 * 1024 * 1024), 'application/pdf'))])
check('a whole message over the host limit: 413, not a mystery', r2.status_code == 413 and r2.json()['error'] == 'too_big', r2.text[:200])
kept = sum(len(fn) for _, _, fn in os.walk(os.path.join(DATA, 'files')))
tmp = os.listdir(os.path.join(DATA, 'tmp')) if os.path.isdir(os.path.join(DATA, 'tmp')) else []
check('refused messages leave no files behind (only the first three are kept)', kept == 3 and tmp == [], f'{kept} kept, tmp {tmp}')

z = Shopper()
z.join('09123334455', name='نگار')
check('another customer cannot open my ticket (404)', z.tix('get', code=t1['code'])[0] == 404
      and z.tix('reply', code=t1['code'], body='hi', files={})[0] == 404)
check('…and lists only their own', z.tix('list')[1]['tickets'] == [])
code, r = a.tix('list')
check('my list: newest first, nothing unread', code == 200 and [t['code'] for t in r['tickets']] == [t2['code'], t1['code']]
      and all(t['unread'] == 0 for t in r['tickets']) and r['tickets'][0]['last_kind'] == 'image', str(r)[:300])

print('\nthe team answers')
code, r = adm('tickets')
row = by_code(r.get('tickets', []), t1['code'])
check('the panel lists tickets with the customer', code == 200 and len(r['tickets']) == 2 and r['counts']['open'] == 2
      and row.get('name') == 'مریم احمدی‌نژاد' and row.get('phone') == '09121112233' and row.get('unread') == 1, str(r)[:400])
code, r = adm('tickets', q='کاپشن')
check('…searchable (subject)', len(r['tickets']) == 1 and r['tickets'][0]['code'] == t1['code'])
check('…and by number', len(adm('tickets', q='۲۲۳۳')[1]['tickets']) == 2)
check('the badge counts tickets waiting', adm('ping')[1]['tickets'] == 2)
code, r = adm('ticket', code=t1['code'])
check('a thread for the team: customer, orders count, product card', code == 200 and r['customer']['phone'] == '09121112233'
      and r['customer']['orders'] == 0 and r['products']['rib-tee']['name']['fa'], str(r)[:300])
check('…opening it marks it read', by_code(adm('tickets')[1]['tickets'], t1['code']).get('unread') == 0)
before = len(sms())
code, r = adm.multi('ticket_reply', {'code': t1['code'], 'body': 'سلام مریم جان، بله سایز M داریم.'},
                    [('files[]', ('size.png', (lambda b: (Image.new('RGBA', (300, 200), (0, 0, 0, 0)).save(b, 'PNG'), b.getvalue())[1])(io.BytesIO()), 'image/png'))])
check('the team answers with a picture', code == 200 and r['ticket']['status'] == 'answered'
      and r['messages'][-1]['side'] == 's' and r['messages'][-1]['author'] == 'ادمین تست'
      and r['messages'][-1]['files'][0]['mime'] == 'image/png', str(r)[:300])
time.sleep(0.6)
tsms = [x for x in sms()[before:] if x['body']['templateId'] == TICKET_TPL]
check('the customer gets one «you have an answer» SMS: first name and code', len(tsms) == 1
      and tsms[0]['body']['mobile'] == '09121112233'
      and tsms[0]['body']['parameters'] == [{'name': 'NAME', 'value': 'مریم'}, {'name': 'CODE', 'value': t1['code']}], str(tsms))
adm.multi('ticket_reply', {'code': t1['code'], 'body': 'و رنگ مشکی هم هست.'}, [])
time.sleep(0.6)
check('…a second answer within 15 minutes sends no second SMS',
      len([x for x in sms()[before:] if x['body']['templateId'] == TICKET_TPL]) == 1)
code, st = a.acc('state')
check('the customer sees one ticket with unread answers', st['unread'] == 1, str(st))
code, r = a.tix('list')
row = by_code(r['tickets'], t1['code'])
check('…two unread messages in it', row.get('unread') == 2 and row.get('status') == 'answered', str(row))
code, r = a.tix('get', code=t1['code'])
check('…the thread shows «the team», not the name', r['messages'][-1]['side'] == 's' and r['messages'][-1]['author'] == '')
check('…and opening it clears the count', a.acc('state')[1]['unread'] == 0)
code, r = a.tix('reply', code=t1['code'], body='ممنون، یکی برام نگه دارید.', files={})
check('the customer replies: open again', code == 200 and r['ticket']['status'] == 'open')
code, r = adm('ticket_status', code=t1['code'], status='closed')
check('the team closes it', code == 200 and r['ticket']['status'] == 'closed')
code, r = a.tix('reply', code=t1['code'], body='یه سؤال دیگه', files={})
check('a customer writing in a closed ticket opens it again', r['ticket']['status'] == 'open')
code, r = a.tix('close', code=t1['code'])
check('the customer can close it themselves', r['ticket']['status'] == 'closed')
tid = db("SELECT id FROM tickets WHERE code = ?", t1['code'])[0][0]
mid = db("SELECT MIN(id) FROM ticket_msgs WHERE ticket_id = ? AND side = 'c'", tid)[0][0]
db("INSERT INTO ticket_files (id, ticket_id, msg_id, kind, name, mime, ext, size, created_at) VALUES ('q', ?, ?, 'file', 'q', 'application/pdf', 'pdf', ?, ?)",
   tid, mid, 300 * 1024 * 1024, int(time.time()))
code, r = a.tix('reply', code=t1['code'], body='یه فایل دیگه', files=[('files[]', ('x.pdf', pdf, 'application/pdf'))])
check('one customer uploads at most 300 MB a day', code == 429 and r['error'] == 'quota', str(r))
db("DELETE FROM ticket_files WHERE id = 'q'")
for i in range(4):
    a.tix('create', files={}, body=f'سؤال {i}')
code, r = a.tix('create', files={}, body='ششمی')
check('five open tickets at once is the most', code == 422 and r['why'] == 'open', str(r))
check('the panel log names the answer', any(l['action'] == 'ticket_reply' for l in ceo('log')[1]['log']))

print('\nstories')
big = Image.new('RGB', (1400, 2400), (30, 90, 160))
b = io.BytesIO()
big.save(b, 'JPEG', quality=88)
code, r = adm.multi('story_add', {'caption_fa': 'کالکشن جدید', 'items': json.dumps(['rib-tee', 'nope', 'alphabet-tee'])},
                    [('media', ('story.jpg', b.getvalue(), 'image/jpeg'))])
s1 = r.get('story', {})
check('an admin posts a photo story, unknown pieces dropped', code == 200 and s1['kind'] == 'image'
      and s1['items'] == ['rib-tee', 'alphabet-tee'] and s1['caption']['fa'] == 'کالکشن جدید', str(r)[:300])
check('…made at 1080 and 540 wide, aspect kept', s1['w'] == 1080 and s1['h'] == 1851
      and os.path.isfile(s1['media'] + '-1080.webp') and os.path.isfile(s1['media'] + '-540.webp'), str(s1))
check('…for exactly 24 hours', s1['expires_at'] - s1['created_at'] == 86400)
mp4 = open('tests/story-h264.mp4', 'rb').read()          # 3 s, H.264, made with ffmpeg
poster = io.BytesIO()
Image.new('RGB', (720, 1280), (10, 10, 10)).save(poster, 'JPEG')
code, r = ceo.multi('story_add', {'w': '720', 'h': '1280', 'items': '[]'},
                    [('media', ('clip.mp4', mp4, 'video/mp4')), ('poster', ('p.jpg', poster.getvalue(), 'image/jpeg'))])
s2 = r.get('story', {})
check('a video story (H.264) with its cover', code == 200 and s2['kind'] == 'video' and s2['media'].endswith('.mp4')
      and s2['poster'].startswith('uploads/s/') and s2['w'] == 720, str(r)[:300])
hevc = open('tests/story-hevc.mp4', 'rb').read()         # the same clip as HEVC, like an iPhone's default
code, r = ceo.multi('story_add', {}, [('media', ('IMG_1.MOV', hevc, 'video/quicktime'))])
check('an HEVC video is refused with the iPhone setting to change', code == 422 and 'Most Compatible' in r['message'], str(r))
gif = io.BytesIO()
Image.new('RGB', (10, 10)).save(gif, 'GIF')
check('a GIF is refused', ceo.multi('story_add', {}, [('media', ('a.gif', gif.getvalue(), 'image/gif'))])[0] == 422)
check('a text file is refused', ceo.multi('story_add', {}, [('media', ('a.txt', b'hello', 'text/plain'))])[0] == 422)
real = [p['id'] for p in requests.get(f'{BASE}/api/catalog.php').json()['products']]
code, r = ceo.multi('story_add', {'items': json.dumps(real[:7])}, [('media', ('s.jpg', b.getvalue(), 'image/jpeg'))])
check('seven pieces on one story: refused', code == 422 and r['field'] == 'items', str(r))
cat = requests.get(f'{BASE}/api/catalog.php').json()
check('the shop gets the live stories, newest first', [s['id'] for s in cat['stories'][:2]] == [s2['id'], s1['id']], str(cat.get('stories'))[:300])
code, r = adm('story_end', id=s1['id'])
cat = requests.get(f'{BASE}/api/catalog.php').json()
check('ending one takes it off the shop at once', s1['id'] not in [s['id'] for s in cat['stories']])
code, r = adm('stories')
check('…it waits in the archive', s1['id'] in [s['id'] for s in r['archive']] and s2['id'] in [s['id'] for s in r['live']])
time.sleep(1.1)                                  # a later second than the video
code, r = adm('story_repost', id=s1['id'])
cat = requests.get(f'{BASE}/api/catalog.php').json()
check('posting it again: another 24 hours, at the front', cat['stories'][0]['id'] == s1['id']
      and r['story']['expires_at'] - r['story']['created_at'] == 86400)
db('UPDATE stories SET expires_at = ? WHERE id = ?', int(time.time()) - 1, s2['id'])
cat = requests.get(f'{BASE}/api/catalog.php').json()
check('a story past its 24 hours is gone from the shop by itself', s2['id'] not in [s['id'] for s in cat['stories']])
code, r = adm('story_edit', id=s1['id'], caption={'fa': 'تخفیف پاییزه', 'en': 'Autumn offer', 'tr': ''}, items=['alphabet-tee'])
check('caption and pieces can be changed', r['story']['caption'] == {'fa': 'تخفیف پاییزه', 'en': 'Autumn offer', 'tr': ''}
      and r['story']['items'] == ['alphabet-tee'], str(r))
check('a story starts with no link', s1.get('link') == [] and r['story']['link'] == [], str(r['story'].get('link')))

print('\nstory links (2026-10-20)')
check('the database is on version 7, stories carry a link',
      db('PRAGMA user_version')[0][0] == 7 and 'link' in {c[1] for c in db('PRAGMA table_info(stories)')})
code, r = ceo.multi('story_add', {'items': '[]', 'link': json.dumps({'url': f'#/p/{real[0]}', 'label': {'fa': 'ببینش'}})},
                    [('media', ('l.jpg', b.getvalue(), 'image/jpeg'))])
s3 = r.get('story', {})
check('a new story can point at a piece', code == 200 and s3['link'] == {'url': f'#/p/{real[0]}', 'label': {'fa': 'ببینش', 'en': '', 'tr': ''}}, str(r)[:300])
cat = requests.get(f'{BASE}/api/catalog.php').json()
check('…and the shop gets the link', next(s for s in cat['stories'] if s['id'] == s3['id'])['link']['url'] == f'#/p/{real[0]}')
for wrong in ['javascript:alert(1)', 'data:text/html,hi', 'tiffanybv.com', '#/p/../admin', '#/admin', 'https://a.b/"onload="x',
            'ftp://files.example.com/a', 'https://' + 'a' * 300 + '.com']:
    code, r = adm('story_edit', id=s3['id'], caption={'fa': ''}, items=[], link={'url': wrong, 'label': {'fa': 'x'}})
    check(f'a bad link is refused: {wrong[:30]}', code == 422 and r.get('field') == 'link', str(r)[:200])
check('…and the story keeps its old link', adm('stories')[1]['live'][0]['link']['url'] == f'#/p/{real[0]}')
code, r = adm('story_edit', id=s3['id'], caption={'fa': ''}, items=[],
              link={'url': 'https://instagram.com/tiffanyiran', 'label': {'fa': 'اینستاگرام', 'en': 'Instagram'}})
check('an outside address with its words', code == 200 and r['story']['link']['url'] == 'https://instagram.com/tiffanyiran'
      and r['story']['link']['label']['en'] == 'Instagram', str(r)[:300])
for good in ['#/c/aw27-denim-red', '#/shop', '#/shop?cat=knit', 'http://example.com/a?b=1&c=2']:
    code, r = adm('story_edit', id=s3['id'], caption={'fa': ''}, items=[], link={'url': good})
    check(f'a good link is kept: {good}', code == 200 and r['story']['link']['url'] == good, str(r)[:200])
code, r = adm('story_edit', id=s3['id'], caption={'fa': ''}, items=[], link={'url': ''})
check('an empty address takes the button off', code == 200 and r['story']['link'] == [])
db('UPDATE stories SET link = ? WHERE id = ?', '{"url":"javascript:alert(1)","label":{"fa":"x"}}', s3['id'])
cat = requests.get(f'{BASE}/api/catalog.php').json()
check('a bad link written straight into the database is never served',
      next(s for s in cat['stories'] if s['id'] == s3['id'])['link'] == [])
adm('story_delete', id=s3['id'])

print('\ncampaign stories (the studio\'s outfit stories)')
check('the panel and the shop start with no changes', adm('stories')[1]['looks'] == {} and cat['looks'] == {})
code, r = adm('look_save', id='r3', look={'title': {'fa': 'ست جین'}, 'caption': {'fa': 'جین روی جین', 'en': 'Denim on denim'},
                                         'items': [real[2], 'nope', real[1], real[2]], 'link': {'url': '#/c/aw27-denim-red', 'label': {'fa': 'کالکشن'}}})
check('a campaign story: new words, pieces (unknown and twice dropped) and a link',
      code == 200 and r['looks']['r3']['title']['fa'] == 'ست جین' and r['looks']['r3']['items'] == [real[2], real[1]]
      and r['looks']['r3']['link']['url'] == '#/c/aw27-denim-red' and 'hidden' not in r['looks']['r3'], str(r)[:400])
cat = requests.get(f'{BASE}/api/catalog.php').json()
check('…the shop gets it', cat['looks'].get('r3', {}).get('caption', {}).get('en') == 'Denim on denim', str(cat.get('looks'))[:300])
code, r = adm('look_save', id='r5', look={'hidden': True})
check('a campaign story can be hidden', code == 200 and r['looks']['r5'] == {'hidden': True} and 'r3' in r['looks'])
check('nine pieces on one: refused', adm('look_save', id='r6', look={'items': real[:9]})[0] == 422)
check('a bad link: refused', adm('look_save', id='r6', look={'link': {'url': 'javascript:x'}})[1].get('field') == 'link')
check('a strange story id: refused', adm('look_save', id='../x', look={'hidden': True})[0] == 400)
code, r = adm('look_save', id='r5', look={})
check('saving no changes drops the entry', code == 200 and 'r5' not in r['looks'] and 'r3' in r['looks'])
code, r = adm('look_reset', id='r3')
check('back to the original', code == 200 and r['looks'] == {})
check('campaign stories need the panel', Panel()('look_save', id='r3', look={'hidden': True})[0] == 401)
check('the panel log names the change', any(l['action'] in ('look_save', 'look_reset') for l in ceo('log')[1]['log']))
db("UPDATE settings SET v = ? WHERE k = 'looks_edit'", '{"r1":{"hidden":true},"../x":{"hidden":true},"r2":"nope"}')
cat = requests.get(f'{BASE}/api/catalog.php').json()
check('a broken entry in the database is dropped, not served', cat['looks'] == {'r1': {'hidden': True}}, str(cat['looks']))
adm('look_reset', id='r1')

print('\nversion 7: the live pieces move into the eleven collections, nothing else changes')
tpl, tcat, tsort, tcreated = db('SELECT data, cat, sort, created_at FROM products LIMIT 1')[0]
def put(pid, **kw):
    d = {**json.loads(tpl), 'id': pid, **kw}
    db('INSERT OR REPLACE INTO products (id, data, cat, price, visible, sort, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
       pid, json.dumps(d, ensure_ascii=False), tcat, d['price'], 1, tsort, tcreated, 1700000000)
put('mohair-top', col='aw27', price=4321000, stock={'OS': 2}, images=['assets/img/r-mohair-top', 'uploads/p/own-photo'])
put('white-wool-knit', col='aw27', images=['assets/img/r-white-wool-knit', 'assets/img/r-white-wool-knit-2'])
put('karl-lagerfeld-bag', col='aw27', images=['assets/img/r-karl-lagerfeld-bag', 'assets/img/r-karl-lagerfeld-bag-2'])
put('panel-own-piece', col='aw27')
put('demo-piece', col='noir')
db('PRAGMA user_version = 6')
by = {p['id']: p for p in requests.get(f'{BASE}/api/catalog.php').json()['products']}
check('the migration ran once (version 7)', db('PRAGMA user_version')[0][0] == 7)
check('a piece moves to its set; a price, stock and photo the panel changed stay',
      by['mohair-top']['col'] == 'aw27-pink-mohair' and by['mohair-top']['price'] == 4321000
      and by['mohair-top']['images'] == ['assets/img/r-mohair-top', 'uploads/p/own-photo']
      and json.loads(db("SELECT data FROM products WHERE id = 'mohair-top'")[0][0])['stock'] == {'OS': 2}, str(by['mohair-top'])[:300])
check('the knit loses only its second crop (the one that showed the bag)',
      by['white-wool-knit']['images'] == ['assets/img/r-white-wool-knit'] and by['white-wool-knit']['col'] == 'aw27-grey-red')
check('other photos are left alone', by['karl-lagerfeld-bag']['images'] == ['assets/img/r-karl-lagerfeld-bag', 'assets/img/r-karl-lagerfeld-bag-2']
      and by['karl-lagerfeld-bag']['col'] == 'aw27-black-leather')
check('a piece the panel added leaves «aw27» for no collection; another collection is not touched',
      by['panel-own-piece']['col'] == '' and by['demo-piece']['col'] == 'noir')
check('…and only the changed pieces are marked as changed', db("SELECT updated_at FROM products WHERE id = 'demo-piece'")[0][0] == 1700000000
      and db("SELECT updated_at FROM products WHERE id = 'mohair-top'")[0][0] > 1700000000)
for pid in ['mohair-top', 'white-wool-knit', 'karl-lagerfeld-bag', 'panel-own-piece', 'demo-piece']:
    db('DELETE FROM products WHERE id = ?', pid)

files = [s2['media'], s2['poster'] + '-540.webp', s2['poster'] + '-1080.webp']
code, r = adm('story_delete', id=s2['id'])
check('deleting a story removes its files', code == 200 and not any(os.path.exists(f) for f in files))
check('stories need the panel (signed out: 401)', Panel()('stories')[0] == 401)

print('\nrush: twelve customers writing with photos at the same moment')
from concurrent.futures import ThreadPoolExecutor
db('DELETE FROM attempts')
crowd = []
for i in range(12):
    u = Shopper()
    u.join(f'0918{i:07d}', name=f'مشتری {i}')
    crowd.append(u)
db('DELETE FROM attempts')
pic = io.BytesIO()
Image.new('RGB', (700, 500), (10, 120, 90)).save(pic, 'JPEG')


def write(u):
    code, r = u.tix('create', files=[('files[]', ('a.jpg', pic.getvalue(), 'image/jpeg'))], body='اول')
    out = [code]
    for k in range(3):
        out.append(u.tix('reply', code=r.get('ticket', {}).get('code', ''), body=f'پیام {k}',
                         files=[('files[]', ('b.jpg', pic.getvalue(), 'image/jpeg'))])[0])
    return out


rows_before = db('SELECT COUNT(*) FROM ticket_files')[0][0]
with ThreadPoolExecutor(12) as ex:
    res = list(ex.map(write, crowd))
got = db("SELECT COUNT(*) FROM ticket_msgs m JOIN tickets t ON t.id = m.ticket_id JOIN customers c ON c.id = t.customer_id WHERE c.phone LIKE '0918%'")[0][0]
check('48 messages at once: every one answered 200, none lost', all(c == 200 for r in res for c in r) and got == 48,
      f'{res} {got}')
rows = db('SELECT COUNT(*) FROM ticket_files')[0][0]
disk = sum(len(fn) for _, _, fn in os.walk(os.path.join(DATA, 'files')))
check('…48 photos kept, and every file row has its file on disk', rows - rows_before == 48 and disk == rows, f'{rows - rows_before} {disk} {rows}')

print('\nthe rest of the shop still answers')
check('catalogue', requests.get(f'{BASE}/api/catalog.php').status_code == 200)
check('a GET to tickets.php: 405', requests.get(f'{BASE}/api/tickets.php').status_code == 405)
log = open(os.path.join(DATA, 'error.log')).read().strip().splitlines() if os.path.exists(os.path.join(DATA, 'error.log')) else []
check('error.log holds only the two lines this test caused: the SMS ceiling and the SMS meant to fail',
      len(log) == 2 and "the hour's budget is used up" in log[0] and 'sms otp to 0999…00' in log[1], '\n'.join(log[-5:]))

for f in os.listdir('uploads/s') if os.path.isdir('uploads/s') else []:
    os.remove(os.path.join('uploads/s', f))
print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
