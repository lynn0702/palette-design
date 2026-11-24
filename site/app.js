// 4D Combinatoric Worldbuilding — progressive enhancement.
// All selection, highlighting, Matched Pair / 4-of-a-Kind detection and dial output work
// through native radios + CSS :has(). This module adds: the 4d8 roller (with randomized Undertow
// dial), a slowed sequential pitch-poster roll, share/copy icon actions, and sample pitch presets.

const form = document.getElementById('dials-form');
const rollButton = document.getElementById('roll');
const shareButton = document.getElementById('share-pitch');
const shareToast = document.getElementById('share-toast');
const tray = document.getElementById('roll-result');
const pitchCard = document.getElementById('pitch-card');
const pitchStatus = document.getElementById('pitch-status');

const DIALS = ['palette', 'setting', 'tone'];
const DIAL_TITLES = { palette: 'Palette', setting: 'Setting', tone: 'Tone' };
const WORDS = {
  palette: ['', 'Prismatic', 'Sepia', 'Neon', 'Pastel', 'Bright', 'Dark', 'Chrome', 'Rust'],
  setting: ['', 'Liminal', 'Industrial', 'Future', 'Hearth', 'Mythic', 'Modern', 'Space', 'Primal'],
  tone: ['', 'Weird', 'Pulp', 'Punk', 'Cozy', 'Heroic', 'Noir', 'Adventure', 'Peril'],
};

const liveWords = {
  palette: document.querySelector('[data-live="p"]'),
  setting: document.querySelector('[data-live="s"]'),
  tone: document.querySelector('[data-live="t"]'),
};
const liveUndertows = {
  palette: document.querySelector('[data-live-u="p"]'),
  setting: document.querySelector('[data-live-u="s"]'),
  tone: document.querySelector('[data-live-u="t"]'),
};
const subSlots = {
  palette: document.querySelector('.pitch-sub[data-ud="p"]'),
  setting: document.querySelector('.pitch-sub[data-ud="s"]'),
  tone: document.querySelector('.pitch-sub[data-ud="t"]'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeTimers = [];
let activeTicker = null;
let toastTimer = null;

function clearTimers() {
  for (const id of activeTimers) clearTimeout(id);
  activeTimers = [];
  if (activeTicker !== null) {
    clearInterval(activeTicker);
    activeTicker = null;
  }
}

/** Stop any in-progress slow roll and hand rendering back to declarative CSS :has(). */
function stopRollingUI() {
  clearTimers();
  pitchCard?.classList.remove('is-rolling');
  Object.values(liveWords).forEach((el) => { if (el) el.textContent = ''; });
  Object.values(liveUndertows).forEach((el) => { if (el) el.textContent = ''; });
  Object.values(subSlots).forEach((el) => { el?.classList.remove('is-typing'); });
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

/** Check the radio in `name` with `value`, firing `change` so listeners and :has() stay in sync. */
function check(name, value) {
  const safeName = CSS.escape(String(name));
  const safeValue = CSS.escape(String(value));
  const input = form?.querySelector(`input[name="${safeName}"][value="${safeValue}"]`);
  if (!input) return;
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function clearDialGroup(name) {
  form?.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = false;
  });
}

function createDieElement(value, title) {
  const die = document.createElement('span');
  die.className = 'dice-tray__die';
  die.dataset.d = String(value);
  die.textContent = String(value);
  if (title) die.title = title;
  return die;
}

function buildTrayLabels(undertowDial) {
  const uTitle = undertowDial && undertowDial !== 'none'
    ? `Undertow on ${DIAL_TITLES[undertowDial]}`
    : 'Undertow';
  return ['Palette', 'Setting', 'Tone', uTitle];
}

function showTray(values, undertowDial) {
  if (!tray) return;
  const labels = buildTrayLabels(undertowDial);
  const items = values
    .map((v, i) => (v ? createDieElement(v, labels[i]) : null))
    .filter(Boolean);
  tray.replaceChildren(...items);
  if (values.every(Boolean)) {
    const sr = document.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = `Rolled ${values.slice(0, 3).join(', ')}, ${labels[3]} ${values[3]}.`;
    tray.append(sr);
  }
}

function apply([p, s, t, u], undertowDial) {
  [p, s, t].forEach((v, i) => check(DIALS[i], v));
  check('undertow', u);
  check('undertow-dial', undertowDial);
}

const BASE_TITLE = document.title;

function syncTableLinks([p, s, t, u], undertowDial) {
  const params = new URLSearchParams();
  if (p) params.set('palette', String(p));
  if (s) params.set('setting', String(s));
  if (t) params.set('tone', String(t));
  if (undertowDial && undertowDial !== 'none') params.set('undertow-dial', undertowDial);
  if (u) params.set('undertow', String(u));
  const qs = params.toString();
  const href = qs ? `table.html?${qs}` : 'table.html';
  document.querySelectorAll('a[data-table-link]').forEach((a) => { a.href = href; });
}

function announceStatus([p, s, t, u], undertowDial) {
  syncTableLinks([p, s, t, u], undertowDial);
  if (!pitchStatus || !p || !s || !t) return;
  const base = `${WORDS.palette[p]} ${WORDS.setting[s]} ${WORDS.tone[t]}`;
  document.title = `${base} · ${BASE_TITLE}`;
  if (u && p === s && s === t && t === u) {
    pitchStatus.textContent = `${base} — 4-of-a-Kind: Pure Archetype.`;
    return;
  }
  const dialValues = { palette: p, setting: s, tone: t };
  if (u && undertowDial && undertowDial !== 'none') {
    if (u === dialValues[undertowDial]) {
      pitchStatus.textContent = `${base} — Matched Pair on ${DIAL_TITLES[undertowDial]}.`;
    } else {
      pitchStatus.textContent = `${base} — Undertow ${WORDS[undertowDial][u]} on ${DIAL_TITLES[undertowDial]}.`;
    }
    return;
  }
  pitchStatus.textContent = base;
}

/** Typewriter reveal into `el`; returns total typing duration in ms. */
function typeOut(el, text, charMs = 36) {
  if (!el || !text) return 0;
  const chars = [...text];
  if (reducedMotion.matches || chars.length <= 1) {
    el.textContent = text;
    return 0;
  }
  el.textContent = chars[0];
  for (let idx = 1; idx < chars.length; idx++) {
    const id = setTimeout(() => {
      el.textContent += chars[idx];
    }, idx * charMs);
    activeTimers.push(id);
  }
  return (chars.length - 1) * charMs;
}

/** Slow-write sequence directly in the hero Pitch Poster + bottom dice tray. */
function renderPitchRoll(values, undertowDial, { slow = true } = {}) {
  const [p, s, t, u] = values.map(Number);

  if (!slow || reducedMotion.matches) {
    stopRollingUI();
    apply([p, s, t, u], undertowDial);
    showTray([p, s, t, u], undertowDial);
    announceStatus([p, s, t, u], undertowDial);
    return;
  }

  stopRollingUI();
  pitchCard?.classList.add('is-rolling');

  DIALS.forEach((name) => {
    clearDialGroup(name);
    if (liveWords[name]) liveWords[name].textContent = '\u00A0';
  });
  clearDialGroup('undertow');
  check('undertow-dial', 'none');

  const dies = Array.from({ length: 4 }, (_, i) =>
    createDieElement(d8(), ['Palette', 'Setting', 'Tone', 'Undertow'][i]),
  );
  tray?.replaceChildren(...dies);

  let lockedCount = 0;
  activeTicker = setInterval(() => {
    for (let i = lockedCount; i < 4; i++) {
      const tempFace = d8();
      dies[i].dataset.d = String(tempFace);
      dies[i].textContent = String(tempFace);
    }
  }, 110);

  const lockDie = (idx, face, label) => {
    lockedCount = Math.max(lockedCount, idx + 1);
    dies[idx].dataset.d = String(face);
    dies[idx].textContent = String(face);
    if (label) dies[idx].title = label;
  };

  // Beat 1: Palette
  const beat1At = 180;
  const t1 = setTimeout(() => {
    lockDie(0, p, 'Palette');
    check('palette', p);
    const write1Ms = typeOut(liveWords.palette, WORDS.palette[p], 36);

    // Beat 2: Setting
    const t2 = setTimeout(() => {
      lockDie(1, s, 'Setting');
      check('setting', s);
      const write2Ms = typeOut(liveWords.setting, WORDS.setting[s], 36);

      // Beat 3: Tone
      const t3 = setTimeout(() => {
        lockDie(2, t, 'Tone');
        check('tone', t);
        const write3Ms = typeOut(liveWords.tone, WORDS.tone[t], 36);

        // Beat 4: Undertow (or scale-up for Matched Pair / 4-of-a-Kind)
        const t4 = setTimeout(() => {
          if (activeTicker !== null) {
            clearInterval(activeTicker);
            activeTicker = null;
          }
          const labels = buildTrayLabels(undertowDial);
          lockDie(3, u, labels[3]);
          check('undertow', u);
          check('undertow-dial', undertowDial);

          const sr = document.createElement('span');
          sr.className = 'visually-hidden';
          sr.textContent = `Rolled ${p}, ${s}, ${t}, ${labels[3]} ${u}.`;
          tray?.append(sr);

          const dialValues = { palette: p, setting: s, tone: t };
          const isPure = p === s && s === t && t === u;
          const isPair = !isPure && u === dialValues[undertowDial];

          if (isPure || isPair || undertowDial === 'none') {
            const settleId = setTimeout(() => {
              stopRollingUI();
              announceStatus([p, s, t, u], undertowDial);
            }, 260);
            activeTimers.push(settleId);
          } else {
            subSlots[undertowDial]?.classList.add('is-typing');
            const write4Ms = typeOut(liveUndertows[undertowDial], WORDS[undertowDial][u], 34);
            const settleId = setTimeout(() => {
              stopRollingUI();
              announceStatus([p, s, t, u], undertowDial);
            }, write4Ms + 100);
            activeTimers.push(settleId);
          }
        }, write3Ms + 110);
        activeTimers.push(t4);
      }, write2Ms + 85);
      activeTimers.push(t3);
    }, write1Ms + 85);
    activeTimers.push(t2);
  }, beat1At);
  activeTimers.push(t1);
}

function roll({ slow = true } = {}) {
  const values = [d8(), d8(), d8(), d8()];
  const undertowDial = DIALS[randomIndex(DIALS.length)];
  renderPitchRoll(values, undertowDial, { slow });
}

function readCurrentState() {
  if (!form) return null;
  const p = form.elements.namedItem('palette')?.value;
  const s = form.elements.namedItem('setting')?.value;
  const t = form.elements.namedItem('tone')?.value;
  const u = form.elements.namedItem('undertow')?.value;
  const ud = form.elements.namedItem('undertow-dial')?.value || 'none';
  if (!p || !s || !t) return null;
  return {
    values: [Number(p), Number(s), Number(t), u ? Number(u) : null],
    undertowDial: ud,
  };
}

function buildShareUrl() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = 'top';
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

// Site-wide Light / Dark mode toggle (poster card stock stays independent via Palette Dial 1)
{
  const themeBtn = document.getElementById('theme-toggle');
  const darkMql = window.matchMedia('(prefers-color-scheme: dark)');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const currentTheme = () =>
    document.documentElement.dataset.theme || (darkMql.matches ? 'dark' : 'light');

  const syncThemeUI = () => {
    const isDark = currentTheme() === 'dark';
    const nextLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    if (themeBtn) {
      themeBtn.setAttribute('aria-label', nextLabel);
      themeBtn.setAttribute('title', nextLabel);
    }
    if (themeMeta) {
      themeMeta.setAttribute('content', isDark ? '#141213' : '#fbf7f0');
    }
  };

  syncThemeUI();
  darkMql.addEventListener('change', syncThemeUI);

  themeBtn?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem('palette-theme', next); } catch { }
    syncThemeUI();
  });
}

// Restore pitch from URL if present; otherwise run the slowed-down 4d8 roll in the Pitch Poster.
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
      announceStatus(restored.values, restored.undertowDial);
    }
  } else {
    roll({ slow: true });
  }
}

rollButton?.addEventListener('click', () => roll({ slow: true }));

form?.addEventListener('change', () => {
  if (pitchCard?.classList.contains('is-rolling')) return;
  const current = readCurrentState();
  if (current) {
    showTray(current.values, current.undertowDial);
    announceStatus(current.values, current.undertowDial);
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const shareUrl = buildShareUrl();
  history.replaceState(null, '', shareUrl);

  const state = readCurrentState();
  const title = state
    ? `${WORDS.palette[state.values[0]]} ${WORDS.setting[state.values[1]]} ${WORDS.tone[state.values[2]]}`
    : '4d8 Worlds';

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
  stopRollingUI();
  queueMicrotask(() => {
    tray?.replaceChildren();
    if (pitchStatus) pitchStatus.textContent = '';
    document.title = BASE_TITLE;
    history.replaceState(null, '', `${location.pathname}`);
  });
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-preset]');
  if (!button) return;
  const [p, s, t, dial, u] = button.dataset.preset.split(' ');
  const nums = [p, s, t, u].map(Number);
  stopRollingUI();
  apply(nums, dial);
  showTray(nums, dial);
  announceStatus(nums, dial);
  document.getElementById('top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('pitch-heading')?.focus({ preventScroll: true });
});
