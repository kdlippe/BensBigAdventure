export const FONT = '"Lilita One", "Arial Black", sans-serif';

// shared text style: white with a thick cartoon outline
export const textStyle = (size, color = '#ffffff') => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
  stroke: '#16161a',
  strokeThickness: Math.max(4, Math.round(size / 7)),
});

// A big pill-shaped button with a label. Returns { parts, setEnabled } where
// parts are the game objects (for positioning / tweening). Pill textures are
// drawn in BootScene: 'pill_green', 'pill_blue', 'pill_orange'.
export function pillButton(scene, x, y, key, label, onPress, { scale = 1, fontSize = 34, fixed = true } = {}) {
  const img = scene.add.image(x, y, key).setScale(scale).setInteractive({ useHandCursor: true });
  const txt = scene.add.text(x, y - 3 * scale, label, textStyle(fontSize)).setOrigin(0.5);
  // shrink long labels to fit inside the pill
  const maxW = img.displayWidth - 40 * scale;
  if (txt.width > maxW) txt.setScale(maxW / txt.width);
  if (fixed) [img, txt].forEach((o) => o.setScrollFactor(0));
  img.on('pointerdown', () => {
    img.setScale(scale * 0.94);
    onPress();
  });
  img.on('pointerup', () => img.setScale(scale));
  img.on('pointerout', () => img.setScale(scale));
  return { parts: [img, txt], img, txt };
}
