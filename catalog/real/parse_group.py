"""Split group.txt into the captioned posts (C1..C24) and their items, each with its price."""
import re, pathlib
FA = str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')
def posts():
    txt = pathlib.Path(__file__).with_name('group.txt').read_text(encoding='utf-8')
    msgs = txt.split('> ')[1:]
    out = []
    for m in msgs:
        body = m.split(':\n', 1)[1] if ':\n' in m else m
        if body.startswith('📎'):
            items = [b.strip() for b in re.split(r'\n\s*\n', body.lstrip('📎 ').strip()) if b.strip()]
            parsed = []
            for it in items:
                prices = [int(x.translate(FA)) for x in re.findall(r'[۰-۹0-9]{6,9}', it)]
                parsed.append((it, prices))
            out.append(parsed)
    return out
if __name__ == '__main__':
    for i, post in enumerate(posts(), 1):
        for j, (it, pr) in enumerate(post):
            print(f'C{i}.{j+1}', pr, it.splitlines()[0][:30])
