// Level 1 layout. Everything is measured in game pixels; the screen is 1280x720.
// To change the level, edit RAMPS / BOX_STACKS / the star helpers below.

import { RAMP_ART } from './rampProfile.js';

export const LENGTH = 9800;
const BASE = 560; // ground height on flat parts (y grows downwards)
const STEP = 8; // ground is sampled every STEP px

// Wooden ramps: `x` is where the ramp starts, `h` is how tall its lip is.
// Width comes from the ramp art, so taller ramps are also longer.
const RAMP_DEFS = [
  { x: 2050, h: 170 },
  { x: 4000, h: 200 },
  { x: 6000, h: 180 },
  { x: 7950, h: 230 },
];

// Each stack is a list of rows, bottom row first: [3, 2, 1] is a little pyramid.
const BOX_STACKS = [
  { x: 1350, rows: [2, 1] },
  { x: 3050, rows: [3, 2, 1] },
  { x: 4950, rows: [2, 2] },
  { x: 6950, rows: [3, 2, 1] },
  { x: 8700, rows: [4, 3, 2, 1] },
];

export const FINISH_X = LENGTH - 450;
export const BOX = 80;

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
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildLevel() {
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

  // ---- stars ----
  const stars = [];
  const addStar = (x, y) => stars.push({ x, y });

  // a welcome row right at the start
  for (let i = 0; i < 5; i++) addStar(650 + i * 80, groundY(650 + i * 80) - 110);

  // an arc of stars that follows the jump off each ramp
  for (const r of RAMPS) {
    const lipY = terrainY(r.lipX) - r.h;
    for (let i = 1; i <= 5; i++) {
      const t = (i * 95) / 420;
      addStar(r.lipX + 30 + i * 95, lipY - 150 - 880 * t + 0.5 * 1500 * t * t);
    }
  }

  // a star floating over each box stack (jump or crash through to get it)
  for (const s of BOX_STACKS) {
    const cx = s.x + (s.rows[0] * BOX) / 2;
    addStar(cx, groundY(cx) - s.rows.length * BOX - 90);
  }

  // stars sitting on the bumpy hills
  for (const x of [2620, 2740, 2860, 3700, 5450, 5570, 5690, 6650, 7450, 7570]) {
    addStar(x, groundY(x) - 100);
  }

  // a final row before the finish flag
  for (let i = 0; i < 4; i++) addStar(FINISH_X - 420 + i * 90, groundY(FINISH_X - 420 + i * 90) - 110);

  // ---- scenery ----
  const busy = [
    [-1, 160],
    [FINISH_X - 200, FINISH_X + 200],
    ...RAMPS.map((r) => [r.x - 40, r.backX + 40]),
    ...BOX_STACKS.map((s) => [s.x - 30, s.x + s.rows[0] * BOX + 30]),
  ];
  const free = (x, pad = 0) => busy.every(([a, b]) => x + pad < a || x - pad > b);
  const rand = rng(7);
  const decor = [];
  const put = (key, x, scale, depth, sink = 6) =>
    decor.push({ key, x, y: terrainY(x) + sink, scale, depth, flip: rand() < 0.5 });

  // behind the track: trees, bushes and fences
  for (let x = 250; x < LENGTH; x += 700 + rand() * 600) put('tree', x, 0.75 + rand() * 0.25, 8, 30);
  for (let x = 500; x < LENGTH; x += 450 + rand() * 500) put('bush', x, 0.3 + rand() * 0.1, 8, 22);
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
  for (let x = 200; x < LENGTH - 100; x += 150 + rand() * 220) {
    if (!free(x, 40)) continue;
    const [key, s] = small[Math.floor(rand() * small.length)];
    put(key, x, s * (0.85 + rand() * 0.3), 12, 8);
  }

  return {
    length: LENGTH,
    finishX: FINISH_X,
    groundY,
    terrainY,
    points,
    boxes,
    stars,
    decor,
    ramps: RAMPS.map((r) => ({ x: r.x, lipX: r.lipX, scale: r.scale, height: r.h })),
  };
}
