// Level 1 layout. Everything is measured in game pixels; the screen is 1280x720.
// To change the level, edit RAMP_DEFS / BOX_STACKS below. Stars and nitro
// canisters are placed at random every time a level starts (see placeStars /
// placeNitro); the scenery is random too but always the same (fixed seed).

import { RAMP_ART } from './rampProfile.js';

// SPREAD stretches the whole level: track length, ramp and box positions and
// the gaps between stars all grow by it, while the number of ramps, box
// stacks, stars and canisters stays the same. (1.3 = 30% longer than the
// original 15000 px level.)
const SPREAD = 1.3;
// gaps between star groups: wider than SPREAD alone, so the longer track ends up
// with about the same number of stars as the original (~56 per game)
const STAR_GAP = 2.5;
export const LENGTH = Math.round(15000 * SPREAD);
const BASE = 560; // ground height on flat parts (y grows downwards)
const STEP = 8; // ground is sampled every STEP px

// Wooden ramps: `x` is where the ramp starts, `h` is how tall its lip is.
// Width comes from the ramp art, so taller ramps are also longer.
const RAMP_DEFS = [
  { x: 2050 * SPREAD, h: 170 },
  { x: 4000 * SPREAD, h: 200 },
  { x: 6000 * SPREAD, h: 180 },
  { x: 7950 * SPREAD, h: 230 },
  { x: 10200 * SPREAD, h: 190 },
  { x: 12400 * SPREAD, h: 240 },
];

// Each stack is a list of rows, bottom row first: [3, 2, 1] is a little pyramid.
const BOX_STACKS = [
  { x: 1350 * SPREAD, rows: [2, 1] },
  { x: 3050 * SPREAD, rows: [3, 2, 1] },
  { x: 4950 * SPREAD, rows: [2, 2] },
  { x: 6950 * SPREAD, rows: [3, 2, 1] },
  { x: 9050 * SPREAD, rows: [3, 3] },
  { x: 11300 * SPREAD, rows: [3, 2, 1] },
  { x: 13600 * SPREAD, rows: [4, 3, 2, 1] },
];

export const FINISH_X = LENGTH - 450;
export const BOX = 80;
const START_X = 300;

// How high above the ground things float. The truck grabs anything within
// reach of its body: GROUND_REACH is collected just by driving past,
// JUMP_REACH needs a jump.
const GROUND_REACH = 110;
const JUMP_REACH = 290;

const RAMPS = RAMP_DEFS.map((r) => {
  const scale = r.h / RAMP_ART.lipHeight;
  return {
    x: r.x,
    h: r.h,
    scale,
    lipX: r.x + RAMP_ART.lipX * scale,
    backX: r.x + RAMP_ART.backX * scale,
  };
});

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// 1 inside [a, b], easing to 0 over 200px on each side
const zone = (x, a, b) => smooth(a - 200, a, x) * (1 - smooth(b, b + 200, x));

// height of the ramp planks above the ground at x (0 when not on a ramp)
function rampHeight(x) {
  const p = RAMP_ART.profile;
  for (const r of RAMPS) {
    if (x >= r.x && x <= r.lipX) {
      const f = ((x - r.x) / (r.lipX - r.x)) * (p.length - 1);
      const i = Math.min(Math.floor(f), p.length - 2);
      return r.h * (p[i] + (p[i + 1] - p[i]) * (f - i));
    }
    // steep steel back of the ramp
    if (x > r.lipX && x <= r.backX) return r.h * (1 - (x - r.lipX) / (r.backX - r.lipX));
  }
  return 0;
}

function hillHeight(x) {
  let env = smooth(500, 1100, x) * (1 - smooth(LENGTH - 1500, LENGTH - 1000, x));
  for (const r of RAMPS) env *= 1 - zone(x, r.x - 250, r.backX + 500);
  for (const s of BOX_STACKS) env *= 1 - zone(x, s.x - 150, s.x + s.rows[0] * BOX + 150);
  return env * (55 * Math.sin(x / 380) + 22 * Math.sin(x / 150 + 1.3));
}

// tiny deterministic random numbers so the scenery is the same every game
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// a set of x ranges that are already used, so things don't pile up
function spans(initial) {
  const list = initial.map(([a, b]) => [a, b]);
  return {
    free: (a, b) => list.every(([c, d]) => b < c || a > d),
    take: (a, b) => list.push([a, b]),
  };
}

const stackRanges = () => BOX_STACKS.map((s) => [s.x - 30, s.x + s.rows[0] * BOX + 30]);
const rampRanges = () => RAMPS.map((r) => [r.x - 40, r.backX + 40]);

// ---- stars: new places every game ----
function placeStars(groundY, terrainY, rand) {
  const stars = [];
  const add = (x, y) => stars.push({ x, y });
  const between = (a, b) => a + rand() * (b - a);
  const used = spans([[0, START_X + 250], [FINISH_X - 150, LENGTH], ...rampRanges(), ...stackRanges()]);

  // an arc that follows the jump off most ramps
  for (const r of RAMPS) {
    if (rand() < 0.25) continue;
    const lipY = terrainY(r.lipX) - r.h;
    const n = 3 + Math.floor(rand() * 3);
    const gap = 85 + rand() * 25;
    for (let i = 1; i <= n; i++) {
      const t = (i * gap) / 420;
      add(r.lipX + 30 + i * gap, lipY - 150 - 880 * t + 0.5 * 1500 * t * t);
    }
    used.take(r.backX, r.lipX + 60 + (n + 1) * gap);
  }

  // some box stacks get a star floating on top
  for (const s of BOX_STACKS) {
    if (rand() < 0.4) continue;
    const cx = s.x + (s.rows[0] * BOX) / 2;
    add(cx, groundY(cx) - s.rows.length * BOX - 90);
  }

  // fill the rest of the track with little patterns
  let x = START_X + 300;
  while (x < FINISH_X - 300) {
    const kind = rand();
    const n = kind < 0.5 ? 3 + Math.floor(rand() * 3) : kind < 0.75 ? 2 : 4;
    const gap = 80;
    const end = x + (n - 1) * gap;
    if (used.free(x - 40, end + 40)) {
      for (let i = 0; i < n; i++) {
        const sx = x + i * gap;
        const g = groundY(sx);
        if (kind < 0.5) add(sx, g - GROUND_REACH - rand() * 15); // a row on the ground
        else if (kind < 0.75) add(sx, g - JUMP_REACH + i * 10); // a high pair: jump!
        else add(sx, g - GROUND_REACH - Math.sin((i / (n - 1)) * Math.PI) * 170); // a hop
      }
      used.take(x - 40, end + 40);
      x = end + between(300, 750) * STAR_GAP;
    } else {
      x += 120;
    }
  }
  return stars;
}

// ---- nitro canisters: always NITRO_CANS of them, one in each equal part of
// the track, at a random spot in that part ----
export const NITRO_CANS = 3;

function placeNitro(groundY, rand) {
  const cans = [];
  const used = spans([[0, START_X + 400], [FINISH_X - 300, LENGTH], ...rampRanges(), ...stackRanges()]);
  const from = START_X + 400;
  const to = FINISH_X - 300;
  const part = (to - from) / NITRO_CANS;
  for (let i = 0; i < NITRO_CANS; i++) {
    const a = from + i * part + 80;
    const b = from + (i + 1) * part - 80;
    // try random spots first, then sweep the part so we always find one
    const tries = [...Array(30)].map(() => a + rand() * (b - a));
    for (let x = a; x <= b; x += 40) tries.push(x);
    const x = tries.find((t) => used.free(t - 80, t + 80)) ?? (a + b) / 2;
    const high = rand() < 0.35; // sometimes you have to jump for it
    cans.push({ x, y: groundY(x) - (high ? JUMP_REACH - 10 : GROUND_REACH + 10) });
    used.take(x - 80, x + 80);
  }
  return cans;
}

export function buildLevel(rand = Math.random) {
  const terrain = []; // the dirt + grass (drawn)
  const surface = []; // what the wheels drive on (terrain + ramps)
  for (let x = 0; x <= LENGTH + STEP; x += STEP) {
    const t = BASE - hillHeight(x);
    terrain.push(t);
    surface.push(t - rampHeight(x));
  }

  const sample = (arr) => (x) => {
    const f = Math.min(Math.max(x, 0), LENGTH) / STEP;
    const i = Math.floor(f);
    const k = f - i;
    return arr[i] * (1 - k) + arr[i + 1] * k;
  };
  const groundY = sample(surface);
  const terrainY = sample(terrain);

  const points = [];
  for (let i = 0; i < terrain.length; i += 2) points.push({ x: i * STEP, y: terrain[i] });

  // ---- boxes ----
  const boxes = [];
  for (const s of BOX_STACKS) {
    const gy = groundY(s.x + (s.rows[0] * BOX) / 2);
    s.rows.forEach((count, row) => {
      const offset = ((s.rows[0] - count) * BOX) / 2;
      for (let i = 0; i < count; i++) {
        boxes.push({ x: s.x + offset + i * BOX + BOX / 2, y: gy - BOX / 2 - row * BOX });
      }
    });
  }

  // ---- scenery (same every game) ----
  const scenery = seeded(7);
  const busy = spans([[-1, 160], [FINISH_X - 200, FINISH_X + 200], ...rampRanges(), ...stackRanges()]);
  const decor = [];
  const put = (key, x, scale, depth, sink = 6) =>
    decor.push({ key, x, y: terrainY(x) + sink, scale, depth, flip: scenery() < 0.5 });

  // behind the track: trees, bushes and fences
  for (let x = 250; x < LENGTH; x += 700 + scenery() * 600) put('tree', x, 0.75 + scenery() * 0.25, 8, 30);
  for (let x = 500; x < LENGTH; x += 450 + scenery() * 500) put('bush', x, 0.3 + scenery() * 0.1, 8, 22);
  for (const x of [120, 330, FINISH_X + 260, FINISH_X + 470]) put('fence', x, 0.42, 8, 22);

  // tyre stacks guarding each ramp, like a real monster truck arena
  for (const r of RAMPS) put('tires', r.x - 110, 0.36, 9, 10);

  // little things on the grass
  const small = [
    ['tuft', 0.2],
    ['tuft', 0.16],
    ['flower', 0.22],
    ['mushroom', 0.2],
    ['rocks', 0.2],
  ];
  for (let x = 200; x < LENGTH - 100; x += 150 + scenery() * 220) {
    if (!busy.free(x - 40, x + 40)) continue;
    const [key, s] = small[Math.floor(scenery() * small.length)];
    put(key, x, s * (0.85 + scenery() * 0.3), 12, 8);
  }

  return {
    length: LENGTH,
    finishX: FINISH_X,
    startX: START_X,
    groundY,
    terrainY,
    points,
    boxes,
    stars: placeStars(groundY, terrainY, rand),
    nitro: placeNitro(groundY, rand),
    decor,
    ramps: RAMPS.map((r) => ({ x: r.x, lipX: r.lipX, scale: r.scale, height: r.h })),
  };
}
