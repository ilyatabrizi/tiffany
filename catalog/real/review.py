import sys, json, base64, io, html, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import catalog as C
from parse_group import posts
from check import MAP
from PIL import Image
S = pathlib.Path(sys.argv[1]); IMG = S / 'draft' / 'img'; OUT = S / 'review' / 'index.html'
OUT.parent.mkdir(exist_ok=True)
FA = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')
def toman(n): return f'{n:,}'.replace(',', '٬').translate(FA)
def b64(path, w=None):
    im = Image.open(path)
    if w and im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=78, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
SZ = {'OS': 'فری‌سایز'}
byid = {p['id']: p for p in C.P}
cat = json.loads((S / 'draft' / 'catalog-import.json').read_text())
catid = {c['id']: c for c in cat}
looks = json.loads((S / 'draft' / 'looks.json').read_text())
CATS = {'knit': 'بافت', 'hoodie': 'هودی و سوشرت', 'vest': 'وست', 'shirt': 'شومیز', 'trousers': 'شلوار',
        'skirts': 'دامن', 'jacket': 'کاپشن', 'cardigan': 'ژاکت', 'accessories': 'اکسسوری', 'shoes': 'کفش'}
FLAG = {
 'cotton-shirt': 'C19 writes this shirt\'s price as ۹۹۰۰۰۰. Your answer: ۷٬۹۹۰٬۰۰۰.',
 'waterproof-leather-bomber': 'C12 gives no sizes. Your answer: S, M, L.',
 'wool-teddy-coat': 'Your answer: five colours.',
 'striped-wool-knit': 'C11 writes «کرم زرشکی ابی سرمه». I read it as two two-tone colourways.',
 'mohair-trousers': 'C2 writes the sizes as «۰s.m.l». I read it as S, M, L.',
 'high-neck-wool-knit': 'C8 gives no size. Set to one size, like the other knits.',
 'striped-pink-knit': 'C15 gives no size. Set to one size, like the other knits.',
 'white-leather-bag': 'The bag in the photo carries a miu miu logo. The caption names no brand, so the name doesn\'t either.',
 'pastel-cotton-cap': 'C7 repeats this cap\'s text, but the cap in the C7 photos is beige with a silver tag, so only the C2 photos are used here.',
 'grey-jeans': 'C23 lists sizes up to 41. Set to 42, as you said.',
 'oversize-coat': 'C17 and C19 describe the same coat at the same price. One piece, grey and brown.',
 'green-cream-jeans': 'C10 «شلوار کرم، جین، ۳۴-۴۲» and C24 «شلوار جین سبز، کرم، ۳۴-۴۲» are the same price. One piece, green and cream.',
 'fleece-trousers': 'C4/C5 and C12 list the same trousers (same fabric, sizes, price and three colours). One piece.',
 'patchwork-bandana': 'The same red-and-navy patchwork bandana is worn in C8 and C17.',
 'red-bandana': 'The same red bandana is worn in C9 and C16.',
 'avishu-sweatshirt': 'C18 spells the fabric «اوشو»; written «اویشو» like C7 and C14.',
 'cotton-shirt-white': 'C16 lists سفید where the other shirt posts list صورتی, so it stays its own piece.',
}
def card(pid, first):
    p = byid[pid]; c = catid[pid]
    img = b64(IMG / (c['images'][0].split('/')[-1] + '-480.webp'), 360)
    sizes = '، '.join(SZ.get(s, s) for s in c['sizes'])
    sw = ''.join(f'<span class="sw" style="background:{x["hex"]}"></span><span class="cn">{html.escape(x["fa"])}</span>' for x in c['colours'])
    fab = html.escape(c['fabric']['fa']) or '<span class="none">(caption gives none)</span>'
    flag = FLAG.get(pid)
    note = f'<p class="flag" dir="ltr">{html.escape(flag)}</p>' if flag and first else ''
    more = len(c['images'])
    if not first:
        return f'''<div class="dup"><img src="{img}" alt=""><div><b>{html.escape(p['fa'])}</b>
        <span dir="ltr">Same piece as in {p['src'].split(',')[0]}, listed once.</span></div></div>'''
    return f'''<article class="card">
      <div class="ph"><img src="{img}" alt="{html.escape(p['fa'])}" loading="lazy"><span class="n" dir="ltr">{more} photo{'s' if more > 1 else ''}</span></div>
      <div class="bd">
        <h4>{html.escape(p['fa'])}</h4>
        <p class="en" dir="ltr">{html.escape(p['en'])} · {html.escape(p['tr'])}</p>
        <p class="price">{toman(c['price'])} <small>تومان</small></p>
        <dl>
          <dt>دسته</dt><dd>{CATS[c['cat']]}</dd>
          <dt>سایز</dt><dd>{sizes}</dd>
          <dt>رنگ</dt><dd class="cols">{sw}</dd>
          <dt>جنس</dt><dd>{fab}</dd>
          {f"<dt>توضیح</dt><dd>{html.escape(c['note']['fa'])}</dd>" if c['note']['fa'] else ''}
        </dl>{note}
      </div></article>'''
seen = set(); blocks = []
for i, post in enumerate(posts(), 1):
    cid = f'C{i}'; cards = []
    for (text, pr), pid in zip(post, MAP[cid]):
        cards.append(card(pid, pid not in seen)); seen.add(pid)
    cap = '\n\n'.join(t for t, _ in post)
    blocks.append(f'''<section class="post" id="{cid.lower()}">
      <div class="cap"><p class="tag" dir="ltr">Post {cid} · as written in the group</p><pre>{html.escape(cap)}</pre></div>
      <div class="cards">{''.join(cards)}</div></section>''')
lk = ''.join(f'''<figure><img src="{b64(IMG / (l['img'] + '-720.webp'), 220)}" alt=""><figcaption>{html.escape(l['title'][0])}<span dir="ltr">{l['src']} · {len(l['items'])} pieces</span></figcaption></figure>''' for l in looks)
live = json.loads(pathlib.Path(sys.argv[2]).read_text())['products']
gone = ''.join(f'<li><span>{html.escape(p["name"]["fa"])}</span><code dir="ltr">{p["id"]}</code></li>' for p in live)
cover = b64(IMG / 'r-col-480.webp', 300); ed = b64(IMG / 'r-ed-960.webp', 560)
poster = b64(S / 'poster.png', 220)
body = (pathlib.Path(__file__).with_name('review_tpl.html').read_text()
        .replace('{{POSTS}}', ''.join(blocks)).replace('{{LOOKS}}', lk).replace('{{GONE}}', gone)
        .replace('{{NGONE}}', str(len(live))).replace('{{NP}}', str(len(cat)))
        .replace('{{COVER}}', cover).replace('{{ED}}', ed).replace('{{POSTER}}', poster))
OUT.write_text(body, encoding='utf-8')
print(OUT, round(OUT.stat().st_size / 1e6, 2), 'MB')
