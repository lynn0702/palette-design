'use strict';

/**
 * Builds the 4-page Half-Letter bifold zine "The 4d8 Setting Compiler"
 * inside Affinity Publisher via the Affinity JavaScript SDK.
 *
 * Outputs staging files under <Desktop>\PaletteDesign_Staging\:
 *   - The_4d8_Setting_Compiler.af
 *   - The_4d8_Setting_Compiler_Review_SinglePages.pdf
 * Logs a complete JSON audit of pages, spreads, masters, frame overflow states,
 * tightened frames, and exact ink bottom coordinates.
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
const { Curve, CurveBuilder, PolyCurve, Rectangle } = require('/geometry.js');
const { LineStyleDescriptor } = require('/linestyle.js');
const {
  FrameTextNodeDefinition,
  NodeChildType,
  PolyCurveNodeDefinition,
  ShapeNodeDefinition,
  getNodeChildrenRecursive,
} = require('/nodes.js');
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
// 1. Constants, Grid & High-Pop Chromatic Palette
// ---------------------------------------------------------------------------

const DPI = 300;
const IN = DPI;             // 300 px per inch
const PT = DPI / 72;        // 4.1666667 px per pt
const PAGE_W_IN = 5.5;
const PAGE_H_IN = 8.5;
const MARGIN_IN = 0.42;
const BLEED_IN = 0.125;
const GUTTER_IN = 0.20;
const CONTENT_W_IN = PAGE_W_IN - 2 * MARGIN_IN;              // 4.66 in
const COL_W_IN = (CONTENT_W_IN - GUTTER_IN) / 2;             // 2.23 in

const PALETTE = {
  ink: RGB8(24, 22, 24),
  mutedInk: RGB8(88, 82, 78),
  white: RGB8(255, 255, 255),
  // Pages 1-2: System-Neutral Obsidian + Vermilion + Solar Gold
  neutralDark: RGB8(26, 23, 24),
  neutralShadow: RGB8(48, 42, 44),
  neutralAccent: RGB8(224, 96, 24),
  neutralGold: RGB8(248, 184, 56),
  neutralGoldText: RGB8(166, 90, 0),
  neutralCream: RGB8(251, 247, 240),
  neutralAltRow: RGB8(245, 239, 230),
  neutralBorder: RGB8(208, 196, 182),
  neutralSubtleText: RGB8(226, 214, 198),
  neutralPillBg: RGBA8(243, 230, 212, 255),
  neutralPillInk: RGB8(120, 46, 8),
  // Pages 3-4: Cortex Harness Midnight + Electric Cyan + Hot Magenta
  cortexDark: RGB8(15, 21, 36),
  cortexCyan: RGB8(0, 196, 224),
  cortexCyanDark: RGB8(0, 128, 156),
  cortexMagenta: RGB8(232, 30, 116),
  cortexMagentaDark: RGB8(178, 14, 84),
  cortexIce: RGB8(241, 249, 252),
  cortexPinkTint: RGB8(253, 242, 247),
  cortexBorder: RGB8(0, 158, 188),
  cortexRule: RGB8(176, 214, 226),
  cortexPillBg: RGBA8(216, 244, 250, 255),
  cortexPillInk: RGB8(10, 56, 76),
  cortexDarkPillBg: RGBA8(34, 48, 76, 255),
};

// 8-Row Chromatic Dial Spectrum (rows 1..8)
const DIAL_SWATCHES = [
  { name: 'Prismatic', bg: RGB8(139, 44, 226), fg: RGB8(255, 255, 255), text: RGB8(106, 24, 180), tint: RGB8(248, 243, 254) },
  { name: 'Neon',      bg: RGB8(230, 25, 115), fg: RGB8(255, 255, 255), text: RGB8(176, 14, 82),  tint: RGB8(254, 243, 248) },
  { name: 'Chrome',    bg: RGB8(14, 124, 204), fg: RGB8(255, 255, 255), text: RGB8(10, 94, 158),  tint: RGB8(242, 249, 254) },
  { name: 'Dark',      bg: RGB8(42, 52, 86),   fg: RGB8(255, 255, 255), text: RGB8(36, 44, 74),   tint: RGB8(243, 245, 249) },
  { name: 'Sepia',     bg: RGB8(184, 108, 24), fg: RGB8(255, 255, 255), text: RGB8(142, 78, 10),  tint: RGB8(253, 247, 240) },
  { name: 'Bright',    bg: RGB8(244, 174, 30), fg: RGB8(24, 22, 24),    text: RGB8(152, 86, 0),   tint: RGB8(254, 250, 238) },
  { name: 'Pastel',    bg: RGB8(36, 146, 120), fg: RGB8(255, 255, 255), text: RGB8(22, 112, 90),  tint: RGB8(241, 250, 247) },
  { name: 'Rust',      bg: RGB8(192, 60, 32),  fg: RGB8(255, 255, 255), text: RGB8(152, 42, 18),  tint: RGB8(253, 244, 242) },
];

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
    text: {
      h2: { fontPt: 9.25, caps: CapsType.AllCaps },
      h3: { fontPt: 8.25, caps: CapsType.AllCaps },
      body: { fontPt: 8.0, leadingPt: 9.8, spaceAfterPt: 2.5 },
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Inline Markup Parser & StoryBuilder Engine
// ---------------------------------------------------------------------------

/**
 * Parses **bold**, *italic*, and `code/dice` tokens in a plain string.
 */
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
      StoryDelta.createParagraphDouble(ParagraphAttDoubleType.SpaceAfter, (blk.spaceAfterPt ?? 2.2) * PT)
    );

    if (kind === 'h2') {
      const pt = blk.fontPt ?? styles.text.h2.pt;
      const leadPt = blk.leadingPt ?? (pt + 1.5);
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
      const pt = blk.fontPt ?? styles.text.h3.pt;
      const leadPt = blk.leadingPt ?? (pt + 1.25);
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

    const bodyPt = blk.fontPt ?? styles.text.body.fontPt;
    const leadPt = blk.leadingPt ?? styles.text.body.leadingPt;
    const baseColour = blk.colour ?? PALETTE.ink;
    const trackingEm = blk.trackingEm ?? 0;
    const pillFill = blk.pillBg ? FillDescriptor.createSolid(blk.pillBg) : defaultPillFill;
    const pillInk = blk.pillInk ?? defaultPillInk;

    sb.applyParagraphDelta(StoryDelta.createParagraphDouble(ParagraphAttDoubleType.AbsoluteLeading, leadPt * PT));
    sb.applyGlyphDelta(StoryDelta.createCapsType(blk.caps ?? CapsType.None));
    sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.CharacterSpacing, trackingEm));

    const runs = parseInlineRuns(blk.text);
    let usedLeadColour = false;
    for (const run of runs) {
      if (run.code) {
        sb.applyGlyphDelta(StoryDelta.createFont(FontField.PostscriptName, styles.fonts.monoBold));
        sb.applyGlyphDelta(
          StoryDelta.createGlyphDouble(GlyphAttDoubleType.Height, Math.max(6.25, bodyPt - 0.5) * PT)
        );
        sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.CharacterSpacing, 0));
        sb.applyGlyphDelta(StoryDelta.createBrushFill(FillDescriptor.createSolid(pillInk)));
        sb.applyGlyphDelta(StoryDelta.createHighlightFill(blk.noPill ? noFill : pillFill));
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
        if (run.bold && blk.leadColour && !usedLeadColour) {
          runColour = blk.leadColour;
          usedLeadColour = true;
        } else if (run.bold && blk.boldColour) {
          runColour = blk.boldColour;
        }
        sb.applyGlyphDelta(StoryDelta.createFont(FontField.PostscriptName, fontObj));
        sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.Height, bodyPt * PT));
        sb.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.CharacterSpacing, trackingEm));
        sb.applyGlyphDelta(StoryDelta.createBrushFill(FillDescriptor.createSolid(runColour)));
        sb.applyGlyphDelta(StoryDelta.createHighlightFill(noFill));
      }
      sb.addText(run.text);
    }
  }
  return sb;
}

// ---------------------------------------------------------------------------
// 4. Vector, Diagram & Text Frame Helpers
// ---------------------------------------------------------------------------

function makeRectPx(xIn, yIn, wIn, hIn, originX, originY) {
  return new Rectangle(originX + xIn * IN, originY + yIn * IN, wIn * IN, hIn * IN);
}

function addRectShape(doc, rect, fillColour, strokeColour, strokePt, name, cornerPt, cornerType) {
  const shape = ShapeRectangle.create();
  if (cornerPt && cornerPt > 0) {
    shape.useSingleRadius = true;
    shape.setAbsoluteSizes(true, rect.width, rect.height);
    shape.topLeft.cornerType = cornerType ?? ShapeCornerType.Round;
    shape.topLeft.setRadius(cornerPt * PT, rect.width, rect.height);
  }
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
  const builder = AddChildNodesCommandBuilder.create();
  builder.addNode(def);
  const cmd = builder.createCommand(true, NodeChildType.Main);
  doc.executeCommand(cmd);
  return cmd.newNodes[0];
}

function addShadowCard(doc, rect, fillColour, strokeColour, strokePt, shadowColour, offsetPt, cornerPt, cornerType, name) {
  if (shadowColour && offsetPt > 0) {
    const shRect = new Rectangle(
      rect.x + offsetPt * PT,
      rect.y + offsetPt * PT,
      rect.width,
      rect.height
    );
    addRectShape(doc, shRect, shadowColour, null, 0, `${name}_shadow`, cornerPt, cornerType);
  }
  return addRectShape(doc, rect, fillColour, strokeColour, strokePt, name, cornerPt, cornerType);
}

function addPolygon(doc, pts, fillColour, strokeColour, strokePt, name) {
  const cb = CurveBuilder.create();
  cb.beginXY(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    cb.lineToXY(pts[i][0], pts[i][1]);
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
  const builder = AddChildNodesCommandBuilder.create();
  builder.addNode(def);
  const cmd = builder.createCommand(true, NodeChildType.Main);
  doc.executeCommand(cmd);
  return cmd.newNodes[0];
}

function addLineSegment(doc, x1, y1, x2, y2, strokeColour, strokePt, name) {
  const poly = PolyCurve.create();
  poly.addCurve(Curve.createLineXY(x1, y1, x2, y2));
  const def = PolyCurveNodeDefinition.create(
    poly,
    FillDescriptor.createNone(),
    FillDescriptor.createSolid(strokeColour, BlendMode.Normal),
    LineStyleDescriptor.createDefault(strokePt * PT),
    FillDescriptor.createNone()
  );
  if (name) def.userDescription = name;
  const builder = AddChildNodesCommandBuilder.create();
  builder.addNode(def);
  const cmd = builder.createCommand(true, NodeChildType.Main);
  doc.executeCommand(cmd);
  return cmd.newNodes[0];
}

/**
 * Draws a sharp chamfered interior banner bar with offset drop shadow and angled right accent wedge.
 */
function addChamferedBanner(doc, styles, pageNum, ox, oy, theme, titleText, badgeText) {
  const isCortex = theme === 'cortex';
  const bgCol = isCortex ? PALETTE.cortexDark : PALETTE.neutralDark;
  const accentCol = isCortex ? PALETTE.cortexCyan : PALETTE.neutralAccent;
  const secondCol = isCortex ? PALETTE.cortexMagenta : PALETTE.neutralGold;
  const badgeTextCol = isCortex ? PALETTE.cortexDark : PALETTE.neutralDark;

  const x0 = ox + MARGIN_IN * IN;
  const y0 = oy + 0.34 * IN;
  const w = CONTENT_W_IN * IN;
  const h = 0.33 * IN;
  const cut = 0.08 * IN;
  const sh = 2.2 * PT;

  // Offset shadow polygon
  addPolygon(
    doc,
    [
      [x0 + sh, y0 + sh],
      [x0 + w - cut + sh, y0 + sh],
      [x0 + w + sh, y0 + cut + sh],
      [x0 + w + sh, y0 + h + sh],
      [x0 + cut + sh, y0 + h + sh],
      [x0 + sh, y0 + h - cut + sh],
    ],
    secondCol,
    null,
    0,
    `p${pageNum}_banner_shadow`
  );

  // Main dark chamfered polygon
  addPolygon(
    doc,
    [
      [x0, y0],
      [x0 + w - cut, y0],
      [x0 + w, y0 + cut],
      [x0 + w, y0 + h],
      [x0 + cut, y0 + h],
      [x0, y0 + h - cut],
    ],
    bgCol,
    null,
    0,
    `p${pageNum}_banner_bg`
  );

  // Angled bright accent tag on right end
  const tagW = 1.08 * IN;
  const slant = 0.10 * IN;
  addPolygon(
    doc,
    [
      [x0 + w - tagW, y0],
      [x0 + w - cut, y0],
      [x0 + w, y0 + cut],
      [x0 + w, y0 + h],
      [x0 + w - tagW - slant, y0 + h],
    ],
    accentCol,
    null,
    0,
    `p${pageNum}_banner_tag_bg`
  );

  const r1 = createTextFrameWithAutoFit(doc, styles, {
    id: `p${pageNum}_banner_title`,
    pageNum,
    rect: makeRectPx(MARGIN_IN + 0.12, 0.415, CONTENT_W_IN - 1.28, 0.21, ox, oy),
    theme,
    ignoreBaselineGrid: true,
    allowAutoTighten: false,
    blocks: [
      {
        kind: 'body',
        text: titleText,
        forceFontKey: 'displayBold',
        fontPt: 9.75,
        leadingPt: 11.2,
        trackingEm: 0.03,
        caps: CapsType.AllCaps,
        colour: PALETTE.white,
        spaceAfterPt: 0,
      },
    ],
  });

  const r2 = createTextFrameWithAutoFit(doc, styles, {
    id: `p${pageNum}_banner_badge`,
    pageNum,
    rect: makeRectPx(MARGIN_IN + CONTENT_W_IN - 1.08, 0.425, 0.98, 0.18, ox, oy),
    theme,
    ignoreBaselineGrid: true,
    allowAutoTighten: false,
    blocks: [
      {
        kind: 'body',
        text: badgeText,
        forceFontKey: 'displayHeavy',
        fontPt: 7.25,
        leadingPt: 8.5,
        trackingEm: 0.04,
        caps: CapsType.AllCaps,
        colour: badgeTextCol,
        align: ParagraphAlignXType.Right,
        spaceAfterPt: 0,
      },
    ],
  });

  return [r1, r2];
}

/**
 * Draws a crisp vector faceted d8 (octahedron silhouette + inner triangular facets).
 */
function addFacetedD8(doc, cxIn, cyIn, rxIn, ryIn, ox, oy, mainCol, facetLightCol, facetDarkCol, strokeCol, name) {
  const cx = ox + cxIn * IN;
  const cy = oy + cyIn * IN;
  const rx = rxIn * IN;
  const ry = ryIn * IN;

  const top = [cx, cy - ry];
  const right = [cx + rx, cy - ry * 0.10];
  const botRight = [cx + rx * 0.72, cy + ry * 0.56];
  const bot = [cx, cy + ry];
  const botLeft = [cx - rx * 0.72, cy + ry * 0.56];
  const left = [cx - rx, cy - ry * 0.10];

  const innerLeft = [cx - rx * 0.52, cy + ry * 0.24];
  const innerRight = [cx + rx * 0.52, cy + ry * 0.24];

  // Base polygon
  addPolygon(doc, [top, right, botRight, bot, botLeft, left], mainCol, strokeCol, 1.1, `${name}_body`);
  // Upper-left bright facet
  addPolygon(doc, [top, left, innerLeft], facetLightCol, null, 0, `${name}_fl`);
  // Lower-right shadow facet
  addPolygon(doc, [right, botRight, bot, innerRight], facetDarkCol, null, 0, `${name}_fr`);
  // Inner crisp center triangle line work
  addPolygon(doc, [top, innerRight, innerLeft], null, strokeCol, 0.75, `${name}_tri`);
  addLineSegment(doc, left[0], left[1], innerLeft[0], innerLeft[1], strokeCol, 0.65, `${name}_e1`);
  addLineSegment(doc, right[0], right[1], innerRight[0], innerRight[1], strokeCol, 0.65, `${name}_e2`);
  addLineSegment(doc, bot[0], bot[1], innerLeft[0], innerLeft[1], strokeCol, 0.65, `${name}_e3`);
  addLineSegment(doc, bot[0], bot[1], innerRight[0], innerRight[1], strokeCol, 0.65, `${name}_e4`);
}

function addSectionHeaderBar(doc, styles, pageNum, xIn, yIn, wIn, ox, oy, titleText, accentCol, theme, id) {
  addRectShape(
    doc,
    makeRectPx(xIn, yIn, wIn, 0.21, ox, oy),
    theme === 'cortex' ? PALETTE.cortexDark : PALETTE.neutralDark,
    null,
    0,
    `${id}_bg`,
    2,
    ShapeCornerType.Straight
  );
  addRectShape(
    doc,
    makeRectPx(xIn, yIn, 0.06, 0.21, ox, oy),
    accentCol,
    null,
    0,
    `${id}_pip`,
    0
  );
  return createTextFrameWithAutoFit(doc, styles, {
    id,
    pageNum,
    rect: makeRectPx(xIn + 0.10, yIn + 0.032, wIn - 0.14, 0.16, ox, oy),
    theme,
    ignoreBaselineGrid: true,
    allowAutoTighten: false,
    blocks: [
      {
        kind: 'body',
        text: titleText,
        forceFontKey: 'displayBold',
        fontPt: 8.0,
        leadingPt: 9.5,
        trackingEm: 0.04,
        caps: CapsType.AllCaps,
        colour: PALETTE.white,
        spaceAfterPt: 0,
      },
    ],
  });
}

function cloneBlocksWithScale(blocks, fontDeltaPt, leadDeltaPt, spaceAfterDeltaPt) {
  return blocks.map((b) => {
    const out = Object.assign({}, b);
    if (b.kind === 'h2' || b.kind === 'h3') {
      if (out.fontPt != null) out.fontPt = Math.max(7.25, out.fontPt - fontDeltaPt * 0.5);
      if (out.leadingPt != null) out.leadingPt = Math.max(8.25, out.leadingPt - leadDeltaPt * 0.5);
      if (out.spaceBeforePt != null) out.spaceBeforePt = Math.max(1.0, out.spaceBeforePt - spaceAfterDeltaPt);
      if (out.spaceAfterPt != null) out.spaceAfterPt = Math.max(0.75, out.spaceAfterPt - spaceAfterDeltaPt);
    } else {
      const baseFont = out.fontPt ?? 8.0;
      const baseLead = out.leadingPt ?? 9.8;
      out.fontPt = Math.max(6.5, baseFont - fontDeltaPt);
      out.leadingPt = Math.max(out.fontPt + 1.0, baseLead - leadDeltaPt);
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
    ignoreBaselineGrid = false,
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

    const builder = AddChildNodesCommandBuilder.create();
    builder.addNode(def);
    const cmd = builder.createCommand(true, NodeChildType.Main);
    doc.executeCommand(cmd);
    node = cmd.newNodes[0];

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
    const curFont = sampleBody ? sampleBody.fontPt : 8.0;
    const curLead = sampleBody ? sampleBody.leadingPt : 9.8;
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
 * Precision grid table with chromatic d8 pill badges in Column 0, subtle row striping,
 * and individual overflow-checked text frames.
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
    padHIn = 0.05,
    padVIn = 0.04,
    cellFontPt = 7.5,
    cellLeadPt = 8.9,
  } = cfg;

  const totalWIn = colWidthsIn.reduce((a, b) => a + b, 0);
  const headerBg = theme === 'cortex' ? PALETTE.cortexDark : PALETTE.neutralDark;
  const altBg = theme === 'cortex' ? PALETTE.cortexIce : PALETTE.neutralAltRow;
  const ruleCol = theme === 'cortex' ? PALETTE.cortexRule : PALETTE.neutralBorder;
  const accentCol = theme === 'cortex' ? PALETTE.cortexCyan : PALETTE.neutralAccent;

  const auditItems = [];
  let curYIn = yIn;

  // Header background
  const hdrRect = makeRectPx(xIn, curYIn, totalWIn, headerHeightIn, originX, originY);
  addRectShape(doc, hdrRect, headerBg, null, 0, `${idPrefix}_hdr_bg`, 0);

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
    const res = createTextFrameWithAutoFit(doc, styles, {
      id: `${idPrefix}_hdr_c${c}`,
      pageNum,
      rect: cellRect,
      theme,
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: headers[c],
          forceFontKey: 'displayBold',
          fontPt: cfg.headerFontPt ?? 6.75,
          leadingPt: 8.0,
          trackingEm: 0.03,
          caps: CapsType.AllCaps,
          colour: PALETTE.white,
          align: c === 0 ? ParagraphAlignXType.Centre : ParagraphAlignXType.Left,
          spaceAfterPt: 0,
        },
      ],
    });
    auditItems.push(res);
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
    const isAlt = r % 2 === 1;
    const rowBg = isAlt ? altBg : PALETTE.white;

    const rowRect = makeRectPx(xIn, curYIn, totalWIn, rh, originX, originY);
    addRectShape(doc, rowRect, rowBg, null, 0, `${idPrefix}_r${r + 1}_bg`, 0);

    // Chromatic left edge bar for instant row keying
    addRectShape(
      doc,
      makeRectPx(xIn, curYIn, 0.035, rh, originX, originY),
      swatch.bg,
      null,
      0,
      `${idPrefix}_r${r + 1}_swatchbar`,
      0
    );

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
        // Chromatic pill badge centered in Col 0
        const pillW = Math.min(0.18, cw - 0.08);
        const pillH = Math.min(0.19, rh - 0.045);
        const pillX = curXIn + (cw - pillW) / 2 + 0.015;
        const pillY = curYIn + (rh - pillH) / 2;
        addRectShape(
          doc,
          makeRectPx(pillX, pillY, pillW, pillH, originX, originY),
          swatch.bg,
          null,
          0,
          `${idPrefix}_r${r + 1}_badge`,
          2.2,
          ShapeCornerType.Round
        );
        const numRect = makeRectPx(
          pillX,
          pillY + (pillH - 0.13) / 2 + 0.01,
          pillW,
          0.13,
          originX,
          originY
        );
        const res = createTextFrameWithAutoFit(doc, styles, {
          id: `${idPrefix}_r${r + 1}_c0`,
          pageNum,
          rect: numRect,
          theme,
          ignoreBaselineGrid: true,
          allowAutoTighten: false,
          blocks: [
            {
              kind: 'body',
              text: rows[r][0],
              forceFontKey: 'displayHeavy',
              fontPt: 7.75,
              leadingPt: 8.5,
              colour: swatch.fg,
              align: ParagraphAlignXType.Centre,
              spaceAfterPt: 0,
            },
          ],
        });
        auditItems.push(res);
      } else {
        const cellRect = makeRectPx(
          curXIn + padHIn,
          curYIn + padVIn,
          cw - 2 * padHIn,
          rh - 2 * padVIn,
          originX,
          originY
        );
        const res = createTextFrameWithAutoFit(doc, styles, {
          id: `${idPrefix}_r${r + 1}_c${c}`,
          pageNum,
          rect: cellRect,
          theme,
          ignoreBaselineGrid: true,
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
        });
        auditItems.push(res);
      }
      curXIn += cw;
    }
    curYIn += rh;
  }

  const fullHIn = headerHeightIn + rowHeightsIn.reduce((a, b) => a + b, 0);
  addRectShape(
    doc,
    makeRectPx(xIn, yIn, totalWIn, fullHIn, originX, originY),
    null,
    headerBg,
    0.85,
    `${idPrefix}_outer_border`,
    0
  );

  return auditItems;
}

// ---------------------------------------------------------------------------
// 5. Master Spread Builders (Bleed Edge Strip & Running Footer Only)
// ---------------------------------------------------------------------------

function setSpreadIfNeeded(doc, spread) {
  if (!doc.currentSpread.isSameNode(spread)) {
    doc.executeCommand(DocumentCommand.createSetCurrentSpread(spread));
  }
}

function populateMasterSpread(doc, styles, masterSpread, theme) {
  setSpreadIfNeeded(doc, masterSpread);
  const ext = masterSpread.getSpreadExtents({
    includeSpread: true,
    includeBleed: false,
    includeChildren: false,
  });
  const halfW = ext.width / 2;
  const pageOrigins = [
    { x: ext.x, y: ext.y, side: 'L' },
    { x: ext.x + halfW, y: ext.y, side: 'R' },
  ];

  const isCortex = theme === 'cortex';
  const footerLeft = isCortex
    ? 'THE 4D8 SETTING COMPILER  ·  CORTEX HARNESS'
    : 'THE 4D8 SETTING COMPILER  ·  BY LYNN JONES';
  const footerRight = isCortex ? 'CORTEX PRIME COMPATIBLE' : 'SYSTEM-NEUTRAL ENGINE';

  for (const pg of pageOrigins) {
    // Top bleed edge strip
    if (isCortex) {
      const splitW = (PAGE_W_IN + BLEED_IN) * 0.65;
      addRectShape(
        doc,
        new Rectangle(
          pg.x - (pg.side === 'L' ? BLEED_IN * IN : 0),
          pg.y - BLEED_IN * IN,
          splitW * IN,
          0.17 * IN
        ),
        PALETTE.cortexCyan,
        null,
        0,
        `master_cortex_${pg.side}_bleed_cyan`,
        0
      );
      addRectShape(
        doc,
        new Rectangle(
          pg.x - (pg.side === 'L' ? BLEED_IN * IN : 0) + splitW * IN,
          pg.y - BLEED_IN * IN,
          (PAGE_W_IN + BLEED_IN - splitW) * IN,
          0.17 * IN
        ),
        PALETTE.cortexMagenta,
        null,
        0,
        `master_cortex_${pg.side}_bleed_magenta`,
        0
      );
    } else {
      addRectShape(
        doc,
        new Rectangle(
          pg.x - (pg.side === 'L' ? BLEED_IN * IN : 0),
          pg.y - BLEED_IN * IN,
          (PAGE_W_IN + BLEED_IN) * IN,
          0.17 * IN
        ),
        PALETTE.neutralAccent,
        null,
        0,
        `master_neutral_${pg.side}_bleed_strip`,
        0
      );
    }

    // Running footer rule (y: 8.08 in) & labels (y: 8.13 in)
    if (isCortex) {
      addLineSegment(
        doc,
        pg.x + MARGIN_IN * IN,
        pg.y + 8.08 * IN,
        pg.x + (MARGIN_IN + CONTENT_W_IN * 0.65) * IN,
        pg.y + 8.08 * IN,
        PALETTE.cortexCyan,
        0.85,
        `master_cortex_${pg.side}_foot_cyan`
      );
      addLineSegment(
        doc,
        pg.x + (MARGIN_IN + CONTENT_W_IN * 0.65) * IN,
        pg.y + 8.08 * IN,
        pg.x + (MARGIN_IN + CONTENT_W_IN) * IN,
        pg.y + 8.08 * IN,
        PALETTE.cortexMagenta,
        0.85,
        `master_cortex_${pg.side}_foot_magenta`
      );
    } else {
      addLineSegment(
        doc,
        pg.x + MARGIN_IN * IN,
        pg.y + 8.08 * IN,
        pg.x + (MARGIN_IN + CONTENT_W_IN) * IN,
        pg.y + 8.08 * IN,
        PALETTE.neutralBorder,
        0.75,
        `master_neutral_${pg.side}_foot_rule`
      );
    }

    createTextFrameWithAutoFit(doc, styles, {
      id: `master_${theme}_${pg.side}_foot_l`,
      pageNum: 0,
      rect: makeRectPx(MARGIN_IN, 8.13, 3.1, 0.16, pg.x, pg.y),
      theme,
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: footerLeft,
          forceFontKey: 'displaySemi',
          fontPt: 6.5,
          leadingPt: 7.5,
          trackingEm: 0.05,
          caps: CapsType.AllCaps,
          colour: PALETTE.mutedInk,
          spaceAfterPt: 0,
        },
      ],
    });
    createTextFrameWithAutoFit(doc, styles, {
      id: `master_${theme}_${pg.side}_foot_r`,
      pageNum: 0,
      rect: makeRectPx(MARGIN_IN + 3.05, 8.13, CONTENT_W_IN - 3.05, 0.16, pg.x, pg.y),
      theme,
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: footerRight,
          forceFontKey: 'displayBold',
          fontPt: 6.5,
          leadingPt: 7.5,
          trackingEm: 0.05,
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
// 6. Page Content Builders (Pages 1–4)
// ---------------------------------------------------------------------------

function buildPage1(doc, styles, ox, oy) {
  const results = [];
  const col1X = MARGIN_IN;
  const col2X = MARGIN_IN + COL_W_IN + GUTTER_IN;

  // --- HERO COVER BLOCK (y: 0.30 .. 1.48 in) ---
  const hx = ox + MARGIN_IN * IN;
  const hy = oy + 0.30 * IN;
  const hw = CONTENT_W_IN * IN;
  const hh = 1.18 * IN;
  const cut = 0.11 * IN;
  const sh = 3.0 * PT;

  // Vermilion hard-offset shadow behind hero block
  addPolygon(
    doc,
    [
      [hx + sh, hy + sh],
      [hx + hw - cut + sh, hy + sh],
      [hx + hw + sh, hy + cut + sh],
      [hx + hw + sh, hy + hh + sh],
      [hx + cut + sh, hy + hh + sh],
      [hx + sh, hy + hh - cut + sh],
    ],
    PALETTE.neutralAccent,
    null,
    0,
    'p1_hero_shadow'
  );

  // Obsidian hero body
  addPolygon(
    doc,
    [
      [hx, hy],
      [hx + hw - cut, hy],
      [hx + hw, hy + cut],
      [hx + hw, hy + hh],
      [hx + cut, hy + hh],
      [hx, hy + hh - cut],
    ],
    PALETTE.neutralDark,
    null,
    0,
    'p1_hero_bg'
  );

  // Gold bottom accent bar inside hero
  addRectShape(
    doc,
    makeRectPx(MARGIN_IN + 0.11, 1.445, CONTENT_W_IN - 0.11, 0.035, ox, oy),
    PALETTE.neutralGold,
    null,
    0,
    'p1_hero_gold_bar',
    0
  );

  // Hero Cover Typography (Left)
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_hero_title',
      pageNum: 1,
      rect: makeRectPx(MARGIN_IN + 0.14, 0.38, 3.22, 1.03, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'COMBINATORIC WORLDBUILDING  ·  BY LYNN JONES',
          forceFontKey: 'displaySemi',
          fontPt: 6.5,
          leadingPt: 8.0,
          trackingEm: 0.07,
          caps: CapsType.AllCaps,
          colour: PALETTE.neutralGold,
          spaceAfterPt: 3.0,
        },
        {
          kind: 'body',
          text: 'THE 4D8',
          forceFontKey: 'displayHeavy',
          fontPt: 19.5,
          leadingPt: 19.5,
          trackingEm: 0.02,
          caps: CapsType.AllCaps,
          colour: PALETTE.white,
          spaceAfterPt: 1.0,
        },
        {
          kind: 'body',
          text: 'SETTING COMPILER',
          forceFontKey: 'displayBold',
          fontPt: 13.5,
          leadingPt: 14.5,
          trackingEm: 0.04,
          caps: CapsType.AllCaps,
          colour: PALETTE.neutralGold,
          spaceAfterPt: 4.0,
        },
        {
          kind: 'body',
          text: '*Three words sell a world. Four d8s ignite a campaign.*',
          fontPt: 8.0,
          leadingPt: 9.5,
          colour: PALETTE.neutralSubtleText,
          spaceAfterPt: 3.5,
        },
        {
          kind: 'body',
          text: 'P1–2: SYSTEM-NEUTRAL ENGINE   |   P3–4: CORTEX PRIME HARNESS',
          forceFontKey: 'displaySemi',
          fontPt: 5.75,
          leadingPt: 7.0,
          trackingEm: 0.03,
          caps: CapsType.AllCaps,
          colour: PALETTE.neutralAccent,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Graphic 4d8 Dial Cluster on Right of Hero Card
  addFacetedD8(
    doc,
    3.94,
    0.69,
    0.215,
    0.265,
    ox,
    oy,
    DIAL_SWATCHES[0].bg,
    RGB8(176, 98, 245),
    RGB8(98, 22, 168),
    PALETTE.white,
    'p1_d8_palette'
  );
  addFacetedD8(
    doc,
    4.32,
    0.63,
    0.215,
    0.265,
    ox,
    oy,
    DIAL_SWATCHES[2].bg,
    RGB8(58, 164, 236),
    RGB8(8, 88, 152),
    PALETTE.white,
    'p1_d8_setting'
  );
  addFacetedD8(
    doc,
    4.70,
    0.70,
    0.215,
    0.265,
    ox,
    oy,
    DIAL_SWATCHES[1].bg,
    RGB8(245, 86, 154),
    RGB8(170, 12, 82),
    PALETTE.white,
    'p1_d8_tone'
  );
  // 4th Die: Undertow in bright Solar Gold centered lower
  addFacetedD8(
    doc,
    4.32,
    1.05,
    0.225,
    0.275,
    ox,
    oy,
    PALETTE.neutralGold,
    RGB8(255, 218, 120),
    RGB8(212, 134, 16),
    PALETTE.neutralDark,
    'p1_d8_undertow'
  );

  // --- MIDDLE 2-COLUMN PROCEDURE & UNDERTOW ZONE (y: 1.66 .. 3.42 in) ---
  // Left Column: Procedure + 2 Quick-Rule Pills
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_col1_h2',
      pageNum: 1,
      rect: makeRectPx(col1X, 1.66, COL_W_IN, 0.20, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'h2',
          text: 'The 4d8 Procedure',
          fontPt: 9.5,
          leadingPt: 11.0,
          spaceAfterPt: 0,
        },
      ],
    })
  );
  addLineSegment(
    doc,
    ox + col1X * IN,
    oy + 1.85 * IN,
    ox + (col1X + COL_W_IN) * IN,
    oy + 1.85 * IN,
    PALETTE.neutralAccent,
    1.5,
    'p1_col1_rule'
  );

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_col1_body',
      pageNum: 1,
      rect: makeRectPx(col1X, 1.89, COL_W_IN, 0.48, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: 'Roll `4d8` once (no rerolls). Slot 3 into **Palette**, **Setting**, **Tone** (*512 pitches*); drop the 4th as **Undertow**.',
          fontPt: 8.1,
          leadingPt: 9.9,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Mini Callout Pill 1: Matched Pair
  addRectShape(
    doc,
    makeRectPx(col1X, 2.42, COL_W_IN, 0.46, ox, oy),
    PALETTE.neutralCream,
    PALETTE.neutralBorder,
    0.75,
    'p1_pill_pair_bg',
    0
  );
  addRectShape(
    doc,
    makeRectPx(col1X, 2.42, 0.055, 0.46, ox, oy),
    PALETTE.neutralGold,
    null,
    0,
    'p1_pill_pair_bar',
    0
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_pill_pair_txt',
      pageNum: 1,
      rect: makeRectPx(col1X + 0.10, 2.465, COL_W_IN - 0.14, 0.39, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: '**Matched Pair → Deep Note**',
          fontPt: 7.6,
          leadingPt: 8.8,
          colour: PALETTE.neutralGoldText,
          spaceAfterPt: 1.0,
        },
        {
          kind: 'body',
          text: 'Double down on that Dial\'s extreme; zero dilution.',
          fontPt: 7.35,
          leadingPt: 8.6,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Mini Callout Pill 2: Four-of-a-Kind
  addRectShape(
    doc,
    makeRectPx(col1X, 2.94, COL_W_IN, 0.46, ox, oy),
    PALETTE.neutralCream,
    PALETTE.neutralBorder,
    0.75,
    'p1_pill_quad_bg',
    0
  );
  addRectShape(
    doc,
    makeRectPx(col1X, 2.94, 0.055, 0.46, ox, oy),
    PALETTE.neutralAccent,
    null,
    0,
    'p1_pill_quad_bar',
    0
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_pill_quad_txt',
      pageNum: 1,
      rect: makeRectPx(col1X + 0.10, 2.985, COL_W_IN - 0.14, 0.39, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: '**4-of-a-Kind** (`N-N-N-N`) **→ Pure Archetype**',
          fontPt: 7.35,
          leadingPt: 8.8,
          boldColour: PALETTE.neutralAccent,
          spaceAfterPt: 1.0,
        },
        {
          kind: 'body',
          text: 'Skip Undertow; run row straight at max volume.',
          fontPt: 7.35,
          leadingPt: 8.6,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Right Column: Hard-Shadow Card for THE UNDERTOW (4TH DIE)
  addShadowCard(
    doc,
    makeRectPx(col2X, 1.66, COL_W_IN, 1.74, ox, oy),
    PALETTE.neutralCream,
    null,
    0,
    PALETTE.neutralShadow,
    2.5,
    0,
    ShapeCornerType.None,
    'p1_undertow_card'
  );
  addRectShape(
    doc,
    makeRectPx(col2X, 1.66, COL_W_IN, 0.24, ox, oy),
    PALETTE.neutralAccent,
    null,
    0,
    'p1_undertow_hdr_bg',
    0
  );
  addRectShape(
    doc,
    makeRectPx(col2X, 1.66, COL_W_IN, 1.74, ox, oy),
    null,
    PALETTE.neutralDark,
    0.85,
    'p1_undertow_border',
    0
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_undertow_hdr_txt',
      pageNum: 1,
      rect: makeRectPx(col2X + 0.10, 1.71, COL_W_IN - 0.20, 0.16, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'THE UNDERTOW · 4TH DIE',
          forceFontKey: 'displayHeavy',
          fontPt: 7.75,
          leadingPt: 9.0,
          trackingEm: 0.04,
          caps: CapsType.AllCaps,
          colour: PALETTE.white,
          spaceAfterPt: 0,
        },
      ],
    })
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_undertow_body',
      pageNum: 1,
      rect: makeRectPx(col2X + 0.10, 1.99, COL_W_IN - 0.18, 1.35, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: '• **Palette** *(Divide)*: Split class, zone, or day/night (*Chrome spires, Rust slums*).',
          fontPt: 7.75,
          leadingPt: 9.7,
          leadColour: DIAL_SWATCHES[0].text,
          leftIndentPt: 7,
          firstIndentPt: -7,
          spaceAfterPt: 5.5,
        },
        {
          kind: 'body',
          text: '• **Setting** *(Layer)*: Stack or collide play spaces (*Modern streets, Mythic spirits*).',
          fontPt: 7.75,
          leadingPt: 9.7,
          leadColour: DIAL_SWATCHES[2].text,
          leftIndentPt: 7,
          firstIndentPt: -7,
          spaceAfterPt: 5.5,
        },
        {
          kind: 'body',
          text: '• **Tone** *(Counter-Beat)*: Contrast front vs. stakes, or wilds vs. home (*Peril wilds, Cozy camp*).',
          fontPt: 7.75,
          leadingPt: 9.7,
          leadColour: DIAL_SWATCHES[1].text,
          leftIndentPt: 7,
          firstIndentPt: -7,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // --- MASTER DIAL MATRIX (y: 3.55 .. 7.91 in) ---
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_matrix_heading',
      pageNum: 1,
      rect: makeRectPx(MARGIN_IN, 3.55, 2.8, 0.20, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'h2',
          text: 'The Master Dial Matrix',
          fontPt: 9.5,
          leadingPt: 11.0,
          spaceAfterPt: 0,
        },
      ],
    })
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p1_matrix_kicker',
      pageNum: 1,
      rect: makeRectPx(MARGIN_IN + 2.6, 3.575, CONTENT_W_IN - 2.6, 0.16, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'ROLL 4d8  ·  ASSIGN IN ANY ORDER',
          forceFontKey: 'displayBold',
          fontPt: 6.75,
          leadingPt: 8.0,
          trackingEm: 0.05,
          caps: CapsType.AllCaps,
          colour: PALETTE.neutralAccent,
          align: ParagraphAlignXType.Right,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  results.push(
    ...buildPrecisionTable(doc, styles, {
      idPrefix: 'p1_matrix',
      pageNum: 1,
      originX: ox,
      originY: oy,
      xIn: MARGIN_IN,
      yIn: 3.79,
      colWidthsIn: [0.30, 1.04, 1.04, 1.03, 1.25],
      headerHeightIn: 0.27,
      headerFontPt: 6.5,
      rowHeightsIn: [0.48, 0.48, 0.48, 0.48, 0.48, 0.48, 0.48, 0.48],
      cellFontPt: 7.4,
      cellLeadPt: 8.8,
      padHIn: 0.05,
      padVIn: 0.042,
      headers: [
        'd8',
        '1: PALETTE (Texture)',
        '2: SETTING (Space)',
        '3: TONE (Drive)',
        'Pure Archetype (N-N-N-N)',
      ],
      rows: [
        [
          '1',
          '**Prismatic:** Reality-bleed, shifting hues.',
          '**Threshold:** Liminal hubs, portals, crossroads.',
          '**Weird:** Uncanny mystery, impossible rules.',
          '**Liminal Surrealism** (*Control, Piranesi*)',
        ],
        [
          '2',
          '**Neon:** Rain-slick glow, overload.',
          '**Future:** Wired sprawl, near-out tech.',
          '**Punk:** Asymmetric revolt vs. system.',
          '**Classic Cyberpunk** (*Edgerunners, Akira*)',
        ],
        [
          '3',
          '**Chrome:** Mirrored sheen, sterile polish.',
          '**Space:** Jump-lanes, habitats, void transit.',
          '**Adventure:** Bold crews, uncharted horizons.',
          '**Golden-Age Sci-Fi** (*Star Trek, Mass Effect*)',
        ],
        [
          '4',
          '**Dark:** Deep shadows, sodium-lit corners.',
          '**Modern:** Current streets & institutions.',
          '**Noir:** Moral rot, compromised choices.',
          '**Hardboiled Crime** (*Se7en, True Detective*)',
        ],
        [
          '5',
          '**Sepia:** Brass warmth, weathered maps.',
          '**Industrial:** Coal smoke, ironworks, gears.',
          '**Pulp:** Two-fisted stunts, cliffhangers.',
          '**Gaslamp Serial** (*The Mummy, Arcane*)',
        ],
        [
          '6',
          '**Bright:** Sun-drenched, high-contrast skies.',
          '**Mythic:** Active gods, spirits, sacred realms.',
          '**Heroic:** Clear stakes, shielding the weak.',
          '**High Mythic Fantasy** (*Hades, Mononoke*)',
        ],
        [
          '7',
          '**Pastel:** Soft light, hand-painted calm.',
          '**Hearth:** Workshops, ovens, tended valleys.',
          '**Cozy:** Mutual aid, mending rifts, routine.',
          '**Pastoral Storycraft** (*Kiki\'s, Wanderhome*)',
        ],
        [
          '8',
          '**Rust:** Corroded iron, patched salvage.',
          '**Primal:** Megafauna, untamed wilds, bone.',
          '**Peril:** Scarce safety, unforgiving hazards.',
          '**Grim Survival** (*Mad Max, Scavengers Reign*)',
        ],
      ],
      theme: 'neutral',
    })
  );

  return results;
}

function buildPage2(doc, styles, ox, oy) {
  const results = [];
  const col1X = MARGIN_IN;
  const col2X = MARGIN_IN + COL_W_IN + GUTTER_IN;

  results.push(
    ...addChamferedBanner(
      doc,
      styles,
      2,
      ox,
      oy,
      'neutral',
      '02 · WORLD CHEMISTRY & ENTANGLEMENT',
      'SESSION ZERO'
    )
  );

  // Full-width intro deck (y: 0.77 .. 0.99 in)
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_intro_deck',
      pageNum: 2,
      rect: makeRectPx(MARGIN_IN, 0.77, CONTENT_W_IN, 0.22, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: 'Pitch paints the cover; **chemistry** drives play. Regulate four **DOSE** needs—**Chemically** *(visceral)* or **Mystically** *(divine)*:',
          fontPt: 8.1,
          leadingPt: 9.8,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // --- TOP LEFT: 2x2 DOSE CHEMISTRY CARDS (y: 1.04 .. 3.04 in) ---
  const doseCards = [
    {
      letter: 'D',
      title: 'DOPAMINE',
      tag: 'Transactional',
      desc: 'Reward, ambition, scrip, leverage.',
      col: DIAL_SWATCHES[4].bg,
      textCol: DIAL_SWATCHES[4].text,
    },
    {
      letter: 'O',
      title: 'OXYTOCIN',
      tag: 'Relational',
      desc: 'Trust, kinship, belonging, safe harbor.',
      col: DIAL_SWATCHES[1].bg,
      textCol: DIAL_SWATCHES[1].text,
    },
    {
      letter: 'S',
      title: 'SEROTONIN',
      tag: 'Positional',
      desc: 'Dignity, pride, *community credit*.',
      col: DIAL_SWATCHES[2].bg,
      textCol: DIAL_SWATCHES[2].text,
    },
    {
      letter: 'E',
      title: 'ENDORPHINS',
      tag: 'Physical',
      desc: 'Thrill, hunger, pleasure, relief.',
      col: DIAL_SWATCHES[6].bg,
      textCol: DIAL_SWATCHES[6].text,
    },
  ];

  const cardGap = 0.09;
  const cardW = (COL_W_IN - cardGap) / 2;
  const cardH = 0.95;
  for (let i = 0; i < doseCards.length; i++) {
    const dc = doseCards[i];
    const gx = col1X + (i % 2) * (cardW + cardGap);
    const gy = 1.05 + Math.floor(i / 2) * (cardH + cardGap);

    addShadowCard(
      doc,
      makeRectPx(gx, gy, cardW, cardH, ox, oy),
      PALETTE.neutralCream,
      null,
      0,
      PALETTE.neutralShadow,
      1.6,
      0,
      ShapeCornerType.None,
      `p2_dose_card_${dc.letter}`
    );
    addRectShape(
      doc,
      makeRectPx(gx, gy, cardW, 0.21, ox, oy),
      dc.col,
      null,
      0,
      `p2_dose_hdr_${dc.letter}`,
      0
    );
    addRectShape(
      doc,
      makeRectPx(gx, gy, cardW, cardH, ox, oy),
      null,
      PALETTE.neutralBorder,
      0.75,
      `p2_dose_border_${dc.letter}`,
      0
    );
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p2_dose_hdr_txt_${dc.letter}`,
        pageNum: 2,
        rect: makeRectPx(gx + 0.06, gy + 0.036, cardW - 0.12, 0.15, ox, oy),
        theme: 'neutral',
        ignoreBaselineGrid: true,
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: `${dc.letter} · ${dc.title}`,
            forceFontKey: 'displayHeavy',
            fontPt: 7.5,
            leadingPt: 8.8,
            trackingEm: 0.04,
            caps: CapsType.AllCaps,
            colour: PALETTE.white,
            spaceAfterPt: 0,
          },
        ],
      })
    );
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p2_dose_body_${dc.letter}`,
        pageNum: 2,
        rect: makeRectPx(gx + 0.065, gy + 0.26, cardW - 0.13, cardH - 0.30, ox, oy),
        theme: 'neutral',
        ignoreBaselineGrid: true,
        blocks: [
          {
            kind: 'body',
            text: `**${dc.tag}**`,
            fontPt: 7.5,
            leadingPt: 9.0,
            boldColour: dc.textCol,
            spaceAfterPt: 1.5,
          },
          {
            kind: 'body',
            text: dc.desc,
            fontPt: 7.5,
            leadingPt: 9.2,
            spaceAfterPt: 0,
          },
        ],
      })
    );
  }

  // --- TOP RIGHT: STEP 1 FLOOD & STARVE FEATURED CARD (y: 1.05 .. 3.04 in) ---
  addShadowCard(
    doc,
    makeRectPx(col2X, 1.05, COL_W_IN, 1.99, ox, oy),
    PALETTE.neutralCream,
    PALETTE.neutralDark,
    0.85,
    PALETTE.neutralAccent,
    2.5,
    0,
    ShapeCornerType.None,
    'p2_flood_card'
  );
  addRectShape(
    doc,
    makeRectPx(col2X, 1.05, 0.06, 1.99, ox, oy),
    PALETTE.neutralAccent,
    null,
    0,
    'p2_flood_bar',
    0
  );

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_col2_flood_starve',
      pageNum: 2,
      rect: makeRectPx(col2X + 0.11, 1.12, COL_W_IN - 0.18, 1.32, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'h2',
          text: 'Step 1: Flood & Starve',
          fontPt: 9.0,
          leadingPt: 10.5,
          spaceAfterPt: 3.5,
        },
        {
          kind: 'body',
          text: '**1. Flood** *(Palette + Setting)*: 1–2 cheap, abundant DOSE needs *(Neon Future: Endorphins, Dopamine)*.',
          fontPt: 7.75,
          leadingPt: 9.4,
          leftIndentPt: 8,
          firstIndentPt: -8,
          spaceAfterPt: 4.0,
        },
        {
          kind: 'body',
          text: '**2. Starve** *(Tone)*: Rationed or corrupted DOSE need *(Punk: Serotonin, Oxytocin)*.',
          fontPt: 7.75,
          leadingPt: 9.4,
          leftIndentPt: 8,
          firstIndentPt: -8,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Dark reverse CORE LOOP bar inside Flood & Starve card
  addRectShape(
    doc,
    makeRectPx(col2X + 0.11, 2.48, COL_W_IN - 0.18, 0.48, ox, oy),
    PALETTE.neutralDark,
    PALETTE.neutralGold,
    0.85,
    'p2_core_loop_bg',
    2,
    ShapeCornerType.Round
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_core_loop_text',
      pageNum: 2,
      rect: makeRectPx(col2X + 0.17, 2.535, COL_W_IN - 0.30, 0.40, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: '**CORE LOOP:** Hustle the *Flood* to survive; risk everything for the *Starve*.',
          fontPt: 7.75,
          leadingPt: 9.3,
          colour: PALETTE.white,
          boldColour: PALETTE.neutralGold,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // --- MIDDLE: STEP 2 SPAGHETTI KNOT & PASS 1 IDENTITY TABLE (y: 3.20 .. 5.76 in) ---
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_spaghetti_intro',
      pageNum: 2,
      rect: makeRectPx(MARGIN_IN, 3.20, CONTENT_W_IN, 0.56, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'h2',
          text: 'Step 2: Session Zero "Spaghetti Knot"',
          fontPt: 9.5,
          leadingPt: 11.0,
          spaceAfterPt: 2.0,
        },
        {
          kind: 'body',
          text: 'Center your Pitch + Undertow on a blank sheet; run 3 passes. **Pass 1:** Place a **Rectangle (PC Name)** on the edge; answer your 3 Dial prompts:',
          fontPt: 8.0,
          leadingPt: 9.8,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  results.push(
    ...buildPrecisionTable(doc, styles, {
      idPrefix: 'p2_id_table',
      pageNum: 2,
      originX: ox,
      originY: oy,
      xIn: MARGIN_IN,
      yIn: 3.78,
      colWidthsIn: [0.30, 1.45, 1.46, 1.45],
      headerHeightIn: 0.24,
      headerFontPt: 6.5,
      rowHeightsIn: [0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22],
      cellFontPt: 7.4,
      cellLeadPt: 8.5,
      padHIn: 0.055,
      padVIn: 0.032,
      headers: [
        'd8',
        'Palette (Texture)',
        'Setting (Place / Craft)',
        'Tone (Hook)',
      ],
      rows: [
        ['1', '**Warped** *(Prismatic)*', '**Crossed Over** *(Threshold)*', '**Obsession** *(Weird)*'],
        ['2', '**Vice** *(Neon)*', '**Augment** *(Future)*', '**Grievance** *(Punk)*'],
        ['3', '**Pedigree** *(Chrome)*', '**Hull / World** *(Space)*', '**Horizon** *(Adventure)*'],
        ['4', '**Secret** *(Dark)*', '**Day Job** *(Modern)*', '**Code** *(Noir)*'],
        ['5', '**Relic** *(Sepia)*', '**Trade** *(Industrial)*', '**Trademark** *(Pulp)*'],
        ['6', '**Banner** *(Bright)*', '**Calling** *(Mythic)*', '**Oath** *(Heroic)*'],
        ['7', '**Comfort** *(Pastel)*', '**Workshop** *(Hearth)*', '**Routine** *(Cozy)*'],
        ['8', '**Scar** *(Rust)*', '**Pack / Kin** *(Primal)*', '**Liability** *(Peril)*'],
      ],
      theme: 'neutral',
    })
  );

  // --- BOTTOM ZONE: PASS 2 & 3 (COL 1) + SPAGHETTI KNOT SCHEMATIC (COL 2) (y: 5.94 .. 7.90 in) ---
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_pass2_3',
      pageNum: 2,
      rect: makeRectPx(col1X, 5.94, COL_W_IN, 1.96, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'h3',
          text: 'Pass 2: Cross the Wires',
          fontPt: 8.75,
          leadingPt: 10.2,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: '• **Left** *(Credit)*: Declare your left neighbor\'s public credit—and the messy truth.',
          fontPt: 8.0,
          leadingPt: 9.9,
          leftIndentPt: 7,
          firstIndentPt: -7,
          spaceAfterPt: 3.5,
        },
        {
          kind: 'body',
          text: '• **Right** *(Anchor)*: Link right with a shared **Diamond** (*Ride, Hideout, Workshop, Beast, Patron*).',
          fontPt: 8.0,
          leadingPt: 9.9,
          leftIndentPt: 7,
          firstIndentPt: -7,
          spaceAfterPt: 7.0,
        },
        {
          kind: 'h3',
          text: 'Pass 3: Ignition Triangle',
          fontPt: 8.75,
          leadingPt: 10.2,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: 'GM drops a central **Triangle (Situation)** tied to the *Starve*, wired to 2+ nodes. Start *in medias res*.',
          fontPt: 8.0,
          leadingPt: 9.9,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Col 2: Vector Spaghetti-Knot Map Schematic Card (y: 5.94 .. 7.90 in)
  addShadowCard(
    doc,
    makeRectPx(col2X, 5.94, COL_W_IN, 1.96, ox, oy),
    PALETTE.neutralCream,
    PALETTE.neutralDark,
    0.85,
    PALETTE.neutralShadow,
    2.5,
    0,
    ShapeCornerType.None,
    'p2_diagram_card'
  );
  addRectShape(
    doc,
    makeRectPx(col2X, 5.94, COL_W_IN, 0.22, ox, oy),
    PALETTE.neutralDark,
    null,
    0,
    'p2_diagram_hdr_bg',
    0
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_diagram_hdr_txt',
      pageNum: 2,
      rect: makeRectPx(col2X + 0.08, 5.98, COL_W_IN - 0.16, 0.15, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'SPAGHETTI-KNOT MAP SCHEMATIC',
          forceFontKey: 'displayBold',
          fontPt: 7.25,
          leadingPt: 8.5,
          trackingEm: 0.05,
          caps: CapsType.AllCaps,
          colour: PALETTE.neutralGold,
          align: ParagraphAlignXType.Centre,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Diagram node coordinates inside col2X..col2X+2.23, y: 6.22..7.56
  const pcAx = col2X + 0.38;
  const pcAy = 6.42;
  const pcBx = col2X + 1.79;
  const pcBy = 6.42;
  const pcCx = col2X + 1.115;
  const pcCy = 7.38;
  const ancX = col2X + 1.66;
  const ancY = 6.96;
  const triX = col2X + 1.16;
  const triY = 6.86;

  // Wire lines FIRST (behind shapes)
  // Credit line PC A <-> PC B
  addLineSegment(
    doc,
    ox + pcAx * IN,
    oy + pcAy * IN,
    ox + pcBx * IN,
    oy + pcBy * IN,
    DIAL_SWATCHES[2].bg,
    1.1,
    'p2_diag_wire_credit_top'
  );
  // Credit line PC A <-> PC C
  addLineSegment(
    doc,
    ox + pcAx * IN,
    oy + pcAy * IN,
    ox + pcCx * IN,
    oy + pcCy * IN,
    DIAL_SWATCHES[2].bg,
    1.1,
    'p2_diag_wire_credit_left'
  );
  // Shared Anchor wire PC B -> Anchor -> PC C
  addLineSegment(
    doc,
    ox + pcBx * IN,
    oy + pcBy * IN,
    ox + ancX * IN,
    oy + ancY * IN,
    PALETTE.neutralGoldText,
    1.25,
    'p2_diag_wire_anchor_1'
  );
  addLineSegment(
    doc,
    ox + ancX * IN,
    oy + ancY * IN,
    ox + pcCx * IN,
    oy + pcCy * IN,
    PALETTE.neutralGoldText,
    1.25,
    'p2_diag_wire_anchor_2'
  );
  // Ignition wires (vermilion) from center Triangle to PC A and Anchor
  addLineSegment(
    doc,
    ox + triX * IN,
    oy + triY * IN,
    ox + pcAx * IN,
    oy + pcAy * IN,
    PALETTE.neutralAccent,
    1.4,
    'p2_diag_wire_ign_1'
  );
  addLineSegment(
    doc,
    ox + triX * IN,
    oy + triY * IN,
    ox + ancX * IN,
    oy + ancY * IN,
    PALETTE.neutralAccent,
    1.4,
    'p2_diag_wire_ign_2'
  );

  // PC Rectangles (A, B, C)
  const pcNodes = [
    { x: pcAx, y: pcAy, label: 'PC A' },
    { x: pcBx, y: pcBy, label: 'PC B' },
    { x: pcCx, y: pcCy, label: 'PC C' },
  ];
  for (let i = 0; i < pcNodes.length; i++) {
    const pn = pcNodes[i];
    const pw = 0.50;
    const ph = 0.22;
    addRectShape(
      doc,
      makeRectPx(pn.x - pw / 2, pn.y - ph / 2, pw, ph, ox, oy),
      PALETTE.white,
      PALETTE.neutralDark,
      1.0,
      `p2_diag_pc_${i}`,
      1.5,
      ShapeCornerType.Round
    );
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p2_diag_pc_txt_${i}`,
        pageNum: 2,
        rect: makeRectPx(pn.x - pw / 2, pn.y - 0.065, pw, 0.14, ox, oy),
        theme: 'neutral',
        ignoreBaselineGrid: true,
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: pn.label,
            forceFontKey: 'displayBold',
            fontPt: 6.75,
            leadingPt: 8.0,
            colour: PALETTE.neutralDark,
            align: ParagraphAlignXType.Centre,
            spaceAfterPt: 0,
          },
        ],
      })
    );
  }

  // Shared Anchor Diamond
  const dDef = ShapeNodeDefinition.createDefault();
  dDef.setShape(ShapeDiamond.create());
  dDef.setBoundingRectangle(makeRectPx(ancX - 0.13, ancY - 0.13, 0.26, 0.26, ox, oy));
  dDef.addBrushFillDescriptor(FillDescriptor.createSolid(PALETTE.neutralGold, BlendMode.Normal));
  dDef.addLineDescriptors(
    FillDescriptor.createSolid(PALETTE.neutralDark, BlendMode.Normal),
    LineStyleDescriptor.createDefault(1.0 * PT)
  );
  dDef.userDescription = 'p2_diag_anchor_diamond';
  doc.addNode(dDef);

  // Central Ignition Triangle
  const tDef = ShapeNodeDefinition.createDefault();
  tDef.setShape(ShapeTriangle.create());
  tDef.setBoundingRectangle(makeRectPx(triX - 0.15, triY - 0.14, 0.30, 0.26, ox, oy));
  tDef.addBrushFillDescriptor(FillDescriptor.createSolid(PALETTE.neutralAccent, BlendMode.Normal));
  tDef.addLineDescriptors(
    FillDescriptor.createSolid(PALETTE.neutralDark, BlendMode.Normal),
    LineStyleDescriptor.createDefault(1.0 * PT)
  );
  tDef.userDescription = 'p2_diag_ignition_tri';
  doc.addNode(tDef);

  // Diagram inline micro-labels with clean halo pills so wires never cut through text
  addRectShape(
    doc,
    makeRectPx(col2X + 0.84, 6.235, 0.54, 0.13, ox, oy),
    PALETTE.neutralCream,
    null,
    0,
    'p2_diag_lbl_credit_bg',
    0
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_diag_lbl_credit',
      pageNum: 2,
      rect: makeRectPx(col2X + 0.84, 6.245, 0.54, 0.12, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'CREDIT',
          forceFontKey: 'displayBold',
          fontPt: 6.0,
          leadingPt: 7.0,
          trackingEm: 0.05,
          colour: DIAL_SWATCHES[2].text,
          align: ParagraphAlignXType.Centre,
          spaceAfterPt: 0,
        },
      ],
    })
  );
  addRectShape(
    doc,
    makeRectPx(triX - 0.19, triY + 0.135, 0.38, 0.13, ox, oy),
    PALETTE.neutralCream,
    null,
    0,
    'p2_diag_lbl_starve_bg',
    0
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_diag_lbl_starve',
      pageNum: 2,
      rect: makeRectPx(triX - 0.19, triY + 0.145, 0.38, 0.12, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'STARVE',
          forceFontKey: 'displayHeavy',
          fontPt: 6.0,
          leadingPt: 7.0,
          trackingEm: 0.05,
          colour: PALETTE.neutralAccent,
          align: ParagraphAlignXType.Centre,
          spaceAfterPt: 0,
        },
      ],
    })
  );
  addRectShape(
    doc,
    makeRectPx(ancX - 0.10, ancY + 0.14, 0.56, 0.13, ox, oy),
    PALETTE.neutralCream,
    null,
    0,
    'p2_diag_lbl_anchor_bg',
    0
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p2_diag_lbl_anchor',
      pageNum: 2,
      rect: makeRectPx(ancX - 0.10, ancY + 0.15, 0.56, 0.12, ox, oy),
      theme: 'neutral',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'ANCHOR',
          forceFontKey: 'displayBold',
          fontPt: 6.0,
          leadingPt: 7.0,
          trackingEm: 0.05,
          colour: PALETTE.neutralGoldText,
          align: ParagraphAlignXType.Centre,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Compact bottom Legend strip inside schematic card (y: 7.58 .. 7.86 in)
  addLineSegment(
    doc,
    ox + (col2X + 0.10) * IN,
    oy + 7.57 * IN,
    ox + (col2X + COL_W_IN - 0.10) * IN,
    oy + 7.57 * IN,
    PALETTE.neutralBorder,
    0.55,
    'p2_diag_legend_rule'
  );
  const legW = COL_W_IN / 3;
  // Legend icon 0: PC Rect
  addRectShape(
    doc,
    makeRectPx(col2X + legW * 0.5 - 0.09, 7.62, 0.18, 0.10, ox, oy),
    PALETTE.white,
    PALETTE.neutralDark,
    0.85,
    'p2_leg_rect',
    0
  );
  // Legend icon 1: Diamond
  const ldDef = ShapeNodeDefinition.createDefault();
  ldDef.setShape(ShapeDiamond.create());
  ldDef.setBoundingRectangle(makeRectPx(col2X + legW * 1.5 - 0.065, 7.605, 0.13, 0.13, ox, oy));
  ldDef.addBrushFillDescriptor(FillDescriptor.createSolid(PALETTE.neutralGold, BlendMode.Normal));
  ldDef.addLineDescriptors(
    FillDescriptor.createSolid(PALETTE.neutralDark, BlendMode.Normal),
    LineStyleDescriptor.createDefault(0.8 * PT)
  );
  ldDef.userDescription = 'p2_leg_diamond';
  doc.addNode(ldDef);
  // Legend icon 2: Triangle
  const ltDef = ShapeNodeDefinition.createDefault();
  ltDef.setShape(ShapeTriangle.create());
  ltDef.setBoundingRectangle(makeRectPx(col2X + legW * 2.5 - 0.07, 7.605, 0.14, 0.13, ox, oy));
  ltDef.addBrushFillDescriptor(FillDescriptor.createSolid(PALETTE.neutralAccent, BlendMode.Normal));
  ltDef.addLineDescriptors(
    FillDescriptor.createSolid(PALETTE.neutralDark, BlendMode.Normal),
    LineStyleDescriptor.createDefault(0.8 * PT)
  );
  ltDef.userDescription = 'p2_leg_tri';
  doc.addNode(ltDef);

  const legLabels = ['PC Name', 'Anchor', 'Ignition'];
  for (let i = 0; i < 3; i++) {
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p2_leg_txt_${i}`,
        pageNum: 2,
        rect: makeRectPx(col2X + i * legW, 7.75, legW, 0.12, ox, oy),
        theme: 'neutral',
        ignoreBaselineGrid: true,
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: `**${legLabels[i]}**`,
            fontPt: 6.25,
            leadingPt: 7.2,
            colour: PALETTE.neutralDark,
            align: ParagraphAlignXType.Centre,
            spaceAfterPt: 0,
          },
        ],
      })
    );
  }

  return results;
}

function buildPage3(doc, styles, ox, oy) {
  const results = [];
  const col1X = MARGIN_IN;
  const col2X = MARGIN_IN + COL_W_IN + GUTTER_IN;

  results.push(
    ...addChamferedBanner(
      doc,
      styles,
      3,
      ox,
      oy,
      'cortex',
      '03 · OPINIONATED CORTEX HARNESS',
      'CORE ENGINE'
    )
  );

  // Full-width intro line (y: 0.76 .. 0.94 in)
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p3_intro',
      pageNum: 3,
      rect: makeRectPx(MARGIN_IN, 0.76, CONTENT_W_IN, 0.18, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: 'Compile any `4d8` pitch into fast **Cortex Prime** on a clean 3-Prime-Set sheet.',
          fontPt: 8.25,
          leadingPt: 9.8,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // --- FULL-WIDTH 3-PRIME EQUATION HERO CARD (y: 0.98 .. 1.78 in, h: 0.80 in) ---
  addShadowCard(
    doc,
    makeRectPx(MARGIN_IN, 0.98, CONTENT_W_IN, 0.80, ox, oy),
    PALETTE.cortexDark,
    PALETTE.cortexCyan,
    0.85,
    PALETTE.cortexCyan,
    2.5,
    3,
    ShapeCornerType.Round,
    'p3_eq_card'
  );

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p3_eq_kicker',
      pageNum: 3,
      rect: makeRectPx(MARGIN_IN + 0.12, 1.03, CONTENT_W_IN - 0.24, 0.14, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'body',
          text: 'BASELINE POOL EQUATION   ·   + ASSETS, RESOURCES, FOE FALLOUT',
          forceFontKey: 'displayBold',
          fontPt: 6.25,
          leadingPt: 7.5,
          trackingEm: 0.06,
          caps: CapsType.AllCaps,
          colour: PALETTE.cortexCyan,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Three Prime Pills (left half) + Arrow + Three Output Pills (right half)
  const primePills = [
    { x: MARGIN_IN + 0.09, w: 0.76, label: '1 · DISTINCTION', sub: 'd8 / d4', border: PALETTE.cortexMagenta },
    { x: MARGIN_IN + 0.95, w: 0.64, label: '2 · SETTING', sub: 'Prime 2', border: PALETTE.cortexCyan },
    { x: MARGIN_IN + 1.69, w: 0.58, label: '3 · TONE', sub: 'Prime 3', border: PALETTE.cortexCyan },
  ];
  for (let i = 0; i < primePills.length; i++) {
    const pp = primePills[i];
    addRectShape(
      doc,
      makeRectPx(pp.x, 1.21, pp.w, 0.45, ox, oy),
      PALETTE.cortexDarkPillBg,
      pp.border,
      0.9,
      `p3_eq_prime_${i}`,
      2.5,
      ShapeCornerType.Round
    );
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p3_eq_prime_txt_${i}`,
        pageNum: 3,
        rect: makeRectPx(pp.x + 0.02, 1.255, pp.w - 0.04, 0.37, ox, oy),
        theme: 'cortex',
        ignoreBaselineGrid: true,
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: pp.label,
            forceFontKey: 'displayBold',
            fontPt: 6.0,
            leadingPt: 7.2,
            caps: CapsType.AllCaps,
            colour: PALETTE.white,
            align: ParagraphAlignXType.Centre,
            spaceAfterPt: 1.5,
          },
          {
            kind: 'body',
            text: pp.sub,
            forceFontKey: 'monoBold',
            fontPt: 6.75,
            leadingPt: 8.0,
            colour: pp.border,
            align: ParagraphAlignXType.Centre,
            spaceAfterPt: 0,
          },
        ],
      })
    );
  }

  // "+" separators and "→" separator
  const sepMarks = [
    { x: MARGIN_IN + 0.85, w: 0.10, txt: '+', col: PALETTE.white },
    { x: MARGIN_IN + 1.59, w: 0.10, txt: '+', col: PALETTE.white },
    { x: MARGIN_IN + 2.28, w: 0.20, txt: '→', col: PALETTE.cortexCyan },
  ];
  for (let i = 0; i < sepMarks.length; i++) {
    const sm = sepMarks[i];
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p3_eq_sep_${i}`,
        pageNum: 3,
        rect: makeRectPx(sm.x, 1.33, sm.w, 0.20, ox, oy),
        theme: 'cortex',
        ignoreBaselineGrid: true,
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: sm.txt,
            forceFontKey: 'displayHeavy',
            fontPt: 10.0,
            leadingPt: 11.0,
            colour: sm.col,
            align: ParagraphAlignXType.Centre,
            spaceAfterPt: 0,
          },
        ],
      })
    );
  }

  const outPills = [
    { x: MARGIN_IN + 2.49, w: 0.62, top: '1s', bot: 'OPENINGS', fill: PALETTE.cortexMagenta },
    { x: MARGIN_IN + 3.16, w: 0.54, top: 'SUM 2', bot: 'TOTAL', fill: PALETTE.cortexCyan },
    { x: MARGIN_IN + 3.75, w: 0.82, top: '1 DIE SIZE', bot: 'IMPACT d6–d12', fill: PALETTE.cortexCyan },
  ];
  for (let i = 0; i < outPills.length; i++) {
    const op = outPills[i];
    addRectShape(
      doc,
      makeRectPx(op.x, 1.21, op.w, 0.45, ox, oy),
      op.fill,
      null,
      0,
      `p3_eq_out_${i}`,
      2.5,
      ShapeCornerType.Round
    );
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p3_eq_out_txt_${i}`,
        pageNum: 3,
        rect: makeRectPx(op.x + 0.02, 1.265, op.w - 0.04, 0.35, ox, oy),
        theme: 'cortex',
        ignoreBaselineGrid: true,
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: op.top,
            forceFontKey: 'displayHeavy',
            fontPt: 7.0,
            leadingPt: 8.2,
            caps: CapsType.None,
            colour: i === 0 ? PALETTE.white : PALETTE.cortexDark,
            align: ParagraphAlignXType.Centre,
            spaceAfterPt: 2.0,
          },
          {
            kind: 'body',
            text: op.bot,
            forceFontKey: 'displayBold',
            fontPt: 5.5,
            leadingPt: 6.8,
            caps: CapsType.None,
            colour: i === 0 ? PALETTE.white : PALETTE.cortexDark,
            align: ParagraphAlignXType.Centre,
            spaceAfterPt: 0,
          },
        ],
      })
    );
  }

  // --- LEFT COLUMN (y: 1.96 .. 6.92 in) ---
  // Openings (Hitches) Box (y: 1.96 .. 2.86 in, h: 0.90 in)
  addRectShape(
    doc,
    makeRectPx(col1X, 1.96, COL_W_IN, 0.90, ox, oy),
    PALETTE.cortexPinkTint,
    PALETTE.cortexMagenta,
    0.75,
    'p3_openings_bg',
    0
  );
  addRectShape(
    doc,
    makeRectPx(col1X, 1.96, 0.055, 0.90, ox, oy),
    PALETTE.cortexMagenta,
    null,
    0,
    'p3_openings_bar',
    0
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p3_openings_text',
      pageNum: 3,
      rect: makeRectPx(col1X + 0.11, 2.02, COL_W_IN - 0.17, 0.80, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'h3',
          text: 'Openings (Hitches)',
          fontPt: 8.5,
          leadingPt: 9.8,
          colour: PALETTE.cortexMagentaDark,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: 'Set `1`s aside (not Total/Impact). Foes—or PCs with `1 Chip`—seize one for `d6` Fallout, a step-up, or an edge. GM pays `1 Chip` to seize yours.',
          fontPt: 7.85,
          leadingPt: 9.6,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Three Conflict Speeds Header (y: 3.14 .. 3.34 in)
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p3_speeds_h2',
      pageNum: 3,
      rect: makeRectPx(col1X, 3.14, COL_W_IN, 0.20, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'h2',
          text: 'Three Conflict Speeds',
          fontPt: 9.25,
          leadingPt: 10.5,
          spaceAfterPt: 0,
        },
      ],
    })
  );
  addLineSegment(
    doc,
    ox + col1X * IN,
    oy + 3.33 * IN,
    ox + (col1X + COL_W_IN) * IN,
    oy + 3.33 * IN,
    PALETTE.cortexCyan,
    1.5,
    'p3_speeds_rule'
  );

  // 3 Stacked Snug Speed Cards (y: 3.46 .. 6.92 in, 0.22 in open gaps)
  const speedCards = [
    {
      num: '01',
      title: 'ROLL · SINGLE TEST',
      y: 3.46,
      h: 0.88,
      accent: PALETTE.cortexCyan,
      body: 'One toss vs. GM (`2d6` + traits, or Doom Pool). High Total wins; **instigator wins ties**.',
    },
    {
      num: '02',
      title: 'ROW · ESCALATING CONTEST',
      y: 4.56,
      h: 1.02,
      accent: PALETTE.cortexMagenta,
      body: 'Beat the lead Total to take control, or **Concede** on your terms (`+1 Chip`). Failing inflicts winner\'s Impact as Fallout.',
    },
    {
      num: '03',
      title: 'ROMP · MULTI-DIE CHALLENGE',
      y: 5.80,
      h: 1.12,
      accent: PALETTE.cortexCyan,
      body: 'Roll vs. central **Romp Pool** (`4d8`). Win + Impact **>** Romp die drops it; **≤** steps down smallest (`d4` gone). Romp acts last.',
    },
  ];
  for (let i = 0; i < speedCards.length; i++) {
    const sc = speedCards[i];
    addShadowCard(
      doc,
      makeRectPx(col1X, sc.y, COL_W_IN, sc.h, ox, oy),
      PALETTE.cortexIce,
      PALETTE.cortexBorder,
      0.75,
      sc.accent,
      2.0,
      2.5,
      ShapeCornerType.Round,
      `p3_speed_card_${i + 1}`
    );
    addRectShape(
      doc,
      makeRectPx(col1X + 0.08, sc.y + 0.09, 0.25, 0.18, ox, oy),
      sc.accent,
      null,
      0,
      `p3_speed_badge_${i + 1}`,
      2,
      ShapeCornerType.Round
    );
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p3_speed_num_${i + 1}`,
        pageNum: 3,
        rect: makeRectPx(col1X + 0.08, sc.y + 0.115, 0.25, 0.14, ox, oy),
        theme: 'cortex',
        ignoreBaselineGrid: true,
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: sc.num,
            forceFontKey: 'displayHeavy',
            fontPt: 7.25,
            leadingPt: 8.5,
            colour: sc.accent === PALETTE.cortexMagenta ? PALETTE.white : PALETTE.cortexDark,
            align: ParagraphAlignXType.Centre,
            spaceAfterPt: 0,
          },
        ],
      })
    );
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p3_speed_title_${i + 1}`,
        pageNum: 3,
        rect: makeRectPx(col1X + 0.39, sc.y + 0.11, COL_W_IN - 0.47, 0.16, ox, oy),
        theme: 'cortex',
        ignoreBaselineGrid: true,
        allowAutoTighten: false,
        blocks: [
          {
            kind: 'body',
            text: sc.title,
            forceFontKey: 'displayBold',
            fontPt: 8.0,
            leadingPt: 9.5,
            trackingEm: 0.03,
            caps: CapsType.AllCaps,
            colour: PALETTE.cortexDark,
            spaceAfterPt: 0,
          },
        ],
      })
    );
    results.push(
      createTextFrameWithAutoFit(doc, styles, {
        id: `p3_speed_body_${i + 1}`,
        pageNum: 3,
        rect: makeRectPx(col1X + 0.10, sc.y + 0.34, COL_W_IN - 0.20, sc.h - 0.40, ox, oy),
        theme: 'cortex',
        ignoreBaselineGrid: true,
        blocks: [
          {
            kind: 'body',
            text: sc.body,
            fontPt: 8.25,
            leadingPt: 10.3,
            spaceAfterPt: 0,
          },
        ],
      })
    );
  }

  // --- RIGHT COLUMN: FOUR HOUSE CUTS + UNIVERSAL PRIME SET 1 (y: 1.94 .. 7.71 in) ---
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p3_cuts_h2',
      pageNum: 3,
      rect: makeRectPx(col2X, 1.94, COL_W_IN, 0.20, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      allowAutoTighten: false,
      blocks: [
        {
          kind: 'h2',
          text: 'Four House Cuts',
          fontPt: 9.25,
          leadingPt: 10.5,
          spaceAfterPt: 0,
        },
      ],
    })
  );
  addLineSegment(
    doc,
    ox + col2X * IN,
    oy + 2.13 * IN,
    ox + (col2X + COL_W_IN) * IN,
    oy + 2.13 * IN,
    PALETTE.cortexMagenta,
    1.5,
    'p3_cuts_rule'
  );

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p3_col2_cuts',
      pageNum: 3,
      rect: makeRectPx(col2X, 2.24, COL_W_IN, 2.68, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: '• **Full-Force Hits:** Never compare Impact vs. loser\'s Effect Die. Win Total, land full Impact.',
          fontPt: 8.35,
          leadingPt: 10.5,
          leadColour: PALETTE.cortexCyanDark,
          leftIndentPt: 8,
          firstIndentPt: -8,
          spaceAfterPt: 10.0,
        },
        {
          kind: 'body',
          text: '• **Real Fallout Only:** Starts at `d6` (no `d4` Chip-farming). Past `d12` drops out of frame.',
          fontPt: 8.35,
          leadingPt: 10.5,
          leadColour: PALETTE.cortexMagentaDark,
          leftIndentPt: 8,
          firstIndentPt: -8,
          spaceAfterPt: 10.0,
        },
        {
          kind: 'body',
          text: '• **In-Pool Resources:** Roll inside pool to **keep +1 Total die**, then expend until recovery.',
          fontPt: 8.35,
          leadingPt: 10.5,
          leadColour: PALETTE.cortexCyanDark,
          leftIndentPt: 8,
          firstIndentPt: -8,
          spaceAfterPt: 10.0,
        },
        {
          kind: 'body',
          text: '• **Side Chars** *(Session 0)*: Shared Diamonds hold 2–3 `d8` traits; swap up to 2 and absorb fitting Fallout.',
          fontPt: 8.35,
          leadingPt: 10.5,
          leadColour: PALETTE.cortexMagentaDark,
          leftIndentPt: 8,
          firstIndentPt: -8,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Prime Set 1: Categorical Distinctions Featured Card (y: 4.90 .. 6.92 in, h: 2.02 in)
  addShadowCard(
    doc,
    makeRectPx(col2X, 4.90, COL_W_IN, 2.02, ox, oy),
    PALETTE.cortexPinkTint,
    PALETTE.cortexDark,
    0.85,
    PALETTE.cortexMagenta,
    2.5,
    0,
    ShapeCornerType.None,
    'p3_prime1_card'
  );
  addRectShape(
    doc,
    makeRectPx(col2X, 4.90, 0.06, 2.02, ox, oy),
    PALETTE.cortexMagenta,
    null,
    0,
    'p3_prime1_bar',
    0
  );

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p3_col2_prime1',
      pageNum: 3,
      rect: makeRectPx(col2X + 0.12, 5.02, COL_W_IN - 0.20, 0.90, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'h2',
          text: 'Prime Set 1: Distinctions',
          fontPt: 9.25,
          leadingPt: 10.8,
          spaceAfterPt: 5.5,
        },
        {
          kind: 'body',
          text: 'Write **three** `d8` **Distinctions** titled after your world\'s **Page 2 Identity Prompts** (*Texture · Place · Hook*).',
          fontPt: 8.35,
          leadingPt: 10.6,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Dark Hinder bar at bottom of Prime Set 1 card (y: 6.04 .. 6.78 in)
  addRectShape(
    doc,
    makeRectPx(col2X + 0.12, 6.04, COL_W_IN - 0.20, 0.74, ox, oy),
    PALETTE.cortexDark,
    PALETTE.cortexMagenta,
    0.85,
    'p3_hinder_bg',
    2,
    ShapeCornerType.Round
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p3_hinder_text',
      pageNum: 3,
      rect: makeRectPx(col2X + 0.18, 6.12, COL_W_IN - 0.32, 0.60, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'h3',
          text: 'UNIVERSAL HINDER RULE',
          fontPt: 7.25,
          leadingPt: 8.5,
          colour: PALETTE.cortexMagenta,
          spaceAfterPt: 3.0,
        },
        {
          kind: 'body',
          text: 'Roll any Distinction as `d4` instead of `d8` to gain `1 Chip`.',
          fontPt: 8.1,
          leadingPt: 10.0,
          colour: PALETTE.white,
          pillBg: PALETTE.cortexDarkPillBg,
          pillInk: PALETTE.cortexCyan,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  return results;
}

function buildPage4(doc, styles, ox, oy) {
  const results = [];
  const col1X = MARGIN_IN;
  const col2X = MARGIN_IN + COL_W_IN + GUTTER_IN;

  results.push(
    ...addChamferedBanner(
      doc,
      styles,
      4,
      ox,
      oy,
      'cortex',
      '04 · CORTEX DIAL COMPILER',
      'SHEET & MODS'
    )
  );

  // Full-width Undertow + Intro strip (y: 0.75 .. 1.13 in, h: 0.38 in)
  addRectShape(
    doc,
    makeRectPx(MARGIN_IN, 0.75, CONTENT_W_IN, 0.38, ox, oy),
    PALETTE.cortexIce,
    PALETTE.cortexRule,
    0.75,
    'p4_intro_bg',
    0
  );
  addRectShape(
    doc,
    makeRectPx(MARGIN_IN, 0.75, 0.055, 0.19, ox, oy),
    PALETTE.cortexCyan,
    null,
    0,
    'p4_intro_bar_top',
    0
  );
  addRectShape(
    doc,
    makeRectPx(MARGIN_IN, 0.94, 0.055, 0.19, ox, oy),
    PALETTE.cortexMagenta,
    null,
    0,
    'p4_intro_bar_bot',
    0
  );
  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p4_intro',
      pageNum: 4,
      rect: makeRectPx(MARGIN_IN + 0.11, 0.79, CONTENT_W_IN - 0.17, 0.31, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: 'Match 3 Dials for **Engine Mod**, **Prime Set 2**, **Prime Set 3**. **Undertow (4th Die):** Gain 1 shared `d8` Side Char / Special, OR apply its Engine Mod in contrast scenes.',
          fontPt: 7.75,
          leadingPt: 9.2,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // --- COLUMN 1: 1. PALETTE + 2. SETTING (uniform 7.75/9.2 across BOTH columns!) ---
  results.push(
    addSectionHeaderBar(
      doc,
      styles,
      4,
      col1X,
      1.21,
      COL_W_IN,
      ox,
      oy,
      '1 · PALETTE → ENGINE MOD',
      PALETTE.cortexCyan,
      'cortex',
      'p4_s1_hdr'
    )
  );

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p4_col1_palette',
      pageNum: 4,
      rect: makeRectPx(col1X, 1.46, COL_W_IN, 3.24, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: '**1. Prismatic** *(Bleed)*: Uncanny frames: `1`s & `2`s = Openings; `1 Chip` renames Highlight or Fallout.',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[0].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: '**2. Neon** *(Burnout)*: Highlights expire in 1 roll (`1 Chip` sustains). **Lean In:** roll own Fallout, then step up.',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[1].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: '**3. Chrome** *(Spec Sheet)*: Two `d8` **Signature Assets** (*Gear Limit:* shut down for frame → `+1 Chip`).',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[2].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: '**4. Dark** *(Doom Pool)*: Escalating `d8, d6, d4` GM pool replaces static difficulty; grows on Openings, buys twists/Romps.',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[3].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: '**5. Sepia** *(Living Serial)*: Log **Session Titles**; 1/session invoke for free Chip or **Flashback**; cross off to advance.',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[4].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: '**6. Bright** *(Open Table)*: **Zero GM Bank** (GM spends go to PCs) + allies share Highlights.',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[5].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: '**7. Pastel** *(Gentle Stakes)*: Fallout steps down in quiet scenes; double GM `1`s = auto-success or step-down.',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[6].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.5,
        },
        {
          kind: 'body',
          text: '**8. Rust** *(Scarcity)*: Two `2d6` **Salvage** dice (+1 Total die, expend). **Stricken:** Fallout > trait keeps 1 Total die.',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[7].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  results.push(
    addSectionHeaderBar(
      doc,
      styles,
      4,
      col1X,
      4.75,
      COL_W_IN,
      ox,
      oy,
      '2 · SETTING → PRIME SET 2',
      PALETTE.cortexCyan,
      'cortex',
      'p4_s2_hdr'
    )
  );

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p4_col1_setting',
      pageNum: 4,
      rect: makeRectPx(col1X, 5.00, COL_W_IN, 2.86, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: '**1. Threshold** — Arenas (`d10, d8, d6`): *Anchor, Transit, Beyond.*',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[0].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.0,
        },
        {
          kind: 'body',
          text: '**2. Future** — Roles (`d10, 2×d8, d6, d4`): *Hacker, Fixer, Operator, Tech, Face.*',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[1].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.0,
        },
        {
          kind: 'body',
          text: '**3. Space** — Arenas (`d10, d8, d6`): *Void, Station, Worlds* + `d8` **Ship** (*Engines, Frame, Systems*).',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[2].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.0,
        },
        {
          kind: 'body',
          text: '**4. Modern** — Roles (`d10, d8, d6`): *Mouth, Mind, Muscle.*',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[3].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.0,
        },
        {
          kind: 'body',
          text: '**5. Industrial** — Guilds (`d10, 2×d8, 3×d6, 2×d4`): *Machinist, Saboteur, Alchemist, Bruiser, Broker, Medic, Scout, Orator.*',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[4].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.0,
        },
        {
          kind: 'body',
          text: '**6. Mythic** — Attributes (`d10, d8, d6`: *Might, Grace, Lore*) + **Calling Special** (`d6` Pressure die).',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[5].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.0,
        },
        {
          kind: 'body',
          text: '**7. Hearth** — Crafts (`d10, 2×d8, 3×d6, 2×d4`: *Mend, Cook, Grow, Travel, Parley, Notice, Tinker, Ward*) + two `d6` Specialties.',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[6].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 2.0,
        },
        {
          kind: 'body',
          text: '**8. Primal** — Arenas (`d10, d8, d6`: *Camp, Wilds, Lair*) + `d8` **Beast/Pack** or **Trophy**.',
          fontPt: 7.75,
          leadingPt: 9.2,
          leadColour: DIAL_SWATCHES[7].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // --- COLUMN 2: 3. TONE + SAMPLE QUICK-COMPILES ---
  results.push(
    addSectionHeaderBar(
      doc,
      styles,
      4,
      col2X,
      1.21,
      COL_W_IN,
      ox,
      oy,
      '3 · TONE → PRIME SET 3',
      PALETTE.cortexMagenta,
      'cortex',
      'p4_s3_hdr'
    )
  );

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p4_col2_tone',
      pageNum: 4,
      rect: makeRectPx(col2X, 1.46, COL_W_IN, 4.18, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'body',
          text: '**1. Weird** — Tether Drives (`d10, d8, 2×d6`: *Reward, Bond, Pride, Thrill*): Anchor statements; **Question** to **triple** die, step down & rewrite.',
          fontPt: 7.75,
          leadingPt: 9.3,
          leadColour: DIAL_SWATCHES[0].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 6.0,
        },
        {
          kind: 'body',
          text: '**2. Punk** — Bloc Stances (`d10, d8, d6` across 3 Factions): Faction stances; **Question** to **triple** die & fracture allegiance.',
          fontPt: 7.75,
          leadingPt: 9.3,
          leadColour: DIAL_SWATCHES[1].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 6.0,
        },
        {
          kind: 'body',
          text: '**3. Adventure** — Horizon Values (`d10, 2×d8, 2×d6, d4`: *Daring, Cleverness, Crew, Wonder, Fortune, Duty*) + 3 **Goals** (`d6, d8, d10`).',
          fontPt: 7.75,
          leadingPt: 9.3,
          leadColour: DIAL_SWATCHES[2].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 6.0,
        },
        {
          kind: 'body',
          text: '**4. Noir** — Compromised Drives (`d10, d8, d6, d4`: *Ambition, Trust, Dignity, Vice*): Statements fracture as the case corrupts.',
          fontPt: 7.75,
          leadingPt: 9.3,
          leadColour: DIAL_SWATCHES[3].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 6.0,
        },
        {
          kind: 'body',
          text: '**5. Pulp** — Action Modes (`d10, d8, d6`: *Solo, Duo, Team*) + **Hero Dice** (win by 5+ to bank foe\'s top die).',
          fontPt: 7.75,
          leadingPt: 9.3,
          leadColour: DIAL_SWATCHES[4].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 6.0,
        },
        {
          kind: 'body',
          text: '**6. Heroic** — Oath Values (`d10, d8, 2×d6`: *Justice, Mercy, Courage, Truth*) + **Moral Support** (step down yours to step up an ally\'s).',
          fontPt: 7.75,
          leadingPt: 9.3,
          leadColour: DIAL_SWATCHES[5].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 6.0,
        },
        {
          kind: 'body',
          text: '**7. Cozy** — Bonds (`d10, 2×d8, rest d6` to PCs/neighbors) + **Team Up** (lend Bond die risk-free).',
          fontPt: 7.75,
          leadingPt: 9.3,
          leadColour: DIAL_SWATCHES[6].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 6.0,
        },
        {
          kind: 'body',
          text: '**8. Peril** — Nerve (`d10, d8, d6`: *Grit, Focus, Trust*) + **Trauma** (Fallout past `d12` leaves `d6` Trauma, needs recovery).',
          fontPt: 7.75,
          leadingPt: 9.3,
          leadColour: DIAL_SWATCHES[7].text,
          leftIndentPt: 6,
          firstIndentPt: -6,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  // Sample Quick-Compiles Featured Hard-Shadow Card (y: 5.72 .. 7.78 in, h: 2.06 in)
  addShadowCard(
    doc,
    makeRectPx(col2X, 5.72, COL_W_IN, 2.06, ox, oy),
    PALETTE.cortexIce,
    PALETTE.cortexDark,
    0.85,
    PALETTE.cortexMagenta,
    2.5,
    0,
    ShapeCornerType.None,
    'p4_quick_compiles_card'
  );
  addRectShape(
    doc,
    makeRectPx(col2X, 5.72, 0.06, 1.03, ox, oy),
    PALETTE.cortexCyan,
    null,
    0,
    'p4_quick_bar_top',
    0
  );
  addRectShape(
    doc,
    makeRectPx(col2X, 6.75, 0.06, 1.03, ox, oy),
    PALETTE.cortexMagenta,
    null,
    0,
    'p4_quick_bar_bot',
    0
  );

  results.push(
    createTextFrameWithAutoFit(doc, styles, {
      id: 'p4_col2_quick_compiles',
      pageNum: 4,
      rect: makeRectPx(col2X + 0.12, 5.81, COL_W_IN - 0.20, 1.90, ox, oy),
      theme: 'cortex',
      ignoreBaselineGrid: true,
      blocks: [
        {
          kind: 'h2',
          text: 'Quick-Compile Examples',
          fontPt: 8.75,
          leadingPt: 10.2,
          spaceAfterPt: 4.0,
        },
        {
          kind: 'body',
          text: '`8·3·2 [+5]` **Rust Space Punk** *(Sepia)*',
          fontPt: 7.75,
          leadingPt: 9.4,
          boldColour: PALETTE.cortexDark,
          spaceAfterPt: 1.5,
        },
        {
          kind: 'body',
          text: '*Sheet:* Distinctions (*Scar / Hull / Grievance*) + Void Arenas & Ship + 3 Bloc Stances.',
          fontPt: 7.45,
          leadingPt: 9.0,
          leftIndentPt: 6,
          firstIndentPt: 0,
          spaceAfterPt: 1.0,
        },
        {
          kind: 'body',
          text: '*Engine:* `2d6` Salvage, Stricken, pre-war Flashbacks.',
          fontPt: 7.45,
          leadingPt: 9.0,
          leftIndentPt: 6,
          firstIndentPt: 0,
          spaceAfterPt: 6.5,
        },
        {
          kind: 'body',
          text: '`6·8·3 [+7]` **Bright Primal Adventure** *(Cozy)*',
          fontPt: 7.75,
          leadingPt: 9.4,
          boldColour: PALETTE.cortexDark,
          spaceAfterPt: 1.5,
        },
        {
          kind: 'body',
          text: '*Sheet:* Distinctions (*Banner / Pack / Horizon*) + Survival Arenas & `d8` Beast + Horizon Values.',
          fontPt: 7.45,
          leadingPt: 9.0,
          leftIndentPt: 6,
          firstIndentPt: 0,
          spaceAfterPt: 1.0,
        },
        {
          kind: 'body',
          text: '*Engine:* Open Table Chips & campfire recovery.',
          fontPt: 7.45,
          leadingPt: 9.0,
          leftIndentPt: 6,
          firstIndentPt: 0,
          spaceAfterPt: 0,
        },
      ],
    })
  );

  return results;
}

// ---------------------------------------------------------------------------
// 7. Full Overset Verification, Ink Telemetry & Export
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
  // Release documents left open by prior runs without blocking. A synchronous close() of a
  // full zine document can stall Affinity for minutes, and closing a dirty document opens a
  // "save changes?" dialog that hangs MCP. Only close saved documents, and only asynchronously.
  for (const existing of Document.all) {
    if (existing.title && existing.title.includes('4d8') && !existing.isDirty) {
      existing.closeAsync(() => {});
    }
  }

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
  try {
    doc.addMasterPages(0, 1, 2);
    doc.addPages(1, true, 2, 1, PageInsertMode.DocumentFlow);

    const bg = BaselineGridOptions.create();
    bg.useBaselineGrid = true;
    bg.relativeTo = BaselineGridRelativeTo.TopMargin;
    bg.start = 0;
    bg.spacing = 10.5 * PT;
    bg.colour = RGBA8(140, 180, 210, 90);
    doc.executeCommand(DocumentCommand.createSetDocumentBaselineGrid(bg));

    const masters = doc.masterSpreads.toArray();
    populateMasterSpread(doc, styles, masters[0], 'neutral');
    populateMasterSpread(doc, styles, masters[1], 'cortex');

    const spreads = doc.spreads.toArray();
    const buildLogs = [];

    // Spread 0: Pages 1 and 2
    setSpreadIfNeeded(doc, spreads[0]);
    const ext0 = spreads[0].getSpreadExtents({
      includeSpread: true,
      includeBleed: false,
      includeChildren: false,
    });
    buildLogs.push(...buildPage1(doc, styles, ext0.x, ext0.y));
    buildLogs.push(...buildPage2(doc, styles, ext0.x + ext0.width / 2, ext0.y));

    // Spread 1: Pages 3 and 4
    setSpreadIfNeeded(doc, spreads[1]);
    const ext1 = spreads[1].getSpreadExtents({
      includeSpread: true,
      includeBleed: false,
      includeChildren: false,
    });
    buildLogs.push(...buildPage3(doc, styles, ext1.x, ext1.y));
    buildLogs.push(...buildPage4(doc, styles, ext1.x + ext1.width / 2, ext1.y));

    setSpreadIfNeeded(doc, spreads[0]);

    const overflowAudit = verifyAllTextFrames(doc);

    const desktop = Application.userDesktopPath;
    const stageDir = desktop + '\\PaletteDesign_Staging';
    fs.createDirectories(stageDir);
    const nativeExt = Application.productPrimaryFileExtension || 'af';
    // Save to a unique, timestamped path each run. Affinity can keep a stale "open in app"
    // registration for a previously closed document path; saving over that path makes
    // saveAsAsync fail with OPEN_IN_APP and makes synchronous saveAs block on an invisible
    // dialog (240 s MCP timeout). A fresh filename never collides with that registration.
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const docPath = stageDir + '\\The_4d8_Setting_Compiler_' + stamp + '.' + nativeExt;
    doc.saveAs(docPath);

    const reviewPdfPath = stageDir + '\\The_4d8_Setting_Compiler_Review_SinglePages.pdf';
    if (fs.exists(reviewPdfPath)) fs.remove(reviewPdfPath);
    const pdfOpts = FileExportOptions.createWithPresetName('PDF (for print)');
    const exportArea = FileExportArea.createForPages('1-4');
    const exportRecs = doc.export(reviewPdfPath, pdfOpts, exportArea, null);

    const tightened = buildLogs
      .filter((b) => b.tightenSteps > 0)
      .map((b) => ({
        id: b.id,
        page: b.page,
        steps: b.tightenSteps,
        fontDeltaPt: b.fontDeltaPt,
        leadDeltaPt: b.leadDeltaPt,
        overflowValue: b.overflowValue,
      }));

    const keyFrames = overflowAudit.frames
      .filter((f) =>
        /^(p1_pill|p1_undertow_body|p1_matrix_r|p2_col2|p2_pass2|p2_dose_body|p3_speed_body|p3_col2_cuts|p3_hinder|p4_intro|p4_col)/.test(
          f.name
        )
      )
      .map((f) => ({ name: f.name, spread: f.spread, inkBottomIn: f.inkBottomIn }));

    const auditSummary = {
      sessionUuid: doc.sessionUuid,
      pageCount: doc.pageCount,
      spreadCount: doc.spreadCount,
      masterCount: masters.length,
      docPath,
      reviewPdfPath,
      exportSuccess: exportRecs.all.map((r) => ({ path: r.path, ok: r.isSuccess, err: r.errorMessage })),
      totalTextFrames: overflowAudit.totalTextFrames,
      overflowCount: overflowAudit.overflowCount,
      tightenedFrames: tightened,
      overflowingFrames: overflowAudit.frames.filter((f) => f.isWarn),
      keyFrameInkBottoms: keyFrames,
    };

    console.log(JSON.stringify(auditSummary));
  } catch (err) {
    // Leave the failed document open for inspection: closing an unsaved document would
    // open a "save changes?" dialog and block MCP.
    throw err;
  }
}

main();
