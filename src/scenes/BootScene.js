// Loads the truck art and draws the simple shapes (stars, boxes, buttons...) into textures.
import { Truck } from '../truck.js';

const SPRITES = ['truck_body', 'wheel', 'strut', 'puff', 'puff2', 'pebble', 'dust', 'sparkle'];
const ENV_PNG = [
  'grass_strip', 'ramp', 'tuft', 'mushroom', 'rocks', 'flower', 'bush', 'flame_jet',
  'fence', 'tree', 'tires', 'finish_gate',
];
const OUTLINE = 0x16161a;

function starPoints(cx, cy, outer, inner, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

// lightning bolt centred on (cx, cy), `size` px tall
function boltPoints(cx, cy, size) {
  const shape = [
    [0.58, 0], [0.12, 0.56], [0.44, 0.56], [0.34, 1], [0.88, 0.42], [0.56, 0.42], [0.74, 0],
  ];
  return shape.map(([x, y]) => ({ x: cx + (x - 0.5) * size * 0.75, y: cy + (y - 0.5) * size }));
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 200, height / 2, 0, 24, 0xffc928).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2, 404, 28).setStrokeStyle(4, 0xffffff);
    this.load.on('progress', (p) => (bar.width = 400 * p));
    for (const key of SPRITES) this.load.image(key, `assets/sprites/${key}.png`);
    for (const key of ENV_PNG) this.load.image(key, `assets/env/${key}.png`);
    this.load.image('dirt', 'assets/env/dirt.jpg');
    this.load.image('background', 'assets/env/background.jpg');
  }

  create() {
    this.makeTextures();
    this.makeTruckIcon();
    this.scene.start('Title');
  }

  // A small picture of the whole truck (body, struts and all four wheels) for
  // the progress bar: build the real truck once and snapshot it into a texture.
  makeTruckIcon() {
    const W = 440;
    const H = 270;
    const truck = new Truck(this, 0, 0);
    const rt = this.make.renderTexture({ width: W, height: H }, false);
    rt.draw(truck.container, 175, 200); // hub midpoint lands here; leaves room for the cab and exhaust
    rt.saveTexture('truck_icon');
    truck.container.destroy();
  }

  tex(key, w, h, draw) {
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  makeTextures() {
    // gold star
    this.tex('star', 96, 96, (g) => {
      g.fillStyle(OUTLINE).fillPoints(starPoints(48, 50, 46, 22), true);
      g.fillStyle(0xffc928).fillPoints(starPoints(48, 50, 38, 17), true);
      g.fillStyle(0xffe680).fillPoints(starPoints(44, 44, 18, 8), true);
    });

    // cardboard box
    this.tex('box', 80, 80, (g) => {
      g.fillStyle(OUTLINE).fillRoundedRect(0, 0, 80, 80, 8);
      g.fillStyle(0xd9a15a).fillRoundedRect(5, 5, 70, 70, 5);
      g.fillStyle(0xc4873f).fillRect(5, 52, 70, 23);
      g.fillStyle(0xf2d38e).fillRect(33, 5, 14, 70);
      g.lineStyle(4, 0x7a4e1b).lineBetween(7, 28, 73, 28);
    });

    // checkered finish flag on a pole
    this.tex('flag', 170, 280, (g) => {
      g.fillStyle(OUTLINE).fillRoundedRect(0, 0, 18, 280, 6);
      g.fillStyle(0xd0d0d0).fillRoundedRect(4, 4, 10, 272, 4);
      g.fillStyle(OUTLINE).fillRect(14, 6, 154, 104);
      const s = 25;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 6; c++) {
          g.fillStyle((r + c) % 2 ? 0x222222 : 0xffffff).fillRect(18 + c * s, 10 + r * s, s, s);
        }
      }
    });

    // fluffy cloud
    this.tex('cloud', 260, 130, (g) => {
      const blobs = [
        [70, 80, 48], [130, 60, 58], [190, 82, 46], [105, 95, 40], [160, 98, 38],
      ];
      g.fillStyle(0xcfeaf8);
      blobs.forEach(([x, y, r]) => g.fillCircle(x, y + 6, r));
      g.fillStyle(0xffffff);
      blobs.forEach(([x, y, r]) => g.fillCircle(x, y, r));
    });

    // confetti piece (tinted at runtime)
    this.tex('confetti', 14, 22, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 14, 22));

    // big round touch buttons
    const button = (key, size, fill, ring, drawIcon) =>
      this.tex(key, size, size, (g) => {
        const r = size / 2;
        g.fillStyle(OUTLINE).fillCircle(r, r, r);
        g.fillStyle(ring).fillCircle(r, r, r - 6);
        g.fillStyle(fill).fillCircle(r, r - 3, r - 14);
        drawIcon(g, r);
      });

    button('btn_drive', 160, 0x4caf50, 0x2e7d32, (g, r) => {
      g.fillStyle(OUTLINE).fillTriangle(r - 22, r - 40, r - 22, r + 34, r + 42, r - 3);
      g.fillStyle(0xffffff).fillTriangle(r - 16, r - 30, r - 16, r + 24, r + 30, r - 3);
    });
    button('btn_back', 110, 0xb0bec5, 0x78909c, (g, r) => {
      g.fillStyle(OUTLINE).fillTriangle(r + 16, r - 28, r + 16, r + 22, r - 28, r - 3);
      g.fillStyle(0xffffff).fillTriangle(r + 11, r - 20, r + 11, r + 14, r - 19, r - 3);
    });
    button('btn_jump', 160, 0x42a5f5, 0x1565c0, (g, r) => {
      g.fillStyle(OUTLINE).fillTriangle(r, r - 52, r - 40, r - 2, r + 40, r - 2);
      g.fillStyle(0xffffff).fillTriangle(r, r - 42, r - 30, r - 8, r + 30, r - 8);
    });
    button('btn_round', 140, 0xffc928, 0xc98800, () => {});
    button('btn_nitro', 140, 0xff7043, 0xbf360c, (g, r) => {
      g.fillStyle(OUTLINE).fillPoints(boltPoints(r - 2, r - 4, 66), true);
      g.fillStyle(0xffe680).fillPoints(boltPoints(r - 2, r - 4, 52), true);
    });

    // nitro canister: red tank with a lightning bolt
    this.tex('nitro', 72, 108, (g) => {
      g.fillStyle(OUTLINE).fillRoundedRect(24, 0, 24, 20, 5); // valve
      g.fillStyle(0xb0bec5).fillRoundedRect(28, 4, 16, 14, 3);
      g.fillStyle(OUTLINE).fillRoundedRect(0, 14, 72, 94, 18);
      g.fillStyle(0xe53935).fillRoundedRect(5, 19, 62, 84, 14);
      g.fillStyle(0xff8a80).fillRoundedRect(12, 26, 10, 64, 5); // shine
      g.fillStyle(0x8e1c17).fillRect(5, 88, 62, 8);
      g.fillStyle(OUTLINE).fillPoints(boltPoints(38, 58, 60), true);
      g.fillStyle(0xffe680).fillPoints(boltPoints(38, 58, 46), true);
    });

    // soft round glow for fire particles (drawn additively, then tinted)
    const flare = this.textures.createCanvas('flare', 64, 64);
    const ctx = flare.getContext();
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    flare.refresh();

    // speed line for the nitro rush
    this.tex('speedline', 160, 8, (g) => g.fillStyle(0xffffff).fillRoundedRect(0, 0, 160, 8, 4));
  }
}
