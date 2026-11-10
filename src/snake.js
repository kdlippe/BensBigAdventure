// The rattlesnake enemy (desert level): slithers back and forth over its
// patch of ground, swaying, with its tail rattle shaking. Jump over it, or
// land on it to squish it; drive into it and it bumps you back.
//
// Same interface as the crab: update(), x, top, halfWidth, squish(), snap().
// Coordinates inside the container: (0, 0) is the ground under the snake.

const S = 0.32; // art scale (snake_body.png is 459x407)
const BODY_W = 459;
const BODY_H = 407;
const TAIL_TIP = { x: 444, y: 193 }; // where the rattle goes, on snake_body.png
const SPEED = 60; // px per second
const DIZZY_S = 0.32;
const HEIGHT = BODY_H * S;

export class Snake {
  constructor(scene, { x, minX, maxX }) {
    this.scene = scene;
    this.x = x;
    this.minX = minX;
    this.maxX = maxX;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.halfWidth = 62;
    this.squished = false;
    this.ground = 0;

    this.body = scene.add.image(0, 4, 'snake_body').setOrigin(0.5, 1).setScale(S);
    // the rattle sits on the tip of the tail (its stub end is the pivot)
    const tx = (TAIL_TIP.x - BODY_W / 2) * S;
    const ty = 4 - (BODY_H - TAIL_TIP.y) * S;
    this.rattle = scene.add.image(tx, ty, 'snake_rattle').setOrigin(0.83, 0.99).setScale(S);
    this.rattleX = tx;
    this.rattleY = ty;
    this.rattleBase = 0.45; // tilt so it carries on up from the tail
    this.container = scene.add.container(x, 0, [this.rattle, this.body]).setDepth(22);
  }

  update(dt, time, groundY) {
    if (this.squished) return;
    this.x += this.dir * SPEED * dt;
    if (this.x < this.minX) {
      this.x = this.minX;
      this.dir = 1;
    } else if (this.x > this.maxX) {
      this.x = this.maxX;
      this.dir = -1;
    }
    this.ground = groundY(this.x);
    // the art faces left; flip it to face the way it's going
    this.container.setPosition(this.x, this.ground).setScale(this.dir > 0 ? -1 : 1, 1);
    // sway from the base and breathe a little
    const sway = Math.sin(time / 260) * 0.05;
    const breathe = 1 + Math.sin(time / 180) * 0.03;
    this.body.setRotation(sway);
    this.body.setScale(S, S * breathe);
    // the rattle rides on the tail tip: move it exactly as the sway/breathe moves
    // that point (the body pivots at its base, (0, 4)), plus a tiny fast buzz
    const lx = this.rattleX;
    const ly = (this.rattleY - 4) * breathe;
    const cos = Math.cos(sway);
    const sin = Math.sin(sway);
    const buzz = Math.sin(time / 16);
    this.rattle
      .setRotation(this.rattleBase + sway + buzz * 0.04)
      .setPosition(lx * cos - ly * sin + buzz * 1.2, 4 + lx * sin + ly * cos);
  }

  get top() {
    return this.ground - HEIGHT;
  }

  get bottom() {
    return this.ground;
  }

  // rears up (after it bumps the truck)
  snap() {
    this.scene.tweens.add({ targets: this.body, scaleY: S * 1.15, yoyo: true, repeat: 1, duration: 110 });
  }

  squish() {
    this.squished = true;
    const x = this.x;
    const y = this.ground;
    const flip = this.dir > 0;
    this.container.destroy();
    const dizzy = this.scene.add.image(x, y + 6, 'snake_dizzy')
      .setOrigin(0.5, 1)
      .setDepth(22)
      .setFlipX(flip)
      .setScale(DIZZY_S, DIZZY_S * 0.2);
    this.scene.tweens.add({ targets: dizzy, scaleY: DIZZY_S * 0.8, duration: 350, ease: 'Back.out' });
    this.scene.tweens.add({
      targets: dizzy,
      angle: { from: -3, to: 3 },
      yoyo: true,
      repeat: -1,
      duration: 420,
      ease: 'Sine.inOut',
      delay: 350,
    });
    this.dizzy = dizzy;
  }
}
