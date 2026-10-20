"""The crawlable side of the shop: /p/…, /c/…, /shop, the sitemap, llms.txt,
robots.txt and the head of index.html — and a browser landing on them.

    mkdir -p /tmp/tf-seo && cp catalog/real/catalog-import.json /tmp/tf-seo/
    TIFFANY_DATA=/tmp/tf-seo php -S 127.0.0.1:8150 tests/router.php
    python3 seo_test.py http://127.0.0.1:8150

tests/router.php reads the rewrite rules from .htaccess, so these are the
host's own rules. What the pages say about collections and shops comes from
api/lib/site.php; this test fails when that drifts from js/data.js and
js/config.js (read here through Node)."""
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

import requests
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8150').rstrip('/')
ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://tiffanybv.com'
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
ok = bad = 0


def check(name, cond, extra=''):
    global ok, bad
    if cond:
        ok += 1
        print('  ok  ', name)
    else:
        bad += 1
        print('  FAIL', name, extra)


class Head(HTMLParser):
    """Every <meta>, <link>, <title>, <base> and JSON-LD block of a page."""

    def __init__(self, html):
        super().__init__()
        self.meta, self.links, self.ld, self.base, self.title = [], [], [], [], []
        self._in, self._buf = None, ''
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta':
            self.meta.append(a)
        elif tag == 'link':
            self.links.append(a)
        elif tag == 'base':
            self.base.append(a.get('href'))
        elif tag == 'title' or (tag == 'script' and a.get('type') == 'application/ld+json'):
            self._in, self._buf = tag, ''

    def handle_data(self, data):
        if self._in:
            self._buf += data

    def handle_endtag(self, tag):
        if self._in == tag:
            (self.title if tag == 'title' else self.ld).append(self._buf)
            self._in = None

    def prop(self, key, attr='property'):
        return [m.get('content') for m in self.meta if m.get(attr) == key]

    def canon(self):
        return [l.get('href') for l in self.links if l.get('rel') == 'canonical']


def local(url):
    """An absolute address on the site, as a file in this folder (or None)."""
    if not url.startswith(SITE + '/'):
        return None
    return os.path.join(ROOT, url[len(SITE) + 1:])


def fa_digits(n):
    return f'{n:,}'.replace(',', '٬').translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹'))


# What the shop's own code says (js/data.js, js/config.js), through Node.
NODE = r"""
globalThis.document = { documentElement: { lang: '', dir: '' } };
globalThis.sessionStorage = { getItem: () => process.argv[2], setItem() {} };
const d = await import(process.argv[1] + '/js/data.js');
const c = await import(process.argv[1] + '/js/config.js');
process.stdout.write(JSON.stringify({ cols: d.COLLECTIONS.map((x) => ({ id: x.id, name: x.name, img: x.img })),
  stores: c.STORES, brand: c.BRAND }));
"""
JS, EN = (json.loads(subprocess.run(['node', '--input-type=module', '-e', NODE, ROOT, lang],
                                    capture_output=True, text=True, check=True).stdout) for lang in ('fa', 'en'))
PHP = json.loads(subprocess.run(['php', '-r', f"""require '{ROOT}/api/lib/site.php';
    echo json_encode(['cols' => TF_COLLECTIONS, 'stores' => TF_STORES, 'wa' => TF_WHATSAPP, 'email' => TF_EMAIL],
    JSON_UNESCAPED_UNICODE);"""], capture_output=True, text=True, check=True).stdout)
BOOT_COLS = re.findall(r"'(aw27-[a-z-]+)'", re.search(r'const TF_COLS\s*=\s*\[(.*?)\];', open(
    os.path.join(ROOT, 'api/lib/boot.php')).read(), re.S).group(1))
ADMIN_COLS = re.findall(r"\['(aw27-[a-z-]+)'", re.search(r'const COLS = \[(.*?)\];', open(
    os.path.join(ROOT, 'admin/admin.js')).read(), re.S).group(1))

print('\nthe same collections and shops everywhere')
ids = [c['id'] for c in JS['cols']]
check('eleven collections in the shop', len(ids) == 11, str(ids))
check('site.php names the same collections, in the same order, with the same names and covers',
      [(k, v[0], v[1]) for k, v in PHP['cols'].items()] == [(c['id'], c['name'], c['img']) for c in JS['cols']])
check('the server accepts exactly these (boot.php TF_COLS)', BOOT_COLS == ids, str(BOOT_COLS))
check('the panel offers exactly these', ADMIN_COLS == ids, str(ADMIN_COLS))
check('every collection cover exists at 480, 960 and 1440',
      all(os.path.isfile(os.path.join(ROOT, f'assets/img/{c["img"]}-{w}.webp')) for c in JS['cols'] for w in (480, 960, 1440)))
check('the four shops match js/config.js, word for word, in Persian and English',
      [list(s) for s in PHP['stores']] == [[f['name'], e['name'], f['city'], e['city'], f['address'], e['address'],
                                            f.get('tel', ''), f.get('postal', '')] for f, e in zip(JS['stores'], EN['stores'])],
      str(PHP['stores'])[:200])
check('WhatsApp and email match js/config.js', PHP['wa'].lstrip('+') in json.dumps(JS['brand'])
      and PHP['email'] in json.dumps(JS['brand']), str(JS['brand'])[:200])

products = requests.get(BASE + '/api/catalog.php').json()['products']
visible = [p for p in products if p.get('visible', True) and p['images']]
check('the catalogue is loaded', len(visible) >= 1, str(len(visible)))

print('\nindex.html')
r = requests.get(BASE + '/')
h = Head(r.text)
check('one title, one description, one canonical', len(h.title) == 1 and len(h.prop('description', 'name')) == 1
      and h.canon() == [SITE + '/'], str(h.canon()))
check('the title names the brand, in Persian and Latin', 'TIFFANY by Vanda' in h.title[0] and 'تیفانی' in h.title[0], h.title[0])
og = h.prop('og:image')
check('the share card is the new collection, 1200 x 630, and exists', og == [SITE + '/assets/img/og-aw27.jpg']
      and h.prop('og:image:width') == ['1200'] and h.prop('og:image:height') == ['630'] and os.path.isfile(local(og[0])))
graph = [json.loads(x) for x in h.ld]
types = [g['@type'] for x in graph for g in x.get('@graph', [x])]
check('schema.org: the brand, the website and the four shops', types.count('Organization') == 1 and types.count('WebSite') == 1
      and types.count('ClothingStore') == 4, str(types))

print('\nevery piece has its own page')
problems = []
for p in visible:
    url = f'{SITE}/p/{p["id"]}'
    r = requests.get(f'{BASE}/p/{p["id"]}')
    h = Head(r.text)
    if r.status_code != 200 or 'text/html' not in r.headers.get('Content-Type', ''):
        problems.append(f'{p["id"]}: {r.status_code}')
        continue
    lds = [json.loads(x) for x in h.ld]
    prod = [x for x in lds if x.get('@type') == 'Product']
    crumbs = [x for x in lds if x.get('@type') == 'BreadcrumbList']
    imgs = prod[0]['image'] if prod else []
    why = []
    if h.canon() != [url] or h.prop('og:url') != [url]:
        why.append('canonical')
    if len(h.title) != 1 or not h.title[0].startswith(p['name']['fa']):
        why.append('title')
    if len(h.prop('description', 'name')) != 1 or len(h.prop('og:description')) != 1:
        why.append('description')
    if h.base != ['/']:
        why.append('base')
    if h.prop('robots', 'name'):
        why.append('robots')
    if len(prod) != 1 or prod[0]['offers']['price'] != p['price'] * 10 or prod[0]['offers']['priceCurrency'] != 'IRR':
        why.append('price')
    if not prod or prod[0]['sku'] != p['id'] or prod[0]['brand']['name'] != 'TIFFANY by Vanda':
        why.append('product')
    if len(imgs) != len(p['images']) or not all(local(i) and os.path.isfile(local(i)) for i in imgs):
        why.append('images')
    if not h.prop('og:image') or not os.path.isfile(local(h.prop('og:image')[0]) or ''):
        why.append('og:image')
    if len(crumbs) != 1 or crumbs[0]['itemListElement'][-1]['item'] != url:
        why.append('breadcrumb')
    if p['col'] and (len(crumbs[0]['itemListElement']) != 3 or crumbs[0]['itemListElement'][1]['item'] != f'{SITE}/c/{p["col"]}'):
        why.append('collection crumb')
    body = r.text.split('<main id="app"', 1)[-1]
    if p['name']['fa'] not in body or fa_digits(p['price']) not in body:
        why.append('page text')
    if why:
        problems.append(f'{p["id"]}: {", ".join(why)}')
check(f'{len(visible)} piece pages: one canonical, title, description; price ×10 in rials; '
      'photos that exist; breadcrumb; the facts in the page', not problems, str(problems[:5]))

if os.environ.get('TIFFANY_DATA'):
    import sqlite3
    con = sqlite3.connect(os.path.join(os.environ['TIFFANY_DATA'], 'tiffany.sqlite'))
    pid = visible[1]['id']
    old = con.execute('SELECT data FROM products WHERE id = ?', (pid,)).fetchone()[0]
    d = json.loads(old)
    d['note'] = {'fa': r'یادداشت $1 و \1 و $0 و ${1}', 'en': '', 'tr': ''}
    d['name'] = {**d['name'], 'fa': d['name']['fa'] + r' $0'}
    con.execute('UPDATE products SET data = ? WHERE id = ?', (json.dumps(d, ensure_ascii=False), pid))
    con.commit()
    t = requests.get(f'{BASE}/p/{pid}').text
    h = Head(t)
    check('«$1», «\\1» and «$0» in a piece\'s words stay text in its page', t.count('<main id="app"') == 1
          and len(h.title) == 1 and h.title[0].startswith(d['name']['fa']) and r'یادداشت $1 و \1 و $0 و ${1}' in t
          and json.loads([x for x in h.ld if '"Product"' in x][0])['name'] == d['name']['fa'], h.title[:1])
    con.execute('UPDATE products SET data = ? WHERE id = ?', (old, pid))
    con.commit()
    con.close()

print('\ncollections and the shop')
problems = []
for c in JS['cols']:
    r = requests.get(f'{BASE}/c/{c["id"]}')
    h = Head(r.text)
    lds = [json.loads(x) for x in h.ld]
    page = [x for x in lds if x.get('@type') == 'CollectionPage']
    own = [p for p in visible if p['col'] == c['id']]
    if r.status_code != 200 or h.canon() != [f'{SITE}/c/{c["id"]}'] or not page:
        problems.append(f'{c["id"]}: {r.status_code} {h.canon()}')
        continue
    listed = [x['url'] for x in page[0]['mainEntity']['itemListElement']]
    if listed != [f'{SITE}/p/{p["id"]}' for p in own] or not own:
        problems.append(f'{c["id"]}: {len(listed)} listed, {len(own)} pieces')
    if c['name'] not in h.title[0]:
        problems.append(f'{c["id"]}: title {h.title[0]}')
check('eleven collection pages, each listing its own pieces', not problems, str(problems[:4]))
r = requests.get(BASE + '/shop')
h = Head(r.text)
lds = [json.loads(x) for x in h.ld]
listed = [x['url'] for x in lds[0]['mainEntity']['itemListElement']]
check('/shop lists every piece and links every collection', r.status_code == 200 and len(listed) == len(visible)
      and all(f'href="/c/{i}"' in r.text for i in ids), f'{len(listed)} / {len(visible)}')

print('\naddresses that are not there')
for path, code in [('/p/no-such-piece', 404), ('/c/aw27', 404), ('/c/nope', 404), ('/seo.php?k=nope', 404)]:
    r = requests.get(BASE + path)
    h = Head(r.text)
    check(f'{path}: {code}, not indexed, still the shop', r.status_code == code and h.prop('robots', 'name') == ['noindex']
          and 'id="app"' in r.text)
r = requests.get(BASE + '/seo.php', params={'k': 'p', 'id': '<script>alert(1)</script>'})
r2 = requests.get(BASE + '/seo.php', params={'k': 'c', 'id': '"><img src=x onerror=alert(1)>'})
check('a hostile id is never written into the page', r.status_code == 404 and r2.status_code == 404
      and 'alert(1)' not in r.text and 'alert(1)' not in r2.text)

r = requests.get(BASE + '/join', allow_redirects=False)
check('tiffanybv.com/join (the QR code) sends the visitor to the shop with sign-up open',
      r.status_code == 302 and r.headers.get('Location') == '/#/join', f"{r.status_code} {r.headers.get('Location')}")

print('\nsitemap, llms.txt, robots.txt')
r = requests.get(BASE + '/sitemap.xml')
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9', 'i': 'http://www.google.com/schemas/sitemap-image/1.1'}
tree = ET.fromstring(r.content)
locs = [u.find('s:loc', ns).text for u in tree.findall('s:url', ns)]
imgs = [i.text for i in tree.iter('{http://www.google.com/schemas/sitemap-image/1.1}loc')]
want = [SITE + '/', SITE + '/shop'] + [f'{SITE}/c/{i}' for i in ids] + [f'{SITE}/p/{p["id"]}' for p in visible]
check('the sitemap is XML and lists home, shop, every collection and every piece', r.headers['Content-Type'].startswith('application/xml')
      and locs == want, f'{len(locs)} vs {len(want)}')
check(f'…with {len(imgs)} photos, every one a file that exists', imgs and all(os.path.isfile(local(i) or '') for i in imgs),
      str([i for i in imgs if not os.path.isfile(local(i) or '')][:3]))
r = requests.get(BASE + '/llms.txt')
t = r.text
check('llms.txt is plain text and names the brand, every collection and every piece with its price',
      r.headers['Content-Type'].startswith('text/plain') and t.startswith('# TIFFANY by Vanda')
      and all(f'{SITE}/c/{i})' in t for i in ids)
      and all(f'{SITE}/p/{p["id"]}): {p["price"]:,} toman' in t for p in visible), t[:120])
r = requests.get(BASE + '/robots.txt')
check('robots.txt: the sitemap, and the shop open to search and AI crawlers, the API and panel closed',
      f'Sitemap: {SITE}/sitemap.xml' in r.text and 'Disallow: /api/' in r.text and 'Disallow: /admin/' in r.text
      and 'GPTBot' in r.text and 'Disallow: /\n' not in r.text)

print('\na visitor landing from a search result')
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    ctx.add_init_script("try{localStorage.setItem('tiffany.a2hs','{\"done\":true}');"
                        "sessionStorage.setItem('tiffany.consent.later','later')}catch(e){}")
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    pid = visible[0]['id']
    page.goto(f'{BASE}/p/{pid}')
    page.wait_for_selector('#boot', state='detached', timeout=15000)
    page.wait_for_selector('.buybar')
    check('/p/<id> opens that piece in the shop', page.evaluate('location.hash') == f'#/p/{pid}'
          and page.evaluate('location.pathname') == f'/p/{pid}' and visible[0]['name']['fa'] in page.inner_text('#app'))
    check('…its styles and modules load from the root (no broken /p/js/…)', not errors and page.evaluate(
        "getComputedStyle(document.body).fontFamily").startswith('IRANYekanX'), str(errors[:2]))
    page.evaluate('window.__stay = 1')
    page.evaluate("document.querySelectorAll('.spec details').forEach(d => d.open = true)")
    page.locator('.spec a[href="#/terms"]').click()
    page.wait_for_timeout(800)
    check('a plain «#/terms» link on a landing page is a step inside the shop, not a new page load',
          page.evaluate('window.__stay') == 1 and page.evaluate('location.pathname + location.hash') == '/#/terms', page.url)
    page.evaluate("document.querySelector('#topbarBack').click()")
    page.wait_for_timeout(800)
    check('…and the back arrow returns to the piece', page.evaluate('location.hash') == f'#/p/{pid}'
          and page.locator('.buybar').count() == 1, page.url)
    page.goto(f'{BASE}/p/{pid}')
    page.wait_for_selector('.buybar')
    page.locator('.pdp-back').click()
    page.wait_for_timeout(800)
    check('the back arrow goes to the shop home, on the shop\'s own address', page.evaluate('location.pathname') == '/'
          and page.locator('.hero').count() == 1, page.url)
    col = ids[3]
    page.goto(f'{BASE}/c/{col}')
    page.wait_for_selector('.grid-p .card')
    page.locator('.grid-p .card-open').first.click()
    page.wait_for_selector('.buybar')
    check('a piece opened from a landing page has the shop\'s address (/#/p/…)', page.evaluate('location.pathname') == '/'
          and page.evaluate('location.hash').startswith('#/p/'), page.url)
    page.go_back()
    page.wait_for_timeout(900)
    check('…and the browser back returns to the collection', page.evaluate('location.hash') == f'#/c/{col}'
          and page.locator('.grid-p .card').count() >= 1, page.url)
    page.goto(f'{BASE}/shop')
    page.wait_for_selector('.grid-p .card')
    check('/shop opens the shop', page.evaluate('location.hash') == '#/shop'
          and page.locator('.grid-p .card').count() == len(visible))
    check('no script errors', not errors, str(errors[:3]))
    browser.close()

print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
