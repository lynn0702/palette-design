'use strict';

/**
 * Builds the 16-page A5 saddle-stitch zine "4D Combinatoric Worldbuilding"
 * inside Affinity Publisher via the Affinity JavaScript SDK.
 *
 * Format: 16 × A5 (148 × 210 mm / 5.8268 × 8.2677 in), 3 mm bleed, 300 DPI.
 * Strict typographic floor: >= 10.0 pt across all text elements.
 * Layout:
 *   P1:  Front Cover (Dark Obsidian) + 4D Geometric Grid + Roll · Place · Grind
 *   P2:  Pitch Poster Anatomy + Matched Pair & 4-of-a-Kind
 *   P3:  The Undertow (Divide · Layer · Counter + visual mini-posters)
 *   P4:  Master Dial Matrix (Left Spread: 1 · Palette & 2 · Setting)
 *   P5:  Master Dial Matrix (Right Spread: 3 · Tone & Pure Archetype)
 *   P6:  Session Zero: Pass 1 (Identity Prompts + Using This in Cortex)
 *   P7:  Session Zero: Pass 2 & 3 + Spaghetti-Knot Map Schematic
 *   P8:  House Ruled Cortex: Core Engine (Baseline Pool Equation & Openings)
 *   P9:  Three Conflict Speeds (01 Roll · 02 Row · 03 Romp)
 *   P10: Four House Cuts, Prime Set 1: Distinctions, Hinder & Undertow
 *   P11: 1 · Palette → Engine Mod (1–8)
 *   P12: 2 · Setting → Prime Set 2 (1–8)
 *   P13: 3 · Tone → Prime Set 3 (1–8)
 *   P14: Sample Pitch 01 — Rust Space Punk (Sepia Undertow)
 *   P15: Sample Pitch 02 — Bright Primal Adventure (Cozy Undertow)
 *   P16: Back Cover (Dark Table Cheat-Sheet + Vector QR + Attribution)
 */

const { BlendMode, UnitType } = require('affinity:common');
const {
  BaselineGridRelativeTo,
  TextFlowOverflowState,
} = require('affinity:dom');
const { BaselineGridOptions } = require('/baselinegridinterface.js');
const { RGB8, RGBA8 } = require('/colours.js');
const {
  AddChildNodesCommandBuilder,
  DocumentCommand,
  PageInsertMode,
} = require('/commands.js');
const {
  Document,
  FileExportArea,
  FileExportOptions,
  NewDocumentOptions,
} = require('/document.js');
const { Application } = require('/application.js');
const { fs } = require('/fs.js');
const { FillDescriptor } = require('/fills.js');
const { FontFamily, FontField } = require('/fonts.js');
const { Curve, CurveBuilder, PolyCurve, Rectangle, Transform } = require('/geometry.js');
const { LineStyleDescriptor } = require('/linestyle.js');
const {
  FrameTextNodeDefinition,
  ImageNodeDefinition,
  NodeChildType,
  PolyCurveNodeDefinition,
  ShapeNodeDefinition,
  getNodeChildrenRecursive,
} = require('/nodes.js');
const { Bitmap, RasterFormat } = require('/rasterobject.js');
const {
  ParagraphAlignXType,
  ParagraphAttDoubleType,
  ParagraphLeadingType,
} = require('/paragraphatts.js');
const { GlyphAttDoubleType, CapsType } = require('/glyphatts.js');
const { Selection } = require('/selections.js');
const { ShapeCornerType, ShapeDiamond, ShapeRectangle, ShapeTriangle } = require('/shapes.js');
const { StoryBuilder } = require('/storybuilder.js');
const { StoryDelta } = require('/storydelta.js');

// ---------------------------------------------------------------------------
// 1. Constants, A5 Grid & Chromatic Palette
// ---------------------------------------------------------------------------

const DPI = 300;
const IN = DPI;
const PT = DPI / 72;
const MM_TO_IN = 1 / 25.4;

const PAGE_W_IN = 148 * MM_TO_IN;          // 5.8268 in (A5 width)
const PAGE_H_IN = 210 * MM_TO_IN;          // 8.2677 in (A5 height)
const MARGIN_IN = 0.38;                    // ~9.65 mm
const BLEED_IN = 3 * MM_TO_IN;             // 0.1181 in (3 mm print bleed)
const GUTTER_IN = 0.20;                    // ~5.1 mm
const CONTENT_W_IN = PAGE_W_IN - 2 * MARGIN_IN;      // 5.0668 in
const COL_W_IN = (CONTENT_W_IN - GUTTER_IN) / 2;     // 2.4334 in
const MIN_FONT_PT = 10.0;                  // Strict 10 pt floor across entire zine
let minFontPtUsed = Infinity;

const PALETTE = {
  ink: RGB8(24, 22, 24),
  mutedInk: RGB8(88, 82, 78),
  white: RGB8(255, 255, 255),
  // System-Neutral (P1–P4): Obsidian + Vermilion + Solar Gold
  neutralDark: RGB8(26, 23, 24),
  neutralCard: RGB8(20, 17, 19),
  neutralPanel: RGB8(34, 30, 32),
  neutralShadow: RGB8(48, 42, 44),
  neutralAccent: RGB8(224, 96, 24),
  neutralGold: RGB8(248, 184, 56),
  neutralGoldText: RGB8(152, 82, 0),
  neutralCream: RGB8(251, 247, 240),
  neutralAltRow: RGB8(245, 239, 230),
  neutralBorder: RGB8(208, 196, 182),
  neutralDarkBorder: RGB8(72, 64, 62),
  neutralSubtleText: RGB8(218, 206, 192),
  neutralPillBg: RGBA8(243, 230, 212, 255),
  neutralPillInk: RGB8(120, 46, 8),
  // Cortex Harness (P5–P8): Midnight + Electric Cyan + Contrast-Safe Magenta
  cortexDark: RGB8(15, 21, 36),
  cortexPanel: RGB8(26, 36, 58),
  cortexCyan: RGB8(0, 196, 224),
  cortexCyanDark: RGB8(0, 95, 117),
  cortexMagenta: RGB8(232, 30, 116),
  cortexMagentaFill: RGB8(196, 20, 96),     // >5.8:1 contrast with white
  cortexMagentaLight: RGB8(255, 124, 179),  // >6.2:1 contrast on dark navy
  cortexMagentaDark: RGB8(176, 14, 84),
  cortexIce: RGB8(241, 249, 252),
  cortexPinkTint: RGB8(253, 242, 247),
  cortexRule: RGB8(176, 214, 226),
  cortexPillBg: RGBA8(216, 244, 250, 255),
  cortexPillInk: RGB8(0, 82, 102),
  cortexDarkPillBg: RGBA8(34, 48, 76, 255),
};

// 8-Row Chromatic Dial Spectrum (rows 1..8 — checkerboard order)
const DIAL_SWATCHES = [
  { name: 'Prismatic', bg: RGB8(139, 44, 226), fg: RGB8(255, 255, 255), text: RGB8(106, 24, 180), light: RGB8(198, 152, 246) },
  { name: 'Sepia', bg: RGB8(184, 108, 24), fg: RGB8(255, 255, 255), text: RGB8(142, 78, 10), light: RGB8(232, 180, 120) },
  { name: 'Neon', bg: RGB8(230, 25, 115), fg: RGB8(255, 255, 255), text: RGB8(176, 14, 82), light: RGB8(248, 134, 184) },
  { name: 'Pastel', bg: RGB8(36, 146, 120), fg: RGB8(255, 255, 255), text: RGB8(20, 108, 86), light: RGB8(134, 212, 192) },
  { name: 'Bright', bg: RGB8(244, 174, 30), fg: RGB8(24, 22, 24), text: RGB8(146, 82, 0), light: RGB8(252, 214, 124) },
  { name: 'Dark', bg: RGB8(42, 52, 86), fg: RGB8(255, 255, 255), text: RGB8(36, 44, 74), light: RGB8(152, 164, 198) },
  { name: 'Chrome', bg: RGB8(14, 124, 204), fg: RGB8(255, 255, 255), text: RGB8(10, 94, 158), light: RGB8(126, 192, 242) },
  { name: 'Rust', bg: RGB8(192, 60, 32), fg: RGB8(255, 255, 255), text: RGB8(152, 42, 18), light: RGB8(234, 142, 122) },
];

const TEXTURE_FILENAMES = {
  1: 'p1_prismatic.png',
  2: 'p2_sepia.png',
  3: 'p3_neon.png',
  4: 'p4_pastel.png',
  5: 'p5_bright.png',
  6: 'p6_dark.png',
  7: 'p7_chrome.png',
  8: 'p8_rust.png',
};
const TEXTURE_CACHE = new Map();

function addClippedTextureImage(doc, targetNode, rect, pIdx, name) {
  const fname = TEXTURE_FILENAMES[pIdx];
  if (!fname || !targetNode) return null;
  const path = `${Application.userDesktopPath}/PaletteDesign_Staging/textures/${fname}`;
  let bm = TEXTURE_CACHE.get(pIdx);
  if (!bm) {
    bm = Bitmap.loadFromFile(path);
    TEXTURE_CACHE.set(pIdx, bm);
  }
  if (!bm || !bm.width || !bm.height) return null;
  const imgDef = ImageNodeDefinition.create(RasterFormat.RGBA8);
  imgDef.bitmap = bm;
  if (name) imgDef.userDescription = name;
  const builder = AddChildNodesCommandBuilder.create();
  builder.setInsertionTarget(targetNode);
  builder.addNode(imgDef);
  const cmd = builder.createCommand(false, NodeChildType.Main);
  doc.executeCommand(cmd);
  const imgNode = cmd.newNodes && cmd.newNodes[0];
  if (imgNode) {
    const xform = Transform.createTranslate(rect.x, rect.y).multiply(
      Transform.createScale(rect.width / bm.width, rect.height / bm.height)
    );
    doc.executeCommand(DocumentCommand.createTransform(Selection.create(doc, imgNode), xform, { mergeable: false }));
    doc.selection.clear();
  }
  return imgNode;
}

// Exact 29×29 Version-3 ECC-M QR code path for https://palette.lynnjones.rocks/
const QR_SIZE = 29;
const QR_PATH =
  'M0 0.5h7m2 0h1m1 0h5m1 0h4m1 0h7' +
  'M0 1.5h1m5 0h1m2 0h9m2 0h1m1 0h1m5 0h1' +
  'M0 2.5h1m1 0h3m1 0h1m1 0h4m1 0h1m1 0h1m2 0h3m1 0h1m1 0h3m1 0h1' +
  'M0 3.5h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h2m1 0h1m1 0h1m2 0h1m1 0h3m1 0h1' +
  'M0 4.5h1m1 0h3m1 0h1m1 0h5m2 0h2m1 0h3m1 0h1m1 0h3m1 0h1' +
  'M0 5.5h1m5 0h1m1 0h2m2 0h1m9 0h1m5 0h1' +
  'M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7' +
  'M8 7.5h1m1 0h2m2 0h1m1 0h1m2 0h1' +
  'M0 8.5h1m1 0h5m3 0h1m1 0h1m4 0h1m1 0h1m2 0h5' +
  'M0 9.5h1m2 0h2m2 0h1m1 0h1m2 0h4m3 0h2m1 0h3m3 0h1' +
  'M0 10.5h1m1 0h1m2 0h3m1 0h1m1 0h5m1 0h2m4 0h2' +
  'M3 11.5h1m1 0h1m2 0h1m1 0h4m5 0h3m1 0h3m1 0h1' +
  'M0 12.5h2m1 0h1m2 0h1m2 0h4m1 0h1m2 0h3m5 0h2' +
  'M0 13.5h1m1 0h1m1 0h2m1 0h4m1 0h1m2 0h1m1 0h4m1 0h3m3 0h1' +
  'M0 14.5h1m1 0h1m1 0h4m1 0h3m3 0h3m6 0h3' +
  'M2 15.5h2m3 0h2m2 0h1m2 0h3m1 0h4m1 0h1m3 0h1' +
  'M3 16.5h6m2 0h2m4 0h1m1 0h1m5 0h2' +
  'M0 17.5h2m1 0h3m1 0h3m1 0h1m1 0h3m3 0h6m1 0h1m1 0h1' +
  'M0 18.5h1m2 0h2m1 0h1m2 0h2m1 0h7m1 0h1m2 0h2m1 0h1' +
  'M0 19.5h1m4 0h1m1 0h1m1 0h2m2 0h1m2 0h1m1 0h1m5 0h1m2 0h1' +
  'M0 20.5h1m1 0h2m1 0h3m2 0h2m2 0h1m2 0h1m1 0h6m1 0h3' +
  'M8 21.5h4m5 0h4m3 0h5' +
  'M0 22.5h7m2 0h1m2 0h1m2 0h3m1 0h2m1 0h1m1 0h3' +
  'M0 23.5h1m5 0h1m1 0h2m1 0h1m2 0h1m4 0h2m3 0h1m2 0h2' +
  'M0 24.5h1m1 0h3m1 0h1m1 0h3m4 0h3m2 0h5m1 0h2' +
  'M0 25.5h1m1 0h3m1 0h1m1 0h1m1 0h1m2 0h2m1 0h1m1 0h1m2 0h1m3 0h4' +
  'M0 26.5h1m1 0h3m1 0h1m1 0h1m3 0h2m1 0h13' +
  'M0 27.5h1m5 0h1m2 0h2m1 0h1m7 0h1m1 0h1m1 0h2m1 0h1' +
  'M0 28.5h7m1 0h1m1 0h1m1 0h3m2 0h1m1 0h1m1 0h2m1 0h3';

// ---------------------------------------------------------------------------
// 2. Font & Style Registry
// ---------------------------------------------------------------------------

function buildFontLookup() {
  const map = new Map();
  for (const fam of FontFamily.all) {
    for (const fn of fam.fonts) {
      map.set(fn.postscriptName, fn);
    }
  }
  return map;
}

function pickFont(fontMap, candidates) {
  for (const ps of candidates) {
    if (fontMap.has(ps)) return fontMap.get(ps);
  }
  throw new Error('Missing all candidate fonts: ' + candidates.join(', '));
}

function createStyleRegistry(fontMap) {
  return {
    fonts: {
      displayHeavy: pickFont(fontMap, ['FSEmeric-Heavy', 'FSEmeric-ExtraBold', 'Bahnschrift-Bold']),
      displayBold: pickFont(fontMap, ['FSEmeric-ExtraBold', 'FSEmeric-Bold', 'Bahnschrift-Bold']),
      displaySemi: pickFont(fontMap, ['FSEmeric-SemiBold', 'Bahnschrift-SemiBold']),
      body: pickFont(fontMap, ['FSKoopman-Regular', 'SegoeUI']),
      bodyMedium: pickFont(fontMap, ['FSKoopman-Medium', 'SegoeUI-Semibold']),
      bodyBold: pickFont(fontMap, ['FSKoopman-Bold', 'SegoeUI-Bold']),
      bodyItalic: pickFont(fontMap, ['FSKoopman-Italic', 'SegoeUI-Italic']),
      bodyBoldItalic: pickFont(fontMap, ['FSKoopman-BoldItalic', 'SegoeUI-BoldItalic']),
      monoBold: pickFont(fontMap, ['CascadiaCodeRoman-Bold', 'Consolas-Bold']),
      mono: pickFont(fontMap, ['CascadiaCodeRoman-Regular', 'Consolas']),
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Inline Markup Parser & StoryBuilder Engine
// ---------------------------------------------------------------------------

function parseInlineRuns(src) {
  const runs = [];
  const tokenRe = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match;
  while ((match = tokenRe.exec(src)) !== null) {
    if (match.index > lastIdx) {
      runs.push({ text: src.slice(lastIdx, match.index), bold: false, italic: false, code: false });
    }
    const tok = match[0];
    if (tok.startsWith('**')) {
      runs.push({ text: tok.slice(2, -2), bold: true, italic: false, code: false });
    } else if (tok.startsWith('*')) {
      runs.push({ text: tok.slice(1, -1), bold: false, italic: true, code: false });
    } else {
      runs.push({ text: tok.slice(1, -1), bold: true, italic: false, code: true });
    }
    lastIdx = tokenRe.lastIndex;
  }
  if (lastIdx < src.length) {
    runs.push({ text: src.slice(lastIdx), bold: false, italic: false, code: false });
  }
  return runs;
}

function buildStoryFromBlocks(doc, styles, blocks, theme) {
  const sb = StoryBuilder.create();
  sb.setToFrameTextDefaultStyle(doc.dpi, doc.rasterFormat);

  const noFill = FillDescriptor.createNone();
  const defaultPillFill = FillDescriptor.createSolid(
    theme === 'cortex' ? PALETTE.cortexPillBg : PALETTE.neutralPillBg
  );
  const defaultPillInk = theme === 'cortex' ? PALETTE.cortexPillInk : PALETTE.neutralPillInk;
  const h2Colour = theme === 'cortex' ? PALETTE.cortexDark : PALETTE.neutralDark;
  const h3Colour = theme === 'cortex' ? PALETTE.cortexMagentaDark : PALETTE.neutralAccent;

  for (let i = 0; i < blocks.length; i++) {
    const blk = blocks[i];
    if (i > 0) sb.addParagraphBreak();

    const kind = blk.kind || 'body';
    const align = blk.align ?? ParagraphAlignXType.Left;
    sb.applyParagraphDelta(StoryDelta.createAlignX(align));
    sb.applyParagraphDelta(StoryDelta.createLeadingType(ParagraphLeadingType.ExactlyAbsolute));
    sb.applyParagraphDelta(StoryDelta.createAlignToBaselineGrid(Boolean(blk.snapBaseline)));
    sb.applyParagraphDelta(StoryDelta.createIsPreventWidows(false));
    sb.applyParagraphDelta(StoryDelta.createIsPreventOrphans(false));

    const leftIndentPt = blk.leftIndentPt ?? 0;
    const firstIndentPt = blk.firstIndentPt ?? 0;
    sb.applyParagraphDelta(StoryDelta.createLeftIndent(leftIndentPt * PT));
    sb.applyParagraphDelta(
      StoryDelta.createParagraphDouble(ParagraphAttDoubleType.FirstLineIndent, firstIndentPt * PT)
    );
    sb.applyParagraphDelta(
      StoryDelta.createParagraphDouble(ParagraphAttDoubleType.SpaceBefore, (blk.spaceBeforePt ?? 0) * PT)
    );
    sb.applyParagraphDelta(
      StoryDelta.createParagraphDouble(ParagraphAttDoubleType.SpaceAfter, (blk.spaceAfterPt ?? 2.5) * PT)
    );

    if (kind === 'h2') {
      const pt = Math.max(MIN_FONT_PT, blk.fontPt ?? 11.5);
      const leadPt = blk.leadingPt ?? pt + 1.8;
      if (pt < minFontPtUsed) minFontPtUsed = pt;
      sb.applyParagraphDelta(StoryDelta.createParagraphDouble(ParagraphAttDoubleType.AbsoluteLeading, leadPt * PT));
      sb.applyGlyphDelta(StoryDelta.createFont(FontField.PostscriptName, styles.fonts[blk.forceFontKey ?? 'displayBold']));
      sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.Height, pt * PT));
      sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.CharacterSpacing, blk.trackingEm ?? 0.04));
      sb.applyGlyphDelta(StoryDelta.createCapsType(blk.caps ?? CapsType.AllCaps));
      sb.applyGlyphDelta(StoryDelta.createBrushFill(FillDescriptor.createSolid(blk.colour ?? h2Colour)));
      sb.applyGlyphDelta(StoryDelta.createHighlightFill(noFill));
      sb.addText(blk.text);
      continue;
    }

    if (kind === 'h3') {
      const pt = Math.max(MIN_FONT_PT, blk.fontPt ?? 10.5);
      const leadPt = blk.leadingPt ?? pt + 1.8;
      if (pt < minFontPtUsed) minFontPtUsed = pt;
      sb.applyParagraphDelta(StoryDelta.createParagraphDouble(ParagraphAttDoubleType.AbsoluteLeading, leadPt * PT));
      sb.applyGlyphDelta(StoryDelta.createFont(FontField.PostscriptName, styles.fonts[blk.forceFontKey ?? 'displaySemi']));
      sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.Height, pt * PT));
      sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.CharacterSpacing, blk.trackingEm ?? 0.04));
      sb.applyGlyphDelta(StoryDelta.createCapsType(blk.caps ?? CapsType.AllCaps));
      sb.applyGlyphDelta(StoryDelta.createBrushFill(FillDescriptor.createSolid(blk.colour ?? h3Colour)));
      sb.applyGlyphDelta(StoryDelta.createHighlightFill(noFill));
      sb.addText(blk.text);
      continue;
    }

    const bodyPt = Math.max(MIN_FONT_PT, blk.fontPt ?? 10.0);
    const leadPt = blk.leadingPt ?? bodyPt + 2.2;
    if (bodyPt < minFontPtUsed) minFontPtUsed = bodyPt;
    const baseColour = blk.colour ?? PALETTE.ink;
    const boldColour = blk.boldColour ?? baseColour;
    const leadColour = blk.leadColour ?? null;
    const pillFill = blk.pillBg ? FillDescriptor.createSolid(blk.pillBg) : defaultPillFill;
    const pillInk = blk.pillInk ?? defaultPillInk;
    const trackingEm = blk.trackingEm ?? 0;

    sb.applyParagraphDelta(StoryDelta.createParagraphDouble(ParagraphAttDoubleType.AbsoluteLeading, leadPt * PT));
    sb.applyGlyphDelta(StoryDelta.createCapsType(blk.caps ?? CapsType.None));
    sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.CharacterSpacing, trackingEm));

    const runs = parseInlineRuns(blk.text);
    let sawFirstBold = false;
    for (const run of runs) {
      if (run.code) {
        const codePt = Math.max(MIN_FONT_PT, bodyPt);
        if (codePt < minFontPtUsed) minFontPtUsed = codePt;
        sb.applyGlyphDelta(StoryDelta.createFont(FontField.PostscriptName, styles.fonts.monoBold));
        sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.Height, codePt * PT));
        sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.CharacterSpacing, 0));
        sb.applyGlyphDelta(StoryDelta.createBrushFill(FillDescriptor.createSolid(pillInk)));
        sb.applyGlyphDelta(StoryDelta.createHighlightFill(noFill));
        sb.addText(run.text);
      } else {
        let fontObj = styles.fonts.body;
        if (blk.forceFontKey) {
          fontObj = styles.fonts[blk.forceFontKey];
        } else if (run.bold && run.italic) {
          fontObj = styles.fonts.bodyBoldItalic;
        } else if (run.bold) {
          fontObj = styles.fonts.bodyBold;
        } else if (run.italic) {
          fontObj = styles.fonts.bodyItalic;
        }

        let runColour = baseColour;
        if (run.bold) {
          if (leadColour && !sawFirstBold) {
            runColour = leadColour;
            sawFirstBold = true;
          } else {
            runColour = boldColour;
          }
        }
        sb.applyGlyphDelta(StoryDelta.createFont(FontField.PostscriptName, fontObj));
        sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.Height, bodyPt * PT));
        sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.CharacterSpacing, trackingEm));
        sb.applyGlyphDelta(StoryDelta.createBrushFill(FillDescriptor.createSolid(runColour)));
        sb.applyGlyphDelta(StoryDelta.createHighlightFill(noFill));
        sb.addText(run.text);
      }
    }
  }
  return sb;
}

// ---------------------------------------------------------------------------
// 4. Vector Drawing & Layout Primitives
// ---------------------------------------------------------------------------

function makeRectPx(xIn, yIn, wIn, hIn, originX, originY) {
  return new Rectangle(originX + xIn * IN, originY + yIn * IN, wIn * IN, hIn * IN);
}

function addNode(doc, def) {
  const builder = AddChildNodesCommandBuilder.create();
  if (doc.currentSpread) builder.setInsertionTarget(doc.currentSpread);
  builder.addNode(def);
  const cmd = builder.createCommand(false, NodeChildType.Main);
  doc.executeCommand(cmd);
  return cmd.newNodes[0];
}

function addShapeNode(doc, shape, rect, fillColour, strokeColour, strokePt, name) {
  const def = ShapeNodeDefinition.createDefault();
  def.setShape(shape);
  def.setBoundingRectangle(rect);
  def.addBrushFillDescriptor(
    fillColour ? FillDescriptor.createSolid(fillColour, BlendMode.Normal) : FillDescriptor.createNone()
  );
  if (strokeColour && strokePt > 0) {
    def.addLineDescriptors(
      FillDescriptor.createSolid(strokeColour, BlendMode.Normal),
      LineStyleDescriptor.createDefault(strokePt * PT)
    );
  }
  if (name) def.userDescription = name;
  return addNode(doc, def);
}

function addRectShape(doc, rect, fillColour, strokeColour, strokePt, name, cornerPt = 0, cornerType = ShapeCornerType.Round) {
  const shape = ShapeRectangle.create();
  if (cornerPt && cornerPt > 0) {
    shape.useSingleRadius = true;
    shape.setAbsoluteSizes(true, rect.width, rect.height);
    shape.topLeft.cornerType = cornerType ?? ShapeCornerType.Round;
    shape.topLeft.setRadius(cornerPt * PT, rect.width, rect.height);
  }
  return addShapeNode(doc, shape, rect, fillColour, strokeColour, strokePt, name);
}

function addShadowCard(doc, rect, fillColour, strokeColour, strokePt, shadowColour, shadowOffsetPt, cornerPt, cornerType, name) {
  if (shadowColour && shadowOffsetPt > 0) {
    const offPx = shadowOffsetPt * PT;
    const shadowRect = new Rectangle(rect.x + offPx, rect.y + offPx, rect.width, rect.height);
    addRectShape(doc, shadowRect, shadowColour, null, 0, `${name}_shadow`, cornerPt, cornerType);
  }
  return addRectShape(doc, rect, fillColour, strokeColour, strokePt, name, cornerPt, cornerType);
}

function addDiamondShape(doc, rect, fillColour, strokeColour, strokePt, name) {
  return addShapeNode(doc, ShapeDiamond.create(), rect, fillColour, strokeColour, strokePt, name);
}

function addTriangleShape(doc, rect, fillColour, strokeColour, strokePt, name) {
  return addShapeNode(doc, ShapeTriangle.create(), rect, fillColour, strokeColour, strokePt, name);
}

function addInvertedTriangleShape(doc, rect, fillColour, strokeColour, strokePt, name) {
  return addPolygon(
    doc,
    [
      [rect.x, rect.y],
      [rect.x + rect.width, rect.y],
      [rect.x + rect.width / 2, rect.y + rect.height],
    ],
    fillColour,
    strokeColour,
    strokePt,
    name
  );
}

function addCircleShape(doc, rect, fillColour, strokeColour, strokePt, name) {
  const radiusPt = (rect.width / PT) / 2;
  return addRectShape(doc, rect, fillColour, strokeColour, strokePt, name, radiusPt, ShapeCornerType.Round);
}

function addPolygon(doc, pointsPx, fillColour, strokeColour, strokePt, name) {
  const cb = CurveBuilder.create();
  cb.beginXY(pointsPx[0][0], pointsPx[0][1]);
  for (let i = 1; i < pointsPx.length; i++) {
    cb.lineToXY(pointsPx[i][0], pointsPx[i][1]);
  }
  cb.close();
  const poly = PolyCurve.create();
  poly.addCurve(cb.createCurve());
  const def = PolyCurveNodeDefinition.create(
    poly,
    fillColour ? FillDescriptor.createSolid(fillColour, BlendMode.Normal) : FillDescriptor.createNone(),
    strokeColour && strokePt > 0 ? FillDescriptor.createSolid(strokeColour, BlendMode.Normal) : FillDescriptor.createNone(),
    LineStyleDescriptor.createDefault((strokePt || 0) * PT),
    FillDescriptor.createNone()
  );
  if (name) def.userDescription = name;
  return addNode(doc, def);
}

function addLineSegment(doc, x1Px, y1Px, x2Px, y2Px, strokeColour, strokePt, name) {
  const poly = PolyCurve.create();
  poly.addCurve(Curve.createLineXY(x1Px, y1Px, x2Px, y2Px));
  const def = PolyCurveNodeDefinition.create(
    poly,
    FillDescriptor.createNone(),
    FillDescriptor.createSolid(strokeColour, BlendMode.Normal),
    LineStyleDescriptor.createDefault(strokePt * PT),
    FillDescriptor.createNone()
  );
  if (name) def.userDescription = name;
  return addNode(doc, def);
}

function centerTextInkInRect(doc, node, boxXIn, boxYIn, boxWIn, boxHIn, ox, oy, centerX = false) {
  if (!node) return;
  try {
    const ink = node.getExactSpreadVisibleBox(false, false);
    if (!ink || ink.width <= 0 || ink.height <= 0) return;
    const targetMidX = ox + (boxXIn + boxWIn / 2) * IN;
    const targetMidY = oy + (boxYIn + boxHIn / 2) * IN;
    const inkMidX = ink.x + ink.width / 2;
    const inkMidY = ink.y + ink.height / 2;
    const dx = centerX ? targetMidX - inkMidX : 0;
    const dy = targetMidY - inkMidY;
    if (Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25) {
      doc.executeCommand(
        DocumentCommand.createTransform(Selection.create(doc, node), Transform.createTranslate(dx, dy), { mergeable: false })
      );
    }
  } catch {
    // ignore if empty
  }
}

function addChamferedBanner(doc, styles, pageNum, ox, oy, theme, titleText, badgeText) {
  const isCortex = theme === 'cortex';
  const mainBg = isCortex ? PALETTE.cortexDark : PALETTE.neutralDark;
  const badgeBg = isCortex ? PALETTE.cortexCyan : PALETTE.neutralAccent;
  const badgeTextCol = isCortex ? PALETTE.cortexDark : PALETTE.white;
  const shadowCol = isCortex ? PALETTE.cortexMagenta : PALETTE.neutralGold;

  const yIn = 0.26;
  const hIn = 0.38;
  addShadowCard(
    doc,
    makeRectPx(MARGIN_IN, yIn, CONTENT_W_IN, hIn, ox, oy),
    mainBg,
    null,
    0,
    shadowCol,
    2.2,
    0,
    ShapeCornerType.None,
    `p${pageNum}_banner_bg`
  );

  const bx1 = ox + (MARGIN_IN + CONTENT_W_IN - 1.38) * IN;
  const bx2 = ox + (MARGIN_IN + CONTENT_W_IN) * IN;
  const by1 = oy + yIn * IN;
  const by2 = oy + (yIn + hIn) * IN;
  addPolygon(
    doc,
    [[bx1 + 0.14 * IN, by1], [bx2, by1], [bx2, by2], [bx1, by2]],
    badgeBg,
    null,
    0,
    `p${pageNum}_banner_badge_bg`
  );

  const r1 = createTextFrameWithAutoFit(doc, styles, {
    id: `p${pageNum}_banner_title`,
    pageNum,
    rect: makeRectPx(MARGIN_IN + 0.11, yIn + 0.08, CONTENT_W_IN - 1.54, 0.24, ox, oy),
    theme,
    ignoreBaselineGrid: true,
    allowAutoTighten: false,
    blocks: [
      {
        kind: 'body',
        text: titleText,
        forceFontKey: 'displayHeavy',
        fontPt: 10.5,
        leadingPt: 11.8,
        trackingEm: 0.02,
        caps: CapsType.AllCaps,
        colour: PALETTE.white,
        spaceAfterPt: 0,
      },
    ],
  });

  const r2 = createTextFrameWithAutoFit(doc, styles, {
    id: `p${pageNum}_banner_badge`,
    pageNum,
    rect: makeRectPx(MARGIN_IN + CONTENT_W_IN - 1.24, yIn + 0.09, 1.14, 0.22, ox, oy),
    theme,
    ignoreBaselineGrid: true,
    allowAutoTighten: false,
    blocks: [
      {
        kind: 'body',
        text: badgeText,
        forceFontKey: 'displayHeavy',
        fontPt: 10.0,
        leadingPt: 11.2,
        trackingEm: 0.02,
        caps: CapsType.AllCaps,
        colour: badgeTextCol,
        align: ParagraphAlignXType.Right,
        spaceAfterPt: 0,
      },
    ],
  });

  centerTextInkInRect(doc, r1.node, MARGIN_IN + 0.11, yIn, CONTENT_W_IN - 1.54, hIn, ox, oy, false);
  centerTextInkInRect(doc, r2.node, MARGIN_IN + CONTENT_W_IN - 1.24, yIn, 1.14, hIn, ox, oy, false);

  return [r1, r2];
}

function addSectionHeaderBar(doc, styles, pageNum, xIn, yIn, wIn, ox, oy, titleText, accentCol, theme, id) {
  addRectShape(
    doc,
    makeRectPx(xIn, yIn, wIn, 0.28, ox, oy),
    theme === 'cortex' ? PALETTE.cortexDark : PALETTE.neutralDark,
    null,
    0,
    `${id}_bg`,
    0
  );
  addRectShape(
    doc,
    makeRectPx(xIn, yIn, 0.07, 0.28, ox, oy),
    accentCol,
    null,
    0,
    `${id}_pip`,
    0
  );
  const res = createTextFrameWithAutoFit(doc, styles, {
    id,
    pageNum,
    rect: makeRectPx(xIn + 0.12, yIn + 0.04, wIn - 0.16, 0.22, ox, oy),
    theme,
    ignoreBaselineGrid: true,
    allowAutoTighten: false,
    blocks: [
      {
        kind: 'body',
        text: titleText,
        forceFontKey: 'displayBold',
        fontPt: 10.0,
        leadingPt: 11.2,
        trackingEm: 0.03,
        caps: CapsType.AllCaps,
        colour: PALETTE.white,
        spaceAfterPt: 0,
      },
    ],
  });
  centerTextInkInRect(doc, res.node, xIn + 0.12, yIn, wIn - 0.16, 0.28, ox, oy, false);
  return res;
}

function cloneBlocksWithScale(blocks, fontDeltaPt, leadDeltaPt, spaceAfterDeltaPt) {
  return blocks.map((b) => {
    const out = Object.assign({}, b);
    if (b.kind === 'h2' || b.kind === 'h3') {
      if (out.fontPt != null) out.fontPt = Math.max(MIN_FONT_PT, out.fontPt - fontDeltaPt * 0.5);
      if (out.leadingPt != null) out.leadingPt = Math.max(out.fontPt + 1.2, out.leadingPt - leadDeltaPt * 0.5);
      if (out.spaceBeforePt != null) out.spaceBeforePt = Math.max(1.0, out.spaceBeforePt - spaceAfterDeltaPt);
      if (out.spaceAfterPt != null) out.spaceAfterPt = Math.max(0.75, out.spaceAfterPt - spaceAfterDeltaPt);
    } else {
      const baseFont = out.fontPt ?? 10.0;
      const baseLead = out.leadingPt ?? 12.2;
      out.fontPt = Math.max(MIN_FONT_PT, baseFont - fontDeltaPt);
      out.leadingPt = Math.max(out.fontPt + 1.2, baseLead - leadDeltaPt);
      if (out.spaceAfterPt != null) {
        out.spaceAfterPt = Math.max(0.5, out.spaceAfterPt - spaceAfterDeltaPt);
      }
      if (out.spaceBeforePt != null) {
        out.spaceBeforePt = Math.max(0, out.spaceBeforePt - spaceAfterDeltaPt * 0.5);
      }
    }
    return out;
  });
}

function createTextFrameWithAutoFit(doc, styles, opts) {
  const {
    id,
    pageNum,
    rect,
    blocks,
    theme,
    ignoreBaselineGrid = true,
    allowAutoTighten = true,
  } = opts;

  let fontDelta = 0;
  let leadDelta = 0;
  let spaceDelta = 0;
  let node = null;
  let overflowState = null;
  let steps = 0;

  for (let attempt = 0; attempt < 24; attempt++) {
    const scaledBlocks = cloneBlocksWithScale(blocks, fontDelta, leadDelta, spaceDelta);
    const sb = buildStoryFromBlocks(doc, styles, scaledBlocks, theme);
    const def = FrameTextNodeDefinition.createFromStoryBuilder(rect, sb);
    def.userDescription = id;
    node = addNode(doc, def);

    if (ignoreBaselineGrid) {
      doc.executeCommand(
        DocumentCommand.createSetTextFrameIgnoreBaselineGrid(Selection.create(doc, node), true)
      );
    }

    overflowState = node.textFrameInterface.textFlow.getOverflowInfo().state;
    if (overflowState.value !== TextFlowOverflowState.Warn.value || !allowAutoTighten) {
      break;
    }

    doc.deleteSelection(Selection.create(doc, node));
    steps++;
    const sampleBody = scaledBlocks.find((b) => !b.kind || b.kind === 'body');
    const curFont = sampleBody ? sampleBody.fontPt : 8.25;
    const curLead = sampleBody ? sampleBody.leadingPt : 10.2;
    if (curLead - curFont > 1.25) {
      leadDelta += 0.25;
      spaceDelta += 0.25;
    } else {
      fontDelta += 0.25;
      leadDelta += 0.25;
      spaceDelta += 0.125;
    }
  }

  return {
    id,
    page: pageNum,
    node,
    tightenSteps: steps,
    fontDeltaPt: fontDelta,
    leadDeltaPt: leadDelta,
    overflowValue: overflowState.value,
  };
}

/**
 * Precision grid table with chromatic d8 DIAMOND diecons in Column 0.
 */
function buildPrecisionTable(doc, styles, cfg) {
  const {
    idPrefix,
    pageNum,
    originX,
    originY,
    xIn,
    yIn,
    colWidthsIn,
    headerHeightIn,
    rowHeightsIn,
    headers,
    rows,
    theme,
    padHIn = 0.055,
    padVIn = 0.045,
    cellFontPt = 8.0,
    cellLeadPt = 9.8,
  } = cfg;

  const totalWIn = colWidthsIn.reduce((a, b) => a + b, 0);
  const headerBg = theme === 'cortex' ? PALETTE.cortexDark : PALETTE.neutralDark;
  const altBg = theme === 'cortex' ? PALETTE.cortexIce : PALETTE.neutralAltRow;
  const ruleCol = theme === 'cortex' ? PALETTE.cortexRule : PALETTE.neutralBorder;
  const accentCol = theme === 'cortex' ? PALETTE.cortexCyan : PALETTE.neutralAccent;

  const auditItems = [];
  let curYIn = yIn;

  addRectShape(doc, makeRectPx(xIn, curYIn, totalWIn, headerHeightIn, originX, originY), headerBg, null, 0, `${idPrefix}_hdr_bg`, 0);

  let curXIn = xIn;
  for (let c = 0; c < headers.length; c++) {
    const cw = colWidthsIn[c];
    const cellRect = makeRectPx(
      curXIn + (c === 0 ? 0.015 : padHIn),
      curYIn + 0.055,
      cw - 2 * (c === 0 ? 0.015 : padHIn),
      headerHeightIn - 0.07,
      originX,
      originY
    );
    const hdrRes = createTextFrameWithAutoFit(doc, styles, {
      id: `${idPrefix}_hdr_c${c}`,
      pageNum,
      rect: cellRect,
      theme,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: headers[c],
          forceFontKey: 'displayBold',
          fontPt: cfg.headerFontPt ?? 10.0,
          leadingPt: 11.2,
          trackingEm: 0.02,
          caps: CapsType.AllCaps,
          colour: PALETTE.white,
          align: c === 0 ? ParagraphAlignXType.Centre : ParagraphAlignXType.Left,
          spaceAfterPt: 0,
        },
      ],
    });
    centerTextInkInRect(doc, hdrRes.node, curXIn + (c === 0 ? 0.015 : padHIn), curYIn, cw - 2 * (c === 0 ? 0.015 : padHIn), headerHeightIn, originX, originY, c === 0);
    auditItems.push(hdrRes);
    curXIn += cw;
  }

  addLineSegment(
    doc,
    originX + xIn * IN,
    originY + (curYIn + headerHeightIn) * IN,
    originX + (xIn + totalWIn) * IN,
    originY + (curYIn + headerHeightIn) * IN,
    accentCol,
    1.5,
    `${idPrefix}_hdr_rule`
  );

  curYIn += headerHeightIn;

  for (let r = 0; r < rows.length; r++) {
    const rh = rowHeightsIn[r];
    const swatch = DIAL_SWATCHES[r % DIAL_SWATCHES.length];
    const rowBg = r % 2 === 1 ? altBg : PALETTE.white;

    addRectShape(doc, makeRectPx(xIn, curYIn, totalWIn, rh, originX, originY), rowBg, null, 0, `${idPrefix}_r${r + 1}_bg`, 0);
    addRectShape(doc, makeRectPx(xIn, curYIn, 0.038, rh, originX, originY), swatch.bg, null, 0, `${idPrefix}_r${r + 1}_bar`, 0);
    addLineSegment(
      doc,
      originX + xIn * IN,
      originY + (curYIn + rh) * IN,
      originX + (xIn + totalWIn) * IN,
      originY + (curYIn + rh) * IN,
      ruleCol,
      0.45,
      `${idPrefix}_r${r + 1}_hrule`
    );

    curXIn = xIn;
    for (let c = 0; c < rows[r].length; c++) {
      const cw = colWidthsIn[c];
      if (c > 0) {
        addLineSegment(
          doc,
          originX + curXIn * IN,
          originY + curYIn * IN,
          originX + curXIn * IN,
          originY + (curYIn + rh) * IN,
          ruleCol,
          0.35,
          `${idPrefix}_r${r + 1}_vrule_${c}`
        );
      }

      if (c === 0) {
        // Chromatic d8 diamond diecon centered in Col 0 (10 pt numeral)
        const dSize = Math.min(0.32, cw - 0.06, rh - 0.06);
        const dx = curXIn + (cw - dSize) / 2 + 0.015;
        const dy = curYIn + (rh - dSize) / 2;
        addDiamondShape(doc, makeRectPx(dx, dy, dSize, dSize, originX, originY), swatch.bg, null, 0, `${idPrefix}_r${r + 1}_d8`);
        const numRect = makeRectPx(dx, dy + (dSize - 0.18) / 2, dSize, 0.18, originX, originY);
        const numRes = createTextFrameWithAutoFit(doc, styles, {
          id: `${idPrefix}_r${r + 1}_c0`,
          pageNum,
          rect: numRect,
          theme,
          allowAutoTighten: false,
          blocks: [
            {
              kind: 'body',
              text: rows[r][0],
              forceFontKey: 'displayHeavy',
              fontPt: 10.0,
              leadingPt: 11.0,
              colour: swatch.fg,
              align: ParagraphAlignXType.Centre,
              spaceAfterPt: 0,
            },
          ],
        });
        centerTextInkInRect(doc, numRes.node, dx, dy, dSize, dSize, originX, originY, true);
        auditItems.push(numRes);
      } else {
        const cellRect = makeRectPx(curXIn + padHIn, curYIn + padVIn, cw - 2 * padHIn, rh - 2 * padVIn, originX, originY);
        auditItems.push(
          createTextFrameWithAutoFit(doc, styles, {
            id: `${idPrefix}_r${r + 1}_c${c}`,
            pageNum,
            rect: cellRect,
            theme,
            blocks: [
              {
                kind: 'body',
                text: rows[r][c],
                fontPt: cellFontPt,
                leadingPt: cellLeadPt,
                leadColour: swatch.text,
                spaceAfterPt: 0,
              },
            ],
          })
        );
      }
      curXIn += cw;
    }
    curYIn += rh;
  }

  const fullHIn = headerHeightIn + rowHeightsIn.reduce((a, b) => a + b, 0);
  addRectShape(doc, makeRectPx(xIn, yIn, totalWIn, fullHIn, originX, originY), null, headerBg, 0.85, `${idPrefix}_outer`, 0);
  return auditItems;
}

/**
 * Draws a crisp vector QR code (run-length horizontal rectangles batched in a single command)
 * inside a white quiet-zone tile.
 */
function addQrCode(doc, xIn, yIn, sizeIn, ox, oy, name) {
  const padIn = sizeIn * 0.08;
  const innerIn = sizeIn - 2 * padIn;
  const modIn = innerIn / QR_SIZE;

  addRectShape(doc, makeRectPx(xIn, yIn, sizeIn, sizeIn, ox, oy), PALETTE.white, PALETTE.neutralGold, 1.0, `${name}_bg`, 3, ShapeCornerType.Round);

  const builder = AddChildNodesCommandBuilder.create();
  const darkFill = FillDescriptor.createSolid(PALETTE.neutralDark);
  const rowCmds = QR_PATH.split('M').filter(Boolean);
  for (let r = 0; r < rowCmds.length; r++) {
    const cmd = rowCmds[r];
    const mHead = /^(\d+)\s+(\d+)\.5(.*)$/.exec(cmd);
    if (!mHead) continue;
    let cx = Number(mHead[1]);
    const cy = Number(mHead[2]);
    const rest = mHead[3];
    const tokenRe = /([hm])(\d+)(?:\s+0)?/g;
    let tm;
    let runIdx = 0;
    while ((tm = tokenRe.exec(rest)) !== null) {
      const op = tm[1];
      const val = Number(tm[2]);
      if (op === 'h') {
        const def = ShapeNodeDefinition.createDefault();
        def.setShape(ShapeRectangle.create());
        def.setBoundingRectangle(
          makeRectPx(xIn + padIn + cx * modIn, yIn + padIn + cy * modIn, val * modIn, modIn * 1.02, ox, oy)
        );
        def.addBrushFillDescriptor(darkFill);
        def.userDescription = `${name}_r${cy}_${runIdx++}`;
        builder.addNode(def);
        cx += val;
      } else {
        cx += val;
      }
    }
  }
  doc.executeCommand(builder.createCommand(true, NodeChildType.Main));
}

/**
 * Draws a dark Pitch Poster card mirroring palette.lynnjones.rocks (full-bento or compact).
 */
function addPitchPosterCard(doc, styles, cfg) {
  const {
    id,
    pageNum,
    xIn,
    yIn,
    wIn,
    hIn,
    ox,
    oy,
    pIdx,
    sIdx,
    tIdx,
    uIdx,
    uDial, // 'p' | 's' | 't'
    pWord,
    sWord,
    tWord,
    uWord,
    fullBento = true,
    prompts = null, // [tex, foot, hook]
    mods = null,    // [engine, ps2, ps3]
  } = cfg;

  const pSw = DIAL_SWATCHES[pIdx - 1];
  const sSw = DIAL_SWATCHES[sIdx - 1];
  const tSw = DIAL_SWATCHES[tIdx - 1];
  const uSw = DIAL_SWATCHES[uIdx - 1];
  const out = [];

  const isLightStock = pIdx === 2 || pIdx === 4 || pIdx === 5;
  const stockMap = {
    1: { bg: RGB8(22, 16, 36), border: pSw.bg, panel: RGB8(30, 22, 46) },
    2: { bg: RGB8(226, 209, 179), border: RGB8(140, 90, 32), panel: RGB8(216, 196, 160) },
    3: { bg: RGB8(15, 9, 22), border: pSw.bg, panel: RGB8(26, 14, 36) },
    4: { bg: RGB8(218, 240, 229), border: RGB8(47, 140, 116), panel: RGB8(204, 232, 218) },
    5: { bg: RGB8(252, 247, 234), border: RGB8(212, 144, 10), panel: RGB8(244, 233, 205) },
    6: { bg: RGB8(12, 14, 24), border: pSw.bg, panel: RGB8(20, 24, 38) },
    7: { bg: RGB8(20, 44, 72), border: pSw.bg, panel: RGB8(26, 54, 86) },
    8: { bg: RGB8(64, 29, 14), border: RGB8(140, 61, 32), panel: RGB8(42, 19, 10) },
  };
  const stock = stockMap[pIdx] || { bg: PALETTE.neutralCard, border: pSw.bg, panel: PALETTE.neutralPanel };

  const cardRect = makeRectPx(xIn, yIn, wIn, hIn, ox, oy);
  const cardNode = addShadowCard(
    doc,
    cardRect,
    stock.bg,
    stock.border,
    1.4,
    pSw.bg,
    3.0,
    5,
    ShapeCornerType.Round,
    `${id}_card`
  );
  addClippedTextureImage(doc, cardNode, cardRect, pIdx, `${id}_tex`);

  const pad = fullBento ? 0.16 : 0.12;
  const innerW = wIn - 2 * pad;
  const wordPt = fullBento ? 18.0 : 13.5;
  const wordLead = fullBento ? 19.2 : 14.5;
  const subPt = 10.0;
  const subLead = 11.4;

  let cy = yIn + (fullBento ? 0.14 : 0.10);

  const inkFor = (sw) => (isLightStock ? sw.text : sw.light);
  const lines = [
    { key: 'p', word: pWord, align: ParagraphAlignXType.Left, col: inkFor(pSw) },
    { key: 's', word: sWord, align: ParagraphAlignXType.Centre, col: inkFor(sSw) },
    { key: 't', word: tWord, align: ParagraphAlignXType.Right, col: inkFor(tSw) },
  ];

  for (const ln of lines) {
    const wRes = createTextFrameWithAutoFit(doc, styles, {
      id: `${id}_w_${ln.key}`,
      pageNum,
      rect: makeRectPx(xIn + pad, cy, innerW, fullBento ? 0.29 : 0.22, ox, oy),
      theme: 'neutral',
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: ln.word,
          forceFontKey: 'displayHeavy',
          fontPt: wordPt,
          leadingPt: wordLead,
          caps: CapsType.AllCaps,
          colour: ln.col,
          align: ln.align,
          spaceAfterPt: 0,
        },
      ],
    });
    out.push(wRes);
    cy += fullBento ? 0.29 : 0.22;

    if (uDial === ln.key && uWord) {
      // Measure actual Dial word ink box so the hairline sits dead-center between Dial & Undertow ink
      let wInk = null;
      try {
        wInk = wRes.node.getExactSpreadVisibleBox(false, false);
      } catch {
        wInk = null;
      }
      const gapIn = fullBento ? 0.12 : 0.10;
      const wBottomIn = wInk ? (wInk.y + wInk.height - oy) / IN : cy - 0.03;
      const wMidXIn = wInk ? (wInk.x + wInk.width / 2 - ox) / IN : xIn + wIn / 2;
      const ruleW = wInk ? Math.max(0.75, (wInk.width / IN) * 1.04) : Math.min(innerW * 0.48, Math.max(0.88, ln.word.length * (fullBento ? 0.155 : 0.115)));
      const rx1 = wMidXIn - ruleW / 2;
      const uTopIn = wBottomIn + gapIn;

      const uCol = inkFor(uSw);
      const uRes = createTextFrameWithAutoFit(doc, styles, {
        id: `${id}_u_txt`,
        pageNum,
        rect: makeRectPx(rx1 - 0.16, uTopIn, ruleW + 0.32, 0.20, ox, oy),
        theme: 'neutral',
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: uWord,
            forceFontKey: 'monoBold',
            fontPt: subPt,
            leadingPt: subLead,
            colour: uCol,
            align: ParagraphAlignXType.Centre,
            spaceAfterPt: 0,
          },
        ],
      });
      out.push(uRes);

      let uInk = null;
      try {
        uInk = uRes.node.getExactSpreadVisibleBox(false, false);
      } catch {
        uInk = null;
      }
      const ruleYPx = wInk && uInk
        ? (wInk.y + wInk.height + uInk.y) / 2
        : oy + (wBottomIn + gapIn / 2) * IN;

      addLineSegment(
        doc,
        ox + rx1 * IN,
        ruleYPx,
        ox + (rx1 + ruleW) * IN,
        ruleYPx,
        uCol,
        0.75,
        `${id}_u_rule`
      );
      cy = (uInk ? (uInk.y + uInk.height - oy) / IN : uTopIn + 0.16) + (fullBento ? 0.08 : 0.06);
    } else {
      cy += fullBento ? 0.04 : 0.02;
    }
  }

  if (fullBento && prompts) {
    // Identity Prompts Bento Box (10 pt floor, system-neutral!)
    const idY = yIn + 1.48;
    const idH = 0.86;
    const bentoBorder = isLightStock ? PALETTE.neutralGoldText : PALETTE.neutralGold;
    const bentoHdrCol = isLightStock ? PALETTE.neutralGoldText : PALETTE.neutralGold;
    const bentoSubCol = isLightStock ? PALETTE.mutedInk : PALETTE.neutralSubtleText;
    const bentoValCol = isLightStock ? PALETTE.neutralDark : PALETTE.white;
    const bentoDivCol = isLightStock ? PALETTE.neutralBorder : PALETTE.neutralDarkBorder;

    addRectShape(doc, makeRectPx(xIn + pad, idY, innerW, idH, ox, oy), stock.panel, bentoBorder, 0.75, `${id}_id_box`, 0);
    out.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `${id}_id_hdr`,
        pageNum,
        rect: makeRectPx(xIn + pad + 0.10, idY + 0.07, innerW - 0.20, 0.20, ox, oy),
        theme: 'neutral',
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: 'IDENTITY PROMPTS',
            forceFontKey: 'displayBold',
            fontPt: 10.0,
            leadingPt: 11.2,
            colour: bentoHdrCol,
            spaceAfterPt: 0,
          },
        ],
      })
    );

    const pLabels = ['Texture', 'Foothold', 'Hook'];
    const pColW = (innerW - 0.20) / 3;
    for (let i = 0; i < 3; i++) {
      const px = xIn + pad + 0.10 + i * pColW;
      if (i > 0) {
        addLineSegment(doc, ox + (px - 0.04) * IN, oy + (idY + 0.30) * IN, ox + (px - 0.04) * IN, oy + (idY + idH - 0.08) * IN, bentoDivCol, 0.5, `${id}_id_div${i}`);
      }
      out.push(
        createTextFrameWithAutoFit(doc, styles, {
          id: `${id}_id_c${i}`,
          pageNum,
          rect: makeRectPx(px, idY + 0.30, pColW - 0.06, 0.50, ox, oy),
          theme: 'neutral',
          blocks: [
            {
              kind: 'body',
              text: pLabels[i],
              forceFontKey: 'displaySemi',
              fontPt: 10.0,
              leadingPt: 11.4,
              colour: bentoSubCol,
              spaceAfterPt: 1.5,
            },
            {
              kind: 'body',
              text: prompts[i],
              forceFontKey: 'displayBold',
              fontPt: 10.5,
              leadingPt: 12.0,
              colour: bentoValCol,
              spaceAfterPt: 0,
            },
          ],
        })
      );
    }

    // 3 Bottom Cortex Bento Tiles (10 pt floor — only drawn when mods are provided)
    if (mods) {
      const modY = idY + idH + 0.10;
      const modH = hIn - (modY - yIn) - 0.14;
      const gap = 0.08;
      const tileW = (innerW - 2 * gap) / 3;
      const mLabels = ['Engine Mod', 'Prime Set 2', 'Prime Set 3'];
      const mCols = [pSw.bg, sSw.bg, tSw.bg];
      for (let i = 0; i < 3; i++) {
        const tx = xIn + pad + i * (tileW + gap);
        addRectShape(doc, makeRectPx(tx, modY, tileW, modH, ox, oy), PALETTE.neutralPanel, mCols[i], 0.85, `${id}_mod_${i}`, 0);
        out.push(
          createTextFrameWithAutoFit(doc, styles, {
            id: `${id}_mod_hdr_${i}`,
            pageNum,
            rect: makeRectPx(tx + 0.08, modY + 0.07, tileW - 0.16, 0.20, ox, oy),
            theme: 'neutral',
            allowAutoTighten: false,
            blocks: [
              {
                kind: 'body',
                text: mLabels[i],
                forceFontKey: 'displayBold',
                fontPt: 10.0,
                leadingPt: 11.2,
                colour: PALETTE.neutralGold,
                spaceAfterPt: 0,
              },
            ],
          }),
          createTextFrameWithAutoFit(doc, styles, {
            id: `${id}_mod_txt_${i}`,
            pageNum,
            rect: makeRectPx(tx + 0.08, modY + 0.30, tileW - 0.16, modH - 0.36, ox, oy),
            theme: 'neutral',
            blocks: [
              {
                kind: 'body',
                text: mods[i],
                forceFontKey: 'displayBold',
                fontPt: 10.0,
                leadingPt: 11.6,
                colour: PALETTE.white,
                spaceAfterPt: 0,
              },
            ],
          })
        );
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// 5. Master Spread Builders (P1–P4 Neutral, P5–P8 Cortex)
// ---------------------------------------------------------------------------

function setSpreadIfNeeded(doc, spread) {
  if (!doc.currentSpread.isSameNode(spread)) {
    doc.executeCommand(DocumentCommand.createSetCurrentSpread(spread));
  }
}

function populateMasterSpread(doc, styles, masterSpread, leftTheme, rightTheme = leftTheme) {
  setSpreadIfNeeded(doc, masterSpread);
  const ext = masterSpread.getSpreadExtents({
    includeSpread: true,
    includeBleed: false,
    includeChildren: false,
  });
  const halfW = ext.width / 2;
  const pageOrigins = [
    { x: ext.x, y: ext.y, side: 'L', theme: leftTheme },
    { x: ext.x + halfW, y: ext.y, side: 'R', theme: rightTheme },
  ];

  for (const pg of pageOrigins) {
    const isCortex = pg.theme === 'cortex';
    const footerLeft = '4D8 WORLDS';
    const footerRight = isCortex ? 'CORTEX PRIME' : 'SYSTEM-NEUTRAL';

    if (isCortex) {
      const splitW = (PAGE_W_IN + BLEED_IN) * 0.65;
      addRectShape(
        doc,
        new Rectangle(pg.x - (pg.side === 'L' ? BLEED_IN * IN : 0), pg.y - BLEED_IN * IN, splitW * IN, 0.16 * IN),
        PALETTE.cortexCyan,
        null,
        0,
        `master_cortex_${pg.side}_bleed_c`,
        0
      );
      addRectShape(
        doc,
        new Rectangle(pg.x - (pg.side === 'L' ? BLEED_IN * IN : 0) + splitW * IN, pg.y - BLEED_IN * IN, (PAGE_W_IN + BLEED_IN - splitW) * IN, 0.16 * IN),
        PALETTE.cortexMagenta,
        null,
        0,
        `master_cortex_${pg.side}_bleed_m`,
        0
      );
    } else {
      addRectShape(
        doc,
        new Rectangle(pg.x - (pg.side === 'L' ? BLEED_IN * IN : 0), pg.y - BLEED_IN * IN, (PAGE_W_IN + BLEED_IN) * IN, 0.16 * IN),
        PALETTE.neutralAccent,
        null,
        0,
        `master_neutral_${pg.side}_bleed`,
        0
      );
    }

    const footRuleY = 7.76;
    if (isCortex) {
      addLineSegment(doc, pg.x + MARGIN_IN * IN, pg.y + footRuleY * IN, pg.x + (MARGIN_IN + CONTENT_W_IN * 0.65) * IN, pg.y + footRuleY * IN, PALETTE.cortexCyan, 0.85, `master_c_${pg.side}_fc`);
      addLineSegment(doc, pg.x + (MARGIN_IN + CONTENT_W_IN * 0.65) * IN, pg.y + footRuleY * IN, pg.x + (MARGIN_IN + CONTENT_W_IN) * IN, pg.y + footRuleY * IN, PALETTE.cortexMagenta, 0.85, `master_c_${pg.side}_fm`);
    } else {
      addLineSegment(doc, pg.x + MARGIN_IN * IN, pg.y + footRuleY * IN, pg.x + (MARGIN_IN + CONTENT_W_IN) * IN, pg.y + footRuleY * IN, PALETTE.neutralBorder, 0.75, `master_n_${pg.side}_fr`);
    }

    createTextFrameWithAutoFit(doc, styles, {
      id: `master_${pg.theme}_${pg.side}_fl`,
      pageNum: 0,
      rect: makeRectPx(MARGIN_IN, 7.82, 2.55, 0.24, pg.x, pg.y),
      theme: pg.theme,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: footerLeft,
          forceFontKey: 'displaySemi',
          fontPt: 10.0,
          leadingPt: 11.2,
          trackingEm: 0.02,
          caps: CapsType.AllCaps,
          colour: PALETTE.mutedInk,
          spaceAfterPt: 0,
        },
      ],
    });
    createTextFrameWithAutoFit(doc, styles, {
      id: `master_${pg.theme}_${pg.side}_fr`,
      pageNum: 0,
      rect: makeRectPx(MARGIN_IN + 2.55, 7.82, CONTENT_W_IN - 2.55, 0.24, pg.x, pg.y),
      theme: pg.theme,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: footerRight,
          forceFontKey: 'displayBold',
          fontPt: 10.0,
          leadingPt: 11.2,
          trackingEm: 0.02,
          caps: CapsType.AllCaps,
          colour: isCortex ? PALETTE.cortexCyanDark : PALETTE.neutralAccent,
          align: ParagraphAlignXType.Right,
          spaceAfterPt: 0,
        },
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// 6. Page Content Builders (Pages 1–16, strict >= 10.0 pt floor)
// ---------------------------------------------------------------------------

function buildPage1(doc, styles, ox, oy) {
  const results = [];

  // Full-bleed dark obsidian cover canvas
  addRectShape(
    doc,
    new Rectangle(ox - BLEED_IN * IN, oy - BLEED_IN * IN, (PAGE_W_IN + BLEED_IN) * IN, (PAGE_H_IN + 2 * BLEED_IN) * IN),
    PALETTE.neutralDark,
    null,
    0,
    'p1_bg',
    0
  );
  // Top vermilion + bottom solar gold accent bands
  addRectShape(doc, new Rectangle(ox - BLEED_IN * IN, oy - BLEED_IN * IN, (PAGE_W_IN + BLEED_IN) * IN, 0.22 * IN), PALETTE.neutralAccent, null, 0, 'p1_top_bar', 0);
  addRectShape(doc, new Rectangle(ox - BLEED_IN * IN, oy + (PAGE_H_IN - 0.14) * IN, (PAGE_W_IN + BLEED_IN) * IN, (0.14 + BLEED_IN) * IN), PALETTE.neutralGold, null, 0, 'p1_bot_bar', 0);

  // Kicker (10 pt floor)
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_kicker',
      pageNum: 1,
      rect: makeRectPx(MARGIN_IN, 0.40, CONTENT_W_IN, 0.24, ox, oy),
      theme: 'neutral',
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'P2–8: SYSTEM-NEUTRAL  ·  P9–16: CORTEX PRIME',
          forceFontKey: 'displaySemi',
          fontPt: 10.0,
          leadingPt: 11.4,
          trackingEm: 0.02,
          caps: CapsType.AllCaps,
          colour: PALETTE.neutralGold,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Display Cover Title — bold 2-line lockup for "4d8 Worlds"
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_title',
      pageNum: 1,
      rect: makeRectPx(MARGIN_IN, 0.78, CONTENT_W_IN, 1.78, ox, oy),
      theme: 'neutral',
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: '4d8',
          forceFontKey: 'displayHeavy',
          fontPt: 46.0,
          leadingPt: 44.0,
          trackingEm: 0.02,
          colour: PALETTE.white,
          spaceAfterPt: 0,
        },
        {
          kind: 'body',
          text: 'WORLDS',
          forceFontKey: 'displayHeavy',
          fontPt: 44.0,
          leadingPt: 44.0,
          trackingEm: 0.03,
          caps: CapsType.AllCaps,
          colour: PALETTE.neutralGold,
          spaceAfterPt: 10.0,
        },
        {
          kind: 'body',
          text: '*Find your Palette. Dial in your Setting. Strike a Tone.*',
          fontPt: 10.8,
          leadingPt: 14.0,
          colour: PALETTE.neutralSubtleText,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // 8-Swatch Tactile Material Preview Grid (matching Pass 1 poster stocks!)
  const gx = MARGIN_IN;
  const gy = 2.66;
  const gw = CONTENT_W_IN;
  const gh = 2.12;
  const gridGap = 0.06;

  addRectShape(doc, makeRectPx(gx, gy, gw, gh, ox, oy), PALETTE.neutralCard, PALETTE.neutralDarkBorder, 0.85, 'p1_grid_frame', 0);

  const gPad = 0.10;
  const gInnerW = gw - 2 * gPad;
  const gInnerH = gh - 2 * gPad;
  const gRowH = (gInnerH - gridGap) / 2;
  const row1W = [0.29, 0.23, 0.26, 0.22];
  const row2W = [0.22, 0.26, 0.27, 0.25];
  const swatchNums = ['01', '02', '03', '04', '05', '06', '07', '08'];
  const swatchNames = ['PRISMATIC', 'SEPIA', 'NEON', 'PASTEL', 'BRIGHT', 'DARK', 'CHROME', 'RUST'];
  const coverStock = [
    { bg: RGB8(24, 16, 40), border: DIAL_SWATCHES[0].bg, numCol: DIAL_SWATCHES[0].light, lblCol: PALETTE.white },
    { bg: RGB8(226, 209, 179), border: RGB8(140, 90, 32), numCol: DIAL_SWATCHES[1].text, lblCol: PALETTE.neutralDark },
    { bg: RGB8(15, 9, 22), border: DIAL_SWATCHES[2].bg, numCol: DIAL_SWATCHES[2].light, lblCol: PALETTE.white },
    { bg: RGB8(218, 240, 229), border: RGB8(47, 140, 116), numCol: DIAL_SWATCHES[3].text, lblCol: PALETTE.neutralDark },
    { bg: RGB8(252, 247, 234), border: RGB8(212, 144, 10), numCol: DIAL_SWATCHES[4].text, lblCol: PALETTE.neutralDark },
    { bg: RGB8(14, 18, 30), border: RGB8(72, 86, 126), numCol: DIAL_SWATCHES[5].light, lblCol: PALETTE.white },
    { bg: RGB8(20, 44, 72), border: DIAL_SWATCHES[6].bg, numCol: DIAL_SWATCHES[6].light, lblCol: PALETTE.white },
    { bg: RGB8(64, 29, 14), border: RGB8(168, 72, 34), numCol: DIAL_SWATCHES[7].light, lblCol: PALETTE.white },
  ];

  const drawGridRow = (widths, yPos, startIdx) => {
    let cx = gx + gPad;
    const availW = gInnerW - 3 * gridGap;
    for (let i = 0; i < 4; i++) {
      const idx = startIdx + i;
      const bw = availW * widths[i];
      const cs = coverStock[idx];
      const blkRect = makeRectPx(cx, yPos, bw, gRowH, ox, oy);
      const blkNode = addRectShape(doc, blkRect, cs.bg, cs.border, 1.0, `p1_blk_${idx}`, 0);
      addClippedTextureImage(doc, blkNode, blkRect, idx + 1, `p1_tex_${idx}`);

      results.push(
        createTextFrameWithAutoFit(doc, styles, {
          id: `p1_num_${idx}`,
          pageNum: 1,
          rect: makeRectPx(cx + 0.07, yPos + 0.06, bw - 0.12, 0.20, ox, oy),
          theme: 'neutral',
          allowAutoTighten: false,
          blocks: [
            {
              kind: 'body',
              text: swatchNums[idx],
              forceFontKey: 'monoBold',
              fontPt: 10.0,
              leadingPt: 11.0,
              colour: cs.numCol,
              align: idx === 6 ? ParagraphAlignXType.Right : ParagraphAlignXType.Left,
              spaceAfterPt: 0,
            },
          ],
        }),
        createTextFrameWithAutoFit(doc, styles, {
          id: `p1_lbl_${idx}`,
          pageNum: 1,
          rect: makeRectPx(cx + 0.07, yPos + gRowH - 0.24, bw - 0.10, 0.20, ox, oy),
          theme: 'neutral',
          allowAutoTighten: false,
          blocks: [
            {
              kind: 'body',
              text: swatchNames[idx],
              forceFontKey: 'displayBold',
              fontPt: 10.0,
              leadingPt: 11.0,
              caps: CapsType.AllCaps,
              colour: cs.lblCol,
              spaceAfterPt: 0,
            },
          ],
        })
      );
      cx += bw + gridGap;
    }
  };
  drawGridRow(row1W, gy + gPad, 0);
  drawGridRow(row2W, gy + gPad + gRowH + gridGap, 4);

  // Central Gold 4d8 Diamond Core (0.48 in, 10 pt numeral)
  const coreSize = 0.48;
  const coreX = gx + gw / 2 - coreSize / 2;
  const coreY = gy + gh / 2 - coreSize / 2;
  addDiamondShape(doc, makeRectPx(coreX, coreY, coreSize, coreSize, ox, oy), PALETTE.neutralDark, PALETTE.neutralGold, 1.5, 'p1_core_d');
  const coreTxt = createTextFrameWithAutoFit(doc, styles, {
    id: 'p1_core_txt',
    pageNum: 1,
    rect: makeRectPx(coreX, coreY + 0.14, coreSize, 0.20, ox, oy),
    theme: 'neutral',
    allowAutoTighten: false,
    blocks: [{ kind: 'body', text: '4d8', forceFontKey: 'displayHeavy', fontPt: 10.0, leadingPt: 11.0, colour: PALETTE.neutralGold, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 }],
  });
  centerTextInkInRect(doc, coreTxt.node, coreX, coreY, coreSize, coreSize, ox, oy, true);
  results.push(coreTxt);

  // R · P · G Editorial Step List (y: 5.04 .. 6.96)
  const rpgRows = [
    { num: '01', verb: 'ROLL 4D8', verbCol: PALETTE.neutralGold, pips: [8, 7, 3, 2] },
    { num: '02', verb: 'PLACE', verbCol: PALETTE.white, copy: 'three dice into **Palette**, **Setting**, and **Tone**.' },
    { num: '03', verb: 'GRIND', verbCol: PALETTE.white, copy: 'the fourth into any Dial as the **Undertow**.' },
  ];

  let ry = 5.04;
  const rowH = 0.60;
  for (let i = 0; i < rpgRows.length; i++) {
    const row = rpgRows[i];
    addLineSegment(
      doc,
      ox + MARGIN_IN * IN,
      oy + ry * IN,
      ox + (MARGIN_IN + CONTENT_W_IN) * IN,
      oy + ry * IN,
      i === 0 ? PALETTE.neutralGold : PALETTE.neutralDarkBorder,
      i === 0 ? 1.2 : 0.7,
      `p1_rpg_rule_${i}`
    );

    const numTxt = createTextFrameWithAutoFit(doc, styles, {
      id: `p1_rpg_num_${i}`,
      pageNum: 1,
      rect: makeRectPx(MARGIN_IN, ry + 0.14, 0.34, 0.24, ox, oy),
      theme: 'neutral',
      allowAutoTighten: false,
      blocks: [{ kind: 'body', text: row.num, forceFontKey: 'monoBold', fontPt: 10.0, leadingPt: 11.2, colour: PALETTE.neutralGold, spaceAfterPt: 0 }],
    });
    const verbTxt = createTextFrameWithAutoFit(doc, styles, {
      id: `p1_rpg_verb_${i}`,
      pageNum: 1,
      rect: makeRectPx(MARGIN_IN + 0.38, ry + 0.14, 1.12, 0.24, ox, oy),
      theme: 'neutral',
      allowAutoTighten: false,
      blocks: [{ kind: 'body', text: row.verb, forceFontKey: 'displayHeavy', fontPt: 11.0, leadingPt: 12.2, caps: CapsType.AllCaps, colour: row.verbCol, spaceAfterPt: 0 }],
    });
    centerTextInkInRect(doc, numTxt.node, MARGIN_IN, ry, 0.34, rowH, ox, oy, false);
    centerTextInkInRect(doc, verbTxt.node, MARGIN_IN + 0.38, ry, 1.12, rowH, ox, oy, false);
    results.push(numTxt, verbTxt);

    if (row.pips) {
      const pipSize = 0.42;
      const pipGap = 0.14;
      const startX = MARGIN_IN + 1.56;
      for (let k = 0; k < row.pips.length; k++) {
        const val = row.pips[k];
        const sw = DIAL_SWATCHES[val - 1];
        const px = startX + k * (pipSize + pipGap);
        const py = ry + (rowH - pipSize) / 2;
        addDiamondShape(doc, makeRectPx(px, py, pipSize, pipSize, ox, oy), sw.bg, null, 0, `p1_pip_${k}`);
        const pipTxt = createTextFrameWithAutoFit(doc, styles, {
          id: `p1_pip_txt_${k}`,
          pageNum: 1,
          rect: makeRectPx(px, py + 0.11, pipSize, 0.20, ox, oy),
          theme: 'neutral',
          allowAutoTighten: false,
          blocks: [{ kind: 'body', text: String(val), forceFontKey: 'displayHeavy', fontPt: 11.5, leadingPt: 12.2, colour: sw.fg, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 }],
        });
        centerTextInkInRect(doc, pipTxt.node, px, py, pipSize, pipSize, ox, oy, true);
        results.push(pipTxt);
      }
    } else {
      const copyRes = createTextFrameWithAutoFit(doc, styles, {
        id: `p1_rpg_copy_${i}`,
        pageNum: 1,
        rect: makeRectPx(MARGIN_IN + 1.56, ry + 0.08, CONTENT_W_IN - 1.56, 0.44, ox, oy),
        theme: 'neutral',
        blocks: [{ kind: 'body', text: row.copy, fontPt: 10.5, leadingPt: 13.0, colour: PALETTE.white, boldColour: PALETTE.neutralGold, spaceAfterPt: 0 }],
      });
      centerTextInkInRect(doc, copyRes.node, MARGIN_IN + 1.56, ry, CONTENT_W_IN - 1.56, rowH, ox, oy, false);
      results.push(copyRes);
    }
    ry += rowH;
  }

  // Cover Footer (10 pt floor)
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 7.30 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 7.30 * IN, PALETTE.neutralDarkBorder, 0.85, 'p1_foot_rule');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_byline',
      pageNum: 1,
      rect: makeRectPx(MARGIN_IN, 7.42, CONTENT_W_IN, 0.36, ox, oy),
      theme: 'neutral',
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'LYNN JONES  ·  PALETTE.LYNNJONES.ROCKS',
          forceFontKey: 'displayBold',
          fontPt: 10.0,
          leadingPt: 11.5,
          trackingEm: 0.03,
          caps: CapsType.AllCaps,
          colour: PALETTE.neutralSubtleText,
          align: ParagraphAlignXType.Centre,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  return results;
}

function buildPage2(doc, styles, ox, oy) {
  const results = [];
  const col1X = MARGIN_IN;
  const col2X = MARGIN_IN + COL_W_IN + GUTTER_IN;

  results.push(...addChamferedBanner(doc, styles, 2, ox, oy, 'neutral', '02 · PITCH POSTER ANATOMY', 'ANATOMY'));

  // Full-Width System-Neutral Hero Pitch Poster (y: 0.80 .. 3.34 — zero Cortex bleed!)
  results.push(
    ...addPitchPosterCard(doc, styles, {
      id: 'p2_hero_poster',
      pageNum: 2,
      xIn: MARGIN_IN,
      yIn: 0.80,
      wIn: CONTENT_W_IN,
      hIn: 2.52,
      ox,
      oy,
      pIdx: 2,
      sIdx: 2,
      tIdx: 2,
      uIdx: 1,
      uDial: 's',
      pWord: 'SEPIA',
      sWord: 'INDUSTRIAL',
      tWord: 'PULP',
      uWord: 'Liminal',
      fullBento: true,
      prompts: ['Relic', 'Trade', 'Trademark'],
      mods: null,
    })
  );

  // 2-Column 100% System-Neutral Anatomy Key (y: 3.56 .. 5.90, all >= 10 pt)
  const leftKey = [
    '**1 · Palette (Left)** — Visual texture, light, and material mood.',
    '**2 · Setting (Center)** — Play space and era. The 4th die sits under its divider.',
  ];
  const rightKey = [
    '**3 · Tone (Right)** — Campaign drive, stakes, and genre rhythm.',
    '**Identity Prompts** — Three character hooks used in Pass 1 on Page 6.',
  ];

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_key_l',
      pageNum: 2,
      rect: makeRectPx(col1X, 3.56, COL_W_IN, 2.20, ox, oy),
      theme: 'neutral',
      blocks: leftKey.map((text, i) => ({
        kind: 'body',
        text,
        fontPt: 10.2,
        leadingPt: 13.0,
        leadColour: PALETTE.neutralDark,
        spaceAfterPt: i === 1 ? 0 : 10.0,
      })),
    }),
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_key_r',
      pageNum: 2,
      rect: makeRectPx(col2X, 3.56, COL_W_IN, 2.20, ox, oy),
      theme: 'neutral',
      blocks: rightKey.map((text, i) => ({
        kind: 'body',
        text,
        fontPt: 10.2,
        leadingPt: 13.0,
        leadColour: i === 1 ? PALETTE.neutralGoldText : PALETTE.neutralDark,
        spaceAfterPt: i === 1 ? 0 : 10.0,
      })),
    })
  );

  // Matched Pair & 4-of-a-Kind Editorial Columns (y: 6.08 .. 7.46)
  const boxY = 6.08;
  const boxH = 1.38;
  addLineSegment(doc, ox + col1X * IN, oy + boxY * IN, ox + (col1X + COL_W_IN) * IN, oy + boxY * IN, PALETTE.neutralGold, 1.8, 'p2_pair_top');
  addLineSegment(doc, ox + col1X * IN, oy + (boxY + boxH) * IN, ox + (col1X + COL_W_IN) * IN, oy + (boxY + boxH) * IN, PALETTE.neutralBorder, 0.7, 'p2_pair_bot');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_pair_txt',
      pageNum: 2,
      rect: makeRectPx(col1X, boxY + 0.12, COL_W_IN, boxH - 0.18, ox, oy),
      theme: 'neutral',
      blocks: [
        { kind: 'body', text: '**Matched Pair → Double Down**', fontPt: 10.2, leadingPt: 12.4, colour: PALETTE.neutralGoldText, spaceAfterPt: 4.0 },
        { kind: 'body', text: 'Polish instead of grind. Turn up the volume on one dial.', fontPt: 10.2, leadingPt: 12.8, spaceAfterPt: 0 },
      ],
    })
  );

  addLineSegment(doc, ox + col2X * IN, oy + boxY * IN, ox + (col2X + COL_W_IN) * IN, oy + boxY * IN, PALETTE.neutralAccent, 1.8, 'p2_quad_top');
  addLineSegment(doc, ox + col2X * IN, oy + (boxY + boxH) * IN, ox + (col2X + COL_W_IN) * IN, oy + (boxY + boxH) * IN, PALETTE.neutralBorder, 0.7, 'p2_quad_bot');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_quad_txt',
      pageNum: 2,
      rect: makeRectPx(col2X, boxY + 0.12, COL_W_IN, boxH - 0.18, ox, oy),
      theme: 'neutral',
      blocks: [
        { kind: 'body', text: '**4-of-a-Kind → Pure Archetype**', fontPt: 10.2, leadingPt: 12.4, boldColour: PALETTE.neutralAccent, spaceAfterPt: 4.0 },
        { kind: 'body', text: 'Skip the Undertow. Lean in on tropes. Enjoy some popcorn.', fontPt: 10.2, leadingPt: 12.8, spaceAfterPt: 0 },
      ],
    })
  );

  return results;
}

function buildPage3(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 3, ox, oy, 'neutral', '03 · THE UNDERTOW', '4TH DIE'));

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p3_lede',
      pageNum: 3,
      rect: makeRectPx(MARGIN_IN, 0.76, CONTENT_W_IN, 0.56, ox, oy),
      theme: 'neutral',
      blocks: [
        {
          kind: 'body',
          text: 'Your fourth `d8` grinds friction into whichever Dial it touches. Place it beneath that Dial\'s divider line to pick its mode.',
          fontPt: 10.5,
          leadingPt: 13.2,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  const modes = [
    {
      tag: 'DIVIDE',
      dial: 'On Palette',
      col: DIAL_SWATCHES[0].text,
      ruleCol: DIAL_SWATCHES[0].bg,
      body: 'Split class, zone, or day and night: *Chrome spires, Rust slums*.',
      poster: { pIdx: 7, sIdx: 3, tIdx: 3, uIdx: 8, uDial: 'p', pWord: 'CHROME', sWord: 'FUTURE', tWord: 'PUNK', uWord: 'Rust' },
    },
    {
      tag: 'LAYER',
      dial: 'On Setting',
      col: DIAL_SWATCHES[6].text,
      ruleCol: DIAL_SWATCHES[6].bg,
      body: 'Stack or collide play spaces: *Modern streets, Mythic spirits*.',
      poster: { pIdx: 6, sIdx: 6, tIdx: 6, uIdx: 5, uDial: 's', pWord: 'DARK', sWord: 'MODERN', tWord: 'NOIR', uWord: 'Mythic' },
    },
    {
      tag: 'COUNTER',
      dial: 'On Tone',
      col: DIAL_SWATCHES[2].text,
      ruleCol: DIAL_SWATCHES[2].bg,
      body: 'Contrast front vs. stakes, or wilds vs. home: *wild Perils, Cozy camp*.',
      poster: { pIdx: 4, sIdx: 4, tIdx: 8, uIdx: 4, uDial: 't', pWord: 'PASTEL', sWord: 'HEARTH', tWord: 'PERIL', uWord: 'Cozy' },
    },
  ];

  let uy = 1.46;
  const rowH = 1.94;
  for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    addLineSegment(doc, ox + MARGIN_IN * IN, oy + uy * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + uy * IN, m.ruleCol, 1.6, `p3_ut_rule_${i}`);
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p3_ut_txt_${i}`,
        pageNum: 3,
        rect: makeRectPx(MARGIN_IN, uy + 0.14, 2.38, rowH - 0.24, ox, oy),
        theme: 'neutral',
        blocks: [
          { kind: 'h2', text: m.tag, fontPt: 12.0, leadingPt: 13.5, colour: m.col, spaceAfterPt: 4.0 },
          { kind: 'body', text: `**${m.dial}:** ${m.body}`, fontPt: 10.2, leadingPt: 13.0, leadColour: PALETTE.neutralDark, spaceAfterPt: 0 },
        ],
      }),
      ...addPitchPosterCard(doc, styles, {
        id: `p3_ut_poster_${i}`,
        pageNum: 3,
        xIn: MARGIN_IN + 2.52,
        yIn: uy + 0.16,
        wIn: CONTENT_W_IN - 2.52,
        hIn: 1.54,
        ox,
        oy,
        ...m.poster,
        fullBento: false,
      })
    );
    uy += rowH + 0.12;
  }

  return results;
}

function buildPage4(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 4, ox, oy, 'neutral', '04 · MASTER DIAL MATRIX', 'PART 1/2'));

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p4_lede',
      pageNum: 4,
      rect: makeRectPx(MARGIN_IN, 0.72, CONTENT_W_IN, 0.44, ox, oy),
      theme: 'neutral',
      blocks: [
        {
          kind: 'body',
          text: 'Place three dice into **Palette**, **Setting**, and **Tone** in any order. Read rows 1–8 across this facing spread.',
          fontPt: 10.0,
          leadingPt: 12.4,
          colour: PALETTE.mutedInk,
          boldColour: PALETTE.neutralDark,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  results.push(
    ...buildPrecisionTable(doc, styles, {
      idPrefix: 'p4_matrix_l',
      pageNum: 4,
      originX: ox,
      originY: oy,
      xIn: MARGIN_IN,
      yIn: 1.24,
      colWidthsIn: [0.42, 2.3234, 2.3234],
      headerHeightIn: 0.36,
      headerFontPt: 10.0,
      rowHeightsIn: [0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75],
      cellFontPt: 10.0,
      cellLeadPt: 12.0,
      padHIn: 0.08,
      padVIn: 0.06,
      headers: ['d8', '1 · Palette · Texture', '2 · Setting · Space'],
      rows: [
        ['1', '**Prismatic:** Reality-bleed, shifting hues.', '**Liminal:** Thresholds, portals, crossroads.'],
        ['2', '**Sepia:** Brass warmth, weathered maps.', '**Industrial:** Coal smoke, ironworks, gears.'],
        ['3', '**Neon:** Rain-slick glow, overload.', '**Future:** Wired sprawl, near-out tech.'],
        ['4', '**Pastel:** Soft light, hand-painted calm.', '**Hearth:** Workshops, ovens, tended valleys.'],
        ['5', '**Bright:** Sun-drenched, high-contrast skies.', '**Mythic:** Active gods, spirits, sacred realms.'],
        ['6', '**Dark:** Deep shadows, sodium-lit corners.', '**Modern:** A reflection of today\'s society and tech.'],
        ['7', '**Chrome:** Mirrored sheen, sterile polish.', '**Space:** Jump-lanes, habitats, void transit.'],
        ['8', '**Rust:** Corroded iron, patched salvage.', '**Primal:** Megafauna, untamed wilds, bone.'],
      ],
      theme: 'neutral',
    })
  );

  return results;
}

function buildPage5(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 5, ox, oy, 'neutral', '05 · MASTER DIAL MATRIX', 'PART 2/2'));

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p5_lede',
      pageNum: 5,
      rect: makeRectPx(MARGIN_IN, 0.72, CONTENT_W_IN, 0.44, ox, oy),
      theme: 'neutral',
      blocks: [
        {
          kind: 'body',
          text: 'Four matching dice unlock the **Pure Archetype** on the right. Skip the Undertow and run that row at max volume.',
          fontPt: 10.0,
          leadingPt: 12.4,
          colour: PALETTE.mutedInk,
          boldColour: PALETTE.neutralDark,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  results.push(
    ...buildPrecisionTable(doc, styles, {
      idPrefix: 'p5_matrix_r',
      pageNum: 5,
      originX: ox,
      originY: oy,
      xIn: MARGIN_IN,
      yIn: 1.24,
      colWidthsIn: [0.42, 2.2234, 2.4234],
      headerHeightIn: 0.36,
      headerFontPt: 10.0,
      rowHeightsIn: [0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75],
      cellFontPt: 10.0,
      cellLeadPt: 12.0,
      padHIn: 0.08,
      padVIn: 0.06,
      headers: ['d8', '3 · Tone · Drive', 'Pure Archetype'],
      rows: [
        ['1', '**Weird:** Uncanny mystery, impossible rules.', '**Labyrinthine Surrealism** — *Control, Piranesi*'],
        ['2', '**Pulp:** Two-fisted stunts, cliffhangers.', '**Gaslamp Serial** — *The Mummy, Arcane*'],
        ['3', '**Punk:** Reject the system.', '**Classic Cyberpunk** — *Edgerunners, Akira*'],
        ['4', '**Cozy:** Mutual aid, mending rifts, routine.', '**Pastoral Storycraft** — *Kiki\'s, Wanderhome*'],
        ['5', '**Heroic:** Clear stakes, shielding the weak.', '**High Mythic Fantasy** — *Hades, Mononoke*'],
        ['6', '**Noir:** A web of lies and hard choices.', '**Hardboiled Crime** — *Se7en, True Detective*'],
        ['7', '**Adventure:** Bold crews, uncharted horizons.', '**Golden-Age Sci-Fi** — *Star Trek, Mass Effect*'],
        ['8', '**Peril:** Scarce safety, lethal hazards.', '**Grim Survival** — *Mad Max, Scavengers Reign*'],
      ],
      theme: 'neutral',
    })
  );

  return results;
}

function buildPage6(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 6, ox, oy, 'neutral', '06 · SESSION ZERO: PASS 1', 'PROMPTS'));

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p6_intro',
      pageNum: 6,
      rect: makeRectPx(MARGIN_IN, 0.76, CONTENT_W_IN, 0.72, ox, oy),
      theme: 'neutral',
      blocks: [
        {
          kind: 'body',
          text: 'Center your Pitch + Undertow on a blank canvas. Pass the pencil around the table 4 times. **Pass 1:** Draw a Character Circle on the edge and write your 3 Dial prompt answers inside it:',
          fontPt: 10.4,
          leadingPt: 13.0,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  results.push(
    ...buildPrecisionTable(doc, styles, {
      idPrefix: 'p6_id_table',
      pageNum: 6,
      originX: ox,
      originY: oy,
      xIn: MARGIN_IN,
      yIn: 1.58,
      colWidthsIn: [0.42, 1.5489, 1.5489, 1.549],
      headerHeightIn: 0.38,
      headerFontPt: 10.0,
      rowHeightsIn: [0.58, 0.58, 0.58, 0.58, 0.58, 0.58, 0.58, 0.58],
      cellFontPt: 10.6,
      cellLeadPt: 12.4,
      padHIn: 0.08,
      padVIn: 0.16,
      headers: ['d8', 'Texture', 'Foothold', 'Hook'],
      rows: [
        ['1', '**Aura**', '**Tether**', '**Obsession**'],
        ['2', '**Relic**', '**Trade**', '**Trademark**'],
        ['3', '**Vice**', '**Augment**', '**Grievance**'],
        ['4', '**Comfort**', '**Workshop**', '**Routine**'],
        ['5', '**Banner**', '**Calling**', '**Oath**'],
        ['6', '**Secret**', '**Day Job**', '**Code**'],
        ['7', '**Pedigree**', '**World**', '**Horizon**'],
        ['8', '**Scar**', '**Kin**', '**Liability**'],
      ],
      theme: 'neutral',
    })
  );

  // Pure System-Neutral Tip (zero Cortex bleed!)
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 6.76 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 6.76 * IN, PALETTE.neutralGold, 1.8, 'p6_tip_top');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p6_tip_txt',
      pageNum: 6,
      rect: makeRectPx(MARGIN_IN, 6.88, CONTENT_W_IN, 0.72, ox, oy),
      theme: 'neutral',
      blocks: [
        { kind: 'body', text: '**Keep it punchy:** Three short phrases per Character are enough. Let the wires on Page 7 fill in the rest.', fontPt: 10.2, leadingPt: 12.8, leadColour: PALETTE.neutralGoldText, spaceAfterPt: 0 },
      ],
    })
  );

  return results;
}

function buildPage7(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 7, ox, oy, 'neutral', '07 · CROSS THE WIRES', 'PASS 2–4'));

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p7_pass2_4',
      pageNum: 7,
      rect: makeRectPx(MARGIN_IN, 0.80, CONTENT_W_IN, 6.72, ox, oy),
      theme: 'neutral',
      blocks: [
        { kind: 'h2', text: 'Pass 2: Cross the Wires', fontPt: 12.0, leadingPt: 13.8, spaceAfterPt: 8.0 },
        {
          kind: 'body',
          text: '• **Left · Rumor:** Draw a line to your left neighbor. State something you\'ve heard about them. They name the real truth.',
          fontPt: 10.8,
          leadingPt: 14.0,
          leftIndentPt: 12,
          firstIndentPt: -12,
          spaceAfterPt: 10.0,
        },
        {
          kind: 'body',
          text: '• **Right · Bond:** Draw a shared Box between you and your right neighbor. Name a shared tie or asset you both rely on: *Ride, Hideout, Workshop, Beast, Patron*.',
          fontPt: 10.8,
          leadingPt: 14.0,
          leftIndentPt: 12,
          firstIndentPt: -12,
          spaceAfterPt: 20.0,
        },
        { kind: 'h2', text: 'Pass 3: Stake Your Claim', fontPt: 12.0, leadingPt: 13.8, spaceAfterPt: 8.0 },
        {
          kind: 'body',
          text: '• **Edge:** Tag your Character Circle with what you\'re best at in this Setting (your top role, skill, or turf).',
          fontPt: 10.8,
          leadingPt: 14.0,
          leftIndentPt: 12,
          firstIndentPt: -12,
          spaceAfterPt: 10.0,
        },
        {
          kind: 'body',
          text: '• **Fact:** Drop a Diamond onto the canvas for a world truth, Faction, Neighbor, Belief, or Goal pulling at you. Wire your Character to it.',
          fontPt: 10.8,
          leadingPt: 14.0,
          leftIndentPt: 12,
          firstIndentPt: -12,
          spaceAfterPt: 20.0,
        },
        { kind: 'h2', text: 'Pass 4: Event Triangle', fontPt: 12.0, leadingPt: 13.8, spaceAfterPt: 8.0 },
        {
          kind: 'body',
          text: 'GM drops a central inverted Event Triangle where the *Undertow* bites and wires it to 2+ nodes on the map. That trouble is live right now. Start *in medias res*.',
          fontPt: 10.8,
          leadingPt: 14.0,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  return results;
}

function buildPage8(doc, styles, ox, oy) {
  const results = [];

  // CENTERFOLD LEFT (System-Neutral): Full-page Spaghetti Map Schematic facing Page 9 Pathways Handoff!
  results.push(...addChamferedBanner(doc, styles, 8, ox, oy, 'neutral', '08 · SPAGHETTI MAP', 'SCHEMATIC'));

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p8_intro',
      pageNum: 8,
      rect: makeRectPx(MARGIN_IN, 0.76, CONTENT_W_IN, 0.62, ox, oy),
      theme: 'neutral',
      blocks: [
        {
          kind: 'body',
          text: 'Four hand-drawn shapes turn a blank canvas into a playable campaign web. Use it as-is for any RPG, or snap it into Cortex Prime across the fold.',
          fontPt: 10.3,
          leadingPt: 13.0,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Full-Width 4-Shape Spaghetti Map Schematic (y: 1.50 .. 5.88 — zero wire/label collisions!)
  const diagY = 1.50;
  const diagH = 4.38;
  addRectShape(doc, makeRectPx(MARGIN_IN, diagY, CONTENT_W_IN, diagH, ox, oy), PALETTE.neutralCream, PALETTE.neutralDark, 1.0, 'p8_diag_card', 0);
  addRectShape(doc, makeRectPx(MARGIN_IN, diagY, CONTENT_W_IN, 0.34, ox, oy), PALETTE.neutralDark, null, 0, 'p8_diag_hdr_bg', 0);
  const diagHdr = createTextFrameWithAutoFit(doc, styles, {
    id: 'p8_diag_hdr',
    pageNum: 8,
    rect: makeRectPx(MARGIN_IN + 0.10, diagY + 0.06, CONTENT_W_IN - 0.20, 0.22, ox, oy),
    theme: 'neutral',
    allowAutoTighten: false,
    blocks: [
      {
        kind: 'body',
        text: 'SPAGHETTI MAP SCHEMATIC',
        forceFontKey: 'displayBold',
        fontPt: 10.0,
        leadingPt: 11.2,
        trackingEm: 0.04,
        caps: CapsType.AllCaps,
        colour: PALETTE.neutralGold,
        align: ParagraphAlignXType.Centre,
        spaceAfterPt: 0,
      },
    ],
  });
  centerTextInkInRect(doc, diagHdr.node, MARGIN_IN + 0.10, diagY, CONTENT_W_IN - 0.20, 0.34, ox, oy, true);
  results.push(diagHdr);

  // Coordinates carefully spaced: Character Circles (C), Bond Box (B), Fact Diamond (F/d8), Event Inverted Triangle (V/d4)
  const cAx = MARGIN_IN + 0.86;
  const cAy = diagY + 1.06;
  const cBx = MARGIN_IN + CONTENT_W_IN - 0.86;
  const cBy = diagY + 1.06;
  const cCx = MARGIN_IN + CONTENT_W_IN / 2 - 0.16;
  const cCy = diagY + 3.16;
  const facX = MARGIN_IN + 0.80;
  const facY = diagY + 2.34;
  const bndX = MARGIN_IN + CONTENT_W_IN - 0.86;
  const bndY = diagY + 2.24;
  const evtX = MARGIN_IN + CONTENT_W_IN / 2 + 0.28;
  const evtY = diagY + 1.92;

  // Wires
  addLineSegment(doc, ox + cAx * IN, oy + cAy * IN, ox + cBx * IN, oy + cBy * IN, DIAL_SWATCHES[6].bg, 2.0, 'p8_w_ab');
  addLineSegment(doc, ox + cAx * IN, oy + cAy * IN, ox + cCx * IN, oy + cCy * IN, DIAL_SWATCHES[6].bg, 2.0, 'p8_w_ac');
  addLineSegment(doc, ox + cAx * IN, oy + cAy * IN, ox + facX * IN, oy + facY * IN, DIAL_SWATCHES[0].bg, 2.0, 'p8_w_fac');
  addLineSegment(doc, ox + cBx * IN, oy + cBy * IN, ox + bndX * IN, oy + bndY * IN, PALETTE.neutralGoldText, 2.0, 'p8_w_bb');
  addLineSegment(doc, ox + bndX * IN, oy + bndY * IN, ox + cCx * IN, oy + cCy * IN, PALETTE.neutralGoldText, 2.0, 'p8_w_bc');
  addLineSegment(doc, ox + evtX * IN, oy + evtY * IN, ox + cAx * IN, oy + cAy * IN, PALETTE.neutralAccent, 2.0, 'p8_w_ea');
  addLineSegment(doc, ox + evtX * IN, oy + evtY * IN, ox + bndX * IN, oy + bndY * IN, PALETTE.neutralAccent, 2.0, 'p8_w_eb');

  // Character Circles (C = Circle, 0.84 in diameter with stacked "Character / A" at 10 pt)
  const chars = [
    { x: cAx, y: cAy, line2: 'A' },
    { x: cBx, y: cBy, line2: 'B' },
    { x: cCx, y: cCy, line2: 'C' },
  ];
  const chDia = 0.84;
  for (let i = 0; i < chars.length; i++) {
    const p = chars[i];
    addCircleShape(doc, makeRectPx(p.x - chDia / 2, p.y - chDia / 2, chDia, chDia, ox, oy), PALETTE.white, PALETTE.neutralDark, 1.5, `p8_ch_${i}`);
    const chTxt = createTextFrameWithAutoFit(doc, styles, {
      id: `p8_ch_txt_${i}`,
      pageNum: 8,
      rect: makeRectPx(p.x - 0.39, p.y - 0.22, 0.78, 0.44, ox, oy),
      theme: 'neutral',
      allowAutoTighten: false,
      blocks: [
        { kind: 'body', text: 'Character', forceFontKey: 'displayHeavy', fontPt: 10.0, leadingPt: 11.0, colour: PALETTE.neutralDark, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 },
        { kind: 'body', text: p.line2, forceFontKey: 'displayHeavy', fontPt: 10.0, leadingPt: 11.0, colour: PALETTE.neutralDark, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 },
      ],
    });
    centerTextInkInRect(doc, chTxt.node, p.x - chDia / 2, p.y - chDia / 2, chDia, chDia, ox, oy, true);
    results.push(chTxt);
  }

  // Fact Diamond (F = Facet / d8), Bond Box (B = Box), & Event Inverted Triangle (V = eVent / d4)
  addDiamondShape(doc, makeRectPx(facX - 0.24, facY - 0.24, 0.48, 0.48, ox, oy), DIAL_SWATCHES[0].bg, PALETTE.neutralDark, 1.5, 'p8_fact_node');
  addRectShape(doc, makeRectPx(bndX - 0.32, bndY - 0.19, 0.64, 0.38, ox, oy), PALETTE.neutralGold, PALETTE.neutralDark, 1.5, 'p8_bond_node', 2, ShapeCornerType.Round);
  addInvertedTriangleShape(doc, makeRectPx(evtX - 0.27, evtY - 0.22, 0.54, 0.46, ox, oy), PALETTE.neutralAccent, PALETTE.neutralDark, 1.5, 'p8_event_node');

  // Labels placed in open cream space (zero wire overlap!)
  const lblFac = createTextFrameWithAutoFit(doc, styles, {
    id: 'p8_lbl_fact',
    pageNum: 8,
    rect: makeRectPx(facX - 0.42, facY + 0.28, 0.84, 0.22, ox, oy),
    theme: 'neutral',
    allowAutoTighten: false,
    blocks: [{ kind: 'body', text: 'FACT', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.0, colour: DIAL_SWATCHES[0].text, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 }],
  });
  const lblBnd = createTextFrameWithAutoFit(doc, styles, {
    id: 'p8_lbl_bond',
    pageNum: 8,
    rect: makeRectPx(bndX - 0.48, bndY + 0.24, 0.96, 0.22, ox, oy),
    theme: 'neutral',
    allowAutoTighten: false,
    blocks: [{ kind: 'body', text: 'BOND', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.0, colour: PALETTE.neutralGoldText, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 }],
  });
  const lblEvt = createTextFrameWithAutoFit(doc, styles, {
    id: 'p8_lbl_event',
    pageNum: 8,
    rect: makeRectPx(evtX - 0.46, evtY + 0.27, 0.92, 0.22, ox, oy),
    theme: 'neutral',
    allowAutoTighten: false,
    blocks: [{ kind: 'body', text: 'EVENT', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.0, colour: PALETTE.neutralAccent, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 }],
  });

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p8_lbl_rumor',
      pageNum: 8,
      rect: makeRectPx(MARGIN_IN + CONTENT_W_IN / 2 - 0.55, diagY + 0.72, 1.10, 0.22, ox, oy),
      theme: 'neutral',
      allowAutoTighten: false,
      blocks: [{ kind: 'body', text: 'RUMOR', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.0, colour: DIAL_SWATCHES[6].text, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 }],
    }),
    lblFac,
    lblBnd,
    lblEvt
  );

  // 4-Item Legend Strip inside Schematic (y: diagY + 3.82)
  const legY = diagY + 3.82;
  addLineSegment(doc, ox + (MARGIN_IN + 0.16) * IN, oy + legY * IN, ox + (MARGIN_IN + CONTENT_W_IN - 0.16) * IN, oy + legY * IN, PALETTE.neutralBorder, 0.7, 'p8_leg_rule');
  addCircleShape(doc, makeRectPx(MARGIN_IN + 0.18, legY + 0.18, 0.18, 0.18, ox, oy), PALETTE.white, PALETTE.neutralDark, 1.0, 'p8_leg_ch');
  addRectShape(doc, makeRectPx(MARGIN_IN + 1.52, legY + 0.20, 0.22, 0.14, ox, oy), PALETTE.neutralGold, PALETTE.neutralDark, 1.0, 'p8_leg_bnd', 1.5, ShapeCornerType.Round);
  addDiamondShape(doc, makeRectPx(MARGIN_IN + 2.74, legY + 0.18, 0.18, 0.18, ox, oy), DIAL_SWATCHES[0].bg, PALETTE.neutralDark, 1.0, 'p8_leg_fac');
  addInvertedTriangleShape(doc, makeRectPx(MARGIN_IN + 3.82, legY + 0.18, 0.18, 0.18, ox, oy), PALETTE.neutralAccent, PALETTE.neutralDark, 1.0, 'p8_leg_evt');

  const legItems = [
    { id: 'p8_leg_t1', x: MARGIN_IN + 0.42, w: 1.00, text: 'Character' },
    { id: 'p8_leg_t2', x: MARGIN_IN + 1.80, w: 0.84, text: 'Bond' },
    { id: 'p8_leg_t3', x: MARGIN_IN + 2.98, w: 0.74, text: 'Fact' },
    { id: 'p8_leg_t4', x: MARGIN_IN + 4.06, w: 0.84, text: 'Event' },
  ];
  for (const li of legItems) {
    const legNode = createTextFrameWithAutoFit(doc, styles, {
      id: li.id,
      pageNum: 8,
      rect: makeRectPx(li.x, legY + 0.16, li.w, 0.22, ox, oy),
      theme: 'neutral',
      allowAutoTighten: false,
      blocks: [{ kind: 'body', text: li.text, forceFontKey: 'displaySemi', fontPt: 10.0, leadingPt: 11.2, spaceAfterPt: 0 }],
    });
    centerTextInkInRect(doc, legNode.node, li.x, legY + 0.18, li.w, 0.18, ox, oy, false);
    results.push(legNode);
  }

  // Bottom Reading Guide (y: 6.08 .. 7.50)
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p8_guide',
      pageNum: 8,
      rect: makeRectPx(MARGIN_IN, 6.08, CONTENT_W_IN, 1.44, ox, oy),
      theme: 'neutral',
      blocks: [
        { kind: 'body', text: '**Circle (Character):** Name + 3 Dial prompts + Setting Edge tag.', fontPt: 10.0, leadingPt: 12.6, spaceAfterPt: 4.0 },
        { kind: 'body', text: '**Box (Bond) & Diamond (Fact):** Shared ties or assets and world truths wired directly into the web.', fontPt: 10.0, leadingPt: 12.6, spaceAfterPt: 4.0 },
        { kind: 'body', text: '**Inverted Triangle (Event):** Where the Undertow strikes first.', fontPt: 10.0, leadingPt: 12.6, spaceAfterPt: 0 },
      ],
    })
  );

  return results;
}

function buildPage9(doc, styles, ox, oy) {
  const results = [];

  // CENTERFOLD RIGHT (First Cortex Page): Seamless Pathways Handoff + Baseline Pool Equation!
  results.push(...addChamferedBanner(doc, styles, 9, ox, oy, 'cortex', '09 · PATHWAYS TO CORTEX', 'HANDOFF'));

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p9_lede',
      pageNum: 9,
      rect: makeRectPx(MARGIN_IN, 0.74, CONTENT_W_IN, 0.42, ox, oy),
      theme: 'cortex',
      blocks: [
        {
          kind: 'body',
          text: 'A **Cortex Prime** baseplate to snap your `4d8` pitch and Spaghetti Map to.',
          fontPt: 10.6,
          leadingPt: 13.2,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Pathways -> Cortex Bridge (y: 1.24 .. 4.38)
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 1.24 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 1.24 * IN, PALETTE.cortexMagentaFill, 1.8, 'p9_bridge_top');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p9_bridge_txt',
      pageNum: 9,
      rect: makeRectPx(MARGIN_IN, 1.36, CONTENT_W_IN, 3.04, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'h2', text: 'Snap Your Map to Your Sheet', fontPt: 11.2, leadingPt: 12.8, colour: PALETTE.cortexDark, spaceAfterPt: 8.0 },
        { kind: 'body', text: '• **Pass 1 (Character Circle):** Your 3 Dial prompt answers become your three `d8` Distinctions (**Prime Set 1**).', fontPt: 10.2, leadingPt: 12.8, leadColour: PALETTE.cortexMagentaDark, leftIndentPt: 10, firstIndentPt: -10, spaceAfterPt: 8.0 },
        { kind: 'body', text: '• **Pass 2 (Rumor & Bond):** Shared Bond Boxes become `d8` Supports. Rumors seed Relationship or Value Statements.', fontPt: 10.2, leadingPt: 12.8, leadColour: PALETTE.cortexCyanDark, leftIndentPt: 10, firstIndentPt: -10, spaceAfterPt: 8.0 },
        { kind: 'body', text: '• **Pass 3 (Edge & Fact):** Your Edge sets your top `d10` in **Prime Set 2** (Page 13). Your Fact Diamond sets your top `d10` or Goal in **Prime Set 3** (Page 14).', fontPt: 10.2, leadingPt: 12.8, leadColour: PALETTE.cortexMagentaDark, leftIndentPt: 10, firstIndentPt: -10, spaceAfterPt: 8.0 },
        { kind: 'body', text: '• **Pass 4 (Event):** The inverted Event Triangle is your opening scene\'s opposition or Romp Pool.', fontPt: 10.2, leadingPt: 12.8, leadColour: PALETTE.cortexCyanDark, leftIndentPt: 10, firstIndentPt: -10, spaceAfterPt: 0 },
      ],
    })
  );

  // Baseline Pool Equation (2 architectural rows, y: 4.54 .. 7.52)
  const eqY = 4.54;
  addRectShape(doc, makeRectPx(MARGIN_IN, eqY, CONTENT_W_IN, 2.98, ox, oy), PALETTE.cortexDark, null, 0, 'p9_eq_bg', 0);
  addRectShape(doc, makeRectPx(MARGIN_IN, eqY, CONTENT_W_IN, 0.04, ox, oy), PALETTE.cortexCyan, null, 0, 'p9_eq_top', 0);

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p9_eq_hdr1',
      pageNum: 9,
      rect: makeRectPx(MARGIN_IN + 0.14, eqY + 0.14, CONTENT_W_IN - 0.28, 0.22, ox, oy),
      theme: 'cortex',
      allowAutoTighten: false,
      blocks: [{ kind: 'body', text: 'BUILD YOUR POOL', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.4, trackingEm: 0.04, caps: CapsType.AllCaps, colour: PALETTE.cortexCyan, spaceAfterPt: 0 }],
    })
  );

  const boxW = 1.44;
  const plusW = 0.2334;
  const row1Y = eqY + 0.42;
  const boxH = 0.72;
  const terms = [
    { x: MARGIN_IN + 0.14, top: '1 · DISTINCTION', bot: 'd8 / d4', border: PALETTE.cortexMagenta, botCol: PALETTE.cortexMagentaLight },
    { x: MARGIN_IN + 0.14 + boxW + plusW, top: '2 · SETTING', bot: 'Prime 2', border: PALETTE.cortexCyan, botCol: PALETTE.cortexCyan },
    { x: MARGIN_IN + 0.14 + 2 * (boxW + plusW), top: '3 · TONE', bot: 'Prime 3', border: PALETTE.cortexCyan, botCol: PALETTE.cortexCyan },
  ];
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    addRectShape(doc, makeRectPx(t.x, row1Y, boxW, boxH, ox, oy), PALETTE.cortexPanel, t.border, 1.0, `p9_t_${i}`, 0);
    const tRes = createTextFrameWithAutoFit(doc, styles, {
      id: `p9_t_txt_${i}`,
      pageNum: 9,
      rect: makeRectPx(t.x + 0.04, row1Y + 0.08, boxW - 0.08, boxH - 0.14, ox, oy),
      theme: 'cortex',
      allowAutoTighten: false,
      blocks: [
        { kind: 'body', text: t.top, forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.2, colour: PALETTE.white, align: ParagraphAlignXType.Centre, spaceAfterPt: 2.5 },
        { kind: 'body', text: t.bot, forceFontKey: 'monoBold', fontPt: 10.5, leadingPt: 11.8, colour: t.botCol, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 },
      ],
    });
    centerTextInkInRect(doc, tRes.node, t.x, row1Y, boxW, boxH, ox, oy, true);
    results.push(tRes);
    if (i < 2) {
      const px = t.x + boxW;
      const op = createTextFrameWithAutoFit(doc, styles, {
        id: `p9_plus_${i}`,
        pageNum: 9,
        rect: makeRectPx(px, row1Y + 0.22, plusW, 0.26, ox, oy),
        theme: 'cortex',
        allowAutoTighten: false,
        blocks: [{ kind: 'body', text: '+', forceFontKey: 'displayHeavy', fontPt: 13.0, leadingPt: 14.0, colour: PALETTE.white, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 }],
      });
      centerTextInkInRect(doc, op.node, px, row1Y, plusW, boxH, ox, oy, true);
      results.push(op);
    }
  }

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p9_eq_adds',
      pageNum: 9,
      rect: makeRectPx(MARGIN_IN + 0.14, eqY + 1.24, CONTENT_W_IN - 0.28, 0.24, ox, oy),
      theme: 'cortex',
      allowAutoTighten: false,
      blocks: [{ kind: 'body', text: '+ Assets, Resources, and Foe Fallout', fontPt: 10.0, leadingPt: 11.6, colour: PALETTE.neutralSubtleText, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 }],
    })
  );

  addLineSegment(doc, ox + (MARGIN_IN + 0.14) * IN, oy + (eqY + 1.56) * IN, ox + (MARGIN_IN + CONTENT_W_IN - 0.14) * IN, oy + (eqY + 1.56) * IN, PALETTE.neutralDarkBorder, 0.7, 'p9_eq_div');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p9_eq_hdr2',
      pageNum: 9,
      rect: makeRectPx(MARGIN_IN + 0.14, eqY + 1.66, CONTENT_W_IN - 0.28, 0.22, ox, oy),
      theme: 'cortex',
      allowAutoTighten: false,
      blocks: [{ kind: 'body', text: 'READ THE ROLL', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.4, trackingEm: 0.04, caps: CapsType.AllCaps, colour: PALETTE.neutralGold, spaceAfterPt: 0 }],
    })
  );

  const row2Y = eqY + 1.98;
  const resBoxes = [
    { x: MARGIN_IN + 0.14, top: '1s', bot: 'OPENINGS', bg: PALETTE.cortexMagentaFill, fg: PALETTE.white },
    { x: MARGIN_IN + 0.14 + boxW + plusW, top: 'SUM 2', bot: 'TOTAL', bg: PALETTE.cortexCyan, fg: PALETTE.cortexDark },
    { x: MARGIN_IN + 0.14 + 2 * (boxW + plusW), top: '1 DIE', bot: 'IMPACT d6–d12', bg: PALETTE.cortexCyan, fg: PALETTE.cortexDark },
  ];
  for (let i = 0; i < resBoxes.length; i++) {
    const rb = resBoxes[i];
    addRectShape(doc, makeRectPx(rb.x, row2Y, boxW, boxH, ox, oy), rb.bg, null, 0, `p9_rb_${i}`, 0);
    const rbRes = createTextFrameWithAutoFit(doc, styles, {
      id: `p9_rb_txt_${i}`,
      pageNum: 9,
      rect: makeRectPx(rb.x + 0.04, row2Y + 0.08, boxW - 0.08, boxH - 0.14, ox, oy),
      theme: 'cortex',
      allowAutoTighten: false,
      blocks: [
        { kind: 'body', text: rb.top, forceFontKey: 'displayHeavy', fontPt: 11.0, leadingPt: 12.2, colour: rb.fg, align: ParagraphAlignXType.Centre, spaceAfterPt: 2.0 },
        { kind: 'body', text: rb.bot, forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.2, colour: rb.fg, align: ParagraphAlignXType.Centre, spaceAfterPt: 0 },
      ],
    });
    centerTextInkInRect(doc, rbRes.node, rb.x, row2Y, boxW, boxH, ox, oy, true);
    results.push(rbRes);
  }

  return results;
}

function buildPage10(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 10, ox, oy, 'cortex', '10 · OPENINGS & SPEEDS', 'ENGINE'));

  // Openings Section (y: 0.76 .. 2.74)
  addRectShape(doc, makeRectPx(MARGIN_IN, 0.76, CONTENT_W_IN, 1.98, ox, oy), PALETTE.cortexPinkTint, null, 0, 'p10_open_bg', 0);
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 0.76 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 0.76 * IN, PALETTE.cortexMagentaFill, 2.0, 'p10_open_top');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p10_open_txt',
      pageNum: 10,
      rect: makeRectPx(MARGIN_IN + 0.14, 0.88, CONTENT_W_IN - 0.28, 1.78, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'h2', text: 'Openings', fontPt: 11.5, leadingPt: 13.0, colour: PALETTE.cortexMagentaDark, spaceAfterPt: 5.0 },
        {
          kind: 'body',
          text: 'Set rolled `1`s aside. They never count toward Total or Impact. Foes seize your Openings, handing you `1 PP`, to inflict `d6` Fallout, step up Fallout, or claim an edge. Spend `1 PP` to seize GM Openings. Extra `1`s step up the die by +1 each.',
          fontPt: 10.2,
          leadingPt: 13.0,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Three Conflict Speeds (y: 2.94 .. 7.56)
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p10_speeds_h2',
      pageNum: 10,
      rect: makeRectPx(MARGIN_IN, 2.94, CONTENT_W_IN, 0.26, ox, oy),
      theme: 'cortex',
      allowAutoTighten: false,
      blocks: [{ kind: 'h2', text: 'Three Conflict Speeds', fontPt: 11.5, leadingPt: 13.0, spaceAfterPt: 0 }],
    })
  );

  const speeds = [
    {
      num: '01',
      name: 'ROLL · SINGLE TEST',
      accent: PALETTE.cortexCyanDark,
      ruleCol: PALETTE.cortexCyan,
      body: 'One toss vs. GM difficulty: `2dX` + scene traits, or the Doom Pool. High Total wins. Instigator wins ties.',
    },
    {
      num: '02',
      name: 'ROW · ESCALATING CONTEST',
      accent: PALETTE.cortexMagentaDark,
      ruleCol: PALETTE.cortexMagenta,
      body: 'Beat the lead Total to take control, or **Concede** on your terms for `+1 PP` when you could roll again. Failing inflicts the winner\'s Impact as Fallout.',
    },
    {
      num: '03',
      name: 'ROMP · MULTI-DIE CHALLENGE',
      accent: PALETTE.cortexCyanDark,
      ruleCol: PALETTE.cortexCyan,
      body: 'Roll vs. a central `YdX` Romp Pool. Win with Impact `>` a Romp die to drop it, or `≤` to step down the smallest. `d4` drops out. Romps act last.',
    },
  ];

  let sy = 3.30;
  const rowH = 1.38;
  for (let i = 0; i < speeds.length; i++) {
    const sp = speeds[i];
    addLineSegment(doc, ox + MARGIN_IN * IN, oy + sy * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + sy * IN, sp.ruleCol, 1.5, `p10_sp_rule_${i}`);
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p10_sp_hdr_${i}`,
        pageNum: 10,
        rect: makeRectPx(MARGIN_IN, sy + 0.10, CONTENT_W_IN, 0.24, ox, oy),
        theme: 'cortex',
        allowAutoTighten: false,
        blocks: [{ kind: 'body', text: `**${sp.num}**   ${sp.name}`, forceFontKey: 'displayHeavy', fontPt: 10.8, leadingPt: 12.2, colour: PALETTE.cortexDark, leadColour: sp.accent, spaceAfterPt: 0 }],
      }),
      createTextFrameWithAutoFit(doc, styles, {
        id: `p10_sp_body_${i}`,
        pageNum: 10,
        rect: makeRectPx(MARGIN_IN, sy + 0.38, CONTENT_W_IN, rowH - 0.42, ox, oy),
        theme: 'cortex',
        blocks: [{ kind: 'body', text: sp.body, fontPt: 10.2, leadingPt: 12.8, spaceAfterPt: 0 }],
      })
    );
    sy += rowH + 0.06;
  }

  return results;
}

function buildPage11(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 11, ox, oy, 'cortex', '11 · HOUSE CUTS & DISTINCTIONS', 'CUTS'));

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p11_cuts_h2',
      pageNum: 11,
      rect: makeRectPx(MARGIN_IN, 0.76, CONTENT_W_IN, 0.26, ox, oy),
      theme: 'cortex',
      allowAutoTighten: false,
      blocks: [{ kind: 'h2', text: 'Four House Cuts', fontPt: 11.5, leadingPt: 13.0, spaceAfterPt: 0 }],
    }),
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p11_cuts_body',
      pageNum: 11,
      rect: makeRectPx(MARGIN_IN, 1.08, CONTENT_W_IN, 3.30, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'body', text: '• **Full-Force Hits:** Never step down your Impact against a loser\'s bigger die. Win the Total, land full Impact.', fontPt: 10.2, leadingPt: 13.0, leadColour: PALETTE.cortexCyanDark, leftIndentPt: 10, firstIndentPt: -10, spaceAfterPt: 8.0 },
        { kind: 'body', text: '• **Real Fallout Only:** Starts at `d6` minimum. No `d4` PP-farming. Steps down by one in quiet recovery scenes. Stepping past `d12` drops you out of the scene.', fontPt: 10.2, leadingPt: 13.0, leadColour: PALETTE.cortexMagentaDark, leftIndentPt: 10, firstIndentPt: -10, spaceAfterPt: 8.0 },
        { kind: 'body', text: '• **In-Pool Resources:** Roll a Resource die inside your pool to keep `+1` Total die, then expend until recovery.', fontPt: 10.2, leadingPt: 13.0, leadColour: PALETTE.cortexCyanDark, leftIndentPt: 10, firstIndentPt: -10, spaceAfterPt: 8.0 },
        { kind: 'body', text: '• **Supports:** Shared use Allies, Vehicles, Locations, etc. Starting with 1–3 traits; mix and swap their traits with yours in pools; let them absorb fitting Fallout.', fontPt: 10.2, leadingPt: 13.0, leadColour: PALETTE.cortexMagentaDark, leftIndentPt: 10, firstIndentPt: -10, spaceAfterPt: 0 },
      ],
    })
  );

  // Prime Set 1: Distinctions + Hinder (y: 4.52 .. 6.42)
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 4.52 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 4.52 * IN, PALETTE.cortexMagentaFill, 1.8, 'p11_dist_rule');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p11_dist_txt',
      pageNum: 11,
      rect: makeRectPx(MARGIN_IN, 4.64, CONTENT_W_IN, 0.80, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'h2', text: 'Prime Set 1: Distinctions', fontPt: 11.5, leadingPt: 13.0, spaceAfterPt: 4.0 },
        { kind: 'body', text: 'Write three `d8` Distinctions titled after your world\'s Page 6 Identity Prompts.', fontPt: 10.4, leadingPt: 13.0, spaceAfterPt: 0 },
      ],
    })
  );
  addRectShape(doc, makeRectPx(MARGIN_IN, 5.52, CONTENT_W_IN, 0.86, ox, oy), PALETTE.cortexDark, null, 0, 'p11_hinder_bg', 0);
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p11_hinder_txt',
      pageNum: 11,
      rect: makeRectPx(MARGIN_IN + 0.16, 5.64, CONTENT_W_IN - 0.32, 0.64, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'body', text: '**HINDER**', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.4, colour: PALETTE.cortexMagentaLight, spaceAfterPt: 3.0 },
        { kind: 'body', text: 'Roll any Distinction as `d4` instead of `d8` to gain `1 PP`.', fontPt: 10.4, leadingPt: 12.8, colour: PALETTE.white, pillInk: PALETTE.cortexCyan, spaceAfterPt: 0 },
      ],
    })
  );

  // Undertow in Cortex Editorial Band (y: 6.60 .. 7.52)
  addRectShape(doc, makeRectPx(MARGIN_IN, 6.60, CONTENT_W_IN, 0.90, ox, oy), PALETTE.cortexIce, null, 0, 'p11_ut_bg', 0);
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 6.60 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 6.60 * IN, PALETTE.cortexCyanDark, 1.5, 'p11_ut_top');
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 7.50 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 7.50 * IN, PALETTE.cortexRule, 0.7, 'p11_ut_bot');
  const utTxt = createTextFrameWithAutoFit(doc, styles, {
    id: 'p11_ut_txt',
    pageNum: 11,
    rect: makeRectPx(MARGIN_IN + 0.12, 6.72, CONTENT_W_IN - 0.24, 0.68, ox, oy),
    theme: 'cortex',
    blocks: [
      { kind: 'body', text: '**Undertow in Cortex:** Players gain 1 related `d8` Support or Special. GMs run its Engine Mod in contrast scenes.', fontPt: 10.2, leadingPt: 13.0, spaceAfterPt: 0 },
    ],
  });
  centerTextInkInRect(doc, utTxt.node, MARGIN_IN + 0.12, 6.60, CONTENT_W_IN - 0.24, 0.90, ox, oy, false);
  results.push(utTxt);

  return results;
}

function buildPage12(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 12, ox, oy, 'cortex', '12 · PALETTE → ENGINE MOD', 'MODS'));

  const engineMods = [
    '**1. Prismatic · Bleed** — When the uncanny bleeds into a scene, `1`s & `2`s both count as Openings. Spend `1 PP` to rename any Asset or Fallout in play.',
    '**2. Sepia · Living Serial** — Log Session Titles as Session Records. Once per session, invoke one for a free `1 PP` effect or Flashback. Cross it off between sessions to step up a trait or add a `d8` Signature Asset.',
    '**3. Neon · Burnout** — Created Assets last 1 roll. Spend `1 PP` to sustain for the scene. **Lean In:** roll your own Fallout, then step it up.',
    '**4. Pastel · Gentle Stakes** — PC Fallout lands at `d6`, or steps up existing Fallout by one. It steps down automatically in quiet scenes.',
    '**5. Bright · Open Table** — **No GM Bank:** GM `PP` spends go straight to targeted PCs. Allies share created Assets for free.',
    '**6. Dark · Doom Pool** — An escalating `d8, d6, d4` GM pool replaces difficulty dice pairs. It grows on player Openings and spends dice for twists or Romps.',
    '**7. Chrome · Spec Sheet** — Gain two `d8` Signature Assets with *Gear Limit*: shut one down for the scene to gain `1 PP`.',
    '**8. Rust · Scarcity** — Gain `2d6` Salvage Resources. **Stricken:** Any `d10+` Fallout restricts you to keeping 1 Total die.',
  ];

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p12_engine_mods',
      pageNum: 12,
      rect: makeRectPx(MARGIN_IN, 0.78, CONTENT_W_IN, 6.82, ox, oy),
      theme: 'cortex',
      blocks: engineMods.map((text, i) => ({
        kind: 'body',
        text,
        fontPt: 10.2,
        leadingPt: 12.8,
        leadColour: DIAL_SWATCHES[i].text,
        leftIndentPt: 10,
        firstIndentPt: -10,
        spaceAfterPt: i === 7 ? 0 : 9.0,
      })),
    })
  );

  return results;
}

function buildPage13(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 13, ox, oy, 'cortex', '13 · SETTING → PRIME SET 2', 'PRIME 2'));

  const primeSet2 = [
    '**1. Liminal** — Attributes `d10, d8, d6`: *Pulse, Pattern, Poise* + one `d8` Ability with 1 Special & Limit: shut down for the scene for `+1 PP`.',
    '**2. Industrial** — Skills `d10, 2×d8, 3×d6`, rest `d4`: *Brawl, Craft, Delve, Doctor, Prowl, Rig, Survey, Sway*.',
    '**3. Future** — Roles `d10, 2×d8, d6, d4`: *Hacker, Fixer, Operator, Tech, Face*.',
    '**4. Hearth** — Skills `d10, 2×d8, 3×d6`, rest `d4`: *Cook, Grow, Mend, Notice, Parley, Tinker, Travel, Ward* + two `d6` Specialties.',
    '**5. Mythic** — Attributes `d10, d8, d6`: *Might, Grace, Lore* + Power Set of two `d8` mythic Powers & a Limit.',
    '**6. Modern** — Roles `d10, d8, d6`: *Mouth, Mind, Muscle* + one unrated narrative Talent.',
    '**7. Space** — Affiliations: Arenas `d10, d8, d6`: *Void, Station, Surface* + shared `d8` Vehicle rated in *Engines, Frame, Systems*.',
    '**8. Primal** — Affiliations: Arenas `d10, d8, d6`: *Camp, Wilds, Lair* + `d8` Beast Support or Signature Asset.',
  ];

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p13_prime_set_2',
      pageNum: 13,
      rect: makeRectPx(MARGIN_IN, 0.78, CONTENT_W_IN, 6.82, ox, oy),
      theme: 'cortex',
      blocks: primeSet2.map((text, i) => ({
        kind: 'body',
        text,
        fontPt: 10.3,
        leadingPt: 13.0,
        leadColour: DIAL_SWATCHES[i].text,
        leftIndentPt: 10,
        firstIndentPt: -10,
        spaceAfterPt: i === 7 ? 0 : 10.5,
      })),
    })
  );

  return results;
}

function buildPage14(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 14, ox, oy, 'cortex', '14 · TONE → PRIME SET 3', 'PRIME 3'));

  const primeSet3 = [
    '**1. Weird** — Values `d10, d8, 2×d6`: *Order, Truth, Wonder, Self* with Statements. **Question** a belief to triple its die for one roll, then step down & rewrite.',
    '**2. Pulp** — Affiliations `d10, d8, d6`: *Solo, Duo, Team* + **Hero Dice:** win by 5+ to bank a foe\'s top-rolling die. Spend `1 PP` later to roll & add to Total.',
    '**3. Punk** — Relationships: Factions `d10, d8, d6` across 3 dominant Blocs with Statements. **Question** your stance to triple its die & burn standing.',
    '**4. Cozy** — Relationships `d10, 2×d8`, rest `d6` toward PCs & neighbors + **Team Up:** lend your Relationship die into an ally\'s pool risk-free.',
    '**5. Heroic** — Values `d10, d8, 2×d6`: *Courage, Justice, Mercy, Truth* + **Moral Support:** step down your Value for the session to step up an ally\'s.',
    '**6. Noir** — Relationships `d10, 2×d8`, rest `d6` toward PCs, informants & suspects with Statements + **GMC Vices:** GMCs oppose using *Greed, Control, Wrath*.',
    '**7. Adventure** — Values `d10, d8, 2×d6, d4`: *Discovery, Duty, Fortune, Glory, Loyalty* + three Goals at `d6, d8, d10`: roll & cross off in opposition, or check off when achieved to step up a trait.',
    '**8. Peril** — Reserves `d10, d8, 2×d6`: *Stamina, Resolve, Supply, Luck* + **Usage Dice:** rolling `1–2` on a Reserve steps it down after the roll. `d4` drops out. Rest resets them.',
  ];

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p14_prime_set_3',
      pageNum: 14,
      rect: makeRectPx(MARGIN_IN, 0.78, CONTENT_W_IN, 6.82, ox, oy),
      theme: 'cortex',
      blocks: primeSet3.map((text, i) => ({
        kind: 'body',
        text,
        fontPt: 10.1,
        leadingPt: 12.6,
        leadColour: DIAL_SWATCHES[i].text,
        leftIndentPt: 10,
        firstIndentPt: -10,
        spaceAfterPt: i === 7 ? 0 : 8.5,
      })),
    })
  );

  return results;
}

function buildPage15(doc, styles, ox, oy) {
  const results = [];

  results.push(...addChamferedBanner(doc, styles, 15, ox, oy, 'cortex', '15 · SAMPLE PITCHES', 'SAMPLES'));

  const samples = [
    {
      y: 0.78,
      id: 'p15_s1',
      pIdx: 8, sIdx: 7, tIdx: 3, uIdx: 2, uDial: 'p',
      pWord: 'RUST', sWord: 'SPACE', tWord: 'PUNK', uWord: 'Sepia',
      roll: '`8·7·3 +2` Sepia Undertow (Divide)',
      sheet: '**Sheet:** Distinctions *Scar · World · Grievance* + Arenas & `d8` Vehicle + Factions.',
      engine: '**Engine:** `2d6` Salvage Resources, Stricken, pre-war Flashbacks.',
    },
    {
      y: 4.26,
      id: 'p15_s2',
      pIdx: 5, sIdx: 8, tIdx: 7, uIdx: 4, uDial: 't',
      pWord: 'BRIGHT', sWord: 'PRIMAL', tWord: 'ADVENTURE', uWord: 'Cozy',
      roll: '`5·8·7 +4` Cozy Undertow (Counter)',
      sheet: '**Sheet:** Distinctions *Banner · Kin · Horizon* + Arenas & `d8` Beast Support + Values & 3 Goals.',
      engine: '**Engine:** Open Table `PP` & shared Assets, campfire recovery scenes.',
    },
  ];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (i > 0) {
      addLineSegment(doc, ox + MARGIN_IN * IN, oy + (s.y - 0.14) * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + (s.y - 0.14) * IN, PALETTE.cortexRule, 0.8, `${s.id}_sep`);
    }
    results.push(
      ...addPitchPosterCard(doc, styles, {
        id: `${s.id}_poster`,
        pageNum: 15,
        xIn: MARGIN_IN,
        yIn: s.y,
        wIn: CONTENT_W_IN,
        hIn: 1.44,
        ox,
        oy,
        pIdx: s.pIdx,
        sIdx: s.sIdx,
        tIdx: s.tIdx,
        uIdx: s.uIdx,
        uDial: s.uDial,
        pWord: s.pWord,
        sWord: s.sWord,
        tWord: s.tWord,
        uWord: s.uWord,
        fullBento: false,
      }),
      createTextFrameWithAutoFit(doc, styles, {
        id: `${s.id}_txt`,
        pageNum: 15,
        rect: makeRectPx(MARGIN_IN, s.y + 1.54, CONTENT_W_IN, 1.72, ox, oy),
        theme: 'cortex',
        blocks: [
          { kind: 'body', text: s.roll, fontPt: 10.2, leadingPt: 12.2, colour: PALETTE.cortexDark, spaceAfterPt: 4.0 },
          { kind: 'body', text: s.sheet, fontPt: 10.0, leadingPt: 12.2, spaceAfterPt: 4.0 },
          { kind: 'body', text: s.engine, fontPt: 10.0, leadingPt: 12.2, spaceAfterPt: 0 },
        ],
      })
    );
  }

  return results;
}

function buildPage16(doc, styles, ox, oy) {
  const results = [];
  const col1X = MARGIN_IN;
  const col2X = MARGIN_IN + COL_W_IN + GUTTER_IN;

  // Full-bleed dark back cover canvas
  addRectShape(
    doc,
    new Rectangle(ox, oy - BLEED_IN * IN, (PAGE_W_IN + BLEED_IN) * IN, (PAGE_H_IN + 2 * BLEED_IN) * IN),
    PALETTE.cortexDark,
    null,
    0,
    'p16_bg',
    0
  );
  const splitW = (PAGE_W_IN + BLEED_IN) * 0.65;
  addRectShape(doc, new Rectangle(ox, oy - BLEED_IN * IN, splitW * IN, 0.20 * IN), PALETTE.cortexCyan, null, 0, 'p16_top_c', 0);
  addRectShape(doc, new Rectangle(ox + splitW * IN, oy - BLEED_IN * IN, (PAGE_W_IN + BLEED_IN - splitW) * IN, 0.20 * IN), PALETTE.cortexMagenta, null, 0, 'p16_top_m', 0);
  addRectShape(doc, new Rectangle(ox, oy + (PAGE_H_IN - 0.12) * IN, (PAGE_W_IN + BLEED_IN) * IN, (0.12 + BLEED_IN) * IN), PALETTE.neutralGold, null, 0, 'p16_bot_bar', 0);

  // Header (y: 0.30 .. 0.86, all >= 10 pt)
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p16_hdr',
      pageNum: 16,
      rect: makeRectPx(MARGIN_IN, 0.30, CONTENT_W_IN, 0.56, ox, oy),
      theme: 'cortex',
      allowAutoTighten: false,
      blocks: [
        { kind: 'body', text: 'TABLE CHEAT-SHEET', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.2, trackingEm: 0.05, caps: CapsType.AllCaps, colour: PALETTE.cortexCyan, spaceAfterPt: 2.0 },
        { kind: 'body', text: 'HOUSE RULED CORTEX', forceFontKey: 'displayHeavy', fontPt: 16.0, leadingPt: 17.5, caps: CapsType.AllCaps, colour: PALETTE.white, spaceAfterPt: 0 },
      ],
    })
  );

  // Pool Equation (y: 0.90 .. 1.66)
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 0.90 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 0.90 * IN, PALETTE.cortexCyan, 1.4, 'p16_pool_top');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p16_pool_txt',
      pageNum: 16,
      rect: makeRectPx(MARGIN_IN, 0.98, CONTENT_W_IN, 0.74, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'body', text: '**POOL:** `d8/d4` Distinction + `Prime 2` + `Prime 3` + *Assets, Resources, Foe Fallout*', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, boldColour: PALETTE.cortexCyan, pillInk: PALETTE.cortexMagentaLight, spaceAfterPt: 3.0 },
        { kind: 'body', text: '**ROLL:** `1s` Openings · `Sum 2` Total · `1 Die` Impact `d6–d12`', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, boldColour: PALETTE.neutralGold, pillInk: PALETTE.cortexCyan, spaceAfterPt: 0 },
      ],
    })
  );

  // Row 1: Openings & Hinder + Cuts (y: 1.78 .. 3.44)
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 1.78 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 1.78 * IN, PALETTE.neutralDarkBorder, 0.8, 'p16_r1_rule');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p16_open_txt',
      pageNum: 16,
      rect: makeRectPx(col1X, 1.86, COL_W_IN, 1.56, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'body', text: '**OPENINGS**', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.4, colour: PALETTE.cortexMagentaLight, spaceAfterPt: 3.0 },
        { kind: 'body', text: 'Set `1`s aside. Foes seize yours → `1 PP`. Spend `1 PP` to seize GM `1`s. Extra `1`s step up die +1.', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, pillInk: PALETTE.cortexCyan, spaceAfterPt: 0 },
      ],
    }),
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p16_hinder_txt',
      pageNum: 16,
      rect: makeRectPx(col2X, 1.86, COL_W_IN, 1.56, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'body', text: '**HINDER & CUTS**', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.4, colour: PALETTE.neutralGold, spaceAfterPt: 3.0 },
        { kind: 'body', text: '• Distinction as `d4` → `+1 PP`.', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, pillInk: PALETTE.neutralGold, spaceAfterPt: 2.0 },
        { kind: 'body', text: '• Fallout `d6`+; past `d12` out.', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, pillInk: PALETTE.cortexCyan, spaceAfterPt: 2.0 },
        { kind: 'body', text: '• Resource → keep `+1` die.', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, pillInk: PALETTE.cortexCyan, spaceAfterPt: 0 },
      ],
    })
  );

  // Row 2: Three Conflict Speeds (y: 3.48 .. 5.84)
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 3.48 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 3.48 * IN, PALETTE.neutralDarkBorder, 0.8, 'p16_r2_rule');
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p16_speeds_txt',
      pageNum: 16,
      rect: makeRectPx(MARGIN_IN, 3.58, CONTENT_W_IN, 2.26, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'body', text: '**THREE CONFLICT SPEEDS**', forceFontKey: 'displayBold', fontPt: 10.0, leadingPt: 11.4, colour: PALETTE.cortexCyan, spaceAfterPt: 5.0 },
        { kind: 'body', text: '**01 · ROLL** — Single toss vs. `2dX` + traits or Doom Pool. Instigator wins ties.', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, leadColour: PALETTE.cortexCyan, pillInk: PALETTE.cortexCyan, spaceAfterPt: 5.0 },
        { kind: 'body', text: '**02 · ROW** — Beat lead Total or **Concede** for `+1 PP`. Loser takes Impact as Fallout.', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, leadColour: PALETTE.cortexMagentaLight, pillInk: PALETTE.cortexMagentaLight, spaceAfterPt: 5.0 },
        { kind: 'body', text: '**03 · ROMP** — vs. `YdX` Romp Pool. Impact `>` die drops it; `≤` steps down smallest. `d4` drops out. Romps act last.', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, leadColour: PALETTE.cortexCyan, pillInk: PALETTE.cortexCyan, spaceAfterPt: 0 },
      ],
    })
  );

  // Bottom Interactive QR + Colophon / Cortex Attribution Strip (y: 5.94 .. 7.98, all >= 10 pt)
  addLineSegment(doc, ox + MARGIN_IN * IN, oy + 5.94 * IN, ox + (MARGIN_IN + CONTENT_W_IN) * IN, oy + 5.94 * IN, PALETTE.neutralDarkBorder, 0.8, 'p16_qr_rule');

  const qrSize = 1.24;
  addQrCode(doc, MARGIN_IN, 6.12, qrSize, ox, oy, 'p16_qr');

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p16_colophon',
      pageNum: 16,
      rect: makeRectPx(MARGIN_IN + qrSize + 0.18, 6.08, CONTENT_W_IN - qrSize - 0.18, 1.88, ox, oy),
      theme: 'cortex',
      blocks: [
        { kind: 'body', text: 'palette.lynnjones.rocks', forceFontKey: 'monoBold', fontPt: 11.0, leadingPt: 12.8, colour: PALETTE.neutralGold, spaceAfterPt: 3.0 },
        { kind: 'body', text: '**4d8 Worlds** · Lynn Jones', fontPt: 10.0, leadingPt: 12.0, colour: PALETTE.white, spaceAfterPt: 4.0 },
        { kind: 'body', text: 'Compatible with Cortex Prime; not affiliated with Dire Wolf Digital, Inc. Cortex Prime is a registered trademark of Dire Wolf Digital, Inc.', fontPt: 10.0, leadingPt: 11.8, colour: PALETTE.neutralSubtleText, spaceAfterPt: 0 },
      ],
    })
  );

  return results;
}

// ---------------------------------------------------------------------------
// 7. Full Overset Verification & Export
// ---------------------------------------------------------------------------

function verifyAllTextFrames(doc) {
  const report = [];
  let overflowCount = 0;

  function scanSpread(label, spread) {
    setSpreadIfNeeded(doc, spread);
    for (const n of getNodeChildrenRecursive(spread.handle, NodeChildType.Main, false)) {
      if (n.isTextNode) {
        const info = n.textFrameInterface.textFlow.getOverflowInfo();
        const isWarn = info.state.value === TextFlowOverflowState.Warn.value;
        if (isWarn) overflowCount++;
        let inkBottomIn = null;
        try {
          const box = n.getExactSpreadVisibleBox(false, false);
          inkBottomIn = Number(((box.y + box.height) / IN).toFixed(3));
        } catch {
          // ignore if empty
        }
        report.push({
          spread: label,
          name: n.userDescription || '(unnamed)',
          state: info.state.value,
          isWarn,
          inkBottomIn,
        });
      }
    }
  }

  const masters = doc.masterSpreads.toArray();
  for (let i = 0; i < masters.length; i++) scanSpread(`master_${i}`, masters[i]);
  const spreads = doc.spreads.toArray();
  for (let i = 0; i < spreads.length; i++) scanSpread(`spread_${i}`, spreads[i]);

  return { totalTextFrames: report.length, overflowCount, frames: report };
}

function main() {
  const fontMap = buildFontLookup();
  const styles = createStyleRegistry(fontMap);

  const opts = NewDocumentOptions.createDefault();
  opts.units = UnitType.Inch;
  opts.dpi = DPI;
  opts.width = PAGE_W_IN;
  opts.height = PAGE_H_IN;
  opts.marginsEnabled = true;
  opts.margins = { left: MARGIN_IN, top: MARGIN_IN, right: MARGIN_IN, bottom: MARGIN_IN };
  opts.bleed = { left: BLEED_IN, top: BLEED_IN, right: BLEED_IN, bottom: BLEED_IN };
  opts.createArtboard = false;
  opts.isMultiPage = true;
  opts.isFacing = true;
  opts.isDoublePageStart = true;
  opts.createMaster = true;
  opts.pageCount = 2;

  const doc = Document.create(opts);
  // Exact 8+8 split: Master 0 = Neutral|Neutral (P1-P8), Master 1 = Cortex|Cortex (P9-P16)
  doc.addMasterPages(0, 1, 2);
  doc.addPages(1, true, 6, 0, PageInsertMode.DocumentFlow);
  doc.addPages(7, true, 8, 1, PageInsertMode.DocumentFlow);

  const bg = BaselineGridOptions.create();
  bg.useBaselineGrid = true;
  bg.relativeTo = BaselineGridRelativeTo.TopMargin;
  bg.start = 0;
  bg.spacing = 12.0 * PT;
  bg.colour = RGBA8(140, 180, 210, 90);
  doc.executeCommand(DocumentCommand.createSetDocumentBaselineGrid(bg));

  const masters = doc.masterSpreads.toArray();
  populateMasterSpread(doc, styles, masters[0], 'neutral', 'neutral');
  populateMasterSpread(doc, styles, masters[1], 'cortex', 'cortex');

  const spreads = doc.spreads.toArray();
  const buildLogs = [];

  const spreadBuilders = [
    [buildPage1, buildPage2],
    [buildPage3, buildPage4],
    [buildPage5, buildPage6],
    [buildPage7, buildPage8],
    [buildPage9, buildPage10],
    [buildPage11, buildPage12],
    [buildPage13, buildPage14],
    [buildPage15, buildPage16],
  ];

  for (let s = 0; s < spreadBuilders.length; s++) {
    setSpreadIfNeeded(doc, spreads[s]);
    const ext = spreads[s].getSpreadExtents({
      includeSpread: true,
      includeBleed: false,
      includeChildren: false,
    });
    buildLogs.push(...spreadBuilders[s][0](doc, styles, ext.x, ext.y));
    buildLogs.push(...spreadBuilders[s][1](doc, styles, ext.x + ext.width / 2, ext.y));
  }

  setSpreadIfNeeded(doc, spreads[0]);

  const overflowAudit = verifyAllTextFrames(doc);

  const desktop = Application.userDesktopPath;
  const stageDir = desktop + '\\PaletteDesign_Staging';
  fs.createDirectories(stageDir);
  const nativeExt = Application.productPrimaryFileExtension || 'af';
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const docPath = stageDir + '\\4D_Combinatoric_Worldbuilding_' + stamp + '.' + nativeExt;
  doc.saveAs(docPath);

  const reviewPdfPath = stageDir + '\\4D_Combinatoric_Worldbuilding_Review_SinglePages.pdf';
  if (fs.exists(reviewPdfPath)) fs.remove(reviewPdfPath);
  const pdfOpts = FileExportOptions.createWithPresetName('PDF (for print)');
  const exportArea = FileExportArea.createForPages('1-16');
  const exportRecs = doc.export(reviewPdfPath, pdfOpts, exportArea, null);

  const tightened = buildLogs
    .filter((b) => b.tightenSteps > 0)
    .map((b) => ({
      id: b.id,
      page: b.page,
      steps: b.tightenSteps,
      fontDeltaPt: b.fontDeltaPt,
      leadDeltaPt: b.leadDeltaPt,
    }));

  const auditSummary = {
    sessionUuid: doc.sessionUuid,
    pageCount: doc.pageCount,
    spreadCount: doc.spreadCount,
    masterCount: masters.length,
    minFontPtUsed,
    docPath,
    reviewPdfPath,
    exportSuccess: exportRecs.all.map((r) => ({ path: r.path, ok: r.isSuccess, err: r.errorMessage })),
    totalTextFrames: overflowAudit.totalTextFrames,
    overflowCount: overflowAudit.overflowCount,
    tightenedFrames: tightened,
    overflowingFrames: overflowAudit.frames.filter((f) => f.isWarn),
  };

  console.log(JSON.stringify(auditSummary));
}

main();
