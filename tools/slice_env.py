"""Turn the environment art in art/source/ into game-ready files in assets/env/.

 * dirt_tile.webp  -> dirt.jpg          (seamless fill texture, 512x512)
 * grass_strip.png -> grass_strip.png   (seamless strip, white removed, resized)
 * background.png  -> background.jpg    (seamless parallax backdrop)
 * ramp.png        -> ramp.png + src/rampProfile.js (the plank's top curve)
 * decorations.png -> tuft/mushroom/rocks/flower/bush.png
 * props.png       -> fence/tree/tires/finish_gate.png
 * spooky_*, desert_*, snow_* -> the same for the other looks (snow uses a
   "snow" cut, since snow is nearly white)

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
SNAKE = {  # in snake.png: (x0, y0, x1, y1, keep only the biggest piece?)
    "snake_body": (40, 37, 507, 452, True),  # coiled, head (with bandana) on the left
    "snake_dizzy": (559, 120, 1005, 420, False),  # squished snake + its stars and spirals
}
CRAB = {  # in crab.png: (x0, y0, x1, y1, keep only the biggest piece?)
    "crab_body": (166, 96, 493, 331, True),
    "crab_claw": (29, 35, 197, 336, True),  # the raised claw
    "crab_leg": (245, 464, 409, 714, True),
    "crab_dizzy": (575, 100, 1004, 420, False),  # squished crab + its stars and spirals
}

SNOW_DECOR = {  # in snow_decorations.png
    "snow_log": (44, 49, 620, 349),
    "ice_crystals": (705, 54, 960, 320),
    "snowballs": (35, 420, 358, 695),
    "icy_bramble": (371, 418, 667, 694),
    "ice_rock": (687, 410, 995, 699),
}
SNOW_PROPS = {  # in snow_props.png
    "snow_fence": (33, 28, 973, 273),
    "snow_gate": (19, 287, 533, 747),
    "snow_tires": (532, 427, 762, 745),
    "snow_tree": (751, 361, 1018, 743),
}
SNOW_SPIDER = {  # in snow_spider.png: (x0, y0, x1, y1, keep only the biggest piece?)
    "snowspider_body": (65, 48, 454, 417, True),  # the snowball with the grumpy face
    "snowspider_leg1": (29, 355, 112, 624, True),  # far left (top end is the hip)
    "snowspider_leg2": (112, 429, 213, 652, True),
    "snowspider_leg3": (310, 459, 419, 712, True),
    "snowspider_leg4": (418, 355, 516, 619, True),  # far right
    "snowspider_dizzy": (540, 120, 1018, 446, False),  # squished, with stars and spirals
}

WRECK = {  # in truck_wreck.png (the truck blown up): (x0, y0, x1, y1, keep only the biggest piece?)
    "wreck_body": (36, 30, 588, 385, True),  # smashed truck, no wheels
    "wreck_wheel1": (29, 369, 241, 576, True),  # tire with a bite out of it
    "wreck_wheel2": (394, 383, 606, 573, True),  # flat tire
    "boom_big": (620, 25, 1012, 432, False),  # explosion with flying bits and stars
    "wreck_shock1": (114, 586, 232, 707, True),
    "wreck_shock2": (238, 522, 294, 686, False),  # its spring is drawn in two pieces
    "wreck_shock3": (325, 525, 398, 679, True),
    "wreck_part1": (46, 619, 116, 696, True),  # bent blue fender
    "wreck_part2": (302, 676, 379, 725, True),  # bent orange fender
    "wreck_part3": (260, 450, 316, 492, True),  # bolt
    "wreck_part4": (401, 644, 477, 709, True),  # rod
    "wreck_part5": (512, 652, 551, 691, True),  # nut
    "wreck_part6": (469, 600, 524, 653, True),  # bolt
}


def cut_white(rgb, hole_min=2500, snow=False):
    """RGB uint8 array on white -> RGBA with the outside white made transparent.

    snow=True: for snowy art, where the snow itself is nearly white. Only
    neutral near-white counts as background (the paper is pure white; the
    snow is tinted a little blue)."""
    rgb = rgb.astype(np.int16)
    if snow:
        whitish = (rgb.min(axis=2) > 238) & (rgb.max(axis=2) - rgb.min(axis=2) <= 8)
    else:
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


def seamless(img):
    """Make a tile repeat without seams: blend it with a copy shifted by half,
    using the copy near the edges (where it joins up with itself)."""
    a = np.asarray(img).astype(np.float32)
    h, w = a.shape[:2]
    shifted = np.roll(a, (h // 2, w // 2), axis=(0, 1))
    wx = np.sin(np.pi * (np.arange(w) + 0.5) / w) ** 0.6
    wy = np.sin(np.pi * (np.arange(h) + 0.5) / h) ** 0.6
    m = (wy[:, None] * wx[None, :])[..., None]
    return Image.fromarray((a * m + shifted * (1 - m)).clip(0, 255).astype(np.uint8))


def ground_set(src_prefix, out_suffix, snow=False):
    """Dirt tile, backdrop and grass strip for one theme. Returns the strip's
    size and the line the wheels drive on."""
    # dirt: shrink it (the snow one isn't seamless, so blend its edges)
    dirt = Image.open(next(SRC.glob(f"{src_prefix}dirt_tile.*"))).convert("RGB").resize((512, 512), Image.LANCZOS)
    if snow:
        dirt = seamless(dirt)
    dirt.save(OUT / f"dirt{out_suffix}.jpg", quality=90)
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
    strip = cut_white(g[y0:y1], snow=snow)
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

    # ground sets: meadow (level 1), spooky (2), desert (3), snow (4)
    ground = {
        "meadow": ground_set("", ""),
        "spooky": ground_set("spooky_", "_spooky"),
        "desert": ground_set("desert_", "_desert"),
        "snow": ground_set("snow_", "_snow", snow=True),
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

    # spooky scenery for level 2. Thin cobwebs and fence bars enclose
    # little white gaps, so treat even small enclosed white as background.
    for sheet, boxes in (("spooky_decorations.png", SPOOKY_DECOR), ("spooky_props.webp", SPOOKY_PROPS)):
        src = np.array(Image.open(SRC / sheet).convert("RGB"))
        for name, (x0, y0, x1, y1) in boxes.items():
            save(trim(cut_white(src[y0:y1, x0:x1], hole_min=150)), f"{name}.png")

    # desert scenery for level 3 (the tumbleweed is all little gaps)
    for sheet, boxes in (("desert_decorations.webp", DESERT_DECOR), ("desert_props.webp", DESERT_PROPS)):
        src = np.array(Image.open(SRC / sheet).convert("RGB"))
        for name, (x0, y0, x1, y1) in boxes.items():
            hole = 30 if name == "tumbleweed" else 150
            save(trim(cut_white(src[y0:y1, x0:x1], hole_min=hole)), f"{name}.png")

    # snow scenery for level 4 (snow is nearly white, so cut in snow mode;
    # the gaps in the fence and under the gate are pure white and go)
    for sheet, boxes in (("snow_decorations.png", SNOW_DECOR), ("snow_props.png", SNOW_PROPS)):
        src = load(sheet)
        for name, (x0, y0, x1, y1) in boxes.items():
            # the snowballs' shiny spots are pure white too: keep enclosed white there
            hole = 50000 if name == "snowballs" else 400
            save(trim(cut_white(src[y0:y1, x0:x1], hole_min=hole, snow=True)), f"{name}.png")

    # snow spider enemy (level 4): snowball body, four icy legs, squished
    src = load("snow_spider.png")
    for name, (x0, y0, x1, y1, largest) in SNOW_SPIDER.items():
        part = cut_white(src[y0:y1, x0:x1], hole_min=400, snow=True)
        save(trim(keep_largest(part) if largest else part), f"{name}.png")

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

    # rattlesnake enemy parts (desert level)
    src = load("snake.png")
    for name, (x0, y0, x1, y1, largest) in SNAKE.items():
        part = cut_white(src[y0:y1, x0:x1], hole_min=9000)
        part = trim(keep_largest(part) if largest else part)
        save(part, f"{name}.png")

    # the rattle: its own upright drawing. Keep just the rattle (the drawn
    # motion lines are separate bits and get dropped - the game shakes it).
    save(trim(keep_largest(cut_white(load("snake_rattle.png"), hole_min=9000)), pad=1), "snake_rattle.png")

    # the truck blown up (bumping an enemy): wreck, broken wheels, parts, explosions
    src = load("truck_wreck.png")
    for name, (x0, y0, x1, y1, largest) in WRECK.items():
        part = cut_white(src[y0:y1, x0:x1], hole_min=9000)
        save(trim(keep_largest(part) if largest else part), f"{name}.png")

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
