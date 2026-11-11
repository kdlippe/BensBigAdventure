// The monster truck drawing: body, two spinning wheels and two shocks,
// grouped in a container whose origin is the midpoint between the wheel hubs.
// Each wheel has two shocks in a V: their feet stand close together on top of
// the tire and they lean apart as they reach up into the wheel well, tucked
// behind the tire at the bottom and behind the fender at the top.
//
// Looks: 'normal', or 'snorkel' for the underwater level (goggles and a
// snorkel). Both have see-through wheel wells with the shocks behind.

export const WHEEL_R = 62; // wheel radius in game px
export const HALF_BASE = 98; // half the distance between the wheel hubs
const BODY_LIFT = 105; // how far the body sits above the hubs (monster-truck lift!)
const LOOKS = {
  normal: {
    key: 'truck_body',
    scale: 0.32,
    shift: 26, // the body's centre sits a bit ahead of the hub midpoint
    shockTop: 6, // where the shocks attach, measured down from the body centre (behind the fender)
    shockBottom: -WHEEL_R + 10, // the shock's foot, just behind the top of the tire
    shocksInFront: false,
    pipeTips: [{ x: -158, y: -58 }, { x: -110, y: -60 }], // exhaust stack tops (y from the body centre)
    exhaust: { x: -114, y: -78 },
  },
  // truck_body_snorkel.png is drawn smaller and its wheel arches sit 232 px apart (196 in game)
  snorkel: {
    key: 'truck_body_snorkel',
    scale: 0.845,
    shift: 41,
    shockTop: 12, // tucked behind the fender at the top of the wheel well
    shockBottom: -WHEEL_R + 10,
    shocksInFront: false,
    pipeTips: [{ x: -159, y: -66 }, { x: -94, y: -84 }],
    exhaust: { x: -128, y: -84 },
  },
};
const SHOCK_W = 14;
const SHOCK_FOOT = 7; // each foot sits this far either side of the wheel's centre line...
const SHOCK_SPREAD = 26; // ...and each top this far, making the V
const FAR_DX = 24; // far-side wheels sit a little to the right...
const FAR_DY = -6; // ...and a little higher than the near ones
const FAR_TINT = 0x8a8a8a; // and darker, so they read as further away

export class Truck {
  constructor(scene, x, y, look = 'normal') {
    this.scene = scene;
    this.wheelSpin = 0;
    const L = (this.look = LOOKS[look] || LOOKS.normal);

    const wheelScale = (WHEEL_R * 2) / scene.textures.get('wheel').getSourceImage().width;
    // far-side wheels: peek out behind the near ones, a bit darker for depth
    this.farRearWheel = scene.add.image(-HALF_BASE + FAR_DX, FAR_DY, 'wheel').setScale(wheelScale * 0.97).setTint(FAR_TINT);
    this.farFrontWheel = scene.add.image(HALF_BASE + FAR_DX, FAR_DY, 'wheel').setScale(wheelScale * 0.97).setTint(FAR_TINT);
    this.rearWheel = scene.add.image(-HALF_BASE, 0, 'wheel').setScale(wheelScale);
    this.frontWheel = scene.add.image(HALF_BASE, 0, 'wheel').setScale(wheelScale);
    // two shocks per wheel (side -1 leans back, side 1 leans forward)
    this.shocks = [];
    for (const hubX of [-HALF_BASE, HALF_BASE]) {
      for (const side of [-1, 1]) {
        const shock = scene.add.image(hubX + side * SHOCK_FOOT, L.shockBottom, 'strut').setOrigin(0.5, 1);
        shock.hubX = hubX;
        shock.side = side;
        this.shocks.push(shock);
      }
    }
    this.body = scene.add.image(L.shift, -BODY_LIFT, L.key).setScale(L.scale);

    const parts = L.shocksInFront
      ? [this.farRearWheel, this.farFrontWheel, this.rearWheel, this.frontWheel, this.body, ...this.shocks]
      : [
          this.farRearWheel,
          this.farFrontWheel,
          ...this.shocks, // behind the near tires and the body, so both ends tuck in
          this.rearWheel,
          this.frontWheel,
          this.body,
        ];
    this.container = scene.add.container(x, y, parts);
    this.pose(0, 0);
  }

  // squash: how far the suspension is pressed down (px). tilt: extra body rotation.
  pose(squash, tilt) {
    const bodyY = -BODY_LIFT + squash;
    const L = this.look;
    this.body.setPosition(L.shift, bodyY).setRotation(tilt);
    // the shocks squeeze shorter as the body presses down, and stretch as it lifts
    const top = bodyY + L.shockTop;
    const rise = Math.max(12, L.shockBottom - top);
    const lean = SHOCK_SPREAD - SHOCK_FOOT;
    for (const shock of this.shocks) {
      shock.setDisplaySize(SHOCK_W, Math.hypot(rise, lean));
      shock.setRotation(shock.side * Math.atan2(lean, rise)); // top leans out to make the V
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
    const e = this.look.exhaust;
    return { x: e.x, y: -BODY_LIFT + e.y };
  }

  // the tops of the two exhaust stacks, for nitro flames (they follow the body's suspension bounce)
  get pipeTipsLocal() {
    return this.look.pipeTips.map((p) => ({ x: p.x, y: this.body.y + p.y }));
  }

  get centreLocal() {
    return { x: this.look.shift, y: -BODY_LIFT + 20 };
  }
}
