from PIL import Image, ImageDraw
import os

def make_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Blue rounded-square background
    r = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=(0, 122, 255, 255))

    # White receipt card
    pad = size * 0.18
    cx1, cy1, cx2, cy2 = pad, pad, size - pad, size - pad * 0.65
    cr = size * 0.05
    draw.rounded_rectangle([cx1, cy1, cx2, cy2], radius=cr, fill=(255, 255, 255, 255))

    # Blue lines on card (receipt text rows)
    line_color = (0, 100, 220, 180)
    lx1 = cx1 + size * 0.09
    lx2 = cx2 - size * 0.09
    lh = max(2, int(size * 0.034))
    for i, y_frac in enumerate([0.37, 0.49, 0.59, 0.69]):
        y = int(size * y_frac)
        w = (lx2 - lx1) if i % 2 == 0 else (lx2 - lx1) * 0.6
        draw.rounded_rectangle([lx1, y, lx1 + w, y + lh], radius=lh // 2, fill=line_color)

    # Zig-zag bottom edge of receipt
    n = 6
    zag_y = cy2
    zag_h = size * 0.065
    zag_w = (cx2 - cx1) / n
    for i in range(n):
        x0 = cx1 + i * zag_w
        x1, x2 = x0 + zag_w / 2, x0 + zag_w
        draw.polygon([(x0, zag_y), (x1, zag_y + zag_h), (x2, zag_y)], fill=(0, 122, 255, 255))

    return img

out_dir = os.path.dirname(os.path.abspath(__file__))
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    make_icon(size).save(os.path.join(out_dir, name))
    print(f'Created {name}')
