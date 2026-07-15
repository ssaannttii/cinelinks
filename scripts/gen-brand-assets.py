# Regenerates og-image.png, x-banner.png and x-header.png in the Amber Blocks
# palette (slate #252c35 + amber #e8a000). Run: python3 scripts/gen-brand-assets.py
# Uses DejaVu Sans (same family the previous assets used) so it works anywhere.
from PIL import Image, ImageDraw, ImageFont

SLATE = (37, 44, 53)        # #252c35
PANEL = (44, 52, 63)        # #2c343f
AMBER = (232, 160, 0)       # #e8a000
AMBER_SOFT = (245, 197, 66) # #f5c542
INK = (26, 20, 8)           # dark text on amber
TXT = (242, 244, 246)
MUT = (154, 164, 176)

BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def font(size):
    return ImageFont.truetype(BOLD, size)


def text_w(d, s, f, ls=0):
    w = d.textlength(s, font=f)
    return w + ls * max(0, len(s) - 1)


def draw_tracked(d, xy, s, f, fill, ls):
    """Letter-spaced text (PIL has no tracking)."""
    x, y = xy
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + ls


def chain_icon(size, stroke, color):
    """Two interlocked rounded links, rendered oversampled then rotated."""
    S = 4  # supersample
    lw, lh = int(size * 1.05) * S, int(size * .62) * S
    st = stroke * S
    link = Image.new('RGBA', (lw + st * 2, lh + st * 2), (0, 0, 0, 0))
    dl = ImageDraw.Draw(link)
    dl.rounded_rectangle([st, st, lw + st, lh + st], radius=lh // 2 + st // 2,
                         outline=color, width=st)
    cw = int(size * 2.1) * S
    ch = int(size * 1.3) * S
    canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    a = link.rotate(28, expand=True, resample=Image.BICUBIC)
    b = link.rotate(28, expand=True, resample=Image.BICUBIC)
    ax = cw // 2 - a.width // 2 - int(size * .34) * S
    bx = cw // 2 - b.width // 2 + int(size * .34) * S
    ay = ch // 2 - a.height // 2
    canvas.alpha_composite(a, (ax, ay))
    canvas.alpha_composite(b, (bx, ay))
    return canvas.resize((cw // S, ch // S), Image.LANCZOS)


def rule(d, cx, y, w, color):
    d.line([cx - w, y, cx - w * .28, y], fill=color, width=3)
    d.line([cx + w * .28, y, cx + w, y], fill=color, width=3)
    d.ellipse([cx - 4, y - 4, cx + 4, y + 4], outline=color, width=2)


def compose(w, h, scale=1.0):
    img = Image.new('RGB', (w, h), SLATE)
    d = ImageDraw.Draw(img)
    cx = w // 2

    f_logo = font(int(96 * scale))
    f_tag = font(int(25 * scale))
    f_sub = font(int(40 * scale))
    f_cta = font(int(28 * scale))

    total = int(430 * scale)
    y = (h - total) // 2

    # wordmark
    s = 'CineLinks'
    d.text((cx - text_w(d, s, f_logo) / 2, y), s, font=f_logo, fill=AMBER)
    y += int(126 * scale)

    # tagline, tracked, with side rules
    tag = 'A CINEMATIC LINK PUZZLE'
    ls = int(6 * scale)
    tw = text_w(d, tag, f_tag, ls)
    draw_tracked(d, (cx - tw / 2, y), tag, f_tag, AMBER_SOFT, ls)
    ty = y + int(16 * scale)
    d.line([cx - tw / 2 - int(60 * scale), ty, cx - tw / 2 - int(18 * scale), ty], fill=AMBER, width=2)
    d.line([cx + tw / 2 + int(18 * scale), ty, cx + tw / 2 + int(60 * scale), ty], fill=AMBER, width=2)
    y += int(60 * scale)

    # chain link mark
    icon = chain_icon(int(46 * scale), max(3, int(7 * scale)), AMBER + (255,))
    img.paste(icon, (cx - icon.width // 2, y), icon)
    y += icon.height + int(28 * scale)

    # subtitle
    sub = 'Connect actors, movies & TV in the fewest clicks'
    d.text((cx - text_w(d, sub, f_sub) / 2, y), sub, font=f_sub, fill=TXT)
    y += int(78 * scale)

    # CTA: solid amber pill (new button language)
    cta = 'NEW CHALLENGE EVERY DAY'
    ls2 = int(2 * scale)
    ctw = text_w(d, cta, f_cta, ls2)
    px, py = int(34 * scale), int(16 * scale)
    bh = int(f_cta.size + py * 2)
    d.rounded_rectangle([cx - ctw / 2 - px, y, cx + ctw / 2 + px, y + bh],
                        radius=bh // 2, fill=AMBER)
    draw_tracked(d, (cx - ctw / 2, y + py - int(2 * scale)), cta, f_cta, INK, ls2)
    return img


if __name__ == '__main__':
    compose(1200, 630).save('og-image.png')
    banner = compose(1500, 500, scale=0.78)
    banner.save('x-banner.png')
    banner.save('x-header.png')
    print('og-image.png, x-banner.png, x-header.png regenerated')
