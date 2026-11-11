// Something an enemy throws that rolls along the ground at the truck, so a
// jump takes the truck right over it. If it hits the truck it bursts
// (GameScene decides what a hit does).
//
// Two kinds:
//  'snow': a snowball thrown by an evil snowman (snow level). It spins as it
//          rolls and kicks up a trail of snow dust that fades away.
//  'ink':  a cloud of ink squirted by an octopus (underwater level). It billows
//          as it goes and leaves dark wisps that fade away.

const R = 30; // radius on screen (what the truck's wheels can hit)
const GRAVITY = 1500;
const RANGE = 1700; // how far it goes before it fades away
const DUST_EVERY = 0.035; // seconds between puffs of dust behind it

const KINDS = {
  snow: {
    key: 'snowball',
    size: R * 2, // on screen
    speed: 380, // px per second along the ground
    gravity: 1,
    spin: true,
    dust: [0xc9dae8, 0xb3c8dc], // pale blue-grey, so it shows against the white snow
  },
  rock: {
    key: 'king_rock', // thrown by the King Crab as it winds up (the boss)
    size: 76,
    speed: 360,
    gravity: 1,
    spin: true,
    dust: [0xc49a6c, 0x9c7650],
  },
  ink: {
    key: 'ink_cloud', // drawn with its streak trailing to the right (it goes left)
    size: 104,
    speed: 330,
    gravity: 0.5, // it's underwater
    spin: false,
    dust: [0x3d2f66, 0x2a2147],
  },
};

export class Snowball {
  constructor(scene, x, y, dir, kind = 'snow') {
    this.scene = scene;
    this.kind = kind;
    const K = (this.K = KINDS[kind]);
    this.x = x;
    this.y = y;
    this.dir = dir; // -1 = rolling left, 1 = rolling right
    this.vx = dir * K.speed;
    this.vy = -260; // a little toss up as it's thrown
    this.travelled = 0;
    this.dustTimer = 0;
    this.dead = false;
    this.r = R;

    const tex = (key) => scene.textures.get(key).getSourceImage();
    this.ball = scene.add.image(x, y, K.key).setScale(K.size / tex(K.key).width).setDepth(24);
    if (!K.spin) this.ball.setFlipX(dir > 0);
    this.baseScale = this.ball.scale;
    // pops into view
    this.ball.setScale(this.baseScale * 0.3);
    scene.tweens.add({ targets: this.ball, scale: this.baseScale, duration: 160, ease: 'Back.out' });
  }

  get top() {
    return this.y - R;
  }

  get bottom() {
    return this.y + R;
  }

  update(dt, groundY) {
    if (this.dead) return;
    const K = this.K;
    this.vy += GRAVITY * K.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.travelled += Math.abs(this.vx * dt);
    const floor = groundY(this.x) - R + 4;
    if (this.y > floor) {
      this.y = floor;
      this.vy = this.vy > 200 ? -this.vy * 0.3 : 0; // a small bounce, then it rolls
    }
    this.ball.setPosition(this.x, this.y);
    if (K.spin) {
      this.ball.setRotation(this.ball.rotation + (this.vx / R) * dt);
    } else if (this.travelled > 30) {
      // ink billows: swells and squeezes as it goes
      const w = Math.sin(this.travelled / 22);
      this.ball.setScale(this.baseScale * (1 + w * 0.06), this.baseScale * (1 - w * 0.06));
    }

    // dust (or ink) left behind: soft puffs that drift up, spread out and fade away
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
        .setTint(Phaser.Utils.Array.GetRandom(K.dust))
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

  // went far enough: fade away
  melt() {
    this.dead = true;
    this.scene.tweens.add({
      targets: this.ball,
      alpha: 0,
      duration: 300,
      onComplete: () => this.destroyParts(),
    });
  }

  // hit the truck: burst
  burst() {
    this.dead = true;
    const { scene, x, y } = this;
    this.destroyParts();
    const tex = (key) => scene.textures.get(key).getSourceImage();
    if (this.kind === 'rock') {
      // a puff of dust and the rocks scatter
      for (let i = 0; i < 6; i++) {
        const d = scene.add.image(x, y, 'puff').setTint(0xc49a6c).setScale(0.15).setDepth(41);
        scene.tweens.add({
          targets: d,
          x: x + Phaser.Math.Between(-90, 90),
          y: y - Phaser.Math.Between(20, 90),
          scale: 0.4,
          alpha: 0,
          duration: 500,
          onComplete: () => d.destroy(),
        });
      }
      return;
    }
    if (this.kind === 'ink') {
      // a big splotch of ink that spreads and fades, and splats flying off
      const cloudS = 150 / tex('ink_cloud').width;
      const cloud = scene.add.image(x, y, 'ink_cloud').setScale(cloudS * 0.6).setDepth(41).setFlipX(this.dir > 0);
      scene.tweens.add({ targets: cloud, scale: cloudS * 1.6, alpha: 0, duration: 650, ease: 'Quad.out', onComplete: () => cloud.destroy() });
      const splatS = 46 / tex('ink_splat').width;
      for (const [dx, dy] of [[-80, -60], [70, -70], [-40, -100], [100, -20]]) {
        const s = scene.add.image(x, y, 'ink_splat').setScale(splatS * 0.5).setDepth(41).setFlipX(dx < 0);
        scene.tweens.add({ targets: s, x: x + dx, y: y + dy, scale: splatS, alpha: 0, duration: 550, ease: 'Quad.out', onComplete: () => s.destroy() });
      }
      return;
    }
    // snow: a puff and flying chunks
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
