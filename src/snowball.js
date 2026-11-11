// A snowball thrown by a snow spider (snow level). It's tossed from the
// spider's body, drops to the ground and rolls low and fast towards the truck
// with a frosty streak behind it, so a jump takes the truck right over it.
// If it hits the truck it bursts (GameScene decides what a hit does).

const R = 30; // radius on screen
const SPEED = 380; // px per second along the ground
const GRAVITY = 1500;
const RANGE = 1700; // how far it rolls before it melts away
const TRAIL_W = 230; // the streak's length on screen
const WISPS = ['snow_wisp1', 'snow_wisp2', 'snow_wisp3'];

export class Snowball {
  constructor(scene, x, y, dir) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.dir = dir; // -1 = rolling left, 1 = rolling right
    this.vx = dir * SPEED;
    this.vy = -260; // a little toss up out of the spider's legs
    this.travelled = 0;
    this.wispTimer = 0;
    this.dead = false;
    this.r = R;

    const tex = (key) => scene.textures.get(key).getSourceImage();
    // the streak's pointed end sits on the ball; the swirls stream out behind
    this.trail = scene.add.image(x, y, 'snowball_trail')
      .setScale(TRAIL_W / tex('snowball_trail').width)
      .setOrigin(dir < 0 ? 0.05 : 0.95, 0.68)
      .setFlipX(dir > 0)
      .setAlpha(0.9)
      .setDepth(23);
    this.ball = scene.add.image(x, y, 'snowball').setScale((R * 2) / tex('snowball').width).setDepth(24);
    // pops into view
    const s = this.ball.scale;
    this.ball.setScale(s * 0.3);
    scene.tweens.add({ targets: this.ball, scale: s, duration: 160, ease: 'Back.out' });
  }

  get top() {
    return this.y - R;
  }

  get bottom() {
    return this.y + R;
  }

  update(dt, groundY) {
    if (this.dead) return;
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.travelled += Math.abs(this.vx * dt);
    const floor = groundY(this.x) - R + 4;
    if (this.y > floor) {
      this.y = floor;
      this.vy = this.vy > 200 ? -this.vy * 0.3 : 0; // a small bounce, then it rolls
    }
    this.ball.setPosition(this.x, this.y).setRotation(this.ball.rotation + (this.vx / R) * dt);
    this.trail.setPosition(this.x - this.dir * R * 0.2, this.y + 6);
    this.trail.setScale(this.trail.scaleX, this.trail.scaleX * (1 + Math.sin(this.travelled / 40) * 0.06));

    // little puffs of snow left behind
    this.wispTimer -= dt;
    if (this.wispTimer <= 0) {
      this.wispTimer = 0.12;
      const w = this.scene.add.image(this.x - this.dir * 60, this.y + Phaser.Math.Between(-10, 14), Phaser.Utils.Array.GetRandom(WISPS))
        .setScale(0.22)
        .setFlipX(this.dir > 0)
        .setAlpha(0.8)
        .setDepth(22);
      this.scene.tweens.add({
        targets: w,
        x: w.x - this.dir * 50,
        y: w.y - 20,
        alpha: 0,
        scale: 0.3,
        duration: 500,
        onComplete: () => w.destroy(),
      });
    }

    if (this.travelled > RANGE) this.melt();
  }

  // rolled far enough: fade away
  melt() {
    this.dead = true;
    this.scene.tweens.add({
      targets: [this.ball, this.trail],
      alpha: 0,
      duration: 300,
      onComplete: () => this.destroyParts(),
    });
  }

  // hit the truck: burst into a puff and flying chunks
  burst() {
    this.dead = true;
    const { scene, x, y } = this;
    this.destroyParts();
    const tex = (key) => scene.textures.get(key).getSourceImage();
    const poofS = 130 / tex('snowball_poof').width;
    const poof = scene.add.image(x, y, 'snowball_poof').setScale(poofS * 0.5).setDepth(41);
    scene.tweens.add({ targets: poof, scale: poofS * 1.3, alpha: 0, duration: 450, ease: 'Quad.out', onComplete: () => poof.destroy() });
    const bitsS = 150 / tex('snowball_bits').width;
    for (const side of [-1, 1]) {
      const bits = scene.add.image(x, y, 'snowball_bits').setScale(bitsS * 0.6).setFlipX(side < 0).setDepth(41);
      scene.tweens.add({
        targets: bits,
        x: x + side * 90,
        y: y - 50,
        scale: bitsS,
        alpha: 0,
        duration: 500,
        ease: 'Quad.out',
        onComplete: () => bits.destroy(),
      });
    }
  }

  destroyParts() {
    this.ball.destroy();
    this.trail.destroy();
  }
}
