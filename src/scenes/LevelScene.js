// Pick a level: after picking a truck on the title screen, Ben taps one of the
// six levels. Each card shows the level's backdrop, its creature and its name;
// a level he has finished gets a star and his best time, and the next one to
// play bounces. Every level can be played (no locks).

import { sfx } from '../sound.js';
import { requestLandscape } from '../device.js';
import { textStyle, formatTime } from '../style.js';
import { loadProgress, loadBest } from '../progress.js';
import { addBackdrop, SKY } from '../scenery.js';
import { LEVELS } from '../level.js';

const OUTLINE = 0x16161a;
const CARD_W = 340;
const CARD_H = 240;
const PIC_H = 170; // the backdrop picture at the top of the card; the name goes below
const CARDS = [
  { name: 'Sunny Meadow', bg: 'background', who: 'crab_body', whoH: 70 },
  { name: 'Spooky Night', bg: 'background_spooky', who: 'spider_body', whoH: 70 },
  { name: 'Desert Canyon', bg: 'background_desert', who: 'snake_body', whoH: 90 },
  { name: 'Snowy Mountains', bg: 'background_snow', who: 'snowman_body', whoH: 120 },
  { name: 'Under the Sea', bg: 'background_sea', who: 'puffer', whoH: 75 },
  { name: 'King Crab!', bg: 'background', who: 'king_body', whoH: 120, boss: true },
];

export class LevelScene extends Phaser.Scene {
  constructor() {
    super('Levels');
  }

  create() {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(SKY);
    addBackdrop(this);
    // dim the backdrop a little so the cards stand out
    this.add.rectangle(0, 0, width, this.scale.height, 0x0b2a3a, 0.25).setOrigin(0);

    const title = this.add.text(width / 2, 70, 'Pick a level!', textStyle(64, '#ffc928')).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.04, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });

    // back to the truck picker
    const back = this.add.image(60, 60, 'btn_home').setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      sfx.button();
      this.scene.start('Title');
    });

    const reached = loadProgress();
    let started = false;
    const start = (level) => {
      if (started) return;
      started = true;
      requestLandscape();
      sfx.unlock();
      sfx.button();
      this.scene.start('Game', { level });
    };

    CARDS.slice(0, LEVELS.length).forEach((c, i) => {
      const level = i + 1;
      const x = width / 2 + ((i % 3) - 1) * (CARD_W + 40);
      const y = 255 + Math.floor(i / 3) * (CARD_H + 40);
      const card = this.makeCard(c, level, level < reached || loadBest(level) !== null);
      card.setPosition(x, y);
      card.on('pointerdown', () => {
        card.setScale(0.95);
        start(level);
      });
      card.on('pointerout', () => level !== reached && card.setScale(1));
      if (level === reached) {
        // the next level to play bounces
        this.tweens.add({ targets: card, scale: 1.06, yoyo: true, repeat: -1, duration: 550, ease: 'Sine.inOut' });
      }
    });

    // keyboard: Enter plays the next level
    this.input.keyboard.once('keydown-ENTER', () => start(reached));
    this.input.keyboard.once('keydown-SPACE', () => start(reached));
  }

  makeCard(c, level, done) {
    const left = -CARD_W / 2;
    const top = -CARD_H / 2;
    const parts = [];

    // the card: dark outline, white face
    const g = this.add.graphics();
    g.fillStyle(OUTLINE).fillRoundedRect(left - 6, top - 6, CARD_W + 12, CARD_H + 12, 26);
    g.fillStyle(c.boss ? 0xff7043 : 0xffffff).fillRoundedRect(left, top, CARD_W, CARD_H, 20);
    parts.push(g);

    // the level's backdrop, cropped to fit the top of the card
    const bg = this.add.image(left + 10, top + 10, c.bg).setOrigin(0);
    const src = this.textures.get(c.bg).getSourceImage();
    const s = PIC_H / src.height;
    bg.setScale(s).setCrop(0, 0, (CARD_W - 20) / s, src.height);
    parts.push(bg);
    const frame = this.add.graphics();
    frame.lineStyle(5, OUTLINE).strokeRoundedRect(left + 10, top + 10, CARD_W - 20, PIC_H, 6);
    parts.push(frame);

    // its creature, standing at the bottom of the picture
    const who = this.add.image(left + CARD_W - 70, top + 10 + PIC_H - 6, c.who).setOrigin(0.5, 1);
    who.setScale(c.whoH / this.textures.get(c.who).getSourceImage().height);
    if (c.boss) who.setFlipX(true);
    parts.push(who);

    // the level number in a gold badge
    const badge = this.add.graphics();
    badge.fillStyle(OUTLINE).fillCircle(left + 40, top + 40, 30);
    badge.fillStyle(0xffc928).fillCircle(left + 40, top + 40, 24);
    parts.push(badge);
    parts.push(this.add.text(left + 40, top + 38, String(level), textStyle(34)).setOrigin(0.5));

    // finished: a star and the best time
    if (done) {
      parts.push(this.add.image(left + CARD_W - 36, top + 36, 'star').setScale(0.5));
      const best = loadBest(level);
      if (best !== null) {
        parts.push(this.add.text(left + 76, top + 40, formatTime(best), textStyle(24, '#ffffff')).setOrigin(0, 0.5));
      }
    }

    // the name under the picture
    const name = this.add.text(0, top + 10 + PIC_H + (CARD_H - PIC_H - 10) / 2 - 2, c.name, textStyle(32, c.boss ? '#ffffff' : '#ff7043'));
    name.setOrigin(0.5);
    if (name.width > CARD_W - 30) name.setScale((CARD_W - 30) / name.width);
    parts.push(name);

    const card = this.add.container(0, 0, parts).setSize(CARD_W, CARD_H);
    card.setInteractive({ useHandCursor: true });
    return card;
  }
}
