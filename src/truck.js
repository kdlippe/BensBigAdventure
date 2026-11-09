// The monster truck drawing: body, two spinning wheels and two shock struts,
// grouped in a container whose origin is the midpoint between the wheel hubs.

export const WHEEL_R = 62; // wheel radius in game px
export const HALF_BASE = 98; // half the distance between the wheel hubs
const BODY_SCALE = 0.32;
const BODY_LIFT = 105; // how far the body sits above the hubs (monster-truck lift!)
const BODY_SHIFT = 26; // the body's centre sits a bit ahead of the hub midpoint
const STRUT_TOP = 40; // where the struts attach, measured down from the body centre
const FAR_DX = 24; // far-side wheels sit a little to the right...
const FAR_DY = -6; // ...and a little higher than the near ones
const FAR_TINT = 0x8a8a8a; // and darker, so they read as further away

export class Truck {
  constructor(scene, x, y) {
    this.scene = scene;
    this.wheelSpin = 0;

    const wheelScale = (WHEEL_R * 2) / scene.textures.get('wheel').getSourceImage().width;
    // far-side wheels: peek out behind the near ones, a bit darker for depth
    this.farRearWheel = scene.add.image(-HALF_BASE + FAR_DX, FAR_DY, 'wheel').setScale(wheelScale * 0.97).setTint(FAR_TINT);
    this.farFrontWheel = scene.add.image(HALF_BASE + FAR_DX, FAR_DY, 'wheel').setScale(wheelScale * 0.97).setTint(FAR_TINT);
    this.rearWheel = scene.add.image(-HALF_BASE, 0, 'wheel').setScale(wheelScale);
    this.frontWheel = scene.add.image(HALF_BASE, 0, 'wheel').setScale(wheelScale);
    this.rearStrut = scene.add.image(-HALF_BASE + 6, 0, 'strut').setOrigin(0.5, 0);
    this.frontStrut = scene.add.image(HALF_BASE - 6, 0, 'strut').setOrigin(0.5, 0);
    this.body = scene.add.image(BODY_SHIFT, -BODY_LIFT, 'truck_body').setScale(BODY_SCALE);

    this.container = scene.add.container(x, y, [
      this.farRearWheel,
      this.farFrontWheel,
      this.rearWheel,
      this.frontWheel,
      this.rearStrut,
      this.frontStrut,
      this.body,
    ]);
    this.pose(0, 0);
  }

  // squash: how far the suspension is pressed down (px). tilt: extra body rotation.
  pose(squash, tilt) {
    const bodyY = -BODY_LIFT + squash;
    this.body.setPosition(BODY_SHIFT, bodyY).setRotation(tilt);
    const top = bodyY + STRUT_TOP;
    for (const strut of [this.rearStrut, this.frontStrut]) {
      strut.y = top;
      strut.setDisplaySize(20, Math.max(10, -top));
    }
  }

  spin(distance) {
    this.wheelSpin += distance / WHEEL_R;
    for (const w of [this.rearWheel, this.frontWheel, this.farRearWheel, this.farFrontWheel]) {
      w.rotation = this.wheelSpin;
    }
  }

  // convert a point in truck space (relative to the hub midpoint) to world space
  toWorld(lx, ly) {
    const c = this.container;
    const cos = Math.cos(c.rotation);
    const sin = Math.sin(c.rotation);
    return { x: c.x + lx * cos - ly * sin, y: c.y + lx * sin + ly * cos };
  }

  // handy spots for effects
  get exhaustLocal() {
    return { x: BODY_SHIFT - 140, y: -BODY_LIFT - 78 };
  }

  get centreLocal() {
    return { x: BODY_SHIFT, y: -BODY_LIFT + 20 };
  }
}
