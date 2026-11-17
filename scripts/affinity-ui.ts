#!/usr/bin/env node
/**
 * affinity-ui.ts: drives the parts of Affinity (by Canva) that its scripting SDK
 * can't reach (text styles, menus, dialogs), through accessibility / UI Automation
 * with agent-desktop. Pair it with affinity.ts, which runs SDK scripts.
 *
 * Works natively under Node 24+ (`node affinity-ui.ts ...`) and Bun on Windows & macOS.
 * Note: On Windows, UI Automation calls (EnumWindows) must be run from a normal
 * interactive desktop terminal (non-sandboxed job object).
 *
 * Usage:
 *   node affinity-ui.ts select <spread> "<frame layer>" "<text prefix>" [from to]
 *                      select text in a frame (whole paragraph, or offsets from prefix)
 *   node affinity-ui.ts style-create paragraph|character "<name>" [--expect "<settings>"]
 *                      create a style from the selection (and apply it)
 *   node affinity-ui.ts style-update paragraph|character
 *                      redefine the selection's style from the selection
 *   node affinity-ui.ts styles-clean               delete unused text styles
 *   node affinity-ui.ts menu "Text > Text Styles > Delete Unused Styles"
 *                      press any menu item by its path
 *   node affinity-ui.ts dialog                     print the open dialog's controls and refs
 *   node affinity-ui.ts tool <key>                 switch tool (t text, v move) without typing into text
 *   node affinity-ui.ts valign top|centre|bottom|justify [<spread> "<frame>" ...]
 *                      vertical alignment of text frames (Text > Vertical Alignment)
 *   node affinity-ui.ts restart [file.af] [--save] [--wait 120]
 *                      quit and reopen Affinity on the document
 *   node affinity-ui.ts shot out.png               capture Affinity's window screenshot
 *   node affinity-ui.ts selftest                   prove the whole path works (non-destructive)
 *
 * Requires agent-desktop on PATH (or falls back to `npx -y agent-desktop`).
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AffinityClient } from "./affinity.ts";

type Node = {
  role?: string;
  name?: string;
  value?: string;
  ref_id?: string;
  states?: string[];
  children?: Node[];
};

const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const t0 = Date.now();
const log = (m: string) => {
  if (process.env.AFFINITY_UI_DEBUG) {
    console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
  }
};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let cachedAdCmd: string[] | undefined;
function resolveAgentDesktop(): string[] {
  if (cachedAdCmd) return cachedAdCmd;
  const probe = spawnSync("agent-desktop", ["--version"], {
    encoding: "utf8",
    windowsHide: true,
    shell: IS_WIN,
  });
  if (probe.status === 0) {
    cachedAdCmd = ["agent-desktop"];
  } else {
    cachedAdCmd = [IS_WIN ? "npx.cmd" : "npx", "-y", "agent-desktop"];
  }
  return cachedAdCmd;
}

function sh(cmd: string[], timeoutMs = 30000): string {
  const p = spawnSync(cmd[0], cmd.slice(1), {
    timeout: timeoutMs,
    encoding: "utf8",
    windowsHide: true,
    shell: IS_WIN && /\.(cmd|bat)$/i.test(cmd[0]),
  });
  if (p.error) throw p.error;
  if (p.status === null || p.signal) {
    throw new Error(
      `timed out after ${timeoutMs} ms: ${cmd.slice(0, 3).join(" ")} (is a pop-up menu open in Affinity?)`
    );
  }
  return (p.stdout || "") + (p.stderr || "");
}

function ad(...a: string[]): string {
  const t = Date.now();
  const base = resolveAgentDesktop();
  const r = sh([...base, ...a]);
  const ms = Date.now() - t;
  if (ms > 1000) log(`slow (${(ms / 1000).toFixed(1)}s): agent-desktop ${a.slice(0, 4).join(" ")}`);
  if (r.includes("EnumWindows failed to enumerate top-level windows")) {
    throw new Error(
      "Windows UI Automation (EnumWindows) is blocked inside this sandboxed agent terminal. " +
        "Run `node " +
        basename(fileURLToPath(import.meta.url)) +
        " ...` from a normal interactive Windows Terminal / PowerShell window."
    );
  }
  return r;
}

function parseAdJson(raw: string): any {
  const idx = raw.indexOf("{");
  if (idx < 0) throw new Error("Unexpected agent-desktop output: " + raw.trim());
  const j = JSON.parse(raw.slice(idx));
  if (!j.ok) {
    const msg = j.error?.message || JSON.stringify(j.error);
    if (String(msg).includes("EnumWindows failed")) {
      throw new Error(
        "Windows UI Automation (EnumWindows) is blocked inside this sandboxed agent terminal. " +
          "Run `node " +
          basename(fileURLToPath(import.meta.url)) +
          " ...` from a normal interactive Windows Terminal / PowerShell window."
      );
    }
    throw new Error(`agent-desktop failed: ${msg}`);
  }
  return j;
}

async function until<T>(
  f: () => T | undefined | Promise<T | undefined>,
  ms: number,
  every = 150
): Promise<T | undefined> {
  for (const end = Date.now() + ms; ; ) {
    const v = await f();
    if (v) return v;
    if (Date.now() > end) return undefined;
    await sleep(every);
  }
}

let client: AffinityClient | undefined;
async function sdk(js: string): Promise<string> {
  if (!client) {
    client = new AffinityClient();
    await client.connect();
  }
  return (await client.run(js)).trim();
}

function snapshot(surface: "menubar" | "focused" | "window" | "menu", depth?: number): Node {
  const args = ["snapshot", "--app", "Affinity", "--timeout-ms", "20000"];
  if (surface !== "window") args.push("--surface", surface);
  if (surface === "menubar") args.push("-i");
  if (depth) args.push("--max-depth", String(depth));
  return parseAdJson(ad(...args)).data.tree;
}

function* walk(n: Node, path: string[] = []): Generator<[Node, string[]]> {
  yield [n, path];
  for (const c of n.children ?? []) yield* walk(c, [...path, n.name ?? ""]);
}

const find = (root: Node, f: (n: Node, p: string[]) => boolean) => {
  for (const [n, p] of walk(root)) if (f(n, p)) return n;
};

const AFFINITY_ID = "com.canva.affinity";
let previousApp: string | undefined;

const macFrontmost = () =>
  sh([
    "osascript",
    "-e",
    'tell application "System Events" to get bundle identifier of first application process whose frontmost is true',
  ]).trim();

async function front() {
  if (IS_MAC) {
    previousApp ??= macFrontmost();
    if (macFrontmost() === AFFINITY_ID) return;
    sh(["open", "-b", AFFINITY_ID]);
    if (!(await until(() => macFrontmost() === AFFINITY_ID, 3000))) {
      throw new Error("Affinity did not come to the front");
    }
    await sleep(250);
    return;
  }
  parseAdJson(ad("--headed", "focus-window", "--app", "Affinity"));
  await sleep(150);
}

function restoreFront() {
  if (IS_MAC && previousApp && previousApp !== AFFINITY_ID) {
    try {
      sh(["open", "-b", previousApp], 5000);
    } catch {
      // best effort
    }
  }
}

async function pressMenu(path: string) {
  await front();
  log("press " + path);
  const parts = path.split(">").map((s) => s.trim());

  if (IS_MAC) {
    const item = parts.at(-1)!;
    const parents = parts.slice(0, -1);
    const hit = find(
      snapshot("menubar"),
      (n, p) => n.role === "menuitem" && n.name === item && parents.every((x) => p.includes(x))
    );
    if (!hit?.ref_id) throw new Error(`menu item not found: ${path}`);
    parseAdJson(ad("click", hit.ref_id, "--timeout-ms", "15000"));
    return;
  }

  // Windows UI Automation: top-level menu bar lives on "window", opened submenus appear on "menu".
  const topName = parts[0];
  const topHit = find(
    snapshot("window", 5),
    (n) => (n.role === "menuitem" || n.role === "button") && n.name === topName
  );
  if (!topHit?.ref_id) throw new Error(`top-level menu not found: ${topName} (${path})`);
  parseAdJson(ad("--headed", "click", topHit.ref_id, "--timeout-ms", "15000"));
  await sleep(150);

  for (let i = 1; i < parts.length; i++) {
    const target = parts[i];
    const hit = await until(() => {
      try {
        const tree = snapshot("menu");
        return find(tree, (n) => n.role === "menuitem" && n.name === target);
      } catch {
        return undefined;
      }
    }, 3000);
    if (!hit?.ref_id) throw new Error(`menu item not found: ${target} in ${path}`);
    parseAdJson(ad("--headed", "click", hit.ref_id, "--timeout-ms", "15000"));
    if (i < parts.length - 1) await sleep(150);
  }
}

type Dialog = {
  tree: Node;
  title: string;
  nameField?: string;
  settings?: string;
  ok?: string;
  cancel?: string;
  table?: string;
  alertText?: string;
};

const dialogOpen = () => snapshot("focused", 1).role !== "window";

function readDialog(): Dialog | undefined {
  if (!dialogOpen()) return undefined;
  const t = snapshot("focused");
  if (t.role === "window") return undefined;
  const d: Dialog = { tree: t, title: t.name ?? t.role ?? "" };
  const visit = (n: Node, inScroll: boolean) => {
    if (n.role === "textfield") {
      if (inScroll) d.settings = n.name ?? n.value ?? "";
      else d.nameField ??= n.ref_id;
    }
    if (n.role === "button" && n.name === "OK") d.ok = n.ref_id;
    if (n.role === "button" && n.name === "Cancel") d.cancel = n.ref_id;
    if (n.role === "table") d.table ??= n.ref_id;
    if (n.role === "statictext" && /already used|cannot|error/i.test(n.name ?? "")) {
      d.alertText = n.name;
    }
    for (const c of n.children ?? []) visit(c, inScroll || n.role === "scrollarea");
  };
  visit(t, false);
  return d;
}

async function openDialog(path: string): Promise<Dialog> {
  await pressMenu(path);
  let d = await until(readDialog, 3000, 200);
  if (!d) {
    log("no dialog, refocusing and retrying");
    await pressMenu(path);
    d = await until(readDialog, 6000, 200);
  }
  if (!d) throw new Error("no dialog opened (is text selected with the Frame Text tool?)");
  return d;
}

async function closeDialog() {
  for (let i = 0; i < 3; i++) {
    const d = readDialog();
    if (!d) break;
    const b = d.cancel ?? d.ok;
    if (b) parseAdJson(ad("click", b));
    await until(() => !dialogOpen() || undefined, 2000);
  }
  if (dialogOpen()) throw new Error("could not close the dialog; close it in Affinity");
  await front();
}

const SELECT_JS = (spread: number, frame: string, prefix: string, from?: number, to?: number) => `
const {Document}=require('/document.js'); const {DocumentCommand}=require('/commands.js'); const {Selection,TextSelection}=require('/selections.js');
const d=Document.current; if (!d) throw new Error('No document open');
if (${spread}>=d.spreads.length) throw new Error('spread ${spread} does not exist (document has ' + d.spreads.length + ', 0-indexed)');
const sp=d.spreads.at(${spread});
if (!d.currentSpread.isSameNode(sp)) d.executeCommand(DocumentCommand.createSetCurrentSpread(sp));
let node; const find=(p)=>{ for (let n=p.firstChild;n&&!node;n=n.nextSibling) { if (n.description===${JSON.stringify(frame)}) node=n; else find(n); } }; find(sp);
if (!node) throw new Error('no layer named ' + ${JSON.stringify(frame)} + ' on spread ${spread}');
const tx=node.storyInterface.getText(); const p=tx.indexOf(${JSON.stringify(prefix)}); if (p<0) throw new Error('text not found');
let e=tx.indexOf('\\n',p); if (e<0) e=tx.length;
const b=p+${from ?? 0}, en=${to === undefined ? "e" : `p+${to}`};
const s=Selection.create(d,node); s.addSubSelectionForNode(node, TextSelection.create([{begin:b,end:en}])); d.executeCommand(DocumentCommand.createSetSelection(s));
console.log('selected ' + JSON.stringify(tx.slice(b,en).slice(0,60)));`;

function countMcpPeers(): number {
  if (IS_WIN) {
    const r = sh(["netstat", "-ano"], 5000);
    return r
      .split(/\r?\n/)
      .filter((l) => l.includes(":6767") && /\bESTABLISHED\b/i.test(l)).length;
  }
  return sh(["lsof", "-nP", "-iTCP:6767", "-sTCP:ESTABLISHED"], 5000)
    .split("\n")
    .filter((l) => l && !l.startsWith("Affinity") && !l.startsWith("COMMAND")).length;
}

async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  switch (cmd) {
    case undefined:
    case "help":
    case "--help": {
      const src = readFileSync(fileURLToPath(import.meta.url), "utf8");
      console.log(/\/\*\*([\s\S]*?)\*\//.exec(src)?.[1].replace(/^ \* ?/gm, "") ?? "");
      return;
    }
    case "select": {
      const [spread, frame, prefix, from, to] = a;
      console.log(
        await sdk(
          SELECT_JS(
            Number(spread),
            frame,
            prefix,
            from ? Number(from) : undefined,
            to ? Number(to) : undefined
          )
        )
      );
      return;
    }
    case "menu":
      await pressMenu(a.join(" "));
      console.log("pressed " + a.join(" "));
      return;
    case "dialog": {
      const d = readDialog();
      if (!d) {
        console.log("no dialog open");
        return;
      }
      for (const [n, p] of walk(d.tree)) {
        if (!/^(row|cell|column|table|statictext)$/.test(n.role ?? "") || /alert/i.test(d.title)) {
          console.log(
            "  ".repeat(Math.min(p.length, 6)) + (n.role ?? ""),
            n.ref_id ?? "",
            (n.name ?? n.value ?? "").slice(0, 160)
          );
        }
      }
      if (d.settings) console.log("style settings: " + d.settings);
      return;
    }
    case "style-create": {
      const kind = a[0] === "character" ? "Character" : "Paragraph";
      const name = a[1];
      const ei = a.indexOf("--expect");
      const expect = ei >= 0 ? a[ei + 1] : undefined;
      if (!name) throw new Error('usage: style-create paragraph|character "<name>" [--expect "<settings>"]');
      const d = await openDialog(`Text > Text Styles > Create ${kind} Style`);
      console.log("style settings: " + d.settings);
      if (expect !== undefined && d.settings !== expect) {
        await closeDialog();
        throw new Error(`cancelled: expected "${expect}"`);
      }
      parseAdJson(ad("set-value", d.nameField!, name));
      parseAdJson(ad("click", d.ok!));
      await until(() => !dialogOpen() || undefined, 3000);
      const after = readDialog();
      if (after?.alertText) {
        await closeDialog();
        throw new Error(after.alertText);
      }
      if (after) {
        await closeDialog();
        throw new Error("dialog stayed open: " + after.title);
      }
      await front();
      console.log(`created ${kind.toLowerCase()} style ${name}`);
      return;
    }
    case "style-update":
      await pressMenu(`Text > Text Styles > Update ${a[0] === "character" ? "Character" : "Paragraph"} Style`);
      console.log("updated");
      return;
    case "styles-clean":
      await pressMenu("Text > Text Styles > Delete Unused Styles");
      console.log("deleted unused text styles");
      return;
    case "tool": {
      await sdk(
        "const {Document}=require('/document.js'); const {DocumentCommand}=require('/commands.js'); Document.current.executeCommand(DocumentCommand.createSetSelection(null)); console.log('cleared');"
      );
      parseAdJson(ad("--headed", "press", a[0] ?? "t", "--app", "Affinity"));
      console.log("tool key " + (a[0] ?? "t"));
      return;
    }
    case "selftest": {
      const step = async (name: string, f: () => Promise<string>) => {
        const t = Date.now();
        const r = await f();
        console.log(`PASS ${name.padEnd(28)} ${String(Date.now() - t).padStart(5)} ms  ${r}`);
      };
      const HASH =
        "const {Document}=require('/document.js'); const d=Document.current; let h=0,n=0; for (let i=0;i<d.spreads.length;i++) for (let c=d.spreads.at(i).firstChild;c;c=c.nextSibling) if (c.storyInterface) { const t=c.storyInterface.text; n+=t.length; for (let j=0;j<t.length;j++) h=(h*31+t.charCodeAt(j))>>>0; } console.log(n+':'+h);";
      let before = "";
      await step("sdk connect + text hash", async () => (before = await sdk(HASH)));
      await step("select text (SDK)", async () =>
        sdk(`const {Document}=require('/document.js'); const {DocumentCommand}=require('/commands.js'); const {Selection,TextSelection}=require('/selections.js');
const d=Document.current; let node, si; for (let i=0;i<d.spreads.length && !node;i++) for (let c=d.spreads.at(i).firstChild;c;c=c.nextSibling) if (c.storyInterface && c.storyInterface.text.length>2 && c.constructor.name.startsWith('FrameText')) { node=c; si=i; break; }
if (!node) throw new Error('no text frame');
if (!d.currentSpread.isSameNode(d.spreads.at(si))) d.executeCommand(DocumentCommand.createSetCurrentSpread(d.spreads.at(si)));
const s=Selection.create(d,node); s.addSubSelectionForNode(node, TextSelection.create([{begin:0,end:1}])); d.executeCommand(DocumentCommand.createSetSelection(s)); console.log(node.description || '(unnamed)');`)
      );
      await step("dialog probe", async () => (dialogOpen() ? "a dialog is open" : "no dialog"));
      await step("open + cancel style dialog", async () => {
        const d = await openDialog("Text > Text Styles > Create Paragraph Style");
        const st = d.settings;
        await closeDialog();
        return `settings "${st}"`;
      });
      await step("text unchanged", async () => {
        const after = await sdk(HASH);
        if (after !== before) throw new Error(`text changed: ${before} -> ${after}`);
        return after;
      });
      console.log(`all passed in ${Date.now() - t0} ms`);
      return;
    }
    case "valign": {
      const mode = {
        top: "Top",
        centre: "Centre",
        center: "Centre",
        bottom: "Bottom",
        justify: "Justify",
      }[(a[0] ?? "").toLowerCase()];
      if (!mode) throw new Error('Usage: valign top|centre|bottom|justify [<spread> "<frame>" ...]');
      if (a.length > 1) {
        const spread = Number(a[1]);
        const names = a.slice(2);
        console.log(
          await sdk(`const {Document}=require('/document.js'); const {DocumentCommand}=require('/commands.js'); const {Selection}=require('/selections.js');
const d=Document.current; const sp=d.spreads.at(${spread});
if (!d.currentSpread.isSameNode(sp)) d.executeCommand(DocumentCommand.createSetCurrentSpread(sp));
const want=${JSON.stringify(names)}; const hits=[]; const walk=(p)=>{ for(let n=p.firstChild;n;n=n.nextSibling){ if(want.includes(n.description)) hits.push(n); walk(n); } }; walk(sp);
const missing=want.filter(w=>!hits.some(h=>h.description===w)); if(missing.length) throw new Error('not found: '+missing.join(', '));
d.executeCommand(DocumentCommand.createSetSelection(Selection.create(d,hits))); console.log('selected '+hits.length+' frame(s)');`)
        );
      }
      await pressMenu(`Text > Vertical Alignment > ${mode}`);
      const last = await sdk("console.log(require('/document.js').Document.current.history.undoDescription)");
      if (last !== "Vertical alignment") {
        console.log(
          `no change recorded (last action: "${last}"): frames already had this alignment, or selection was text`
        );
      }
      console.log(`vertical alignment: ${mode}`);
      return;
    }
    case "restart": {
      const save = a.includes("--save");
      const wi = a.indexOf("--wait");
      const wait = wi >= 0 ? Number(a[wi + 1]) : 120;
      let file = a.find((x) => /\.(af|afpub|afdesign|afphoto)$/i.test(x));
      try {
        const info = JSON.parse(
          await sdk(
            `const d=require('/document.js').Document.current; console.log(JSON.stringify(d ? {path:d.path ?? '', dirty:!!d.isDirty} : {}));`
          )
        );
        file ??= info.path || undefined;
        if (info.dirty) {
          if (!save) throw new Error("the document has unsaved changes; save it in Affinity or pass --save");
          await sdk("require('/document.js').Document.current.save(); console.log('saved')");
          console.log("saved " + file);
        }
      } catch (e) {
        if (String(e).includes("unsaved")) throw e;
        if (!file) {
          throw new Error(
            `can't reach Affinity scripting (${String(e).split("\n")[0]}); pass the .af file to reopen`
          );
        }
        console.log("scripting unreachable; reopening " + file);
      }
      client?.close();
      client = undefined;
      if (!file) throw new Error("no file to reopen; pass the .af path");

      if (IS_MAC) {
        sh(["osascript", "-e", 'tell application "Affinity" to quit'], 20000);
        if (!(await until(() => !sh(["pgrep", "-f", "Affinity.app/Contents/MacOS/Affinity"]).trim() || undefined, 30000))) {
          throw new Error("Affinity did not quit (a save prompt may be open)");
        }
      } else {
        parseAdJson(ad("close-app", "Affinity"));
        if (
          !(await until(() => {
            const r = sh(["tasklist", "/FI", "IMAGENAME eq Affinity.exe"], 5000);
            return !r.includes("Affinity.exe") || undefined;
          }, 30000))
        ) {
          throw new Error("Affinity did not quit (a save prompt may be open)");
        }
      }

      console.log(`Affinity quit; waiting ${wait} s so idle MCP clients stop reconnecting`);
      await sleep(wait * 1000);

      if (IS_MAC) {
        sh(["open", "-a", "Affinity", file]);
      } else {
        spawn("cmd.exe", ["/c", "start", "", file], { detached: true, stdio: "ignore", windowsHide: true }).unref();
      }
      const title = basename(file).replace(/\.(af|afpub|afdesign|afphoto)$/i, "");
      if (!(await until(() => ad("list-windows", "--app", "Affinity").includes(title) || undefined, 90000, 1000))) {
        throw new Error("Affinity reopened but the document window didn't appear");
      }
      const alive = await until(async () => {
        try {
          return await sdk("console.log('ok')");
        } catch {
          client?.close();
          client = undefined;
          return undefined;
        }
      }, 60000, 2000);
      console.log(
        `reopened ${title}; scripting ${alive ? "works" : "NOT answering"}; ${countMcpPeers()} client connection(s) open`
      );
      return;
    }
    case "shot": {
      const out = resolve(a[0] ?? "affinity-window.png");
      if (IS_MAC) {
        const w = parseAdJson(ad("list-windows", "--app", "Affinity")).data.find((x: { title: string }) =>
          x.title.startsWith("Affinity")
        );
        if (!w) throw new Error("no Affinity window");
        sh(["screencapture", "-x", "-o", "-l", String(w.id).replace(/\D/g, ""), out]);
      } else {
        parseAdJson(ad("screenshot", "--app", "Affinity", out));
      }
      console.log("saved " + out);
      return;
    }
    default:
      throw new Error(`Unknown command: ${cmd}. Run "node affinity-ui.ts help".`);
  }
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  main().then(
    () => {
      client?.close();
      restoreFront();
      process.exit(0);
    },
    (e) => {
      client?.close();
      restoreFront();
      console.error(String(e?.message ?? e));
      process.exit(1);
    }
  );
}

// Keep unused dirname import reference quiet if unused in strict tools
void dirname;
