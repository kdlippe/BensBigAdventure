export const FONT = '"Lilita One", "Arial Black", sans-serif';

// shared text style: white with a thick cartoon outline
export const textStyle = (size, color = '#ffffff') => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
  stroke: '#16161a',
  strokeThickness: Math.max(4, Math.round(size / 7)),
});
