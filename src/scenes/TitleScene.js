import { Truck, WHEEL_R } from '../truck.js';
import { sfx } from '../sound.js';
import { requestLandscape } from '../device.js';
import { textStyle, pillButton } from '../style.js';
import { loadProgress, saveProgress } from '../progress.js';
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
    this.add.image(1010, groundY + 10, 'tires').setOrigin(0.5, 1).setScale(0.4).setDepth(9);
    addGround(this, () => groundY, 0, width + 800);
    this.add.image(330, groundY + 8, 'flower').setOrigin(0.5, 1).setScale(0.24).setDepth(12);
    this.add.image(880, groundY + 8, 'mushroom').setOrigin(0.5, 1).setScale(0.22).setDepth(12);

    const truck = new Truck(this, width / 2, groundY - WHEEL_R);
    truck.container.setDepth(30);
    this.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 900,
      repeat: -1,
      onUpdate: (tw) => {
        const v = tw.getValue();
        truck.pose(5 + Math.sin(v) * 5, Math.sin(v * 2) * 0.01);
      },
    });

    const title = this.add.text(width / 2, 90, "Ben's Monster Truck Rally", textStyle(76, '#ffc928')).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.04, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });

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
