"""Every caption item maps to one piece, and its price is the caption's, exactly."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import catalog as C
from parse_group import posts
MAP = {
 'C1': ['white-leather-bag'],
 'C2': ['pastel-cotton-cap', 'mohair-top', 'mohair-trousers'],
 'C3': ['buttoned-wool-knit', 'wool-scarf', 'white-jeans'],
 'C4': ['silk-satin-bandana', 'fleece-sweatshirt', 'fleece-trousers', 'faux-fur-coat'],
 'C5': ['silk-satin-bandana', 'fleece-sweatshirt', 'fleece-trousers', 'wool-teddy-coat'],
 'C6': ['oiled-leather-jacket', 'wool-underknit', 'cotton-cap', 'chocolate-jeans', 'cotton-foulard'],
 'C7': ['oiled-leather-trench', 'white-collar-underknit', 'avishu-top', 'avishu-trousers', 'karl-lagerfeld-bag',
        'cotton-turtleneck', 'pastel-cotton-cap'],
 'C8': ['denim-jacket', 'dark-jeans', 'high-neck-wool-knit', 'patchwork-bandana'],
 'C9': ['gabardine-trench', 'ribbed-knit', 'cotton-shirt', 'red-bandana', 'waterproof-sneakers'],
 'C10': ['short-fur-jacket', 'pure-wool-underknit', 'plain-shirt', 'green-cream-jeans'],
 'C11': ['print-bandana', 'striped-wool-knit', 'collared-sweatshirt', 'sweat-trousers'],
 'C12': ['brown-paisley-bandana', 'waterproof-leather-bomber', 'two-tone-wool-knit', 'fleece-trousers'],
 'C13': ['baseball-cap', 'waterproof-leather-jacket', 'cotton-shirt', 'two-tone-stripe-knit', 'light-ripped-jeans'],
 'C14': ['logo-cap', 'cotton-shirt', 'patterned-wool-knit', 'avishu-vest', 'avishu-trousers-grey', 'waterproof-sneakers'],
 'C15': ['black-white-bandana', 'cotton-shirt', 'striped-pink-knit', 'bomber-jacket', 'dors-trousers', 'baseball-cap'],
 'C16': ['red-bandana', 'cotton-shirt-white', 'white-wool-knit', 'light-wide-jeans', 'hooded-fur-jacket'],
 'C17': ['patchwork-bandana', 'cotton-trousers', 'dors-sweatshirt', 'oversize-coat'],
 'C18': ['marc-jacobs-bag', 'waxed-trench', 'avishu-sweatshirt', 'avishu-trousers-olive'],
 'C19': ['floral-bandana', 'cotton-shirt', 'fine-wool-knit', 'waxed-trousers', 'oversize-coat'],
 'C20': ['zara-bag'],
 'C21': ['gabardine-trousers', 'pure-wool-cardigan', 'turtleneck', 'satin-paisley-bandana'],
 'C22': ['pure-wool-jacket', 'trench-skirt', 'four-colour-bandana'],
 'C23': ['canvas-cap', 'cream-wool-knit', 'waxed-vest', 'grey-jeans'],
 'C24': ['short-trench', 'green-cream-jeans'],
}
byid = {p['id']: p for p in C.P}
# Ilya's answer, 2026-10-19: the C19 shirt is 7,990,000 like the other four posts.
CONFIRMED = {('C19', 'cotton-shirt'): 7_990_000}
bad = 0
used = set()
for i, post in enumerate(posts(), 1):
    c = f'C{i}'
    ids = MAP[c]
    assert len(ids) == len(post), (c, len(ids), len(post))
    for (text, prices), pid in zip(post, ids):
        used.add(pid)
        p = byid[pid]
        if c not in [x.strip() for x in p['src'].split(',')]:
            print('SRC MISSING', c, pid); bad += 1
        if prices != [p['price']] and CONFIRMED.get((c, pid)) != p['price']:
            print(f'PRICE {c} {pid}: caption {prices} piece {p["price"]}   «{text.splitlines()[0]}»'); bad += 1
print('pieces never named by a caption:', sorted(set(byid) - used))
print('problems:', bad)
