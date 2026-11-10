"""Turn the environment art in art/source/ into game-ready files in assets/env/.

 * dirt_tile.webp  -> dirt.jpg          (seamless fill texture, 512x512)
 * grass_strip.png -> grass_strip.png   (seamless strip, white removed, resized)
 * background.png  -> background.jpg    (seamless parallax backdrop)
 * ramp.png        -> ramp.png + src/rampProfile.js (the plank's top curve)
 * decorations.png -> tuft/mushroom/rocks/flower/bush.png
 * props.png       -> fence/tree/tires/finish_gate.png

The white-background sheets get a real alpha channel: white connected to the
image border becomes transparent, and the anti-aliased edge pixels next to it
are turned into a soft dark outline (no white fringe).

Run from the repo root:  python tools/slice_env.py
Needs: pip install pillow numpy scipy
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "assets" / "env"

GRASS_HEIGHT = 112  # strip height in game px (the art is resized so the game uses it 1:1)

DECOR = {  # name: crop box (x0, y0, x1, y1) in decorations.png
    "tuft": (85, 80, 562, 331),
    "mushroom": (690, 94, 928, 340),
    "rocks": (318, 390, 706, 633),
    "flower": (143, 660, 352, 954),
    "bush": (532, 672, 962, 959),
}
PROPS = {  # in props.png
    "fence": (37, 30, 562, 229),
    "tree": (24, 239, 331, 559),
    "tires": (374, 277, 664, 557),
    "finish_gate": (682, 24, 1001, 562),
}
SPOOKY_DECOR = {  # in spooky_decorations.png
    "thorns": (72, 54, 412, 330),
    "pumpkin": (716, 77, 959, 325),
    "spooky_mushrooms": (447, 209, 668, 464),
    "tombstone": (647, 427, 980, 692),
    "bones": (121, 473, 457, 679),
}
SPOOKY_PROPS = {  # in spooky_props.webp
    "spooky_tree": (566, 20, 982, 385),
    "iron_fence": (41, 53, 505, 340),
    "slime_tires": (70, 415, 449, 736),
    "spooky_gate": (482, 388, 996, 749),
}
DESERT_DECOR = {  # in desert_decorations.webp
    "cactus": (49, 28, 371, 373),
    "desert_rocks": (500, 85, 919, 362),
    "tumbleweed": (54, 409, 371, 708),
    "prickly_pear": (744, 415, 993, 690),
    "cow_skull": (419, 434, 725, 686),
}
DESERT_PROPS = {  # in desert_props.webp
    "trex_skull": (552, 29, 946, 331),
    "ranch_fence": (38, 71, 507, 314),
    "desert_gate": (464, 340, 1000, 745),
    "dusty_tires": (62, 399, 445, 729),
}
SPIDER = {  # in spider.png: (x0, y0, x1, y1, keep only the biggest piece?)
    "spider_body": (60, 40, 436, 302, True),
    "spider_legs_left": (35, 324, 261, 614, True),  # hip ball on the right
    "spider_legs_right": (243, 449, 462, 721, True),  # hip ball on the left
    "spider_thread": (446, 58, 532, 696, True),
    "spider_dizzy": (546, 120, 1010, 404, False),  # squished spider + its stars and spirals
}
CRAB = {  # in crab.png: (x0, y0, x1, y1, keep only the biggest piece?)
    "crab_body": (166, 96, 493, 331, True),
    "crab_claw": (29, 35, 197, 336, True),  # the raised claw
    "crab_leg": (245, 464, 409, 714, True),
    "crab_dizzy": (575, 100, 1004, 420, False),  # squished crab + its stars and spirals
}


def cut_white(rgb, hole_min=2500):
    """RGB uint8 array on white -> RGBA with the outside white made transparent."""
    rgb = rgb.astype(np.int16)
    whitish = rgb.min(axis=2) > 222
    lab, n = ndimage.label(whitish)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    # big white areas fully enclosed by outlines (gaps in a fence, under a banner)
    # are background too; small ones (mushroom spots, flag squares) are art
    if n:
        sizes = ndimage.sum(whitish, lab, range(1, n + 1))
        bg |= np.isin(lab, np.where(sizes > hole_min)[0] + 1)
    fg = ~bg
    out = np.zeros((*rgb.shape[:2], 4), dtype=np.uint8)
    out[..., :3] = rgb
    out[..., 3] = fg * 255
    # edge ring: pixels of the foreground touching the background are blends of
    # outline-black and white; turn their lightness into transparency instead
    ring = fg & ndimage.binary_dilation(bg, iterations=2)
    light = rgb.min(axis=2).astype(np.float32)
    a = np.clip((255 - light) / 200.0, 0, 1)
    out[ring, 3] = (a[ring] * 255).astype(np.uint8)
    out[ring, :3] = (22, 22, 24)
    return out


def keep_largest(rgba):
    """Drop everything except the biggest opaque piece (bits of neighbouring parts)."""
    solid = rgba[..., 3] > 8
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        rgba = rgba.copy()
        rgba[lab != int(np.argmax(sizes)) + 1, 3] = 0
    return rgba


def trim(rgba, pad=2):
    ys, xs = np.where(rgba[..., 3] > 8)
    return rgba[max(ys.min() - pad, 0) : ys.max() + pad + 1, max(xs.min() - pad, 0) : xs.max() + pad + 1]


def load(name):
    return np.array(Image.open(SRC / name).convert("RGB"))


def save(arr, name):
    Image.fromarray(arr).save(OUT / name)
    print(f"{name}: {arr.shape[1]}x{arr.shape[0]}")


def ground_set(src_prefix, out_suffix):
    """Dirt tile, backdrop and grass strip for one theme. Returns the strip's
    size and the line the wheels drive on."""
    # dirt: already seamless, just shrink it
    Image.open(next(SRC.glob(f"{src_prefix}dirt_tile.*"))).convert("RGB").resize((512, 512), Image.LANCZOS).save(
        OUT / f"dirt{out_suffix}.jpg", quality=90
    )
    # backdrop: has to repeat left-right. If its two edges don't match, put a
    # mirrored copy next to it, so the edges always meet their mirror image.
    bg = Image.open(SRC / f"{src_prefix}background.png").convert("RGB")
    a = np.asarray(bg).astype(np.int16)
    if np.abs(a[:, 0] - a[:, -1]).mean() > 3:
        both = Image.new("RGB", (bg.width * 2, bg.height))
        both.paste(bg, (0, 0))
        both.paste(bg.transpose(Image.FLIP_LEFT_RIGHT), (bg.width, 0))
        bg = both
    bg.save(OUT / f"background{out_suffix}.jpg", quality=90)

    # grass strip: keep the full width so it still tiles, crop the rows, resize
    g = load(f"{src_prefix}grass_strip.png")
    rows = np.where((g.min(axis=2) < 225).any(axis=1))[0]
    y0, y1 = rows.min() - 2, rows.max() + 1
    strip = cut_white(g[y0:y1])
    h = y1 - y0
    w = round(g.shape[1] * GRASS_HEIGHT / h)
    Image.fromarray(strip).resize((w, GRASS_HEIGHT), Image.LANCZOS).save(OUT / f"grass_strip{out_suffix}.png")
    # the row where the grass body starts (wheels drive on this line)
    tops = []
    for c in range(g.shape[1]):
        col = np.where(g[y0:y1, c].min(axis=1) < 225)[0]
        if len(col):
            tops.append(col.min())
    contact = round(float(np.percentile(tops, 80)) / h, 3)
    print(f"ground{out_suffix or ' (meadow)'}: strip {w}x{GRASS_HEIGHT}, contact {contact}")
    return {"w": w, "h": GRASS_HEIGHT, "contact": contact}


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # ground sets: meadow (levels 1-2) and spooky (levels 3-5)
    ground = {
        "meadow": ground_set("", ""),
        "spooky": ground_set("spooky_", "_spooky"),
        "desert": ground_set("desert_", "_desert"),
    }
    (ROOT / "src" / "groundArt.js").write_text(
        "// Generated by tools/slice_env.py. Do not edit by hand.\n"
        "// Grass strip size and where the wheels touch it (fraction down the strip), per theme.\n"
        f"export const GROUND_ART = {json.dumps(ground)};\n"
    )

    # ramp
    r = trim(cut_white(load("ramp.png"), hole_min=60), pad=0)  # the ramp has no white details
    Image.fromarray(r).save(OUT / "ramp.png")
    alpha = r[..., 3] > 128
    H, W = alpha.shape
    tops = np.array([np.where(alpha[:, x])[0].min() if alpha[:, x].any() else H for x in range(W)])
    lip = int(np.argmin(tops[: int(W * 0.95)]))
    lip_h = H - tops[lip]
    samples = 48
    profile = [round(float(H - tops[int(i * lip / samples)]) / lip_h, 4) for i in range(samples + 1)]
    profile[-1] = 1.0
    back = int(np.where(alpha[H - 4])[0].max())  # where the steel frame meets the ground
    meta = {
        "width": W,
        "height": H,
        "lipX": lip,
        "lipHeight": int(lip_h),
        "backX": back,
        "profile": profile,
    }
    (ROOT / "src" / "rampProfile.js").write_text(
        "// Generated by tools/slice_env.py from art/source/ramp.png. Do not edit by hand.\n"
        "// profile[i] = plank height (0..1 of the lip height) at i/(n-1) of the way to the lip.\n"
        f"export const RAMP_ART = {json.dumps(meta)};\n"
    )
    print(f"ramp.png: {W}x{H}, lip at x={lip} (height {lip_h}), back at x={back}")

    for sheet, boxes in (("decorations.png", DECOR), ("props.png", PROPS)):
        src = load(sheet)
        for name, (x0, y0, x1, y1) in boxes.items():
            save(trim(cut_white(src[y0:y1, x0:x1])), f"{name}.png")

    # spooky scenery for levels 3-5. Thin cobwebs and fence bars enclose
    # little white gaps, so treat even small enclosed white as background.
    for sheet, boxes in (("spooky_decorations.png", SPOOKY_DECOR), ("spooky_props.webp", SPOOKY_PROPS)):
        src = np.array(Image.open(SRC / sheet).convert("RGB"))
        for name, (x0, y0, x1, y1) in boxes.items():
            save(trim(cut_white(src[y0:y1, x0:x1], hole_min=150)), f"{name}.png")

    # desert scenery for level 5 (the tumbleweed is all little gaps)
    for sheet, boxes in (("desert_decorations.webp", DESERT_DECOR), ("desert_props.webp", DESERT_PROPS)):
        src = np.array(Image.open(SRC / sheet).convert("RGB"))
        for name, (x0, y0, x1, y1) in boxes.items():
            hole = 30 if name == "tumbleweed" else 150
            save(trim(cut_white(src[y0:y1, x0:x1], hole_min=hole)), f"{name}.png")

    # crab enemy parts. The eyes are enclosed white areas, so only treat much
    # bigger enclosed white as background.
    src = load("crab.png")
    for name, (x0, y0, x1, y1, largest) in CRAB.items():
        part = cut_white(src[y0:y1, x0:x1], hole_min=9000)
        save(trim(keep_largest(part) if largest else part), f"{name}.png")

    # turbo (nitro) button: keep just the round button. The art has a "1"
    # badge painted on its top-right; outside the circle it's cut away, inside
    # it the game's own live count badge sits on top of it.
    b = cut_white(load("btn_nitro.png"), hole_min=10**9)
    solid = b[..., 3] > 128
    dist = ndimage.distance_transform_edt(solid)
    cy, cx = np.unravel_index(int(np.argmax(dist)), dist.shape)
    r = float(dist.max()) + 1.5
    yy, xx = np.mgrid[: b.shape[0], : b.shape[1]]
    d = np.hypot(yy - cy, xx - cx)
    b[..., 3] = (b[..., 3] * np.clip(r + 0.5 - d, 0, 1)).astype(np.uint8)
    y0, y1 = max(int(cy - r - 2), 0), int(cy + r + 3)
    x0, x1 = max(int(cx - r - 2), 0), int(cx + r + 3)
    save(b[y0:y1, x0:x1], "btn_nitro.png")

    # spider enemy parts (spooky levels)
    src = load("spider.png")
    for name, (x0, y0, x1, y1, largest) in SPIDER.items():
        # the legs have no white in them, so even tiny white gaps between them go
        part = cut_white(src[y0:y1, x0:x1], hole_min=20 if "legs" in name else 9000)
        save(trim(keep_largest(part) if largest else part), f"{name}.png")

    # nitro flame: points left, round base on the right. Its white-hot core is
    # an enclosed near-white area, so don't treat enclosed white as background.
    f = trim(cut_white(load("flame.png"), hole_min=10**9))
    alpha = f[..., 3] > 128
    H, W = alpha.shape
    # the base (where it leaves the pipe) is the centre of the round end: the
    # tallest column in the right half, a little in from the right edge
    heights = alpha.sum(axis=0)
    cx = W // 2 + int(np.argmax(heights[W // 2 :]))
    rows = np.where(alpha[:, cx])[0]
    origin_x = round((cx + (W - cx) * 0.4) / W, 3)
    origin_y = round(float(rows.mean()) / H, 3)
    out_w = 360
    img = Image.fromarray(f).resize((out_w, round(H * out_w / W)), Image.LANCZOS)
    img.save(OUT / "flame_jet.png")
    (ROOT / "src" / "flameArt.js").write_text(
        "// Generated by tools/slice_env.py from art/source/flame.png. Do not edit by hand.\n"
        "// originX/originY: where the flame leaves the pipe, as a fraction of the image size.\n"
        f"export const FLAME_ART = {json.dumps({'width': img.width, 'height': img.height, 'originX': origin_x, 'originY': origin_y})};\n"
    )
    print(f"flame_jet.png: {img.width}x{img.height}, origin ({origin_x}, {origin_y})")


if __name__ == "__main__":
    main()
