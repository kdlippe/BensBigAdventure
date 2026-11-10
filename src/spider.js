// The spider enemy (spooky levels): it dangles on a silk thread, slowly
// dropping down to the ground and climbing back up. When it's up high the
// truck can drive underneath; when it's low, jump over it - or land on it to
// squish it (the thread snaps and it drops to the ground, dizzy).
//
// Same interface as the crab: update(), x, top, bottom, halfWidth, squish(), snap().

const S = 0.4; // art scale
const LOW = 95; // body centre this far above the ground at the bottom of its drop
const HIGH = 430; // ...and this far up at the top (the truck fits underneath)
const CYCLE = 3.6; // seconds for one drop-and-climb
const LEG_HIP_Y = 15; // where the leg bunches join the body (below its centre)
const LEGS_BELOW = 85; // legs reach this far below the body centre
const DIZZY_S = 0.36;

export class Spider {
  constructor(scene, { minX, maxX }) {
    this.scene = scene;
    this.x = (minX + maxX) / 2;
    this.halfWidth = 65;
    this.phase = Math.random() * Math.PI * 2;
    this.squished = false;
    this.y = 0;

    // the silk thread hangs from high above, down to the spider's back
    this.thread = scene.add.image(this.x + 18, 0, 'spider_thread').setOrigin(0.5, 1).setDepth(21);
    this.threadW = this.thread.width * 0.3;

    this.legsL = scene.add.image(-25, LEG_HIP_Y, 'spider_legs_left').setOrigin(0.95, 0.38).setScale(S);
    this.legsR = scene.add.image(25, LEG_HIP_Y, 'spider_legs_right').setOrigin(0.04, 0.4).setScale(S);
    this.body = scene.add.image(0, 0, 'spider_body').setScale(S);
    this.container = scene.add.container(this.x, 0, [this.legsL, this.legsR, this.body]).setDepth(22);
  }

  update(dt, time, groundY) {
    if (this.squished) return;
    this.phase += (dt * Math.PI * 2) / CYCLE;
    const g = groundY(this.x);
    // cosine: lingers a little at the top and the bottom of each drop
    const u = 0.5 + 0.5 * Math.cos(this.phase);
    this.y = g - LOW - (HIGH - LOW) * u;
    this.ground = g;
    this.container.setPosition(this.x, this.y);

    // legs paddle, more while it's moving fast
    const wiggle = Math.sin(time / 110) * 0.12 + Math.sin(this.phase) * 0.15;
    this.legsL.setRotation(wiggle);
    this.legsR.setRotation(-wiggle);
    this.body.setRotation(Math.sin(time / 400) * 0.04);

    const anchor = g - 1100; // well above the top of the screen
    const threadBottom = this.y - 35;
    this.thread.setPosition(this.x + 18, threadBottom).setDisplaySize(this.threadW, threadBottom - anchor);
  }

  get top() {
    return this.y - 50;
  }

  get bottom() {
    return this.y + LEGS_BELOW;
  }

  // legs flail (after it bumps the truck)
  snap() {
    this.scene.tweens.add({ targets: [this.legsL, this.legsR], scaleY: S * 0.75, yoyo: true, repeat: 2, duration: 80 });
  }

  squish() {
    this.squished = true;
    const scene = this.scene;
    // the thread snaps and whips away upwards
    scene.tweens.add({ targets: this.thread, y: this.thread.y - 400, alpha: 0, duration: 400, onComplete: () => this.thread.destroy() });
    const x = this.x;
    const ground = this.ground;
    const startY = this.y;
    this.container.destroy();
    // falls to the ground flat and dizzy
    const dizzy = scene.add.image(x, startY + LEGS_BELOW, 'spider_dizzy').setOrigin(0.5, 1).setDepth(22).setScale(DIZZY_S, DIZZY_S * 0.5);
    scene.tweens.add({
      targets: dizzy,
      y: ground + 6,
      duration: Math.max(120, (ground - startY) * 0.9),
      ease: 'Quad.in',
      onComplete: () => {
        scene.tweens.add({ targets: dizzy, scaleY: DIZZY_S * 0.75, duration: 300, ease: 'Back.out' });
        scene.tweens.add({ targets: dizzy, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.inOut' });
      },
    });
    this.dizzy = dizzy;
  }
}
