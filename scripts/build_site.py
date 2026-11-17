"""One-off generator for site/index.html and site/styles.css (PaletteDesign).

The output is plain, hand-editable HTML/CSS; this script only exists to avoid
typos in the 8x3 repeated dial content and the :has() selector lists.
"""
import html
import re
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "site"
OUT.mkdir(parents=True, exist_ok=True)


def md(s: str) -> str:
    s = html.escape(s, quote=False)
    codes = []

    def keep(m):
        codes.append(m.group(1))
        return f"\x00{len(codes) - 1}\x00"

    s = re.sub(r"`([^`]+)`", keep, s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
    s = re.sub(r"\x00(\d+)\x00", lambda m: f"<code>{codes[int(m.group(1))]}</code>", s)
    return s


# ---------------------------------------------------------------- data
PALETTE = [
    ("Prismatic", "Reality-bleed, shifting hues.", "Warped", "Bleed",
     "Uncanny frames: `1`s & `2`s = Openings; `1 Chip` renames Highlight or Fallout."),
    ("Neon", "Rain-slick glow, overload.", "Vice", "Burnout",
     "Highlights expire in 1 roll (`1 Chip` sustains). **Lean In:** roll own Fallout, then step up."),
    ("Chrome", "Mirrored sheen, sterile polish.", "Pedigree", "Spec Sheet",
     "Two `d8` **Signature Assets** (*Gear Limit:* shut down for frame → `+1 Chip`)."),
    ("Dark", "Deep shadows, sodium-lit corners.", "Secret", "Doom Pool",
     "Escalating `d8, d6, d4` GM pool replaces static difficulty; grows on Openings, buys twists/Romps."),
    ("Sepia", "Brass warmth, weathered maps.", "Relic", "Living Serial",
     "Log **Session Titles**; 1/session invoke for free Chip or **Flashback**; cross off to advance."),
    ("Bright", "Sun-drenched, high-contrast skies.", "Banner", "Open Table",
     "**Zero GM Bank** (GM spends go to PCs) + allies share Highlights."),
    ("Pastel", "Soft light, hand-painted calm.", "Comfort", "Gentle Stakes",
     "Fallout steps down in quiet scenes; double GM `1`s = auto-success or step-down."),
    ("Rust", "Corroded iron, patched salvage.", "Scar", "Scarcity",
     "Two `2d6` **Salvage** dice (+1 Total die, expend). **Stricken:** Fallout > trait keeps 1 Total die."),
]
SETTING = [
    ("Threshold", "Liminal hubs, portals, crossroads.", "Crossed Over", "Arenas",
     "Arenas (`d10, d8, d6`): *Anchor, Transit, Beyond.*"),
    ("Future", "Wired sprawl, near-out tech.", "Augment", "Roles",
     "Roles (`d10, 2×d8, d6, d4`): *Hacker, Fixer, Operator, Tech, Face.*"),
    ("Space", "Jump-lanes, habitats, void transit.", "Hull / World", "Arenas + Ship",
     "Arenas (`d10, d8, d6`): *Void, Station, Worlds* + `d8` **Ship** (*Engines, Frame, Systems*)."),
    ("Modern", "Current streets & institutions.", "Day Job", "Roles",
     "Roles (`d10, d8, d6`): *Mouth, Mind, Muscle.*"),
    ("Industrial", "Coal smoke, ironworks, gears.", "Trade", "Guilds",
     "Guilds (`d10, 2×d8, 3×d6, 2×d4`): *Machinist, Saboteur, Alchemist, Bruiser, Broker, Medic, Scout, Orator.*"),
    ("Mythic", "Active gods, spirits, sacred realms.", "Calling", "Attributes",
     "Attributes (`d10, d8, d6`: *Might, Grace, Lore*) + **Calling Special** (`d6` Pressure die)."),
    ("Hearth", "Workshops, ovens, tended valleys.", "Workshop", "Crafts",
     "Crafts (`d10, 2×d8, 3×d6, 2×d4`: *Mend, Cook, Grow, Travel, Parley, Notice, Tinker, Ward*) + two `d6` Specialties."),
    ("Primal", "Megafauna, untamed wilds, bone.", "Pack / Kin", "Arenas + Beast",
     "Arenas (`d10, d8, d6`: *Camp, Wilds, Lair*) + `d8` **Beast/Pack** or **Trophy**."),
]
TONE = [
    ("Weird", "Uncanny mystery, impossible rules.", "Obsession", "Tether Drives",
     "Tether Drives (`d10, d8, 2×d6`: *Reward, Bond, Pride, Thrill*): Anchor statements; **Question** to **triple** die, step down & rewrite."),
    ("Punk", "Asymmetric revolt vs. system.", "Grievance", "Bloc Stances",
     "Bloc Stances (`d10, d8, d6` across 3 Factions): Faction stances; **Question** to **triple** die & fracture allegiance."),
    ("Adventure", "Bold crews, uncharted horizons.", "Horizon", "Horizon Values",
     "Horizon Values (`d10, 2×d8, 2×d6, d4`: *Daring, Cleverness, Crew, Wonder, Fortune, Duty*) + 3 **Goals** (`d6, d8, d10`)."),
    ("Noir", "Moral rot, compromised choices.", "Code", "Compromised Drives",
     "Compromised Drives (`d10, d8, d6, d4`: *Ambition, Trust, Dignity, Vice*): Statements fracture as the case corrupts."),
    ("Pulp", "Two-fisted stunts, cliffhangers.", "Trademark", "Action Modes",
     "Action Modes (`d10, d8, d6`: *Solo, Duo, Team*) + **Hero Dice** (win by 5+ to bank foe's top die)."),
    ("Heroic", "Clear stakes, shielding the weak.", "Oath", "Oath Values",
     "Oath Values (`d10, d8, 2×d6`: *Justice, Mercy, Courage, Truth*) + **Moral Support** (step down yours to step up an ally's)."),
    ("Cozy", "Mutual aid, mending rifts, routine.", "Routine", "Bonds",
     "Bonds (`d10, 2×d8, rest d6` to PCs/neighbors) + **Team Up** (lend Bond die risk-free)."),
    ("Peril", "Scarce safety, unforgiving hazards.", "Liability", "Nerve",
     "Nerve (`d10, d8, d6`: *Grit, Focus, Trust*) + **Trauma** (Fallout past `d12` leaves `d6` Trauma, needs recovery)."),
]
ARCHETYPE = [
    ("Liminal Surrealism", "Control, Piranesi"),
    ("Classic Cyberpunk", "Edgerunners, Akira"),
    ("Golden-Age Sci-Fi", "Star Trek, Mass Effect"),
    ("Hardboiled Crime", "Se7en, True Detective"),
    ("Gaslamp Serial", "The Mummy, Arcane"),
    ("High Mythic Fantasy", "Hades, Mononoke"),
    ("Pastoral Storycraft", "Kiki's, Wanderhome"),
    ("Grim Survival", "Mad Max, Scavengers Reign"),
]
DIALS = [
    ("p", "palette", "Palette", "Texture", PALETTE),
    ("s", "setting", "Setting", "Play space", SETTING),
    ("t", "tone", "Tone", "Drive", TONE),
]
UNDERTOW_MODES = {"p": "Divide", "s": "Layer", "t": "Counter-Beat"}


# ---------------------------------------------------------------- fragments
def chips(prefix, name, items):
    out = []
    for i, item in enumerate(items, 1):
        out.append(
            f'<input class="visually-hidden" type="radio" name="{name}" id="{prefix}{i}" value="{i}">'
            f'<label class="chip" for="{prefix}{i}" data-d="{i}">'
            f'<span class="chip__num">{i}</span><span class="chip__name">{item[0]}</span></label>'
        )
    return "\n            ".join(out)


def reveal_names(prefix, items, idx=0, cls="reveal"):
    return "".join(f'<span class="{cls}" data-{prefix}="{i}">{html.escape(it[idx])}</span>'
                   for i, it in enumerate(items, 1))


def undertow_groups():
    parts = []
    for prefix, _, label, _, items in DIALS:
        names = "".join(f'<span class="reveal" data-u="{i}">{html.escape(it[0])}</span>'
                        for i, it in enumerate(items, 1))
        parts.append(
            f'<span class="reveal" data-ud="{prefix}"><strong>'
            f'<span class="ph" data-ph="u">pick a number</span>{names}</strong> '
            f'on {label} <span class="muted">({UNDERTOW_MODES[prefix]})</span></span>'
        )
    return "".join(parts)


def matrix_rows():
    rows = []
    for i in range(1, 9):
        p, s, t, a = PALETTE[i - 1], SETTING[i - 1], TONE[i - 1], ARCHETYPE[i - 1]
        rows.append(
            f'<tr>\n'
            f'              <th scope="row" data-d="{i}"><span class="die">{i}</span></th>\n'
            f'              <td class="hl" data-p="{i}" data-d="{i}"><strong>{p[0]}:</strong> {md(p[1])}</td>\n'
            f'              <td class="hl" data-s="{i}" data-d="{i}"><strong>{s[0]}:</strong> {md(s[1])}</td>\n'
            f'              <td class="hl" data-t="{i}" data-d="{i}"><strong>{t[0]}:</strong> {md(t[1])}</td>\n'
            f'              <td class="hl arch" data-a="{i}" data-d="{i}"><strong>{a[0]}</strong> <em>({html.escape(a[1])})</em></td>\n'
            f'            </tr>'
        )
    return "\n            ".join(rows)


def prompt_rows():
    rows = []
    for i in range(1, 9):
        p, s, t = PALETTE[i - 1], SETTING[i - 1], TONE[i - 1]
        rows.append(
            f'<tr>\n'
            f'              <th scope="row" data-d="{i}"><span class="die">{i}</span></th>\n'
            f'              <td class="hl" data-p="{i}" data-d="{i}"><strong>{html.escape(p[2])}</strong> <em>({p[0]})</em></td>\n'
            f'              <td class="hl" data-s="{i}" data-d="{i}"><strong>{html.escape(s[2])}</strong> <em>({s[0]})</em></td>\n'
            f'              <td class="hl" data-t="{i}" data-d="{i}"><strong>{html.escape(t[2])}</strong> <em>({t[0]})</em></td>\n'
            f'            </tr>'
        )
    return "\n            ".join(rows)


def compiler_list(prefix, items):
    lis = []
    for i, it in enumerate(items, 1):
        if prefix == "p":
            body = f'<strong>{it[0]}</strong> <em>({it[3]})</em>: {md(it[4])}'
        else:
            body = f'<strong>{it[0]}</strong> — {md(it[4])}'
        lis.append(f'<li class="hl" data-{prefix}="{i}" data-d="{i}"><span class="die">{i}</span><p>{body}</p></li>')
    return "\n              ".join(lis)


def to(word):
    """Font Awesome arrow for sighted readers, a plain word for screen readers.

    Class names follow cortex-toolkit's self-hosted FA 6 subset (`fas fa-*`)."""
    return (f'<i class="fas fa-arrow-right" aria-hidden="true"></i>'
            f'<span class="visually-hidden">{word}</span>')


# Flat d8 diecon: same geometry and number placement as the cortex-toolkit
# DIECON_SPECS[8] (js/functions.ts) so the icons match once this page moves
# into characters.lynnjones.rocks.
D8_SYMBOL = """<svg class="sprite" aria-hidden="true" focusable="false">
    <symbol id="d8" viewBox="0 0 24 24">
      <polygon points="12,2.5 21.5,12 12,21.5 2.5,12" fill="currentColor"/>
    </symbol>
  </svg>"""


def hero_die(cls, label, num):
    return (f'<figure class="hero-die {cls}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
            f'<use href="#d8"/><text x="12" y="15.67" text-anchor="middle">{num}</text></svg>'
            f'<figcaption>{label}</figcaption></figure>')


# ---------------------------------------------------------------- page
page = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PaletteDesign — The 4d8 Setting Compiler</title>
  <meta name="description" content="Roll 4d8, compile a three-word world pitch, entangle your cast at Session Zero, and turn it into a Cortex Prime character sheet.">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#1a1718">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="fontawesome.css">
  <link rel="stylesheet" href="styles.css">
  <script src="app.js" type="module"></script>
</head>
<body>
  {D8_SYMBOL}
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="site-header">
    <div class="wrap site-header__inner">
      <a class="brand" href="#top" aria-label="PaletteDesign, back to top">
        <svg class="brand__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#d8"/></svg>
        <span>PaletteDesign</span>
      </a>
      <nav aria-label="Sections">
        <ul class="site-nav">
          <li><a href="#compile">Compile</a></li>
          <li><a href="#procedure">Procedure</a></li>
          <li><a href="#matrix">Matrix</a></li>
          <li><a href="#chemistry">Chemistry</a></li>
          <li><a href="#session-zero">Session Zero</a></li>
          <li><a href="#cortex">Cortex</a></li>
          <li><a href="#dial-compiler">Dial Compiler</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main id="main">
    <section class="hero" id="top" aria-labelledby="hero-title">
      <div class="wrap hero__inner">
        <div class="hero__copy">
          <p class="eyebrow eyebrow--gold">Combinatoric worldbuilding · by Lynn Jones</p>
          <h1 id="hero-title"><span class="hero__big">The 4d8</span> <span class="hero__sub">Setting Compiler</span></h1>
          <p class="hero__lede">Three words sell a world. Four d8s ignite a campaign.</p>
          <p class="hero__meta">System-neutral engine <span aria-hidden="true">|</span> Cortex Prime harness</p>
          <p><a class="button button--gold" href="#compile">Compile a world</a></p>
        </div>
        <div class="hero__dice" aria-hidden="true">
          {hero_die("hero-die--p", "Palette", 1)}
          {hero_die("hero-die--s", "Setting", 3)}
          {hero_die("hero-die--t", "Tone", 2)}
          {hero_die("hero-die--u", "Undertow", 6)}
        </div>
      </div>
    </section>

    <section class="band" id="compile" aria-labelledby="compile-title">
      <div class="wrap">
        <header class="section-head">
          <p class="section-head__num" aria-hidden="true">01</p>
          <h2 id="compile-title">Compile your pitch</h2>
          <p class="section-head__lede" id="compile-help">Roll {md("`4d8`")} once (no rerolls). Slot three dice into <strong>Palette</strong>, <strong>Setting</strong> and <strong>Tone</strong> in any order (<em>512 pitches</em>), then drop the fourth onto any Dial as the <strong>Undertow</strong>.</p>
        </header>

        <div class="compile-grid">
          <form class="pickers" id="compiler" method="get" action="#compile" aria-describedby="compile-help">
            <div class="roll-bar" data-requires-js hidden>
              <button type="button" class="button button--accent" id="roll">Roll 4d8</button>
              <output class="dice-tray" id="roll-result" for="roll" aria-live="polite"></output>
            </div>
            <noscript><p class="note">Pick each Dial by hand below. The dice roller needs JavaScript.</p></noscript>

            <fieldset class="dial" data-dial="p">
              <legend><span class="dial__name">Palette</span> <span class="dial__hint">Texture</span></legend>
              <div class="chips">
            {chips("p", "palette", PALETTE)}
              </div>
            </fieldset>

            <fieldset class="dial" data-dial="s">
              <legend><span class="dial__name">Setting</span> <span class="dial__hint">Play space</span></legend>
              <div class="chips">
            {chips("s", "setting", SETTING)}
              </div>
            </fieldset>

            <fieldset class="dial" data-dial="t">
              <legend><span class="dial__name">Tone</span> <span class="dial__hint">Drive</span></legend>
              <div class="chips">
            {chips("t", "tone", TONE)}
              </div>
            </fieldset>

            <fieldset class="dial dial--undertow">
              <legend><span class="dial__name">Undertow</span> <span class="dial__hint">4th die · friction</span></legend>
              <div class="segmented">
                <input class="visually-hidden" type="radio" name="undertow-dial" id="ud-none" value="none" checked>
                <label for="ud-none">None</label>
                <input class="visually-hidden" type="radio" name="undertow-dial" id="ud-p" value="palette">
                <label for="ud-p">On Palette</label>
                <input class="visually-hidden" type="radio" name="undertow-dial" id="ud-s" value="setting">
                <label for="ud-s">On Setting</label>
                <input class="visually-hidden" type="radio" name="undertow-dial" id="ud-t" value="tone">
                <label for="ud-t">On Tone</label>
              </div>
              <div class="chips chips--numbers">
                {"".join(f'<input class="visually-hidden" type="radio" name="undertow" id="u{i}" value="{i}"><label class="chip chip--num" for="u{i}" data-d="{i}" aria-label="Undertow die {i}"><span class="chip__num">{i}</span></label>' for i in range(1, 9))}
              </div>
            </fieldset>

            <p class="form-actions"><button type="submit" class="button button--ghost" data-requires-js hidden>Save link to this pitch</button> <button type="reset" class="button button--ghost">Clear dials</button></p>
          </form>

          <aside class="pitch-card" aria-labelledby="pitch-heading">
            <p class="eyebrow">Your pitch</p>
            <h3 class="pitch-title" id="pitch-heading" tabindex="-1">
              <span class="slot" data-dial="p"><span class="ph" data-ph="p">Palette</span>{reveal_names("p", PALETTE)}</span>
              <span class="slot" data-dial="s"><span class="ph" data-ph="s">Setting</span>{reveal_names("s", SETTING)}</span>
              <span class="slot" data-dial="t"><span class="ph" data-ph="t">Tone</span>{reveal_names("t", TONE)}</span>
            </h3>
            <p class="pitch-undertow"><span class="ph" data-ph="ud">No Undertow yet.</span><span class="reveal-wrap">Undertow: {undertow_groups()}</span></p>
            <p class="pitch-status" id="pitch-status" role="status">
              <span class="status-msg" data-status="deep"><strong>Matched Pair {to("becomes")} Deep Note.</strong> Double down on that Dial's extreme; zero dilution.</span>
              <span class="status-msg" data-status="archetype"><strong>4-of-a-Kind {to("becomes")} Pure Archetype.</strong> Skip the Undertow; run the row straight at max volume.</span>
            </p>
            <dl class="pitch-facts">
              <div><dt>Identity prompts</dt><dd>
                <span class="fact"><span class="muted">Texture</span> <span class="ph" data-ph="p">—</span>{reveal_names("p", PALETTE, 2)}</span>
                <span class="fact"><span class="muted">Place</span> <span class="ph" data-ph="s">—</span>{reveal_names("s", SETTING, 2)}</span>
                <span class="fact"><span class="muted">Hook</span> <span class="ph" data-ph="t">—</span>{reveal_names("t", TONE, 2)}</span>
              </dd></div>
              <div><dt>Engine Mod</dt><dd><span class="ph" data-ph="p">—</span>{reveal_names("p", PALETTE, 3)}</dd></div>
              <div><dt>Prime Set 2</dt><dd><span class="ph" data-ph="s">—</span>{reveal_names("s", SETTING, 3)}</dd></div>
              <div><dt>Prime Set 3</dt><dd><span class="ph" data-ph="t">—</span>{reveal_names("t", TONE, 3)}</dd></div>
            </dl>
            <p class="pitch-links"><a href="#session-zero">Run Session Zero</a> <a href="#dial-compiler">See the compiled sheet</a></p>
          </aside>
        </div>
      </div>
    </section>

    <section class="band band--alt" id="procedure" aria-labelledby="procedure-title">
      <div class="wrap">
        <header class="section-head">
          <p class="section-head__num" aria-hidden="true">02</p>
          <h2 id="procedure-title">The 4d8 procedure</h2>
        </header>
        <ol class="steps">
          <li><strong>Roll</strong> {md("`4d8`")} once. No rerolls.</li>
          <li><strong>Slot</strong> any three dice into Palette, Setting and Tone.</li>
          <li><strong>Drop</strong> the fourth onto any Dial as the Undertow.</li>
        </ol>

        <h3 class="subhead">The Undertow · 4th die friction</h3>
        <div class="cards cards--3">
          <article class="card mode hl" data-ud="p" data-d="1">
            <h4>On Palette <span class="tag">Divide</span></h4>
            <p>Split class, zone, or day/night (<em>Chrome spires, Rust slums</em>).</p>
          </article>
          <article class="card mode hl" data-ud="s" data-d="3">
            <h4>On Setting <span class="tag">Layer</span></h4>
            <p>Stack or collide play spaces (<em>Modern streets, Mythic spirits</em>).</p>
          </article>
          <article class="card mode hl" data-ud="t" data-d="2">
            <h4>On Tone <span class="tag">Counter-Beat</span></h4>
            <p>Contrast front vs. stakes, or wilds vs. home (<em>Peril wilds, Cozy camp</em>).</p>
          </article>
        </div>

        <div class="cards cards--2">
          <div class="callout callout--gold">
            <h3>Matched Pair {to("becomes")} Deep Note</h3>
            <p>Undertow lands on its own number? Double down on that Dial's extreme; zero dilution.</p>
          </div>
          <div class="callout callout--vermilion">
            <h3>4-of-a-Kind ({md("`N-N-N-N`")}) {to("becomes")} Pure Archetype</h3>
            <p>Skip the Undertow; run that row straight at max volume.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="band" id="matrix" aria-labelledby="matrix-title">
      <div class="wrap">
        <header class="section-head">
          <p class="section-head__num" aria-hidden="true">03</p>
          <h2 id="matrix-title">The Master Dial Matrix</h2>
          <p class="section-head__lede">Roll 4d8 · assign in any order. Your picks light up below.</p>
        </header>
        <section class="table-scroll" aria-labelledby="matrix-caption" tabindex="0">
          <table class="matrix">
            <caption id="matrix-caption" class="visually-hidden">Master Dial Matrix: each d8 result for Palette, Setting and Tone, plus the pure archetype for four of a kind</caption>
            <thead>
              <tr>
                <th scope="col">d8</th>
                <th scope="col">1 · Palette <span class="th-hint">Texture</span></th>
                <th scope="col">2 · Setting <span class="th-hint">Space</span></th>
                <th scope="col">3 · Tone <span class="th-hint">Drive</span></th>
                <th scope="col">Pure Archetype <span class="th-hint">N-N-N-N</span></th>
              </tr>
            </thead>
            <tbody>
            {matrix_rows()}
            </tbody>
          </table>
        </section>
      </div>
    </section>

    <section class="band band--alt" id="chemistry" aria-labelledby="chemistry-title">
      <div class="wrap">
        <header class="section-head">
          <p class="section-head__num" aria-hidden="true">04</p>
          <h2 id="chemistry-title">World chemistry</h2>
          <p class="section-head__lede">Pitch paints the cover; <strong>chemistry</strong> drives play. Regulate four <strong>DOSE</strong> needs—<strong>Chemically</strong> <em>(visceral)</em> or <strong>Mystically</strong> <em>(divine)</em>.</p>
        </header>
        <ul class="cards cards--4 dose">
          <li class="card dose__card" data-d="5"><h3><span class="dose__letter">D</span> Dopamine</h3><p class="tag">Transactional</p><p>Reward, ambition, scrip, leverage.</p></li>
          <li class="card dose__card" data-d="2"><h3><span class="dose__letter">O</span> Oxytocin</h3><p class="tag">Relational</p><p>Trust, kinship, belonging, safe harbor.</p></li>
          <li class="card dose__card" data-d="3"><h3><span class="dose__letter">S</span> Serotonin</h3><p class="tag">Positional</p><p>Dignity, pride, <em>community credit</em>.</p></li>
          <li class="card dose__card" data-d="7"><h3><span class="dose__letter">E</span> Endorphins</h3><p class="tag">Physical</p><p>Thrill, hunger, pleasure, relief.</p></li>
        </ul>

        <article class="feature">
          <h3>Step 1: Flood &amp; Starve</h3>
          <ol class="feature__list">
            <li><strong>Flood</strong> <em>(Palette + Setting)</em>: 1–2 cheap, abundant DOSE needs <em>(Neon Future: Endorphins, Dopamine)</em>.</li>
            <li><strong>Starve</strong> <em>(Tone)</em>: Rationed or corrupted DOSE need <em>(Punk: Serotonin, Oxytocin)</em>.</li>
          </ol>
          <p class="core-loop"><strong>Core loop:</strong> Hustle the <em>Flood</em> to survive; risk everything for the <em>Starve</em>.</p>
        </article>
      </div>
    </section>

    <section class="band" id="session-zero" aria-labelledby="session-zero-title">
      <div class="wrap">
        <header class="section-head">
          <p class="section-head__num" aria-hidden="true">05</p>
          <h2 id="session-zero-title">Session Zero “Spaghetti Knot”</h2>
          <p class="section-head__lede">Center your Pitch + Undertow on a blank sheet; run three passes.</p>
        </header>

        <div class="knot-grid">
          <div>
            <h3 class="subhead">Pass 1: Identity prompts</h3>
            <p>Place a <strong>Rectangle (PC Name)</strong> on the edge; answer your three Dial prompts. Your picks are highlighted.</p>
            <section class="table-scroll" aria-labelledby="prompts-caption" tabindex="0">
              <table class="matrix matrix--compact">
                <caption id="prompts-caption" class="visually-hidden">Identity prompts for each d8 result on each Dial</caption>
                <thead>
                  <tr><th scope="col">d8</th><th scope="col">Palette <span class="th-hint">Texture</span></th><th scope="col">Setting <span class="th-hint">Place / Craft</span></th><th scope="col">Tone <span class="th-hint">Hook</span></th></tr>
                </thead>
                <tbody>
            {prompt_rows()}
                </tbody>
              </table>
            </section>

            <h3 class="subhead">Pass 2: Cross the wires</h3>
            <ul class="bullets">
              <li><strong>Left</strong> <em>(Credit)</em>: Declare your left neighbor's public credit—and the messy truth.</li>
              <li><strong>Right</strong> <em>(Anchor)</em>: Link right with a shared <strong>Diamond</strong> (<em>Ride, Hideout, Workshop, Beast, Patron</em>).</li>
            </ul>

            <h3 class="subhead">Pass 3: Ignition triangle</h3>
            <p>GM drops a central <strong>Triangle (Situation)</strong> tied to the <em>Starve</em>, wired to 2+ nodes. Start <em>in medias res</em>.</p>
          </div>

          <figure class="knot-figure">
            <svg viewBox="0 0 320 260" role="img" aria-labelledby="knot-title knot-desc">
              <title id="knot-title">Spaghetti-knot map schematic</title>
              <desc id="knot-desc">PC A, PC B and PC C are linked by Credit wires. A shared Anchor diamond sits between PC B and PC C. A central Starve triangle is wired to PC A and the Anchor.</desc>
              <g class="wire wire--credit">
                <line x1="60" y1="50" x2="260" y2="50"/>
                <line x1="60" y1="50" x2="160" y2="215"/>
              </g>
              <g class="wire wire--anchor">
                <line x1="260" y1="50" x2="240" y2="135"/>
                <line x1="240" y1="135" x2="160" y2="215"/>
              </g>
              <g class="wire wire--ignite">
                <line x1="150" y1="122" x2="60" y2="50"/>
                <line x1="150" y1="122" x2="240" y2="135"/>
              </g>
              <g class="node node--pc"><rect x="22" y="34" width="76" height="32" rx="6"/><text x="60" y="55">PC A</text></g>
              <g class="node node--pc"><rect x="222" y="34" width="76" height="32" rx="6"/><text x="260" y="55">PC B</text></g>
              <g class="node node--pc"><rect x="122" y="199" width="76" height="32" rx="6"/><text x="160" y="220">PC C</text></g>
              <g class="node node--anchor"><polygon points="240,113 262,135 240,157 218,135"/><text class="label" x="240" y="175">ANCHOR</text></g>
              <g class="node node--ignite"><polygon points="150,98 176,142 124,142"/><text class="label" x="150" y="160">STARVE</text></g>
              <text class="label label--credit" x="160" y="40">CREDIT</text>
            </svg>
            <figcaption>
              <span><svg viewBox="0 0 20 14" aria-hidden="true"><rect x="1" y="1" width="18" height="12" rx="2"/></svg> PC Name</span>
              <span><svg viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,1 15,8 8,15 1,8"/></svg> Anchor</span>
              <span><svg viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,1 15,15 1,15"/></svg> Ignition</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section class="band band--cortex" id="cortex" aria-labelledby="cortex-title">
      <div class="wrap">
        <header class="section-head">
          <p class="section-head__num" aria-hidden="true">06</p>
          <h2 id="cortex-title">Opinionated Cortex harness</h2>
          <p class="section-head__lede">Compile any {md("`4d8`")} pitch into fast <strong>Cortex Prime</strong> on a clean 3-Prime-Set sheet.</p>
        </header>

        <figure class="equation">
          <figcaption>Baseline pool equation <span class="muted">· + Assets, Resources, Foe Fallout</span></figcaption>
          <ol class="equation__terms">
            <li class="term term--magenta"><span>1 · Distinction</span><code>d8 / d4</code></li>
            <li class="term"><span>2 · Setting</span><code>Prime 2</code></li>
            <li class="term"><span>3 · Tone</span><code>Prime 3</code></li>
          </ol>
          <span class="equation__arrow">{to("gives")}</span>
          <ul class="equation__results">
            <li class="result result--magenta"><strong>1s</strong> Openings</li>
            <li class="result"><strong>Sum 2</strong> Total</li>
            <li class="result"><strong>1 die size</strong> Impact d6–d12</li>
          </ul>
        </figure>

        <div class="cortex-grid">
          <div>
            <div class="callout callout--magenta">
              <h3>Openings (Hitches)</h3>
              <p>Set {md("`1`")}s aside (not Total/Impact). Foes—or PCs with {md("`1 Chip`")}—seize one for {md("`d6`")} Fallout, a step-up, or an edge. GM pays {md("`1 Chip`")} to seize yours.</p>
            </div>

            <h3 class="subhead">Three conflict speeds</h3>
            <div class="speeds">
              <details class="speed" name="speed" open>
                <summary><span class="speed__num">01</span> Roll <span class="muted">· single test</span></summary>
                <p>One toss vs. GM ({md("`2d6`")} + traits, or Doom Pool). High Total wins; <strong>instigator wins ties</strong>.</p>
              </details>
              <details class="speed speed--magenta" name="speed">
                <summary><span class="speed__num">02</span> Row <span class="muted">· escalating contest</span></summary>
                <p>Beat the lead Total to take control, or <strong>Concede</strong> on your terms ({md("`+1 Chip`")}). Failing inflicts winner's Impact as Fallout.</p>
              </details>
              <details class="speed" name="speed">
                <summary><span class="speed__num">03</span> Romp <span class="muted">· multi-die challenge</span></summary>
                <p>Roll vs. central <strong>Romp Pool</strong> ({md("`4d8`")}). Win + Impact <strong>&gt;</strong> Romp die drops it; <strong>≤</strong> steps down smallest ({md("`d4`")} gone). Romp acts last.</p>
              </details>
            </div>
          </div>

          <div>
            <h3 class="subhead">Four house cuts</h3>
            <ul class="bullets bullets--cortex">
              <li><strong>Full-Force Hits:</strong> Never compare Impact vs. loser's Effect Die. Win Total, land full Impact.</li>
              <li><strong>Real Fallout Only:</strong> Starts at {md("`d6`")} (no {md("`d4`")} Chip-farming). Past {md("`d12`")} drops out of frame.</li>
              <li><strong>In-Pool Resources:</strong> Roll inside pool to <strong>keep +1 Total die</strong>, then expend until recovery.</li>
              <li><strong>Side Chars</strong> <em>(Session 0)</em>: Shared Diamonds hold 2–3 {md("`d8`")} traits; swap up to 2 and absorb fitting Fallout.</li>
            </ul>

            <article class="feature feature--cortex">
              <h3>Prime Set 1: Distinctions</h3>
              <p>Write <strong>three</strong> {md("`d8`")} <strong>Distinctions</strong> titled after your world's <a href="#session-zero">Identity Prompts</a> (<em>Texture · Place · Hook</em>).</p>
              <p class="core-loop core-loop--cortex"><strong>Universal Hinder rule:</strong> Roll any Distinction as {md("`d4`")} instead of {md("`d8`")} to gain {md("`1 Chip`")}.</p>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section class="band band--cortex-alt" id="dial-compiler" aria-labelledby="dial-compiler-title">
      <div class="wrap">
        <header class="section-head">
          <p class="section-head__num" aria-hidden="true">07</p>
          <h2 id="dial-compiler-title">Cortex Dial Compiler</h2>
          <p class="section-head__lede">Match three Dials for <strong>Engine Mod</strong>, <strong>Prime Set 2</strong> and <strong>Prime Set 3</strong>. <strong>Undertow (4th die):</strong> gain 1 shared {md("`d8`")} Side Char / Special, OR apply its Engine Mod in contrast scenes.</p>
        </header>

        <div class="compiler-grid">
          <section class="compiler-col" aria-labelledby="engine-title">
            <h3 id="engine-title" class="col-head col-head--cyan">1 · Palette {to("feeds")} Engine Mod</h3>
            <ol class="ref-list">
              {compiler_list("p", PALETTE)}
            </ol>
          </section>
          <section class="compiler-col" aria-labelledby="prime2-title">
            <h3 id="prime2-title" class="col-head col-head--cyan">2 · Setting {to("feeds")} Prime Set 2</h3>
            <ol class="ref-list">
              {compiler_list("s", SETTING)}
            </ol>
          </section>
          <section class="compiler-col" aria-labelledby="prime3-title">
            <h3 id="prime3-title" class="col-head col-head--magenta">3 · Tone {to("feeds")} Prime Set 3</h3>
            <ol class="ref-list">
              {compiler_list("t", TONE)}
            </ol>
          </section>
        </div>

        <h3 class="subhead">Quick-compile examples</h3>
        <div class="cards cards--2">
          <article class="card example">
            <h4><code>8·3·2 [+5]</code> Rust Space Punk <em>(Sepia)</em></h4>
            <p><em>Sheet:</em> Distinctions (<em>Scar / Hull / Grievance</em>) + Void Arenas &amp; Ship + 3 Bloc Stances.</p>
            <p><em>Engine:</em> {md("`2d6`")} Salvage, Stricken, pre-war Flashbacks.</p>
            <p data-requires-js hidden><button type="button" class="button button--ghost" data-preset="8 3 2 palette 5">Load this pitch</button></p>
          </article>
          <article class="card example">
            <h4><code>6·8·3 [+7]</code> Bright Primal Adventure <em>(Cozy)</em></h4>
            <p><em>Sheet:</em> Distinctions (<em>Banner / Pack / Horizon</em>) + Survival Arenas &amp; {md("`d8`")} Beast + Horizon Values.</p>
            <p><em>Engine:</em> Open Table Chips &amp; campfire recovery.</p>
            <p data-requires-js hidden><button type="button" class="button button--ghost" data-preset="6 8 3 tone 7">Load this pitch</button></p>
          </article>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="wrap site-footer__inner">
      <p><strong>PaletteDesign</strong> · The 4d8 Setting Compiler · by Lynn Jones</p>
      <p class="muted">System-neutral engine · Cortex Prime compatible</p>
    </div>
  </footer>
</body>
</html>
"""

# ---------------------------------------------------------------- selection CSS
reveal_sel, hl_sel = [], []
for prefix, name, *_ in DIALS:
    for n in range(1, 9):
        reveal_sel.append(f':root:has(#{prefix}{n}:checked) .reveal[data-{prefix}="{n}"]')
        hl_sel.append(f':root:has(#{prefix}{n}:checked) .hl[data-{prefix}="{n}"]')
for n in range(1, 9):
    reveal_sel.append(f':root:has(#u{n}:checked) .reveal[data-u="{n}"]')
for x in ("p", "s", "t"):
    reveal_sel.append(f':root:has(#ud-{x}:checked) .reveal[data-ud="{x}"]')
    hl_sel.append(f':root:has(#ud-{x}:checked) .hl[data-ud="{x}"]')
for n in range(1, 9):
    hl_sel.append(f':root:has(#p{n}:checked):has(#s{n}:checked):has(#t{n}:checked):has(#u{n}:checked) .hl[data-a="{n}"]')

status_sel = {"archetype": [], "deep": []}
for n in range(1, 9):
    status_sel["archetype"].append(
        f':root:has(#p{n}:checked):has(#s{n}:checked):has(#t{n}:checked):has(#u{n}:checked) .status-msg[data-status="archetype"]')
    for x in ("p", "s", "t"):
        status_sel["deep"].append(
            f':root:has(#ud-{x}:checked):has(#u{n}:checked):has(#{x}{n}:checked) .status-msg[data-status="deep"]')

selection_css = (
    "/* ---- Selection state (generated lists; pure CSS :has()) ---- */\n"
    + ",\n".join(reveal_sel) + " {\n  display: revert;\n}\n\n"
    + ",\n".join(hl_sel) + " {\n"
    "  background: color-mix(in oklab, var(--dial) 16%, var(--surface));\n"
    "  box-shadow: inset 0.3rem 0 0 var(--dial);\n"
    "}\n\n"
    ':root:has([name="palette"]:checked) .ph[data-ph="p"],\n'
    ':root:has([name="setting"]:checked) .ph[data-ph="s"],\n'
    ':root:has([name="tone"]:checked) .ph[data-ph="t"],\n'
    ':root:has([name="undertow"]:checked) .ph[data-ph="u"],\n'
    ':root:has([name="undertow-dial"]:checked:not(#ud-none)) .ph[data-ph="ud"] {\n'
    "  display: none;\n}\n\n"
    ':root:has(#ud-none:checked) .reveal-wrap {\n  display: none;\n}\n\n'
    ':root:has(#ud-none:checked) .chips--numbers {\n  opacity: 0.55;\n}\n\n'
    + ",\n".join(status_sel["deep"]) + ",\n"
    + ",\n".join(status_sel["archetype"]) + " {\n  display: block;\n}\n\n"
    + ",\n".join(s.replace('.status-msg[data-status="archetype"]', '.status-msg[data-status="deep"]')
                 for s in status_sel["archetype"]) + " {\n  display: none;\n}\n"
)

css_template = Path(__file__).with_name("styles_template.css").read_text(encoding="utf-8")
styles = css_template.replace("/*__SELECTION__*/", selection_css)

# Guard: UTF-8 text that was once decoded as Windows-1252 shows up as
# a-circumflex + euro ("\u00e2\u20ac"), A-circumflex + middot, A-tilde + dash, or
# stray C1 controls. Fail the build instead of shipping it again. (Escapes only,
# so this line can never be mangled the same way.)
MOJIBAKE = re.compile(
    "[\u0080-\u009f]|\u00e2[\u20ac\u2020\u2030]|\u00c2[\u00a0-\u00bf]|\u00c3[\u0080-\u00bf\u2013\u2014]")
for label, text in (("index.html", page), ("styles.css", styles)):
    bad = MOJIBAKE.search(text)
    if bad:
        line = text.count("\n", 0, bad.start()) + 1
        raise SystemExit(f"mojibake in {label} line {line}: {text[bad.start():bad.start() + 20]!r}")

(OUT / "styles.css").write_text(styles, encoding="utf-8")
(OUT / "index.html").write_text(page, encoding="utf-8")
print("wrote", OUT / "index.html", OUT / "styles.css")
