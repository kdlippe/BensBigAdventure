// Tablet helpers: go full screen and lock the screen sideways.
//
// Browsers only allow full screen from inside a tap, and a tap's "touchstart"
// (which is what Phaser reacts to) doesn't count - its "touchend" does. So the
// GO! button just asks for it, and we do it when that finger lifts.
//
// Works on Android / Fire tablets (Chrome, Silk). iPad Safari can't lock the
// screen, so there the "turn me sideways" screen in index.html does the job.

let wanted = false;

const isTouchDevice = () =>
  window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

export function requestLandscape() {
  if (isTouchDevice()) wanted = true;
}

function apply() {
  if (!wanted) return;
  wanted = false;
  const el = document.documentElement;
  const enter = !document.fullscreenElement && (el.requestFullscreen || el.webkitRequestFullscreen);
  const lock = () =>
    screen.orientation && screen.orientation.lock
      ? screen.orientation.lock('landscape').catch(() => {})
      : null;
  try {
    if (enter) {
      Promise.resolve(enter.call(el, { navigationUI: 'hide' })).then(lock, () => {});
    } else {
      lock();
    }
  } catch (e) {
    /* not supported: the turn-sideways screen covers it */
  }
}

export function installTabletHelpers() {
  for (const ev of ['pointerup', 'touchend', 'click']) document.addEventListener(ev, apply, true);
  // stop the long-press menu (copy / save image) popping up on the buttons
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}
