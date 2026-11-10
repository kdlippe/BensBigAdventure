// The 5 levels. Everything is measured in game pixels; the screen is 1280x720.
//
// Each level's layout (where the ramps, box stacks and pits go, and the
// scenery) is random but the same every time you play that level (seeded by
// the level number). Stars, nitro canisters and crabs move every play.
//
// To tweak a level, edit its row in LEVELS below.

import { RAMP_ART } from './rampProfile.js';

const L1 = 13000; // level 1 is about 2/3 the length of the old single level
const GROW = 1.25; // each level after is 25% longer

export const LEVELS = [
  // stars: exactly this many. pits: holes you must jump; pitRamps: a ramp right before each pit.
  // theme: 'meadow' (sunny), 'spooky' (night graveyard) or 'desert' (canyon) look.
  { stars: 20, length: L1, ramps: 3, stacks: 3, pits: 0, pitRamps: false, crabs: 1, theme: 'meadow' },
  { stars: 30, length: L1 * GROW, ramps: 4, stacks: 4, pits: 0, pitRamps: false, crabs: 2, theme: 'meadow' },
  { stars: 40, length: L1 * GROW ** 2, ramps: 4, stacks: 5, pits: 1, pitRamps: true, crabs: 2, theme: 'spooky' },
  { stars: 50, length: L1 * GROW ** 3, ramps: 5, stacks: 6, pits: 2, pitRamps: true, crabs: 3, theme: 'spooky' },
  { stars: 60, length: L1 * GROW ** 4, ramps: 6, stacks: 7, pits: 3, pitRamps: false, crabs: 3, theme: 'desert' },
];

export const BOX = 80;
export const PIT_WIDTH = 360; // about the width of the truck (wheel to wheel is ~320)
export const PIT_BOTTOM = 2600; // pits are "bottomless": the wheels find nothing to stand on
export const NITRO_CANS = 3;

const BASE = 560; // ground height on flat parts (y grows downwards)
const STEP = 8; // ground is sampled every STEP px
const START_X = 300;
const CRAB_PATROL = 360; // how far each crab walks back and forth

// How high above the ground things float. The truck grabs anything within
// reach of its body: GROUND_REACH is collected just by driving past,
// JUMP_REACH needs a jump.
const GROUND_REACH = 110;
const JUMP_REACH = 290;

const STACK_SHAPES = [[2, 1], [3, 2, 1], [2, 2], [3, 3], [4, 3, 2, 1]];

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// 1 inside [a, b], easing to 0 over 200px on each side
const zone = (x, a, b) => smooth(a - 200, a, x) * (1 - smooth(b, b + 200, x));

// tiny deterministic random numbers, so a level's layout is the same every time
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

function makeRamp(x, h) {
  const scale = h / RAMP_ART.lipHeight;
  return { x, h, scale, lipX: x + RAMP_ART.lipX * scale, backX: x + RAMP_ART.backX * scale };
}

// ---- where the ramps, box stacks and pits go (same every play of a level) ----
function layout(def, length, finishX, rand) {
  const kinds = [
    ...Array(def.ramps).fill('ramp'),
    ...Array(def.stacks).fill('stack'),
    ...Array(def.pits).fill('pit'),
  ];
  // shuffle, but never start with a pit and never put two pits side by side
  for (let tries = 0; tries < 200; tries++) {
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    const ok = kinds[0] !== 'pit' && kinds.every((k, i) => !(k === 'pit' && kinds[i + 1] === 'pit'));
    if (ok) break;
  }

  const ramps = [];
  const stacks = [];
  const pits = [];
  const from = 1300;
  const to = finishX - 900;
  const slot = (to - from) / kinds.length;
  kinds.forEach((kind, i) => {
    const mid = from + slot * (i + 0.5) + (rand() - 0.5) * slot * 0.25;
    if (kind === 'ramp') {
      const r = makeRamp(mid - 200, 170 + Math.round(rand() * 70));
      ramps.push(r);
    } else if (kind === 'stack') {
      stacks.push({ x: mid - 160, rows: STACK_SHAPES[Math.floor(rand() * STACK_SHAPES.length)] });
    } else {
      const pit = { x0: mid - PIT_WIDTH / 2, x1: mid + PIT_WIDTH / 2, ramp: null };
      if (def.pitRamps) {
        // a ramp right before the pit sends you flying over it
        const h = 200;
        const backW = RAMP_ART.backX * (h / RAMP_ART.lipHeight);
        pit.ramp = makeRamp(pit.x0 - 40 - backW, h);
        ramps.push(pit.ramp);
      }
      pits.push(pit);
    }
  });
  return { ramps, stacks, pits };
}

export function buildLevel(levelNum = 1, rand = Math.random) {
  const def = LEVELS[levelNum - 1];
  const length = Math.round(def.length);
  const finishX = length - 450;
  const fixed = seeded(1000 + levelNum * 77);
  const { ramps, stacks, pits } = layout(def, length, finishX, fixed);

  const isPit = (x) => pits.some((p) => x > p.x0 && x < p.x1);

  // height of the ramp planks above the ground at x (0 when not on a ramp)
  const rampHeight = (x) => {
    const p = RAMP_ART.profile;
    for (const r of ramps) {
      if (x >= r.x && x <= r.lipX) {
        const f = ((x - r.x) / (r.lipX - r.x)) * (p.length - 1);
        const i = Math.min(Math.floor(f), p.length - 2);
        return r.h * (p[i] + (p[i + 1] - p[i]) * (f - i));
      }
      // steep steel back of the ramp
      if (x > r.lipX && x <= r.backX) return r.h * (1 - (x - r.lipX) / (r.backX - r.lipX));
    }
    return 0;
  };

  const hillHeight = (x) => {
    let env = smooth(500, 1100, x) * (1 - smooth(length - 1500, length - 1000, x));
    for (const r of ramps) env *= 1 - zone(x, r.x - 250, r.backX + 500);
    for (const s of stacks) env *= 1 - zone(x, s.x - 150, s.x + s.rows[0] * BOX + 150);
    for (const p of pits) env *= 1 - zone(x, p.x0 - 400, p.x1 + 400); // flat ground around pits
    return env * (55 * Math.sin(x / 380) + 22 * Math.sin(x / 150 + 1.3));
  };

  const terrain = []; // the dirt + grass (drawn)
  const surface = []; // what the wheels drive on (terrain + ramps)
  for (let x = 0; x <= length + STEP; x += STEP) {
    const t = BASE - hillHeight(x);
    terrain.push(t);
    surface.push(t - rampHeight(x));
  }
  const sample = (arr) => (x) => {
    const f = Math.min(Math.max(x, 0), length) / STEP;
    const i = Math.floor(f);
    const k = f - i;
    return arr[i] * (1 - k) + arr[i + 1] * k;
  };
  const surfaceY = sample(surface);
  const terrainY = sample(terrain);
  const groundY = (x) => (isPit(x) ? PIT_BOTTOM : surfaceY(x));

  // ranges things shouldn't be placed on
  const rampRanges = ramps.map((r) => [r.x - 40, r.backX + 40]);
  const stackRanges = stacks.map((s) => [s.x - 30, s.x + s.rows[0] * BOX + 30]);
  const pitRanges = pits.map((p) => [p.x0 - 250, p.x1 + 250]);

  // ---- boxes ----
  const boxes = [];
  for (const s of stacks) {
    const gy = groundY(s.x + (s.rows[0] * BOX) / 2);
    s.rows.forEach((count, row) => {
      const offset = ((s.rows[0] - count) * BOX) / 2;
      for (let i = 0; i < count; i++) {
        boxes.push({ x: s.x + offset + i * BOX + BOX / 2, y: gy - BOX / 2 - row * BOX });
      }
    });
  }

  // ---- stars: exactly def.stars of them, in new places every play ----
  const stars = [];
  {
    const target = def.stars;
    const add = (x, y) => stars.length < target && stars.push({ x, y });
    const used = spans([[0, START_X + 250], [finishX - 150, length], ...rampRanges, ...stackRanges, ...pitRanges]);

    // a little arc over every pit you jump yourself, showing where to jump
    for (const p of pits) {
      if (p.ramp) continue;
      const rim = terrainY(p.x0);
      [0.1, 0.5, 0.9].forEach((f) => add(p.x0 + f * PIT_WIDTH, rim - 170 - Math.sin(f * Math.PI) * 110));
    }
    // an arc following the jump off most ramps (always after a ramp that leaps a pit)
    for (const r of ramps) {
      const overPit = pits.some((p) => p.ramp === r);
      if (!overPit && rand() < 0.25) continue;
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
    for (const s of stacks) {
      if (rand() < 0.5) continue;
      const cx = s.x + (s.rows[0] * BOX) / 2;
      add(cx, groundY(cx) - s.rows.length * BOX - 90);
    }

    // fill the rest with little patterns, spread evenly so the count comes out right
    const pattern = (x, n, kind) => {
      for (let i = 0; i < n; i++) {
        const sx = x + i * 80;
        const g = groundY(sx);
        if (kind === 'row') add(sx, g - GROUND_REACH - rand() * 15);
        else if (kind === 'high') add(sx, g - JUMP_REACH + i * 10); // jump for these!
        else add(sx, g - GROUND_REACH - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 170); // a hop
      }
    };
    const fillPass = (spacingScale) => {
      let free = 0;
      for (let x = START_X + 300; x < finishX - 300; x += 40) if (used.free(x - 20, x + 20)) free += 40;
      const groups = Math.max(1, (target - stars.length) / 3.4);
      const spacing = Math.max(120, (free / groups) * spacingScale);
      let x = START_X + 300 + rand() * spacing * 0.5;
      while (x < finishX - 300 && stars.length < target) {
        const roll = rand();
        const kind = roll < 0.55 ? 'row' : roll < 0.8 ? 'high' : 'hop';
        const n = Math.min(target - stars.length, kind === 'high' ? 2 : kind === 'hop' ? 4 : 3 + Math.floor(rand() * 3));
        const end = x + (n - 1) * 80;
        if (used.free(x - 40, end + 40)) {
          pattern(x, n, kind);
          used.take(x - 40, end + 40);
          x = end + 80 + spacing * (0.5 + rand());
        } else {
          x += 60;
        }
      }
    };
    fillPass(0.75);
    if (stars.length < target) fillPass(0.3);
    // last resort: single stars anywhere that isn't a pit or ramp
    for (let tries = 0; stars.length < target && tries < 2000; tries++) {
      const x = START_X + 300 + rand() * (finishX - START_X - 600);
      if (isPit(x) || !used.free(x - 30, x + 30)) continue;
      add(x, groundY(x) - GROUND_REACH);
      used.take(x - 30, x + 30);
    }
  }

  // ---- nitro canisters: always NITRO_CANS, one in each equal part of the track ----
  const nitro = [];
  {
    const used = spans([[0, START_X + 400], [finishX - 300, length], ...rampRanges, ...stackRanges, ...pitRanges]);
    const from = START_X + 400;
    const part = (finishX - 300 - from) / NITRO_CANS;
    for (let i = 0; i < NITRO_CANS; i++) {
      const a = from + i * part + 80;
      const b = from + (i + 1) * part - 80;
      const tries = [...Array(30)].map(() => a + rand() * (b - a));
      for (let x = a; x <= b; x += 40) tries.push(x);
      const x = tries.find((t) => used.free(t - 80, t + 80)) ?? (a + b) / 2;
      const high = rand() < 0.35; // sometimes you have to jump for it
      nitro.push({ x, y: groundY(x) - (high ? JUMP_REACH - 10 : GROUND_REACH + 10) });
      used.take(x - 80, x + 80);
    }
  }

  // ---- crabs: def.crabs at most, one in each equal part, walking back and forth ----
  const crabs = [];
  {
    const used = spans([
      [0, START_X + 900], // give Ben a moment before the first crab
      [finishX - 400, length],
      ...rampRanges.map(([a, b]) => [a - 150, b + 350]), // not on ramps or where you land
      ...stackRanges,
      ...pitRanges.map(([a, b]) => [a - 150, b + 150]),
      ...nitro.map((n) => [n.x - 120, n.x + 120]),
    ]);
    const from = START_X + 900;
    const part = (finishX - 400 - from) / def.crabs;
    for (let i = 0; i < def.crabs; i++) {
      const a = from + i * part;
      const b = from + (i + 1) * part - CRAB_PATROL;
      const tries = [...Array(30)].map(() => a + rand() * (b - a));
      for (let x = a; x <= b; x += 50) tries.push(x);
      const start = tries.find((t) => used.free(t - 100, t + CRAB_PATROL + 100));
      if (start === undefined) continue; // no room in this part: one crab fewer
      crabs.push({ x: start + rand() * CRAB_PATROL, minX: start, maxX: start + CRAB_PATROL });
      used.take(start - 100, start + CRAB_PATROL + 100);
    }
  }

  // ---- scenery (same every play of this level) ----
  const decor = [];
  {
    const scenery = seeded(7 + levelNum);
    const busy = spans([[-1, 160], [finishX - 200, finishX + 200], ...rampRanges, ...stackRanges, ...pitRanges]);
    const noPit = spans(pits.map((p) => [p.x0 - 140, p.x1 + 140]));
    const put = (key, x, scale, depth, sink = 6) =>
      decor.push({ key, x, y: terrainY(x) + sink, scale, depth, flip: scenery() < 0.5 });

    // behind the track: trees, bushes and fences (not hanging over a pit)
    for (let x = 250; x < length; x += 700 + scenery() * 600) {
      if (noPit.free(x - 120, x + 120)) put('tree', x, 0.75 + scenery() * 0.25, 8, 30);
    }
    for (let x = 500; x < length; x += 450 + scenery() * 500) {
      if (noPit.free(x - 80, x + 80)) put('bush', x, 0.3 + scenery() * 0.1, 8, 22);
    }
    for (const x of [120, 330, finishX + 260, finishX + 470]) put('fence', x, 0.42, 8, 22);
    // tyre stacks guarding each ramp, like a real monster truck arena
    for (const r of ramps) put('tires', r.x - 110, 0.36, 9, 10);
    // little things on the grass
    const small = [['tuft', 0.2], ['tuft', 0.16], ['flower', 0.22], ['mushroom', 0.2], ['rocks', 0.2]];
    for (let x = 200; x < length - 100; x += 150 + scenery() * 220) {
      if (!busy.free(x - 40, x + 40)) continue;
      const [key, s] = small[Math.floor(scenery() * small.length)];
      put(key, x, s * (0.85 + scenery() * 0.3), 12, 8);
    }
  }

  return {
    num: levelNum,
    theme: def.theme,
    count: LEVELS.length,
    length,
    finishX,
    startX: START_X,
    groundY, // what the wheels stand on (PIT_BOTTOM over a pit)
    surfaceY, // ground level ignoring pits
    terrainY, // drawn ground (no ramps, no pits)
    isPit,
    pits,
    boxes,
    stars,
    nitro,
    crabs,
    decor,
    ramps: ramps.map((r) => ({ x: r.x, lipX: r.lipX, scale: r.scale, height: r.h })),
  };
}
