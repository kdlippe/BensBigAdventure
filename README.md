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

- **5 levels**, each longer than the last, with 20, 30, 40, 50 and 60 stars. The level you're on shows
  under the progress bar. Finishing a level unlocks the next (**NEXT LEVEL**); the title screen offers
  **NEW GAME** or carries on from the level you reached, and the 🏠 button goes back to the title.
- **Three looks**: levels 1–2 are a sunny meadow; levels 3–4 are a spooky graveyard at night (moon,
  tombstones, pumpkins, a pumpkin arch at the finish); level 5 is a desert canyon at sunset (cactuses,
  a T-rex skull, fossils in the dirt, a canyon arch at the finish). Set per level with `theme` in `src/level.js`.
- **Pits** (as wide as the truck): level 3 has 1 and level 4 has 2, each with a ramp right before it to
  fly over; level 5 has 3 with no ramps, so you jump yourself (a little arc of stars shows where).
  Fall in and you start the level again.
- **Nitro**: you start with 1 charge and can carry up to 3 (the number on the ⚡ button). Each boost drives you
  forward at nearly double speed for 3 seconds. There are always 3 red nitro canisters on the track (one in each third), each giving a charge;
  some float high, so you have to jump for them.
- **Braking**: pressing back while boosting ends the boost and skids the truck smoothly to a stop
  (keep holding it to reverse).
- **Crabs** (up to 3 per level) scuttle back and forth. Jump and land on one to squish it (and bounce
  high); drive into one and it pinches you back (and ends a nitro boost).
- **Stars, canisters and crabs** are in new places every time you start, so each run is a little different.
- **Timer** starts when you first drive and stops at the finish. Every star you miss adds 5 seconds
  to your total time (`MISSED_STAR_PENALTY` in `src/scenes/GameScene.js`). Each level's best time is remembered in that
  browser (each tablet or laptop keeps its own).

## Project layout

```
index.html              page that loads Phaser (from a CDN) and the game
src/main.js             game setup
src/scenes/BootScene.js loads the truck art, draws stars/boxes/buttons
src/scenes/TitleScene.js title screen: GO! / NEW GAME / keep going
src/scenes/GameScene.js the level: driving, jumping, boxes, stars, finish
src/level.js            the 5 levels: ramps, box stacks, pits, stars, canisters, crabs, scenery
src/progress.js         level reached and best time per level (saved in the browser)
src/scenery.js          backdrop, tiled dirt and the bendy grass strip, per theme (meadow / spooky / desert)
src/groundArt.js        grass strip sizes per theme (generated from the art)
src/rampProfile.js      the wooden ramp's curve (generated from the art)
src/flameArt.js         where the nitro flame leaves the pipe (generated from the art)
src/truck.js            the truck drawing (body, wheels, struts)
src/crab.js             the crab enemy: walking animation and squish
src/sound.js            sound effects, generated in code (no audio files)
assets/sprites/         the truck parts as transparent PNGs
assets/env/             ground, ramp, scenery and backdrop art
art/source/             the original art the game files were cut from
tools/slice_sprites.py  cuts the truck parts out of the truck art sheet
tools/slice_env.py      cuts/cleans the ground, ramp, scenery (all themes), flame, crab and button art
tools/serve.py          local web server with browser caching turned off
```

## Tweaking

- **Levels**: the `LEVELS` table at the top of `src/level.js` sets each level's stars (exact count),
  length, number of ramps, box stacks, pits (and whether they have ramps) and crabs. Each level's
  layout is random but the same every time you play it; stars, canisters and crabs move every play.
- **How the truck feels**: the constants at the top of `src/scenes/GameScene.js`
  (`MAX_SPEED`, `JUMP_SPEED`, `GRAVITY`, `RAMP_BOOST`, suspension `SPRING`/`DAMPING`, and the `NITRO_*` settings).
- **New art**: replace the PNGs in `assets/sprites/` with the same file names. If you get a new
  art sheet, re-run `python tools/slice_sprites.py`; for new ground/scenery art, replace the files in
  `art/source/` and re-run `python tools/slice_env.py` (both need `pip install pillow numpy scipy`).
