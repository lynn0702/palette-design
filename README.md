# 4d8 Worlds

_Find your Palette. Dial in your Setting. Strike a Tone._

Live interactive reference & dice roller: **https://palette.lynnjones.rocks/**

## What's in This Repo

- [`site/`](site/) — Zero-framework static web app (`index.html`, `styles.css`, `app.js`) deployed to GitHub Pages via [`.github/workflows/publish.yml`](.github/workflows/publish.yml). All dial state, highlighting, Matched Pair, and 4-of-a-Kind detection run declaratively through native radio inputs and CSS `:has()`; `app.js` adds the `4d8` roller, slow-write hero reveal, shareable pitch URLs, and sample presets.
- [`4D_Combinatoric_Worldbuilding.md`](4D_Combinatoric_Worldbuilding.md) — Plain-text zine extract synced with `site/index.html` (16-page A5 zine: Pages 1–7 System-Neutral Engine; Pages 8–16 House Ruled Cortex).
- [`scripts/`](scripts/) — Affinity Publisher automation helpers (`affinity.ts`, `affinity-ui.ts`, `affinity-mcp-bridge.mjs`), the 16-page A5 zine generator (`build_zine.js`), and the 2-up A4 / US Letter saddle-stitch imposer (`impose_zine.py`). See [`scripts/README.md`](scripts/README.md) for setup.

## Local Preview & Validation

```powershell
python -m http.server 3001 --bind 127.0.0.1 --directory site
npx --yes html-validate@9 site/index.html
node --check site/app.js
```

## License & Attribution

Code and build scripts are licensed under the [MIT License](LICENSE). Rules text is by Lynn Jones.

_4d8 Worlds is an independent work compatible with Cortex Prime and is not affiliated with or endorsed by Dire Wolf Digital, Inc. Cortex Prime is a registered trademark of Dire Wolf Digital, Inc._
