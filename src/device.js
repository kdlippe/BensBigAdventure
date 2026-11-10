// Tablet helpers: go full screen and lock the screen sideways.
//
// Browsers only allow full screen from inside a tap, and a tap's "touchstart"
// (which is what Phaser reacts to) doesn't count - its "touchend" does. So the
// GO! button just asks for it, and we do it when that finger lifts.
//
// Works on Android / Fire tablets and phones (Chrome, Silk). iPad / iPhone
// Safari can't lock the screen, so there the "turn me sideways" screen in
// index.html does the job.
//
// If the phone's rotation lock is on, the browser stays upright however the
// phone is held, so the "turn me sideways" screen would never go away. Tapping
// it forces landscape where the browser allows that; where it can't (iPhone),
// it explains the rotation lock and offers "Play anyway".

let wanted = false;

const isTouchDevice = () =>
  window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

export function requestLandscape() {
  if (isTouchDevice()) wanted = true;
}

// full screen, then lock sideways; resolves true if the lock worked
function goLandscape() {
  const el = document.documentElement;
  const enter = !document.fullscreenElement && (el.requestFullscreen || el.webkitRequestFullscreen);
  const lock = () =>
    screen.orientation && screen.orientation.lock
      ? screen.orientation.lock('landscape').then(() => true, () => false)
      : false;
  try {
    if (enter) return Promise.resolve(enter.call(el, { navigationUI: 'hide' })).then(lock, lock);
    return Promise.resolve(lock());
  } catch (e) {
    return Promise.resolve(false); // not supported: the turn-sideways screen covers it
  }
}

function apply() {
  if (!wanted) return;
  wanted = false;
  goLandscape();
}

// the "turn me sideways" screen (index.html)
function setupRotateScreen() {
  const box = document.getElementById('rotate');
  if (!box) return;
  const hint = box.querySelector('.hint');
  const stuck = () => {
    box.classList.add('stuck');
    hint.textContent = "Turn off the phone's rotation lock, then turn it sideways.";
  };
  box.addEventListener('click', (e) => {
    if (e.target.closest('.anyway')) {
      document.body.classList.add('play-upright');
      return;
    }
    goLandscape();
    // still upright a moment later: the browser can't turn on its own
    // (don't wait on the full-screen request; some browsers never answer it)
    setTimeout(() => {
      if (window.matchMedia('(orientation: portrait)').matches) stuck();
    }, 1000);
  });
  // once it really is sideways, "play anyway" isn't needed any more
  window.matchMedia('(orientation: landscape)').addEventListener('change', (m) => {
    if (m.matches) document.body.classList.remove('play-upright');
  });
}

export function installTabletHelpers() {
  setupRotateScreen();
  for (const ev of ['pointerup', 'touchend', 'click']) document.addEventListener(ev, apply, true);
  // stop the long-press menu (copy / save image) popping up on the buttons
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}
