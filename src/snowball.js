// A snowball thrown by an evil snowman (snow level). It's tossed from the
// snowman's hand, drops to the ground and rolls low and fast towards the truck,
// kicking up a trail of snow dust that fades away, so a jump takes the truck
// right over it.
// If it hits the truck it bursts (GameScene decides what a hit does).

const R = 30; // radius on screen
const SPEED = 380; // px per second along the ground
const GRAVITY = 1500;
const RANGE = 1700; // how far it rolls before it melts away
const DUST_EVERY = 0.035; // seconds between puffs of snow dust

export class Snowball {
  constructor(scene, x, y, dir) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.dir = dir; // -1 = rolling left, 1 = rolling right
    this.vx = dir * SPEED;
    this.vy = -260; // a little toss up out of the snowman's hand
    this.travelled = 0;
    this.dustTimer = 0;
    this.dead = false;
    this.r = R;

    const tex = (key) => scene.textures.get(key).getSourceImage();
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

    // snow dust kicked up behind it while it rolls: soft puffs that drift up,
    // spread out and fade away
    const rolling = this.vy === 0;
    this.dustTimer -= dt;
    if (this.dustTimer <= 0) {
      this.dustTimer = DUST_EVERY;
      const scene = this.scene;
      const big = Math.random() < 0.35;
      const puff = scene.add.image(
        this.x - this.dir * Phaser.Math.Between(10, 28),
        this.y + R * (rolling ? 0.75 : 0.2) + Phaser.Math.Between(-6, 4),
        big ? 'puff' : 'snowflake'
      )
        // pale blue-grey, so the dust shows up against the white snow
        .setTint(Math.random() < 0.5 ? 0xc9dae8 : 0xb3c8dc)
        .setScale(big ? 0.16 : Phaser.Math.FloatBetween(2, 3.4))
        .setAlpha(0.9)
        .setDepth(23);
      scene.tweens.add({
        targets: puff,
        x: puff.x - this.dir * Phaser.Math.Between(20, 60),
        y: puff.y - Phaser.Math.Between(18, 46),
        scale: puff.scale * (big ? 2.4 : 2.2),
        alpha: 0,
        duration: Phaser.Math.Between(600, 900),
        ease: 'Quad.out',
        onComplete: () => puff.destroy(),
      });
    }

    if (this.travelled > RANGE) this.melt();
  }

  // rolled far enough: fade away
  melt() {
    this.dead = true;
    this.scene.tweens.add({
      targets: this.ball,
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
  }
}
