// Drawing the world: the painted backdrop, the dirt and the bendy grass strip.
// Shared by the title screen and the level.

const GRASS_W = 770; // assets/env/grass_strip.png size
const GRASS_H = 112;
const GRASS_CONTACT = 0.289; // fraction down the strip where the grass body starts
const DIRT_TOP = 55; // dirt starts this far below the ground line (the strip covers the gap)
const BOTTOM = 1400; // how far down the dirt goes
const BG_H = 434; // background.png height

export const SKY = '#c3e9f1';

// Backdrop pinned to the screen; call the returned function every frame to scroll it.
export function addBackdrop(scene) {
  const { width, height } = scene.scale;
  const bg = scene.add.tileSprite(0, 0, width, height, 'background').setOrigin(0).setScrollFactor(0).setDepth(0);
  const s = height / BG_H;
  bg.setTileScale(s, s);
  return (scrollX) => {
    bg.tilePositionX = (scrollX * 0.25) / s;
  };
}

// Ground along `groundAt(x)` from x0 to x1: tiled dirt underneath, grass on top.
export function addGround(scene, groundAt, x0, x1) {
  // dirt: tile sprites masked to the shape under the ground line
  const shape = scene.make.graphics({ x: 0, y: 0 }, false);
  const pts = [];
  for (let x = x0; x <= x1; x += 16) pts.push({ x, y: groundAt(x) + DIRT_TOP });
  pts.push({ x: x1, y: BOTTOM }, { x: x0, y: BOTTOM });
  shape.fillStyle(0xffffff).fillPoints(pts, true);
  const mask = shape.createGeometryMask();

  let top = Infinity;
  for (let x = x0; x <= x1; x += 16) top = Math.min(top, groundAt(x) + DIRT_TOP);
  const CHUNK = 2048;
  for (let x = x0; x < x1; x += CHUNK) {
    const w = Math.min(CHUNK, x1 - x);
    scene.add.tileSprite(x, top, w, BOTTOM - top, 'dirt')
      .setOrigin(0)
      .setTilePosition(x, top) // keep the pattern continuous across chunks
      .setDepth(10)
      .setMask(mask);
  }

  // grass: one bendy rope per strip length, following the hills
  const shift = (0.5 - GRASS_CONTACT) * GRASS_H; // rope runs through the strip's middle
  const N = 32;
  for (let sx = x0; sx < x1; sx += GRASS_W) {
    const w = Math.min(GRASS_W, x1 - sx); // the last strip stops exactly at x1 (e.g. a pit edge)
    const points = [];
    for (let i = 0; i <= N; i++) {
      const dx = (i / N) * w;
      points.push({ x: dx, y: groundAt(sx + dx) + shift });
    }
    scene.add.rope(sx, 0, 'grass_strip', null, points, true).setDepth(11);
  }
}

// A pit: a dark hole in the ground between x0 and x1, with dirt walls.
export function addPit(scene, x0, x1, rimY) {
  const g = scene.add.graphics().setDepth(10);
  const top = rimY + 30;
  g.fillStyle(0x1b1009).fillRect(x0, top, x1 - x0, BOTTOM - top);
  // walls a bit lighter, fading into the dark
  g.fillStyle(0x5a3a20).fillRect(x0, top, 18, BOTTOM - top).fillRect(x1 - 18, top, 18, BOTTOM - top);
  g.fillStyle(0x3a2414).fillRect(x0 + 18, top, 14, BOTTOM - top).fillRect(x1 - 32, top, 14, BOTTOM - top);
  // a shadowy lip under the grass
  g.fillStyle(0x2b1a0e).fillRect(x0, top, x1 - x0, 26);
  g.lineStyle(6, 0x16161a).lineBetween(x0, rimY + 10, x0, BOTTOM).lineBetween(x1, rimY + 10, x1, BOTTOM);
}
