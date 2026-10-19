"""preview.py OUT.jpg id1,id2,...  — the crops of these pieces, labelled (2400px photos)."""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import catalog as C
SRC = pathlib.Path('/mnt/user-data/uploads/tiffany-deploy/photos2400')
S = pathlib.Path('/tmp/claude-0/-home-claude/796a0c83-ebd1-5cb7-bbc5-4381337bc9b6/scratchpad')
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
ids = sys.argv[2].split(',')
tiles = []
for pid in ids:
    pr = next(x for x in C.P if x['id'] == pid)
    for k, (n, cx, cy, w) in enumerate(pr['crops']):
        im = C.photo(SRC, n)
        b = C.box(im.size, cx, cy, w, 1.25)
        t = im.crop(b).resize((320, 400), Image.LANCZOS)
        d = ImageDraw.Draw(t)
        d.rectangle([0, 376, 320, 400], fill='white')
        d.text((4, 378), f'{pid[:22]} {k} {n}', fill='black', font=f)
        tiles.append(t)
cols = min(6, len(tiles)); rows = (len(tiles) + cols - 1) // cols
o = Image.new('RGB', (cols * 324, rows * 404), 'white')
for i, t in enumerate(tiles):
    o.paste(t, ((i % cols) * 324, (i // cols) * 404))
o.save(S / sys.argv[1], quality=85)
print(len(tiles), 'tiles')
