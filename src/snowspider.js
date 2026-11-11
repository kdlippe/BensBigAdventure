// The snow spider enemy (snow level): a grumpy snowball on four icy legs that
// scuttles back and forth over its patch of ground. Jump over it, or land on
// it to squish it; drive into it and the truck blows up.
//
// When the truck comes near it throws snowballs that roll along the ground at
// the truck (jump over them!).
//
// Same interface as the crab: update(), x, top, bottom, halfWidth, squish(), snap().
// Coordinates inside the container: (0, 0) is the ground under its middle.

const BODY_S = 0.27; // snowspider_body.png is 385x365
const LEG_S = 0.27;
const SPEED = 70; // px per second
const BODY_Y = -92; // snowball centre above the ground
// where each leg's hip joins the snowball (from its centre) and how far it splays out
const LEGS = [
  { key: 'snowspider_leg1', x: -40, y: 22, lean: 0.38, depth: 0 },
  { key: 'snowspider_leg2', x: -18, y: 34, lean: 0.12, depth: 1 },
  { key: 'snowspider_leg3', x: 18, y: 34, lean: -0.12, depth: 1 },
  { key: 'snowspider_leg4', x: 40, y: 22, lean: -0.38, depth: 0 },
];
const HEIGHT = 140;
const DIZZY_S = 0.3;
const THROW_NEAR = 300; // throws when the truck is between these distances away
const THROW_FAR = 1150;
const THROW_EVERY = [2.4, 3.6]; // seconds between throws (random in this range)

import { Snowball } from './snowball.js';

export class SnowSpider {
  constructor(scene, { x, minX, maxX }) {
    this.scene = scene;
    this.x = x;
    this.minX = minX;
    this.maxX = maxX;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.phase = Math.random() * 10;
    this.halfWidth = 62;
    this.squished = false;
    this.ground = 0;
    this.throwTimer = 1 + Math.random(); // first throw comes a moment after the truck is in range
    this.faceTimer = 0; // while > 0 it looks at the truck (it just threw)
    this.faceDir = 1;

    // legs hang from their top end (the hip); the two far ones go behind
    this.legs = LEGS.map((l, i) => {
      const leg = scene.add.image(l.x, BODY_Y + l.y, l.key).setOrigin(0.5, 0.04).setScale(LEG_S);
      leg.lean = l.lean;
      leg.index = i;
      leg.hipY = BODY_Y + l.y;
      return leg;
    });
    this.body = scene.add.image(0, BODY_Y, 'snowspider_body').setScale(BODY_S);
    const back = this.legs.filter((_, i) => LEGS[i].depth === 0);
    const front = this.legs.filter((_, i) => LEGS[i].depth === 1);
    this.container = scene.add.container(x, 0, [...back, this.body, ...front]).setDepth(22);
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
    this.phase += dt * 10;
    this.ground = groundY(this.x);
    this.container.setPosition(this.x, this.ground + 4);

    // legs step in pairs (1+3, then 2+4); the snowball bobs and rocks a little
    const bob = Math.abs(Math.sin(this.phase)) * 5;
    for (const leg of this.legs) {
      const swing = Math.sin(this.phase + (leg.index % 2 ? Math.PI : 0));
      leg.setRotation(leg.lean + swing * 0.22);
      leg.y = leg.hipY - bob;
    }
    this.throwAtTruck(dt);
    // the art looks to the right; face the way it's walking (or at the truck, just after a throw)
    this.faceTimer -= dt;
    this.body.setFlipX((this.faceTimer > 0 ? this.faceDir : this.dir) < 0);
    this.body.y = BODY_Y - bob;
    this.body.setRotation(Math.sin(this.phase) * 0.05);
  }

  throwAtTruck(dt) {
    const scene = this.scene;
    if (scene.finished || !scene.t || !scene.addSnowball) return;
    const dx = scene.t.x - this.x;
    if (Math.abs(dx) < THROW_NEAR || Math.abs(dx) > THROW_FAR) return;
    this.throwTimer -= dt;
    if (this.throwTimer > 0) return;
    this.throwTimer = THROW_EVERY[0] + Math.random() * (THROW_EVERY[1] - THROW_EVERY[0]);
    const side = Math.sign(dx);
    this.faceDir = side;
    this.faceTimer = 0.7;
    // wind up (squash) and fling it
    scene.tweens.add({ targets: this.body, scaleX: BODY_S * 1.12, scaleY: BODY_S * 0.86, yoyo: true, duration: 110 });
    scene.addSnowball(new Snowball(scene, this.x + side * 50, this.ground + BODY_Y + 20, side));
  }

  get top() {
    return this.ground - HEIGHT;
  }

  get bottom() {
    return this.ground;
  }

  // stamps its legs (after it touches the truck)
  snap() {
    this.scene.tweens.add({ targets: this.body, scaleY: BODY_S * 0.85, yoyo: true, repeat: 2, duration: 80 });
  }

  squish() {
    this.squished = true;
    const x = this.x;
    const y = this.ground;
    const flip = this.dir < 0;
    this.container.destroy();
    const dizzy = this.scene.add.image(x, y + 6, 'snowspider_dizzy')
      .setOrigin(0.5, 1)
      .setDepth(22)
      .setFlipX(flip)
      .setScale(DIZZY_S, DIZZY_S * 0.2);
    // flatten, then puff back up a bit, then wobble dizzily forever
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
