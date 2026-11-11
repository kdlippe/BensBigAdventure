// The pufferfish enemy (underwater level): swims back and forth just above
// the seabed. When the truck comes close it stops to glare and keeps puffing
// up big, round and spiky (for a couple of seconds), then letting it out
// again; when the truck has gone it calms down. Land on it
// while it's calm to squish it. Puffed up it's spiky: landing on it, or
// touching it at all, blows the truck up, so jump right over it.
//
// Same interface as the crab: update(), x, top, bottom, halfWidth, squish(), snap().

const CALM_W = 125; // on screen
const BIG_W = 185;
const SPEED = 55; // px per second
const PUFF_NEAR = 450; // puffs up when the truck is this close...
const CALM_FAR = 650; // ...and calms down once it's this far away
const PUFFED_FOR = 2.0; // while the truck is near: seconds puffed up...
const CALM_FOR = 5; // ...then seconds small after it shrinks (a chance to squish it), and again
const DIZZY_W = 175;

export class Pufferfish {
  constructor(scene, { x, minX, maxX }) {
    this.scene = scene;
    this.x = x;
    this.minX = minX;
    this.maxX = maxX;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.squished = false;
    this.ground = 0;
    this.big = false;
    this.grow = 0; // 0 = calm, 1 = fully puffed (animates between)
    this.near = false; // the truck is close
    this.breath = 0; // counts down to the next puff in / out while the truck is near
    this.phase = Math.random() * 10;

    const tex = (key) => scene.textures.get(key).getSourceImage();
    this.calmS = CALM_W / tex('puffer').width;
    this.bigS = BIG_W / tex('puffer_big').width;
    this.calm = scene.add.image(0, 0, 'puffer').setScale(this.calmS);
    this.puffed = scene.add.image(0, 0, 'puffer_big').setScale(this.bigS * 0.6).setAlpha(0);
    this.container = scene.add.container(x, 0, [this.calm, this.puffed]).setDepth(22);
  }

  // where its middle is above the ground, and its size, for how puffed it is
  get radius() {
    return 42 + (BIG_W * 0.47 - 42) * this.grow;
  }

  get centreY() {
    return this.ground - (72 + 30 * this.grow) + Math.sin(this.phase) * 7;
  }

  // puffed up (or most of the way): spiky, so it can't be squished
  get spiky() {
    return this.big && this.grow > 0.5;
  }

  get halfWidth() {
    return 60 + 30 * this.grow;
  }

  update(dt, time, groundY) {
    if (this.squished) return;
    this.phase += dt * 2.2;
    const t = this.scene.t;
    const dist = t ? Math.abs(t.x - this.x) : Infinity;
    if (!this.near && dist < PUFF_NEAR && !this.scene.finished) {
      this.near = true;
      this.breath = PUFFED_FOR;
      this.setBig(true);
    } else if (this.near && dist > CALM_FAR) {
      this.near = false;
      if (this.big) this.setBig(false);
    } else if (this.near) {
      // puff in, puff out
      this.breath -= dt;
      if (this.breath <= 0) {
        this.breath = this.big ? CALM_FOR : PUFFED_FOR;
        this.setBig(!this.big);
      }
    }

    // swims about while the truck is away; hovers in place, glaring at it, while it's near
    if (!this.near) {
      this.x += this.dir * SPEED * dt;
      if (this.x < this.minX) {
        this.x = this.minX;
        this.dir = 1;
      } else if (this.x > this.maxX) {
        this.x = this.maxX;
        this.dir = -1;
      }
    }
    const facing = this.near && t ? Math.sign(t.x - this.x) || -1 : this.dir;
    // the art looks left; flip it to look the other way
    this.calm.setFlipX(facing > 0);
    this.puffed.setFlipX(facing > 0);
    this.ground = groundY(this.x);
    this.container.setPosition(this.x, this.centreY);
    // a little tail-wag wiggle
    this.container.setRotation(Math.sin(this.phase * 3) * (this.big ? 0.03 : 0.08));
  }

  setBig(big) {
    this.big = big;
    const scene = this.scene;
    scene.tweens.killTweensOf([this, this.calm, this.puffed]);
    scene.tweens.add({ targets: this, grow: big ? 1 : 0, duration: big ? 260 : 500, ease: big ? 'Back.out' : 'Sine.inOut' });
    if (big) {
      scene.tweens.add({ targets: this.calm, alpha: 0, scale: this.calmS * 1.4, duration: 150 });
      scene.tweens.add({ targets: this.puffed, alpha: 1, scale: this.bigS, duration: 260, ease: 'Back.out' });
    } else {
      scene.tweens.add({ targets: this.puffed, alpha: 0, scale: this.bigS * 0.6, duration: 450 });
      scene.tweens.add({ targets: this.calm, alpha: 1, scale: this.calmS, duration: 450 });
    }
  }

  get top() {
    return this.centreY - this.radius;
  }

  get bottom() {
    return this.centreY + this.radius;
  }

  // puffs harder (after it touches the truck)
  snap() {
    this.scene.tweens.add({ targets: this.puffed, scale: this.bigS * 1.1, yoyo: true, repeat: 1, duration: 90 });
  }

  squish() {
    this.squished = true;
    const x = this.x;
    const y = this.ground;
    const flip = this.calm.flipX;
    this.scene.tweens.killTweensOf([this, this.calm, this.puffed]);
    this.container.destroy();
    const s = DIZZY_W / this.scene.textures.get('puffer_dizzy').getSourceImage().width;
    const dizzy = this.scene.add.image(x, y + 6, 'puffer_dizzy')
      .setOrigin(0.5, 1)
      .setDepth(22)
      .setFlipX(flip)
      .setScale(s, s * 0.2);
    // flattens onto the sand, puffs back a bit, then wobbles dizzily forever
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
