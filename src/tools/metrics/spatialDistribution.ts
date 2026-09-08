/**
 * src/tools/metrics/spatialDistribution.ts
 * Computational Visual Design Metrics: Spatial Distribution, Visual Mass,
 * Voronoi Whitespace Gini Coefficient, and Horror Vacui Index.
 */

import { LayoutNode } from '../../parser/math.js';

export interface OpticalCentroidResult {
  geometricCenter: { x: number; y: number };
  visualMassCenter: { x: number; y: number };
  deltaXPercent: number;
  deltaYPercent: number;
  naturalEyeDisplacementPercent: number; // compared to (W/2, 0.44*H)
  quadrantMass: {
    topLeftPercent: number;
    topRightPercent: number;
    bottomLeftPercent: number;
    bottomRightPercent: number;
  };
  balanceStatus: string;
}

export interface WhitespaceDistributionResult {
  voronoiGini: number; // 0.0 (uniform noise) to 1.0 (extreme clustering)
  horrorVacuiIndex: number; // 0.0 to 1.0 (>0.65 = severe clutter)
  status: 'optimal' | 'uniform_noise' | 'clustered' | 'clutter_overload';
  message: string;
}

/**
 * Calculates the Center of Visual Mass and Quadrant Balance.
 */
export function calculateOpticalCentroid(
  nodes: LayoutNode[],
  canvasWidth: number,
  canvasHeight: number
): OpticalCentroidResult {
  const geomCenter = { x: Math.round(canvasWidth / 2), y: Math.round(canvasHeight / 2) };
  const naturalCenter = { x: canvasWidth / 2, y: canvasHeight * 0.44 };

  if (nodes.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return {
      geometricCenter: geomCenter,
      visualMassCenter: geomCenter,
      deltaXPercent: 0,
      deltaYPercent: 0,
      naturalEyeDisplacementPercent: 0,
      quadrantMass: { topLeftPercent: 25, topRightPercent: 25, bottomLeftPercent: 25, bottomRightPercent: 25 },
      balanceStatus: 'Balanced'
    };
  }

  let totalWeightedMass = 0;
  let weightedSumX = 0;
  let weightedSumY = 0;

  let qTL = 0;
  let qTR = 0;
  let qBL = 0;
  let qBR = 0;

  for (const node of nodes) {
    // Skip full-canvas background rects
    if (node.type === 'rect' && node.width >= canvasWidth * 0.98 && node.height >= canvasHeight * 0.98) {
      continue;
    }

    // Skip transparent containers whose children are already present to avoid duplicate mass
    const isContainer = node.type === 'group' || node.type === 'stack' || node.type === 'grid' || Boolean(node.children && node.children.length > 0);
    const hasVisualSurface = Boolean(
      node.fill ||
      node.stroke ||
      node.strokeColor ||
      node.style?.fill ||
      node.style?.stroke ||
      (node.style as any)?.shadow ||
      (node.style as any)?.outerGlow
    );
    if (isContainer && !hasVisualSurface) {
      continue;
    }

    const w = Math.max(1, node.width || 1);
    const h = Math.max(1, node.height || 1);
    const cx = (node.x || 0) + w / 2;
    const cy = (node.y || 0) + h / 2;

    // Weight factor based on node prominence
    let weight = 1.0;
    if (node.type === 'text') {
      const fs = node.textLayout?.fontSize || 14;
      weight = (fs / 14) * 1.5;
      const fw = String(node.textLayout?.fontWeight || '400');
      if (fw === 'bold' || fw === '700' || fw === '800' || fw === '900') weight *= 1.3;
    } else if (node.type === 'image') {
      weight = 1.2;
    }

    const area = w * h;
    const mass = Math.sqrt(area) * weight;

    weightedSumX += cx * mass;
    weightedSumY += cy * mass;
    totalWeightedMass += mass;

    // Quadrant accumulation
    if (cx < geomCenter.x && cy < geomCenter.y) qTL += mass;
    else if (cx >= geomCenter.x && cy < geomCenter.y) qTR += mass;
    else if (cx < geomCenter.x && cy >= geomCenter.y) qBL += mass;
    else qBR += mass;
  }

  const vmcX = totalWeightedMass > 0 ? Math.round(weightedSumX / totalWeightedMass) : geomCenter.x;
  const vmcY = totalWeightedMass > 0 ? Math.round(weightedSumY / totalWeightedMass) : geomCenter.y;

  const deltaXPercent = Math.round(((vmcX - geomCenter.x) / canvasWidth) * 1000) / 10;
  const deltaYPercent = Math.round(((vmcY - geomCenter.y) / canvasHeight) * 1000) / 10;

  const naturalDist = Math.hypot(vmcX - naturalCenter.x, vmcY - naturalCenter.y);
  const maxDim = Math.hypot(canvasWidth, canvasHeight);
  const naturalEyeDisplacementPercent = Math.round((naturalDist / maxDim) * 1000) / 10;

  const totalQ = Math.max(0.001, qTL + qTR + qBL + qBR);
  const qTLPct = Math.round((qTL / totalQ) * 100);
  const qTRPct = Math.round((qTR / totalQ) * 100);
  const qBLPct = Math.round((qBL / totalQ) * 100);
  const qBRPct = Math.max(0, 100 - (qTLPct + qTRPct + qBLPct));

  let balanceStatus = 'Zentriert / Harmonisch';
  if (deltaYPercent < -10 && Math.abs(deltaXPercent) <= 10) balanceStatus = 'Leicht kopflastig (Klassischer Hero-Fokus)';
  else if (deltaYPercent < -10 && deltaXPercent < -8) balanceStatus = 'Kopflastig linkszentriert (Editorial-Stil)';
  else if (deltaYPercent > 12) balanceStatus = 'Bauchlastig / Nach unten wegsackend';
  else if (deltaXPercent > 15) balanceStatus = 'Stark rechtslastig';
  else if (deltaXPercent < -15) balanceStatus = 'Stark linkslastig';

  return {
    geometricCenter: geomCenter,
    visualMassCenter: { x: vmcX, y: vmcY },
    deltaXPercent,
    deltaYPercent,
    naturalEyeDisplacementPercent,
    quadrantMass: {
      topLeftPercent: qTLPct,
      topRightPercent: qTRPct,
      bottomLeftPercent: qBLPct,
      bottomRightPercent: qBRPct
    },
    balanceStatus
  };
}

/**
 * Calculates the Voronoi Whitespace Gini Coefficient and Horror Vacui Index.
 *
 * Gini < 0.28: Uniform noise / artificial clutter (Horror Vacui).
 * Gini in [0.45, 0.75]: Masterful tension between dense information & generous negative space.
 */
export function calculateWhitespaceDistribution(
  nodes: LayoutNode[],
  canvasWidth: number,
  canvasHeight: number,
  negativeSpacePercent: number,
  bleed: number = 0
): WhitespaceDistributionResult {
  const bleedOffset = Math.max(0, bleed);
  const totalW = canvasWidth + bleedOffset * 2;
  const totalH = canvasHeight + bleedOffset * 2;

  const visibleNodes = nodes.filter(n => {
    if (n.type === 'rect' && n.width >= canvasWidth * 0.98 && n.height >= canvasHeight * 0.98) return false;
    if ((n.width || 0) <= 0 || (n.height || 0) <= 0) return false;

    // Filter out transparent layout containers whose centroids duplicate their children's centroids
    const isContainer = n.type === 'group' || n.type === 'stack' || n.type === 'grid' || Boolean(n.children && n.children.length > 0);
    const hasVisualSurface = Boolean(
      n.fill ||
      n.stroke ||
      n.strokeColor ||
      n.style?.fill ||
      n.style?.stroke ||
      (n.style as any)?.shadow ||
      (n.style as any)?.outerGlow
    );
    if (isContainer && !hasVisualSurface) {
      return false;
    }

    return true;
  });

  if (visibleNodes.length < 3 || totalW <= 0 || totalH <= 0) {
    return {
      voronoiGini: 0.5,
      horrorVacuiIndex: Math.max(0, 1 - negativeSpacePercent / 100),
      status: 'optimal',
      message: 'Ausreichender Negativraum vorhanden.'
    };
  }

  // Centroids of visible nodes
  const centroids = visibleNodes.map(n => ({
    x: (n.x || 0) + (n.width || 1) / 2,
    y: (n.y || 0) + (n.height || 1) / 2
  }));

  // Discretize canvas into a sampling grid (30x30 = 900 points) to compute approximate Voronoi cells
  const GRID_COLS = 30;
  const GRID_ROWS = 30;
  const cellCounts = new Array(centroids.length).fill(0);

  const stepX = totalW / GRID_COLS;
  const stepY = totalH / GRID_ROWS;
  const startX = -bleedOffset;
  const startY = -bleedOffset;

  for (let r = 0; r < GRID_ROWS; r++) {
    const py = startY + (r + 0.5) * stepY;
    for (let c = 0; c < GRID_COLS; c++) {
      const px = startX + (c + 0.5) * stepX;

      let nearestIdx = 0;
      let minSqDist = Infinity;

      for (let i = 0; i < centroids.length; i++) {
        const centroid = centroids[i]!;
        const dx = px - centroid.x;
        const dy = py - centroid.y;
        const sqDist = dx * dx + dy * dy;
        if (sqDist < minSqDist) {
          minSqDist = sqDist;
          nearestIdx = i;
        }
      }

      cellCounts[nearestIdx]++;
    }
  }

  // Calculate Gini coefficient over cellCounts
  const n = cellCounts.length;
  const sorted = [...cellCounts].sort((a, b) => a - b);
  const totalSum = sorted.reduce((acc, val) => acc + val, 0);

  let gini = 0.5;
  if (totalSum > 0 && n > 1) {
    let diffSum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        diffSum += Math.abs(sorted[i]! - sorted[j]!);
      }
    }
    gini = Math.round((diffSum / (2 * n * totalSum)) * 100) / 100;
  }

  // Horror Vacui Index: combines negative space scarcity with element count
  const negRatio = Math.max(0, Math.min(1, negativeSpacePercent / 100));
  const optimalNodes = Math.max(6, Math.min(24, Math.round((totalW * totalH) / 50000)));
  const crowdingFactor = 1 + Math.log(1 + Math.max(0, visibleNodes.length / optimalNodes));
  const hvi = Math.round(Math.min(1, (1 - negRatio) * (crowdingFactor * 0.6)) * 100) / 100;

  let status: WhitespaceDistributionResult['status'] = 'optimal';
  let message = 'Vorbildliche Raumspannung & disziplinierter Weißraum.';

  if (hvi > 0.65) {
    status = 'clutter_overload';
    message = 'Clutter Overload: Canvas leidet unter generativer Überfüllung.';
  } else if (gini < 0.28) {
    status = 'uniform_noise';
    message = 'Gleichförmiges Rauschen (Horror Vacui): Elemente ohne Fokus über Fläche verteilt.';
  } else if (gini > 0.80) {
    status = 'clustered';
    message = 'Extrem asymmetrische Ballung: Inhalte kleben isoliert in einer Ecke.';
  }

  return {
    voronoiGini: gini,
    horrorVacuiIndex: hvi,
    status,
    message
  };
}
