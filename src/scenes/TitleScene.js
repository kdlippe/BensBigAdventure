import { Truck, WHEEL_R } from '../truck.js';
import { sfx } from '../sound.js';
import { textStyle } from '../style.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#8fd3f7');

    this.add.circle(1120, 110, 60, 0xffd84d);
    this.add.image(220, 120, 'cloud').setScale(0.8);
    this.add.image(760, 80, 'cloud').setScale(0.6);

    const g = this.add.graphics();
    g.fillStyle(0xa8db8f).fillEllipse(300, 560, 900, 260).fillEllipse(1050, 580, 900, 240);
    g.fillStyle(0x8b5a2b).fillRect(0, 560, width, 160);
    g.fillStyle(0x5cb85c).fillRect(0, 548, width, 28);
    g.fillStyle(0x16161a).fillRect(0, 544, width, 6);

    const truck = new Truck(this, width / 2, 548 - WHEEL_R);
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

    const play = this.add.image(width / 2, 210, 'btn_round').setScale(0.9).setInteractive({ useHandCursor: true });
    const label = this.add.text(width / 2, 206, 'GO!', textStyle(46)).setOrigin(0.5);
    this.tweens.add({ targets: [play, label], scale: '+=0.08', yoyo: true, repeat: -1, duration: 500 });

    const go = () => {
      sfx.unlock();
      sfx.button();
      this.scene.start('Game');
    };
    play.on('pointerdown', go);
    this.input.keyboard.once('keydown-SPACE', go);
    this.input.keyboard.once('keydown-ENTER', go);
  }
}
