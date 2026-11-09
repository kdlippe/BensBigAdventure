# BensBigAdventure

**Ben's Monster Truck Rally**: a side-scrolling monster truck game for a 6-year-old, built with [Phaser 3](https://phaser.io/).
Drive over bumpy hills, launch off ramps, smash cardboard boxes, and collect gold stars on the way to the finish flag.
No game over, no timer: you can't fail, only have fun.

## Play it

The game needs to be served over http (browsers block loading the images from a plain file).
From this folder run:

```bash
python -m http.server 8080
```

Then open <http://localhost:8080> in a browser (works on a laptop or a tablet on the same Wi-Fi via your computer's IP address).

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Drive | big green ▶ button (hold) | → or D |
| Back up | small grey ◀ button (hold) | ← or A |
| Jump | blue JUMP button | Space, ↑ or W |

## Project layout

```
index.html              page that loads Phaser (from a CDN) and the game
src/main.js             game setup
src/scenes/BootScene.js loads the truck art, draws stars/boxes/buttons
src/scenes/TitleScene.js title screen with the GO! button
src/scenes/GameScene.js the level: driving, jumping, boxes, stars, finish
src/level.js            level 1 layout: ramps, box stacks, stars, scenery
src/scenery.js          backdrop, tiled dirt and the bendy grass strip
src/rampProfile.js      the wooden ramp's curve (generated from the art)
src/truck.js            the truck drawing (body, wheels, struts)
src/sound.js            sound effects, generated in code (no audio files)
assets/sprites/         the truck parts as transparent PNGs
assets/env/             ground, ramp, scenery and backdrop art
art/source/             the original art the game files were cut from
tools/slice_sprites.py  cuts the truck parts out of the truck art sheet
tools/slice_env.py      cuts/cleans the ground, ramp and scenery art
```

## Tweaking

- **Level layout**: edit `RAMP_DEFS`, `BOX_STACKS`, the star helpers and the scenery section in `src/level.js`.
- **How the truck feels**: the constants at the top of `src/scenes/GameScene.js`
  (`MAX_SPEED`, `JUMP_SPEED`, `GRAVITY`, `RAMP_BOOST`, suspension `SPRING`/`DAMPING`).
- **New art**: replace the PNGs in `assets/sprites/` with the same file names. If you get a new
  art sheet, re-run `python tools/slice_sprites.py`; for new ground/scenery art, replace the files in
  `art/source/` and re-run `python tools/slice_env.py` (both need `pip install pillow numpy scipy`).
