// The evil snowman enemy (snow level): hops back and forth over its patch of
// ground, and when the truck comes near it winds up and throws snowballs that
// roll along the ground at the truck (jump over them!). Land on it to squish
// it; touch it otherwise and the truck blows up.
//
// Same interface as the crab: update(), x, top, bottom, halfWidth, squish(), snap().
// Coordinates inside the container: (0, 0) is the ground under its middle.

import { Snowball } from './snowball.js';

const S = 0.25; // snowman_body.png is 336x678
const HEIGHT = 678 * S; // about 170 on screen
const SPEED = 45; // px per second, hopping
const HOP_EVERY = 0.55; // seconds per hop
const HOP_H = 12;
const DIZZY_S = 0.3;
// where the throwing arm's shoulder is: the twig on its back (the art looks right,
// so that's the left one), measured from its feet. It winds up behind its head.
const SHOULDER = { x: -30, y: -100 };
const THROW_NEAR = 300; // throws when the truck is between these distances away
const THROW_FAR = 1150;
const THROW_EVERY = [2.4, 3.6]; // seconds between throws (random in this range)

export class Snowman {
  constructor(scene, { x, minX, maxX }) {
    this.scene = scene;
    this.x = x;
    this.minX = minX;
    this.maxX = maxX;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.halfWidth = 48;
    this.squished = false;
    this.ground = 0;
    this.hop = Math.random();
    this.throwTimer = 1 + Math.random(); // first throw a moment after the truck is in range
    this.facing = -1; // the art looks right; it turns to face the truck
    this.throwing = false;

    this.body = scene.add.image(0, 0, 'snowman_body').setOrigin(0.5, 1).setScale(S);
    // the throwing arm only shows during a throw
    this.arm = scene.add.image(SHOULDER.x, SHOULDER.y, 'snowman_arm')
      .setOrigin(0.1, 0.85)
      .setScale(S * 1.1)
      .setVisible(false);
    this.inner = scene.add.container(0, 0, [this.body, this.arm]); // flips to face the truck
    this.container = scene.add.container(x, 0, [this.inner]).setDepth(22);
  }

  update(dt, time, groundY) {
    if (this.squished) return;
    // hop along (it stands still while throwing)
    let lift = 0;
    if (!this.throwing) {
      this.hop += dt / HOP_EVERY;
      this.x += this.dir * SPEED * dt;
      if (this.x < this.minX) {
        this.x = this.minX;
        this.dir = 1;
      } else if (this.x > this.maxX) {
        this.x = this.maxX;
        this.dir = -1;
      }
      const p = this.hop % 1;
      lift = Math.sin(p * Math.PI) * HOP_H;
      // squash a little as it lands and pushes off
      const squash = p < 0.12 || p > 0.88 ? 0.93 : 1;
      this.body.setScale(S * (2 - squash), S * squash);
    }
    this.ground = groundY(this.x);
    this.container.setPosition(this.x, this.ground + 4 - lift);

    // keep an eye on the truck: face it, and throw when it's in range
    const t = this.scene.t;
    if (t) this.facing = t.x < this.x ? -1 : 1;
    this.inner.setScale(this.facing, 1);
    if (!this.throwing) this.body.setRotation(Math.sin(time / 300) * 0.03);
    this.throwAtTruck(dt);
  }

  throwAtTruck(dt) {
    const scene = this.scene;
    if (this.throwing || scene.finished || !scene.t || !scene.addSnowball) return;
    const dx = scene.t.x - this.x;
    if (Math.abs(dx) < THROW_NEAR || Math.abs(dx) > THROW_FAR) return;
    this.throwTimer -= dt;
    if (this.throwTimer > 0) return;
    this.throwTimer = THROW_EVERY[0] + Math.random() * (THROW_EVERY[1] - THROW_EVERY[0]);
    this.throwing = true;
    const side = Math.sign(dx);
    // lean back with the arm raised behind...
    this.body.setScale(S, S);
    this.arm.setVisible(true).setRotation(-0.7);
    scene.tweens.add({ targets: this.body, rotation: -0.12, duration: 220, ease: 'Sine.out' });
    scene.tweens.add({
      targets: this.arm,
      rotation: -1.15,
      duration: 220,
      ease: 'Sine.out',
      onComplete: () => {
        if (this.squished) return;
        // ...then lunge forward and fling it
        scene.tweens.add({ targets: this.body, rotation: 0.1, duration: 120, yoyo: true, ease: 'Sine.in' });
        scene.tweens.add({
          targets: this.arm,
          rotation: 1.0,
          duration: 120,
          ease: 'Sine.in',
          onComplete: () => {
            if (this.squished) return;
            scene.addSnowball(new Snowball(scene, this.x + side * 50, this.ground - 95, side));
            scene.time.delayedCall(180, () => {
              if (this.squished) return;
              this.arm.setVisible(false);
              this.throwing = false;
            });
          },
        });
      },
    });
  }

  get top() {
    return this.ground - HEIGHT;
  }

  get bottom() {
    return this.ground;
  }

  // shakes with rage (after it touches the truck)
  snap() {
    this.scene.tweens.add({ targets: this.body, scaleX: S * 1.1, scaleY: S * 0.92, yoyo: true, repeat: 2, duration: 80 });
  }

  squish() {
    this.squished = true;
    const x = this.x;
    const y = this.ground;
    const flip = this.facing < 0;
    this.container.destroy();
    const dizzy = this.scene.add.image(x, y + 6, 'snowman_dizzy')
      .setOrigin(0.5, 1)
      .setDepth(22)
      .setFlipX(!flip) // the dizzy art's nose points left
      .setScale(DIZZY_S, DIZZY_S * 0.2);
    // flatten, then puff back up a bit, then wobble dizzily forever
    this.scene.tweens.add({ targets: dizzy, scaleY: DIZZY_S * 0.85, duration: 350, ease: 'Back.out' });
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
