// The crab enemy: body, two raised claws and six legs, animated so it
// scuttles back and forth along a stretch of ground. Land on it to squish it!
//
// Coordinates inside the container: (0, 0) is the ground under the crab's
// middle, negative y is up.

const S = 0.26; // scale for legs and claws
const BODY_S = 0.36; // scale for the body
const BODY_Y = -62; // body centre above the ground
const LEG_XS = [15, 28, 41]; // where the right-hand legs join the body
const LEG_Y = -58;
const CLAW_X = 50;
const CLAW_Y = -45;
const SPEED = 75; // walking speed, px per second
const DIZZY_S = 0.36;

export const CRAB_HALF_WIDTH = 70; // for collisions (claws stick out a bit further)
export const CRAB_HEIGHT = 100;

export class Crab {
  constructor(scene, { x, minX, maxX }) {
    this.scene = scene;
    this.x = x;
    this.minX = minX;
    this.maxX = maxX;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.phase = Math.random() * 10;
    this.squished = false;

    const parts = [];
    // legs: drawn as the art is for the right side, flipped for the left
    this.legs = [];
    for (const side of [-1, 1]) {
      LEG_XS.forEach((lx, i) => {
        const leg = scene.add.image(side * lx, LEG_Y, 'crab_leg')
          .setScale(S)
          .setFlipX(side < 0)
          .setOrigin(side < 0 ? 0.92 : 0.08, 0.06);
        leg.side = side;
        leg.index = i;
        this.legs.push(leg);
        parts.push(leg);
      });
    }
    // claws: the art is the left claw (arm stub on its right); flip for the right
    this.claws = [-1, 1].map((side) => {
      const claw = scene.add.image(side * CLAW_X, CLAW_Y, 'crab_claw')
        .setScale(S)
        .setFlipX(side > 0)
        .setOrigin(side < 0 ? 0.88 : 0.12, 0.9);
      claw.side = side;
      parts.push(claw);
      return claw;
    });
    this.body = scene.add.image(0, BODY_Y, 'crab_body').setScale(BODY_S);
    parts.push(this.body);

    this.container = scene.add.container(x, 0, parts).setDepth(22);
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
    this.phase += dt * 11;

    this.container.setPosition(this.x, groundY(this.x) + 4);
    // legs step in a ripple; the body bobs with the steps and the claws snap
    for (const leg of this.legs) {
      const swing = Math.sin(this.phase + leg.index * 2.1 + (leg.side > 0 ? 0 : Math.PI));
      leg.setRotation(leg.side * 0.28 * swing);
    }
    this.body.y = BODY_Y + Math.sin(this.phase * 2) * 2.5;
    this.claws.forEach((c) => c.setRotation(c.side * (0.12 + 0.12 * Math.sin(time / 180 + c.side))));
  }

  get top() {
    return this.container.y - CRAB_HEIGHT;
  }

  // claws up and snap (after it bumps the truck)
  snap() {
    this.claws.forEach((c) =>
      this.scene.tweens.add({ targets: c, rotation: c.side * 0.6, yoyo: true, repeat: 2, duration: 90 })
    );
  }

  squish() {
    this.squished = true;
    const { x, y } = this.container;
    this.container.destroy();
    const dizzy = this.scene.add.image(x, y, 'crab_dizzy').setOrigin(0.5, 1).setDepth(22).setScale(DIZZY_S, DIZZY_S * 0.2);
    // flatten, then puff back up a bit, then wobble dizzily forever
    this.scene.tweens.add({ targets: dizzy, scaleY: DIZZY_S * 0.75, duration: 350, ease: 'Back.out' });
    this.scene.tweens.add({
      targets: dizzy,
      angle: { from: -4, to: 4 },
      yoyo: true,
      repeat: -1,
      duration: 420,
      ease: 'Sine.inOut',
      delay: 350,
    });
    this.dizzy = dizzy;
  }
}
