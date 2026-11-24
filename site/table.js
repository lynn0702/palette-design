// 4d8 Worlds — Pathways Table (experimental interactive Session Zero & Cortex compiler)
// Zero-framework ES module. All user text is rendered via textContent / SVG DOM builders.

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = '4d8-pathways-table-v1';

const DIALS = ['palette', 'setting', 'tone'];
const DIAL_TITLES = { palette: 'Palette', setting: 'Setting', tone: 'Tone' };
const UNDERTOW_MODES = { palette: 'Divide', setting: 'Layer', tone: 'Counter-Beat' };

const PALETTES = [
  null,
  { word: 'Prismatic', prompt: 'Aura', mod: 'Bleed', rule: 'When the uncanny bleeds into a scene, 1s & 2s count as Openings. Spend 1 PP to rename any Asset or Fallout.' },
  { word: 'Sepia', prompt: 'Relic', mod: 'Living Serial', rule: 'Log Session Titles. Once/session invoke one for a free 1 PP effect or Flashback; cross off between sessions to advance.' },
  { word: 'Neon', prompt: 'Vice', mod: 'Burnout', rule: 'Created Assets last 1 roll (1 PP sustains for the scene). Lean In: roll your own Fallout, then step it up.' },
  { word: 'Pastel', prompt: 'Comfort', mod: 'Gentle Stakes', rule: 'PC Fallout lands at d6 or steps up existing Fallout by one. Steps down automatically in quiet scenes.' },
  { word: 'Bright', prompt: 'Banner', mod: 'Open Table', rule: 'No GM Bank: GM PP spends go straight to targeted PCs. Allies share created Assets for free.' },
  { word: 'Dark', prompt: 'Secret', mod: 'Doom Pool', rule: 'Escalating d8, d6, d4 GM pool replaces difficulty pairs. Grows on player Openings; spends dice for twists or Romps.' },
  { word: 'Chrome', prompt: 'Pedigree', mod: 'Spec Sheet', rule: 'Two d8 Signature Assets with Gear Limit: shut one down for the scene to gain 1 PP.' },
  { word: 'Rust', prompt: 'Scar', mod: 'Scarcity', rule: 'Gain 2d6 Salvage Resources. Stricken: Any d10+ Fallout restricts you to keeping 1 Total die.' },
];

const SETTINGS = [
  null,
  { word: 'Liminal', prompt: 'Tether', set: 'Attributes + Ability', traits: ['Pulse', 'Pattern', 'Poise'], dice: ['d10', 'd8', 'd6'], extra: 'One d8 Ability (1 Special + Limit: shut down for +1 PP)' },
  { word: 'Industrial', prompt: 'Trade', set: 'Skills', traits: ['Brawl', 'Craft', 'Delve', 'Doctor', 'Prowl', 'Rig', 'Survey', 'Sway'], dice: ['d10', 'd8', 'd8', 'd6', 'd6', 'd6', 'd4', 'd4'], extra: 'Pyramid: d10, 2×d8, 3×d6, rest d4' },
  { word: 'Future', prompt: 'Augment', set: 'Roles', traits: ['Hacker', 'Fixer', 'Operator', 'Tech', 'Face'], dice: ['d10', 'd8', 'd8', 'd6', 'd4'], extra: 'Cyber-sprawl crew roles' },
  { word: 'Hearth', prompt: 'Workshop', set: 'Skills + Specialties', traits: ['Cook', 'Grow', 'Mend', 'Notice', 'Parley', 'Tinker', 'Travel', 'Ward'], dice: ['d10', 'd8', 'd8', 'd6', 'd6', 'd6', 'd4', 'd4'], extra: 'Plus two d6 Specialties' },
  { word: 'Mythic', prompt: 'Calling', set: 'Attributes + Powers', traits: ['Might', 'Grace', 'Lore'], dice: ['d10', 'd8', 'd6'], extra: 'Power Set: two d8 mythic Powers + Limit' },
  { word: 'Modern', prompt: 'Day Job', set: 'Roles + Talent', traits: ['Mouth', 'Mind', 'Muscle'], dice: ['d10', 'd8', 'd6'], extra: 'Plus one unrated narrative Talent' },
  { word: 'Space', prompt: 'World', set: 'Affiliations: Arenas', traits: ['Void', 'Station', 'Surface'], dice: ['d10', 'd8', 'd6'], extra: 'Shared d8 Vehicle (Engines, Frame, Systems)' },
  { word: 'Primal', prompt: 'Kin', set: 'Affiliations: Arenas', traits: ['Camp', 'Wilds', 'Lair'], dice: ['d10', 'd8', 'd6'], extra: 'd8 Beast Support or Signature Asset' },
];

const TONES = [
  null,
  { word: 'Weird', prompt: 'Obsession', set: 'Values + Statements', traits: ['Order', 'Truth', 'Wonder', 'Self'], dice: ['d10', 'd8', 'd6', 'd6'], extra: 'Question a belief to triple its die, then step down & rewrite' },
  { word: 'Pulp', prompt: 'Trademark', set: 'Affiliations + Hero Dice', traits: ['Solo', 'Duo', 'Team'], dice: ['d10', 'd8', 'd6'], extra: 'Hero Dice: win by 5+ to bank foe\'s top die' },
  { word: 'Punk', prompt: 'Grievance', set: 'Relationships: Factions', traits: ['Bloc 1', 'Bloc 2', 'Bloc 3'], dice: ['d10', 'd8', 'd6'], extra: 'Question your stance to triple its die & burn standing' },
  { word: 'Cozy', prompt: 'Routine', set: 'Relationships + Team Up', traits: ['Crew Bond', 'Neighbor', 'Local Pillar'], dice: ['d10', 'd8', 'd8'], extra: 'Team Up: lend your Relationship die risk-free' },
  { word: 'Heroic', prompt: 'Oath', set: 'Values + Moral Support', traits: ['Courage', 'Justice', 'Mercy', 'Truth'], dice: ['d10', 'd8', 'd6', 'd6'], extra: 'Moral Support: step down your Value to step up an ally\'s' },
  { word: 'Noir', prompt: 'Code', set: 'Relationships + Vices', traits: ['Partner', 'Informant', 'Suspect'], dice: ['d10', 'd8', 'd8'], extra: 'GMC Vices: Greed, Control, Wrath' },
  { word: 'Adventure', prompt: 'Horizon', set: 'Values + Goals', traits: ['Discovery', 'Duty', 'Fortune', 'Glory', 'Loyalty'], dice: ['d10', 'd8', 'd6', 'd6', 'd4'], extra: 'Three Goals at d6, d8, d10' },
  { word: 'Peril', prompt: 'Liability', set: 'Reserves + Usage Dice', traits: ['Stamina', 'Resolve', 'Supply', 'Luck'], dice: ['d10', 'd8', 'd6', 'd6'], extra: 'Usage Dice: rolling 1–2 steps Reserve down; rest resets' },
];

const PASS_HINTS = {
  1: 'Pass 1 (Identity): Click each Character Circle to name them and answer their 3 Dial prompts. Drag nodes to arrange.',
  2: 'Pass 2 (Wires): Click a blue Rumor wire to state what you heard & the real truth. Click a gold Bond box to name the shared tie.',
  3: 'Pass 3 (Claim): Tag each PC with their Setting Edge, and drop violet Fact diamonds wired to characters.',
  4: 'Pass 4 (Event): Click the vermilion Event triangle to name where the Undertow bites and wire it to 2+ nodes.',
};

const SAMPLE_NAMES = ['Vesper', 'Kael', 'Sora', 'Bram', 'Tamsin'];
const SAMPLE_BONDS = ['The Patchwork Skiff', 'Back-Alley Workshop', 'Old Debt to the Guild', 'Shared Safehouse', 'Watch-Hound'];

// ------------------------------------------------------------------ RNG
function randomIndex(max) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}
function d(sides) {
  return randomIndex(sides) + 1;
}

// ------------------------------------------------------------------ State
function createDefaultState(world) {
  const w = world || { p: 7, s: 7, t: 7, u: 2, ud: 'palette' };
  const settingTraits = SETTINGS[w.s].traits;
  return {
    world: w,
    pass: 1,
    view: 'map',
    selected: { kind: 'pc', id: 'pc-1' },
    pcs: [
      { id: 'pc-1', name: 'Character A', x: 175, y: 145, texture: '', foothold: '', hook: '', edge: settingTraits[0] || '' },
      { id: 'pc-2', name: 'Character B', x: 725, y: 145, texture: '', foothold: '', hook: '', edge: settingTraits[1] || '' },
      { id: 'pc-3', name: 'Character C', x: 450, y: 505, texture: '', foothold: '', hook: '', edge: settingTraits[2] || '' },
    ],
    rumors: [
      { from: 'pc-1', to: 'pc-2', rumor: '', truth: '' },
      { from: 'pc-2', to: 'pc-3', rumor: '', truth: '' },
      { from: 'pc-3', to: 'pc-1', rumor: '', truth: '' },
    ],
    bonds: [
      { id: 'bond-1', a: 'pc-1', b: 'pc-2', name: 'Shared Bond', detail: '', x: 450, y: 88 },
      { id: 'bond-2', a: 'pc-2', b: 'pc-3', name: 'Shared Bond', detail: '', x: 695, y: 385 },
      { id: 'bond-3', a: 'pc-3', b: 'pc-1', name: 'Shared Bond', detail: '', x: 205, y: 385 },
    ],
    facts: [
      { id: 'fact-1', name: 'World Fact', detail: '', pcId: 'pc-1', x: 92, y: 270 },
    ],
    event: {
      id: 'event-1',
      name: 'Opening Event',
      detail: '',
      x: 450,
      y: 295,
      targets: ['pc-1', 'bond-2'],
    },
    pool: [8, 8, 8, 8],
  };
}

let state = createDefaultState();

// ------------------------------------------------------------------ Persistence & URL
function readWorldFromSearch() {
  const params = new URLSearchParams(location.search);
  const p = Number(params.get('palette'));
  const s = Number(params.get('setting'));
  const t = Number(params.get('tone'));
  const u = Number(params.get('undertow'));
  const ud = params.get('undertow-dial');
  if (p >= 1 && p <= 8 && s >= 1 && s <= 8 && t >= 1 && t <= 8) {
    return {
      p, s, t,
      u: u >= 1 && u <= 8 ? u : d(8),
      ud: DIALS.includes(ud) ? ud : 'none',
    };
  }
  return null;
}

function encodeStateToHash(st) {
  const json = JSON.stringify({
    world: st.world,
    pcs: st.pcs,
    rumors: st.rumors,
    bonds: st.bonds,
    facts: st.facts,
    event: st.event,
    pool: st.pool,
  });
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeStateFromHash(hashStr) {
  if (!hashStr || !hashStr.startsWith('#state=')) return null;
  try {
    const b64 = hashStr.slice(7).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed && parsed.world && Array.isArray(parsed.pcs) && parsed.pcs.length >= 2) {
      return { ...createDefaultState(parsed.world), ...parsed };
    }
  } catch { /* ignore malformed hash */ }
  return null;
}

function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      world: state.world,
      pcs: state.pcs,
      rumors: state.rumors,
      bonds: state.bonds,
      facts: state.facts,
      event: state.event,
      pool: state.pool,
    }));
  } catch { /* storage unavailable */ }
}

function loadInitialState() {
  const fromHash = decodeStateFromHash(location.hash);
  if (fromHash) return fromHash;

  const urlWorld = readWorldFromSearch();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.world && Array.isArray(saved.pcs) && saved.pcs.length >= 2) {
        const merged = { ...createDefaultState(urlWorld || saved.world), ...saved };
        if (urlWorld) merged.world = urlWorld;
        return merged;
      }
    }
  } catch { /* ignore */ }

  return createDefaultState(urlWorld || { p: d(8), s: d(8), t: d(8), u: d(8), ud: DIALS[randomIndex(3)] });
}

// ------------------------------------------------------------------ Helpers
function getWord(dial, n) {
  if (dial === 'palette') return PALETTES[n]?.word || '';
  if (dial === 'setting') return SETTINGS[n]?.word || '';
  return TONES[n]?.word || '';
}

function worldPitchString(w = state.world) {
  return `${PALETTES[w.p].word} ${SETTINGS[w.s].word} ${TONES[w.t].word}`;
}

function worldUndertowString(w = state.world) {
  if (w.p === w.s && w.s === w.t && w.t === w.u) {
    return '4-of-a-Kind · Pure Archetype (run this row at max volume)';
  }
  if (!w.ud || w.ud === 'none') return 'No Undertow set';
  const targetVal = w.ud === 'palette' ? w.p : w.ud === 'setting' ? w.s : w.t;
  if (w.u === targetVal) {
    return `Matched Pair on ${DIAL_TITLES[w.ud]} · Double Down`;
  }
  return `Undertow: ${getWord(w.ud, w.u)} on ${DIAL_TITLES[w.ud]} (${UNDERTOW_MODES[w.ud]})`;
}

function syncBackLinks() {
  const w = state.world;
  const qs = `?palette=${w.p}&setting=${w.s}&tone=${w.t}&undertow-dial=${w.ud}&undertow=${w.u}`;
  for (const id of ['back-to-pitch', 'nav-pitch']) {
    const a = document.getElementById(id);
    if (a) a.href = `index.html${qs}`;
  }
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('table-toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function svgEl(tag, attrs = {}, text = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== null) el.textContent = text;
  return el;
}

function htmlEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function truncate(str, max = 22) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

// ------------------------------------------------------------------ Layout math
function tidyRingLayout() {
  const cx = 450;
  const cy = 310;
  const n = state.pcs.length;
  const rPc = n >= 4 ? 225 : 210;
  const rBond = n >= 4 ? 245 : 215;

  state.pcs.forEach((pc, i) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / n - Math.PI / n;
    pc.x = Math.round(cx + Math.cos(angle) * rPc);
    pc.y = Math.round(cy + Math.sin(angle) * rPc);
  });

  state.bonds.forEach((bond, i) => {
    const a = state.pcs.find((p) => p.id === bond.a);
    const b = state.pcs.find((p) => p.id === bond.b);
    if (a && b) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = mx - cx;
      const dy = my - cy;
      const len = Math.hypot(dx, dy) || 1;
      bond.x = Math.round(cx + (dx / len) * Math.min(rBond, len + 55));
      bond.y = Math.round(cy + (dy / len) * Math.min(rBond, len + 55));
    } else {
      bond.x = 180 + i * 110;
      bond.y = 540;
    }
  });

  state.facts.forEach((fact, i) => {
    const owner = state.pcs.find((p) => p.id === fact.pcId);
    if (owner) {
      const dx = owner.x - cx;
      const dy = owner.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const side = (i % 2 === 0 ? 1 : -1) * 55;
      fact.x = Math.max(70, Math.min(830, Math.round(owner.x + (dx / len) * 95 - (dy / len) * side)));
      fact.y = Math.max(65, Math.min(555, Math.round(owner.y + (dy / len) * 95 + (dx / len) * side)));
    }
  });

  state.event.x = cx;
  state.event.y = cy;
}

function rebuildRingWires() {
  const n = state.pcs.length;
  const oldRumors = new Map(state.rumors.map((r) => [`${r.from}->${r.to}`, r]));
  const oldBonds = new Map(state.bonds.map((b) => [`${b.a}-${b.b}`, b]));

  state.rumors = state.pcs.map((pc, i) => {
    const target = state.pcs[(i + 1) % n];
    const prev = oldRumors.get(`${pc.id}->${target.id}`);
    return prev || { from: pc.id, to: target.id, rumor: '', truth: '' };
  });

  state.bonds = state.pcs.map((pc, i) => {
    const next = state.pcs[(i + 1) % n];
    const prev = oldBonds.get(`${pc.id}-${next.id}`);
    if (prev) return prev;
    return {
      id: `bond-${i + 1}`,
      a: pc.id,
      b: next.id,
      name: 'Shared Bond',
      detail: '',
      x: Math.round((pc.x + next.x) / 2),
      y: Math.round((pc.y + next.y) / 2),
    };
  });
}

// ------------------------------------------------------------------ Render World Bar
function renderWorldBar() {
  const w = state.world;
  document.documentElement.style.setProperty('--pitch-p', `var(--d${w.p})`);
  document.documentElement.style.setProperty('--pitch-s', `var(--d${w.s})`);
  document.documentElement.style.setProperty('--pitch-t', `var(--d${w.t})`);
  document.documentElement.style.setProperty('--pitch-u', `var(--d${w.u})`);

  const title = document.getElementById('world-title');
  const sub = document.getElementById('world-undertow');
  const diceBox = document.getElementById('world-dice');

  if (title) title.textContent = worldPitchString(w);
  if (sub) sub.textContent = worldUndertowString(w);
  document.title = `${worldPitchString(w)} · Pathways Table`;

  if (diceBox) {
    diceBox.replaceChildren(
      ...[w.p, w.s, w.t, w.u].map((val, i) => {
        const dEl = htmlEl('span', 'mini-die', String(val));
        dEl.dataset.d = String(val);
        dEl.title = ['Palette', 'Setting', 'Tone', 'Undertow'][i];
        return dEl;
      }),
    );
  }
  syncBackLinks();
}

// ------------------------------------------------------------------ Render SVG Map
function getNodeCoords(id) {
  const pc = state.pcs.find((p) => p.id === id);
  if (pc) return { x: pc.x, y: pc.y, label: pc.name };
  const bond = state.bonds.find((b) => b.id === id);
  if (bond) return { x: bond.x, y: bond.y, label: bond.name };
  const fact = state.facts.find((f) => f.id === id);
  if (fact) return { x: fact.x, y: fact.y, label: fact.name };
  return null;
}

function renderMap() {
  const wireLayer = document.getElementById('layer-wires');
  const nodeLayer = document.getElementById('layer-nodes');
  if (!wireLayer || !nodeLayer) return;

  wireLayer.replaceChildren();
  nodeLayer.replaceChildren();

  // 1. Bond wires (PC <-> Bond <-> PC)
  for (const bond of state.bonds) {
    const a = state.pcs.find((p) => p.id === bond.a);
    const b = state.pcs.find((p) => p.id === bond.b);
    if (a) {
      wireLayer.append(svgEl('line', { class: 'wire-path wire--bond', x1: a.x, y1: a.y, x2: bond.x, y2: bond.y }));
    }
    if (b) {
      wireLayer.append(svgEl('line', { class: 'wire-path wire--bond', x1: b.x, y1: b.y, x2: bond.x, y2: bond.y }));
    }
  }

  // 2. Fact wires (Fact -> PC)
  for (const fact of state.facts) {
    const pc = state.pcs.find((p) => p.id === fact.pcId);
    if (pc) {
      wireLayer.append(svgEl('line', { class: 'wire-path wire--fact', x1: fact.x, y1: fact.y, x2: pc.x, y2: pc.y }));
    }
  }

  // 3. Rumor wires (curved slightly inward with clickable label pill)
  state.rumors.forEach((r, idx) => {
    const from = state.pcs.find((p) => p.id === r.from);
    const to = state.pcs.find((p) => p.id === r.to);
    if (!from || !to) return;

    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const cx = mx + (450 - mx) * 0.22;
    const cy = my + (310 - my) * 0.22;

    const path = svgEl('path', {
      class: 'wire-path wire--rumor',
      d: `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`,
      'marker-end': 'url(#arrow-rumor)',
    });
    path.addEventListener('click', () => selectItem('rumor', idx));
    wireLayer.append(path);

    const pillText = r.rumor ? truncate(r.rumor, 20) : 'Rumor';
    const pillW = Math.max(58, pillText.length * 6.8 + 16);
    const px = 0.25 * from.x + 0.5 * cx + 0.25 * to.x;
    const py = 0.25 * from.y + 0.5 * cy + 0.25 * to.y;
    const isSel = state.selected.kind === 'rumor' && state.selected.id === idx;

    const pill = svgEl('g', { class: `wire-pill${isSel ? ' is-selected' : ''}`, transform: `translate(${px}, ${py})` });
    pill.append(
      svgEl('rect', { x: -pillW / 2, y: -11, width: pillW, height: 22 }),
      svgEl('text', { x: 0, y: 0 }, pillText),
    );
    pill.addEventListener('click', () => selectItem('rumor', idx));
    wireLayer.append(pill);
  });

  // 4. Event ignition wires (marching vermilion lines)
  for (const targetId of state.event.targets) {
    const pt = getNodeCoords(targetId);
    if (!pt) continue;
    wireLayer.append(svgEl('line', {
      class: 'wire-path wire--event',
      x1: state.event.x,
      y1: state.event.y,
      x2: pt.x,
      y2: pt.y,
    }));
  }

  // 5. Render Bond Boxes
  for (const bond of state.bonds) {
    const isSel = state.selected.kind === 'bond' && state.selected.id === bond.id;
    const g = svgEl('g', {
      class: `map-node node--bond${isSel ? ' is-selected' : ''}`,
      transform: `translate(${bond.x}, ${bond.y})`,
      tabindex: '0',
      role: 'button',
      'aria-label': `Bond: ${bond.name}`,
    });
    if (isSel) g.append(svgEl('rect', { class: 'node-ring', x: -64, y: -27, width: 128, height: 54, rx: 10 }));
    g.append(
      svgEl('rect', { class: 'node-shape', x: -58, y: -21, width: 116, height: 42, rx: 6 }),
      svgEl('text', { class: 'node-label', x: 0, y: -2 }, truncate(bond.name || 'Bond', 15)),
      svgEl('text', { class: 'node-sub', x: 0, y: 13 }, 'd8 Support'),
    );
    attachNodeBehavior(g, 'bond', bond.id, bond);
    nodeLayer.append(g);
  }

  // 6. Render Fact Diamonds
  for (const fact of state.facts) {
    const isSel = state.selected.kind === 'fact' && state.selected.id === fact.id;
    const g = svgEl('g', {
      class: `map-node node--fact${isSel ? ' is-selected' : ''}`,
      transform: `translate(${fact.x}, ${fact.y})`,
      tabindex: '0',
      role: 'button',
      'aria-label': `Fact: ${fact.name}`,
    });
    if (isSel) g.append(svgEl('polygon', { class: 'node-ring', points: '0,-42 48,0 0,42 -48,0' }));
    g.append(
      svgEl('polygon', { class: 'node-shape', points: '0,-34 40,0 0,34 -40,0' }),
      svgEl('text', { class: 'node-label', x: 0, y: 4 }, truncate(fact.name || 'Fact', 11)),
      svgEl('text', { class: 'node-sub', x: 0, y: 48 }, 'Fact'),
    );
    attachNodeBehavior(g, 'fact', fact.id, fact);
    nodeLayer.append(g);
  }

  // 7. Render Inverted Event Triangle
  {
    const ev = state.event;
    const isSel = state.selected.kind === 'event';
    const g = svgEl('g', {
      class: `map-node node--event${isSel ? ' is-selected' : ''}`,
      transform: `translate(${ev.x}, ${ev.y})`,
      tabindex: '0',
      role: 'button',
      'aria-label': `Event: ${ev.name}`,
    });
    if (isSel) g.append(svgEl('polygon', { class: 'node-ring', points: '-56,-34 56,-34 0,56' }));
    g.append(
      svgEl('polygon', { class: 'node-shape', points: '-48,-28 48,-28 0,46' }),
      svgEl('text', { class: 'node-label', x: 0, y: -8 }, truncate(ev.name || 'Event', 13)),
      svgEl('text', { class: 'node-sub', x: 0, y: 8 }, 'Undertow'),
    );
    attachNodeBehavior(g, 'event', ev.id, ev);
    nodeLayer.append(g);
  }

  // 8. Render Character Circles (on top)
  for (const pc of state.pcs) {
    const isSel = state.selected.kind === 'pc' && state.selected.id === pc.id;
    const g = svgEl('g', {
      class: `map-node node--pc${isSel ? ' is-selected' : ''}`,
      transform: `translate(${pc.x}, ${pc.y})`,
      tabindex: '0',
      role: 'button',
      'aria-label': `Character: ${pc.name}`,
    });
    if (isSel) g.append(svgEl('circle', { class: 'node-ring', cx: 0, cy: 0, r: 53 }));
    g.append(
      svgEl('circle', { class: 'node-shape', cx: 0, cy: 0, r: 46 }),
      svgEl('text', { class: 'node-label', x: 0, y: -4 }, truncate(pc.name || 'PC', 12)),
    );
    const filled = [pc.texture, pc.foothold, pc.hook].filter(Boolean).length;
    g.append(svgEl('text', { class: 'node-sub', x: 0, y: 14 }, `${filled}/3 Distinctions`));

    if (pc.edge) {
      const edgeText = truncate(pc.edge, 13);
      const wPill = Math.max(52, edgeText.length * 6.5 + 14);
      const pill = svgEl('g', { class: 'node-edge-pill', transform: 'translate(0, 44)' });
      pill.append(
        svgEl('rect', { x: -wPill / 2, y: -9, width: wPill, height: 18 }),
        svgEl('text', { x: 0, y: 0 }, `${edgeText} d10`),
      );
      g.append(pill);
    }

    attachNodeBehavior(g, 'pc', pc.id, pc);
    nodeLayer.append(g);
  }
}

// ------------------------------------------------------------------ Dragging & Selection
function clientToSvg(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 450, y: 310 };
}

function attachNodeBehavior(g, kind, id, nodeObj) {
  const svg = document.getElementById('map-svg');
  let dragging = false;
  let moved = false;
  let offsetX = 0;
  let offsetY = 0;

  g.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    moved = false;
    g.classList.add('is-dragging');
    g.setPointerCapture(e.pointerId);
    const pos = clientToSvg(svg, e.clientX, e.clientY);
    offsetX = nodeObj.x - pos.x;
    offsetY = nodeObj.y - pos.y;
  });

  g.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const pos = clientToSvg(svg, e.clientX, e.clientY);
    const nx = Math.max(58, Math.min(842, Math.round(pos.x + offsetX)));
    const ny = Math.max(54, Math.min(566, Math.round(pos.y + offsetY)));
    if (Math.hypot(nx - nodeObj.x, ny - nodeObj.y) > 2) moved = true;
    nodeObj.x = nx;
    nodeObj.y = ny;
    renderMap();
  });

  const finishDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    g.classList.remove('is-dragging');
    try { g.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (moved) saveLocal();
    selectItem(kind, id);
  };

  g.addEventListener('pointerup', finishDrag);
  g.addEventListener('pointercancel', finishDrag);
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectItem(kind, id);
    }
  });
}

function selectItem(kind, id) {
  state.selected = { kind, id };
  renderMap();
  renderInspector();
}

// ------------------------------------------------------------------ Render Inspector
function makeField(labelText, hintText, value, onInput, { multiline = false, placeholder = '' } = {}) {
  const wrap = htmlEl('div', 'field');
  const id = `f-${Math.random().toString(36).slice(2, 8)}`;
  const label = htmlEl('label');
  label.htmlFor = id;
  label.textContent = labelText;
  if (hintText) {
    const hint = htmlEl('span', 'field__hint', ` · ${hintText}`);
    label.append(hint);
  }
  const input = document.createElement(multiline ? 'textarea' : 'input');
  if (!multiline) input.type = 'text';
  input.id = id;
  input.value = value || '';
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => {
    onInput(input.value);
    saveLocal();
    renderMap();
  });
  wrap.append(label, input);
  return wrap;
}

function renderInspector() {
  const titleEl = document.getElementById('inspector-title');
  const badgeEl = document.getElementById('inspector-badge');
  const body = document.getElementById('inspector-body');
  if (!titleEl || !badgeEl || !body) return;

  body.replaceChildren();
  const pInfo = PALETTES[state.world.p];
  const sInfo = SETTINGS[state.world.s];
  const tInfo = TONES[state.world.t];

  const { kind, id } = state.selected;

  if (kind === 'pc') {
    const pc = state.pcs.find((p) => p.id === id) || state.pcs[0];
    if (!pc) return;
    titleEl.textContent = pc.name || 'Character';
    badgeEl.textContent = 'Character Circle';

    body.append(
      makeField('Name', 'Pass 1', pc.name, (v) => { pc.name = v; titleEl.textContent = v || 'Character'; }),
      makeField(`${pInfo.prompt}`, `Palette (${pInfo.word}) · d8 Distinction`, pc.texture, (v) => { pc.texture = v; }, { placeholder: `Your ${pInfo.prompt.toLowerCase()}…` }),
      makeField(`${sInfo.prompt}`, `Setting (${sInfo.word}) · d8 Distinction`, pc.foothold, (v) => { pc.foothold = v; }, { placeholder: `Your ${sInfo.prompt.toLowerCase()}…` }),
      makeField(`${tInfo.prompt}`, `Tone (${tInfo.word}) · d8 Distinction`, pc.hook, (v) => { pc.hook = v; }, { placeholder: `Your ${tInfo.prompt.toLowerCase()}…` }),
    );

    // Pass 3 Edge select / input
    const edgeWrap = htmlEl('div', 'field');
    const edgeLabel = htmlEl('label');
    edgeLabel.htmlFor = 'pc-edge-select';
    edgeLabel.textContent = `Edge (Pass 3 · d10 in ${sInfo.set})`;
    const sel = document.createElement('select');
    sel.id = 'pc-edge-select';
    for (const trait of sInfo.traits) {
      const opt = document.createElement('option');
      opt.value = trait;
      opt.textContent = trait;
      if (pc.edge === trait) opt.selected = true;
      sel.append(opt);
    }
    sel.addEventListener('change', () => {
      pc.edge = sel.value;
      saveLocal();
      renderMap();
    });
    edgeWrap.append(edgeLabel, sel);
    body.append(edgeWrap);

    if (state.pcs.length > 2) {
      const actions = htmlEl('div', 'inspector__actions');
      const del = htmlEl('button', 'btn btn--danger', 'Remove PC');
      del.type = 'button';
      del.addEventListener('click', () => {
        state.pcs = state.pcs.filter((p) => p.id !== pc.id);
        state.event.targets = state.event.targets.filter((tid) => tid !== pc.id);
        state.facts.forEach((f) => { if (f.pcId === pc.id) f.pcId = state.pcs[0]?.id || ''; });
        rebuildRingWires();
        tidyRingLayout();
        state.selected = { kind: 'pc', id: state.pcs[0].id };
        saveLocal();
        renderAll();
      });
      actions.append(del);
      body.append(actions);
    }
    return;
  }

  if (kind === 'rumor') {
    const r = state.rumors[id];
    if (!r) return;
    const fromPc = state.pcs.find((p) => p.id === r.from);
    const toPc = state.pcs.find((p) => p.id === r.to);
    titleEl.textContent = `${fromPc?.name || 'PC'} → ${toPc?.name || 'PC'}`;
    badgeEl.textContent = 'Pass 2 · Rumor';

    body.append(
      makeField('What you heard', 'Public rumor', r.rumor, (v) => { r.rumor = v; }, { placeholder: 'They stole the beacon key…' }),
      makeField('The real truth', `${toPc?.name || 'Neighbor'} answers`, r.truth, (v) => { r.truth = v; }, { multiline: true, placeholder: 'It was never stolen; they hid it to save the crew.' }),
    );
    return;
  }

  if (kind === 'bond') {
    const bond = state.bonds.find((b) => b.id === id);
    if (!bond) return;
    const a = state.pcs.find((p) => p.id === bond.a);
    const b = state.pcs.find((p) => p.id === bond.b);
    titleEl.textContent = bond.name || 'Shared Bond';
    badgeEl.textContent = 'Pass 2 · d8 Support';

    body.append(
      htmlEl('p', 'muted', `Shared between ${a?.name || 'PC'} and ${b?.name || 'PC'}. Snaps onto both sheets as a d8 Support.`),
      makeField('Shared Bond', 'Ride, Hideout, Workshop, Beast, Patron', bond.name, (v) => { bond.name = v; titleEl.textContent = v || 'Shared Bond'; }),
      makeField('Traits / Notes', '2–3 d8 traits for this Support', bond.detail, (v) => { bond.detail = v; }, { multiline: true, placeholder: 'Fast, patched hull, owes dock fees…' }),
    );
    return;
  }

  if (kind === 'fact') {
    const fact = state.facts.find((f) => f.id === id);
    if (!fact) return;
    titleEl.textContent = fact.name || 'World Fact';
    badgeEl.textContent = 'Pass 3 · Fact Diamond';

    body.append(
      makeField('Fact / Faction / Goal', 'Seeds Prime Set 3', fact.name, (v) => { fact.name = v; titleEl.textContent = v || 'World Fact'; }),
      makeField('Details', 'Why it pulls at the character', fact.detail, (v) => { fact.detail = v; }, { multiline: true }),
    );

    const ownerWrap = htmlEl('div', 'field');
    const ownerLabel = htmlEl('label');
    ownerLabel.htmlFor = 'fact-owner';
    ownerLabel.textContent = 'Wired to Character';
    const sel = document.createElement('select');
    sel.id = 'fact-owner';
    for (const pc of state.pcs) {
      const opt = document.createElement('option');
      opt.value = pc.id;
      opt.textContent = pc.name;
      if (fact.pcId === pc.id) opt.selected = true;
      sel.append(opt);
    }
    sel.addEventListener('change', () => {
      fact.pcId = sel.value;
      saveLocal();
      renderMap();
    });
    ownerWrap.append(ownerLabel, sel);
    body.append(ownerWrap);

    const actions = htmlEl('div', 'inspector__actions');
    const del = htmlEl('button', 'btn btn--danger', 'Delete Fact');
    del.type = 'button';
    del.addEventListener('click', () => {
      state.facts = state.facts.filter((f) => f.id !== fact.id);
      state.event.targets = state.event.targets.filter((tid) => tid !== fact.id);
      state.selected = { kind: 'pc', id: state.pcs[0].id };
      saveLocal();
      renderAll();
    });
    actions.append(del);
    body.append(actions);
    return;
  }

  if (kind === 'event') {
    const ev = state.event;
    titleEl.textContent = ev.name || 'Opening Event';
    badgeEl.textContent = 'Pass 4 · Ignition';

    body.append(
      makeField('Event Title', 'Where the Undertow bites', ev.name, (v) => { ev.name = v; titleEl.textContent = v || 'Opening Event'; }),
      makeField('In medias res hook', 'Opening crisis for Scene 1', ev.detail, (v) => { ev.detail = v; }, { multiline: true, placeholder: 'The sirens cut out three minutes before docking…' }),
    );

    const wireBox = htmlEl('div', 'field');
    const wireLabel = htmlEl('label', '', 'Wired to 2+ nodes (click to toggle)');
    const chips = htmlEl('div', 'toggle-list');
    const candidates = [
      ...state.pcs.map((p) => ({ id: p.id, label: p.name })),
      ...state.bonds.map((b) => ({ id: b.id, label: b.name })),
      ...state.facts.map((f) => ({ id: f.id, label: f.name })),
    ];
    for (const c of candidates) {
      const btn = htmlEl('button', `toggle-chip${ev.targets.includes(c.id) ? ' is-wired' : ''}`, c.label);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (ev.targets.includes(c.id)) {
          ev.targets = ev.targets.filter((x) => x !== c.id);
        } else {
          ev.targets.push(c.id);
        }
        saveLocal();
        renderMap();
        renderInspector();
      });
      chips.append(btn);
    }
    wireBox.append(wireLabel, chips);
    body.append(wireBox);
  }
}

// ------------------------------------------------------------------ Render Compiled Cortex Sheets
function renderSheets() {
  const grid = document.getElementById('sheets-grid');
  const modBox = document.getElementById('sheets-engine-mod');
  if (!grid || !modBox) return;

  const pInfo = PALETTES[state.world.p];
  const sInfo = SETTINGS[state.world.s];
  const tInfo = TONES[state.world.t];

  modBox.replaceChildren();
  const modStrong = htmlEl('strong', '', `${pInfo.word} · ${pInfo.mod}: `);
  modBox.append(modStrong, document.createTextNode(pInfo.rule));

  grid.replaceChildren();

  for (const pc of state.pcs) {
    const card = htmlEl('article', 'cortex-sheet');

    // Header
    const head = htmlEl('div', 'cortex-sheet__head');
    head.append(
      htmlEl('h3', 'cortex-sheet__name', pc.name || 'Unnamed PC'),
      htmlEl('span', 'cortex-sheet__pp', '1 PP'),
    );
    card.append(head);

    // Prime Set 1: Distinctions
    const ps1 = htmlEl('div', 'trait-block');
    ps1.append(htmlEl('h4', '', 'Prime Set 1 · Distinctions (Hinder → d4 + 1 PP)'));
    const list1 = htmlEl('ul', 'trait-list');
    const distinctions = [
      { label: pInfo.prompt, val: pc.texture || `(${pInfo.prompt} — unfilled)` },
      { label: sInfo.prompt, val: pc.foothold || `(${sInfo.prompt} — unfilled)` },
      { label: tInfo.prompt, val: pc.hook || `(${tInfo.prompt} — unfilled)` },
    ];
    for (const dItem of distinctions) {
      const li = htmlEl('li', 'trait-item');
      li.append(htmlEl('span', '', `${dItem.label}: ${dItem.val}`), htmlEl('span', 'trait-die', 'd8'));
      list1.append(li);
    }
    ps1.append(list1);
    card.append(ps1);

    // Prime Set 2: Setting (with Pass 3 Edge slotted at d10)
    const ps2 = htmlEl('div', 'trait-block trait-block--cyan');
    ps2.append(htmlEl('h4', '', `Prime Set 2 · ${sInfo.set}`));
    const list2 = htmlEl('ul', 'trait-list');
    const orderedTraits = [...sInfo.traits];
    const edgeIdx = orderedTraits.indexOf(pc.edge);
    if (edgeIdx > 0) {
      orderedTraits.splice(edgeIdx, 1);
      orderedTraits.unshift(pc.edge);
    }
    orderedTraits.forEach((tr, i) => {
      const li = htmlEl('li', `trait-item${i === 0 ? ' is-top' : ''}`);
      li.append(
        htmlEl('span', '', i === 0 ? `${tr} (Pass 3 Edge)` : tr),
        htmlEl('span', 'trait-die', sInfo.dice[i] || 'd4'),
      );
      list2.append(li);
    });
    ps2.append(list2, htmlEl('p', 'muted', sInfo.extra));
    card.append(ps2);

    // Prime Set 3: Tone (seeded by Pass 2 Rumors & Pass 3 Facts)
    const ps3 = htmlEl('div', 'trait-block');
    ps3.append(htmlEl('h4', '', `Prime Set 3 · ${tInfo.set}`));
    const list3 = htmlEl('ul', 'trait-list');
    const pcFacts = state.facts.filter((f) => f.pcId === pc.id);
    const pcRumor = state.rumors.find((r) => r.from === pc.id || r.to === pc.id);

    tInfo.traits.forEach((tr, i) => {
      const li = htmlEl('li', `trait-item${i === 0 ? ' is-top' : ''}`);
      let label = tr;
      if (i === 0 && pcFacts[0]) label = `${tr} — ${pcFacts[0].name}`;
      if (i === 1 && pcRumor?.rumor) label = `${tr} — "${truncate(pcRumor.rumor, 28)}"`;
      li.append(htmlEl('span', '', label), htmlEl('span', 'trait-die', tInfo.dice[i] || 'd6'));
      list3.append(li);
    });
    ps3.append(list3, htmlEl('p', 'muted', tInfo.extra));
    card.append(ps3);

    // Shared Supports (Pass 2 Bonds)
    const pcBonds = state.bonds.filter((b) => b.a === pc.id || b.b === pc.id);
    if (pcBonds.length) {
      const sup = htmlEl('div', 'trait-block trait-block--gold');
      sup.append(htmlEl('h4', '', 'Shared Supports (Pass 2 Bonds)'));
      const listS = htmlEl('ul', 'trait-list');
      for (const b of pcBonds) {
        const li = htmlEl('li', 'trait-item');
        const txt = b.detail ? `${b.name} (${truncate(b.detail, 30)})` : b.name;
        li.append(htmlEl('span', '', txt), htmlEl('span', 'trait-die', 'd8'));
        listS.append(li);
      }
      sup.append(listS);
      card.append(sup);
    }

    grid.append(card);
  }
}

// ------------------------------------------------------------------ Render GM Scene 1 & Interactive Pool
function renderScene() {
  const title = document.getElementById('scene-event-title');
  const desc = document.getElementById('scene-event-desc');
  const wires = document.getElementById('scene-wires');
  const uBox = document.getElementById('scene-undertow-box');

  if (title) title.textContent = state.event.name || 'Opening Event';
  if (desc) {
    desc.textContent = state.event.detail
      || 'Drop into Scene 1 in medias res where the Undertow hits your wired nodes. Edit the Event Triangle on the Spaghetti Map to customize.';
  }

  if (wires) {
    wires.replaceChildren();
    for (const tid of state.event.targets) {
      const pt = getNodeCoords(tid);
      if (pt) wires.append(htmlEl('span', 'scene-wire-tag', pt.label));
    }
  }

  if (uBox) {
    uBox.replaceChildren();
    const uPalette = PALETTES[state.world.u];
    uBox.append(
      htmlEl('strong', '', `${worldUndertowString(state.world)}: `),
      document.createTextNode(`Contrast scenes can invoke ${uPalette.word} (${uPalette.mod}) — ${uPalette.rule}`),
    );
  }

  renderPool();
}

const DIE_STEPS = [4, 6, 8, 10, 12];

function renderPool() {
  const tray = document.getElementById('pool-tray');
  if (!tray) return;
  tray.replaceChildren();

  if (!state.pool.length) {
    tray.append(htmlEl('span', 'muted', 'Pool cleared! Click 4d8 Romp or Add d8 to rebuild.'));
    return;
  }

  state.pool.forEach((sides, idx) => {
    const btn = htmlEl('button', 'pool-die', `d${sides}`);
    btn.type = 'button';
    btn.dataset.sides = String(sides);
    btn.title = 'Click to step down; right-click to step up';
    btn.addEventListener('click', () => {
      const pos = DIE_STEPS.indexOf(sides);
      if (pos <= 0) {
        state.pool.splice(idx, 1);
      } else {
        state.pool[idx] = DIE_STEPS[pos - 1];
      }
      saveLocal();
      renderPool();
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pos = DIE_STEPS.indexOf(sides);
      if (pos < DIE_STEPS.length - 1) {
        state.pool[idx] = DIE_STEPS[pos + 1];
        saveLocal();
        renderPool();
      }
    });
    tray.append(btn);
  });
}

function rollOppositionPool() {
  const out = document.getElementById('pool-roll-out');
  if (!out) return;
  if (!state.pool.length) {
    out.textContent = 'No dice in the pool.';
    return;
  }
  const results = state.pool.map((sides) => ({ sides, roll: d(sides) }));
  const openings = results.filter((r) => r.roll === 1);
  const usable = results.filter((r) => r.roll > 1).sort((a, b) => b.roll - a.roll);
  const total = (usable[0]?.roll || 0) + (usable[1]?.roll || 0);
  const summary = results.map((r) => `d${r.sides}:${r.roll}`).join('  ');
  const openTxt = openings.length ? ` · ${openings.length} Opening${openings.length > 1 ? 's' : ''}!` : '';
  out.textContent = `[ ${summary} ] → Total ${total}${openTxt}`;
}

// ------------------------------------------------------------------ Sample Cast Generator
function populateSampleCast() {
  const w = state.world;
  const pInfo = PALETTES[w.p];
  const sInfo = SETTINGS[w.s];
  const tInfo = TONES[w.t];

  const textures = [
    `Marked by ${pInfo.word.toLowerCase()} ${pInfo.prompt.toLowerCase()}`,
    `Carries a borrowed ${pInfo.prompt.toLowerCase()}`,
    `Hiding a cracked ${pInfo.prompt.toLowerCase()}`,
  ];
  const footholds = [
    `${sInfo.word} ${sInfo.prompt.toLowerCase()} veteran`,
    `Exiled from the ${sInfo.prompt.toLowerCase()}`,
    `Keeping the ${sInfo.prompt.toLowerCase()} running`,
  ];
  const hooks = [
    `Can't let go of a ${tInfo.word.toLowerCase()} ${tInfo.prompt.toLowerCase()}`,
    `Sworn to settle an old ${tInfo.prompt.toLowerCase()}`,
    `Chasing one last ${tInfo.prompt.toLowerCase()}`,
  ];

  state.pcs = [0, 1, 2].map((i) => ({
    id: `pc-${i + 1}`,
    name: SAMPLE_NAMES[i],
    x: 0,
    y: 0,
    texture: textures[i],
    foothold: footholds[i],
    hook: hooks[i],
    edge: sInfo.traits[i % sInfo.traits.length],
  }));

  state.rumors = [
    { from: 'pc-1', to: 'pc-2', rumor: 'Walked out on the last job', truth: 'Stayed behind to burn the ledger.' },
    { from: 'pc-2', to: 'pc-3', rumor: 'Works for the rival syndicate', truth: 'Only trading favors to buy someone free.' },
    { from: 'pc-3', to: 'pc-1', rumor: 'Knows where the vault is', truth: 'Only holds half the map.' },
  ];

  state.bonds = [
    { id: 'bond-1', a: 'pc-1', b: 'pc-2', name: SAMPLE_BONDS[0], detail: 'Fast, loud, overdue on repairs', x: 0, y: 0 },
    { id: 'bond-2', a: 'pc-2', b: 'pc-3', name: SAMPLE_BONDS[1], detail: 'Hidden entrance, stocked bench', x: 0, y: 0 },
    { id: 'bond-3', a: 'pc-3', b: 'pc-1', name: SAMPLE_BONDS[2], detail: 'Grants passage, demands favors', x: 0, y: 0 },
  ];

  state.facts = [
    { id: 'fact-1', name: `${tInfo.word} Compact`, detail: `A fragile truce holding ${sInfo.word} together.`, pcId: 'pc-1', x: 0, y: 0 },
    { id: 'fact-2', name: `${pInfo.word} Market`, detail: 'Where secrets and salvage change hands.', pcId: 'pc-3', x: 0, y: 0 },
  ];

  const uWord = w.ud !== 'none' ? getWord(w.ud, w.u) : pInfo.word;
  state.event = {
    id: 'event-1',
    name: `${uWord} Breach`,
    detail: `The ${uWord.toLowerCase()} undertow spills straight into ${SAMPLE_BONDS[1]} right as the crew meets to split the take.`,
    x: 450,
    y: 310,
    targets: ['pc-1', 'bond-2', 'fact-1'],
  };

  tidyRingLayout();
  state.selected = { kind: 'pc', id: 'pc-1' };
  saveLocal();
  renderAll();
  showToast('Sample cast wired onto the mat');
}

// ------------------------------------------------------------------ Markdown Export
function buildMarkdown() {
  const pInfo = PALETTES[state.world.p];
  const sInfo = SETTINGS[state.world.s];
  const tInfo = TONES[state.world.t];
  const lines = [
    `# ${worldPitchString()}`,
    `_${worldUndertowString()}_`,
    '',
    `**Engine Mod:** ${pInfo.word} · ${pInfo.mod} — ${pInfo.rule}`,
    `**Prime Set 2:** ${sInfo.set} (${sInfo.traits.join(', ')})`,
    `**Prime Set 3:** ${tInfo.set} (${tInfo.traits.join(', ')})`,
    '',
    '## Cast',
  ];
  for (const pc of state.pcs) {
    lines.push(`### ${pc.name}`);
    lines.push(`- **${pInfo.prompt} (d8):** ${pc.texture || '—'}`);
    lines.push(`- **${sInfo.prompt} (d8):** ${pc.foothold || '—'}`);
    lines.push(`- **${tInfo.prompt} (d8):** ${pc.hook || '—'}`);
    lines.push(`- **Edge (d10):** ${pc.edge || '—'}`);
  }
  lines.push('', '## Bonds (d8 Supports)');
  for (const b of state.bonds) {
    const a = state.pcs.find((p) => p.id === b.a)?.name || '';
    const c = state.pcs.find((p) => p.id === b.b)?.name || '';
    lines.push(`- **${b.name}** (${a} & ${c})${b.detail ? `: ${b.detail}` : ''}`);
  }
  lines.push('', '## Rumors');
  for (const r of state.rumors) {
    const f = state.pcs.find((p) => p.id === r.from)?.name || '';
    const t = state.pcs.find((p) => p.id === r.to)?.name || '';
    lines.push(`- **${f} → ${t}:** ${r.rumor || '—'} _(Truth: ${r.truth || '—'})_`);
  }
  lines.push('', `## Opening Event: ${state.event.name}`);
  if (state.event.detail) lines.push(state.event.detail);
  return lines.join('\n');
}

// ------------------------------------------------------------------ View & Pass Switching
function setPass(passNum) {
  state.pass = Number(passNum);
  document.querySelectorAll('.pass-btn').forEach((btn) => {
    const active = Number(btn.dataset.pass) === state.pass;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  const hint = document.getElementById('pass-hint');
  if (hint) hint.textContent = PASS_HINTS[state.pass];

  if (state.pass === 1 && state.pcs[0]) selectItem('pc', state.pcs[0].id);
  if (state.pass === 2 && state.bonds[0]) selectItem('bond', state.bonds[0].id);
  if (state.pass === 3 && state.facts[0]) selectItem('fact', state.facts[0].id);
  if (state.pass === 4) selectItem('event', state.event.id);
}

function setView(viewName) {
  state.view = viewName;
  document.querySelectorAll('.view-btn').forEach((btn) => {
    const active = btn.dataset.view === viewName;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.getElementById('view-map').hidden = viewName !== 'map';
  document.getElementById('view-sheets').hidden = viewName !== 'sheets';
  document.getElementById('view-scene').hidden = viewName !== 'scene';
  if (viewName === 'sheets') renderSheets();
  if (viewName === 'scene') renderScene();
}

function renderAll() {
  renderWorldBar();
  renderMap();
  renderInspector();
  if (state.view === 'sheets') renderSheets();
  if (state.view === 'scene') renderScene();
}

// ------------------------------------------------------------------ Theme Toggle
{
  const themeBtn = document.getElementById('theme-toggle');
  const darkMql = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () =>
    document.documentElement.dataset.theme || (darkMql.matches ? 'dark' : 'light');

  themeBtn?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem('palette-theme', next); } catch { /* ignore */ }
  });
}

// ------------------------------------------------------------------ Wiring Events
state = loadInitialState();
renderAll();

document.querySelectorAll('.pass-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (state.view !== 'map') setView('map');
    setPass(btn.dataset.pass);
  });
});

document.querySelectorAll('.view-btn').forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

document.getElementById('btn-roll-world')?.addEventListener('click', () => {
  state.world = { p: d(8), s: d(8), t: d(8), u: d(8), ud: DIALS[randomIndex(3)] };
  const sTraits = SETTINGS[state.world.s].traits;
  state.pcs.forEach((pc, i) => { pc.edge = sTraits[i % sTraits.length]; });
  saveLocal();
  renderAll();
  showToast(`Rolled ${worldPitchString()}`);
});

document.getElementById('btn-sample-cast')?.addEventListener('click', populateSampleCast);

document.getElementById('btn-share-table')?.addEventListener('click', async () => {
  const w = state.world;
  const url = new URL(location.href);
  url.search = `?palette=${w.p}&setting=${w.s}&tone=${w.t}&undertow-dial=${w.ud}&undertow=${w.u}`;
  url.hash = `state=${encodeStateToHash(state)}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url.toString());
    showToast('Shareable table link copied');
  } catch {
    showToast('Table URL updated');
  }
});

document.getElementById('btn-export-md')?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(buildMarkdown());
    showToast('Campaign Markdown copied');
  } catch {
    showToast('Clipboard unavailable');
  }
});

document.getElementById('btn-print')?.addEventListener('click', () => {
  if (state.view === 'map') setView('sheets');
  window.print();
});

document.getElementById('btn-add-pc')?.addEventListener('click', () => {
  if (state.pcs.length >= 5) {
    showToast('Max 5 Character Circles on one mat');
    return;
  }
  const idx = state.pcs.length;
  const sTraits = SETTINGS[state.world.s].traits;
  const id = `pc-${Date.now().toString(36)}`;
  state.pcs.push({
    id,
    name: SAMPLE_NAMES[idx] || `Character ${idx + 1}`,
    x: 450,
    y: 310,
    texture: '',
    foothold: '',
    hook: '',
    edge: sTraits[idx % sTraits.length],
  });
  rebuildRingWires();
  tidyRingLayout();
  state.selected = { kind: 'pc', id };
  saveLocal();
  renderAll();
});

document.getElementById('btn-add-fact')?.addEventListener('click', () => {
  const id = `fact-${Date.now().toString(36)}`;
  const owner = state.selected.kind === 'pc' ? state.selected.id : state.pcs[0]?.id || '';
  state.facts.push({
    id,
    name: 'New Fact',
    detail: '',
    pcId: owner,
    x: 120 + (state.facts.length * 45) % 660,
    y: 520,
  });
  state.selected = { kind: 'fact', id };
  saveLocal();
  renderAll();
});

document.getElementById('btn-auto-layout')?.addEventListener('click', () => {
  tidyRingLayout();
  saveLocal();
  renderMap();
  showToast('Mat tidied');
});

document.getElementById('btn-roll-pool')?.addEventListener('click', rollOppositionPool);
document.getElementById('btn-add-die')?.addEventListener('click', () => {
  state.pool.push(8);
  saveLocal();
  renderPool();
});
document.getElementById('btn-preset-romp')?.addEventListener('click', () => {
  state.pool = [8, 8, 8, 8];
  saveLocal();
  renderPool();
});
document.getElementById('btn-preset-doom')?.addEventListener('click', () => {
  state.pool = [8, 6, 4];
  saveLocal();
  renderPool();
});
