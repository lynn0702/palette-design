# Affinity Scripting Helpers

Cross-platform CLI utilities for automating Affinity (by Canva) via its local MCP server and UI Automation, adapted from [`rendotdev/04e6cdc3d1f7261789435ffbf0e1c378`](https://gist.github.com/rendotdev/04e6cdc3d1f7261789435ffbf0e1c378) to run natively on **Node 24+** (and Bun) on Windows and macOS.

## Files

- `affinity.ts` — CLI & importable `AffinityClient` for Affinity's local MCP SSE server (`http://[::1]:6767/sse` on Windows, with `http://localhost:6767/sse` fallback). Inspects layer trees (`tree`), measures text frame bounds and true ink bottoms (`frames`), runs inline/file SDK JS (`eval`/`run`), replaces text while keeping styles (`set-text`), reconstructs SVGs as native `PolyCurve`s (`place-svg`), exports layers/PDFs (`export`/`pdf`), and renders spreads (`render`).
- `affinity-ui.ts` — Companion accessibility UI driver using `agent-desktop` (`select`, `style-create`, `style-update`, `styles-clean`, `menu`, `dialog`, `tool`, `valign`, `restart`, `shot`, `selftest`) for UI-only features like named Paragraph/Character Styles and vertical frame alignment.
- `affinity-mcp-bridge.mjs` — Zero-dependency `stdio` MCP bridge wired into Antigravity's `mcp_config.json`. Normalizes `protocolVersion` (`2025-11-25`), auto-reads `preamble`, and tears down idle SSE streams after 60s so idle sessions do not exhaust Affinity's ~13-connection SSE pool.
- `build_zine.js` & `impose_zine.py` — Project-specific 4-page Half-Letter zine generator and 2-up US Letter saddle-stitch PDF imposer.

## Setup

1. Ensure **Node 24+** (or Bun) is installed (`node -v`).
2. In Affinity: **Edit → Settings → Model Context Protocol** → enable **Enable Affinity MCP** and **Access files on your Desktop**.
3. For `affinity.ts pdf` screen PDFs (`(Screen).pdf`): uses Ghostscript (`gswin64c`/`gs`) if installed, or automatically falls back to Python `pymupdf` (`pip install pymupdf pypdf` or `uv`).
4. For `affinity-ui.ts` on Windows: requires an interactive desktop terminal (Windows UI Automation `EnumWindows` is restricted inside sandboxed sub-shells). `agent-desktop` is resolved on `PATH` or run automatically via `npx -y agent-desktop`.

## Quick Usage

```powershell
node scripts/affinity.ts help
node scripts/affinity.ts tools
node scripts/affinity.ts tree 0 --depth 2
node scripts/affinity.ts frames 0
node scripts/affinity.ts pdf ./out.pdf --quality print
node scripts/affinity-ui.ts help
node scripts/affinity-ui.ts selftest   # run from interactive Windows Terminal
```
