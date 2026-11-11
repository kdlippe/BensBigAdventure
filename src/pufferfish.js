// The pufferfish enemy (underwater level): swims back and forth just above
// the seabed. When the truck comes close it stops to glare and keeps puffing
// up big, round and spiky (for a couple of seconds). Each time it lets the air
// out it's worn out and naps for 8 seconds (Z's float up, it won't puff), then
// wakes and puffs again if the truck is still close. Land on it
// while it's calm (or asleep) to squish it. Puffed up it's spiky: landing on it, or
// touching it at all, blows the truck up, so jump right over it.
//
// Same interface as the crab: update(), x, top, bottom, halfWidth, squish(), snap().

const CALM_W = 125; // on screen
const BIG_W = 185;
const SPEED = 55; // px per second
const PUFF_NEAR = 860; // puffs up when the truck is this close (centre to centre: about a truck length and a bit between bumper and fish)...
const CALM_FAR = 1060; // ...and calms down once it's this far away
const PUFFED_FOR = 2.0; // while the truck is near: seconds puffed up...
const SLEEP_FOR = 8; // ...then it naps this long after it shrinks (a chance to squish it)
const ZZZ_EVERY = 1.1; // seconds between Z's while it naps
const SLEEP_DROP = 18; // it settles this much lower while it naps
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
    this.breath = 0; // counts down to letting the air out while it's puffed up
    this.sleep = 0; // seconds of nap left (it can't puff up while napping)
    this.zzzTimer = 0;
    this.drop = 0; // how far it has settled down for its nap (animates)
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
    return this.ground - (72 + 30 * this.grow) + this.drop + Math.sin(this.phase) * 7;
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
    const asleep = this.sleep > 0;
    this.phase += dt * (asleep ? 0.9 : 2.2); // slow, sleepy bobbing
    const t = this.scene.t;
    const dist = t ? Math.abs(t.x - this.x) : Infinity;
    if (dist < PUFF_NEAR && !this.scene.finished) this.near = true;
    else if (dist > CALM_FAR) this.near = false;

    if (asleep) {
      // napping: no puffing, Z's float up
      this.sleep -= dt;
      this.zzzTimer -= dt;
      if (this.zzzTimer <= 0 && this.sleep > 0.5) {
        this.zzzTimer = ZZZ_EVERY;
        this.zzz();
      }
      if (this.sleep <= 0) this.wake();
    } else if (this.big) {
      // puffed up: lets the air out after a while, or once the truck has gone, then naps
      this.breath -= dt;
      if (this.breath <= 0 || !this.near) this.setBig(false);
    } else if (this.near) {
      this.breath = PUFFED_FOR;
      this.setBig(true);
    }

    // swims about while the truck is away; hovers in place, glaring at it, while it's near
    if (!this.near && !asleep) {
      this.x += this.dir * SPEED * dt;
      if (this.x < this.minX) {
        this.x = this.minX;
        this.dir = 1;
      } else if (this.x > this.maxX) {
        this.x = this.maxX;
        this.dir = -1;
      }
    }
    if (!asleep) {
      // (napping, it keeps facing the way it was)
      const facing = this.near && t ? Math.sign(t.x - this.x) || -1 : this.dir;
      // the art looks left; flip it to look the other way
      this.calm.setFlipX(facing > 0);
      this.puffed.setFlipX(facing > 0);
    }
    this.ground = groundY(this.x);
    this.container.setPosition(this.x, this.centreY);
    // a little tail-wag wiggle
    this.container.setRotation(asleep ? Math.sin(this.phase) * 0.05 : Math.sin(this.phase * 3) * (this.big ? 0.03 : 0.08));
  }

  fallAsleep() {
    this.sleep = SLEEP_FOR;
    this.zzzTimer = 0.6;
    this.scene.tweens.add({ targets: this, drop: SLEEP_DROP, duration: 700, ease: 'Sine.inOut' });
  }

  wake() {
    this.sleep = 0;
    this.scene.tweens.add({ targets: this, drop: 0, duration: 300, ease: 'Back.out' });
  }

  // a Z floats up from its head
  zzz() {
    const scene = this.scene;
    const side = this.calm.flipX ? 1 : -1; // the way it's facing
    const z = scene.add.image(this.x + side * 30, this.centreY - 50, 'king_zzz').setScale(0.3).setAlpha(0).setDepth(23);
    if (side < 0) z.setFlipX(true);
    scene.tweens.add({ targets: z, alpha: 1, duration: 250 });
    scene.tweens.add({ targets: z, x: z.x + side * 30, y: z.y - 80, scale: 0.45, duration: 1300, ease: 'Sine.out', onComplete: () => z.destroy() });
    scene.tweens.add({ targets: z, alpha: 0, duration: 400, delay: 900 });
  }

  setBig(big) {
    this.big = big;
    const scene = this.scene;
    scene.tweens.killTweensOf([this, this.calm, this.puffed]);
    scene.tweens.add({ targets: this, grow: big ? 1 : 0, duration: big ? 260 : 500, ease: big ? 'Back.out' : 'Sine.inOut' });
    if (big) {
      scene.tweens.add({ targets: this, drop: 0, duration: 260, ease: 'Back.out' }); // rises up out of its nap
      scene.tweens.add({ targets: this.calm, alpha: 0, scale: this.calmS * 1.4, duration: 150 });
      scene.tweens.add({ targets: this.puffed, alpha: 1, scale: this.bigS, duration: 260, ease: 'Back.out' });
    } else {
      scene.tweens.add({ targets: this.puffed, alpha: 0, scale: this.bigS * 0.6, duration: 450 });
      scene.tweens.add({ targets: this.calm, alpha: 1, scale: this.calmS, duration: 450 });
      this.fallAsleep(); // worn out from all that puffing
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
