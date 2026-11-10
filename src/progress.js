// Which level Ben has reached, and best times per level. Kept in this browser
// only (each tablet or laptop has its own). Storage can be blocked (private
// browsing); then nothing is remembered and the game still works.

import { LEVELS } from './level.js';

const PROGRESS_KEY = 'bmtr.progress';
const bestKey = (level) => `bmtr.best.l${level}`;

export function loadProgress() {
  try {
    const v = parseInt(window.localStorage.getItem(PROGRESS_KEY), 10);
    return v >= 1 && v <= LEVELS.length ? v : 1;
  } catch (e) {
    return 1;
  }
}

export function saveProgress(level) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, String(Math.min(Math.max(level, 1), LEVELS.length)));
  } catch (e) {
    /* storage blocked */
  }
}

export function loadBest(level) {
  try {
    const v = parseFloat(window.localStorage.getItem(bestKey(level)));
    return Number.isFinite(v) ? v : null;
  } catch (e) {
    return null;
  }
}

export function saveBest(level, seconds) {
  try {
    window.localStorage.setItem(bestKey(level), String(seconds));
  } catch (e) {
    /* storage blocked */
  }
}
