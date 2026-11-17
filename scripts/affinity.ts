#!/usr/bin/env node
/**
 * affinity.ts: a command-line client for the Affinity (by Canva) MCP server.
 *
 * Works natively under Node 24+ (`node affinity.ts ...`) and Bun (`bun affinity.ts ...`)
 * on Windows and macOS. Use it when the Affinity MCP tools are not loaded in an agent
 * session, or whenever a shell workflow is simpler.
 *
 * Quirks it handles, so callers don't have to:
 * - Transport is legacy MCP over SSE at http://[::1]:6767/sse (Windows binds IPv6
 *   loopback) with automatic fallback to http://localhost:6767/sse. The server sends
 *   the POST endpoint as the first event and answers every request on the SSE stream.
 * - Lines end with \r\n; events are split on blank lines.
 * - Only protocol version 2025-11-25 is accepted at initialize.
 * - Every connection must read the "preamble" doc topic before any other tool
 *   works ("The preamble documentation topic has not yet been read").
 * - execute_script returns only what the script prints with console.log, so
 *   print what you need; scripts must be directly executable (no module.exports).
 * - Affinity's file access is limited to the Desktop root. doc.export() to any
 *   other folder, or to a dot-prefixed (hidden) filename, throws PERMISSION_DENIED.
 *   `export` and `pdf` write a plainly named file on the Desktop, then move it.
 * - Changing document settings (e.g. transparency for a PNG with alpha) is an
 *   undoable command in the user's open file. `export --transparent` undoes it
 *   right after the export so the document is left as it was.
 * - render_spread / render_selection return a base64 JPEG (max 1024 px);
 *   `render` decodes it to a file.
 * - The server stops answering new sessions once ~13 clients hold connections;
 *   each command tears down its SSE stream cleanly on exit.
 *
 * SDK tips:
 * - Document.current is the open document. doc.spreads is a Collection: use
 *   .at(i), .length or for...of, not [i]. Walk nodes with firstChild/nextSibling.
 * - Switch spreads with DocumentCommand.createSetCurrentSpread(sp) (doc.currentSpread
 *   is read-only).
 * - A node's layer name is node.description. Text: node.storyInterface.text.
 * - Desktop path: require('/application.js').app.userDesktopPath.
 * - Text: replace a range with DocumentCommand.createSetText on a Selection with
 *   addSubSelectionForNode(node, TextSelection.create([{begin, end}])); positions
 *   from storyInterface.getText() match the story 1:1.
 * - node.getExactSpreadVisibleBox(false, false) is the true ink box of a text frame.
 *
 * Usage:
 *   node affinity.ts tools                       list the server's tools
 *   node affinity.ts docs [topic] [--grep re]    list doc topics, or read one
 *   node affinity.ts hints "question"            search the shared SDK hints
 *   node affinity.ts run script.js|-             run JavaScript in Affinity, print its output
 *   node affinity.ts eval "js code"              same, inline
 *   node affinity.ts tree [spread] [--depth n]   print the current document's layer tree
 *   node affinity.ts presets                     list the export preset names
 *   node affinity.ts pdf out.pdf [--doc "<path part>[:pages]"]... [--quality print|screen] [--preset name]
 *                                               export whole documents (or page ranges like :1-4) as
 *                                               "out (Print).pdf" and "out (Screen).pdf" (200 ppi JPEG)
 *   node affinity.ts export "<layer path>" out.(svg|png|pdf|jpg) [--spread n] [--preset name] [--transparent] [--dpi n]
 *                                               export a layer, found by name path like "title/Group/logo"
 *   node affinity.ts render [out.jpg] [--spread n] [--selection]
 *   node affinity.ts frames [spread]            text frames: box, true bottom of last line (px), last words
 *   node affinity.ts set-text <spread> "<frame>" "<old>" "<new>"
 *                                               replace exact text in a frame, keeping its styles
 *   node affinity.ts place-svg <spread> file.svg [--name "<layer>"] [--at x,y] [--fill-from "<frame>" [--glyph i]]
 *                     [--fill #rrggbb] [--behind "<layer>" | --into "<layer>"] [--replace]
 *                                               rebuild an SVG's paths as one native curve
 *   node affinity.ts call <tool> [json-args]     call any tool directly
 *
 * Env: AFFINITY_MCP_URL (default probes http://[::1]:6767 then http://localhost:6767),
 *      AFFINITY_TIMEOUT_MS (default 240000).
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CANDIDATE_BASES = process.env.AFFINITY_MCP_URL
  ? [process.env.AFFINITY_MCP_URL.replace(/\/+$/, "")]
  : ["http://[::1]:6767", "http://localhost:6767"];
const TIMEOUT = Number(process.env.AFFINITY_TIMEOUT_MS ?? 240000);
const IS_WIN = process.platform === "win32";

type Json = any;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function whichCmd(candidates: string[]): string | undefined {
  const tool = IS_WIN ? "where.exe" : "which";
  for (const name of candidates) {
    const r = spawnSync(tool, [name], { encoding: "utf8", windowsHide: true });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split(/\r?\n/)[0];
  }
  return undefined;
}

/** Count established connections on port 6767 so saturated-pool timeouts explain themselves. */
function connectionHint(baseUrl: string): string {
  let port = "6767";
  try {
    port = new URL(baseUrl).port || "80";
  } catch {
    // keep default
  }
  const dialog = "If a dialog or Settings window is open in Affinity, close it.";
  if (IS_WIN) {
    const r = spawnSync("netstat", ["-ano"], { encoding: "utf8", timeout: 5000, windowsHide: true });
    const rows = (r.stdout || "")
      .split(/\r?\n/)
      .filter((l) => l.includes(`:${port}`) && /\bESTABLISHED\b/i.test(l));
    const pids = [...new Set(rows.map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
    if (pids.length < 8) return dialog;
    return (
      `${pids.length} processes hold connections to Affinity MCP (pids ${pids.join(", ")}); ` +
      "its server stops answering new sessions when too many are open. Close idle sessions loading " +
      "the affinity MCP server. " +
      dialog
    );
  }
  const r = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:ESTABLISHED"], {
    encoding: "utf8",
    timeout: 5000,
  });
  const rows = (r.stdout || "")
    .split("\n")
    .slice(1)
    .filter((l) => l && !l.startsWith("Affinity") && !l.startsWith("COMMAND"));
  const pids = [...new Set(rows.map((l) => l.split(/\s+/)[1]))].filter(
    (p) => p && p !== String(process.pid)
  );
  if (pids.length < 8) return dialog;
  return (
    `${pids.length} other processes hold connections to Affinity MCP (pids ${pids.join(", ")}); ` +
    "its server stops answering new sessions when too many are open. Close idle sessions that load " +
    "the affinity MCP server. " +
    dialog
  );
}

export class AffinityClient {
  private base: string;
  private endpoint = "";
  private id = 0;
  private pending = new Map<number, (m: Json) => void>();
  private abort = new AbortController();

  constructor(baseUrl?: string) {
    this.base = (baseUrl ?? CANDIDATE_BASES[0]).replace(/\/+$/, "");
  }

  async connect() {
    const candidates = process.env.AFFINITY_MCP_URL
      ? [this.base]
      : [this.base, ...CANDIDATE_BASES.filter((b) => b !== this.base)];
    let res: Response | undefined;
    let lastErr: unknown;

    for (const candidate of candidates) {
      try {
        const attempt = await fetch(candidate + "/sse", {
          headers: { accept: "text/event-stream" },
          signal: this.abort.signal,
        });
        if (attempt.ok && attempt.body) {
          this.base = candidate;
          res = attempt;
          break;
        }
        lastErr = new Error(`SSE connect failed (${candidate}): HTTP ${attempt.status}`);
      } catch (e) {
        lastErr = e;
      }
    }

    if (!res || !res.body) {
      throw new Error(
        `Affinity MCP is not reachable (${candidates.join(", ")}). Open Affinity and enable Settings > Model Context Protocol. (${String((lastErr as Error)?.message ?? lastErr)})`
      );
    }

    this.pump(res.body.getReader());
    const t0 = Date.now();
    while (!this.endpoint) {
      if (Date.now() - t0 > 10000) throw new Error("No endpoint event from Affinity MCP");
      await sleep(20);
    }
    let init: Json;
    try {
      init = await this.request(
        "initialize",
        {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "affinity.ts", version: "1.1" },
        },
        20000
      );
    } catch (e) {
      throw new Error(`${(e as Error).message}\n${connectionHint(this.base)}`);
    }
    if (init.error) throw new Error("initialize failed: " + JSON.stringify(init.error));
    this.notify("notifications/initialized", {});
    await this.tool("read_sdk_documentation_topic", { filename: "preamble" });
  }

  private async pump(reader: ReadableStreamDefaultReader<Uint8Array>) {
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const event = /^event: (.*)$/m.exec(chunk)?.[1];
          const data = chunk
            .split("\n")
            .filter((l) => l.startsWith("data: "))
            .map((l) => l.slice(6))
            .join("\n");
          if (event === "endpoint") this.endpoint = data.trim();
          else if (event === "message" && data) {
            try {
              const m = JSON.parse(data);
              if (m.id != null && this.pending.has(m.id)) {
                this.pending.get(m.id)!(m);
                this.pending.delete(m.id);
              }
            } catch {
              // ignore non-JSON keepalive payloads
            }
          }
        }
      }
    } catch {
      // aborted or stream closed
    }
  }

  private post(msg: Json) {
    return fetch(this.base + this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(msg),
    });
  }

  notify(method: string, params: Json) {
    this.post({ jsonrpc: "2.0", method, params }).catch(() => {});
  }

  request(method: string, params: Json, timeoutMs = TIMEOUT): Promise<Json> {
    const id = ++this.id;
    return new Promise<Json>((resolveReq, rejectReq) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectReq(
          new Error(`${method} timed out after ${timeoutMs} ms (is Affinity busy or showing a dialog?)`)
        );
      }, timeoutMs);
      this.pending.set(id, (m) => {
        clearTimeout(timer);
        resolveReq(m);
      });
      this.post({ jsonrpc: "2.0", id, method, params }).then(
        (r) => {
          if (!r.ok && r.status !== 202) {
            clearTimeout(timer);
            this.pending.delete(id);
            rejectReq(new Error(`${method}: HTTP ${r.status}`));
          }
        },
        (e) => {
          clearTimeout(timer);
          this.pending.delete(id);
          rejectReq(new Error(`${method}: Affinity MCP unreachable (${e?.message ?? e})`));
        }
      );
    });
  }

  /** Call a tool; returns its content array. Throws on protocol errors. */
  async tool(name: string, args: Json = {}): Promise<Json[]> {
    const r = await this.request("tools/call", { name, arguments: args });
    if (r.error) throw new Error(`${name}: ${JSON.stringify(r.error)}`);
    if (r.result?.isError) {
      const msg = (r.result?.content ?? []).map((c: Json) => c.text ?? "").join("\n");
      throw new Error(`${name} failed: ${msg}`);
    }
    return r.result?.content ?? [];
  }

  async text(name: string, args: Json = {}): Promise<string> {
    return (await this.tool(name, args)).map((c: Json) => c.text ?? "").join("\n");
  }

  /**
   * Run JavaScript inside Affinity; returns what it printed. A script that throws
   * comes back as printed text ("Error: ...\n    at main:1:7"), so detect that and throw.
   */
  async run(code: string): Promise<string> {
    const r = await this.request("tools/call", { name: "execute_script", arguments: { script: code } });
    if (r.error) throw new Error(`execute_script: ${JSON.stringify(r.error)}`);
    const out = (r.result?.content ?? []).map((c: Json) => c.text ?? "").join("\n");
    if (r.result?.isError || SCRIPT_ERROR.test(out)) throw new ScriptError(out.trim());
    return out;
  }

  close() {
    this.abort.abort();
  }
}

/** A script that threw inside Affinity; message is everything it printed. */
export class ScriptError extends Error {}
const SCRIPT_ERROR = /(^|\n)\w*(Error|Exception)\b[^\n]*\n\s+at (main|\S+):\d+/;

// ── helpers ───────────────────────────────────────────────────────────────

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

function bool(args: string[], name: string): boolean {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
}

function moveFile(src: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  try {
    renameSync(src, dest);
  } catch {
    copyFileSync(src, dest);
    unlinkSync(src);
  }
}

function runPython(code: string, pyArgs: string[]): { ok: boolean; stderr: string } {
  const py = whichCmd(["python3", "python"]);
  if (py) {
    const r = spawnSync(py, ["-I", "-c", code, ...pyArgs], { encoding: "utf8", windowsHide: true });
    if (r.status === 0) return { ok: true, stderr: r.stderr || "" };
    // Fall through to uv if a dependency like pypdf/pymupdf is missing in system python
    if (!whichCmd(["uv"])) return { ok: false, stderr: r.stderr || "python failed" };
  }
  const uv = whichCmd(["uv"]);
  if (uv) {
    const r = spawnSync(
      uv,
      ["run", "-q", "--with", "pypdf", "--with", "pymupdf", "python", "-I", "-c", code, ...pyArgs],
      { encoding: "utf8", windowsHide: true }
    );
    return { ok: r.status === 0, stderr: r.stderr || "" };
  }
  return { ok: false, stderr: "Neither python nor uv was found on PATH" };
}

function makeScreenPdf(srcPdf: string, outPdf: string): void {
  const gs = whichCmd(IS_WIN ? ["gswin64c", "gswin32c", "gs"] : ["gs"]);
  const tmp = outPdf + ".screen.tmp.pdf";
  if (gs) {
    const r = spawnSync(
      gs,
      [
        "-q",
        "-dNOPAUSE",
        "-dBATCH",
        "-dSAFER",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.6",
        "-dDownsampleColorImages=true",
        "-dColorImageDownsampleType=/Bicubic",
        "-dColorImageResolution=200",
        "-dColorImageDownsampleThreshold=1.1",
        "-dDownsampleGrayImages=true",
        "-dGrayImageDownsampleType=/Bicubic",
        "-dGrayImageResolution=200",
        "-dAutoFilterColorImages=false",
        "-dColorImageFilter=/DCTEncode",
        "-dJPEGQ=88",
        "-dPassThroughJPEGImages=false",
        "-dDetectDuplicateImages=true",
        `-sOutputFile=${tmp}`,
        srcPdf,
      ],
      { encoding: "utf8", windowsHide: true }
    );
    if (r.status === 0 && existsSync(tmp)) {
      moveFile(tmp, outPdf);
      return;
    }
  }

  // Fallback for Windows without Ghostscript: preserve vector text/graphics,
  // downsample high-DPI raster images to <=200 ppi JPEG q88 via PyMuPDF.
  const py = `
import sys
import pymupdf

src, dst = sys.argv[1], sys.argv[2]
doc = pymupdf.open(src)
try:
    doc.rewrite_images(dpi_threshold=220, dpi_target=200, quality=88, lossy=True, lossless=True)
except Exception:
    pass
doc.save(dst, garbage=4, deflate=True, clean=True)
doc.close()
`;
  const r = runPython(py, [srcPdf, tmp]);
  if (!r.ok || !existsSync(tmp)) {
    throw new Error("Screen PDF optimization failed (no Ghostscript or PyMuPDF): " + r.stderr);
  }
  moveFile(tmp, outPdf);
}

const PRELUDE = `
const { Document, FileExportArea, FileExportOptions } = require('/document.js');
const { DocumentCommand } = require('/commands.js');
const { app } = require('/application.js');
const doc = Document.current;
if (!doc) throw new Error('No document is currently open in Affinity.');
function nodesOf(parent) { const out = []; let n = parent.firstChild; while (n) { out.push(n); n = n.nextSibling; } return out; }
function setSpread(sp) { if (!doc.currentSpread.isSameNode(sp)) doc.executeCommand(DocumentCommand.createSetCurrentSpread(sp)); }
// Layer names repeat (several "Group"s), so match the path with backtracking.
function findPath(spread, path) {
  const parts = path.split('/');
  function go(parent, i) {
    for (const n of nodesOf(parent)) {
      if (n.description !== parts[i]) continue;
      if (i === parts.length - 1) return n;
      const deeper = go(n, i + 1);
      if (deeper) return deeper;
    }
    return null;
  }
  let hit = go(spread, 0);
  if (!hit && parts.length === 1) {
    const deep = (p) => { for (const n of nodesOf(p)) { if (n.description === path) return n; const d = deep(n); if (d) return d; } return null; };
    hit = deep(spread);
  }
  if (!hit) throw new Error('Layer path not found: ' + path + ' (top level: ' + nodesOf(spread).map(n => n.description).join(', ') + ')');
  return hit;
}
`;

/** Text frames with their box and the true bottom of their last line (exact visible box). */
function framesScript(spread: number | null) {
  return `${PRELUDE}
const list = ${spread === null ? "[...doc.spreads].map((s, i) => [i, s])" : `[[${spread}, doc.spreads.at(${spread})]]`};
for (const [i, sp] of list) {
  if (!sp) throw new Error('Spread index out of range: ' + i);
  setSpread(sp);
  const walk = (p) => { for (const n of nodesOf(p)) { if (n.constructor.name === 'FrameTextNode') {
    const b = n.getSpreadBaseBox(false), v = n.getExactSpreadVisibleBox(false, false);
    const t = n.storyInterface.getText(); const last = t.trimEnd().split(/[\\n\\r\\u2029]/).pop();
    console.log(i + '  ' + (n.description || '(unnamed)').padEnd(40) + ' box ' + [b.x, b.y, b.width, b.height].map(x => x.toFixed(1)).join(', ') +
      '  ink bottom ' + (v.y + v.height).toFixed(1) + '  last: ' + JSON.stringify(last.slice(-40)));
  } walk(n); } };
  walk(sp);
}`;
}

/** Replace exact text inside one frame's story, keeping its paragraph and character styles. */
function setTextScript(spread: number, frame: string, from: string, to: string) {
  return `${PRELUDE}
const { Selection, TextSelection } = require('/selections.js');
const sp = doc.spreads.at(${spread});
if (!sp) throw new Error('Spread index out of range: ${spread}');
setSpread(sp);
const n = findPath(sp, ${JSON.stringify(frame)});
const ink = () => { const v = n.getExactSpreadVisibleBox(false, false); return (v.y + v.height).toFixed(1); };
const from = ${JSON.stringify(from)}, to = ${JSON.stringify(to)};
const t = n.storyInterface.getText();
const i = t.indexOf(from);
if (i < 0) throw new Error('text not found in ' + n.description + ': ' + from.slice(0, 60));
if (t.indexOf(from, i + 1) >= 0) throw new Error('text appears more than once; give a longer excerpt: ' + from.slice(0, 60));
const before = ink();
const sel = Selection.create(doc, n);
sel.addSubSelectionForNode(n, TextSelection.create([{ begin: i, end: i + from.length }]));
doc.executeCommand(DocumentCommand.createSetText(sel, to));
doc.executeCommand(DocumentCommand.createSetSelection(null));
console.log('replaced ' + from.length + ' chars with ' + to.length + ' in ' + n.description + '; last line bottom ' + before + ' -> ' + ink() + ' px');`;
}

/** Parse an SVG's path data into subpaths of absolute commands (M, L, C, Z), in SVG units. */
function svgSubpaths(svg: string): { subs: (string | number)[][]; w: number; h: number; vb: number[] } {
  const vb = (/viewBox="([^"]+)"/.exec(svg)?.[1] ?? "").trim().split(/[\s,]+/).map(Number);
  const unit = (v: string[] | null, fallback: number) => {
    if (!v) return fallback;
    const n = Number(v[0]);
    const u = v[1] ?? "px";
    return n * ({ mm: 1 / 25.4, cm: 1 / 2.54, in: 1, pt: 1 / 72, px: 1 / 96 } as Record<string, number>)[u];
  };
  const re = (name: string) =>
    new RegExp(`<svg[^>]*\\s${name}="([\\d.]+)(mm|cm|in|pt|px)?"`).exec(svg)?.slice(1) ?? null;
  const vbw = vb.length === 4 ? vb[2] : 0;
  const vbh = vb.length === 4 ? vb[3] : 0;
  const w = unit(re("width"), vbw / 96);
  const h = unit(re("height"), vbh / 96);
  const subs: (string | number)[][] = [];
  let cur: (string | number)[] = [];
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0;
  for (const d of [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])) {
    const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
    let k = 0,
      cmd = "";
    const num = () => Number(toks[k++]);
    while (k < toks.length) {
      if (/[a-zA-Z]/.test(toks[k])) cmd = toks[k++];
      const rel = cmd === cmd.toLowerCase(),
        C = cmd.toUpperCase();
      if (C === "Z") {
        if (cur.length) subs.push([...cur, "Z"]);
        cur = [];
        x = sx;
        y = sy;
        continue;
      }
      if (C === "M") {
        if (cur.length) subs.push(cur);
        const nx = num(),
          ny = num();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        sx = x;
        sy = y;
        cur = ["M", x, y];
        cmd = rel ? "l" : "L";
        continue;
      }
      if (C === "L") {
        const nx = num(),
          ny = num();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        cur.push("L", x, y);
        continue;
      }
      if (C === "H") {
        const nx = num();
        x = rel ? x + nx : nx;
        cur.push("L", x, y);
        continue;
      }
      if (C === "V") {
        const ny = num();
        y = rel ? y + ny : ny;
        cur.push("L", x, y);
        continue;
      }
      if (C === "C") {
        const a = [num(), num(), num(), num(), num(), num()];
        const p = rel ? a.map((v, j) => v + (j % 2 ? y : x)) : a;
        cur.push("C", ...p);
        x = p[4];
        y = p[5];
        continue;
      }
      if (C === "Q") {
        const a = [num(), num(), num(), num()];
        const p = rel ? a.map((v, j) => v + (j % 2 ? y : x)) : a;
        cur.push(
          "C",
          x + (2 / 3) * (p[0] - x),
          y + (2 / 3) * (p[1] - y),
          p[2] + (2 / 3) * (p[0] - p[2]),
          p[3] + (2 / 3) * (p[1] - p[3]),
          p[2],
          p[3]
        );
        x = p[2];
        y = p[3];
        continue;
      }
      throw new Error(`place-svg: path command ${cmd} not supported (use M L H V C Q Z)`);
    }
    if (cur.length) {
      subs.push(cur);
      cur = [];
    }
  }
  return { subs, w, h, vb };
}

/** Rebuild an SVG's paths as one native curve in the document (the SDK can't place files). */
function placeSvgScript(o: {
  spread: number;
  svg: string;
  at: number[];
  name: string;
  fillFrom?: string;
  glyph: number;
  fill?: string;
  behind?: string;
  into?: string;
  replace: boolean;
}) {
  const { subs, w, h, vb } = svgSubpaths(o.svg);
  if (!subs.length) throw new Error("place-svg: no <path d=...> found in the SVG");
  return `${PRELUDE}
const { AddChildNodesCommandBuilder, InsertionMode } = require('/commands.js');
const { CurveBuilder, PolyCurve } = require('/geometry.js');
const { NodeChildType, PolyCurveNodeDefinition } = require('/nodes.js');
const { FillDescriptor } = require('/fills.js');
const { LineStyleDescriptor } = require('/linestyle.js');
const { Selection } = require('/selections.js');
const { RGBA8 } = require('/colours.js');
const SUBS = ${JSON.stringify(
    subs.map((s) => s.map((v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)))
  )};
const sp = doc.spreads.at(${o.spread});
if (!sp) throw new Error('Spread index out of range: ${o.spread}');
setSpread(sp);
const dpi = doc.dpi;
const vb = ${JSON.stringify(vb)};
const kx = vb.length === 4 && vb[2] ? ${w} * dpi / vb[2] : dpi / 96, ky = vb.length === 4 && vb[3] ? ${h} * dpi / vb[3] : dpi / 96;
const ox = ${o.at[0]} - (vb[0] || 0) * kx, oy = ${o.at[1]} - (vb[1] || 0) * ky;
let fill;
${
  o.fillFrom
    ? `{ const src = findPath(sp, ${JSON.stringify(o.fillFrom)}); fill = src.storyInterface ? src.storyInterface.story.getGlyphAtts(${o.glyph}).brushFill : src.brushFillInterface.getCurrentDescriptor(); }`
    : `const hex = ${JSON.stringify(o.fill ?? "#000000")}; fill = FillDescriptor.createSolid(RGBA8(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255));`
}
${
  o.replace
    ? `{ const walk = (p) => { for (const n of nodesOf(p)) { if (n.description === ${JSON.stringify(o.name)}) { doc.executeCommand(DocumentCommand.createDeleteSelection(Selection.create(doc, [n]), false)); return true; } if (walk(n)) return true; } return false; }; if (walk(sp)) console.log('replaced the old ' + ${JSON.stringify(o.name)}); }`
    : ""
}
const poly = PolyCurve.create();
for (const s of SUBS) {
  const cb = CurveBuilder.create();
  for (let k = 0; k < s.length;) {
    const c = s[k++];
    if (c === 'M') { cb.beginXY(ox + s[k] * kx, oy + s[k + 1] * ky); k += 2; }
    else if (c === 'L') { cb.lineToXY(ox + s[k] * kx, oy + s[k + 1] * ky); k += 2; }
    else if (c === 'C') { cb.addBezierXY(ox + s[k] * kx, oy + s[k + 1] * ky, ox + s[k + 2] * kx, oy + s[k + 3] * ky, ox + s[k + 4] * kx, oy + s[k + 5] * ky); k += 6; }
    else if (c === 'Z') cb.close();
  }
  poly.addCurve(cb.createCurve());
}
const none = FillDescriptor.createNone();
const def = PolyCurveNodeDefinition.create(poly, fill, none, LineStyleDescriptor.createDefault(0), none);
def.userDescription = ${JSON.stringify(o.name)};
const b = AddChildNodesCommandBuilder.create();
b.addNode(def);
${
  o.behind
    ? `b.setInsertionTarget(findPath(sp, ${JSON.stringify(o.behind)})); b.setInsertionMode(InsertionMode.Behind);`
    : o.into
      ? `b.setInsertionTarget(findPath(sp, ${JSON.stringify(o.into)})); b.setInsertionMode(InsertionMode.Inside_AtFront);`
      : ""
}
doc.executeCommand(b.createCommand(false, NodeChildType.Main));
doc.executeCommand(DocumentCommand.createSetSelection(null));
const placed = (() => { const walk = (p) => { for (const n of nodesOf(p)) { if (n.description === ${JSON.stringify(o.name)}) return n; const d = walk(n); if (d) return d; } return null; }; return walk(sp); })();
const r = placed.getSpreadBaseBox(false);
console.log('placed ' + placed.description + ' (' + SUBS.length + ' outlines) at ' + [r.x, r.y, r.width, r.height].map(v => v.toFixed(1)).join(', ') + ' px');`;
}

function treeScript(spread: number, depth: number) {
  return `${PRELUDE}
const sp = doc.spreads.at(${spread});
if (!sp) throw new Error('Spread index out of range: ${spread}');
setSpread(sp);
console.log('document: ' + (doc.title || '') + ', spreads: ' + doc.spreads.length + ', showing spread ${spread}');
function box(n) { try { const b = n.getSpreadBaseBox ? n.getSpreadBaseBox() : null; if (!b || !isFinite(b.x) || Math.abs(b.x) > 1e100) return ''; return ' (' + [b.x, b.y, b.width, b.height].map(v => Math.round(v)).join(', ') + ')'; } catch (e) { return ''; } }
function type(n) { return n.constructor && n.constructor.name || '?'; }
function walk(parent, d) {
  for (const n of nodesOf(parent)) {
    let t = '';
    try { if (n.isFrameTextNode || n.isArtTextNode) t = ' "' + (n.storyInterface.text || '').slice(0, 60).replace(/\\n/g, ' ') + '"'; } catch (e) {}
    console.log('  '.repeat(d) + (n.description || '?') + ' [' + type(n) + ']' + box(n) + t);
    if (d < ${depth}) walk(n, d + 1);
  }
}
walk(sp, 0);`;
}

const PRESET_HINT: Record<string, RegExp> = {
  ".svg": /^SVG/i,
  ".png": /^PNG/i,
  ".jpg": /^JPE?G/i,
  ".jpeg": /^JPE?G/i,
  ".pdf": /^PDF/i,
  ".tif": /^TIFF?/i,
  ".tiff": /^TIFF?/i,
  ".webp": /^WEBP/i,
};

async function readStdinText(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const ch of process.stdin) chunks.push(Buffer.from(ch));
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args.shift();
  if (!cmd || cmd === "help" || cmd === "--help") {
    const src = readFileSync(fileURLToPath(import.meta.url), "utf8");
    console.log(/\/\*\*([\s\S]*?)\*\//.exec(src)?.[1].replace(/^ \* ?/gm, "") ?? "");
    return;
  }
  const c = new AffinityClient();
  await c.connect();
  try {
    switch (cmd) {
      case "tools": {
        const r = await c.request("tools/list", {});
        for (const t of r.result?.tools ?? []) {
          console.log(
            `- ${t.name}: ${(t.description ?? "").replace(/\s+/g, " ")}  [${Object.keys(t.inputSchema?.properties ?? {}).join(", ")}]`
          );
        }
        break;
      }
      case "docs": {
        const grep = flag(args, "--grep");
        const topic = args[0];
        let out = topic
          ? await c.text("read_sdk_documentation_topic", { filename: topic })
          : await c.text("list_sdk_documentation");
        if (grep) out = out.split("\n").filter((l) => new RegExp(grep, "i").test(l)).join("\n");
        console.log(out);
        break;
      }
      case "hints":
        console.log(await c.text("search_sdk_hints", { prompt: args.join(" ") }));
        break;
      case "run": {
        const src = args[0] === "-" || !args[0] ? await readStdinText() : readFileSync(args[0], "utf8");
        console.log(await c.run(src));
        break;
      }
      case "eval":
        console.log(await c.run(args.join(" ")));
        break;
      case "tree": {
        const depth = Number(flag(args, "--depth") ?? 4);
        console.log(await c.run(treeScript(Number(args[0] ?? 0), depth)));
        break;
      }
      case "presets":
        console.log(
          await c.run("const { FileExportOptions } = require('/document.js'); console.log(FileExportOptions.allPresetNames.join('\\n'));")
        );
        break;
      case "export": {
        const spread = Number(flag(args, "--spread") ?? 0);
        const presetArg = flag(args, "--preset");
        const dpi = flag(args, "--dpi");
        const transparent = bool(args, "--transparent");
        const [layerPath, outArg] = args;
        if (!layerPath || !outArg) throw new Error('usage: export "<layer path>" out.(svg|png|pdf|jpg)');
        const out = resolve(outArg);
        const ext = extname(out).toLowerCase();
        const tmpName = `affinity-export-${Date.now()}${ext}`;
        const script = `${PRELUDE}
const desk = app.userDesktopPath;
const sp = doc.spreads.at(${spread});
if (!sp) throw new Error('Spread index out of range: ${spread}');
setSpread(sp);
const node = findPath(sp, ${JSON.stringify(layerPath)});
let preset = ${JSON.stringify(presetArg ?? "")};
if (!preset) { const want = ${PRESET_HINT[ext]?.toString() ?? "/./"}; preset = FileExportOptions.allPresetNames.find(n => want.test(n)); }
if (!preset) throw new Error('No export preset for ${ext}; run "presets"');
const opts = FileExportOptions.createWithPresetName(preset);

let setTransparent = false;
${
  transparent
    ? `try { const { DocumentProperties } = require('/documentproperties.js'); const dp = DocumentProperties.create(); dp.isTransparent = true; doc.setDocumentProperties(dp); setTransparent = true; } catch (e) { console.log('transparent: ' + e.message); }`
    : ""
}
doc.selection = [node];
const area = FileExportArea.createForSelection(doc.selection);
const target = desk + '/' + ${JSON.stringify(tmpName)};
${
  dpi
    ? `const bb = node.getSpreadBaseBox(false); const k = ${Number(dpi)} / doc.dpi;
doc.export(target, opts, area, { width: Math.round(bb.width * k), height: Math.round(bb.height * k) });`
    : "doc.export(target, opts, area, null);"
}
if (setTransparent) {
  for (let i = 0; i < 6 && doc.canUndo; i++) {
    const d = doc.undoDescription;
    if (!/selection|propert/i.test(d)) break;
    doc.undo();
    if (/propert/i.test(d)) break;
  }
}
console.log('EXPORTED_FILE:' + target);
console.log('EXPORTED_PRESET:' + preset);`;
        const outText = await c.run(script);
        console.log(outText.trim());
        const m = /^EXPORTED_FILE:(.+)$/m.exec(outText);
        const src = m?.[1]?.trim() ?? join(homedir(), "Desktop", tmpName);
        for (let i = 0; i < 50 && !existsSync(src); i++) await sleep(100);
        if (!existsSync(src)) throw new Error("Export did not produce " + src);
        moveFile(src, out);
        console.log("saved " + out);
        break;
      }
      case "pdf": {
        const presetOverride = flag(args, "--preset");
        const quality = flag(args, "--quality");
        const docs: string[] = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "--doc" && args[i + 1] !== undefined) {
            docs.push(args[i + 1]);
            args.splice(i, 2);
            i--;
          }
        }
        const outArg = args.find((a) => !a.startsWith("--"));
        if (!outArg) {
          throw new Error(
            'usage: pdf out.pdf [--doc "<path part>[:pages]"]... [--quality print|screen] [--preset name]'
          );
        }
        const base = resolve(outArg).replace(/\.pdf$/i, "");
        const targets: [string, string][] = presetOverride
          ? [[presetOverride, base + ".pdf"]]
          : ([
              ["PDF (for print)", base + " (Print).pdf"],
              ["PDF (for print)", base + " (Screen).pdf"],
            ] as [string, string][]).filter(
              ([, o]) => !quality || o.toLowerCase().includes(quality.toLowerCase())
            );

        for (const [presetArg, out] of targets) {
          const parts: string[] = [];
          for (const spec of docs.length ? docs : [""]) {
            const [docPart, pages] = spec.split(/:(?=[\d,\s-]+$)/);
            const tmpName = `affinity-pdf-${Date.now()}-${parts.length}.pdf`;
            const text = await c.run(`const { Document, FileExportArea, FileExportOptions } = require('/document.js'); const { app } = require('/application.js');
const want = ${JSON.stringify(docPart ?? "")};
const doc = want ? [...Document.all].find(d => (d.path || d.title || '').includes(want)) : Document.current;
if (!doc) throw new Error('No open document matches "' + want + '"; open: ' + [...Document.all].map(d => d.path || d.title).join(', '));
const opts = FileExportOptions.createWithPresetName(${JSON.stringify(presetArg)});
const area = ${pages ? `FileExportArea.createForPages(${JSON.stringify(pages)})` : "FileExportArea.createForWholeDocument()"};
const target = app.userDesktopPath + '/' + ${JSON.stringify(tmpName)};
doc.export(target, opts, area, null);
console.log('EXPORTED_FILE:' + target);
console.log('EXPORTED_FROM:' + (doc.path || doc.title || 'untitled'));`);
            const mFile = /^EXPORTED_FILE:(.+)$/m.exec(text);
            const mFrom = /^EXPORTED_FROM:(.+)$/m.exec(text);
            if (!mFile) throw new Error("pdf export failed: " + text);
            const exportedFile = mFile[1].trim();
            for (let i = 0; i < 100 && !existsSync(exportedFile); i++) await sleep(100);
            if (!existsSync(exportedFile)) throw new Error("Export did not produce " + exportedFile);
            console.log(`exported ${basename(mFrom?.[1]?.trim() || "document")}${pages ? ` pages ${pages}` : ""}`);
            parts.push(exportedFile);
          }

          mkdirSync(dirname(out), { recursive: true });
          if (parts.length === 1) {
            moveFile(parts[0], out);
          } else {
            const py = `import sys\nfrom pypdf import PdfWriter\nw = PdfWriter()\nfor p in sys.argv[2:]: w.append(p)\nw.compress_identical_objects()\nw.write(sys.argv[1])`;
            const r = runPython(py, [out, ...parts]);
            if (!r.ok) throw new Error("merge failed: " + r.stderr);
            for (const p of parts) if (existsSync(p)) unlinkSync(p);
          }

          if (out.endsWith(" (Screen).pdf")) {
            makeScreenPdf(out, out);
          }
          console.log(`saved ${out} (${(statSync(out).size / 1048576).toFixed(2)} MB)`);
        }
        break;
      }
      case "render": {
        const spread = Number(flag(args, "--spread") ?? 0);
        const sel = bool(args, "--selection");
        const out = resolve(args[0] ?? "affinity-render.jpg");
        const uuid = (await c.run(`${PRELUDE} console.log(doc.sessionUuid || doc.uuid || '');`)).trim();
        const content = sel
          ? await c.tool("render_selection", { document_session_uuid: uuid })
          : await c.tool("render_spread", { document_session_uuid: uuid, spread_index: spread });
        const img = content.find((x: Json) => x.type === "image" || x.data);
        if (!img) throw new Error("No image returned: " + JSON.stringify(content).slice(0, 300));
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, Buffer.from(img.data, "base64"));
        console.log("saved " + out);
        break;
      }
      case "frames":
        console.log(await c.run(framesScript(args[0] === undefined ? null : Number(args[0]))));
        break;
      case "set-text": {
        const [spread, frame, from, to] = args;
        if (to === undefined) throw new Error('Usage: set-text <spread> "<frame>" "<old text>" "<new text>"');
        console.log(await c.run(setTextScript(Number(spread), frame, from, to)));
        break;
      }
      case "place-svg": {
        const [spread, file] = args;
        if (!file) {
          throw new Error(
            'Usage: place-svg <spread> file.svg --name "<layer>" [--at x,y] [--fill-from "<frame>"] [--behind|--into "<layer>"] [--replace]'
          );
        }
        const name = flag(args, "--name") ?? basename(file, extname(file));
        console.log(
          await c.run(
            placeSvgScript({
              spread: Number(spread),
              svg: readFileSync(file, "utf8"),
              name,
              at: (flag(args, "--at") ?? "0,0").split(",").map(Number),
              fillFrom: flag(args, "--fill-from"),
              glyph: Number(flag(args, "--glyph") ?? 0),
              fill: flag(args, "--fill"),
              behind: flag(args, "--behind"),
              into: flag(args, "--into"),
              replace: bool(args, "--replace"),
            })
          )
        );
        break;
      }
      case "call": {
        const [name, json] = args;
        if (!name) throw new Error("Usage: call <tool> [json-args]");
        console.log(JSON.stringify(await c.tool(name, json ? JSON.parse(json) : {}), null, 2));
        break;
      }
      default:
        throw new Error(`Unknown command: ${cmd}. Run "node affinity.ts help".`);
    }
  } finally {
    c.close();
  }
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(String(e?.message ?? e));
      process.exit(1);
    }
  );
}
