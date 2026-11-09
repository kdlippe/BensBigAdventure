// Level 1 layout. Everything is measured in game pixels; the screen is 1280x720.
// To change the level, edit RAMPS / BOX_STACKS / the star helpers below.

export const LENGTH = 9800;
const BASE = 560; // ground height on flat parts (y grows downwards)
const STEP = 16; // ground is sampled every STEP px

// A ramp rises over `w` px by `h` px, then drops back down behind the lip.
const RAMPS = [
  { x: 2050, w: 260, h: 110 },
  { x: 4000, w: 300, h: 140 },
  { x: 6000, w: 260, h: 120 },
  { x: 7950, w: 340, h: 170 },
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

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// 1 inside [a, b], easing to 0 over 200px on each side
const zone = (x, a, b) => smooth(a - 200, a, x) * (1 - smooth(b, b + 200, x));

function rampHeight(x) {
  for (const r of RAMPS) {
    if (x >= r.x && x <= r.x + r.w) return r.h * ((x - r.x) / r.w);
    const back = r.x + r.w;
    if (x > back && x <= back + 70) return r.h * (1 - (x - back) / 70);
  }
  return 0;
}

function hillHeight(x) {
  let env = smooth(500, 1100, x) * (1 - smooth(LENGTH - 1500, LENGTH - 1000, x));
  for (const r of RAMPS) env *= 1 - zone(x, r.x - 250, r.x + r.w + 500);
  for (const s of BOX_STACKS) env *= 1 - zone(x, s.x - 150, s.x + s.rows[0] * BOX + 150);
  return env * (55 * Math.sin(x / 380) + 22 * Math.sin(x / 150 + 1.3));
}

export function buildLevel() {
  const heights = [];
  for (let x = 0; x <= LENGTH + STEP; x += STEP) {
    heights.push(BASE - hillHeight(x) - rampHeight(x));
  }

  const groundY = (x) => {
    const f = Math.min(Math.max(x, 0), LENGTH) / STEP;
    const i = Math.floor(f);
    const t = f - i;
    return heights[i] * (1 - t) + heights[i + 1] * t;
  };

  const points = heights.map((y, i) => ({ x: i * STEP, y }));

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
  const lips = RAMPS.map((r) => ({ x: r.x + r.w, y: groundY(r.x + r.w) }));
  for (const lip of lips) {
    for (let i = 1; i <= 5; i++) {
      const t = (i * 95) / 420;
      addStar(lip.x + i * 95, lip.y - 110 - 880 * t + 0.5 * 1500 * t * t);
    }
  }

  // a star floating over each box stack (jump or crash through to get it)
  for (const s of BOX_STACKS) {
    const cx = s.x + (s.rows[0] * BOX) / 2;
    addStar(cx, groundY(cx) - s.rows.length * BOX - 90);
  }

  // stars sitting on the bumpy hills
  for (const x of [2500, 2620, 2740, 3700, 5450, 5570, 5690, 6650, 7450, 7570]) {
    addStar(x, groundY(x) - 100);
  }

  // a final row before the finish flag
  for (let i = 0; i < 4; i++) addStar(FINISH_X - 420 + i * 90, groundY(FINISH_X - 420 + i * 90) - 110);

  return {
    length: LENGTH,
    finishX: FINISH_X,
    groundY,
    points,
    boxes,
    stars,
    ramps: RAMPS.map((r) => ({ lipX: r.x + r.w, height: r.h })),
  };
}
