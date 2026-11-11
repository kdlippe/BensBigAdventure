// The octopus enemy (underwater level): creeps back and forth over the seabed
// with its tentacles waving, and when the truck comes near it squirts clouds
// of ink that roll along the ground at the truck (jump over them!). Land on it
// to squish it; touch it otherwise and the truck blows up.
//
// Same interface as the crab: update(), x, top, bottom, halfWidth, squish(), snap().
// Coordinates inside the container: (0, 0) is the ground under its middle.

import { Snowball } from './snowball.js';

const WIDTH = 170; // on screen
const SPEED = 35; // px per second
const SQUIRT_NEAR = 300; // squirts when the truck is between these distances away
const SQUIRT_FAR = 1150;
const SQUIRT_EVERY = [2.6, 3.8]; // seconds between squirts (random in this range)
const DIZZY_W = 200;

export class Octopus {
  constructor(scene, { x, minX, maxX }) {
    this.scene = scene;
    this.x = x;
    this.minX = minX;
    this.maxX = maxX;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.halfWidth = 70;
    this.squished = false;
    this.ground = 0;
    this.phase = Math.random() * 10;
    this.squirtTimer = 1 + Math.random();
    this.squirting = false;

    const img = scene.textures.get('octopus').getSourceImage();
    this.S = WIDTH / img.width;
    this.height = img.height * this.S;
    this.body = scene.add.image(0, 6, 'octopus').setOrigin(0.5, 1).setScale(this.S);
    this.container = scene.add.container(x, 0, [this.body]).setDepth(22);
  }

  update(dt, time, groundY) {
    if (this.squished) return;
    this.phase += dt * 3;
    if (!this.squirting) {
      this.x += this.dir * SPEED * dt;
      if (this.x < this.minX) {
        this.x = this.minX;
        this.dir = 1;
      } else if (this.x > this.maxX) {
        this.x = this.maxX;
        this.dir = -1;
      }
      // tentacles wave: the body swells and sways as it creeps
      const w = Math.sin(this.phase);
      this.body.setScale(this.S * (1 + w * 0.05), this.S * (1 - w * 0.04));
      this.body.setRotation(Math.sin(this.phase * 0.5) * 0.05);
    }
    // looks at the truck (the art looks a little to the left)
    const t = this.scene.t;
    const facing = t ? Math.sign(t.x - this.x) || -1 : this.dir;
    this.body.setFlipX(facing > 0);
    this.ground = groundY(this.x);
    this.container.setPosition(this.x, this.ground);
    this.squirtAtTruck(dt);
  }

  squirtAtTruck(dt) {
    const scene = this.scene;
    if (this.squirting || scene.finished || !scene.t || !scene.addSnowball) return;
    const dx = scene.t.x - this.x;
    if (Math.abs(dx) < SQUIRT_NEAR || Math.abs(dx) > SQUIRT_FAR) return;
    this.squirtTimer -= dt;
    if (this.squirtTimer > 0) return;
    this.squirtTimer = SQUIRT_EVERY[0] + Math.random() * (SQUIRT_EVERY[1] - SQUIRT_EVERY[0]);
    this.squirting = true;
    const side = Math.sign(dx);
    // squeeze down... then stretch up and squirt
    scene.tweens.add({
      targets: this.body,
      scaleX: this.S * 1.15,
      scaleY: this.S * 0.8,
      rotation: 0,
      duration: 260,
      ease: 'Sine.out',
      onComplete: () => {
        if (this.squished) return;
        scene.tweens.add({ targets: this.body, scaleX: this.S * 0.92, scaleY: this.S * 1.12, duration: 110, yoyo: true });
        scene.addSnowball(new Snowball(scene, this.x + side * 65, this.ground - 55, side, 'ink'));
        scene.time.delayedCall(300, () => {
          this.squirting = false;
        });
      },
    });
  }

  get top() {
    return this.ground - this.height;
  }

  get bottom() {
    return this.ground;
  }

  // waves its tentacles angrily (after it touches the truck)
  snap() {
    this.scene.tweens.add({ targets: this.body, scaleX: this.S * 1.12, yoyo: true, repeat: 2, duration: 80 });
  }

  squish() {
    this.squished = true;
    const x = this.x;
    const y = this.ground;
    this.container.destroy();
    const s = DIZZY_W / this.scene.textures.get('octopus_dizzy').getSourceImage().width;
    const dizzy = this.scene.add.image(x, y + 6, 'octopus_dizzy')
      .setOrigin(0.5, 1)
      .setDepth(22)
      .setScale(s, s * 0.2);
    this.scene.tweens.add({ targets: dizzy, scaleY: s * 0.85, duration: 350, ease: 'Back.out' });
    this.scene.tweens.add({
      targets: dizzy,
      angle: { from: -3, to: 3 },
      yoyo: true,
      repeat: -1,
      duration: 480,
      ease: 'Sine.inOut',
      delay: 350,
    });
    this.dizzy = dizzy;
  }
}
