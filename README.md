# BensBigAdventure

**Ben's Monster Truck Rally**: a side-scrolling monster truck game for a 6-year-old, built with [Phaser 3](https://phaser.io/).
Drive over bumpy hills, launch off ramps, smash cardboard boxes, grab nitro canisters for speed boosts, and collect gold
stars on the way to the finish gate. No game over: you can't fail, only have fun. A timer lets you chase your best time.

## Play it

The game needs to be served over http (browsers block loading the images from a plain file).
From this folder run:

```bash
python tools/serve.py
```

This is a tiny web server that tells browsers to always check for updated game files. (Plain
`python -m http.server` lets browsers keep old copies of some files, which can mix old and new code
after an update and freeze the game.)

Then open <http://localhost:8080> in a browser (works on a laptop or a tablet on the same Wi-Fi via your computer's IP address).

## Playing on a tablet

- Open `http://<your-PC's-IP>:8080` in the tablet's browser (both on the same Wi-Fi, and the PC's network set to
  Private so Windows Firewall lets it through).
- On Android / Amazon Fire tablets, tapping **GO!** switches to full screen and locks the screen sideways.
  Use the browser menu's "Add to Home screen" to get an app icon that opens straight into the game.
- iPad Safari can't lock the screen: use the rotation lock in Control Center. If the tablet is held upright,
  the game shows a "Turn me sideways!" screen.

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Drive | big green ▶ button (hold) | → or D |
| Back up | small grey ◀ button (hold) | ← or A |
| Jump | blue JUMP button | Space, ↑ or W |
| Nitro boost (3 s, uses 1 charge) | orange ⚡ button | Shift or N |

## How it plays

- **Nitro**: you start with 1 charge and can carry up to 3 (the number on the ⚡ button). Each boost drives you
  forward at nearly double speed for 3 seconds. Red nitro canisters along the track give you more charges;
  some float high, so you have to jump for them.
- **Braking**: pressing back while boosting ends the boost and skids the truck smoothly to a stop
  (keep holding it to reverse).
- **Stars and canisters** are in new places every time you start, so each run is a little different.
- **Timer** starts when you first drive and stops at the finish. The best time is remembered in that browser
  (each tablet or laptop keeps its own).

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
tools/serve.py          local web server with browser caching turned off
```

## Tweaking

- **Level layout**: edit `LENGTH`, `RAMP_DEFS`, `BOX_STACKS`, `placeStars`, `placeNitro` and the scenery section in `src/level.js`.
- **How the truck feels**: the constants at the top of `src/scenes/GameScene.js`
  (`MAX_SPEED`, `JUMP_SPEED`, `GRAVITY`, `RAMP_BOOST`, suspension `SPRING`/`DAMPING`, and the `NITRO_*` settings).
- **New art**: replace the PNGs in `assets/sprites/` with the same file names. If you get a new
  art sheet, re-run `python tools/slice_sprites.py`; for new ground/scenery art, replace the files in
  `art/source/` and re-run `python tools/slice_env.py` (both need `pip install pillow numpy scipy`).
