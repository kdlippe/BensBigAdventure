import { Truck, WHEEL_R } from '../truck.js';
import { sfx } from '../sound.js';
import { music } from '../music.js';
import { requestLandscape } from '../device.js';
import { textStyle, pillButton } from '../style.js';
import { loadProgress, saveProgress, loadTruck, saveTruck } from '../progress.js';
import { addBackdrop, addGround, SKY } from '../scenery.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(SKY);
    addBackdrop(this);
    const groundY = 560;
    this.add.image(170, groundY + 30, 'tree').setOrigin(0.5, 1).setScale(0.9).setDepth(8);
    this.add.image(1110, groundY + 22, 'bush').setOrigin(0.5, 1).setScale(0.4).setDepth(8);
    this.add.image(1215, groundY + 10, 'tires').setOrigin(0.5, 1).setScale(0.4).setDepth(9);
    addGround(this, () => groundY, 0, width + 800);
    this.add.image(330, groundY + 8, 'flower').setOrigin(0.5, 1).setScale(0.24).setDepth(12);
    this.add.image(width / 2 + 10, groundY + 8, 'mushroom').setOrigin(0.5, 1).setScale(0.22).setDepth(12);

    // pick a truck: both are parked side by side, tap one to drive it. The
    // picked one bounces on its springs; the other waits, a little faded.
    let picked = loadTruck();
    const choices = [
      { n: 1, look: 'normal', x: width / 2 - 250, name: "BEN'S TRUCK", pill: 'pill_blue' },
      { n: 2, look: 'truck2', x: width / 2 + 270, name: 'GHOST TRUCK', pill: 'pill_green' },
    ].map((c) => {
      const truck = new Truck(this, c.x, groundY - WHEEL_R, c.look);
      truck.container.setDepth(30).setScale(0.85);
      truck.container.list.forEach((o) => (o.baseTint = o.tintTopLeft)); // the far wheels are already darker
      // tap anywhere on the truck: the box covers the body and wheels (a container's
      // tap box is measured from the corner of its 420x300 size, not its middle)
      truck.container.setSize(420, 300).setInteractive(new Phaser.Geom.Rectangle(0, -100, 420, 300), Phaser.Geom.Rectangle.Contains);
      truck.container.input.cursor = 'pointer';
      truck.container.on('pointerdown', () => pick(c.n));
      const tag = pillButton(this, c.x, groundY + 95, c.pill, c.name, () => pick(c.n), { scale: 0.62, fontSize: 30, fixed: false });
      tag.parts.forEach((o) => o.setDepth(31));
      return { ...c, truck, tag };
    });
    const show = () => {
      for (const c of choices) {
        const on = c.n === picked;
        // shrunk around the hub midpoint, so lower it to keep the tires on the grass
        const scale = on ? 0.9 : 0.8;
        c.truck.container.setScale(scale).setY(groundY - WHEEL_R * scale);
        // the waiting truck is greyed out (a tint, so its parts don't show through each other)
        c.truck.container.list.forEach((o) => o.setTint(on ? o.baseTint : Phaser.Display.Color.ValueToColor(o.baseTint).darken(45).color));
        c.tag.parts.forEach((o) => o.setAlpha(on ? 1 : 0.6));
      }
    };
    const pick = (n) => {
      if (n !== picked) {
        picked = n;
        saveTruck(n);
        sfx.unlock();
        sfx.button();
      }
      show();
    };
    show();
    this.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 900,
      repeat: -1,
      onUpdate: (tw) => {
        const v = tw.getValue();
        for (const c of choices) {
          if (c.n === picked) c.truck.pose(5 + Math.sin(v) * 5, Math.sin(v * 2) * 0.01);
          else c.truck.pose(0, 0);
        }
      },
    });

    const title = this.add.text(width / 2, 90, "Ben's Monster Truck Rally", textStyle(76, '#ffc928')).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.04, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });

    // the title screen is quiet: the music starts again with the next level
    music.stop();

    let started = false;
    const start = (level) => {
      if (started) return;
      started = true;
      requestLandscape();
      sfx.unlock();
      sfx.button();
      if (level === 1) saveProgress(1); // a new game starts over from level 1
      this.scene.start('Game', { level });
    };

    const reached = loadProgress();
    if (reached <= 1) {
      // first time (or a fresh game): one big GO! button
      const play = this.add.image(width / 2, 210, 'btn_round').setScale(0.9).setInteractive({ useHandCursor: true });
      const label = this.add.text(width / 2, 206, 'GO!', textStyle(46)).setOrigin(0.5);
      this.tweens.add({ targets: [play, label], scale: '+=0.08', yoyo: true, repeat: -1, duration: 500 });
      play.on('pointerdown', () => start(1));
      this.input.keyboard.once('keydown-SPACE', () => start(1));
      this.input.keyboard.once('keydown-ENTER', () => start(1));
    } else {
      // keep going from the level Ben reached, or start a new game
      const keep = pillButton(this, width / 2 + 180, 210, 'pill_green', `LEVEL ${reached}  ▶`, () => start(reached), { fixed: false });
      pillButton(this, width / 2 - 180, 210, 'pill_blue', 'NEW GAME', () => start(1), { scale: 0.85, fixed: false });
      this.tweens.add({ targets: keep.parts, scale: '+=0.05', yoyo: true, repeat: -1, duration: 500 });
      this.input.keyboard.once('keydown-ENTER', () => start(reached));
    }
  }
}
