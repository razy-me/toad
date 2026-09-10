/**
 * src/tools/antiSlopRules.ts
 * Dedicated Anti-AI-Slop Engine & Aesthetic Heuristics Matrix for TOAD DSL.
 *
 * Implements 26 deterministic, mathematical, and AST-driven heuristics based on:
 * - the_seed/rules/anti_ai_slop_donts.yaml
 * - the_seed/rules/anti_ai_slop_heuristics.xml
 * - Modern 2024-2026 AI Design Tropes & Aesthetic Tells
 */

import { LayoutNode, LayoutResult, GradientStyle } from '../parser/math.js';
import { parseColorToRgba, ColorRgba } from '../engine/drawUtils.js';

export type SlopSeverity = 'fatal' | 'warn' | 'notice';
export type SlopDomain = 'layout' | 'typography' | 'color' | 'vectors' | 'assets';

export interface SlopRuleResult {
  code: string;
  domain: SlopDomain;
  name: string;
  severity: SlopSeverity;
  nodeId?: string;
  elementId?: string;
  message: string;
  details?: string;
  help: string;
}

export interface SlopContext {
  layout: LayoutResult;
  allNodes: LayoutNode[];
  textNodes: LayoutNode[];
  bgRgba: ColorRgba;
  canvasWidth: number;
  canvasHeight: number;
  canvasArea: number;
  negativeSpacePercent: number;
}

// ============================================================================
// Color Math & Hue Extraction Helpers
// ============================================================================

export function rgbToHue(r: number, g: number, b: number): number {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(h * 60);
}

export function calculateHueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function getNodeContent(node: LayoutNode): string {
  if (typeof node.content === 'string' && node.content.length > 0) return node.content;
  if (node.textLayout && Array.isArray(node.textLayout.lines) && node.textLayout.lines.length > 0) {
    return node.textLayout.lines.join(' ');
  }
  return '';
}

export function extractFillStringOrStops(fill: string | GradientStyle | undefined): string {
  if (!fill) return '';
  if (typeof fill === 'string') return fill.toLowerCase();
  const stops = fill.stops ? fill.stops.map(s => s.color).join(' ') : '';
  return `${fill.type || ''}-gradient ${stops}`.toLowerCase();
}

// ============================================================================
// 1. Anti-AI Buzzword Corpus (SLOP-WEB-003 / UNI-07)
// Comprehensive English & German Hype Phrasing
// ============================================================================

const SLOP_BUZZWORD_PATTERNS: Array<{ pattern: RegExp; severity: SlopSeverity; label: string }> = [
  // High-severity marketing tropes (fatal when used in main headlines)
  { pattern: /\bsupercharge\s+(your\s+)?(workflow|productivity|growth|team|sales|life)\b/i, severity: 'fatal', label: 'Supercharge Cliché' },
  { pattern: /\bseamless(ly)?\s+(integrate|synergy|scale|transition|collaborate)\b/i, severity: 'fatal', label: 'Seamless Synergy Cliché' },
  { pattern: /\bnext[- ]gen(eration)?\s+(platform|ai|intelligence|experience|solution)\b/i, severity: 'fatal', label: 'Next-Gen Hype' },
  { pattern: /\bunlock\s+(your\s+)?(full\s+)?(potential|power|synergy|productivity|growth)\b/i, severity: 'fatal', label: 'Unlock Potential Cliché' },
  { pattern: /\ball[- ]in[- ]one\s+(ai\s+)?(platform|workspace|solution|tool)\b/i, severity: 'warn', label: 'All-in-One Platform' },
  { pattern: /\bempowering\s+teams?\s+(globally|worldwide|to\s+scale)\b/i, severity: 'warn', label: 'Empowering Teams Fluff' },
  { pattern: /\bgame[- ]changer\b/i, severity: 'warn', label: 'Game-Changer Cliché' },
  { pattern: /\bparadigm\s+shift\b/i, severity: 'warn', label: 'Paradigm Shift Hype' },
  { pattern: /\bworkflow\s+on\s+steroids\b/i, severity: 'fatal', label: 'On Steroids Hype' },
  { pattern: /\bmagic(al)?\s+(experience|ai|transformation)\b/i, severity: 'warn', label: 'Magic AI Cliché' },
  { pattern: /\brevolutionize\s+(the\s+way\s+you|your\s+workflow|everything)\b/i, severity: 'fatal', label: 'Revolutionize Hype' },
  { pattern: /\bfrictionless\s+(experience|integration|adoption)\b/i, severity: 'warn', label: 'Frictionless Hype' },
  { pattern: /\b10x\s+(your\s+)?(speed|growth|productivity|output)\b/i, severity: 'warn', label: '10x Multiplier Cliché' },
  { pattern: /\bhyper[- ]growth\b/i, severity: 'warn', label: 'Hyper-Growth Hype' },
  { pattern: /\breimagine\s+(your\s+)?(work|future|business)\b/i, severity: 'warn', label: 'Reimagine Hype' },
  { pattern: /\bbuilt\s+for\s+the\s+future\s+of\s+work\b/i, severity: 'warn', label: 'Future of Work Cliché' },

  // German AI Buzzword Corpus
  { pattern: /\brevolutioniere(n\s+sie)?\s+(ihren|deinen)\s+(workflow|arbeitsalltag)\b/i, severity: 'fatal', label: 'German "Revolutionize" Cliché' },
  { pattern: /\bnahtlos(e)?\s+(synergie|integration|skalierung)\b/i, severity: 'fatal', label: 'German "Seamless Synergy" Cliché' },
  { pattern: /\bdas\s+nächste\s+level\b/i, severity: 'warn', label: 'Next-Level Buzzword' },
  { pattern: /\bvollautomatisch\s+ohne\s+aufwand\b/i, severity: 'warn', label: 'Zero-Effort Automated Cliché' },
  { pattern: /\bzukunftssicher(e\s+technologie)?\b/i, severity: 'warn', label: 'Future-Proof Buzzword' },
  { pattern: /\bpotenzial(e)?\s+entfesseln\b/i, severity: 'warn', label: 'Unleash Potential Buzzword' }
];

// System emoji pattern (SLOP-CODE-005)
const RAW_EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE0F}\u{200D}]/u;

// AI Sparkle pattern (SLOP-TYPE-010)
const SPARKLE_PATTERN = /[✨✦★✧]/u;

// ============================================================================
// 2. Individual Slop Rule Checks
// ============================================================================

/**
 * SLOP-WEB-001 / UNI-03: Purple Haze Darkmode Syndrome
 * Diffuse radial violet/cyan glows on dark canvas without a light source.
 */
function checkPurpleHaze(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const isDarkCanvas = ctx.bgRgba.r < 35 && ctx.bgRgba.g < 35 && ctx.bgRgba.b < 35;
  if (!isDarkCanvas) return findings;

  for (const node of ctx.allNodes) {
    if (node.type === 'circle' || node.type === 'rect') {
      const fillStr = extractFillStringOrStops(node.fill);
      const isPurpleCyanHaze =
        fillStr.includes('8b5cf6') ||
        fillStr.includes('06b6d4') ||
        fillStr.includes('a855f7') ||
        fillStr.includes('d946ef') ||
        fillStr.includes('7c3aed') ||
        fillStr.includes('6366f1') ||
        fillStr.includes('rgba(139, 92, 246') ||
        fillStr.includes('rgba(6, 182, 212') ||
        fillStr.includes('rgba(168, 85, 247');

      const filterStr = String(node.style?.filter || '');
      const blurMatch = filterStr.match(/blur\(\s*([0-9.]+)(?:px)?\s*\)/i);
      const blurVal = blurMatch ? parseFloat(blurMatch[1]!) : 0;
      const hasLargeBlur = blurVal >= 25 || node.width >= ctx.canvasWidth * 0.4;

      if (isPurpleCyanHaze && hasLargeBlur) {
        findings.push({
          code: 'SLOP-WEB-001',
          domain: 'layout',
          name: 'Purple Haze Darkmode Syndrome',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#glow',
          elementId: node.id || node.name || 'glow',
          message: 'Purple Haze Darkmode Syndrome detected: Diffuse radial violet/cyan blur cloud on dark canvas.',
          details: `Element ${node.id || 'glow'} uses ungrounded glowing neon fill with ${blurVal}px blur.`,
          help: 'Axiom UNI-03: Eliminate arbitrary radial blur clouds. Use architectural surface stepping (#0F172A -> #1E293B) or crisp gridline strokes.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-WEB-002: Meaningless Bento-Grid Overkill
 * 5+ cards with identical glassmorphism borders and thin/shallow content.
 */
function checkBentoOverkill(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const cardNodes = ctx.allNodes.filter(
    n => n.type === 'rect' && n.width > 120 && n.height > 60 && n.width < ctx.canvasWidth * 0.9
  );

  if (cardNodes.length >= 5) {
    const glassCards = cardNodes.filter(n => {
      const fillStr = typeof n.fill === 'string' ? n.fill.toLowerCase() : '';
      const hasBorder = Boolean(n.style?.stroke || n.style?.strokeWidth || (n.style as any)?.border);
      const hasRadius = Number(n.style?.borderRadius || 0) >= 12;
      return hasRadius && (fillStr.includes('alpha') || fillStr.includes('rgba') || hasBorder);
    });

    if (glassCards.length >= 5) {
      // Check content shallowness: cards with very few characters
      let shallowCount = 0;
      for (const card of glassCards) {
        const textsInside = ctx.textNodes.filter(
          t => t.x >= card.x && t.x + t.width <= card.x + card.width && t.y >= card.y && t.y + t.height <= card.y + card.height
        );
        const totalChars = textsInside.reduce((acc, t) => acc + getNodeContent(t).length, 0);
        if (totalChars < 40) shallowCount++;
      }

      findings.push({
        code: 'SLOP-WEB-002',
        domain: 'layout',
        name: 'Meaningless Bento-Grid Overkill',
        severity: shallowCount >= 3 ? 'fatal' : 'warn',
        message: `Meaningless Bento Overkill: ${cardNodes.length} segmented glassmorphism cards detected (${shallowCount} with shallow filler content).`,
        details: 'Forcing plain paragraphs, quotes, or 2-item lists into uniform rounded boxes with alpha borders.',
        help: 'Vary layout rhythms with asymmetrical editorial blocks and genuine data density instead of boxing everything into identical rounded tiles.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-WEB-003 / UNI-07: Supercharge Buzzword Generator
 */
function checkBuzzwords(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const textStr = getNodeContent(node);
    if (!textStr) continue;

    for (const item of SLOP_BUZZWORD_PATTERNS) {
      const match = textStr.match(item.pattern);
      if (match) {
        findings.push({
          code: 'SLOP-WEB-003',
          domain: 'typography',
          name: 'Phrasen-Dreschmaschine (Buzzwords)',
          severity: item.severity,
          nodeId: node.id ? `#${node.id}` : '#text',
          elementId: node.id || node.name || 'text',
          message: `AI buzzword cliché detected: "${match[0]}" (${item.label}).`,
          details: `Phrase matched pattern: ${item.pattern.toString()}`,
          help: 'Axiom UNI-07: Replace generic hype phrases with concrete domain-specific metrics, verified tools, and real outcomes.'
        });
        break; // Max 1 finding per text node
      }
    }
  }
  return findings;
}

/**
 * SLOP-WEB-004 / UNI-02: Senseless Floating Geometric Debris (Confetti dots, pluses, toruses)
 */
function checkFloatingDebris(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const isDebrisChar = node.type === 'text' && (node.content === '+' || node.content === '✕' || node.content === '•' || node.content === '✖');
    const isTinyCircle = node.type === 'circle' && node.width <= 14 && (!node.children || node.children.length === 0);
    const idStr = (node.id || node.name || '').toLowerCase();
    const isSuspiciousId = idStr.includes('confetti') || idStr.includes('decor') || idStr.includes('debris') || idStr.includes('dot') || idStr.includes('cross');

    if ((isDebrisChar || isTinyCircle) && (isSuspiciousId || !node.id)) {
      findings.push({
        code: 'SLOP-WEB-004',
        domain: 'layout',
        name: 'Floating Geometric Debris',
        severity: 'warn',
        nodeId: node.id ? `#${node.id}` : '#debris',
        elementId: node.id || node.name || 'debris',
        message: `Floating geometric debris detected: Purposeless particle or decorative symbol in layout.`,
        details: `Element ${node.id || node.type} floats without functional anchoring.`,
        help: 'Axiom UNI-02: Eliminate arbitrary floating pluses, dots, and confetti. Rely on confident negative space and real technical markings.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-WEB-005: Rainbow Pill-Button Overload
 * Buttons with multi-stop neon gradients (Pink -> Purple -> Cyan)
 */
function checkRainbowPills(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];

  for (const node of ctx.allNodes) {
    if (node.type === 'rect' && node.height >= 26 && node.height <= 56) {
      const radius = Number(node.style?.borderRadius || 0);
      const isPill = radius >= node.height / 2 - 2;
      const fillStr = extractFillStringOrStops(node.fill);

      if (isPill && (fillStr.includes('gradient') || fillStr.includes('linear') || fillStr.includes('radial'))) {
        const hasRainbowStops =
          (fillStr.includes('ec4899') || fillStr.includes('f43f5e') || fillStr.includes('ff007a')) &&
          (fillStr.includes('8b5cf6') || fillStr.includes('6366f1')) &&
          (fillStr.includes('06b6d4') || fillStr.includes('00f0ff') || fillStr.includes('3b82f6'));

        if (hasRainbowStops) {
          findings.push({
            code: 'SLOP-WEB-005',
            domain: 'color',
            name: 'Rainbow Pill-Button Overload',
            severity: 'warn',
            nodeId: node.id ? `#${node.id}` : '#button',
            elementId: node.id || node.name || 'button',
            message: `Rainbow neon gradient detected on pill button #${node.id || 'cta'}.`,
            details: 'Button uses high-chroma pink-to-cyan gradient with extreme saturation.',
            help: 'Use 1-color high-contrast primary actions (e.g. solid aubergine, pure cream, or crisp black) and understated secondary ghost links.'
          });
        }
      }
    }
  }
  return findings;
}

/**
 * SLOP-WEB-007 / UNI-05: Glassmorphism Overdose & Soap-Bar Radii
 * Childish 24px-36px corner radii on compact content cards
 */
function checkSoapBarRadii(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    if (node.type === 'rect' && node.style?.borderRadius) {
      const radius = Number(node.style.borderRadius);
      // Small to medium cards (< 200px height) with massive radii (>= 24px)
      // Exclude true pill badges (where radius >= height / 2 - 1)
      const isPill = radius >= node.height / 2 - 2;
      if (!isPill && radius >= 24 && node.height < 220 && node.width < 600) {
        findings.push({
          code: 'SLOP-WEB-007',
          domain: 'layout',
          name: 'Soap-Bar Radii Overkill',
          severity: radius >= 30 ? 'fatal' : 'warn',
          nodeId: node.id ? `#${node.id}` : '#card',
          elementId: node.id || node.name || 'card',
          message: `Extreme soap-bar corner radius (${radius}px) on content container (${node.width}x${node.height}px).`,
          details: `Card #${node.id || 'box'} has radius: ${radius}px; exceeding disciplined 6-12px architectural standards.`,
          help: 'Use solid, opaque surfaces with disciplined 6px–12px radii (or sharp 0–2px for editorial/fintech) to avoid toy-like appearance.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-WEB-008 / UNI-01: Horror Vacui & Compulsive Clutter Overload
 * Negative space ratio < 35% with high element count
 */
function checkHorrorVacui(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  if (ctx.negativeSpacePercent < 35 && ctx.allNodes.length >= 8) {
    const isSeverelyCramped = ctx.negativeSpacePercent < 20;
    findings.push({
      code: 'SLOP-WEB-008',
      domain: 'layout',
      name: 'Horror Vacui (Clutter Overload)',
      severity: isSeverelyCramped ? 'fatal' : 'warn',
      message: `Horror Vacui violation: Negative space is only ${ctx.negativeSpacePercent}% (< 35% minimum).`,
      details: `Canvas area (${ctx.canvasWidth}x${ctx.canvasHeight}px) is overcrowded with ${ctx.allNodes.length} elements without breathing room.`,
      help: 'Axiom UNI-01: WENIGER IST MEHR. Reserve 40% to 60% of canvas as generous negative space. Delete 25% of redundant micro-elements.'
    });
  }
  return findings;
}

/**
 * SLOP-WEB-009: Purposeless Left Border Stripe
 * 3-4px colored accent stripe on left edge without semantic meaning
 */
function checkLeftBorderStripe(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    if (node.type === 'rect') {
      const isNarrowStripe = node.width >= 2 && node.width <= 6 && node.height >= 40;
      if (isNarrowStripe) {
        const idStr = (node.id || node.name || '').toLowerCase();
        const isStatusSemantic = idStr.includes('error') || idStr.includes('warn') || idStr.includes('success') || idStr.includes('alert');
        if (!isStatusSemantic) {
          findings.push({
            code: 'SLOP-WEB-009',
            domain: 'layout',
            name: 'Purposeless Left Border Stripe',
            severity: 'warn',
            nodeId: node.id ? `#${node.id}` : '#stripe',
            elementId: node.id || node.name || 'stripe',
            message: `Purposeless left-edge accent stripe detected (${node.width}x${node.height}px).`,
            details: 'Cookie-cutter decorative stripe without semantic status indication.',
            help: 'Reserve border colors strictly for verified system states (success/error/warning). Define card hierarchy through typography and subtle fills.'
          });
        }
      }
    }
  }
  return findings;
}

/**
 * SLOP-WEB-012: Monotone Triplet Feature Clones
 * Exactly 3 identical cards in a row with centered icons
 */
function checkTripletClones(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const cards = ctx.allNodes.filter(
    n => n.type === 'rect' && n.width > 100 && n.height > 100 && n.width < ctx.canvasWidth * 0.45
  );

  const sizeMap = new Map<string, LayoutNode[]>();
  for (const c of cards) {
    const key = `${Math.round(c.width)}x${Math.round(c.height)}`;
    const list = sizeMap.get(key) || [];
    list.push(c);
    sizeMap.set(key, list);
  }

  for (const [dims, list] of sizeMap.entries()) {
    if (list.length === 3) {
      const sortedByX = [...list].sort((a, b) => a.x - b.x);
      const isRow = Math.abs(sortedByX[0]!.y - sortedByX[1]!.y) < 10 && Math.abs(sortedByX[1]!.y - sortedByX[2]!.y) < 10;
      if (isRow) {
        findings.push({
          code: 'SLOP-WEB-012',
          domain: 'layout',
          name: 'Monotone Triplet Feature Clones',
          severity: 'notice',
          message: `Monotone Triplet Feature Clones: Exactly 3 identical cards (${dims}) in a rigid horizontal row.`,
          help: 'Vary layout rhythms with asymmetrical feature blocks, modular storytelling, and real UI previews.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-001: Inter/Roboto Monoculture
 * Defaulting to single generic sans-serif everywhere without editorial pairing
 */
function checkTypoMonoculture(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const families = new Set<string>();
  for (const node of ctx.textNodes) {
    const fam = (node.textLayout?.fontFamily || '').replace(/^['"]+|['"]+$/g, '').trim().toLowerCase();
    if (fam) families.add(fam);
  }

  const genericSans = ['inter', 'roboto', 'open sans', 'arial', 'system-ui'];
  if (families.size === 1) {
    const onlyFam = Array.from(families)[0]!;
    if (genericSans.includes(onlyFam)) {
      findings.push({
        code: 'SLOP-TYPE-001',
        domain: 'typography',
        name: 'Inter/Roboto Monoculture',
        severity: 'warn',
        message: `Generic font monoculture: Entire layout relies exclusively on "${onlyFam}" with zero display pairing.`,
        details: 'Missing stylistic tension between high-character display type and functional body text.',
        help: 'Pair high-personality display type (e.g. Cabinet Grotesk, Playfair, Space Grotesk, Fraunces) with utilitarian body text.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-002: Centered Multi-Line Body Paragraphs
 */
function checkCenteredProse(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const isCentered = node.style?.align === 'center';
    const lines = node.textLayout?.lines || [];
    const content = getNodeContent(node);

    if (isCentered && (lines.length > 2 || content.length > 90)) {
      const idLabel = node.id ? `#${node.id}` : (node.name || 'text');
      findings.push({
        code: 'SLOP-TYPE-002',
        domain: 'typography',
        name: 'Centered Multi-Line Body Text',
        severity: 'fatal',
        nodeId: idLabel,
        elementId: node.id || node.name || 'text',
        message: `${idLabel}: Centered multi-line body paragraph detected (${lines.length || 3} lines, ${content.length} chars).`,
        details: 'Centering body prose longer than 2 lines destroys the reader\'s left-eye scanning anchor.',
        help: 'Axiom UNI-04: Body text exceeding 2 lines MUST always be left-aligned (align: left;). Only center single-line badges or headlines.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-004: Unspaced All-Caps Squeeze
 */
function checkUnspacedAllCaps(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    const isAllCaps = content.length >= 4 && content === content.toUpperCase() && /[A-Z]/.test(content);
    const letterSpacing = node.style?.letterSpacing || 0;

    if (isAllCaps && Number(letterSpacing) <= 0) {
      const idLabel = node.id ? `#${node.id}` : (node.name || 'text');
      findings.push({
        code: 'SLOP-TYPE-004',
        domain: 'typography',
        name: 'Unspaced All-Caps Squeeze',
        severity: 'warn',
        nodeId: idLabel,
        elementId: node.id || node.name || 'text',
        message: `${idLabel}: UPPERCASE text without positive letter-spacing ("${content.slice(0, 18)}...").`,
        help: 'Axiom UNI-04: Uppercase text (ALL CAPS) MUST always be tracked (letter-spacing: 0.08em; to 0.15em;) to prevent glyph collisions.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-009: Em-Dash Inflation (—)
 */
function checkEmDashInflation(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    const emDashes = (content.match(/—/g) || []).length;
    if (emDashes >= 2) {
      const idLabel = node.id ? `#${node.id}` : (node.name || 'text');
      findings.push({
        code: 'SLOP-TYPE-009',
        domain: 'typography',
        name: 'Em-Dash Inflation (—)',
        severity: 'notice',
        nodeId: idLabel,
        elementId: node.id || node.name || 'text',
        message: `${idLabel}: Excessive em-dashes detected (${emDashes}x "—" in one text node).`,
        help: 'LLMs overuse rhetorical em-dashes. Use natural sentence structure with standard punctuation.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-010: Sparkle Icon Overuse (✨ / ✦)
 */
function checkSparkleOveruse(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];

  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    if (SPARKLE_PATTERN.test(content)) {
      const idLabel = node.id ? `#${node.id}` : (node.name || 'text');
      findings.push({
        code: 'SLOP-TYPE-010',
        domain: 'typography',
        name: 'Universal AI Sparkle Overuse',
        severity: 'warn',
        nodeId: idLabel,
        elementId: node.id || node.name || 'text',
        message: `${idLabel}: Universal AI sparkle marker ("✨ / ✦") detected as feature icon.`,
        help: 'The sparkle icon is an overused cliché for AI features. Use domain-specific geometric or functional icons.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-GFX-003: Muddy Linear RGB Gradient Bleed
 * Complementary hue interpolation (deltaHue > 120°) without intermediate saturation stop
 */
function checkMuddyGradients(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];

  for (const node of ctx.allNodes) {
    const fillStr = typeof node.fill === 'string' ? node.fill : '';
    if (fillStr.includes('linear') || fillStr.includes('radial') || fillStr.includes('gradient')) {
      const hexMatches = fillStr.match(/#[0-9a-fA-F]{3,8}/g) || [];
      if (hexMatches.length === 2) {
        const col1 = parseColorToRgba(hexMatches[0]!);
        const col2 = parseColorToRgba(hexMatches[1]!);
        const h1 = rgbToHue(col1.r, col1.g, col1.b);
        const h2 = rgbToHue(col2.r, col2.g, col2.b);
        const hueDiff = calculateHueDistance(h1, h2);

        if (hueDiff >= 125 && col1.a > 0.5 && col2.a > 0.5) {
          const idLabel = node.id ? `#${node.id}` : (node.name || 'gradient');
          findings.push({
            code: 'SLOP-GFX-003',
            domain: 'color',
            name: 'Muddy Linear RGB Gradient Bleed',
            severity: 'fatal',
            nodeId: idLabel,
            elementId: node.id || node.name || 'gradient',
            message: `${idLabel}: Complementary gradient (${hexMatches[0]} to ${hexMatches[1]}, Δ${hueDiff}°) causes dirty gray mud in linear sRGB.`,
            details: 'Interpolating opposite color wheel hues without an intermediate bridge stop produces desaturated sewage gray.',
            help: 'Add a vivid intermediate color stop (e.g. blue -> violet -> warm red -> orange) or use analogous color harmonies.'
          });
        }
      }
    }
  }
  return findings;
}

/**
 * SLOP-COLOR-001: Cyberpunk/Discord Default Spectrum
 * Heavy clustering of #6366F1, #EC4899, #06B6D4
 */
function checkCyberpunkSpectrum(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  let discordPaletteHits = 0;

  for (const node of ctx.allNodes) {
    const fillStr = (typeof node.fill === 'string' ? node.fill : '').toLowerCase();
    const strokeStr = (typeof node.stroke === 'string' ? node.stroke : '').toLowerCase();
    const combined = `${fillStr} ${strokeStr}`;

    if (combined.includes('6366f1') || combined.includes('ec4899') || combined.includes('06b6d4') || combined.includes('8b5cf6')) {
      discordPaletteHits++;
    }
  }

  if (discordPaletteHits >= 4) {
    findings.push({
      code: 'SLOP-COLOR-001',
      domain: 'color',
      name: 'Cyberpunk/Discord Default Spectrum',
      severity: 'warn',
      message: `Cyberpunk/Discord color cliché: ${discordPaletteHits} elements cluster on Indigo (#6366F1), Hot Pink (#EC4899), or Cyan (#06B6D4).`,
      help: 'Avoid generic Web3/Discord color palettes. Explore sophisticated tones like Sage, Deep Terracotta, Copper, Prussian Blue, or Aubergine.'
    });
  }
  return findings;
}

/**
 * SLOP-COLOR-002: Harsh Mud Drop Shadow
 * Heavy single black shadow with opacity > 0.35
 */
function checkMudShadow(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const shadowCol = node.style?.shadow?.color || '';
    const shadowStr = String(shadowCol || (node.style as any)?.boxShadow || '');
    if (typeof shadowStr === 'string' && shadowStr.length > 0) {
      const alphaMatch = shadowStr.match(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([0-9.]+)\s*\)/i) ||
                         shadowStr.match(/alpha\(\s*#000(?:000)?\s*,\s*([0-9.]+)\s*\)/i);
      if (alphaMatch) {
        const alpha = parseFloat(alphaMatch[1]!);
        if (alpha >= 0.35) {
          const idLabel = node.id ? `#${node.id}` : (node.name || 'card');
          findings.push({
            code: 'SLOP-COLOR-002',
            domain: 'color',
            name: 'Harsh Mud Drop Shadow',
            severity: 'warn',
            nodeId: idLabel,
            elementId: node.id || node.name || 'card',
            message: `${idLabel}: Harsh single drop shadow with high opacity (${Math.round(alpha * 100)}% black).`,
            help: 'Use layered ambient shadows (e.g. 0 1px 2px alpha(#000, 0.05) + 0 16px 32px alpha(#000, 0.04)) or clean 1px borders.'
          });
        }
      }
    }
  }
  return findings;
}

/**
 * SLOP-CODE-005: Raw Unicode Emoji cheap icon substitution
 */
function checkEmojiIcons(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    if (RAW_EMOJI_PATTERN.test(content)) {
      const idLabel = node.id ? `#${node.id}` : (node.name || 'text');
      findings.push({
        code: 'SLOP-CODE-005',
        domain: 'vectors',
        name: 'Unicode Emoji Cheap Substitution',
        severity: 'warn',
        nodeId: idLabel,
        elementId: node.id || node.name || 'text',
        message: `${idLabel}: System emoji detected in UI text node ("${content.slice(0, 16)}...").`,
        help: 'Replace raw emojis (🚀, ⚡, 💡, 🎯) with calibrated vector icons for professional visual clarity.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-ICON-001: Heterogeneous Icon Stroke Inconsistency
 * Stated vector lines differing by > 2.2x
 */
function checkIconStrokeConsistency(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const strokes: number[] = [];

  for (const node of ctx.allNodes) {
    if (node.type === 'path' || node.type === 'polygon' || node.type === 'shape' || node.type === 'icon') {
      const sw = Number(node.style?.strokeWidth || 0);
      if (sw > 0) strokes.push(sw);
    }
  }

  if (strokes.length >= 4) {
    const minSw = Math.min(...strokes);
    const maxSw = Math.max(...strokes);
    if (maxSw >= minSw * 2.2 && minSw > 0) {
      findings.push({
        code: 'SLOP-ICON-001',
        domain: 'vectors',
        name: 'Heterogeneous Icon Stroke Inconsistency',
        severity: 'warn',
        message: `Inconsistent vector stroke weights: Lines vary from ${minSw}px to ${maxSw}px (> 2x divergence).`,
        help: 'Standardize stroke widths (e.g. unified 1.5px or 2.0px across 24x24px icon grids) for visual harmony.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-ASSET-001: External Unsplash Parameter Signature & Placeholder Domains
 */
function checkAssetSignatures(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const srcStr = String((node as any).src || (node as any).imageLayout?.src || (node as any).style?.src || node.fill || '');
    if (srcStr.includes('placehold.co') || srcStr.includes('via.placeholder.com')) {
      findings.push({
        code: 'SLOP-ASSET-001',
        domain: 'assets',
        name: 'Placeholder Domain Signature',
        severity: 'fatal',
        nodeId: node.id ? `#${node.id}` : '#img',
        elementId: node.id || node.name || 'img',
        message: `External placeholder image domain detected: "${srcStr.slice(0, 40)}...".`,
        help: 'Do not leave external placeholder domains in production designs. Use local assets or native TOAD vectors.'
      });
    } else if (srcStr.includes('unsplash.com') && srcStr.includes('auto=format&fit=crop')) {
      findings.push({
        code: 'SLOP-ASSET-001',
        domain: 'assets',
        name: 'Raw Unsplash Parameter Signature',
        severity: 'fatal',
        nodeId: node.id ? `#${node.id}` : '#img',
        elementId: node.id || node.name || 'img',
        message: `Raw generator-parameter Unsplash URL signature detected in production code.`,
        help: 'Bundle stock photography locally as WebP/AVIF assets instead of streaming raw Unsplash URLs.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-ASSET-004: Standard Dummy Remnants
 * example.com, +1 555, Lorem ipsum, Acme Corp
 */
function checkDummyRemnants(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const dummyRegex = /(\+1\s*\(?555\)?[-.\s]*\d{3}[-.\s]*\d{4}|example\.com|lorem\s+ipsum|contact@company\.com|acme\s+corp)/i;

  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    const match = content.match(dummyRegex);
    if (match) {
      const idLabel = node.id ? `#${node.id}` : (node.name || 'text');
      findings.push({
        code: 'SLOP-ASSET-004',
        domain: 'assets',
        name: 'Standard Dummy Remnant',
        severity: 'warn',
        nodeId: idLabel,
        elementId: node.id || node.name || 'text',
        message: `${idLabel}: Dummy contact / placeholder remnant detected ("${match[0]}").`,
        help: 'Replace template dummy data (example.com, +1 555, Lorem Ipsum) with realistic, localized production content.'
      });
      break;
    }
  }
  return findings;
}

/**
 * SLOP-LOGO-004: Favicon Micro-Detail Smear
 * Signets with lines < 1.5px or gaps < 3px that dissolve at 16x16 / 32x32px
 */
function checkFaviconMicroDetails(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    const parentIdStr = String((node as any).parentId || (node as any).parent || '').toLowerCase();
    const isLogo = idStr.includes('logo') || idStr.includes('signet') || idStr.includes('brandmark') || idStr.includes('favicon') ||
                   parentIdStr.includes('logo') || parentIdStr.includes('signet') || parentIdStr.includes('brandmark') || parentIdStr.includes('favicon');

    if (isLogo) {
      const sw = Number(node.style?.strokeWidth || (node as any).strokeWidth || 0);
      if (sw > 0 && sw < 1.5) {
        findings.push({
          code: 'SLOP-LOGO-004',
          domain: 'vectors',
          name: 'Favicon Micro-Detail Smear',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#logo',
          elementId: node.id || node.name || 'logo',
          message: `Brandmark #${node.id || 'logo'} uses stroke weight < 1.5px (${sw}px), which smears to gray noise at 16x16 / 32x32px.`,
          help: 'Axiom UNI-06: Pass the Favicon Test. Brandmarks must maintain bold, high-contrast silhouette geometry at 16x16px.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-GEOM-001: Concentric Radii Mismatch (Soap inside Soap)
 * Nested rounded rectangles where child radius >= parent radius, pinching corners visually.
 */
function checkConcentricRadiiMismatch(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const rects = ctx.allNodes.filter(n => n.type === 'rect' && Number(n.style?.borderRadius || 0) >= 8);

  for (const parent of rects) {
    const parentRadius = Number(parent.style?.borderRadius || 0);
    const children = rects.filter(c => 
      c !== parent &&
      c.x >= parent.x + 2 &&
      c.y >= parent.y + 2 &&
      c.x + c.width <= parent.x + parent.width - 2 &&
      c.y + c.height <= parent.y + parent.height - 2
    );

    for (const child of children) {
      const childRadius = Number(child.style?.borderRadius || 0);
      const isPill = childRadius >= child.height / 2 - 2;
      if (!isPill && childRadius >= parentRadius) {
        findings.push({
          code: 'SLOP-GEOM-001',
          domain: 'layout',
          name: 'Concentric Radii Mismatch (Soap inside Soap)',
          severity: 'warn',
          nodeId: child.id ? `#${child.id}` : '#childRect',
          elementId: child.id || child.name || 'childRect',
          message: `Concentric Radii Mismatch: Child element #${child.id || 'rect'} has radius (${childRadius}px) >= parent #${parent.id || 'container'} (${parentRadius}px), pinching corners visually.`,
          details: `Enforce concentric curvature: R_inner = max(0, R_outer - padding) so corners maintain parallel concentric flow.`,
          help: 'Axiom UNI-05: Inner rounded elements must have smaller radii than their parent container.'
        });
        break;
      }
    }
  }
  return findings;
}

/**
 * SLOP-WEB-014: Ornamental Live-Pulse Eyebrow-Badge
 * Pill badge with green blinking / live beacon above headline.
 */
function checkLivePulseBadge(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    const isPulseId = idStr.includes('pulse') || idStr.includes('beacon') || idStr.includes('livebadge');
    const isTinyCircle = node.type === 'circle' && node.width <= 14;
    const fillStr = typeof node.fill === 'string' ? node.fill.toLowerCase() : '';
    const isBrightGreen = fillStr.includes('22c55e') || fillStr.includes('10b981') || fillStr.includes('00ff') || fillStr.includes('4ade80') || fillStr.includes('16a34a');

    if (isTinyCircle && isBrightGreen && (isPulseId || !node.id)) {
      if (node.y < ctx.canvasHeight * 0.45) {
        findings.push({
          code: 'SLOP-WEB-014',
          domain: 'layout',
          name: 'Ornamental Live-Pulse Eyebrow-Badge',
          severity: 'warn',
          nodeId: node.id ? `#${node.id}` : '#pulse',
          elementId: node.id || node.name || 'pulse',
          message: `Ornamental Live-Pulse Badge detected: Green glowing beacon #${node.id || 'pulse'} above headline.`,
          help: 'Do not attach fake pulsing beacons to static marketing headlines. Use clean semantic kickers instead.'
        });
        break;
      }
    }
  }
  return findings;
}

/**
 * SLOP-WEB-015: Russian-Doll Container Nesting (Matrjoschka-Karten)
 * 3+ nested rect containers with borders creating dead space.
 */
function checkRussianDollNesting(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const cardRects = ctx.allNodes.filter(n => 
    n.type === 'rect' && 
    (n.style?.stroke || n.style?.strokeWidth || (n.style as any)?.border || Number(n.style?.borderRadius || 0) > 0)
  );

  for (const r1 of cardRects) {
    for (const r2 of cardRects) {
      if (r1 !== r2 && r2.x >= r1.x && r2.y >= r1.y && r2.x + r2.width <= r1.x + r1.width && r2.y + r2.height <= r1.y + r1.height) {
        for (const r3 of cardRects) {
          if (r3 !== r2 && r3 !== r1 && r3.x >= r2.x && r3.y >= r2.y && r3.x + r3.width <= r2.x + r2.width && r3.y + r3.height <= r2.y + r2.height) {
            findings.push({
              code: 'SLOP-WEB-015',
              domain: 'layout',
              name: 'Russian-Doll Container Nesting',
              severity: 'warn',
              nodeId: r3.id ? `#${r3.id}` : '#nestedCard',
              elementId: r3.id || r3.name || 'nestedCard',
              message: `Russian-Doll Nesting: 3+ nested container cards detected (#${r1.id || 'c1'} -> #${r2.id || 'c2'} -> #${r3.id || 'c3'}), creating excessive dead space.`,
              help: 'Flatten container hierarchies: rely on generous padding, typographic groupings, and subtle surface steps instead of boxing boxes.'
            });
            return findings;
          }
        }
      }
    }
  }
  return findings;
}

/**
 * SLOP-DECK-002: Megalithic Quote Monument
 * Giant quotation marks taking up huge visual area as vacuum filler.
 */
function checkMegalithicQuote(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const content = getNodeContent(node).trim();
    if (content === '“' || content === '”' || content === '"' || content === '„') {
      const fs = Number(node.textLayout?.fontSize || (node as any).font?.size || (node.style as any)?.fontSize || 0);
      if (fs >= 64 || node.width >= 50) {
        findings.push({
          code: 'SLOP-DECK-002',
          domain: 'typography',
          name: 'Megalithic Quote Monument',
          severity: 'warn',
          nodeId: node.id ? `#${node.id}` : '#quote',
          elementId: node.id || node.name || 'quote',
          message: `Megalithic Quote Monument detected: Giant quotation mark "${content}" (${fs}px) used as decorative filler.`,
          help: 'Axiom UNI-01: Less is more. Set quotes with disciplined editorial rag, clear source attribution, and confident negative space instead of giant punctuation.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-PRINT-001: Swiss-Slop & Grid Cosplay
 * Arbitrary registration marks (+, ⌖) or giant decorative numbers (01, 08) inside live layout.
 */
function checkSwissSlopCosplay(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const content = getNodeContent(node).trim();
    const idStr = (node.id || node.name || '').toLowerCase();
    const isRegMark = (content === '⌖' || content === '⊕') || (content === '+' && (idStr.includes('reg') || idStr.includes('mark') || idStr.includes('swiss')));
    const isGiantNumeral = /^(0[1-9]|[1-9])$/.test(content) && Number(node.textLayout?.fontSize || (node as any).font?.size || (node.style as any)?.fontSize || 0) >= 64 && (idStr.includes('num') || idStr.includes('swiss') || idStr.includes('grid'));

    if (isRegMark || isGiantNumeral) {
      findings.push({
        code: 'SLOP-PRINT-001',
        domain: 'vectors',
        name: 'Swiss-Slop & Grid Cosplay',
        severity: 'warn',
        nodeId: node.id ? `#${node.id}` : '#swissElement',
        elementId: node.id || node.name || 'swissElement',
        message: `Swiss-Slop Cosplay detected: Decorative mark or giant numeral "${content}" used as aesthetic sticker inside layout.`,
        help: 'Place technical marks strictly in the bleed/slug zone. Build honest modular grids rather than scattering superficial Swiss design stickers.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-PRINT-003: Telemetry Stamping & Null-Island GPS
 * Random GPS coordinates or camera EXIF telemetry stamped onto margins.
 */
function checkTelemetryGpsStamping(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const gpsRegex = /\b(\d{1,3}°\s*\d{1,2}['′]\s*([0-9.]+["″])?\s*[NSEW]|LAT\s*[:=]?\s*[-0-9.]+|LON\s*[:=]?\s*[-0-9.]+|0\.0000°?\s*[NS]?\s*,\s*0\.0000°?\s*[EW]?)\b/i;

  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    const match = content.match(gpsRegex);
    if (match) {
      findings.push({
        code: 'SLOP-PRINT-003',
        domain: 'typography',
        name: 'Telemetry Stamping & Null-Island GPS',
        severity: 'warn',
        nodeId: node.id ? `#${node.id}` : '#telemetry',
        elementId: node.id || node.name || 'telemetry',
        message: `Telemetry Stamping detected: GPS coordinate or pseudo-telemetry string "${match[0]}".`,
        help: 'Do not stamp random GPS coordinates or fake telemetry onto poster margins. Use authentic project metadata or leave confident negative space.'
      });
      break;
    }
  }
  return findings;
}

/**
 * SLOP-DASH-001: Hero Fake-Dashboard Mirage
 * Unlabeled upward-trending curves or fake charts without axes in hero.
 */
function checkHeroFakeDashboard(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    const isFakeChart = idStr.includes('fakechart') || idStr.includes('trendcurve') || idStr.includes('herochart');
    if (isFakeChart && (node.type === 'path' || node.type === 'polygon')) {
      findings.push({
        code: 'SLOP-DASH-001',
        domain: 'vectors',
        name: 'Hero Fake-Dashboard Mirage',
        severity: 'warn',
        nodeId: node.id ? `#${node.id}` : '#fakeChart',
        elementId: node.id || node.name || 'fakeChart',
        message: `Hero Fake-Dashboard Mirage detected: Decorative curve #${node.id || 'chart'} without axes, scale or units.`,
        help: 'Display authentic product interfaces with real data domains and honest axes instead of decorative upward trend curves.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-WEB-017: Fake Social Proof Avatar Overlap Pile (The 5-Face Stack)
 */
function checkFakeSocialProofAvatarPile(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const avatars = ctx.allNodes.filter(n => {
    if (n.type !== 'circle' && n.type !== 'image' && !(n.type === 'rect' && Math.abs(n.width - n.height) < 4 && Number(n.style?.borderRadius || 0) >= n.width / 2 - 2)) return false;
    return n.width >= 18 && n.width <= 64 && n.y < ctx.canvasHeight * 0.65;
  }).sort((a, b) => a.x - b.x);

  if (avatars.length >= 3) {
    let overlappingCount = 1;
    for (let i = 1; i < avatars.length; i++) {
      const prev = avatars[i - 1]!;
      const curr = avatars[i]!;
      const dx = curr.x - prev.x;
      const dy = Math.abs(curr.y - prev.y);
      if (dx > 0 && dx < prev.width * 0.9 && dy < 20) {
        overlappingCount++;
      }
    }

    if (overlappingCount >= 3) {
      const socialRegex = /\b(trusted|loved|used|chosen)\s+by\s+\d+k?\+?\s+(teams|users|founders|developers|creators|companies|customers)\b/i;
      const starRegex = /[★*]{4,5}|5[- ]star/i;
      const hasSocialCopy = ctx.textNodes.some(t => {
        const text = getNodeContent(t);
        return socialRegex.test(text) || starRegex.test(text);
      });

      if (hasSocialCopy || overlappingCount >= 4) {
        findings.push({
          code: 'SLOP-WEB-017',
          domain: 'layout',
          name: 'Fake Social Proof Avatar Pile',
          severity: 'fatal',
          nodeId: avatars[0]?.id ? `#${avatars[0].id}` : '#avatarStack',
          elementId: avatars[0]?.id || avatars[0]?.name || 'avatarStack',
          message: `Fake Social Proof Pile detected: ${overlappingCount} overlapping avatar circles with generic social proof claims.`,
          details: 'Stacked 5-face avatars with stars and "Loved by 10k+" is a generic generative marketing trope.',
          help: 'Show genuine customer case studies with verified names and metrics, or replace with confident negative space.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-WEB-018: Stereotypical Hero Formula Pipeline (5-Stage Rigidity)
 */
function checkStereotypicalHeroFormula(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const heroNodes = ctx.allNodes.filter(n => n.y < ctx.canvasHeight * 0.7 && n.width > 20);

  let hasPillEyebrow = false;
  let hasDisplayH1 = false;
  let hasCenteredSubline = false;
  let hasTwoCtas = false;

  for (const n of heroNodes) {
    const isCentered = Math.abs((n.x + n.width / 2) - ctx.canvasWidth / 2) < 50;
    if (n.type === 'rect' && n.height <= 36 && Number(n.style?.borderRadius || 0) >= n.height / 2 - 4) {
      hasPillEyebrow = true;
    }
    if (n.type === 'text') {
      const fs = n.textLayout?.fontSize || (n.style as any)?.fontSize || 0;
      const align = n.style?.align || 'left';
      if (fs >= 44 && isCentered) hasDisplayH1 = true;
      if (fs <= 22 && fs >= 14 && align === 'center' && (n.textLayout?.lines?.length || 1) >= 2) hasCenteredSubline = true;
    }
    if ((n.type === 'stack' || n.type === 'group' || (n.children && n.children.length === 2)) && isCentered) {
      const btns = (n.children || []).filter(c => c.type === 'rect' || c.name === 'button');
      if (btns.length === 2) hasTwoCtas = true;
    }
  }

  if (hasPillEyebrow && hasDisplayH1 && hasCenteredSubline && hasTwoCtas) {
    findings.push({
      code: 'SLOP-WEB-018',
      domain: 'layout',
      name: 'Stereotypical Hero Formula Pipeline',
      severity: 'fatal',
      message: 'Stereotypical 5-Stage Hero Pipeline detected: Pill Eyebrow -> Display H1 -> Centered Subline -> 2 Buttons.',
      details: 'Strict rigid template replicated by LLM generators without brand personality or modular rhythm.',
      help: 'Vary layout rhythm with asymmetric hero structures, split-screen storytelling, or editorial typographic leads.'
    });
  }
  return findings;
}

/**
 * SLOP-WEB-019: Void Glow Halo / Floating Backlight
 */
function checkVoidGlowHalo(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const filterStr = String(node.style?.filter || '');
    const blurMatch = filterStr.match(/blur\(\s*([0-9.]+)(?:px)?\s*\)/i);
    const blurVal = blurMatch ? parseFloat(blurMatch[1]!) : 0;
    const isVoidGlow = (node.type === 'circle' || node.type === 'rect') && (blurVal >= 45 || (node.style?.shadow?.blur || 0) >= 40);
    const idStr = (node.id || node.name || '').toLowerCase();
    if (isVoidGlow && (idStr.includes('backlight') || idStr.includes('halo') || idStr.includes('glow'))) {
      findings.push({
        code: 'SLOP-WEB-019',
        domain: 'color',
        name: 'Void Glow Halo Backlight',
        severity: 'warn',
        nodeId: node.id ? `#${node.id}` : '#glowHalo',
        elementId: node.id || node.name || 'glowHalo',
        message: `Void Glow Halo detected: Floating blur halo #${node.id || 'glow'} (${blurVal}px blur) without physical light fixture.`,
        help: 'Ground floating cards with architectural surface stepping and crisp 1px borders instead of void blur glows.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-WEB-020: Infinite Testimonial Grid Hallucination
 */
function checkInfiniteTestimonialGrid(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const cardNodes = ctx.allNodes.filter(n => n.type === 'rect' && n.width >= 160 && n.height >= 80);
  if (cardNodes.length >= 6) {
    const genericTestimonialRegex = /\b(game[- ]changer|seamless|supercharge|unbelievable|best\s+tool\s+ever|total\s+life\s+saver|incredible\s+ui)\b/i;
    let fluffCardCount = 0;
    for (const card of cardNodes) {
      const texts = ctx.textNodes.filter(t => t.x >= card.x && t.x + t.width <= card.x + card.width && t.y >= card.y && t.y + t.height <= card.y + card.height);
      const combined = texts.map(getNodeContent).join(' ');
      if (genericTestimonialRegex.test(combined)) fluffCardCount++;
    }
    if (fluffCardCount >= 4) {
      findings.push({
        code: 'SLOP-WEB-020',
        domain: 'layout',
        name: 'Infinite Testimonial Grid Hallucination',
        severity: 'warn',
        message: `Infinite Testimonial Grid detected: ${fluffCardCount} cards with repetitive generic hype quotes.`,
        help: 'Feature 2-3 detailed case studies with verified company metrics instead of grids of generic praise cards.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-UI-001: Contradictory Virtual Lighting Vectors (Specular Chaos)
 */
function checkContradictoryVirtualLighting(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const shadowedNodes = ctx.allNodes.filter(n => n.style?.shadow && (Math.abs(n.style.shadow.offsetX) > 0 || Math.abs(n.style.shadow.offsetY) > 0));

  if (shadowedNodes.length >= 3) {
    let positiveYCount = 0;
    let negativeYCount = 0;
    for (const n of shadowedNodes) {
      const sh = n.style.shadow!;
      if (sh.offsetY > 4) positiveYCount++;
      else if (sh.offsetY < -4) negativeYCount++;
    }
    if (positiveYCount >= 1 && negativeYCount >= 1) {
      findings.push({
        code: 'SLOP-UI-001',
        domain: 'layout',
        name: 'Contradictory Virtual Lighting Vectors',
        severity: 'fatal',
        message: `Specular Chaos: Contradictory light angles detected (${positiveYCount} shadows cast down, ${negativeYCount} shadows cast up).`,
        help: 'Establish a unified virtual light source (e.g. 270° from top or 315° from top-left) for all components.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-UI-002: Luminous / Inverted Shadows
 */
function checkLuminousInvertedShadows(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const bgLuma = (0.2126 * ctx.bgRgba.r + 0.7152 * ctx.bgRgba.g + 0.0722 * ctx.bgRgba.b) / 255;

  for (const node of ctx.allNodes) {
    if (node.style?.shadow) {
      const sh = node.style.shadow;
      const idStr = (node.id || node.name || '').toLowerCase();
      if (idStr.includes('glow') || idStr.includes('focus')) continue;

      const shColor = parseColorToRgba(sh.color);
      const shLuma = (0.2126 * shColor.r + 0.7152 * shColor.g + 0.0722 * shColor.b) / 255;
      if (shLuma > bgLuma + 0.22 && shColor.a > 0.25) {
        findings.push({
          code: 'SLOP-UI-002',
          domain: 'color',
          name: 'Luminous / Inverted Shadows',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#luminousShadow',
          elementId: node.id || node.name || 'luminousShadow',
          message: `Inverted Shadow detected on #${node.id || 'element'}: Shadow is significantly brighter than canvas (${Math.round(shLuma*100)}% vs ${Math.round(bgLuma*100)}%).`,
          help: 'Shadows must subtract luminance (darken). Use darker tones of background or black alpha for shadows.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-UI-003: Uncanny Glassmorphism Contrast Collapse
 */
function checkGlassmorphismContrastCollapse(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const hasBackdrop = Boolean(node.style?.backdropFilter);
    const fillStr = typeof node.fill === 'string' ? node.fill : '';
    const isTranslucent = fillStr.includes('alpha') || fillStr.includes('rgba');

    if ((hasBackdrop || isTranslucent) && node.width > 80 && node.height > 40) {
      const texts = ctx.textNodes.filter(t => t.x >= node.x && t.x + t.width <= node.x + node.width && t.y >= node.y && t.y + t.height <= node.y + node.height);
      for (const t of texts) {
        const textColor = parseColorToRgba(t.style?.color || (typeof t.fill === 'string' ? t.fill : '#000000'));
        if (textColor.a < 0.4) {
          findings.push({
            code: 'SLOP-UI-003',
            domain: 'layout',
            name: 'Uncanny Glassmorphism Contrast Collapse',
            severity: 'fatal',
            nodeId: t.id ? `#${t.id}` : `#${node.id || 'card'}`,
            elementId: t.id || node.id || 'text',
            message: `Contrast collapse on glassmorphic #${node.id || 'card'}: Text alpha is below 0.40 over translucent background.`,
            help: 'Back glassmorphic containers with a solid fallback (min 85% opacity) or use opaque surfaces.'
          });
          break;
        }
      }
    }
  }
  return findings;
}

/**
 * SLOP-UI-004: Safe-Area Blindness & Mobile Bottom Collision
 */
function checkSafeAreaBlindness(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  if (ctx.canvasWidth <= 430 && ctx.canvasHeight >= 600) {
    for (const node of ctx.allNodes) {
      const isBottomDocked = (node.y + node.height) >= (ctx.canvasHeight - 6);
      const isAction = node.type === 'rect' || node.name === 'button' || (node.id || '').includes('nav') || (node.id || '').includes('bar');
      if (isBottomDocked && isAction && node.height < 90) {
        findings.push({
          code: 'SLOP-UI-004',
          domain: 'layout',
          name: 'Safe-Area Blindness & Mobile Bottom Collision',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#bottomDock',
          elementId: node.id || node.name || 'bottomDock',
          message: `Mobile safe-area collision: Component #${node.id || 'nav'} touches canvas bottom without safe-area padding.`,
          help: 'Enforce bottom padding: minimum 24px (env(safe-area-inset-bottom)) for iOS Home Indicator clearance.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-UI-005: Destructive Action Ambiguity (The Symmetrical Modal)
 */
function checkDestructiveActionAmbiguity(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const deleteRegex = /\b(delete|remove|destroy|purge|löschen|entfernen)\b/i;
  const cancelRegex = /\b(cancel|abbrechen|keep|zurück|close)\b/i;

  const buttons = ctx.allNodes.filter(n => n.name === 'button' || (n.type === 'rect' && n.width < 220 && n.height < 60));
  const deleteBtn = buttons.find(b => deleteRegex.test(getNodeContent(b)) || deleteRegex.test(b.id || ''));
  const cancelBtn = buttons.find(b => cancelRegex.test(getNodeContent(b)) || cancelRegex.test(b.id || ''));

  if (deleteBtn && cancelBtn) {
    const delFill = String(deleteBtn.fill || '');
    const canFill = String(cancelBtn.fill || '');
    if (delFill === canFill && Math.abs(deleteBtn.width - cancelBtn.width) < 10) {
      findings.push({
        code: 'SLOP-UI-005',
        domain: 'layout',
        name: 'Destructive Action Ambiguity (Symmetrical Modal)',
        severity: 'fatal',
        nodeId: deleteBtn.id ? `#${deleteBtn.id}` : '#deleteBtn',
        elementId: deleteBtn.id || deleteBtn.name || 'deleteBtn',
        message: 'Destructive Action Ambiguity: Delete and Cancel buttons have identical visual styling.',
        help: 'Style Cancel as understated secondary ghost button; highlight destructive action in distinct danger color.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-UI-006: Dead Status Pill Overkill (Status Theater)
 */
function checkDeadStatusPillOverkill(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const statusPills = ctx.allNodes.filter(n => {
    if (n.type !== 'rect' || n.height > 34) return false;
    const text = getNodeContent(n).toLowerCase();
    return text.includes('operational') || text.includes('active') || text.includes('online');
  });

  if (statusPills.length >= 8) {
    findings.push({
      code: 'SLOP-UI-006',
      domain: 'layout',
      name: 'Dead Status Pill Overkill (Status Theater)',
      severity: 'warn',
      message: `Status Theater detected: ${statusPills.length} identical "Operational/Active" pills with zero informational variance.`,
      help: 'Practice exception-based reporting: 1 global health indicator in header; reserve row badges for anomalies.'
    });
  }
  return findings;
}

/**
 * SLOP-TYPE-011: Leading Collision & Baseline Strangulation
 */
function checkLeadingCollision(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const fs = node.textLayout?.fontSize || (node.style as any)?.fontSize || 0;
    const lh = node.textLayout?.lineHeight || (fs * 1.2);
    const lines = node.textLayout?.lines || [];

    if (lines.length >= 2 && fs >= 32) {
      const ratio = lh / fs;
      if (ratio < 1.08) {
        findings.push({
          code: 'SLOP-TYPE-011',
          domain: 'typography',
          name: 'Leading Collision & Baseline Strangulation',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#heading',
          elementId: node.id || node.name || 'heading',
          message: `Leading collision on #${node.id || 'text'}: line-height (${lh}px) is only ${(ratio * 100).toFixed(0)}% of font-size (${fs}px).`,
          help: 'Display headlines need minimum 1.15em to 1.25em leading to prevent descenders and umlauts from colliding.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-012: Inconsistent Title/Sentence Case Schizophrenia
 */
function checkInconsistentCasing(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const navNodes = ctx.textNodes.filter(n => (n.id || '').includes('nav') || (n.id || '').includes('menu') || (n.id || '').includes('link'));
  if (navNodes.length >= 3) {
    let titleCaseCount = 0;
    let sentenceCaseCount = 0;
    for (const n of navNodes) {
      const words = getNodeContent(n).trim().split(/\s+/);
      if (words.length >= 2) {
        const isTitle = words.every(w => /^[A-Z]/.test(w));
        const isSentence = /^[A-Z]/.test(words[0]!) && words.slice(1).every(w => /^[a-z]/.test(w));
        if (isTitle) titleCaseCount++;
        else if (isSentence) sentenceCaseCount++;
      }
    }
    if (titleCaseCount >= 1 && sentenceCaseCount >= 1) {
      findings.push({
        code: 'SLOP-TYPE-012',
        domain: 'typography',
        name: 'Inconsistent Title/Sentence Case Schizophrenia',
        severity: 'warn',
        message: `Inconsistent casing in navigation: mixed Title Case (${titleCaseCount}x) and Sentence case (${sentenceCaseCount}x).`,
        help: 'Standardize on a single typographic capitalization rule across all navigational items.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-013: Orphan & Widow Baseline Stragglers
 */
function checkOrphanWidowBaseline(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const lines = node.textLayout?.lines || [];
    if (lines.length >= 3) {
      const lastLine = (lines[lines.length - 1] || '').trim();
      const prevLine = (lines[lines.length - 2] || '').trim();
      if (lastLine.length > 0 && !lastLine.includes(' ') && lastLine.length <= 5 && prevLine.length > 25) {
        findings.push({
          code: 'SLOP-TYPE-013',
          domain: 'typography',
          name: 'Orphan & Widow Baseline Stragglers',
          severity: 'warn',
          nodeId: node.id ? `#${node.id}` : '#text',
          elementId: node.id || node.name || 'text',
          message: `Typographic orphan detected: "${lastLine}" stranded alone on final line of #${node.id || 'paragraph'}.`,
          help: 'Use non-breaking spaces or adjust wrapping width to avoid isolated single short words on final line.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-014: Fractional Sub-Pixel Font Blur
 */
function checkSubpixelFontBlur(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const fractX = Math.abs(node.x - Math.round(node.x));
    const fractY = Math.abs(node.y - Math.round(node.y));
    if ((fractX > 0.15 && fractX < 0.85) || (fractY > 0.15 && fractY < 0.85)) {
      findings.push({
        code: 'SLOP-TYPE-014',
        domain: 'typography',
        name: 'Fractional Sub-Pixel Font Blur',
        severity: 'warn',
        nodeId: node.id ? `#${node.id}` : '#text',
        elementId: node.id || node.name || 'text',
        message: `Fractional coordinates on text #${node.id || 'text'} (${node.x.toFixed(2)}px, ${node.y.toFixed(2)}px) causes rendering blur.`,
        help: 'Round text positions to whole pixels (Math.round) to maintain crisp subpixel font rasterization.'
      });
      break;
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-015: Hierarchy Gap Deficit (The Flat Typographic Wall)
 */
function checkHierarchyGapDeficit(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  if (ctx.textNodes.length >= 4) {
    const fontSizes = ctx.textNodes.map(t => t.textLayout?.fontSize || (t.style as any)?.fontSize || 14).filter(s => s > 0);
    const minFs = Math.min(...fontSizes);
    const maxFs = Math.max(...fontSizes);
    const weights = new Set(ctx.textNodes.map(t => String(t.textLayout?.fontWeight || (t.style as any)?.fontWeight || '400')));

    if (maxFs / minFs < 1.35 && weights.size === 1) {
      findings.push({
        code: 'SLOP-TYPE-015',
        domain: 'typography',
        name: 'Hierarchy Gap Deficit (Flat Typographic Wall)',
        severity: 'fatal',
        message: `Flat typographic hierarchy: Max font size (${maxFs}px) is less than 1.35x body size (${minFs}px) with uniform weight.`,
        help: 'Enforce clear typographic contrast: use modular scales (min 1.5x - 2.5x step) and bold weight jumps for titles.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-GFX-009: Impossible Isometric Spatial Intersection (Escher Glitch)
 */
function checkIsometricSpatialIntersection(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const isoNodes = ctx.allNodes.filter(n => (n.id || '').toLowerCase().includes('iso') || (n.name || '').toLowerCase().includes('iso'));
  if (isoNodes.length >= 2) {
    for (let i = 0; i < isoNodes.length - 1; i++) {
      const a = isoNodes[i]!;
      const b = isoNodes[i + 1]!;
      if (a.y > b.y + 40 && a.zIndex !== undefined && b.zIndex !== undefined && a.zIndex < b.zIndex) {
        findings.push({
          code: 'SLOP-GFX-009',
          domain: 'vectors',
          name: 'Impossible Isometric Spatial Intersection',
          severity: 'fatal',
          nodeId: a.id ? `#${a.id}` : '#isoElement',
          elementId: a.id || a.name || 'isoElement',
          message: `Escher Glitch: Isometric element #${a.id || 'a'} conflicts in depth ordering with #${b.id || 'b'}.`,
          help: 'Sort isometric elements rigorously by calculated spatial depth: Depth = (x + y) / sqrt(2) + z.'
        });
        break;
      }
    }
  }
  return findings;
}

/**
 * SLOP-GFX-010: Faux-Brutalist Decorative Barcode & QR Abuse
 */
function checkFauxBrutalistBarcodeAbuse(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    if (idStr.includes('barcode') || idStr.includes('qrcode') || idStr.includes('qr_code')) {
      const radius = Number(node.style?.borderRadius || 0);
      if (radius > 0) {
        findings.push({
          code: 'SLOP-GFX-010',
          domain: 'vectors',
          name: 'Faux-Brutalist Decorative Barcode Abuse',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#barcode',
          elementId: node.id || node.name || 'barcode',
          message: `Unscannable decorative barcode #${node.id || 'barcode'} has rounded corners (${radius}px radius).`,
          help: 'Barcodes must strictly adhere to ISO standards: 0px border radius, sharp vector edges, and intact quiet zones.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-GFX-011: Telemetry Noise & Pseudocode Greebling
 */
function checkTelemetryGreeblingNoise(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const greebleRegex = /\b(SYS_BOOT|REV-20\d{2}|0x[0-9A-F]{4,}|BUFFER_OVERFLOW|FRAME_RATE|LOC:\[[-0-9.,]+\])\b/i;
  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    const match = content.match(greebleRegex);
    if (match) {
      findings.push({
        code: 'SLOP-GFX-011',
        domain: 'vectors',
        name: 'Telemetry Noise & Pseudocode Greebling',
        severity: 'warn',
        nodeId: node.id ? `#${node.id}` : '#greeble',
        elementId: node.id || node.name || 'greeble',
        message: `Pseudo-technical greebling detected: "${match[0]}" used as decorative techno-fluff.`,
        help: 'Remove fake telemetry strings. Show genuine production metadata or leave confident negative space.'
      });
      break;
    }
  }
  return findings;
}

/**
 * SLOP-GFX-012: The Shader-Toy Iridescent Oil-Slick Blob
 */
function checkIridescentOilSlickBlob(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    if ((node.type === 'path' || node.type === 'polygon' || node.type === 'circle') && (idStr.includes('blob') || idStr.includes('fluid') || idStr.includes('mesh'))) {
      const fillStr = typeof node.fill === 'string' ? node.fill : '';
      const hexMatches = fillStr.match(/#[0-9a-fA-F]{3,8}/g) || [];
      if (hexMatches.length >= 4) {
        findings.push({
          code: 'SLOP-GFX-012',
          domain: 'vectors',
          name: 'Shader-Toy Iridescent Oil-Slick Blob',
          severity: 'warn',
          nodeId: node.id ? `#${node.id}` : '#blob',
          elementId: node.id || node.name || 'blob',
          message: `Iridescent Oil-Slick Blob detected: Complex multi-gradient mesh #${node.id || 'blob'} (${hexMatches.length} hues).`,
          help: 'Replace gratuitous shader blobs with structured product geometry, diagrams, or disciplined typography.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-PRINT-007: Fake Paper Fold Texture without Geometric Displacement
 */
function checkFakePaperFoldTexture(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    if (idStr.includes('crease') || idStr.includes('fold') || idStr.includes('paperfold')) {
      findings.push({
        code: 'SLOP-PRINT-007',
        domain: 'layout',
        name: 'Fake Paper Fold Texture Deficit',
        severity: 'fatal',
        nodeId: node.id ? `#${node.id}` : '#fold',
        elementId: node.id || node.name || 'fold',
        message: 'Fake Paper Fold Overlay detected: 2D vector text runs straight across artificial digital paper crease.',
        help: 'Present print designs honestly as flat 2D vector production art, or model physically accurate displacement.'
      });
      break;
    }
  }
  return findings;
}

/**
 * SLOP-PRINT-008: Pseudo-Swiss Crop Marks in Live Copy Area
 */
function checkCropMarksInLiveArea(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const content = getNodeContent(node).trim();
    if (content === '⌖' || content === '⊕') {
      const margin = Math.min(node.x, node.y, ctx.canvasWidth - (node.x + node.width), ctx.canvasHeight - (node.y + node.height));
      if (margin > 60) {
        findings.push({
          code: 'SLOP-PRINT-008',
          domain: 'vectors',
          name: 'Pseudo-Swiss Crop Marks in Live Copy Area',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#cropMark',
          elementId: node.id || node.name || 'cropMark',
          message: `Crop mark "${content}" placed deep inside live copy area (${Math.round(margin)}px from edge).`,
          help: 'Place printer registration marks strictly in the external slug/bleed zone, never as live layout decor.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-PRINT-009: Analog Laundering (Uniform Noise Washing)
 */
function checkAnalogLaunderingNoise(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    const isFullScreen = node.width >= ctx.canvasWidth * 0.95 && node.height >= ctx.canvasHeight * 0.95;
    if (isFullScreen && (idStr.includes('noise') || idStr.includes('grain') || idStr.includes('sand'))) {
      findings.push({
        code: 'SLOP-PRINT-009',
        domain: 'color',
        name: 'Analog Laundering (Uniform Noise Washing)',
        severity: 'warn',
        nodeId: node.id ? `#${node.id}` : '#noiseLayer',
        elementId: node.id || node.name || 'noiseLayer',
        message: 'Uniform noise wash applied across entire canvas to disguise synthetic AI vector smoothness.',
        help: 'Use authentic tactile substrate textures with luminance-dependent density rather than uniform noise filters.'
      });
      break;
    }
  }
  return findings;
}

/**
 * SLOP-PRINT-010: Gutter Strangulation & Spine Creep Deficit
 */
function checkGutterStrangulation(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  if (ctx.canvasWidth > ctx.canvasHeight * 1.5 && ctx.canvasWidth >= 800) {
    const centerGutter = ctx.canvasWidth / 2;
    const stranglingNodes = ctx.textNodes.filter(t => Math.abs((t.x + t.width / 2) - centerGutter) < 30);
    if (stranglingNodes.length >= 2) {
      findings.push({
        code: 'SLOP-PRINT-010',
        domain: 'layout',
        name: 'Gutter Strangulation & Spine Creep Deficit',
        severity: 'fatal',
        message: 'Gutter Strangulation: Text placed directly across the central spine/binding gutter.',
        help: 'Provide generous inner gutter margin (min 24-30mm) to prevent text from disappearing in the physical fold.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-DASH-002: Monotonic Utopian Curve (Zero-Variance Trendline)
 */
function checkMonotonicUtopianCurve(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    if ((node.type === 'path' || node.type === 'polygon') && (idStr.includes('utopian') || idStr.includes('smoothcurve') || idStr.includes('trendline'))) {
      findings.push({
        code: 'SLOP-DASH-002',
        domain: 'vectors',
        name: 'Monotonic Utopian Curve (Zero-Variance)',
        severity: 'warn',
        nodeId: node.id ? `#${node.id}` : '#trendline',
        elementId: node.id || node.name || 'trendline',
        message: `Monotonic Utopian Trendline #${node.id || 'curve'}: Unrealistic smooth curve with zero real-world data variance.`,
        help: 'Model authentic time-series metrics with natural variance, plateauing, and transparent data points.'
      });
    }
  }
  return findings;
}

/**
 * SLOP-DASH-003: Ghost Axes & Disembodied Datapoints
 */
function checkGhostAxesDatapoints(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    if (idStr.includes('chart') || idStr.includes('graph') || idStr.includes('analytics')) {
      const childTexts = ctx.textNodes.filter(t => t.x >= node.x && t.x + t.width <= node.x + node.width && t.y >= node.y && t.y + t.height <= node.y + node.height);
      const hasNumbers = childTexts.some(t => /[0-9]+%?|\$|€|ms/.test(getNodeContent(t)));
      if (!hasNumbers && node.width > 200 && node.height > 100) {
        findings.push({
          code: 'SLOP-DASH-003',
          domain: 'vectors',
          name: 'Ghost Axes & Disembodied Datapoints',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#chart',
          elementId: node.id || node.name || 'chart',
          message: `Ghost Chart #${node.id || 'chart'}: Visual curve/bars without axes, scales, units, or numeric points.`,
          help: 'Calibrate charts with explicit axes (X time / Y values), numeric units, and baseline anchors.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-DASH-004: Rainbow Spectral Doughnut Catastrophe
 */
function checkRainbowDoughnutCatastrophe(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    if (idStr.includes('donut') || idStr.includes('doughnut') || idStr.includes('pie')) {
      const children = node.children || [];
      if (children.length > 5) {
        findings.push({
          code: 'SLOP-DASH-004',
          domain: 'vectors',
          name: 'Rainbow Spectral Doughnut Catastrophe',
          severity: 'warn',
          nodeId: node.id ? `#${node.id}` : '#donut',
          elementId: node.id || node.name || 'donut',
          message: `Overfragmented Donut Chart #${node.id || 'donut'} with ${children.length} micro-segments.`,
          help: 'Limit donut slices to max 4-5 categories (aggregate rest as "Other") with prominent center KPI value.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-DASH-005: Chromatic Semantic Polarity Inversion
 */
function checkChromaticPolarityInversion(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const negativeMetricsRegex = /-\d+(\.\d+)?%|\b(churn|errors?|drop|loss|failure|latenz)\b/i;
  const greenColors = ['#22c55e', '#10b981', '#16a34a', '#00ff', '#15803d'];

  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    if (negativeMetricsRegex.test(content)) {
      const fillStr = typeof node.fill === 'string' ? node.fill.toLowerCase() : '';
      const colorStr = typeof node.style?.color === 'string' ? node.style.color.toLowerCase() : '';
      const isGreen = greenColors.some(g => fillStr.includes(g) || colorStr.includes(g));
      if (isGreen) {
        findings.push({
          code: 'SLOP-DASH-005',
          domain: 'color',
          name: 'Chromatic Semantic Polarity Inversion',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#invertedMetric',
          elementId: node.id || node.name || 'invertedMetric',
          message: `Polarity Inversion: Negative metric "${content}" is colored in success green.`,
          help: 'Maintain semantic color polarity: green for positive growth/success, red/rose for losses/errors.'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-MOB-001: Desktop-in-a-Box Viewport Scaling (The CSS Zoom Trap)
 */
function checkDesktopInABoxScaling(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  if (ctx.canvasWidth <= 430) {
    for (const node of ctx.allNodes) {
      const scale = typeof node.style?.scale === 'number' ? node.style.scale : (typeof (node.style?.scale as any)?.x === 'number' ? (node.style.scale as any).x : 1.0);
      if (scale < 0.65 && node.width > 300) {
        findings.push({
          code: 'SLOP-MOB-001',
          domain: 'layout',
          name: 'Desktop-in-a-Box Viewport Scaling',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#scaledDesktop',
          elementId: node.id || node.name || 'scaledDesktop',
          message: `CSS Zoom Trap on Mobile: Container #${node.id || 'container'} scaled down by ${Math.round(scale*100)}% to fit viewport.`,
          help: 'Implement genuine responsive reflow: 1-column stacks and min 16px body type instead of zoom scaling.'
        });
        break;
      }
    }
  }
  return findings;
}

/**
 * SLOP-MOB-002: One-Thumb Hostility (Primary Actions in Upper Corner)
 */
function checkOneThumbHostility(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  if (ctx.canvasWidth <= 430 && ctx.canvasHeight >= 650) {
    for (const node of ctx.allNodes) {
      const idStr = (node.id || node.name || '').toLowerCase();
      const isPrimaryCta = idStr.includes('primary') || idStr.includes('maincta') || idStr.includes('buy');
      if (isPrimaryCta && node.y < ctx.canvasHeight * 0.14 && node.x < 120) {
        findings.push({
          code: 'SLOP-MOB-002',
          domain: 'layout',
          name: 'One-Thumb Hostility',
          severity: 'warn',
          nodeId: node.id ? `#${node.id}` : '#primaryCta',
          elementId: node.id || node.name || 'primaryCta',
          message: `Primary CTA #${node.id || 'button'} placed in top-left thumb dead-zone (${Math.round(node.y)}px from top).`,
          help: 'Place primary mobile actions in the bottom thumb comfort zone (e.g. sticky bottom bar).'
        });
      }
    }
  }
  return findings;
}

/**
 * SLOP-COLOR-003: Linear sRGB Dead-Zone Mud Gradient
 */
function checkLinearSrgbMudGradient(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    const fillStr = typeof node.fill === 'string' ? node.fill : '';
    if (fillStr.includes('linear-gradient') && !fillStr.includes('in oklch')) {
      const hexMatches = fillStr.match(/#[0-9a-fA-F]{3,8}/g) || [];
      if (hexMatches.length === 2) {
        const c1 = parseColorToRgba(hexMatches[0]!);
        const c2 = parseColorToRgba(hexMatches[1]!);
        const h1 = rgbToHue(c1.r, c1.g, c1.b);
        const h2 = rgbToHue(c2.r, c2.g, c2.b);
        const delta = calculateHueDistance(h1, h2);
        if (delta >= 100 && delta < 125 && c1.a > 0.6 && c2.a > 0.6) {
          findings.push({
            code: 'SLOP-COLOR-003',
            domain: 'color',
            name: 'Linear sRGB Dead-Zone Mud Gradient',
            severity: 'fatal',
            nodeId: node.id ? `#${node.id}` : '#mudGradient',
            elementId: node.id || node.name || 'mudGradient',
            message: `Linear sRGB Dead-Zone on #${node.id || 'gradient'}: Delta hue is ${delta}° without OKLCH or intermediate bridge stop.`,
            help: 'Add an intermediate saturation bridge or specify OKLCH interpolation to eliminate the gray mud zone.'
          });
        }
      }
    }
  }
  return findings;
}

/**
 * SLOP-WEB-021: Near-Miss Grid Alignment (Das Beinahe-Raster)
 * Flag elements positioned 1px or 2px off from 4px/8px modular design grid
 */
function checkNearMissGridAlignment(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.allNodes) {
    if (node.type === 'rect' || node.type === 'stack' || node.type === 'text') {
      const remX = Math.round(node.x) % 8;
      const remY = Math.round(node.y) % 8;
      // 1px or 7px off 8px grid (meaning off by 1px)
      if ((remX === 1 || remX === 7 || remY === 1 || remY === 7) && node.x > 0 && node.y > 0) {
        findings.push({
          code: 'SLOP-WEB-021',
          domain: 'layout',
          name: 'Near-Miss Grid Alignment (Das Beinahe-Raster)',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#gridElement',
          elementId: node.id || node.name || 'gridElement',
          message: `Near-miss grid misalignment on #${node.id || 'element'}: coordinates (${Math.round(node.x)}px, ${Math.round(node.y)}px) are 1px off the 8px baseline grid.`,
          help: 'Snap coordinates and margins strictly to whole multiples of the 4px/8px modular design token grid.'
        });
        break;
      }
    }
  }
  return findings;
}

/**
 * SLOP-TYPE-018: Smart Quote Chaos
 */
function checkSmartQuoteChaos(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  let straightQuoteCount = 0;
  let curlyQuoteCount = 0;
  let germanQuoteCount = 0;

  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    if (/["']/.test(content)) straightQuoteCount++;
    if (/[“”‘’]/.test(content)) curlyQuoteCount++;
    if (/[„“]/.test(content)) germanQuoteCount++;
  }

  if (straightQuoteCount > 0 && (curlyQuoteCount > 0 || germanQuoteCount > 0)) {
    findings.push({
      code: 'SLOP-TYPE-018',
      domain: 'typography',
      name: 'Smart Quote Chaos',
      severity: 'fatal',
      message: `Mixed quote styles detected across layout: straight typewriter quotes mixed with typographic curly or localized quotes.`,
      help: 'Enforce consistent localized typographic quotes (DE: „...“, EN: “...”, FR: « ... ») across all text blocks.'
    });
  }
  return findings;
}

/**
 * SLOP-TYPE-020: Proportional Figures in Numeric Data (Tabular Figure Misuse)
 */
function checkTabularFigureMisuse(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  for (const node of ctx.textNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    const content = getNodeContent(node);
    const isFinancialOrTable = idStr.includes('price') || idStr.includes('stat') || idStr.includes('kpi') || idStr.includes('table') || idStr.includes('metric');
    if (isFinancialOrTable && /[$€£¥]\s*\d+[\d,.]*/.test(content)) {
      const fontFeatureSettings = (node.style as any)?.fontFeatureSettings || '';
      if (!fontFeatureSettings.includes('tnum')) {
        findings.push({
          code: 'SLOP-TYPE-020',
          domain: 'typography',
          name: 'Tabular Figure Misuse',
          severity: 'fatal',
          nodeId: node.id ? `#${node.id}` : '#numericData',
          elementId: node.id || node.name || 'numericData',
          message: `Tabular Figure Deficit on #${node.id || 'metric'}: Financial value "${content}" rendered without tabular figures ('tnum').`,
          help: 'Activate tabular lining figures (font-feature-settings: "tnum", "lnum") on all financial metrics and tabular columns.'
        });
        break;
      }
    }
  }
  return findings;
}

/**
 * SLOP-PRINT-011: Neon-to-Mud CMYK Gamut Collapse
 */
function checkCmykGamutCollapse(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const dpi = ctx.layout?.canvas?.dpi || 72;
  const isPrintCanvas = dpi >= 150 || (ctx.canvasWidth >= 1200 && (ctx.canvasWidth / ctx.canvasHeight > 1.3 || ctx.canvasHeight / ctx.canvasWidth > 1.3));

  if (!isPrintCanvas) return findings;

  for (const node of ctx.allNodes) {
    const fillStr = extractFillStringOrStops((node as any).fill || (node as any).style?.fill);
    // Detect out-of-gamut neon values (pure #00ffff cyan, #00ff00 neon green, #ff00ff magenta)
    if (/#00ffff|#06b6d4|#ff00ff|#00ff00|#ff0055/i.test(fillStr) || fillStr.includes('rgb(0, 255, 255)') || fillStr.includes('rgb(0, 255, 0)')) {
      const idLabel = node.id ? `#${node.id}` : (node.name || 'shape');
      findings.push({
        code: 'SLOP-PRINT-011',
        domain: 'color',
        name: 'Neon-to-Mud CMYK Gamut Collapse',
        severity: 'fatal',
        nodeId: idLabel,
        elementId: node.id || node.name || 'shape',
        message: `${idLabel}: Out-of-gamut neon RGB color used in print canvas (${fillStr}). Will collapse to muddy gray/brown in 4-color offset printing.`,
        help: 'Use certified ISO coated CMYK values or specify dedicated PANTONE spot colors for neon vibrance.'
      });
      break;
    }
  }
  return findings;
}

/**
 * SLOP-PRINT-012: Bleed and Safety Zone Deficit
 */
function checkBleedAndSafetyDeficit(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const dpi = ctx.layout?.canvas?.dpi || 72;
  const isPrint = dpi >= 150 || ctx.canvasWidth >= 1000;

  if (!isPrint) return findings;

  const width = ctx.canvasWidth;
  const height = ctx.canvasHeight;
  const margin = 12; // 3mm @ typical print scale

  for (const node of ctx.textNodes) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const w = node.width ?? 0;
    const h = node.height ?? 0;

    const marginL = x;
    const marginR = width - (x + w);
    const marginT = y;
    const marginB = height - (y + h);
    const minMargin = Math.min(marginL, marginR, marginT, marginB);

    if (minMargin < margin && w > 50) {
      const idLabel = node.id ? `#${node.id}` : (node.name || 'text');
      findings.push({
        code: 'SLOP-PRINT-012',
        domain: 'layout',
        name: 'Bleed and Safety Zone Deficit',
        severity: 'fatal',
        nodeId: idLabel,
        elementId: node.id || node.name || 'text',
        message: `${idLabel}: Critical text placed within 12px (3mm) mechanical guillotine cutting zone (${Math.round(minMargin)}px from edge). Risk of partial truncation.`,
        help: 'Maintain at least 16px to 24px safety distance from artboard trim boundaries for all live typography.'
      });
      break;
    }
  }
  return findings;
}

/**
 * SLOP-GFX-013: Round-Number Utopia
 */
function checkRoundNumberUtopia(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  let roundMetricsCount = 0;

  for (const node of ctx.textNodes) {
    const content = getNodeContent(node);
    if (/\b(100%|100k|1000\+|100\.000|500k|10k|99\.9%)\b/i.test(content)) {
      roundMetricsCount++;
    }
  }

  if (roundMetricsCount >= 3) {
    findings.push({
      code: 'SLOP-GFX-013',
      domain: 'typography',
      name: 'Round-Number Utopia',
      severity: 'warn',
      message: `Multiple suspiciously round metrics (${roundMetricsCount} occurrences) clustered together. Signs of generative placeholder data.`,
      help: 'Model realistic, unround domain metrics ($97,842, +23.7%, 9,847) with natural seasonal fluctuation.'
    });
  }
  return findings;
}

/**
 * SLOP-LOGO-008: Heraldic Crest Overload
 */
function checkHeraldicOverload(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  let crestElements = 0;
  for (const node of ctx.allNodes) {
    const idStr = (node.id || node.name || '').toLowerCase();
    if (idStr.includes('crown') || idStr.includes('wreath') || idStr.includes('shield') || idStr.includes('laurel') || idStr.includes('crest') || idStr.includes('banner_ribbon')) {
      crestElements++;
    }
  }
  if (crestElements >= 4) {
    findings.push({
      code: 'SLOP-LOGO-008',
      domain: 'vectors',
      name: 'Heraldic Crest Overload',
      severity: 'fatal',
      message: `Heraldic trope clustering: ${crestElements} arbitrary crest/badge symbols combined in single brand layout.`,
      help: 'Radically reduce to 1-2 core visual concepts. Avoid generic stock crests, laurels, and crowns.'
    });
  }
  return findings;
}

/**
 * SLOP-GEOM-002: Versatz bei Verdeckung (Occlusion Continuity Error)
 */
function checkOcclusionContinuity(ctx: SlopContext): SlopRuleResult[] {
  const findings: SlopRuleResult[] = [];
  const lineNodes = ctx.allNodes.filter(n => (n.id || '').toLowerCase().includes('ray') || (n.id || '').toLowerCase().includes('beam') || (n.id || '').toLowerCase().includes('ring_seg'));
  if (lineNodes.length >= 2) {
    for (let i = 0; i < lineNodes.length - 1; i++) {
      const a = lineNodes[i]!;
      const b = lineNodes[i + 1]!;
      const rotA = Number((a as any).rotation ?? a.style?.rotation ?? 0);
      const rotB = Number((b as any).rotation ?? b.style?.rotation ?? 0);
      // Conflicting slopes for purported continuous segments
      if (Math.abs(a.y - b.y) < 50 && Math.abs(rotA - rotB) > 5 && Math.abs(rotA - rotB) < 45) {
        findings.push({
          code: 'SLOP-GEOM-002',
          domain: 'vectors',
          name: 'Versatz bei Verdeckung (Occlusion Continuity Error)',
          severity: 'fatal',
          nodeId: a.id ? `#${a.id}` : '#lineSeg',
          elementId: a.id || a.name || 'lineSeg',
          message: `Occluded segment axis fracture: #${a.id} and #${b.id} diverge across intersection by ${Math.abs(rotA - rotB)}°.`,
          help: 'Project occluded geometry across obstacles along a continuous collinear axis.'
        });
        break;
      }
    }
  }
  return findings;
}

// ============================================================================
// 3. Master Anti-Slop Audit Orchestrator
// ============================================================================

export function runAntiSlopAudit(ctx: SlopContext): SlopRuleResult[] {
  const results: SlopRuleResult[] = [];

  // Domain A: Layout & Containers (Web & SaaS)
  results.push(...checkPurpleHaze(ctx));
  results.push(...checkBentoOverkill(ctx));
  results.push(...checkFloatingDebris(ctx));
  results.push(...checkRainbowPills(ctx));
  results.push(...checkSoapBarRadii(ctx));
  results.push(...checkHorrorVacui(ctx));
  results.push(...checkLeftBorderStripe(ctx));
  results.push(...checkTripletClones(ctx));
  results.push(...checkConcentricRadiiMismatch(ctx));
  results.push(...checkLivePulseBadge(ctx));
  results.push(...checkRussianDollNesting(ctx));
  results.push(...checkFakeSocialProofAvatarPile(ctx));
  results.push(...checkStereotypicalHeroFormula(ctx));
  results.push(...checkVoidGlowHalo(ctx));
  results.push(...checkInfiniteTestimonialGrid(ctx));
  results.push(...checkNearMissGridAlignment(ctx));

  // Domain B: UI/UX & Lighting Physics
  results.push(...checkContradictoryVirtualLighting(ctx));
  results.push(...checkLuminousInvertedShadows(ctx));
  results.push(...checkGlassmorphismContrastCollapse(ctx));
  results.push(...checkSafeAreaBlindness(ctx));
  results.push(...checkDestructiveActionAmbiguity(ctx));
  results.push(...checkDeadStatusPillOverkill(ctx));

  // Domain C: Typography & Micro-Copy
  results.push(...checkBuzzwords(ctx));
  results.push(...checkTypoMonoculture(ctx));
  results.push(...checkCenteredProse(ctx));
  results.push(...checkUnspacedAllCaps(ctx));
  results.push(...checkEmDashInflation(ctx));
  results.push(...checkSparkleOveruse(ctx));
  results.push(...checkMegalithicQuote(ctx));
  results.push(...checkTelemetryGpsStamping(ctx));
  results.push(...checkLeadingCollision(ctx));
  results.push(...checkInconsistentCasing(ctx));
  results.push(...checkOrphanWidowBaseline(ctx));
  results.push(...checkSubpixelFontBlur(ctx));
  results.push(...checkHierarchyGapDeficit(ctx));
  results.push(...checkSmartQuoteChaos(ctx));
  results.push(...checkTabularFigureMisuse(ctx));

  // Domain D: Colors & Gradients
  results.push(...checkMuddyGradients(ctx));
  results.push(...checkCyberpunkSpectrum(ctx));
  results.push(...checkMudShadow(ctx));
  results.push(...checkLinearSrgbMudGradient(ctx));
  results.push(...checkCmykGamutCollapse(ctx));

  // Domain E: Vectors, Icons & Greebling
  results.push(...checkEmojiIcons(ctx));
  results.push(...checkIconStrokeConsistency(ctx));
  results.push(...checkAssetSignatures(ctx));
  results.push(...checkDummyRemnants(ctx));
  results.push(...checkFaviconMicroDetails(ctx));
  results.push(...checkSwissSlopCosplay(ctx));
  results.push(...checkHeroFakeDashboard(ctx));
  results.push(...checkIsometricSpatialIntersection(ctx));
  results.push(...checkFauxBrutalistBarcodeAbuse(ctx));
  results.push(...checkTelemetryGreeblingNoise(ctx));
  results.push(...checkIridescentOilSlickBlob(ctx));
  results.push(...checkHeraldicOverload(ctx));
  results.push(...checkOcclusionContinuity(ctx));

  // Domain F: Print, Editorial & Poster
  results.push(...checkFakePaperFoldTexture(ctx));
  results.push(...checkCropMarksInLiveArea(ctx));
  results.push(...checkAnalogLaunderingNoise(ctx));
  results.push(...checkGutterStrangulation(ctx));
  results.push(...checkBleedAndSafetyDeficit(ctx));

  // Domain G: Dashboards & Data Visualization
  results.push(...checkMonotonicUtopianCurve(ctx));
  results.push(...checkGhostAxesDatapoints(ctx));
  results.push(...checkRainbowDoughnutCatastrophe(ctx));
  results.push(...checkChromaticPolarityInversion(ctx));
  results.push(...checkRoundNumberUtopia(ctx));

  // Domain H: Mobile UX & Touch Ergonomics
  results.push(...checkDesktopInABoxScaling(ctx));
  results.push(...checkOneThumbHostility(ctx));

  return results;
}

