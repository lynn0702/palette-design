// 4D Combinatoric Worldbuilding — progressive enhancement.
// All selection, highlighting, Matched Pair / 4-of-a-Kind detection and compiled output work
// through native radios + CSS :has(). This module adds: the 4d8 roller (with randomized Undertow
// dial), a slowed roll that writes out each dial's label as the dice settle (gliding smoothly to
// the Pitch card when clicked from the hero), share/copy icon actions, and example presets.

const form = document.getElementById('compiler');
const rollButton = document.getElementById('roll');
const heroRollButton = document.getElementById('hero-roll');
const shareButton = document.getElementById('share-pitch');
const shareToast = document.getElementById('share-toast');
const tray = document.getElementById('roll-result');
const heroDice = Array.from(document.querySelectorAll('[data-hero-slot]'));

const DIALS = ['palette', 'setting', 'tone'];
const DIAL_TITLES = { palette: 'Palette', setting: 'Setting', tone: 'Tone' };
const WORDS = {
  palette: ['', 'Prismatic', 'Neon', 'Chrome', 'Dark', 'Sepia', 'Bright', 'Pastel', 'Rust'],
  setting: ['', 'Threshold', 'Future', 'Space', 'Modern', 'Industrial', 'Mythic', 'Hearth', 'Primal'],
  tone: ['', 'Weird', 'Punk', 'Adventure', 'Noir', 'Pulp', 'Heroic', 'Cozy', 'Peril'],
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeTimers = [];
let toastTimer = null;

function clearTimers() {
  for (const id of activeTimers) clearTimeout(id);
  activeTimers = [];
}

/** Uniform integer in 0..(max - 1) using the platform CSPRNG with rejection sampling. */
function randomIndex(max) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

/** Uniform integer in 1..8. */
function d8() {
  return randomIndex(8) + 1;
}

/** Check the radio in `name` with `value`, firing `change` so anything listening stays in sync. */
function check(name, value) {
  const input = form?.querySelector(`input[name="${name}"][value="${value}"]`);
  if (!input) return;
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function showTray(values, undertowDial) {
  const uTitle = undertowDial && undertowDial !== 'none'
    ? `Undertow on ${DIAL_TITLES[undertowDial]}`
    : 'Undertow';
  const labels = ['Palette', 'Setting', 'Tone', uTitle];
  tray.replaceChildren(
    ...values.map((v, i) => {
      const die = document.createElement('span');
      die.className = 'dice-tray__die';
      die.dataset.d = String(v);
      die.textContent = String(v);
      die.title = labels[i];
      return die;
    }),
  );
  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = `Rolled ${values.slice(0, 3).join(', ')}, ${uTitle} ${values[3]}.`;
  tray.append(sr);
}

function apply([p, s, t, u], undertowDial) {
  [p, s, t].forEach((v, i) => check(DIALS[i], v));
  check('undertow', u);
  check('undertow-dial', undertowDial);
}

/** Typewriter reveal for a hero die's label as its slow tumble settles; returns total duration. */
function typeOut(el, text, charMs = 36) {
  if (!el) return 0;
  if (reducedMotion.matches) {
    el.textContent = text;
    return 0;
  }
  el.textContent = '';
  [...text].forEach((ch, idx) => {
    const id = setTimeout(() => {
      el.textContent += ch;
    }, idx * charMs);
    activeTimers.push(id);
  });
  return text.length * charMs;
}

/** Sync the 4 hero dice visuals & labels (either animated slow-roll or instant). */
function syncHeroDice(values, undertowDial, { slow = false, onComplete = null } = {}) {
  clearTimers();
  const [p, s, t, u] = values.map(Number);
  const effectiveUDial = undertowDial && undertowDial !== 'none' ? undertowDial : 'setting';
  const targetLabels = [
    WORDS.palette[p],
    WORDS.setting[s],
    WORDS.tone[t],
    `${WORDS[effectiveUDial][u]} on ${DIAL_TITLES[effectiveUDial]}`,
  ];
  const roles = ['Palette', 'Setting', 'Tone', 'Undertow'];

  if (!slow || reducedMotion.matches) {
    heroDice.forEach((fig, i) => {
      fig.classList.remove('is-rolling');
      fig.dataset.d = String(values[i]);
      const textNode = fig.querySelector('svg text');
      const roleNode = fig.querySelector('.hero-die__role');
      const valNode = fig.querySelector('.hero-die__val');
      if (textNode) textNode.textContent = String(values[i]);
      if (roleNode) roleNode.textContent = roles[i];
      if (valNode) valNode.textContent = targetLabels[i];
    });
    if (onComplete) onComplete();
    return;
  }

  // Slowed-down tumble (1150ms staggered by 210ms) cycling faces & typing out labels as each settles
  heroDice.forEach((fig, i) => {
    const delay = i * 210;
    const textNode = fig.querySelector('svg text');
    const roleNode = fig.querySelector('.hero-die__role');
    const valNode = fig.querySelector('.hero-die__val');

    if (roleNode) roleNode.textContent = roles[i];
    if (valNode) valNode.textContent = '···';

    fig.classList.remove('is-rolling');
    fig.style.setProperty('--roll-delay', `${delay}ms`);
    void fig.offsetWidth;
    fig.classList.add('is-rolling');

    const ticks = 5;
    for (let step = 0; step < ticks; step++) {
      const tickId = setTimeout(() => {
        const tempFace = d8();
        fig.dataset.d = String(tempFace);
        if (textNode) textNode.textContent = String(tempFace);
      }, delay + step * 145);
      activeTimers.push(tickId);
    }

    const settleId = setTimeout(() => {
      fig.dataset.d = String(values[i]);
      if (textNode) textNode.textContent = String(values[i]);
      const writeMs = typeOut(valNode, targetLabels[i], 36);

      if (i < 3) {
        check(DIALS[i], values[i]);
      } else {
        check('undertow', values[3]);
        check('undertow-dial', effectiveUDial);
        showTray(values.map(Number), effectiveUDial);

        if (onComplete) {
          const finishId = setTimeout(onComplete, writeMs + 220);
          activeTimers.push(finishId);
        }
      }
    }, delay + ticks * 145);
    activeTimers.push(settleId);
  });
}

function glideToPitch() {
  document.getElementById('pitch-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function roll({ slowHero = false, glideAfterSettle = false } = {}) {
  const values = [d8(), d8(), d8(), d8()];
  const undertowDial = DIALS[randomIndex(DIALS.length)];

  if (slowHero && !reducedMotion.matches) {
    syncHeroDice(values, undertowDial, {
      slow: true,
      onComplete: glideAfterSettle ? glideToPitch : null,
    });
  } else {
    apply(values, undertowDial);
    showTray(values, undertowDial);
    syncHeroDice(values, undertowDial, { slow: false });
    if (glideAfterSettle) glideToPitch();
  }
}

function readCurrentState() {
  if (!form) return null;
  const p = form.elements.namedItem('palette')?.value;
  const s = form.elements.namedItem('setting')?.value;
  const t = form.elements.namedItem('tone')?.value;
  const u = form.elements.namedItem('undertow')?.value;
  const ud = form.elements.namedItem('undertow-dial')?.value || 'none';
  if (!p || !s || !t) return null;
  return { values: [Number(p), Number(s), Number(t), Number(u || 1)], undertowDial: ud };
}

function buildShareUrl() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = 'pitch-stage';
  const data = new FormData(form);
  for (const [k, v] of data.entries()) {
    url.searchParams.set(k, String(v));
  }
  return url;
}

function flashToast(msg) {
  if (!shareToast) return;
  shareToast.textContent = msg;
  shareToast.hidden = false;
  shareButton?.classList.add('is-copied');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    shareToast.hidden = true;
    shareButton?.classList.remove('is-copied');
  }, 2000);
}

document.querySelectorAll('[data-requires-js]').forEach((el) => { el.hidden = false; });

// Restore pitch from URL if present; otherwise run the slowed-down 4d8 roll on page load.
{
  const params = new URLSearchParams(location.search);
  const hasSavedPitch = DIALS.some((name) => params.has(name));

  if (hasSavedPitch) {
    for (const name of [...DIALS, 'undertow', 'undertow-dial']) {
      const value = params.get(name);
      if (value) check(name, value);
    }
    const restored = readCurrentState();
    if (restored) {
      showTray(restored.values, restored.undertowDial);
      syncHeroDice(restored.values, restored.undertowDial, { slow: false });
    }
  } else {
    roll({ slowHero: true, glideAfterSettle: false });
  }
}

rollButton?.addEventListener('click', () => roll({ slowHero: false }));

heroRollButton?.addEventListener('click', () => {
  roll({ slowHero: true, glideAfterSettle: true });
});

form?.addEventListener('change', () => {
  const current = readCurrentState();
  if (current && activeTimers.length === 0) {
    syncHeroDice(current.values, current.undertowDial, { slow: false });
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const shareUrl = buildShareUrl();
  history.replaceState(null, '', shareUrl);

  const state = readCurrentState();
  const title = state
    ? `${WORDS.palette[state.values[0]]} ${WORDS.setting[state.values[1]]} ${WORDS.tone[state.values[2]]}`
    : '4D Combinatoric Worldbuilding';

  if (navigator.share) {
    try {
      await navigator.share({ title, url: shareUrl.toString() });
      flashToast('Shared');
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(shareUrl.toString());
    flashToast('Link copied');
  } catch {
    flashToast('URL updated');
  }
});

form?.addEventListener('reset', () => {
  clearTimers();
  queueMicrotask(() => {
    tray.replaceChildren();
    history.replaceState(null, '', `${location.pathname}`);
    heroDice.forEach((fig, i) => {
      fig.classList.remove('is-rolling');
      const valNode = fig.querySelector('.hero-die__val');
      if (valNode) valNode.textContent = ['Palette', 'Setting', 'Tone', 'Undertow'][i];
    });
  });
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-preset]');
  if (!button) return;
  const [p, s, t, dial, u] = button.dataset.preset.split(' ');
  const nums = [p, s, t, u].map(Number);
  apply([p, s, t, u], dial);
  showTray(nums, dial);
  syncHeroDice(nums, dial, { slow: false });
  glideToPitch();
  document.getElementById('pitch-heading')?.focus({ preventScroll: true });
});
