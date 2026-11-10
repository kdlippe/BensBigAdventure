import { buildLevel, BOX, PIT_BOTTOM } from '../level.js';
import { loadProgress, saveProgress, loadBest, saveBest } from '../progress.js';
import { Truck, WHEEL_R, HALF_BASE } from '../truck.js';
import { sfx } from '../sound.js';
import { requestLandscape } from '../device.js';
import { textStyle, pillButton } from '../style.js';
import { addBackdrop, addGround, addPit, SKY } from '../scenery.js';
import { FLAME_ART } from '../flameArt.js';
import { Crab, CRAB_HALF_WIDTH } from '../crab.js';

// ---- feel knobs (tweak these to make the truck faster, floatier, bouncier) ----
const GRAVITY = 1500;
const MAX_SPEED = 440;
const ACCEL = 520;
const JUMP_SPEED = 720;
const RAMP_BOOST = 460; // extra upward kick when driving off a ramp
const SPRING = 260; // suspension stiffness
const DAMPING = 13; // suspension damping

// ---- nitro ----
const NITRO_SPEED = 820; // top speed while boosting
const NITRO_ACCEL = 1700;
const NITRO_TIME = 3; // seconds per charge
const NITRO_MAX = 3; // most charges you can carry
const NITRO_START = 1; // charges at the start of the level

const BRAKE = 700; // how hard reverse slows you down from nitro speed
const FLAME_DIR = 0.95; // flames shoot up and back from the pipes (radians from straight back)
const FLAME_LENGTH = 150; // how long a nitro flame jet is, in game px
const FIRE_COLOURS = [0xffffff, 0xfff176, 0xffb300, 0xff6d00, 0xd50000];

const MISSED_STAR_PENALTY = 5; // seconds added to your time for each star you didn't collect



const OUTLINE = 0x16161a;
const CONFETTI_COLOURS = [0xff5252, 0xffc928, 0x4caf50, 0x42a5f5, 0xab47bc, 0xff9800];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create(data) {
    this.levelNum = (data && data.level) || loadProgress();
    this.level = buildLevel(this.levelNum);
    this.failed = false;
    const L = this.level.length;
    this.finished = false;
    this.starCount = 0;
    this.starStreak = 0;
    this.streakTimer = 0;
    this.puffTimer = 0;
    this.pebbleTimer = 0;
    this.debris = []; // flying things: pebbles, smashed boxes, confetti
    this.nitro = { charges: NITRO_START, time: 0 };
    this.lineTimer = 0;
    this.elapsed = 0; // race time in seconds
    this.timerOn = false; // starts when Ben first drives

    this.cameras.main.setBackgroundColor(SKY);
    this.cameras.main.setBounds(0, -700, L, 1420);

    this.drawWorld();

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

    this.crabs = this.level.crabs.map((c) => new Crab(this, c));
    this.bumpCooldown = 0;

    this.cans = this.level.nitro.map((n, i) => {
      const img = this.add.image(n.x, n.y, 'nitro').setScale(0.8).setDepth(25);
      this.tweens.add({
        targets: img,
        y: n.y - 12,
        angle: { from: -6, to: 6 },
        yoyo: true,
        repeat: -1,
        duration: 600 + (i % 3) * 90,
        ease: 'Sine.inOut',
      });
      return { ...n, got: false, img };
    });

    // truck state (x = hub midpoint, y = hub height)
    const startX = this.level.startX;
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
    this.makeFire();

    // camera looks a bit ahead of the truck
    this.cameras.main.startFollow(this.truck.container, false, 0.12, 0.08, -260, 90);

    this.setupInput();
    this.drawHud();

    this.events.once('shutdown', () => sfx.engineStop());
  }

  // ------------------------------------------------------------------ drawing

  drawWorld() {
    const lv = this.level;
    this.scrollBackdrop = addBackdrop(this);
    let from = 0;
    for (const p of lv.pits) {
      addGround(this, lv.terrainY, from, p.x0);
      addPit(this, p.x0, p.x1, lv.terrainY(p.x0));
      from = p.x1;
    }
    addGround(this, lv.terrainY, from, lv.length + 400);

    for (const d of lv.decor) {
      this.add.image(d.x, d.y, d.key).setOrigin(0.5, 1).setScale(d.scale).setFlipX(d.flip).setDepth(d.depth);
    }

    for (const r of lv.ramps) {
      this.add.image(r.x, lv.terrainY(r.x) + 4, 'ramp').setOrigin(0, 1).setScale(r.scale).setDepth(14);
    }

    this.add.image(lv.finishX, lv.terrainY(lv.finishX) + 14, 'finish_gate')
      .setOrigin(0.5, 1)
      .setScale(0.95)
      .setDepth(15);
  }

  drawHud() {
    const total = this.stars.length;

    // star counter
    // Size the bubble to the widest the count can get ("44 / 44") in whatever
    // font actually loaded, so it never spills out (tablets can be slow to load
    // the cartoon font and fall back to a wider one).
    this.starText = this.add.text(0, 53, `${total} / ${total}`, textStyle(40, '#c98800'))
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(101);
    const textW = Math.ceil(this.starText.width);
    const inner = 80 + textW + 26;
    this.starText.setText(`0 / ${total}`).setX(25 + 74 + textW / 2);
    const panel = this.add.graphics().setScrollFactor(0).setDepth(100);
    panel.fillStyle(OUTLINE).fillRoundedRect(20, 16, inner + 10, 74, 37);
    panel.fillStyle(0xffffff).fillRoundedRect(25, 21, inner, 64, 32);
    this.add.image(62, 53, 'star').setScale(0.6).setScrollFactor(0).setDepth(101);

    // which level (under the progress bar) and a home button (back to the title)
    const pill = this.add.graphics().setScrollFactor(0).setDepth(100);
    pill.fillStyle(OUTLINE).fillRoundedRect(580, 72, 170, 44, 22);
    pill.fillStyle(0xff7043).fillRoundedRect(584, 76, 162, 36, 18);
    this.add.text(665, 93, `LEVEL ${this.levelNum}`, textStyle(28))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);
    // sits just right of the star bubble (whose width depends on the font), with a gap
    const homeX = 20 + inner + 10 + 18 + 32;
    const home = this.add.image(homeX, 53, 'btn_home').setScrollFactor(0).setDepth(110).setInteractive({ useHandCursor: true });
    home.on('pointerdown', () => {
      sfx.button();
      this.scene.start('Title');
    });
    this.homeBtn = home;

    // progress bar to the finish flag
    const bx = 440;
    const bw = 450;
    const bar = this.add.graphics().setScrollFactor(0).setDepth(100);
    bar.fillStyle(OUTLINE).fillRoundedRect(bx - 5, 33, bw + 10, 34, 17);
    bar.fillStyle(0xffffff).fillRoundedRect(bx, 38, bw, 24, 12);
    this.progressFill = this.add.graphics().setScrollFactor(0).setDepth(101);
    this.progressBar = { x: bx, w: bw };
    this.add.image(bx + bw + 10, 52, 'flag').setScale(0.22).setScrollFactor(0).setDepth(102).setOrigin(0.1, 0.9);
    this.progressTruck = this.add.image(bx, 42, 'truck_icon').setScale(0.19).setScrollFactor(0).setDepth(103);

    // race timer (top right)
    const tp = this.add.graphics().setScrollFactor(0).setDepth(100);
    tp.fillStyle(OUTLINE).fillRoundedRect(1000, 16, 262, 74, 37);
    tp.fillStyle(0xffffff).fillRoundedRect(1005, 21, 252, 64, 32);
    tp.fillStyle(OUTLINE).fillCircle(1044, 53, 22);
    tp.fillStyle(0x90caf9).fillCircle(1044, 53, 17);
    tp.lineStyle(4, OUTLINE).lineBetween(1044, 53, 1044, 41).lineBetween(1044, 53, 1053, 57);
    this.timerText = this.add.text(1158, 53, formatTime(0), textStyle(40, '#1565c0'))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    // nitro charges: a number badge on the nitro button
    const bx2 = this.nitroBtn.x + 52;
    const by2 = this.nitroBtn.y - 52;
    const badge = this.add.graphics().setScrollFactor(0).setDepth(113);
    badge.fillStyle(OUTLINE).fillCircle(bx2, by2, 26);
    badge.fillStyle(0xffffff).fillCircle(bx2, by2, 21);
    this.nitroCount = this.add.text(bx2, by2 + 1, String(this.nitro.charges), textStyle(32, '#e53935'))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(114);
    this.nitroRing = this.add.graphics().setScrollFactor(0).setDepth(112);
  }

  updateHud() {
    const p = Phaser.Math.Clamp((this.t.x - 300) / (this.level.finishX - 300), 0, 1);
    const { x, w } = this.progressBar;
    this.progressFill.clear().fillStyle(0x4caf50).fillRoundedRect(x, 38, Math.max(24, w * p), 24, 12);
    this.progressTruck.x = x + w * p;

    this.timerText.setText(formatTime(this.finished ? this.totalTime : this.elapsed));

    const n = this.nitro;
    if (this.nitroCount.text !== String(n.charges)) this.nitroCount.setText(String(n.charges));
    if (n.charges > 0 || n.time > 0) this.nitroBtn.clearTint();
    else this.nitroBtn.setTint(0x9e9e9e); // greyed out when empty
    this.nitroRing.clear();
    if (n.time > 0) {
      const { x: bx, y: by } = this.nitroBtn;
      this.nitroRing.lineStyle(10, 0xffe680);
      this.nitroRing.beginPath();
      this.nitroRing.arc(bx, by, 76, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (n.time / NITRO_TIME));
      this.nitroRing.strokePath();
    }
  }

  // ------------------------------------------------------------------ input

  setupInput() {
    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,SPACE,A,D,W,SHIFT,N');
    this.touch = { drive: false, back: false };
    this.jumpQueued = false;
    this.nitroQueued = false;

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
    const nitro = this.add.image(290, height - 92, 'btn_nitro').setScrollFactor(0).setDepth(110);
    nitro.setInteractive({ useHandCursor: true });
    nitro.on('pointerdown', () => {
      this.nitroQueued = true;
      nitro.setScale(0.92);
    });
    nitro.on('pointerup', () => nitro.setScale(1));
    nitro.on('pointerout', () => nitro.setScale(1));
    this.nitroBtn = nitro;
    this.controls = [drive, back, jump, nitro];
    for (const k of [this.keys.SHIFT, this.keys.N]) {
      k.on('down', () => (this.nitroQueued = true));
    }

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
    if (!this.finished && !t.inPit) {
      if (this.keys.RIGHT.isDown || this.keys.D.isDown || this.touch.drive) throttle = 1;
      else if (this.keys.LEFT.isDown || this.keys.A.isDown || this.touch.back) throttle = -1;
    }

    // ---- nitro: a charge gives NITRO_TIME seconds of full-speed boost ----
    const n = this.nitro;
    if (this.nitroQueued) {
      this.nitroQueued = false;
      if (!this.finished && n.time <= 0) {
        if (n.charges > 0) this.startNitro();
        else {
          sfx.empty();
          this.tweens.add({ targets: this.nitroBtn, x: '+=8', yoyo: true, repeat: 2, duration: 40 });
        }
      }
    }
    if (n.time > 0) {
      n.time = Math.max(0, n.time - dt);
      if (!this.finished) {
        // reverse cancels the boost (and brakes below); otherwise boosting drives forward
        if (throttle < 0) n.time = 0;
        else throttle = 1;
      }
    }
    const boosting = n.time > 0;
    const topSpeed = boosting ? NITRO_SPEED : MAX_SPEED;

    // ---- timer: starts the first time Ben drives ----
    if (!this.timerOn && throttle !== 0 && !this.finished) this.timerOn = true;
    if (this.timerOn && !this.finished) this.elapsed += dt;

    if (throttle > 0) {
      if (t.vx > topSpeed) t.vx = Math.max(topSpeed, t.vx - 350 * dt); // ease down after a boost
      else t.vx = Math.min(topSpeed, t.vx + (boosting ? NITRO_ACCEL : ACCEL) * dt * (t.vx < 0 ? 3 : 1));
    }
    else if (throttle < 0) {
      if (t.vx > 0) {
        // braking: smooth from nitro speed, then firm, down to a stop
        t.vx = Math.max(0, t.vx - (t.vx > MAX_SPEED ? BRAKE : BRAKE * 1.6) * dt);
        this.skid(dt);
      } else {
        t.vx = Math.max(-MAX_SPEED * 0.5, t.vx - ACCEL * dt);
      }
    }
    else {
      const drag = (this.finished ? 400 : t.grounded ? 380 : 40) * dt;
      t.vx -= Math.sign(t.vx) * Math.min(Math.abs(t.vx), drag);
    }

    const prevX = t.x;
    const prevBottom = t.y + WHEEL_R; // bottom of the wheels before moving (for landing on crabs)
    t.x = Phaser.Math.Clamp(t.x + t.vx * dt, 150, this.level.length - 200);
    if (t.x === 150 || t.x === this.level.length - 200) t.vx = 0;
    const moved = t.x - prevX;

    // ---- where the ground is under each wheel ----
    const cos = Math.cos(t.angle);
    const rx = t.x - HALF_BASE * cos;
    const fx = t.x + HALF_BASE * cos;
    // Over a pit a wheel has nothing under it. If only one wheel is over the
    // pit, the other one holds the truck up; with both over it, it falls.
    const sR = this.level.isPit(rx) ? null : ground(rx);
    const sF = this.level.isPit(fx) ? null : ground(fx);
    const overPit = sR === null && sF === null;
    const yR = (t.inPit || overPit ? PIT_BOTTOM : sR ?? sF) - WHEEL_R;
    const yF = (t.inPit || overPit ? PIT_BOTTOM : sF ?? sR) - WHEEL_R;
    const groundHubY = (yR + yF) / 2;
    const groundAngle = Math.atan2(yF - yR, fx - rx);

    // ---- jumping ----
    if (this.jumpQueued) {
      this.jumpQueued = false;
      if ((t.grounded || t.airTime < 0.12) && !this.finished && !t.inPit) {
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
    if ((t.grounded || t.airTime < 0.6) && t.vx > 150 && t.vy > -RAMP_BOOST) {
      const prevFx = prevX + HALF_BASE * cos;
      for (const r of this.level.ramps) {
        if (prevFx < r.lipX && fx >= r.lipX) {
          t.grounded = false;
          t.vy = -(RAMP_BOOST + Math.min(t.vx, MAX_SPEED + 150)); // nitro adds a little, not a lot
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

    if (!t.inPit && overPit && !t.grounded && t.y > this.level.surfaceY(t.x) - WHEEL_R + 20) {
      t.inPit = true; // too low to reach the other side: down we go
      this.nitro.time = 0;
    }
    if (t.inPit) {
      t.vx *= Math.pow(0.02, dt); // slide to a stop against the pit walls
      if (!this.failed && t.y > this.level.surfaceY(t.x) + 260) this.fail();
    }

    this.updateCrabs(dt, time, prevBottom);

    // ---- suspension & body tilt ----
    t.squashV += (-SPRING * t.squash - DAMPING * t.squashV) * dt;
    t.squash = Phaser.Math.Clamp(t.squash + t.squashV * dt, -16, 26);
    const targetTilt = t.grounded ? -throttle * (boosting ? 0.09 : 0.045) : 0;
    t.tilt += (targetTilt - t.tilt) * Math.min(1, 5 * dt);

    // ---- draw the truck ----
    const c = this.truck.container;
    c.setPosition(t.x, t.y).setRotation(t.angle);
    this.truck.pose(t.squash + Math.sin(time / 60) * (throttle ? 0.8 : 0.4), t.tilt);
    this.truck.spin(moved);

    this.effects(dt, throttle, rx);
    this.updateFire(boosting);
    if (boosting) this.nitroEffects(dt);
    this.checkBoxes();
    this.checkStars(dt);
    this.checkNitro();
    this.updateDebris(dt);
    this.updateHud();
    this.scrollBackdrop(this.cameras.main.scrollX);
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
        this.tweens.add({ targets: this.starText, scale: 1.15, yoyo: true, duration: 120 });
      }
    }
  }

  // Crabs walk about; land on one to squish it, drive into one and it bumps you back.
  updateCrabs(dt, time, prevBottom) {
    const t = this.t;
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    for (const c of this.crabs) {
      c.update(dt, time, this.level.groundY);
      if (c.squished || this.finished) continue;
      const overlapX = c.x + CRAB_HALF_WIDTH > t.x - 150 && c.x - CRAB_HALF_WIDTH < t.x + 150;
      const bottom = t.y + WHEEL_R;
      if (!overlapX || bottom < c.top) continue;
      if (t.vy > 0 && prevBottom <= c.top + 30) this.squishCrab(c);
      else if (this.bumpCooldown <= 0) this.bumpCrab(c);
    }
  }

  squishCrab(c) {
    const t = this.t;
    c.squish();
    this.crabsSquished = (this.crabsSquished || 0) + 1;
    t.vy = -560; // boing!
    t.grounded = false;
    t.airTime = 0.2;
    t.squashV += 180;
    sfx.squish();
    this.dustAt(c.x, this.level.groundY(c.x), 1);
    this.cameras.main.shake(120, 0.005);
  }

  bumpCrab(c) {
    const t = this.t;
    const away = t.x < c.x ? -1 : 1;
    t.vx = away * 300;
    t.vy = -380;
    t.grounded = false;
    t.airTime = 0.2;
    this.nitro.time = 0; // a crab pinch ends the boost
    this.bumpCooldown = 0.8;
    c.snap();
    sfx.bump();
    this.cameras.main.shake(150, 0.008);
  }

  startNitro() {
    const n = this.nitro;
    n.charges--;
    n.time = NITRO_TIME;
    sfx.boost();
    this.cameras.main.shake(200, 0.005);
    this.t.squashV -= 120;
  }

  checkNitro() {
    const centre = this.truck.toWorld(this.truck.centreLocal.x, this.truck.centreLocal.y);
    for (const c of this.cans) {
      if (c.got) continue;
      const dx = c.img.x - centre.x;
      const dy = c.img.y - centre.y;
      if (dx * dx + dy * dy < 115 * 115) {
        c.got = true;
        this.nitro.charges = Math.min(NITRO_MAX, this.nitro.charges + 1);
        sfx.nitroPickup();
        this.tweens.killTweensOf(c.img);
        this.tweens.add({
          targets: c.img,
          scale: 1.4,
          alpha: 0,
          y: c.img.y - 70,
          duration: 400,
          onComplete: () => c.img.destroy(),
        });
        this.tweens.add({ targets: this.nitroCount, scale: 1.6, yoyo: true, duration: 160 });
        const sp = this.add.image(c.img.x, c.img.y, 'sparkle').setScale(0.1).setDepth(40).setTint(0xff8a65);
        this.tweens.add({ targets: sp, scale: 0.8, angle: 90, alpha: 0, duration: 450, onComplete: () => sp.destroy() });
      }
    }
  }

  finish() {
    this.finished = true;
    this.nitro.time = 0;
    this.missed = this.stars.length - this.starCount;
    this.penalty = this.missed * MISSED_STAR_PENALTY;
    this.totalTime = this.elapsed + this.penalty;
    this.newBest = false;
    this.best = loadBest(this.levelNum);
    if (this.best === null || this.totalTime < this.best) {
      this.newBest = this.best !== null; // the very first finish just sets the record
      this.best = this.totalTime;
      saveBest(this.levelNum, this.totalTime);
    }
    if (this.levelNum < this.level.count) saveProgress(Math.max(loadProgress(), this.levelNum + 1));
    this.touch.drive = this.touch.back = false;
    this.controls.forEach((c) => c.disableInteractive().setAlpha(0.4));
    this.homeBtn.disableInteractive();
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
    g.fillStyle(OUTLINE).fillRoundedRect(width / 2 - 330, 80, 660, 560, 40);
    g.fillStyle(0xffffff).fillRoundedRect(width / 2 - 322, 88, 644, 544, 34);

    const parts = [g];
    const last = this.levelNum >= this.level.count;
    const heading = last ? 'You beat all 5 levels, Ben!' : `Level ${this.levelNum} done, Ben!`;
    const head = this.add.text(width / 2, 145, heading, textStyle(56, '#ff7043')).setOrigin(0.5);
    if (head.width > 600) head.setScale(600 / head.width);
    parts.push(head);
    parts.push(this.add.image(width / 2 - 90, 220, 'star').setScale(0.8));
    parts.push(this.add.text(width / 2 - 40, 220, `${this.starCount} / ${this.stars.length}`, textStyle(54, '#ffc928')).setOrigin(0, 0.5));

    // drive time + missed-star penalty = total
    parts.push(this.add.text(width / 2, 285, `Drive time  ${formatTime(this.elapsed)}`, textStyle(34, '#546e7a')).setOrigin(0.5));
    const penaltyText = this.missed > 0
      ? `+${this.penalty} sec for ${this.missed} missed star${this.missed === 1 ? '' : 's'}`
      : 'All the stars! No time added';
    parts.push(this.add.text(width / 2, 330, penaltyText, textStyle(30, this.missed > 0 ? '#e53935' : '#43a047')).setOrigin(0.5));
    parts.push(this.add.text(width / 2, 392, `Total  ${formatTime(this.totalTime)}`, textStyle(56, '#1565c0')).setOrigin(0.5));
    if (this.newBest) {
      const nb = this.add.text(width / 2, 455, 'NEW BEST TIME!', textStyle(42, '#43a047')).setOrigin(0.5);
      parts.push(nb);
      this.tweens.add({ targets: nb, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 300, delay: 400 });
      sfx.record();
    } else {
      parts.push(this.add.text(width / 2, 455, `Best  ${formatTime(this.best)}`, textStyle(34, '#78909c')).setOrigin(0.5));
    }

    parts.forEach((p) => p.setScrollFactor(0).setDepth(161));
    g.setDepth(160);

    g.setAlpha(0);
    this.tweens.add({ targets: g, alpha: 1, duration: 250 });
    parts.slice(1).forEach((p) => {
      const sc = p.scale;
      p.setScale(0.2);
      this.tweens.add({ targets: p, scale: sc, duration: 400, ease: 'Back.out' });
    });

    // buttons: NEXT LEVEL (or NEW GAME after the last level) and AGAIN
    let busy = false;
    const go = (level) => {
      if (busy) return;
      busy = true;
      requestLandscape();
      sfx.button();
      if (last && level === 1) saveProgress(1);
      this.scene.restart({ level });
    };
    const primaryLevel = last ? 1 : this.levelNum + 1;
    const primary = pillButton(this, width / 2 + 120, 560, 'pill_green', last ? 'NEW GAME' : 'NEXT LEVEL', () => go(primaryLevel), { scale: 0.8 });
    const again = pillButton(this, width / 2 - 140, 560, 'pill_blue', 'AGAIN', () => go(this.levelNum), { scale: 0.62, fontSize: 32 });
    [...primary.parts, ...again.parts].forEach((p) => p.setDepth(162));
    this.tweens.add({ targets: primary.parts, scale: '+=0.05', yoyo: true, repeat: -1, duration: 450, delay: 500 });
    this.input.keyboard.once('keydown-ENTER', () => go(primaryLevel));
  }

  // Fell in a pit: try the level again.
  fail() {
    this.failed = true;
    this.finished = true; // stops the timer and the controls
    this.totalTime = this.elapsed;
    this.touch.drive = this.touch.back = false;
    this.controls.forEach((c) => c.disableInteractive().setAlpha(0.4));
    sfx.fall();
    this.time.delayedCall(500, () => {
      const { width } = this.scale;
      const g = this.add.graphics().setScrollFactor(0).setDepth(160);
      g.fillStyle(OUTLINE).fillRoundedRect(width / 2 - 300, 180, 600, 330, 40);
      g.fillStyle(0xffffff).fillRoundedRect(width / 2 - 292, 188, 584, 314, 34);
      const t1 = this.add.text(width / 2, 260, 'Oops! Into the pit!', textStyle(54, '#ff7043')).setOrigin(0.5);
      const t2 = this.add.text(width / 2, 330, 'Jump over the hole next time', textStyle(30, '#546e7a')).setOrigin(0.5);
      [t1, t2].forEach((o) => o.setScrollFactor(0).setDepth(161));
      let busy = false;
      const retry = () => {
        if (busy) return;
        busy = true;
        requestLandscape();
        sfx.button();
        this.scene.restart({ level: this.levelNum });
      };
      const btn = pillButton(this, width / 2, 430, 'pill_green', 'TRY AGAIN', retry, { scale: 0.85 });
      btn.parts.forEach((o) => o.setDepth(162));
      this.tweens.add({ targets: btn.parts, scale: '+=0.05', yoyo: true, repeat: -1, duration: 450 });
      this.input.keyboard.once('keydown-ENTER', retry);
      this.input.keyboard.once('keydown-SPACE', retry);
    });
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

  nitroEffects(dt) {
    // speed lines rushing past
    this.lineTimer -= dt;
    if (this.lineTimer <= 0) {
      this.lineTimer = 0.045;
      const y = Phaser.Math.Between(120, 560);
      const l = this.add.image(1300, y, 'speedline')
        .setScrollFactor(0)
        .setDepth(90)
        .setAlpha(0.75)
        .setScale(Phaser.Math.FloatBetween(0.6, 1.4), 1);
      this.tweens.add({ targets: l, x: -200, duration: 260, onComplete: () => l.destroy() });
    }
  }

  // Two flame jets (one per exhaust pipe) plus a stream of fire particles
  // that cool from white -> yellow -> orange -> red as they fly off.
  makeFire() {
    this.jets = [0, 1].map(() =>
      this.add.image(0, 0, 'flame_jet').setOrigin(FLAME_ART.originX, FLAME_ART.originY).setDepth(29).setVisible(false)
    );
    this.jetScale = FLAME_LENGTH / FLAME_ART.width;
    this.fireAngle = 0;
    this.fire = this.add.particles(0, 0, 'flare', {
      emitting: false,
      lifespan: { min: 220, max: 420 },
      speed: { min: 220, max: 380 },
      angle: { onEmit: () => this.fireAngle + Phaser.Math.Between(-14, 14) },
      scale: { start: 0.75, end: 0.15 },
      alpha: { start: 1, end: 0 },
      color: FIRE_COLOURS,
      colorEase: 'quad.out',
    }).setDepth(28);
  }

  updateFire(boosting) {
    const on = boosting && !this.finished;
    this.jets.forEach((j) => j.setVisible(on));
    if (!on) return;
    const dir = this.t.angle + FLAME_DIR; // rotation that points the flame up and back
    // particle angle in degrees: the flame texture points left, i.e. 180 deg
    this.fireAngle = Phaser.Math.RadToDeg(dir) + 180;
    this.truck.pipeTipsLocal.forEach((tip, i) => {
      const p = this.truck.toWorld(tip.x, tip.y);
      this.jets[i]
        .setPosition(p.x, p.y)
        .setRotation(dir + Phaser.Math.FloatBetween(-0.08, 0.08))
        .setScale(this.jetScale * Phaser.Math.FloatBetween(0.8, 1.1), this.jetScale * Phaser.Math.FloatBetween(0.85, 1.05))
        .setFlipY(Math.random() < 0.5); // flipping the art each frame makes it flicker
      this.fire.emitParticleAt(p.x, p.y, 2);
    });
  }

  skid(dt) {
    const t = this.t;
    if (!t.grounded || t.vx < 120) return;
    this.skidTimer = (this.skidTimer || 0) - dt;
    if (this.skidTimer > 0) return;
    this.skidTimer = 0.06;
    const cos = Math.cos(t.angle);
    for (const wx of [t.x - HALF_BASE * cos, t.x + HALF_BASE * cos]) {
      const gy = this.level.groundY(wx);
      const d = this.add.image(wx + 20, gy - 8, 'dust').setScale(0.07).setDepth(32).setAlpha(0.9);
      this.tweens.add({
        targets: d,
        x: wx + 60 + t.vx * 0.1,
        y: gy - 40,
        scale: 0.22,
        alpha: 0,
        duration: 500,
        onComplete: () => d.destroy(),
      });
    }
    if (!this.skidSound || this.skidSound < this.time.now) {
      sfx.skid();
      this.skidSound = this.time.now + 350;
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

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
