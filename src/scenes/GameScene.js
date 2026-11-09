import { buildLevel, BOX } from '../level.js';
import { Truck, WHEEL_R, HALF_BASE } from '../truck.js';
import { sfx } from '../sound.js';
import { textStyle } from '../style.js';

// ---- feel knobs (tweak these to make the truck faster, floatier, bouncier) ----
const GRAVITY = 1500;
const MAX_SPEED = 440;
const ACCEL = 520;
const JUMP_SPEED = 720;
const RAMP_BOOST = 460; // extra upward kick when driving off a ramp
const SPRING = 260; // suspension stiffness
const DAMPING = 13; // suspension damping

const OUTLINE = 0x16161a;
const CONFETTI_COLOURS = [0xff5252, 0xffc928, 0x4caf50, 0x42a5f5, 0xab47bc, 0xff9800];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.level = buildLevel();
    const L = this.level.length;
    this.finished = false;
    this.starCount = 0;
    this.starStreak = 0;
    this.streakTimer = 0;
    this.puffTimer = 0;
    this.pebbleTimer = 0;
    this.debris = []; // flying things: pebbles, smashed boxes, confetti

    this.cameras.main.setBackgroundColor('#8fd3f7');
    this.cameras.main.setBounds(0, -700, L, 1420);

    this.drawBackground();
    this.drawGround();

    this.add.image(this.level.finishX, this.level.groundY(this.level.finishX) + 6, 'flag')
      .setOrigin(0.05, 1)
      .setDepth(15);

    this.boxes = this.level.boxes.map((b) => ({
      ...b,
      alive: true,
      img: this.add.image(b.x, b.y, 'box').setDepth(20),
    }));

    this.stars = this.level.stars.map((s, i) => {
      const img = this.add.image(s.x, s.y, 'star').setScale(0.75).setDepth(25);
      this.tweens.add({
        targets: img,
        y: s.y - 10,
        angle: { from: -8, to: 8 },
        yoyo: true,
        repeat: -1,
        duration: 700 + (i % 3) * 120,
        ease: 'Sine.inOut',
      });
      return { ...s, got: false, img };
    });

    // truck state (x = hub midpoint, y = hub height)
    const startX = 300;
    this.t = {
      x: startX,
      y: this.level.groundY(startX) - WHEEL_R,
      vx: 0,
      vy: 0,
      angle: 0,
      grounded: true,
      airTime: 0,
      squash: 0,
      squashV: 0,
      tilt: 0,
    };
    this.truck = new Truck(this, this.t.x, this.t.y);
    this.truck.container.setDepth(30);

    // camera looks a bit ahead of the truck
    this.cameras.main.startFollow(this.truck.container, false, 0.12, 0.08, -260, 90);

    this.setupInput();
    this.drawHud();

    this.events.once('shutdown', () => sfx.engineStop());
  }

  // ------------------------------------------------------------------ drawing

  drawBackground() {
    const L = this.level.length;
    this.add.circle(1110, 110, 62, 0xffd84d).setScrollFactor(0).setDepth(0);

    for (let i = 0; i < 14; i++) {
      this.add.image(150 + i * 520 + (i % 2) * 140, 70 + (i % 3) * 55, 'cloud')
        .setScale(0.5 + (i % 3) * 0.15)
        .setScrollFactor(0.15, 0.05)
        .setDepth(1);
    }

    // far hills
    const far = this.add.graphics().setScrollFactor(0.35, 0.2).setDepth(2);
    const w = L * 0.35 + 1600;
    const pts = [];
    for (let x = 0; x <= w; x += 40) pts.push({ x, y: 430 - 70 * Math.sin(x / 300) - 40 * Math.sin(x / 130 + 2) });
    pts.push({ x: w, y: 1400 }, { x: 0, y: 1400 });
    far.fillStyle(0xa8db8f).fillPoints(pts, true);

    // near hills
    const near = this.add.graphics().setScrollFactor(0.6, 0.4).setDepth(3);
    const w2 = L * 0.6 + 1600;
    const pts2 = [];
    for (let x = 0; x <= w2; x += 40) pts2.push({ x, y: 500 - 50 * Math.sin(x / 220 + 1) - 25 * Math.sin(x / 90) });
    pts2.push({ x: w2, y: 1400 }, { x: 0, y: 1400 });
    near.fillStyle(0x7cc36b).fillPoints(pts2, true);
  }

  drawGround() {
    const pts = this.level.points;
    const g = this.add.graphics().setDepth(10);
    const bottom = 1400;

    // dirt
    g.fillStyle(0x8b5a2b).fillPoints([...pts, { x: pts[pts.length - 1].x, y: bottom }, { x: 0, y: bottom }], true);

    // pebbles in the dirt
    const rnd = new Phaser.Math.RandomDataGenerator(['ben']);
    g.fillStyle(0x6d4320);
    for (let x = 40; x < this.level.length; x += 70) {
      const y = this.level.groundY(x) + 45 + rnd.between(0, 120);
      g.fillEllipse(x + rnd.between(-20, 20), y, rnd.between(12, 26), rnd.between(8, 14));
    }

    // grass strip + thick cartoon outline along the top
    const grass = pts.map((p) => ({ x: p.x, y: p.y + 22 }));
    g.fillStyle(0x5cb85c).fillPoints([...pts, ...grass.reverse()], true);
    g.lineStyle(6, OUTLINE).strokePoints(pts, false);
  }

  drawHud() {
    const total = this.stars.length;

    // star counter
    const panel = this.add.graphics().setScrollFactor(0).setDepth(100);
    panel.fillStyle(OUTLINE).fillRoundedRect(20, 16, 230, 74, 37);
    panel.fillStyle(0xffffff).fillRoundedRect(25, 21, 220, 64, 32);
    this.add.image(62, 53, 'star').setScale(0.6).setScrollFactor(0).setDepth(101);
    this.starText = this.add.text(100, 53, `0 / ${total}`, textStyle(40, '#c98800'))
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101);

    // progress bar to the finish flag
    const bx = 400;
    const bw = 480;
    const bar = this.add.graphics().setScrollFactor(0).setDepth(100);
    bar.fillStyle(OUTLINE).fillRoundedRect(bx - 5, 33, bw + 10, 34, 17);
    bar.fillStyle(0xffffff).fillRoundedRect(bx, 38, bw, 24, 12);
    this.progressFill = this.add.graphics().setScrollFactor(0).setDepth(101);
    this.progressBar = { x: bx, w: bw };
    this.add.image(bx + bw + 10, 52, 'flag').setScale(0.22).setScrollFactor(0).setDepth(102).setOrigin(0.1, 0.9);
    this.progressTruck = this.add.image(bx, 46, 'truck_body').setScale(0.07).setScrollFactor(0).setDepth(103);
  }

  updateHud() {
    const p = Phaser.Math.Clamp((this.t.x - 300) / (this.level.finishX - 300), 0, 1);
    const { x, w } = this.progressBar;
    this.progressFill.clear().fillStyle(0x4caf50).fillRoundedRect(x, 38, Math.max(24, w * p), 24, 12);
    this.progressTruck.x = x + w * p;
  }

  // ------------------------------------------------------------------ input

  setupInput() {
    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,SPACE,A,D,W');
    this.touch = { drive: false, back: false };
    this.jumpQueued = false;

    const hold = (img, flag) => {
      img.setInteractive({ useHandCursor: true });
      const on = () => {
        this.touch[flag] = true;
        img.setScale(0.92);
      };
      const off = () => {
        this.touch[flag] = false;
        img.setScale(1);
      };
      img.on('pointerdown', on);
      img.on('pointerover', (p) => p.isDown && on());
      img.on('pointerup', off);
      img.on('pointerout', off);
    };

    const { width, height } = this.scale;
    const drive = this.add.image(width - 110, height - 105, 'btn_drive').setScrollFactor(0).setDepth(110);
    const back = this.add.image(width - 270, height - 80, 'btn_back').setScrollFactor(0).setDepth(110);
    const jump = this.add.image(110, height - 105, 'btn_jump').setScrollFactor(0).setDepth(110);
    this.add.text(110, height - 78, 'JUMP', textStyle(30)).setOrigin(0.5).setScrollFactor(0).setDepth(111);
    hold(drive, 'drive');
    hold(back, 'back');
    jump.setInteractive({ useHandCursor: true });
    jump.on('pointerdown', () => {
      this.jumpQueued = true;
      jump.setScale(0.92);
    });
    jump.on('pointerup', () => jump.setScale(1));
    jump.on('pointerout', () => jump.setScale(1));
    this.controls = [drive, back, jump];

    for (const k of [this.keys.UP, this.keys.SPACE, this.keys.W]) {
      k.on('down', () => (this.jumpQueued = true));
    }
  }

  // ------------------------------------------------------------------ main loop

  update(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    const t = this.t;
    const ground = this.level.groundY;

    // ---- throttle ----
    let throttle = 0;
    if (!this.finished) {
      if (this.keys.RIGHT.isDown || this.keys.D.isDown || this.touch.drive) throttle = 1;
      else if (this.keys.LEFT.isDown || this.keys.A.isDown || this.touch.back) throttle = -1;
    }

    if (throttle > 0) t.vx = Math.min(MAX_SPEED, t.vx + ACCEL * dt * (t.vx < 0 ? 3 : 1));
    else if (throttle < 0) t.vx = Math.max(-MAX_SPEED * 0.5, t.vx - ACCEL * dt * (t.vx > 0 ? 3 : 1));
    else {
      const drag = (this.finished ? 400 : t.grounded ? 380 : 40) * dt;
      t.vx -= Math.sign(t.vx) * Math.min(Math.abs(t.vx), drag);
    }

    const prevX = t.x;
    t.x = Phaser.Math.Clamp(t.x + t.vx * dt, 150, this.level.length - 200);
    if (t.x === 150 || t.x === this.level.length - 200) t.vx = 0;
    const moved = t.x - prevX;

    // ---- where the ground is under each wheel ----
    const cos = Math.cos(t.angle);
    const rx = t.x - HALF_BASE * cos;
    const fx = t.x + HALF_BASE * cos;
    const yR = ground(rx) - WHEEL_R;
    const yF = ground(fx) - WHEEL_R;
    const groundHubY = (yR + yF) / 2;
    const groundAngle = Math.atan2(yF - yR, fx - rx);

    // ---- jumping ----
    if (this.jumpQueued) {
      this.jumpQueued = false;
      if ((t.grounded || t.airTime < 0.12) && !this.finished) {
        t.grounded = false;
        t.airTime = 0.2;
        t.vy = -JUMP_SPEED;
        t.squashV -= 160;
        sfx.jump();
        this.dustAt(rx, ground(rx), 0.5);
        this.dustAt(fx, ground(fx), 0.5);
      }
    }

    // ---- ramp launch: front wheel driving over a ramp lip gives a big kick ----
    // (the truck may already have lifted off a moment earlier as the front wheel
    // rolls over the edge, so allow a short grace period)
    if ((t.grounded || t.airTime < 0.15) && t.vx > 150 && t.vy > -300) {
      const prevFx = prevX + HALF_BASE * cos;
      for (const r of this.level.ramps) {
        if (prevFx < r.lipX && fx >= r.lipX) {
          t.grounded = false;
          t.vy = -(RAMP_BOOST + t.vx);
          t.airTime = 0.2;
          sfx.launch();
        }
      }
    }

    // ---- vertical motion ----
    if (t.grounded) {
      const followVy = (groundHubY - t.y) / dt;
      const fallVy = t.vy + GRAVITY * dt;
      if (followVy > fallVy + 60) {
        // the ground drops away faster than we'd fall: we're airborne!
        t.grounded = false;
        t.airTime = 0;
        t.vy = fallVy;
        t.y += t.vy * dt;
      } else {
        t.squashV += Math.max(0, followVy - t.vy) * 0.02; // bumps push the body down a little
        // clamp so a sudden step in the ground (e.g. reversing up the back of a
        // ramp) can't turn into a rocket launch on the next frame
        t.vy = Phaser.Math.Clamp(followVy, -450, 1500);
        t.y = groundHubY;
        t.angle = Phaser.Math.Angle.RotateTo(t.angle, groundAngle, 6 * dt);
      }
    } else {
      t.airTime += dt;
      t.vy += GRAVITY * dt;
      t.y += t.vy * dt;
      // nose follows the flight path a little
      const flight = Phaser.Math.Clamp(Math.atan2(t.vy, Math.max(Math.abs(t.vx), 250)) * 0.4, -0.35, 0.35);
      t.angle = Phaser.Math.Angle.RotateTo(t.angle, flight, 1.5 * dt);

      if (t.y >= groundHubY) {
        const impact = Math.max(0, t.vy);
        t.y = groundHubY;
        t.vy = 0;
        t.grounded = true;
        t.airTime = 0;
        if (impact > 250) {
          t.squashV += Math.min(impact, 1400) * 0.2;
          sfx.land(Math.min(1, impact / 1000));
          this.dustAt(rx, ground(rx), 0.9);
          this.dustAt(fx, ground(fx), 0.9);
          if (impact > 800) this.cameras.main.shake(120, 0.006);
        }
      }
    }

    // ---- suspension & body tilt ----
    t.squashV += (-SPRING * t.squash - DAMPING * t.squashV) * dt;
    t.squash = Phaser.Math.Clamp(t.squash + t.squashV * dt, -16, 26);
    const targetTilt = t.grounded ? -throttle * 0.045 : 0;
    t.tilt += (targetTilt - t.tilt) * Math.min(1, 5 * dt);

    // ---- draw the truck ----
    const c = this.truck.container;
    c.setPosition(t.x, t.y).setRotation(t.angle);
    this.truck.pose(t.squash + Math.sin(time / 60) * (throttle ? 0.8 : 0.4), t.tilt);
    this.truck.spin(moved);

    this.effects(dt, throttle, rx);
    this.checkBoxes();
    this.checkStars(dt);
    this.updateDebris(dt);
    this.updateHud();
    sfx.engine(t.vx, throttle !== 0);

    if (!this.finished && t.x >= this.level.finishX) this.finish();
  }

  // ------------------------------------------------------------------ gameplay

  checkBoxes() {
    const t = this.t;
    const left = t.x - 190;
    const right = t.x + 240;
    const top = t.y - 190;
    const bottom = t.y + WHEEL_R;
    let smashed = 0;
    for (const b of this.boxes) {
      if (!b.alive) continue;
      const h = BOX / 2;
      if (b.x + h > left && b.x - h < right && b.y + h > top && b.y - h < bottom) {
        b.alive = false;
        smashed++;
        const dir = t.vx >= 0 ? 1 : -1;
        this.debris.push({
          img: b.img.setDepth(35),
          vx: dir * Phaser.Math.Between(150, 420) + t.vx * 0.6,
          vy: -Phaser.Math.Between(450, 800),
          spin: Phaser.Math.FloatBetween(-8, 8),
          gravity: 1400,
          life: 2.2,
          fade: true,
        });
        for (let i = 0; i < 3; i++) this.pebble(b.x, b.y, 0xd9a15a);
      }
    }
    if (smashed) {
      sfx.crunch();
      this.cameras.main.shake(90, 0.004);
    }
  }

  checkStars(dt) {
    const t = this.t;
    const centre = this.truck.toWorld(this.truck.centreLocal.x, this.truck.centreLocal.y);
    this.streakTimer -= dt;
    if (this.streakTimer <= 0) this.starStreak = 0;

    for (const s of this.stars) {
      if (s.got) continue;
      const dx = s.img.x - centre.x;
      const dy = s.img.y - centre.y;
      if (dx * dx + dy * dy < 120 * 120) {
        s.got = true;
        this.starCount++;
        sfx.star(this.starStreak++);
        this.streakTimer = 1.2;
        this.tweens.killTweensOf(s.img);
        this.tweens.add({
          targets: s.img,
          scale: 1.4,
          alpha: 0,
          y: s.img.y - 60,
          duration: 350,
          onComplete: () => s.img.destroy(),
        });
        const sp = this.add.image(s.img.x, s.img.y, 'sparkle').setScale(0.1).setDepth(40);
        this.tweens.add({
          targets: sp,
          scale: 0.7,
          angle: 90,
          alpha: 0,
          duration: 450,
          onComplete: () => sp.destroy(),
        });
        this.starText.setText(`${this.starCount} / ${this.stars.length}`);
        this.tweens.add({ targets: this.starText, scale: 1.25, yoyo: true, duration: 120 });
      }
    }
  }

  finish() {
    this.finished = true;
    this.touch.drive = this.touch.back = false;
    this.controls.forEach((c) => c.disableInteractive().setAlpha(0.4));
    sfx.fanfare();

    const { width } = this.scale;
    for (let i = 0; i < 140; i++) {
      const img = this.add.image(Phaser.Math.Between(0, width), Phaser.Math.Between(-300, -10), 'confetti')
        .setTint(Phaser.Utils.Array.GetRandom(CONFETTI_COLOURS))
        .setScrollFactor(0)
        .setDepth(150)
        .setRotation(Math.random() * 6);
      this.debris.push({
        img,
        vx: Phaser.Math.Between(-60, 60),
        vy: Phaser.Math.Between(50, 250),
        spin: Phaser.Math.FloatBetween(-6, 6),
        gravity: 120,
        life: 6,
        fade: false,
      });
    }

    this.time.delayedCall(700, () => this.showWinPanel());
  }

  showWinPanel() {
    const { width } = this.scale;
    const g = this.add.graphics().setScrollFactor(0).setDepth(160);
    g.fillStyle(OUTLINE).fillRoundedRect(width / 2 - 300, 130, 600, 380, 40);
    g.fillStyle(0xffffff).fillRoundedRect(width / 2 - 292, 138, 584, 364, 34);

    const parts = [g];
    parts.push(this.add.text(width / 2, 205, 'You did it, Ben!', textStyle(64, '#ff7043')).setOrigin(0.5));
    parts.push(this.add.image(width / 2 - 90, 305, 'star').setScale(1));
    parts.push(this.add.text(width / 2 - 30, 305, `${this.starCount} / ${this.stars.length}`, textStyle(64, '#ffc928')).setOrigin(0, 0.5));

    const again = this.add.image(width / 2, 425, 'btn_round').setScale(0.75).setInteractive({ useHandCursor: true });
    const label = this.add.text(width / 2, 422, 'AGAIN!', textStyle(30)).setOrigin(0.5);
    parts.push(again, label);
    parts.forEach((p) => p.setScrollFactor(0).setDepth(161));
    g.setDepth(160);

    g.setAlpha(0);
    this.tweens.add({ targets: g, alpha: 1, duration: 250 });
    parts.slice(1).forEach((p) => {
      const s = p.scale;
      p.setScale(0.2);
      this.tweens.add({ targets: p, scale: s, duration: 400, ease: 'Back.out' });
    });
    this.tweens.add({ targets: [again, label], scale: '+=0.06', yoyo: true, repeat: -1, duration: 450, delay: 500 });

    const restart = () => {
      sfx.button();
      this.scene.restart();
    };
    again.on('pointerdown', restart);
    this.input.keyboard.once('keydown-SPACE', restart);
    this.input.keyboard.once('keydown-ENTER', restart);
  }

  // ------------------------------------------------------------------ effects

  effects(dt, throttle, rearX) {
    const t = this.t;

    // exhaust puffs: faster when the engine is revving
    this.puffTimer -= dt;
    if (this.puffTimer <= 0 && !this.finished) {
      this.puffTimer = throttle ? 0.14 : 0.45;
      const p = this.truck.toWorld(this.truck.exhaustLocal.x, this.truck.exhaustLocal.y);
      const puff = this.add.image(p.x, p.y, Math.random() < 0.5 ? 'puff' : 'puff2')
        .setScale(0.12)
        .setDepth(29)
        .setAlpha(0.9);
      this.tweens.add({
        targets: puff,
        x: p.x - 50 - Math.abs(t.vx) * 0.15,
        y: p.y - 60,
        scale: 0.32,
        alpha: 0,
        duration: 800,
        onComplete: () => puff.destroy(),
      });
    }

    // dirt flying off the back wheel when accelerating on the ground
    this.pebbleTimer -= dt;
    if (t.grounded && throttle > 0 && t.vx > 80 && this.pebbleTimer <= 0) {
      this.pebbleTimer = 0.07;
      this.pebble(rearX - 30, this.level.groundY(rearX) - 6);
    }
  }

  pebble(x, y, tint = null) {
    const img = this.add.image(x, y, 'pebble').setScale(Phaser.Math.FloatBetween(0.18, 0.32)).setDepth(31);
    if (tint) img.setTint(tint);
    this.debris.push({
      img,
      vx: -Phaser.Math.Between(80, 260),
      vy: -Phaser.Math.Between(150, 380),
      spin: Phaser.Math.FloatBetween(-10, 10),
      gravity: 1200,
      life: 0.9,
      fade: true,
    });
  }

  dustAt(x, y, size) {
    for (const side of [-1, 1]) {
      const d = this.add.image(x, y - 10, 'dust').setScale(0.08 * size).setDepth(32).setFlipX(side < 0);
      this.tweens.add({
        targets: d,
        x: x + side * 60 * size,
        y: y - 30 * size,
        scale: 0.3 * size,
        alpha: 0,
        duration: 600,
        onComplete: () => d.destroy(),
      });
    }
  }

  updateDebris(dt) {
    this.debris = this.debris.filter((d) => {
      d.life -= dt;
      d.vy += d.gravity * dt;
      d.img.x += d.vx * dt;
      d.img.y += d.vy * dt;
      d.img.rotation += d.spin * dt;
      if (d.fade && d.life < 0.5) d.img.setAlpha(Math.max(0, d.life / 0.5));
      if (d.life <= 0) {
        d.img.destroy();
        return false;
      }
      return true;
    });
  }
}
