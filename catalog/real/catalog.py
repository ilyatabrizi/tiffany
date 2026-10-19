"""TIFFANY | the real catalogue: Autumn / Winter 2027 (Telegram group «Tiffany products», read 2026-10-19).

Source of every name, fabric, colour list, size list and price: group.txt, the
exact copy of the group's 88 messages (C1..C24 below are its captioned posts
in order). Photos: the studio's DSC*.JPG files (7008x4672, EXIF-rotated).

Builds:
  assets/img/r-<id>[-k]-480/960.webp   4:5 crops per piece
  assets/img/r-look-<n>-720/1080.webp  9:16 story frames, one per outfit
  assets/img/r-col-480/960.webp        collection cover (3:4)
  assets/img/r-ed-480/960.webp         home editorial (16:10)
  catalog-import.json                  drop into tiffany-data/ (api/lib/boot.php imports it once)

  python3 catalog.py SRC_DIR OUT_DIR [--preview SHEET.jpg]
Crops are (photo, cx, cy, w): centre and width as fractions of the rotated photo."""
import json
import pathlib
import sys

from PIL import Image, ImageOps

# --------------------------------------------------------------- colours
COL = {
    'سفید': ('#F5F5F2', 'White', 'Beyaz'),
    'سفید کرمی': ('#EFE8D8', 'Creamy white', 'Kırık beyaz'),
    'شیری': ('#F1ECE2', 'Milky white', 'Süt beyazı'),
    'استخوانی': ('#E6DDCB', 'Bone', 'Kemik'),
    'کرم': ('#E3D5BC', 'Cream', 'Krem'),
    'صورتی': ('#F2A7C3', 'Pink', 'Pembe'),
    'صورتی پاستیلی': ('#F6CFDB', 'Pastel pink', 'Pastel pembe'),
    'سرخابی': ('#C2185B', 'Magenta', 'Fuşya'),
    'قرمز': ('#C62828', 'Red', 'Kırmızı'),
    'زرشکی': ('#7B1E2B', 'Burgundy', 'Bordo'),
    'بادمجانی': ('#4A2545', 'Aubergine', 'Patlıcan moru'),
    'آبی': ('#9CC3E4', 'Blue', 'Mavi'),
    'سرمه‌ای': ('#1F2A44', 'Navy', 'Lacivert'),
    'قهوه‌ای': ('#6B4430', 'Brown', 'Kahverengi'),
    'شکلاتی': ('#4E3226', 'Chocolate', 'Çikolata'),
    'شکلاتی تیره': ('#33221A', 'Dark chocolate', 'Bitter çikolata'),
    'مشکی': ('#111111', 'Black', 'Siyah'),
    'طوسی': ('#9E9E9E', 'Grey', 'Gri'),
    'موشی': ('#7D7873', 'Mouse grey', 'Fare grisi'),
    'خاکستری تیره': ('#4A4A4D', 'Dark grey', 'Koyu gri'),
    'سبز': ('#6E7F5C', 'Green', 'Yeşil'),
    'سبز خاکی': ('#7A7A52', 'Khaki green', 'Haki yeşil'),
    'سبز یشمی': ('#3E7A5E', 'Jade green', 'Yeşim yeşili'),
    'سبز لجنی': ('#5E6B3E', 'Moss green', 'Yosun yeşili'),
    'سبز زیتونی': ('#6F7552', 'Olive green', 'Zeytin yeşili'),
    'سبز زیتونی روشن': ('#8C9166', 'Light olive green', 'Açık zeytin yeşili'),
    'سبز تیره': ('#3D4636', 'Dark green', 'Koyu yeşil'),
    'خاکی': ('#8B7D5B', 'Khaki', 'Haki'),
    'جین تیره': ('#1C2230', 'Dark denim', 'Koyu kot'),
    'جین روشن': ('#BFD3E6', 'Light denim', 'Açık kot'),
    'جین طوسی': ('#8F918F', 'Grey denim', 'Gri kot'),
    # two-tone pieces, as the captions pair them
    'سفید و صورتی': ('#F3D3DE', 'White and pink', 'Beyaz ve pembe'),
    'سفید و سرمه‌ای': ('#9AA3B5', 'White and navy', 'Beyaz ve lacivert'),
    'سفید و شکلاتی': ('#D9C7B0', 'White and chocolate', 'Beyaz ve çikolata'),
    'مشکی و شتری': ('#3A3128', 'Black and camel', 'Siyah ve deve tüyü'),
    'کرم و زرشکی': ('#B98A86', 'Cream and burgundy', 'Krem ve bordo'),
    'آبی و سرمه‌ای': ('#3D5A80', 'Blue and navy', 'Mavi ve lacivert'),
    'آبی و قهوه‌ای': ('#5D6B7A', 'Blue and brown', 'Mavi ve kahverengi'),
    'قرمز و سرمه‌ای': ('#7A2E3E', 'Red and navy', 'Kırmızı ve lacivert'),
    'زرشکی و صورتی': ('#A3445C', 'Burgundy and pink', 'Bordo ve pembe'),
    'قرمز و صورتی': ('#C9506A', 'Red and pink', 'Kırmızı ve pembe'),
    'صورتی و طوسی': ('#D9B3C2', 'Pink and grey', 'Pembe ve gri'),
    'کرم و قهوه‌ای': ('#CDB79E', 'Cream and brown', 'Krem ve kahverengi'),
    'سبز و کرم': ('#9AA07E', 'Green and cream', 'Yeşil ve krem'),
    'سفید و قهوه‌ای': ('#D8C8B4', 'White and brown', 'Beyaz ve kahverengi'),
    # one-design bandanas, named by what the photo shows
    'صورتی گل‌دار': ('#E9B8C8', 'Pink print', 'Pembe desenli'),
    'قرمز و سرمه‌ای چهل‌تکه': ('#B0303F', 'Red and navy patchwork', 'Kırmızı-lacivert patchwork'),
    'قرمز طرح‌دار': ('#D3202F', 'Red paisley', 'Kırmızı şal desenli'),
    'گل‌دار صورتی و بنفش': ('#C98FB0', 'Pink and purple floral', 'Pembe-mor çiçekli'),
    'قهوه‌ای طرح‌دار': ('#6A5038', 'Brown paisley', 'Kahverengi şal desenli'),
    'مشکی و سفید طرح‌دار': ('#3C3C3C', 'Black and white paisley', 'Siyah-beyaz şal desenli'),
}


def colours(*names, hexes=None):
    out = []
    for n in names:
        hx, en, tr = COL[n]
        if hexes and n in hexes:
            hx = hexes[n]
        out.append({'hex': hx, 'fa': n, 'en': en, 'tr': tr})
    assert len({c['hex'] for c in out}) == len(out), names
    return out


# ---------------------------------------------------------------- fabric
FAB = {
    'چرم': ('Leather', 'Deri'),
    'کتان': ('Cotton', 'Pamuk'),
    'موهر پنبه': ('Mohair and cotton', 'Tiftik ve pamuk'),
    'پشم': ('Wool', 'Yün'),
    'پشم خالص': ('Pure wool', 'Saf yün'),
    'پشمی نازک': ('Fine wool', 'İnce yün'),
    'جین': ('Denim', 'Kot'),
    'ساتن ابریشمی': ('Silk satin', 'İpek saten'),
    'حریر ساتن': ('Satin silk', 'Saten ipek'),
    'سه‌نخ توکرک': ('Three-thread, fleece-lined', 'Üç iplik, içi polarlı'),
    'دورس سه‌نخ توکرک': ('Three-thread fleece (dors), fleece-lined', 'Üç iplik dors, içi polarlı'),
    'دورس سه‌نخ آستردار': ('Three-thread fleece (dors), lined', 'Üç iplik dors, astarlı'),
    'پوست مصنوعی': ('Faux fur', 'Suni kürk'),
    'تدی پشمی': ('Wool teddy', 'Yün teddy'),
    'چرم روغنی': ('Oiled leather', 'Yağlı deri'),
    'تریکو': ('Tricot knit', 'Triko'),
    'اویشو': ('Avishu', 'Avishu'),
    'چرم فراوری‌شده': ('Processed leather', 'İşlenmiş deri'),
    'چرم فراوری‌شده، واترپروف و ضدآب': ('Processed leather, waterproof', 'İşlenmiş deri, su geçirmez'),
    'چرم فراوری‌شده، رویه‌ی واترپروف و ضدآب': ('Processed leather, waterproof upper', 'İşlenmiş deri, su geçirmez yüzey'),
    'چرم فراوری‌شده، نزدیک‌ترین نوع به چرم طبیعی، واترپروف و ضدآب':
        ('Processed leather, the closest to natural leather, waterproof',
         'Doğal deriye en yakın işlenmiş deri, su geçirmez'),
    'نخ': ('Cotton', 'Pamuk'),
    'نخ پنبه': ('Cotton', 'Pamuk'),
    'گاباردین پنبه': ('Cotton gabardine', 'Pamuklu gabardin'),
    'گاباردین گرم‌بالا': ('Heavyweight gabardine', 'Ağır gramajlı gabardin'),
    'پوست کوتاه': ('Short-pile fur', 'Kısa tüylü kürk'),
    'فوتر': ('Wool coating (futer)', 'Kaban kumaşı (futer)'),
    'فوتر پشمی': ('Wool coating (futer)', 'Yün kaban kumaşı (futer)'),
    'شمعی': ('Waxed fabric', 'Mumlu kumaş'),
    'شمعی ضدآب': ('Waxed fabric, waterproof', 'Mumlu kumaş, su geçirmez'),
    'جیر و چرم': ('Suede and leather', 'Süet ve deri'),
    'ترنچ': ('Trench twill', 'Trençkot kumaşı'),
    'برزنت': ('Canvas', 'Kanvas'),
}


def fabric(fa):
    if not fa:
        return {'fa': '', 'en': '', 'tr': ''}
    en, tr = FAB[fa]
    return {'fa': fa, 'en': en, 'tr': tr}


OS = ['OS']
LS = ['S', 'M', 'L']
LXL = ['S', 'M', 'L', 'XL']
JEANS = ['34', '36', '38', '40', '42']
SHOES = ['37', '38', '39', '40']

TM = 1  # prices are toman, written out in full below


def p(id, fa, en, tr, cat, sizes, col, fab, price, src, crops, note=None):
    return dict(id=id, fa=fa, en=en, tr=tr, cat=cat, sizes=sizes, col=col, fab=fab,
                price=price, src=src, crops=crops, note=note)


# Each piece: where its words come from (src: the caption numbers), then
# its crops. The first crop is the card photo.
P = [
    # C1
    p('white-leather-bag', 'کیف چرمی سفید', 'White leather bag', 'Beyaz deri çanta', 'accessories',
      OS, colours('سفید'), 'چرم', 12_990_000, 'C1',
      [('02930', .36, .56, .62), ('02794', .29, .31, .46)]),
    # C2 (cap again in C7, word for word)
    p('pastel-cotton-cap', 'کپ کتان سفید و صورتی پاستیلی', 'Cotton cap, white and pastel pink',
      'Pamuklu şapka, beyaz ve pastel pembe', 'accessories', OS, colours('سفید', 'صورتی پاستیلی'),
      'کتان', 3_990_000, 'C2, C7',
      [('02794', .64, .26, .42), ('02862', .44, .19, .42)]),
    p('mohair-top', 'رویه موهر پنبه', 'Mohair-cotton top', 'Tiftik-pamuk üst', 'cardigan',
      OS, colours('صورتی'), 'موهر پنبه', 15_490_000, 'C2',
      [('02794', .66, .45, .6), ('02805', .45, .3, .5)]),
    p('mohair-trousers', 'شلوار موهر پنبه', 'Mohair-cotton trousers', 'Tiftik-pamuk pantolon', 'trousers',
      LS, colours('کرم'), 'موهر پنبه', 9_990_000, 'C2',
      [('02805', .56, .65, .62), ('02794', .6, .8, .5)]),
    # C3
    p('buttoned-wool-knit', 'بافت پشم دکمه‌دار', 'Buttoned wool knit', 'Düğmeli yün triko', 'knit',
      OS, colours('سفید و صورتی', 'سفید و سرمه‌ای'), 'پشم', 14_990_000, 'C3',
      [('02862', .43, .48, .85), ('02869', .5, .55, .85)]),
    p('wool-scarf', 'شال گردن پشم', 'Wool scarf', 'Yün atkı', 'accessories',
      OS, colours('سفید و صورتی', 'سفید و سرمه‌ای'), 'پشم', 3_490_000, 'C3',
      [('02869', .48, .52, .62), ('02862', .4, .33, .5)]),
    p('white-jeans', 'شلوار جین سفید', 'White jeans', 'Beyaz kot pantolon', 'trousers',
      LS, colours('سفید'), 'جین', 10_990_000, 'C3',
      [('02875', .55, .55, .7), ('02862', .4, .82, .55)]),
    # C4 and C5 (bandana, sweatshirt and trousers word for word in both)
    p('silk-satin-bandana', 'باندانا ساتن ابریشمی', 'Silk satin bandana', 'İpek saten bandana', 'accessories',
      OS, colours('صورتی گل‌دار'), 'ساتن ابریشمی', 2_990_000, 'C4, C5',
      [('02606', .28, .13, .38), ('02623', .38, .22, .35)]),
    p('fleece-sweatshirt', 'سوشرت سه‌نخ توکرک', 'Fleece-lined sweatshirt', 'İçi polarlı sweatshirt', 'hoodie',
      LS, colours('آبی', 'صورتی', 'قهوه‌ای'), 'سه‌نخ توکرک', 13_990_000, 'C4, C5',
      [('02606', .3, .48, .62), ('02476', .45, .38, .45)]),
    # C4/C5 and C12 list the same trousers: same fabric, sizes and price,
    # colours آبی صورتی قهوه‌ای / صورتی آبی شکلاتی
    p('fleece-trousers', 'شلوار سه‌نخ توکرک', 'Fleece-lined trousers', 'İçi polarlı pantolon', 'trousers',
      LS, colours('آبی', 'صورتی', 'قهوه‌ای'), 'سه‌نخ توکرک', 12_990_000, 'C4, C5, C12',
      [('02476', .48, .68, .58), ('01542', .45, .65, .6)]),
    p('faux-fur-coat', 'کت پوست مصنوعی', 'Faux fur coat', 'Suni kürk ceket', 'jacket',
      LS, colours('شکلاتی', 'سفید'), 'پوست مصنوعی', 24_990_000, 'C4',
      [('02623', .62, .78, .45), ('02526', .3, .4, .45), ('02606', .8, .65, .4)]),
    p('wool-teddy-coat', 'کت تدی پشمی', 'Wool teddy coat', 'Yün teddy ceket', 'jacket',
      LS, colours('سفید', 'کرم', 'زرشکی', 'مشکی', 'شکلاتی'), 'تدی پشمی', 19_490_000, 'C5',
      [('02579', .53, .5, .4), ('02576', .38, .45, .5), ('02512', .4, .58, .55)]),
    # C6
    p('oiled-leather-jacket', 'کاپشن چرم روغنی', 'Oiled leather jacket', 'Yağlı deri mont', 'jacket',
      LS, colours('مشکی'), 'چرم روغنی', 23_990_000, 'C6',
      [('01783', .47, .4, .6), ('01905', .33, .5, .5)]),
    p('wool-underknit', 'بافت زیره پشم راه‌راه', 'Striped wool underknit', 'Çizgili yün içlik triko', 'knit',
      OS, colours('سفید و شکلاتی', 'مشکی و شتری'), 'پشم', 12_490_000, 'C6',
      [('01888', .62, .4, .36), ('01783', .5, .4, .3)]),
    p('cotton-cap', 'کپ کتان', 'Cotton cap', 'Pamuklu şapka', 'accessories',
      OS, colours('شکلاتی', 'سبز خاکی', 'سرمه‌ای', 'کرم', 'سرخابی'), 'کتان', 3_490_000, 'C6',
      [('01905', .4, .2, .36), ('01783', .52, .26, .25)]),
    p('chocolate-jeans', 'شلوار جین شکلاتی', 'Chocolate jeans', 'Çikolata rengi kot pantolon', 'trousers',
      LS, colours('شکلاتی'), 'جین', 8_590_000, 'C6',
      [('01783', .47, .64, .45), ('01782', .37, .6, .45)]),
    p('cotton-foulard', 'فولار نخی', 'Cotton foulard', 'Pamuklu fular', 'accessories',
      OS, colours('شکلاتی', 'سرمه‌ای'), 'نخ', 1_990_000, 'C6',
      [('01905', .34, .72, .3), ('01888', .62, .5, .25)]),
    # C7
    p('oiled-leather-trench', 'بارونی چرم روغنی', 'Oiled leather trench coat', 'Yağlı deri trençkot', 'jacket',
      LS, colours('مشکی'), 'چرم روغنی', 34_990_000, 'C7',
      [('01814', .6, .53, .55), ('01830', .5, .6, .85)]),
    p('white-collar-underknit', 'بافت زیره یقه‌سفید', 'White-collar underknit', 'Beyaz yakalı içlik triko', 'knit',
      OS, colours('زرشکی', 'قهوه‌ای', 'سفید', 'مشکی'), 'تریکو', 7_590_000, 'C7',
      [('01847', .42, .42, .25)]),
    p('avishu-top', 'رویه اویشو', 'Avishu top', 'Avishu üst', 'hoodie',
      LXL, colours('شکلاتی', 'کرم'), 'اویشو', 16_990_000, 'C7',
      [('01814', .58, .4, .35), ('01888', .4, .42, .3)]),
    p('avishu-trousers', 'شلوار اویشو', 'Avishu trousers', 'Avishu pantolon', 'trousers',
      LXL, colours('شکلاتی', 'کرم'), 'اویشو', 15_490_000, 'C7',
      [('01814', .6, .65, .42)]),
    p('karl-lagerfeld-bag', 'کیف KARL LAGERFELD', 'KARL LAGERFELD bag', 'KARL LAGERFELD çanta', 'accessories',
      OS, colours('سفید'), 'چرم فراوری‌شده', 7_290_000, 'C7',
      [('01451', .42, .87, .5), ('01814', .17, .44, .32)],
      note=('برند KARL LAGERFELD، آلمان.', 'KARL LAGERFELD, Germany.', 'KARL LAGERFELD, Almanya.')),
    p('cotton-turtleneck', 'یقه‌اسکی نخی', 'Cotton turtleneck', 'Pamuklu balıkçı yaka', 'knit',
      LS, colours('بادمجانی', 'شکلاتی'), 'نخ', 4_490_000, 'C7',
      [('01847', .43, .39, .2), ('01830', .55, .3, .35)]),
    # C8
    p('denim-jacket', 'کت جین', 'Denim jacket', 'Kot ceket', 'jacket',
      LS, colours('جین تیره'), 'جین', 15_490_000, 'C8',
      [('01328', .5, .45, .9), ('01321', .5, .42, .4)]),
    p('dark-jeans', 'شلوار جین تیره', 'Dark jeans', 'Koyu kot pantolon', 'trousers',
      JEANS, colours('جین تیره', hexes={'جین تیره': '#161B26'}), 'جین', 13_490_000, 'C8',
      [('01321', .5, .65, .5)]),
    p('high-neck-wool-knit', 'بافت پشم یقه‌بلند', 'High-neck wool knit', 'Dik yaka yün triko', 'knit',
      OS, colours('کرم', 'قرمز', 'قهوه‌ای', 'آبی', 'صورتی'), 'پشم', 8_490_000, 'C8',
      [('01328', .56, .47, .5)]),
    # C8 and C17: the same red-and-navy patchwork bandana in both photos
    p('patchwork-bandana', 'باندانا نخی چهل‌تکه', 'Cotton patchwork bandana', 'Pamuklu patchwork bandana',
      'accessories', OS, colours('قرمز و سرمه‌ای چهل‌تکه'), 'نخ', 1_990_000, 'C8, C17',
      [('02173', .57, .22, .4), ('01336', .48, .2, .45)]),
    # C9
    p('gabardine-trench', 'بارانی گاباردین پنبه', 'Cotton gabardine trench coat', 'Pamuklu gabardin trençkot',
      'jacket', LS, colours('سرمه‌ای'), 'گاباردین پنبه', 34_990_000, 'C9',
      [('01363', .45, .5, .7)]),
    p('ribbed-knit', 'بافت کبریتی', 'Ribbed knit', 'Fitilli triko', 'knit',
      OS, colours('قرمز', 'سبز لجنی'), '', 12_490_000, 'C9',
      [('01382', .47, .45, .4), ('01363', .55, .4, .3)]),
    # C9, C13, C14, C15 and C19: the same shirt, the same five colours. C19 writes
    # its price as ۹۹۰۰۰۰; Ilya: «its 7.990.000» (2026-10-19).
    p('cotton-shirt', 'شومیز نخی', 'Cotton shirt', 'Pamuklu gömlek', 'shirt',
      LXL, colours('سرمه‌ای', 'صورتی', 'قهوه‌ای', 'استخوانی', 'قرمز'), 'نخ', 7_990_000, 'C9, C13, C14, C15, C19',
      [('01423', .48, .3, .45), ('01363', .55, .35, .3), ('01597', .55, .8, .45)]),
    # C9 and C16: the same red bandana
    p('red-bandana', 'باندانا نخی قرمز', 'Red cotton bandana', 'Kırmızı pamuklu bandana', 'accessories',
      OS, colours('قرمز طرح‌دار'), 'نخ', 1_990_000, 'C9, C16',
      [('01382', .45, .28, .22), ('02133', .585, .285, .2)]),
    # C9 and C14 (C14 gives the sizes and the longer fabric line)
    p('waterproof-sneakers', 'کانورس', 'High-top sneakers', 'Bilekli spor ayakkabı', 'shoes',
      SHOES, colours('سفید', 'زرشکی', 'سرمه‌ای'),
      'چرم فراوری‌شده، نزدیک‌ترین نوع به چرم طبیعی، واترپروف و ضدآب', 12_990_000, 'C9, C14',
      [('02338', .21, .85, .3), ('01423', .64, .9, .32), ('01382', .45, .82, .6)]),
    # C10 (+ 02289, 02293)
    p('short-fur-jacket', 'کت پوست کوتاه', 'Short-pile fur jacket', 'Kısa tüylü kürk ceket', 'jacket',
      LS, colours('طوسی', 'شیری'), 'پوست کوتاه', 17_890_000, 'C10',
      [('02303', .5, .5, .55), ('02300', .4, .45, .9)]),
    p('pure-wool-underknit', 'بافت زیره پشم خالص', 'Pure wool underknit', 'Saf yün içlik triko', 'knit',
      OS, colours('بادمجانی', 'قهوه‌ای', 'صورتی'), 'پشم خالص', 12_490_000, 'C10',
      [('02289', .62, .38, .45), ('02300', .4, .55, .6)]),
    p('plain-shirt', 'شومیز ساده', 'Plain shirt', 'Düz gömlek', 'shirt',
      LXL, colours('کرم', 'صورتی', 'سرمه‌ای', 'سفید'), '', 7_990_000, 'C10',
      [('02300', .32, .25, .5)]),
    # C10 «شلوار کرم، جین، ۳۴-۴۲» and C24 «شلوار جین، سبز و کرم، ۳۴-۴۲»: same price
    p('green-cream-jeans', 'شلوار جین سبز و کرم', 'Green and cream jeans', 'Yeşil ve krem kot pantolon', 'trousers',
      JEANS, colours('سبز', 'کرم'), 'جین', 13_490_000, 'C10, C24',
      [('02289', .57, .68, .5), ('01732', .7, .88, .5)]),
    # C11
    p('print-bandana', 'باندانا گل‌دار', 'Floral bandana', 'Çiçekli bandana', 'accessories',
      OS, colours('گل‌دار صورتی و بنفش'), '', 2_990_000, 'C11',
      [('02352', .55, .51, .3), ('02338', .7, .17, .25)]),
    p('striped-wool-knit', 'بافت پشم راه‌راه', 'Striped wool knit', 'Çizgili yün triko', 'knit',
      OS, colours('کرم و زرشکی', 'آبی و سرمه‌ای'), 'پشم', 9_490_000, 'C11',
      [('02352', .45, .68, .55), ('02312', .48, .38, .4)]),
    p('collared-sweatshirt', 'سوشرت', 'Sweatshirt', 'Sweatshirt', 'hoodie',
      LXL, colours('بادمجانی', 'شکلاتی تیره', 'موشی'), '', 22_490_000, 'C11',
      [('02338', .55, .42, .65)]),
    p('sweat-trousers', 'شلوار ست سوشرت', 'Sweatshirt-set trousers', 'Sweatshirt takımı pantolonu', 'trousers',
      LXL, colours('بادمجانی', 'شکلاتی تیره', 'موشی'), '', 15_490_000, 'C11',
      [('02312', .5, .7, .5)]),
    # C12
    p('brown-paisley-bandana', 'باندانا قهوه‌ای', 'Brown bandana', 'Kahverengi bandana', 'accessories',
      OS, colours('قهوه‌ای طرح‌دار'), '', 1_990_000, 'C12',
      [('01588', .43, .32, .42)]),
    p('waterproof-leather-bomber', 'کاپشن چرم واترپروف', 'Waterproof leather jacket', 'Su geçirmez deri mont',
      'jacket', None, colours('قهوه‌ای', hexes={'قهوه‌ای': '#3E2C24'}),
      'چرم فراوری‌شده، واترپروف و ضدآب', 27_990_000, 'C12',
      [('01542', .58, .33, .65), ('01536', .45, .4, .65)]),
    p('two-tone-wool-knit', 'بافت پشمی دورنگ', 'Two-tone wool knit', 'İki renkli yün triko', 'knit',
      OS, colours('آبی و قهوه‌ای', 'قرمز و سرمه‌ای', 'زرشکی و صورتی'), 'پشم', 12_990_000, 'C12',
      [('01588', .3, .55, .55)]),
    # C13 and C15: the same cap, the same five colours
    p('baseball-cap', 'کلاه کپ', 'Baseball cap', 'Beyzbol şapkası', 'accessories',
      OS, colours('سرمه‌ای', 'قهوه‌ای', 'استخوانی', 'سبز یشمی', 'سرخابی'), '', 3_490_000, 'C13, C15',
      [('01488', .66, .2, .2), ('01451', .15, .37, .3)]),
    p('waterproof-leather-jacket', 'کت چرم واترپروف', 'Waterproof leather jacket', 'Su geçirmez deri ceket',
      'jacket', LS, colours('قهوه‌ای', hexes={'قهوه‌ای': '#4A3326'}),
      'چرم فراوری‌شده، رویه‌ی واترپروف و ضدآب', 23_990_000, 'C13',
      [('01597', .6, .5, .7), ('01480', .5, .4, .5)]),
    p('two-tone-stripe-knit', 'بافت پشم دورنگ راه‌راه', 'Two-tone striped wool knit', 'İki renkli çizgili yün triko',
      'knit', OS, colours('آبی و قهوه‌ای', 'قرمز و صورتی'), 'پشم', 8_990_000, 'C13',
      [('01626', .67, .4, .3)]),
    p('light-ripped-jeans', 'شلوار جین روشن', 'Light jeans', 'Açık kot pantolon', 'trousers',
      JEANS, colours('جین روشن'), '', 7_090_000, 'C13',
      [('01480', .5, .75, .48), ('01553', .45, .7, .55)]),
    # C14
    p('logo-cap', 'کلاه کپ لوگودار', 'Logo cap', 'Logolu şapka', 'accessories',
      OS, colours('صورتی', 'سفید'), '', 3_490_000, 'C14',
      [('01423', .42, .15, .35)]),
    p('patterned-wool-knit', 'بافت پشم خالص طرح‌دار', 'Patterned pure wool knit', 'Desenli saf yün triko', 'knit',
      OS, colours('صورتی و طوسی', 'کرم و قهوه‌ای', 'آبی و سرمه‌ای'), 'پشم خالص', 13_990_000, 'C14',
      [('01472', .65, .42, .32), ('01423', .45, .5, .7)]),
    p('avishu-vest', 'وست اویشو', 'Avishu vest', 'Avishu yelek', 'vest',
      LXL, colours('خاکستری تیره'), 'اویشو', 15_990_000, 'C14',
      [('01392', .5, .42, .38), ('01423', .55, .45, .6)]),
    p('avishu-trousers-grey', 'شلوار اویشو خاکستری تیره', 'Dark grey Avishu trousers', 'Koyu gri Avishu pantolon',
      'trousers', LXL, colours('خاکستری تیره', hexes={'خاکستری تیره': '#3F3F42'}), 'اویشو', 15_490_000, 'C14',
      [('01392', .47, .7, .45), ('01412', .4, .65, .5)]),
    # C15
    p('black-white-bandana', 'باندانا مشکی و سفید', 'Black and white bandana', 'Siyah-beyaz bandana',
      'accessories', OS, colours('مشکی و سفید طرح‌دار'), '', 1_990_000, 'C15',
      [('01462', .57, .18, .35)]),
    p('striped-pink-knit', 'بافت پشمی راه‌راه صورتی', 'Pink striped wool knit', 'Pembe çizgili yün triko', 'knit',
      OS, colours('صورتی و طوسی', 'زرشکی و صورتی'), 'پشم', 9_490_000, 'C15',
      [('01462', .53, .4, .3), ('01451', .62, .35, .3)]),
    p('bomber-jacket', 'بامبر', 'Bomber jacket', 'Bomber ceket', 'jacket',
      LS, colours('قهوه‌ای', 'سفید'), 'دورس سه‌نخ آستردار', 15_490_000, 'C15',
      [('01462', .5, .48, .8)]),
    p('dors-trousers', 'شلوار دورس سه‌نخ توکرک', 'Fleece-lined dors trousers', 'İçi polarlı dors pantolon',
      'trousers', LS, colours('قهوه‌ای', 'طوسی', 'مشکی', 'سفید'), 'دورس سه‌نخ توکرک', 12_990_000, 'C15',
      [('01472', .35, .7, .4), ('01462', .5, .82, .5)]),
    # C16 (+ 02133, 02160, 02193 left)
    p('cotton-shirt-white', 'شومیز نخ پنبه', 'Cotton shirt', 'Pamuklu gömlek', 'shirt',
      LXL, colours('قرمز', 'سرمه‌ای', 'قهوه‌ای', 'استخوانی', 'سفید'), 'نخ پنبه', 7_990_000, 'C16',
      [('02156', .5, .42, .3)]),
    p('white-wool-knit', 'بافت پشمی سفید', 'White wool knit', 'Beyaz yün triko', 'knit',
      OS, colours('سفید'), 'پشم', 11_490_000, 'C16',
      [('02156', .48, .47, .35), ('02133', .4, .45, .4)]),
    p('light-wide-jeans', 'شلوار جین گشاد', 'Wide jeans', 'Bol kot pantolon', 'trousers',
      JEANS, colours('جین روشن', hexes={'جین روشن': '#C3CCD6'}), '', 8_990_000, 'C16',
      [('02133', .43, .68, .5)]),
    p('hooded-fur-jacket', 'کت پوست کوتاه کلاه‌دار', 'Hooded short-pile fur jacket', 'Kapüşonlu kısa tüylü kürk ceket',
      'jacket', OS, colours('مشکی', 'طوسی'), 'پوست کوتاه', 21_090_000, 'C16',
      [('02156', .5, .5, .5), ('02133', .6, .5, .5)]),
    # C17
    p('cotton-trousers', 'شلوار نخ پنبه', 'Cotton trousers', 'Pamuklu pantolon', 'trousers',
      LS, colours('طوسی'), 'نخ پنبه', 12_990_000, 'C17',
      [('02193', .45, .72, .5)]),
    p('dors-sweatshirt', 'دورس', 'Crew sweatshirt (dors)', 'Bisiklet yaka sweatshirt (dors)', 'hoodie',
      LS, colours('قرمز', 'طوسی', 'شکلاتی'), 'سه‌نخ توکرک', 13_990_000, 'C17',
      [('02173', .55, .62, .55)]),
    # C17 «پالتو اور سایز، فوتر، S m l» and C19 «پالتو اورسایز، فوتر پشمی، قهوه‌ای طوسی، s m l»: same price
    p('oversize-coat', 'پالتو اورسایز', 'Oversize coat', 'Oversize palto', 'jacket',
      LS, colours('قهوه‌ای', 'طوسی'), 'فوتر پشمی', 41_990_000, 'C17, C19',
      [('02173', .5, .6, .9), ('02102', .55, .5, .7)]),
    # C18
    p('marc-jacobs-bag', 'کیف MARC JACOBS', 'MARC JACOBS bag', 'MARC JACOBS çanta', 'accessories',
      OS, colours('سفید و قهوه‌ای'), 'چرم فراوری‌شده', 12_990_000, 'C18',
      [('01732', .17, .82, .32), ('02025', .85, .6, .32)],
      note=('برند MARC JACOBS.', 'MARC JACOBS.', 'MARC JACOBS.')),
    p('waxed-trench', 'بارانی شمعی', 'Waxed trench coat', 'Mumlu trençkot', 'jacket',
      LS, colours('قهوه‌ای', hexes={'قهوه‌ای': '#7A4E33'}), 'شمعی', 34_990_000, 'C18',
      [('01979', .57, .5, .5), ('02025', .4, .5, .6)]),
    p('avishu-sweatshirt', 'سوشرت اویشو', 'Avishu sweatshirt', 'Avishu sweatshirt', 'hoodie',
      LXL, colours('سبز زیتونی'), 'اویشو', 16_990_000, 'C18',
      [('02066', .5, .4, .5)]),
    p('avishu-trousers-olive', 'شلوار اویشو سبز زیتونی', 'Olive Avishu trousers', 'Zeytin yeşili Avishu pantolon',
      'trousers', LXL, colours('سبز زیتونی'), 'اویشو', 15_490_000, 'C18',
      [('02066', .5, .7, .45)]),
    # C19
    p('floral-bandana', 'باندانا نخی گل‌دار', 'Floral cotton bandana', 'Çiçekli pamuklu bandana', 'accessories',
      OS, colours('صورتی گل‌دار', hexes={'صورتی گل‌دار': '#D79BB4'}), 'نخ', 1_990_000, 'C19',
      [('02057', .55, .17, .3)]),
    p('fine-wool-knit', 'بافت پشمی نازک', 'Fine wool knit', 'İnce yün triko', 'knit',
      OS, colours('سبز و کرم', 'کرم و قهوه‌ای'), 'پشمی نازک', 9_490_000, 'C19',
      [('02057', .5, .48, .65), ('02042', .54, .4, .4)]),
    p('waxed-trousers', 'شلوار شمعی ضدآب', 'Waterproof waxed trousers', 'Su geçirmez mumlu pantolon', 'trousers',
      LXL, colours('شکلاتی', 'سبز زیتونی روشن'), 'شمعی ضدآب', 12_990_000, 'C19',
      [('02042', .5, .65, .45)]),
    # C20
    p('zara-bag', 'کیف زارا', 'Zara bag', 'Zara çanta', 'accessories',
      OS, colours('زرشکی'), 'جیر و چرم', 12_990_000, 'C20',
      [('02057', .53, .63, .4), ('02629', .55, .66, .3)],
      note=('اورجینال زارا.', 'Original Zara.', 'Orijinal Zara.')),
    # C21
    p('gabardine-trousers', 'شلوار گاباردین', 'Gabardine trousers', 'Gabardin pantolon', 'trousers',
      LXL, colours('سرمه‌ای', 'شکلاتی'), 'گاباردین گرم‌بالا', 15_490_000, 'C21',
      [('02629', .52, .8, .45)]),
    p('pure-wool-cardigan', 'رویه پشم خالص', 'Pure wool cardigan', 'Saf yün hırka', 'cardigan',
      LS, colours('کرم'), 'پشم خالص', 27_990_000, 'C21',
      [('02629', .52, .45, .55), ('02781', .4, .5, .8)]),
    p('turtleneck', 'یقه‌اسکی', 'Turtleneck', 'Balıkçı yaka', 'knit',
      OS, colours('سفید', 'مشکی'), '', 9_690_000, 'C21',
      [('02668', .6, .45, .5)]),
    p('satin-paisley-bandana', 'باندانا حریر ساتن', 'Satin bandana', 'Saten bandana', 'accessories',
      OS, colours('قهوه‌ای طرح‌دار', hexes={'قهوه‌ای طرح‌دار': '#5C4030'}), 'حریر ساتن', 2_990_000, 'C21',
      [('02781', .55, .25, .55), ('02668', .55, .25, .35)]),
    # C22
    p('pure-wool-jacket', 'کت پشم خالص', 'Pure wool jacket', 'Saf yün ceket', 'jacket',
      OS, colours('شکلاتی'), 'پشم خالص', 18_990_000, 'C22',
      [('02683', .5, .38, .6), ('02766', .55, .45, .7)]),
    p('trench-skirt', 'دامن ترنچ', 'Trench skirt', 'Trençkot kumaşı etek', 'skirts',
      LS, colours('شکلاتی', 'کرم'), 'ترنچ', 15_990_000, 'C22',
      [('02683', .53, .65, .5)]),
    p('four-colour-bandana', 'باندانا', 'Bandana', 'Bandana', 'accessories',
      OS, colours('زرشکی', 'قهوه‌ای', 'مشکی', 'سرمه‌ای'), '', 1_690_000, 'C22',
      [('02683', .52, .22, .25)]),
    # C23
    p('canvas-cap', 'کلاه برزنتی', 'Canvas cap', 'Kanvas şapka', 'accessories',
      OS, colours('سرخابی', 'سبز لجنی'), 'برزنت', 3_490_000, 'C23',
      [('01720', .65, .12, .5), ('01699', .4, .12, .5)]),
    p('cream-wool-knit', 'بافت پشمی کرم', 'Cream wool knit', 'Krem yün triko', 'knit',
      OS, colours('کرم'), 'پشم', 12_490_000, 'C23',
      [('01720', .8, .65, .4), ('01699', .35, .55, .6)]),
    p('waxed-vest', 'وست شمعی', 'Waxed vest', 'Mumlu yelek', 'vest',
      LS, colours('خاکی', 'سبز تیره'), 'شمعی', 22_990_000, 'C23',
      [('01699', .5, .45, .8), ('01695', .5, .35, .5)]),
    p('grey-jeans', 'شلوار جین طوسی', 'Grey jeans', 'Gri kot pantolon', 'trousers',
      JEANS, colours('جین طوسی'), 'جین', 10_990_000, 'C23',
      [('01695', .5, .67, .5)]),
    # C24
    p('short-trench', 'بارانی کوتاه یقه‌دار', 'Short collared trench jacket', 'Kısa yakalı trençkot', 'jacket',
      LS, colours('خاکی', hexes={'خاکی': '#7D7650'}), 'ترنچ', 25_990_000, 'C24',
      [('01732', .68, .45, .6)]),
]

# Outfits, one story each: (caption, 9:16 frame (photo, cx, cy, w), fa/en/tr title, pieces).
LOOKS = [
    ('C2', ('02794', .5, .5, .84), ('کپ و رویه موهر', 'Cap and mohair top', 'Şapka ve tiftik üst'),
     ['pastel-cotton-cap', 'mohair-top', 'mohair-trousers', 'white-leather-bag']),
    ('C3', ('02862', .5, .5, .84), ('بافت دکمه‌دار و جین سفید', 'Buttoned knit, white jeans', 'Düğmeli triko, beyaz kot'),
     ['buttoned-wool-knit', 'wool-scarf', 'white-jeans', 'pastel-cotton-cap']),
    ('C4', ('02623', .5, .5, .84), ('کت پوست مصنوعی و ست سوشرت', 'Faux fur coat, sweatshirt set', 'Suni kürk ceket, sweatshirt takımı'),
     ['faux-fur-coat', 'fleece-sweatshirt', 'fleece-trousers', 'silk-satin-bandana']),
    ('C5', ('02476', .45, .5, .84), ('کت تدی و ست سوشرت', 'Teddy coat, sweatshirt set', 'Teddy ceket, sweatshirt takımı'),
     ['wool-teddy-coat', 'fleece-sweatshirt', 'fleece-trousers', 'silk-satin-bandana']),
    ('C6', ('01782', .4, .5, .84), ('کاپشن چرم روغنی', 'Oiled leather jacket', 'Yağlı deri mont'),
     ['oiled-leather-jacket', 'wool-underknit', 'chocolate-jeans', 'cotton-cap', 'cotton-foulard']),
    ('C7', ('01814', .55, .5, .84), ('بارونی چرم و ست اویشو', 'Leather trench, Avishu set', 'Deri trençkot, Avishu takım'),
     ['oiled-leather-trench', 'avishu-top', 'avishu-trousers', 'white-collar-underknit', 'cotton-turtleneck',
      'karl-lagerfeld-bag', 'pastel-cotton-cap']),
    ('C8', ('01321', .5, .5, .84), ('کت و شلوار جین', 'Denim on denim', 'Kot üstüne kot'),
     ['denim-jacket', 'dark-jeans', 'high-neck-wool-knit', 'patchwork-bandana']),
    ('C9', ('01363', .5, .5, .84), ('بارانی گاباردین', 'Gabardine trench', 'Gabardin trençkot'),
     ['gabardine-trench', 'ribbed-knit', 'cotton-shirt', 'red-bandana', 'waterproof-sneakers']),
    ('C10', ('02289', .55, .5, .84), ('کت پوست کوتاه و جین کرم', 'Short-pile fur jacket, cream jeans', 'Kısa tüylü kürk ceket, krem kot'),
     ['short-fur-jacket', 'pure-wool-underknit', 'plain-shirt', 'green-cream-jeans']),
    ('C11', ('02312', .5, .5, .84), ('ست سوشرت بادمجانی', 'Aubergine sweatshirt set', 'Patlıcan moru sweatshirt takımı'),
     ['collared-sweatshirt', 'sweat-trousers', 'striped-wool-knit', 'print-bandana']),
    ('C12', ('01542', .5, .5, .84), ('کاپشن چرم واترپروف', 'Waterproof leather jacket', 'Su geçirmez deri mont'),
     ['waterproof-leather-bomber', 'two-tone-wool-knit', 'fleece-trousers', 'brown-paisley-bandana']),
    ('C13', ('01480', .5, .5, .84), ('کت چرم و جین روشن', 'Leather jacket, light jeans', 'Deri ceket, açık kot'),
     ['waterproof-leather-jacket', 'light-ripped-jeans', 'cotton-shirt', 'two-tone-stripe-knit', 'baseball-cap']),
    ('C14', ('01392', .5, .5, .84), ('وست و شلوار اویشو', 'Avishu vest and trousers', 'Avishu yelek ve pantolon'),
     ['avishu-vest', 'avishu-trousers-grey', 'patterned-wool-knit', 'cotton-shirt', 'logo-cap', 'waterproof-sneakers']),
    ('C15', ('01444', .5, .5, .84), ('بامبر و شلوار دورس', 'Bomber, dors trousers', 'Bomber, dors pantolon'),
     ['bomber-jacket', 'dors-trousers', 'striped-pink-knit', 'cotton-shirt', 'black-white-bandana', 'baseball-cap',
      'karl-lagerfeld-bag']),
    ('C16', ('02156', .45, .5, .84), ('کت پوست کوتاه کلاه‌دار', 'Hooded short-pile fur jacket', 'Kapüşonlu kısa tüylü kürk ceket'),
     ['hooded-fur-jacket', 'white-wool-knit', 'cotton-shirt-white', 'light-wide-jeans', 'red-bandana', 'white-leather-bag']),
    ('C17', ('02173', .5, .5, .84), ('پالتو اورسایز و دورس', 'Oversize coat, crew sweatshirt', 'Oversize palto, sweatshirt'),
     ['oversize-coat', 'dors-sweatshirt', 'cotton-trousers', 'patchwork-bandana']),
    ('C18', ('02025', .45, .5, .84), ('بارانی شمعی و ست اویشو', 'Waxed trench, Avishu set', 'Mumlu trençkot, Avishu takım'),
     ['waxed-trench', 'avishu-sweatshirt', 'avishu-trousers-olive', 'marc-jacobs-bag']),
    ('C19', ('02042', .5, .5, .84), ('پالتو اورسایز و بافت نازک', 'Oversize coat, fine knit', 'Oversize palto, ince triko'),
     ['oversize-coat', 'fine-wool-knit', 'cotton-shirt', 'waxed-trousers', 'floral-bandana', 'zara-bag']),
    ('C21', ('02629', .5, .5, .84), ('رویه پشم خالص و یقه‌اسکی', 'Pure wool cardigan, turtleneck', 'Saf yün hırka, balıkçı yaka'),
     ['pure-wool-cardigan', 'turtleneck', 'gabardine-trousers', 'satin-paisley-bandana', 'zara-bag']),
    ('C22', ('02683', .5, .5, .84), ('کت پشم خالص و دامن ترنچ', 'Pure wool jacket, trench skirt', 'Saf yün ceket, trençkot kumaşı etek'),
     ['pure-wool-jacket', 'trench-skirt', 'four-colour-bandana', 'zara-bag']),
    ('C23', ('01695', .5, .5, .84), ('وست شمعی و جین طوسی', 'Waxed vest, grey jeans', 'Mumlu yelek, gri kot'),
     ['waxed-vest', 'cream-wool-knit', 'grey-jeans', 'canvas-cap']),
    ('C24', ('01732', .68, .5, .6), ('بارانی کوتاه و جین سبز', 'Short trench, green jeans', 'Kısa trençkot, yeşil kot'),
     ['short-trench', 'green-cream-jeans', 'marc-jacobs-bag', 'canvas-cap']),
]
COVER = ('01975', .5, .45, 1.0)     # 3:4
EDITORIAL = ('01488', .5, .5, 1.0)  # 16:10, the one landscape photo

# Pieces whose sizes the captions do not give: Ilya's answers, 2026-10-19.
SIZES_ASKED = {'waterproof-leather-bomber': LS}


def save(im, name, widths, ratio, out):
    for W in widths:
        H = round(W * ratio)
        im.resize((W, H), Image.LANCZOS).save(out / f'{name}-{W}.webp', 'WEBP', quality=82, method=6)


def box(size, cx, cy, w, ratio):
    """A ratio (h/w) box, w as a fraction of the photo's width, centred on
    (cx, cy) and slid back inside the photo; shrunk if it cannot fit."""
    W, H = size
    bw = w * W
    bh = bw * ratio
    if bh > H:
        bh = H; bw = bh / ratio
    if bw > W:
        bw = W; bh = bw * ratio
    x0 = min(max(cx * W - bw / 2, 0), W - bw)
    y0 = min(max(cy * H - bh / 2, 0), H - bh)
    return (round(x0), round(y0), round(x0 + bw), round(y0 + bh))


_cache = {}


def photo(src, n):
    if n not in _cache:
        _cache.clear()
        _cache[n] = ImageOps.exif_transpose(Image.open(src / f'DSC{n}.JPG')).convert('RGB')
    return _cache[n]


def build(src, out, only=None, draft=False):
    """Write every image into out/ and return (catalogue, looks for data.js)."""
    out.mkdir(parents=True, exist_ok=True)
    ids = {p['id'] for p in P}
    assert len(ids) == len(P), 'repeated id'
    for c, frame, title, items in LOOKS:
        for i in items:
            assert i in ids, (c, i)
    jobs = []   # (photo, box-args, name, widths, ratio)
    cat = []
    for i, p in enumerate(P):
        sizes = p['sizes'] if p['sizes'] is not None else SIZES_ASKED.get(p['id'])
        if not sizes and draft:
            sizes = ['S', 'M', 'L']
        assert sizes, f"no sizes for {p['id']}"
        imgs = []
        for k, (n, cx, cy, w) in enumerate(p['crops']):
            name = f"r-{p['id']}" + (f'-{k + 1}' if k else '')
            jobs.append((n, (cx, cy, w), name, (480, 960), 1.25))
            imgs.append(f'assets/img/{name}')
        note = p.get('note')
        cat.append({
            'id': p['id'],
            'name': {'fa': p['fa'], 'en': p['en'], 'tr': p['tr']},
            'cat': p['cat'], 'col': 'aw27', 'price': int(p['price']),
            'images': imgs, 'sizes': sizes, 'stock': None, 'fit': 'true', 'badge': '',
            'colours': p['col'],
            'note': {'fa': note[0], 'en': note[1], 'tr': note[2]} if note else {'fa': '', 'en': '', 'tr': ''},
            'detail': {'fa': '', 'en': '', 'tr': ''},
            'fabric': fabric(p['fab']),
            'care': {'fa': '', 'en': '', 'tr': ''},
            'visible': True, 'sort': i,
        })
    looks = []
    for k, (c, (n, cx, cy, w), title, items) in enumerate(LOOKS, 1):
        jobs.append((n, (cx, cy, w), f'r-look-{k}', (720, 1080), 16 / 9))
        looks.append({'id': f'r{k}', 'img': f'r-look-{k}', 'title': title, 'items': items, 'src': c})
    jobs.append((COVER[0], COVER[1:], 'r-col', (480, 960), 4 / 3))
    jobs.append((EDITORIAL[0], EDITORIAL[1:], 'r-ed', (480, 960), 10 / 16))
    # one photo open at a time: group the jobs by photo
    for n in sorted({j[0] for j in jobs}):
        if only and n not in only:
            continue
        im = photo(src, n)
        for jn, (cx, cy, w), name, widths, ratio in jobs:
            if jn == n:
                save(im.crop(box(im.size, cx, cy, w, ratio)), name, widths, ratio, out)
    return cat, looks


if __name__ == '__main__':
    src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    only = next((a.split('=', 1)[1].split(',') for a in sys.argv if a.startswith('--only=')), None)
    cat, looks = build(src, out / 'img', only=only, draft='--draft' in sys.argv)
    (out / 'catalog-import.json').write_text(json.dumps(cat, ensure_ascii=False, indent=1), encoding='utf-8')
    (out / 'looks.json').write_text(json.dumps(looks, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(cat), 'pieces;', sum(len(p['images']) for p in cat), 'piece images;', len(looks), 'looks')
