// The King Crab: the boss at the end of the game, in an arena (level 6). Awake it's far too tall to land
// on: it stomps about, raises a claw and SLAMS it into the ground (from the
// second round it also throws a rock that rolls at the truck). Then it's worn
// out and falls asleep - Zzz - and that's the moment to land on its shell.
// A bonk wakes it up cross, and it comes back faster. Three bonks and it's beaten.
//
// GameScene asks it: update(), hitTest() and bonk().

import { Snowball } from './snowball.js';

export const KING_HEALTH = 3;
const BODY_S = 0.75; // king_body.png is 373x296 (the art looks right)
const CLAW_S = 0.62;
const LEGS_S = 0.8;
const SLEEP_S = 0.48; // king_sleep.png is 586x482: curled up, its shell is within jumping reach
const DIZZY_S = 0.75;
const AWAKE_TOP = 270; // its height awake (shell, not counting eyes and crown)
const SLEEP_TOP = 0.67 * 482 * SLEEP_S; // its shell's height asleep (~155)
const SLEEP_FOR = 7; // seconds asleep: time to get to it and jump on it
// the slamming arm (king_arm_slam.png, 231x309): its shoulder end is on the
// left, the claw tip at the bottom. The shoulder tucks in behind the body and
// the claw lands on the ground.
const ARM_S = 0.665;
const ARM_SHOULDER = { x: 100, y: -165 }; // where it joins the body (art looks right)
const ARM_TIP_X = ARM_SHOULDER.x + (118 - 6) * ARM_S; // where the claw hits the ground

export class KingCrab {
  constructor(scene, { x, minX, maxX }) {
    this.scene = scene;
    this.x = x;
    this.minX = minX;
    this.maxX = maxX;
    this.dir = -1;
    this.facing = -1;
    this.health = KING_HEALTH;
    this.state = 'walk';
    this.timer = 2.2;
    this.phase = 0;
    this.defeated = false;
    this.ground = 0;
    this.zzzTimer = 0;

    // awake: built from pieces, drawn looking right (the whole thing flips to face the truck)
    this.backClaw = scene.add.image(-120, -150, 'king_claw').setOrigin(0.22, 0.85).setScale(CLAW_S).setFlipX(true);
    this.legs = scene.add.image(0, 6, 'king_legs').setOrigin(0.5, 1).setScale(LEGS_S);
    this.body = scene.add.image(0, -150, 'king_body').setScale(BODY_S);
    this.claw = scene.add.image(130, -150, 'king_claw').setOrigin(0.22, 0.85).setScale(CLAW_S);
    this.slamArm = scene.add.image(ARM_SHOULDER.x, ARM_SHOULDER.y, 'king_arm_slam')
      .setOrigin(6 / 231, 42 / 309)
      .setScale(ARM_S)
      .setVisible(false);
    // the slamming arm goes behind the body, so it comes out from under the shell
    this.awake = scene.add.container(0, 0, [this.backClaw, this.legs, this.slamArm, this.body, this.claw]);
    // asleep: one picture
    this.sleeping = scene.add.image(0, 8, 'king_sleep').setOrigin(0.5, 1).setScale(SLEEP_S).setVisible(false);
    this.container = scene.add.container(x, 0, [this.awake, this.sleeping]).setDepth(22);
  }

  get height() {
    return this.state === 'sleep' ? SLEEP_TOP : AWAKE_TOP;
  }

  get top() {
    return this.ground - this.height;
  }

  get halfWidth() {
    return this.state === 'sleep' ? 120 : 140;
  }

  update(dt, time, groundY) {
    if (this.defeated) return;
    const anger = 1 + (KING_HEALTH - this.health) * 0.35; // faster after each bonk
    this.phase += dt * 8 * anger;
    // angrier = attacks sooner; but it sleeps just as long, so there's always time
    this.timer -= this.state === 'sleep' ? dt : dt * anger;
    const t = this.scene.t;
    const toTruck = t ? Math.sign(t.x - this.x) || -1 : -1;

    switch (this.state) {
      case 'walk':
        this.x += this.dir * 100 * anger * dt;
        if (this.x < this.minX) {
          this.x = this.minX;
          this.dir = 1;
        } else if (this.x > this.maxX) {
          this.x = this.maxX;
          this.dir = -1;
        }
        this.facing = toTruck;
        if (this.timer <= 0) this.raise(toTruck);
        break;
      case 'raise':
        // claw drawn back, shaking: here it comes!
        this.claw.setRotation(-0.5 + Math.sin(time / 35) * 0.1);
        if (this.timer <= 0) this.slam();
        break;
      case 'slammed':
        if (this.timer <= 0) this.fallAsleep();
        break;
      case 'sleep':
        this.zzzTimer -= dt;
        if (this.zzzTimer <= 0) {
          this.zzzTimer = 0.8;
          this.zzz();
        }
        // breathing
        this.sleeping.setScale(SLEEP_S * (1 + Math.sin(time / 400) * 0.015), SLEEP_S * (1 - Math.sin(time / 400) * 0.02));
        if (this.timer <= 0) this.wakeUp();
        break;
      case 'hurt':
        this.container.x = this.x + Math.sin(time / 25) * 6; // shaking with rage
        if (this.timer <= 0) {
          this.state = 'walk';
          this.timer = 1.4;
        }
        break;
      default:
        break;
    }

    this.ground = groundY(this.x);
    if (this.state !== 'hurt') this.container.x = this.x;
    this.container.y = this.ground + 4;
    this.container.setScale(this.facing > 0 ? 1 : -1, 1);
    if (this.state === 'walk' || this.state === 'hurt') {
      // stomping: the body bobs, the claws wave
      const bob = Math.abs(Math.sin(this.phase)) * 8;
      this.body.y = -150 - bob;
      this.legs.setScale(LEGS_S * (1 + Math.sin(this.phase * 2) * 0.03), LEGS_S);
      this.claw.setRotation(Math.sin(time / 220) * 0.12);
      this.backClaw.setRotation(-Math.sin(time / 260) * 0.12);
      this.claw.y = this.backClaw.y = -150 - bob;
    }
  }

  raise(side) {
    this.state = 'raise';
    this.timer = 1.0;
    this.facing = side;
    this.scene.bossRoar && this.scene.bossRoar();
    // from the second round it throws a rock as it winds up: jump that first
    if (this.health < KING_HEALTH && this.scene.addSnowball) {
      this.scene.addSnowball(new Snowball(this.scene, this.x + side * 170, this.ground - 170, side, 'rock'));
    }
  }

  slam() {
    const scene = this.scene;
    this.state = 'slammed';
    this.timer = 0.9;
    // the raised claw becomes the arm swinging down into the ground
    this.claw.setVisible(false);
    this.slamArm.setVisible(true).setRotation(-0.9);
    scene.tweens.add({
      targets: this.slamArm,
      rotation: 0,
      duration: 100,
      ease: 'Quad.in',
      onComplete: () => this.impact(),
    });
  }

  // the claw hits the ground: a burst of dirt and rocks, a crack, dust both ways
  impact() {
    if (this.defeated) return;
    const scene = this.scene;
    const x = this.x + this.facing * ARM_TIP_X;
    const y = this.ground;
    scene.cameras.main.shake(280, 0.013);
    scene.bossSlam && scene.bossSlam(x, y);
    const size = (key, w) => w / scene.textures.get(key).getSourceImage().width;
    // the crack stays until it wakes up
    this.crack = scene.add.image(x, y + 6, 'king_slam_crack').setScale(size('king_slam_crack', 200)).setDepth(19);
    const bs = size('king_slam_burst', 300);
    const burst = scene.add.image(x, y + 10, 'king_slam_burst').setOrigin(0.5, 0.9).setScale(bs * 0.3).setDepth(24);
    scene.tweens.add({ targets: burst, scale: bs, duration: 160, ease: 'Back.out' });
    scene.tweens.add({ targets: burst, alpha: 0, duration: 350, delay: 260, onComplete: () => burst.destroy() });
    for (const [key, dir] of [['king_slam_dust_l', -1], ['king_slam_dust_r', 1]]) {
      const ds = size(key, 150);
      const d = scene.add.image(x + dir * 40, y, key).setOrigin(dir < 0 ? 0.8 : 0.2, 0.85).setScale(ds * 0.5).setDepth(24);
      scene.tweens.add({ targets: d, x: x + dir * 170, scale: ds, alpha: 0, duration: 750, ease: 'Quad.out', onComplete: () => d.destroy() });
    }
  }

  fallAsleep() {
    this.state = 'sleep';
    this.timer = SLEEP_FOR;
    this.zzzTimer = 0.2;
    this.awake.setVisible(false);
    this.sleeping.setVisible(true);
    this.slamArm.setVisible(false);
    this.claw.setVisible(true).setRotation(0);
    // flops down
    this.sleeping.setScale(SLEEP_S * 1.05, SLEEP_S * 0.85);
    this.scene.tweens.add({ targets: this.sleeping, scaleX: SLEEP_S, scaleY: SLEEP_S, duration: 300, ease: 'Back.out' });
  }

  clearCrack() {
    if (!this.crack) return;
    const c = this.crack;
    this.crack = null;
    this.scene.tweens.add({ targets: c, alpha: 0, duration: 600, onComplete: () => c.destroy() });
  }

  wakeUp() {
    this.clearCrack();
    this.state = 'walk';
    this.timer = 1.8 + Math.random();
    this.sleeping.setVisible(false);
    this.awake.setVisible(true);
    this.scene.tweens.add({ targets: this.body, scaleY: BODY_S * 1.1, yoyo: true, duration: 120 });
  }

  // a Z floats up from its head
  zzz() {
    const scene = this.scene;
    const z = scene.add.image(this.x + this.facing * 70, this.ground - 210, 'king_zzz').setScale(0.35).setAlpha(0).setDepth(23);
    if (this.facing < 0) z.setFlipX(true);
    scene.tweens.add({ targets: z, alpha: 1, duration: 250 });
    scene.tweens.add({
      targets: z,
      x: z.x + this.facing * 40,
      y: z.y - 90,
      scale: 0.5,
      duration: 1400,
      ease: 'Sine.out',
      onComplete: () => z.destroy(),
    });
    scene.tweens.add({ targets: z, alpha: 0, duration: 400, delay: 1000 });
  }

  // Is the truck touching it? 'bonk' (landed on it while it's asleep), 'bump' or null.
  hitTest(t, prevBottom, wheelR) {
    if (this.defeated || this.state === 'hurt') return null;
    const dx = Math.abs(t.x - this.x);
    if (dx > this.halfWidth + 120) return null;
    const bottom = t.y + wheelR;
    if (bottom < this.top + 4) return null;
    if (this.state === 'sleep' && !t.grounded) {
      // landed on its shell from above...
      if (prevBottom <= this.top + 40 && dx < this.halfWidth + 70) return 'bonk';
      // ...or jumped a bit early and came down on its edge: still counts
      if (t.vy > 0 && bottom <= this.top + 80) return 'bonk';
    }
    return 'bump';
  }

  // landed on it while it slept: ouch! It wakes up cross.
  bonk() {
    const scene = this.scene;
    this.health -= 1;
    if (this.health <= 0) {
      this.defeat();
      return;
    }
    this.clearCrack();
    this.state = 'hurt';
    this.timer = 1.0;
    this.sleeping.setVisible(false);
    this.awake.setVisible(true);
    const parts = [this.body, this.legs, this.claw, this.backClaw];
    parts.forEach((p) => p.setTint(0xff7070));
    scene.time.delayedCall(300, () => parts.forEach((p) => p.clearTint()));
    scene.tweens.add({ targets: this.body, scaleX: BODY_S * 1.15, scaleY: BODY_S * 0.85, yoyo: true, duration: 110, repeat: 1 });
  }

  defeat() {
    const scene = this.scene;
    this.defeated = true;
    this.state = 'defeated';
    const { x, ground } = this;
    const flip = this.facing < 0;
    this.container.destroy();
    const dizzy = scene.add.image(x, ground + 8, 'king_dizzy').setOrigin(0.5, 1).setDepth(22).setFlipX(flip).setScale(DIZZY_S, DIZZY_S * 0.3);
    scene.tweens.add({ targets: dizzy, scaleY: DIZZY_S, duration: 400, ease: 'Back.out' });
    scene.tweens.add({ targets: dizzy, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut', delay: 400 });
    scene.cameras.main.shake(350, 0.015);
  }
}
