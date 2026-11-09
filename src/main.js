import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { installTabletHelpers } from './device.js';

async function start() {
  // Wait (briefly) for the cartoon font so the first text isn't drawn in Arial.
  try {
    await Promise.race([
      document.fonts.load('48px "Lilita One"'),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) {
    /* fall back to Arial Black */
  }

  // exposed as window.game to make poking at it from the browser console easy
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 720,
    backgroundColor: '#8fd3f7',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { activePointers: 3 },
    scene: [BootScene, TitleScene, GameScene],
  });
}

installTabletHelpers();
start();
