#!/usr/bin/env python3
"""
Generates icon-192.png and icon-512.png for Scontrini Papà.
Uses only Python standard library — no Pillow required.
Run: python3 generate_icons.py
"""
import struct, zlib, math, os

def png_chunk(chunk_type, data):
    c = chunk_type + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

def make_png(size):
    # Colors
    BLUE   = (0, 122, 255, 255)   # #007aff
    WHITE  = (255, 255, 255, 255)
    TRANSP = (0, 0, 0, 0)

    cx = cy = size / 2
    radius = size / 2
    inner_r = radius * 0.55   # White rect area

    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            # Circular mask for icon shape
            dx = x - cx + 0.5
            dy = y - cy + 0.5
            dist = math.sqrt(dx*dx + dy*dy)

            if dist > radius:
                row.append(TRANSP)
                continue

            # Receipt icon — simplified white rectangle with lines
            rx = (x - cx) / inner_r
            ry = (y - cy) / inner_r

            if abs(rx) < 0.42 and abs(ry) < 0.55:
                # Inside the receipt rectangle
                # Header bar
                if -0.55 < ry < -0.35 and abs(rx) < 0.42:
                    row.append(WHITE)
                # Text lines
                elif abs(ry - 0.0) < 0.06 and abs(rx) < 0.35:
                    row.append(WHITE)
                elif abs(ry - 0.18) < 0.06 and abs(rx) < 0.28:
                    row.append(WHITE)
                elif abs(ry - 0.36) < 0.06 and abs(rx) < 0.35:
                    row.append(WHITE)
                elif abs(rx) < 0.42 and abs(ry) < 0.55:
                    # Receipt card border (thin)
                    if abs(abs(rx) - 0.42) < 0.04 or abs(abs(ry) - 0.55) < 0.04:
                        row.append(WHITE)
                    else:
                        row.append(BLUE)
                else:
                    row.append(BLUE)
            else:
                row.append(BLUE)

        rows.append(row)

    # Pack to raw PNG bytes
    raw = b''
    for row in rows:
        raw += b'\x00'  # filter byte
        for r, g, b, a in row:
            raw += bytes([r, g, b, a])

    compressed = zlib.compress(raw, 9)

    png = b'\x89PNG\r\n\x1a\n'                          # signature
    png += png_chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))  # RGBA
    png += png_chunk(b'IDAT', compressed)
    png += png_chunk(b'IEND', b'')
    return png

script_dir = os.path.dirname(os.path.abspath(__file__))

for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    data = make_png(size)
    path = os.path.join(script_dir, name)
    with open(path, 'wb') as f:
        f.write(data)
    print(f'Created {name} ({len(data)} bytes)')

print('Done.')
