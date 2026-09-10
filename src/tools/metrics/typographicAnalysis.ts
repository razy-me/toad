/**
 * src/tools/metrics/typographicAnalysis.ts
 * Computational Typographic Analysis: Modular Scale Regression (R²),
 * Margin Entropy (Rag Consistency), All-Caps Tracking Ratio, and Leading Fidelity.
 */

import { LayoutNode } from '../../parser/math.js';

export interface ModularScaleFitResult {
  bestScaleName: string;
  bestRatio: number;
  r2Score: number; // 0.00 to 1.00
  baseFontSize: number;
  distinctSizes: number[];
  outliers: number[];
  isHarmonious: boolean;
  message: string;
}

export interface TypographicTelemetryResult {
  modularScale: ModularScaleFitResult;
  marginEntropy: number; // 0.00 = pure left align, > 0.5 = ragged/centered variations
  hasCenteredProse: boolean;
  unspacedAllCapsCount: number;
  leadingCollisionsCount: number;
}

const CLASSIC_SCALES: Array<{ name: string; ratio: number }> = [
  { name: 'Minor Second', ratio: 1.067 },
  { name: 'Major Second', ratio: 1.125 },
  { name: 'Minor Third', ratio: 1.200 },
  { name: 'Major Third', ratio: 1.250 },
  { name: 'Perfect Fourth', ratio: 1.333 },
  { name: 'Augmented Fourth', ratio: 1.414 },
  { name: 'Perfect Fifth', ratio: 1.500 },
  { name: 'Golden Ratio', ratio: 1.618 }
];

/**
 * Fits active font sizes against classical modular typographic scales.
 */
export function calculateModularScaleFidelity(textNodes: LayoutNode[]): ModularScaleFitResult {
  const sizes = new Set<number>();
  for (const node of textNodes) {
    const fs = node.textLayout?.fontSize || (typeof (node.style as any)?.fontSize === 'number' ? (node.style as any).fontSize : 0);
    if (fs && fs > 4 && fs < 500) {
      sizes.add(Math.round(fs * 10) / 10);
    }
  }

  const distinctSizes = Array.from(sizes).sort((a, b) => a - b);

  if (distinctSizes.length < 2) {
    return {
      bestScaleName: 'Single Scale',
      bestRatio: 1.0,
      r2Score: 1.0,
      baseFontSize: distinctSizes[0] || 16,
      distinctSizes,
      outliers: [],
      isHarmonious: true,
      message: 'Fokussierte typografische Hierarchie (1–2 Schriftgrade).'
    };
  }

  // Mean of observed sizes
  const mean = distinctSizes.reduce((a, b) => a + b, 0) / distinctSizes.length;
  const ssTotal = distinctSizes.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0);

  let bestScale = CLASSIC_SCALES[3]!; // Default to Major Third (1.25)
  let bestR2 = -Infinity;
  let bestBase = distinctSizes[0] || 16;
  let bestOutliers: number[] = [];

  for (const scale of CLASSIC_SCALES) {
    const r = scale.ratio;

    // Test candidate bases from lower half of sizes
    const candidates = distinctSizes.slice(0, Math.min(3, distinctSizes.length));
    for (const base of candidates) {
      let ssRes = 0;
      const outliers: number[] = [];

      for (const s of distinctSizes) {
        // Step k = round(log_r(s / base))
        const k = Math.round(Math.log(s / base) / Math.log(r));
        const expected = base * Math.pow(r, k);
        const diff = Math.abs(s - expected);
        const relDiff = diff / s;

        if (relDiff > 0.12) {
          outliers.push(s);
        }
        ssRes += Math.pow(s - expected, 2);
      }

      const r2 = ssTotal > 0 ? Math.max(0, 1 - ssRes / ssTotal) : 1;
      if (r2 > bestR2) {
        bestR2 = r2;
        bestScale = scale;
        bestBase = base;
        bestOutliers = outliers;
      }
    }
  }

  const clampedR2 = Math.round(Math.max(0, Math.min(1, bestR2)) * 100) / 100;
  const isHarmonious = clampedR2 >= 0.88;

  let message = `Harmonious scale: ${bestScale.name} (${bestScale.ratio.toFixed(3)}) with R² = ${clampedR2.toFixed(2)}`;
  if (!isHarmonious) {
    message = `Inconsistent font sizes (R² = ${clampedR2.toFixed(2)}): ${bestOutliers.length} outlier(s) deviate from ${bestScale.name}.`;
  }

  return {
    bestScaleName: bestScale.name,
    bestRatio: bestScale.ratio,
    r2Score: clampedR2,
    baseFontSize: bestBase,
    distinctSizes,
    outliers: bestOutliers,
    isHarmonious,
    message
  };
}

/**
 * Runs full typographic telemetry: scale fitting, margin entropy, leading collision, all-caps tracking.
 */
export function analyzeTypographicTelemetry(textNodes: LayoutNode[]): TypographicTelemetryResult {
  const modularScale = calculateModularScaleFidelity(textNodes);

  let unspacedAllCapsCount = 0;
  let leadingCollisionsCount = 0;
  let hasCenteredProse = false;
  let centeredProseCount = 0;
  let multiLineProseCount = 0;

  for (const node of textNodes) {
    const fs = node.textLayout?.fontSize || 14;
    const lh = node.textLayout?.lineHeight || (fs * 1.2);
    const lines = node.textLayout?.lines || [];

    // Leading collision check: lineHeight / fontSize < 1.08 on headings or < 1.3 on body
    const ratio = lh / fs;
    if ((fs >= 28 && ratio < 1.08 && lines.length >= 2) || (fs < 28 && ratio < 1.25 && lines.length >= 3)) {
      leadingCollisionsCount++;
    }

    // Centered prose detection
    const align = node.style?.align || 'left';
    if (lines.length >= 3 || (lines.length === 2 && lines.join(' ').length > 80)) {
      multiLineProseCount++;
      if (align === 'center') {
        hasCenteredProse = true;
        centeredProseCount++;
      }
    }

    // All-caps tracking check
    const content = (node.content || lines.join(' ')).trim();
    const isAllCaps = content.length > 3 && content === content.toUpperCase() && /[A-Z]/.test(content);
    if (isAllCaps) {
      const ls = node.style?.letterSpacing || 0;
      if (ls <= 0) {
        unspacedAllCapsCount++;
      }
    }
  }

  const marginEntropy = multiLineProseCount > 0 ? Math.round((centeredProseCount / multiLineProseCount) * 100) / 100 : 0;

  return {
    modularScale,
    marginEntropy,
    hasCenteredProse,
    unspacedAllCapsCount,
    leadingCollisionsCount
  };
}
