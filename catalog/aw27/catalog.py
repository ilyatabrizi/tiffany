"""TIFFANY | the first real catalogue: Autumn / Winter 2027 (sent 2026-10-14).

Seven look photos from the studio (Telegram screenshots, so low resolution;
the studio said not to mind the quality for now) and, for each look, the
pieces in it with fabric, sizes and colours in their own words.

Builds:
  assets/img/aw-<id>-480/960.webp      one 4:5 crop per piece (plus extras)
  assets/img/aw27-look-N-720/1080.webp  the seven looks as 9:16 stories
  assets/img/aw27-col-480/960.webp      collection cover (3:4)
  assets/img/aw27-ed-480/960.webp       home editorial (16:10)
  catalog-import.json                   upload to tiffany-data/; imported once (api/lib/boot.php)

Prices come from PRICES (toman); a missing one stops the build."""
import json
import pathlib
import sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
IMG = REPO / 'assets' / 'img'
OUT = HERE

# --------------------------------------------------------------- colours
COL = {
    'مشکی': ('#111111', 'Black', 'Siyah'),
    'سفید': ('#F5F5F2', 'White', 'Beyaz'),
    'شکلاتی': ('#5A3A29', 'Chocolate', 'Çikolata'),
    'قهوه‌ای': ('#6B4430', 'Brown', 'Kahverengi'),
    'کرم': ('#E8DCC4', 'Cream', 'Krem'),
    'سرمه‌ای': ('#1F2A44', 'Navy', 'Lacivert'),
    'سرخابی': ('#C2185B', 'Magenta', 'Fuşya'),
    'سبز یشمی': ('#3E7A5E', 'Jade green', 'Yeşim yeşili'),
    'استخوانی': ('#EDE6D6', 'Bone', 'Kemik'),
    'زرشکی': ('#7B1E2B', 'Burgundy', 'Bordo'),
    'بادمجانی': ('#4A2545', 'Aubergine', 'Patlıcan moru'),
    'قرمز': ('#C62828', 'Red', 'Kırmızı'),
    'صورتی': ('#F2A7C3', 'Pink', 'Pembe'),
    'آبی': ('#5B8DB8', 'Blue', 'Mavi'),
    'طوسی': ('#9E9E9E', 'Grey', 'Gri'),
    'خاکستری تیره': ('#4A4A4D', 'Dark grey', 'Koyu gri'),
    'سبز لجنی': ('#5E6B3E', 'Olive green', 'Haki yeşil'),
    'سفید و شکلاتی': ('#D9C7B0', 'White and chocolate', 'Beyaz ve çikolata'),
    'مشکی و شتری': ('#3A3128', 'Black and camel', 'Siyah ve deve tüyü'),
    'صورتی و طوسی': ('#D9B3C2', 'Pink and grey', 'Pembe ve gri'),
    'کرم و قهوه‌ای': ('#CDB79E', 'Cream and brown', 'Krem ve kahverengi'),
    'آبی و سرمه‌ای': ('#3D5A80', 'Blue and navy', 'Mavi ve lacivert'),
    'زرشکی و صورتی': ('#A3445C', 'Burgundy and pink', 'Bordo ve pembe'),
    'آبی و قهوه‌ای': ('#5D6B7A', 'Blue and brown', 'Mavi ve kahverengi'),
    'قرمز و صورتی': ('#C9506A', 'Red and pink', 'Kırmızı ve pembe'),
    'جین تیره': ('#1C2230', 'Dark denim', 'Koyu kot'),
    'جین روشن': ('#BFD3E6', 'Light denim', 'Açık kot'),
    'تک‌رنگ': ('#8E8E93', 'One colour', 'Tek renk'),
}


def colours(*names, override=None):
    out = []
    for n in names:
        hx, en, tr = COL[n]
        if override and n in override:
            hx = override[n]
        out.append({'hex': hx, 'fa': n, 'en': en, 'tr': tr})
    return out


# ---------------------------------------------------------------- fabric
FAB = {
    'چرم روغنی': ('Oiled leather', 'Yağlı deri'),
    'پشم': ('Wool', 'Yün'),
    'پشم خالص': ('Pure wool', 'Saf yün'),
    'کتان': ('Cotton', 'Pamuk'),
    'جین': ('Denim', 'Kot'),
    'ساتن ابریشمی': ('Silk satin', 'İpek saten'),
    'تریکو': ('Knit jersey (tricot)', 'Triko'),
    'اویشو': ('Avishu fabric', 'Avishu kumaş'),
    'چرم فراوری‌شده': ('Processed leather', 'İşlenmiş deri'),
    'نخ': ('Cotton', 'Pamuk'),
    'گاباردین پنبه': ('Cotton gabardine', 'Pamuklu gabardin'),
    'تو کرک': ('Fleece-lined', 'İçi polarlı'),
    'چرم فراوری‌شده با رویه‌ی ضدآب': ('Processed leather, waterproof upper', 'Su geçirmez yüzlü işlenmiş deri'),
    'چرم فراوری‌شده، نزدیک‌ترین نوع به چرم طبیعی، با رویه‌ی ضدآب':
        ('Processed leather, the closest to natural leather, with a waterproof upper',
         'Doğal deriye en yakın işlenmiş deri, su geçirmez yüzey'),
}


def fabric(fa):
    if not fa:
        return {'fa': '', 'en': '', 'tr': ''}
    en, tr = FAB[fa]
    return {'fa': fa, 'en': en, 'tr': tr}


LS = ['S', 'M', 'L']
LXL = ['S', 'M', 'L', 'XL']
JEANS = ['34', '36', '38', '40', '42']
SHOES = ['37', '38', '39', '40']
OS = ['OS']

# Each piece: id, fa/en/tr name, category, sizes, colours, fabric, the
# looks it appears in, and its crops: (look, (x0, y0, x1, y1)) on the
# photo area of that look, 4:5. The first crop is the card photo.
P = [
    # look 1
    dict(id='leather-jacket', fa='کاپشن چرم', en='Leather jacket', tr='Deri mont', cat='jacket',
         sizes=LS, col=colours('مشکی'), fab='چرم روغنی', looks=[1], crops=[(1, (185, 110, 425, 410))]),
    dict(id='striped-knit', fa='بافت راه‌راه', en='Striped knit', tr='Çizgili triko', cat='knit',
         sizes=OS, col=colours('سفید و شکلاتی', 'مشکی و شتری'), fab='پشم', looks=[1],
         crops=[(1, (225, 185, 355, 348))]),
    dict(id='cotton-cap', fa='کپ کتان', en='Cotton cap', tr='Pamuklu şapka', cat='accessories',
         sizes=OS, col=colours('سرخابی', 'سرمه‌ای', 'قهوه‌ای', 'استخوانی', 'سبز یشمی'), fab='کتان', looks=[1, 6, 7],
         crops=[(7, (240, 240, 352, 380)), (6, (35, 240, 155, 390)), (1, (270, 100, 370, 225))]),
    dict(id='chocolate-jeans', fa='شلوار جین شکلاتی', en='Chocolate jeans', tr='Çikolata rengi kot pantolon',
         cat='trousers', sizes=LS, col=colours('شکلاتی', override={'شکلاتی': '#4B3226'}), fab='جین', looks=[1],
         crops=[(1, (150, 320, 382, 610))]),
    dict(id='silk-scarf', fa='فولار ساتن ابریشمی', en='Silk satin scarf', tr='İpek saten fular', cat='accessories',
         sizes=OS, col=colours('شکلاتی', 'سرمه‌ای'), fab='ساتن ابریشمی', looks=[1], crops=[(1, (0, 0, 591, 740))]),
    # look 2
    dict(id='leather-trench', fa='بارونی چرم', en='Leather trench coat', tr='Deri trençkot', cat='jacket',
         sizes=LS, col=colours('مشکی'), fab='چرم روغنی', looks=[2], crops=[(2, (220, 160, 520, 535))]),
    dict(id='white-collar-knit', fa='بافت یقه‌سفید', en='White-collar knit', tr='Beyaz yakalı triko', cat='knit',
         sizes=OS, col=colours('زرشکی', 'قهوه‌ای', 'سفید', 'مشکی'), fab='تریکو', looks=[2],
         crops=[(2, (290, 195, 410, 345))]),
    dict(id='avishu-set', fa='ست هودی و شلوار اویشو', en='Avishu hoodie and trousers set',
         tr='Avishu kapüşonlu ve pantolon takımı', cat='hoodie', sizes=LXL, col=colours('شکلاتی', 'کرم'),
         fab='اویشو', looks=[2], crops=[(2, (225, 215, 545, 615))]),
    dict(id='karl-lagerfeld-bag', fa='کیف KARL LAGERFELD', en='KARL LAGERFELD bag', tr='KARL LAGERFELD çanta',
         cat='accessories', sizes=OS, col=colours('سفید'), fab='چرم فراوری‌شده', looks=[2, 6],
         note=('برند KARL LAGERFELD، آلمان.', 'KARL LAGERFELD, Germany.', 'KARL LAGERFELD, Almanya.'),
         crops=[(6, (95, 640, 295, 890)), (2, (0, 220, 140, 395))]),
    dict(id='cotton-turtleneck', fa='یقه‌اسکی نخی', en='Cotton turtleneck', tr='Pamuklu balıkçı yaka', cat='knit',
         sizes=LS, col=colours('بادمجانی', 'شکلاتی'), fab='نخ', looks=[2], crops=[(2, (300, 170, 420, 320))]),
    # look 3
    dict(id='denim-jacket', fa='کت جین', en='Denim jacket', tr='Kot ceket', cat='jacket',
         sizes=LS, col=colours('جین تیره'), fab='جین', looks=[3], crops=[(3, (150, 270, 450, 645))]),
    dict(id='dark-jeans', fa='شلوار جین تیره', en='Dark jeans', tr='Koyu kot pantolon', cat='trousers',
         sizes=JEANS, col=colours('جین تیره', override={'جین تیره': '#161B26'}), fab='جین', looks=[3],
         crops=[(3, (60, 520, 572, 1160))]),
    dict(id='high-neck-knit', fa='بافت یقه‌بلند', en='High-neck knit', tr='Dik yaka triko', cat='knit',
         sizes=OS, col=colours('کرم', 'قرمز', 'قهوه‌ای', 'آبی', 'صورتی'), fab='پشم', looks=[3],
         crops=[(3, (185, 290, 385, 540))]),
    # look 4
    dict(id='gabardine-trench', fa='بارانی گاباردین', en='Gabardine trench coat', tr='Gabardin trençkot',
         cat='jacket', sizes=LS, col=colours('سرمه‌ای'), fab='گاباردین پنبه', looks=[4],
         crops=[(4, (190, 215, 530, 640))]),
    dict(id='ribbed-knit', fa='بافت کبریتی', en='Ribbed knit', tr='Fitilli triko', cat='knit',
         sizes=OS, col=colours('قرمز', 'سبز لجنی'), fab='', looks=[4], crops=[(4, (180, 290, 340, 490))]),
    dict(id='cotton-shirt', fa='شومیز نخی', en='Cotton shirt', tr='Pamuklu gömlek', cat='shirt',
         sizes=LXL, col=colours('سرمه‌ای', 'صورتی', 'قهوه‌ای', 'استخوانی', 'قرمز'), fab='نخ', looks=[4, 5, 6, 7],
         crops=[(5, (250, 255, 410, 455)), (7, (215, 440, 355, 615))]),
    dict(id='bandana', fa='باندانا', en='Bandana', tr='Bandana', cat='accessories',
         sizes=OS, col=colours('تک‌رنگ'), fab='', looks=[4, 6],
         crops=[(4, (200, 215, 300, 340)), (6, (290, 95, 410, 245))]),
    dict(id='waterproof-sneakers', fa='کانورس ضدآب', en='Waterproof high-top sneakers',
         tr='Su geçirmez bilekli spor ayakkabı', cat='shoes', sizes=SHOES, col=colours('سفید', 'زرشکی', 'سرمه‌ای'),
         fab='چرم فراوری‌شده، نزدیک‌ترین نوع به چرم طبیعی، با رویه‌ی ضدآب', looks=[4, 5],
         crops=[(4, (50, 680, 170, 830)), (4, (300, 660, 400, 785))]),
    # look 5
    dict(id='logo-cap', fa='کپ لوگودار', en='Logo cap', tr='Logolu şapka', cat='accessories',
         sizes=OS, col=colours('صورتی', 'سفید'), fab='', looks=[5], crops=[(5, (280, 170, 392, 310))]),
    dict(id='jacquard-knit', fa='بافت طرح‌دار', en='Patterned knit', tr='Desenli triko', cat='knit',
         sizes=OS, col=colours('صورتی و طوسی', 'کرم و قهوه‌ای', 'آبی و سرمه‌ای'), fab='پشم خالص', looks=[5],
         crops=[(5, (215, 280, 435, 555))]),
    dict(id='avishu-vest', fa='وست اویشو', en='Avishu vest', tr='Avishu yelek', cat='vest',
         sizes=LXL, col=colours('خاکستری تیره'), fab='اویشو', looks=[5], crops=[(5, (225, 260, 435, 523))]),
    dict(id='avishu-trousers', fa='شلوار اویشو', en='Avishu trousers', tr='Avishu pantolon', cat='trousers',
         sizes=LXL, col=colours('خاکستری تیره', override={'خاکستری تیره': '#3F3F42'}), fab='اویشو', looks=[5],
         crops=[(5, (160, 450, 440, 800))]),
    # look 6
    dict(id='wide-stripe-knit', fa='بافت راه‌پهن', en='Wide-stripe knit', tr='Geniş çizgili triko', cat='knit',
         sizes=OS, col=colours('صورتی و طوسی', 'زرشکی و صورتی'), fab='پشم', looks=[6],
         crops=[(6, (320, 240, 480, 440))]),
    dict(id='bomber-jacket', fa='بامبر', en='Bomber jacket', tr='Bomber ceket', cat='jacket',
         sizes=LS, col=colours('قهوه‌ای', 'سفید'), fab='', looks=[6], crops=[(6, (165, 190, 465, 565))]),
    dict(id='fleece-trousers', fa='شلوار تو کرک', en='Fleece-lined trousers', tr='İçi polarlı pantolon',
         cat='trousers', sizes=LS, col=colours('قهوه‌ای', 'طوسی', 'مشکی', 'سفید'), fab='تو کرک', looks=[6],
         crops=[(6, (150, 370, 470, 770))]),
    # look 7
    dict(id='waterproof-leather-jacket', fa='کت چرم ضدآب', en='Waterproof leather jacket', tr='Su geçirmez deri ceket',
         cat='jacket', sizes=LS, col=colours('قهوه‌ای', override={'قهوه‌ای': '#4E3527'}),
         fab='چرم فراوری‌شده با رویه‌ی ضدآب', looks=[7], crops=[(7, (140, 250, 420, 600))]),
    dict(id='two-tone-knit', fa='بافت دورنگ', en='Two-tone knit', tr='İki renkli triko', cat='knit',
         sizes=OS, col=colours('آبی و قهوه‌ای', 'قرمز و صورتی'), fab='پشم', looks=[7],
         crops=[(7, (230, 330, 370, 505))]),
    dict(id='light-jeans', fa='شلوار جین روشن', en='Light jeans', tr='Açık kot pantolon', cat='trousers',
         sizes=JEANS, col=colours('جین روشن'), fab='جین', looks=[7], crops=[(7, (190, 520, 450, 845))]),
]

# 9:16 story frames and the two wide images, on the same photo areas.
STORY = {1: (77, 0, 493, 740), 2: (170, 0, 586, 740), 3: (0, 120, 591, 1171), 4: (60, 0, 560, 888),
         5: (50, 0, 550, 888), 6: (40, 0, 543, 894), 7: (45, 0, 543, 886)}
COVER = (7, (0, 50, 591, 838))      # 3:4
EDITORIAL = (2, (0, 170, 591, 539))  # 16:10

# 2026-10-14: no prices yet; Ilya chose one placeholder price for every piece
# (Amir sets the real ones in the admin panel).
PRICES = {p['id']: 1_000_000 for p in P}


# The photo inside each Telegram screenshot (top, bottom), full width.
AREA = {1: (162, 902), 2: (270, 1010), 3: (0, 1250), 4: (196, 1084), 5: (196, 1084),
        6: (0, 894), 7: (196, 1082)}


def photo(n):
    t, b = AREA[n]
    return Image.open(HERE / 'src' / f'look{n}.jpg').convert('RGB').crop((0, t, 591, b))


def save(im, name, widths, ratio):
    w, h = im.size
    for W in widths:
        H = round(W * ratio)
        im.resize((W, H), Image.LANCZOS).save(IMG / f'{name}-{W}.webp', 'WEBP', quality=82, method=6)


def crop_ratio(box, ratio, size):
    """Nudge a hand-picked box to the exact aspect (h/w) around its centre,
    shrinking it if it would leave the photo, then sliding it back inside."""
    W, H = size
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    h = w * ratio
    if h > H:
        h = H; w = h / ratio
    if w > W:
        w = W; h = w * ratio
    x0 = min(max(cx - w / 2, 0), W - w)
    y0 = min(max(cy - h / 2, 0), H - h)
    return (round(x0), round(y0), round(x0 + w), round(y0 + h))


def build(prices_required=True):
    OUT.mkdir(exist_ok=True)
    photos = {n: photo(n) for n in range(1, 8)}
    out = []
    for i, p in enumerate(P):
        imgs = []
        for k, (look, box) in enumerate(p['crops']):
            b = crop_ratio(box, 1.25, photos[look].size)
            name = f"aw-{p['id']}" + (f'-{k + 1}' if k else '')
            save(photos[look].crop(b), name, (480, 960), 1.25)
            imgs.append(f'assets/img/{name}')
        price = PRICES.get(p['id'])
        if price is None:
            if prices_required:
                sys.exit(f"no price for {p['id']}")
            price = 1000000
        note = p.get('note')
        out.append({
            'id': p['id'],
            'name': {'fa': p['fa'], 'en': p['en'], 'tr': p['tr']},
            'cat': p['cat'], 'col': 'aw27', 'price': int(price),
            'images': imgs, 'sizes': p['sizes'], 'stock': None, 'fit': 'true', 'badge': '',
            'colours': p['col'],
            'note': {'fa': note[0], 'en': note[1], 'tr': note[2]} if note else {'fa': '', 'en': '', 'tr': ''},
            'detail': {'fa': '', 'en': '', 'tr': ''},
            'fabric': fabric(p['fab']),
            'care': {'fa': '', 'en': '', 'tr': ''},
            'visible': True, 'sort': i,
        })
    for n, box in STORY.items():
        save(photos[n].crop(crop_ratio(box, 16 / 9, photos[n].size)), f'aw27-look-{n}', (720, 1080), 16 / 9)
    save(photos[COVER[0]].crop(crop_ratio(COVER[1], 4 / 3, photos[COVER[0]].size)), 'aw27-col', (480, 960), 4 / 3)
    save(photos[EDITORIAL[0]].crop(crop_ratio(EDITORIAL[1], 10 / 16, photos[EDITORIAL[0]].size)), 'aw27-ed', (480, 960), 10 / 16)
    (OUT / 'catalog-import.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    # the story items, for js/data.js
    looks = {n: [p['id'] for p in P if n in p['looks']] for n in range(1, 8)}
    return out, looks


if __name__ == '__main__':
    out, looks = build(prices_required='--draft' not in sys.argv)
    print(len(out), 'pieces;', sum(len(p['images']) for p in out), 'piece images')
    print(json.dumps(looks))
