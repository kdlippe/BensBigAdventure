// Which level Ben has reached, and best times per level. Kept in this browser
// only (each tablet or laptop has its own). Storage can be blocked (private
// browsing); then nothing is remembered and the game still works.

import { LEVELS } from './level.js';

// "v2": the game went from 6 levels to 4 (one per look), so level numbers mean
// different levels now. Best times start fresh; how far Ben got carries over.
const PROGRESS_KEY = 'bmtr.v2.progress';
const bestKey = (level) => `bmtr.v2.best.l${level}`;
const OLD_PROGRESS_KEY = 'bmtr.progress';
const OLD_TO_NEW = [1, 1, 2, 2, 3, 4]; // old levels 1-6 -> the new level with the same look

export function loadProgress() {
  try {
    const store = window.localStorage;
    let v = parseInt(store.getItem(PROGRESS_KEY), 10);
    if (!(v >= 1)) {
      const old = parseInt(store.getItem(OLD_PROGRESS_KEY), 10);
      v = old >= 1 ? OLD_TO_NEW[Math.min(old, OLD_TO_NEW.length) - 1] : 1;
    }
    return Math.min(v, LEVELS.length);
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
