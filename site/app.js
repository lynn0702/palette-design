// PaletteDesign — progressive enhancement only.
// All selection, highlighting, Matched Pair / 4-of-a-Kind detection and compiled output work
// through native radios + CSS :has(). This module adds: a 4d8 roller, example presets, and
// restoring a pitch saved to the URL by the form's native GET submit.

const form = document.getElementById('compiler');
const rollButton = document.getElementById('roll');
const tray = document.getElementById('roll-result');
const DIALS = ['palette', 'setting', 'tone'];

/** Check the radio in `name` with `value`, firing `change` so anything listening stays in sync. */
function check(name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
  if (!input) return;
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Uniform integer in 1..8 using the platform CSPRNG. */
function d8() {
  const buf = new Uint32Array(1);
  // Rejection sampling keeps the distribution exactly uniform.
  const limit = Math.floor(0x1_0000_0000 / 8) * 8;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return (buf[0] % 8) + 1;
}

function showTray(values) {
  const labels = ['Palette', 'Setting', 'Tone', 'Undertow'];
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
  // <output> is a live region; give it a readable sentence too.
  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = `Rolled ${values.slice(0, 3).join(', ')}, Undertow ${values[3]}.`;
  tray.append(sr);
}

function apply([p, s, t, u], undertowDial) {
  [p, s, t].forEach((v, i) => check(DIALS[i], v));
  check('undertow', u);
  check('undertow-dial', undertowDial);
}

function roll() {
  const values = [d8(), d8(), d8(), d8()];
  const current = form.elements.namedItem('undertow-dial').value;
  const undertowDial = current && current !== 'none'
    ? current
    : DIALS[d8() % 3];
  apply(values, undertowDial);
  showTray(values);
}

document.querySelectorAll('[data-requires-js]').forEach((el) => { el.hidden = false; });

// Restore a pitch saved with the form's native GET submit ("Save link to this pitch").
{
  const params = new URLSearchParams(location.search);
  for (const name of [...DIALS, 'undertow', 'undertow-dial']) {
    const value = params.get(name);
    if (value) check(name, value);
  }
}

rollButton?.addEventListener('click', roll);

form?.addEventListener('reset', () => {
  // Native reset restores the radios; just clear the tray after it runs.
  queueMicrotask(() => tray.replaceChildren());
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-preset]');
  if (!button) return;
  const [p, s, t, dial, u] = button.dataset.preset.split(' ');
  apply([p, s, t, u], dial);
  showTray([p, s, t, u].map(Number));
  document.getElementById('compile').scrollIntoView({ block: 'start' });
  document.getElementById('pitch-heading').focus({ preventScroll: true });
});
