/**
 * src/tools/antiSlopRules.ts
 * Dedicated Anti-AI-Slop Engine & Aesthetic Heuristics Matrix for TOAD DSL.
 *
 * Implements 26 deterministic, mathematical, and AST-driven heuristics based on:
 * - the_seed/rules/anti_ai_slop_donts.yaml
 * - the_seed/rules/anti_ai_slop_heuristics.xml
 * - Modern 2024-2026 AI Design Tropes & Aesthetic Tells
 */

import { LayoutNode, LayoutResult } from '../parser/math.js';
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
  { pattern: /\brevolutioniere(n\s+sie)?\s+(ihren|deinen)\s+(workflow|arbeitsalltag)\b/i, severity: 'fatal', label: 'Deutsches Revolutioniere-Klischee' },
  { pattern: /\bnahtlos(e)?\s+(synergie|integration|skalierung)\b/i, severity: 'fatal', label: 'Nahtlose Synergie' },
  { pattern: /\bdas\s+nächste\s+level\b/i, severity: 'warn', label: 'Nächstes Level Floskel' },
  { pattern: /\bvollautomatisch\s+ohne\s+aufwand\b/i, severity: 'warn', label: 'Vollautomatisch ohne Aufwand' },
  { pattern: /\bzukunftssicher(e\s+technologie)?\b/i, severity: 'warn', label: 'Zukunftssicher Floskel' },
  { pattern: /\bpotenzial(e)?\s+entfesseln\b/i, severity: 'warn', label: 'Potenziale entfesseln' }
];

// System emoji pattern (SLOP-CODE-005)
const RAW_EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

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
      const fillStr = typeof node.fill === 'string' ? node.fill.toLowerCase() : '';
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
      const fillStr = typeof node.fill === 'string' ? node.fill.toLowerCase() : '';

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
        help: 'Axiom UNI-04: Fließtext mit mehr als 2 Zeilen MUSS immer linksbündig (align: left;) stehen. Zentriere nur 1-zeilige Badges oder H1s.'
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
        help: 'Axiom UNI-04: Großbuchstaben (ALL CAPS) MÜSSEN immer gesperrt werden (letter-spacing: 0.08em; bis 0.15em;) um Glyphen-Verklebungen zu vermeiden.'
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

// ============================================================================
// 3. Master Anti-Slop Audit Orchestrator
// ============================================================================

export function runAntiSlopAudit(ctx: SlopContext): SlopRuleResult[] {
  const results: SlopRuleResult[] = [];

  // Domain A: Layout & Containers
  results.push(...checkPurpleHaze(ctx));
  results.push(...checkBentoOverkill(ctx));
  results.push(...checkFloatingDebris(ctx));
  results.push(...checkRainbowPills(ctx));
  results.push(...checkSoapBarRadii(ctx));
  results.push(...checkHorrorVacui(ctx));
  results.push(...checkLeftBorderStripe(ctx));
  results.push(...checkTripletClones(ctx));

  // Domain B: Typography & Micro-Copy
  results.push(...checkBuzzwords(ctx));
  results.push(...checkTypoMonoculture(ctx));
  results.push(...checkCenteredProse(ctx));
  results.push(...checkUnspacedAllCaps(ctx));
  results.push(...checkEmDashInflation(ctx));
  results.push(...checkSparkleOveruse(ctx));

  // Domain C: Colors & Gradients
  results.push(...checkMuddyGradients(ctx));
  results.push(...checkCyberpunkSpectrum(ctx));
  results.push(...checkMudShadow(ctx));

  // Domain D: Vectors, Icons & Assets
  results.push(...checkEmojiIcons(ctx));
  results.push(...checkIconStrokeConsistency(ctx));
  results.push(...checkAssetSignatures(ctx));
  results.push(...checkDummyRemnants(ctx));
  results.push(...checkFaviconMicroDetails(ctx));

  return results;
}
