/**
 * src/engine/vectorPathParser.ts
 * Converts arbitrary SVG path strings (M, L, H, V, C, S, Q, T, A, Z) into
 * native Photoshop Bézier paths and knots (BezierPath / BezierKnot) for ag-psd.
 */

import { BezierKnot, BezierPath } from 'ag-psd';

interface Point {
  x: number;
  y: number;
}

interface CubicSegment {
  p0: Point; // Start
  cp1: Point; // Control point 1
  cp2: Point; // Control point 2
  p1: Point; // End
}

/**
 * Tokenizes an SVG path 'd' attribute into commands and numeric arguments.
 */
function tokenizeSvgPath(d: string): Array<{ command: string; args: number[] }> {
  const result: Array<{ command: string; args: number[] }> = [];
  const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?))/g;

  let currentCmd = '';
  let currentArgs: number[] = [];

  let match: RegExpExecArray | null;
  while ((match = commandRegex.exec(d)) !== null) {
    if (match[1]) {
      // Command letter
      if (currentCmd) {
        result.push({ command: currentCmd, args: currentArgs });
      }
      currentCmd = match[1];
      currentArgs = [];
    } else if (match[2]) {
      // Number argument
      currentArgs.push(parseFloat(match[2]));
    }
  }

  if (currentCmd) {
    result.push({ command: currentCmd, args: currentArgs });
  }

  return result;
}

/**
 * Converts an SVG Elliptical Arc to one or more cubic Bézier segments.
 */
function arcToCubicSegments(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  xAxisRotationDeg: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number,
  y2: number
): CubicSegment[] {
  if (x1 === x2 && y1 === y2) return [];

  // Zero radii -> straight line
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) {
    return [
      {
        p0: { x: x1, y: y1 },
        cp1: { x: x1, y: y1 },
        cp2: { x: x2, y: y2 },
        p1: { x: x2, y: y2 }
      }
    ];
  }

  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute (x1', y1')
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Ensure radii are large enough
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);
    rx *= sqrtLambda;
    ry *= sqrtLambda;
  }

  // Step 2: Compute (cx', cy')
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;

  let sq = (rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2) / (rx2 * y1p2 + ry2 * x1p2);
  if (sq < 0) sq = 0;
  let factor = Math.sqrt(sq);
  if (largeArcFlag === sweepFlag) factor = -factor;

  const cxp = factor * ((rx * y1p) / ry);
  const cyp = factor * (-(ry * x1p) / rx);

  // Step 3: Compute center (cx, cy) from (cx', cy')
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 4: Compute theta1 and deltaTheta
  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    let ang = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let deltaTheta = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );

  if (!sweepFlag && deltaTheta > 0) {
    deltaTheta -= 2 * Math.PI;
  } else if (sweepFlag && deltaTheta < 0) {
    deltaTheta += 2 * Math.PI;
  }

  // Step 5: Split the arc into segments of at most PI / 2
  const segmentsCount = Math.max(1, Math.ceil(Math.abs(deltaTheta) / (Math.PI / 2)));
  const dTheta = deltaTheta / segmentsCount;

  const segments: CubicSegment[] = [];
  let t = theta1;

  for (let i = 0; i < segmentsCount; i++) {
    const tEnd = t + dTheta;
    const alpha = (Math.sin(dTheta) * (Math.sqrt(4 + 3 * Math.tan(dTheta / 2) * Math.tan(dTheta / 2)) - 1)) / 3;

    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const cosTEnd = Math.cos(tEnd);
    const sinTEnd = Math.sin(tEnd);

    // Points on unit circle
    const ep0x = cosPhi * rx * cosT - sinPhi * ry * sinT + cx;
    const ep0y = sinPhi * rx * cosT + cosPhi * ry * sinT + cy;

    const d0x = -cosPhi * rx * sinT - sinPhi * ry * cosT;
    const d0y = -sinPhi * rx * sinT + cosPhi * ry * cosT;

    const ep1x = cosPhi * rx * cosTEnd - sinPhi * ry * sinTEnd + cx;
    const ep1y = sinPhi * rx * cosTEnd + cosPhi * ry * sinTEnd + cy;

    const d1x = -cosPhi * rx * sinTEnd - sinPhi * ry * cosTEnd;
    const d1y = -sinPhi * rx * sinTEnd + cosPhi * ry * cosTEnd;

    segments.push({
      p0: { x: ep0x, y: ep0y },
      cp1: { x: ep0x + alpha * d0x, y: ep0y + alpha * d0y },
      cp2: { x: ep1x - alpha * d1x, y: ep1y - alpha * d1y },
      p1: { x: ep1x, y: ep1y }
    });

    t = tEnd;
  }

  return segments;
}

/**
 * Parses an SVG path `d` string into a list of cubic curves per subpath.
 */
function svgPathToSubpaths(d: string): Array<{ closed: boolean; segments: CubicSegment[] }> {
  const commands = tokenizeSvgPath(d);
  const subpaths: Array<{ closed: boolean; segments: CubicSegment[] }> = [];

  let currentSubpath: { closed: boolean; segments: CubicSegment[] } = { closed: false, segments: [] };
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let lastCpX: number | null = null;
  let lastCpY: number | null = null;

  for (const item of commands) {
    const { command, args } = item;
    const isRel = command === command.toLowerCase();
    const type = command.toUpperCase();

    let i = 0;
    let currentType = type;
    while (i < args.length || (currentType === 'Z' && i === 0)) {
      switch (currentType) {
        case 'M': {
          const x = isRel ? curX + args[i]! : args[i]!;
          const y = isRel ? curY + args[i + 1]! : args[i + 1]!;
          i += 2;

          if (currentSubpath.segments.length > 0) {
            subpaths.push(currentSubpath);
            currentSubpath = { closed: false, segments: [] };
          }

          curX = x;
          curY = y;
          startX = x;
          startY = y;
          lastCpX = null;
          lastCpY = null;
          // Per W3C SVG specification: If a moveto is followed by multiple pairs of
          // coordinates, the subsequent pairs are treated as implicit lineto commands.
          currentType = 'L';
          break;
        }
        case 'L': {
          const x = isRel ? curX + args[i]! : args[i]!;
          const y = isRel ? curY + args[i + 1]! : args[i + 1]!;
          i += 2;
          currentSubpath.segments.push({
            p0: { x: curX, y: curY },
            cp1: { x: curX, y: curY },
            cp2: { x: x, y: y },
            p1: { x: x, y: y }
          });
          curX = x;
          curY = y;
          lastCpX = null;
          lastCpY = null;
          break;
        }
        case 'H': {
          const x = isRel ? curX + args[i]! : args[i]!;
          i += 1;
          currentSubpath.segments.push({
            p0: { x: curX, y: curY },
            cp1: { x: curX, y: curY },
            cp2: { x: x, y: curY },
            p1: { x: x, y: curY }
          });
          curX = x;
          lastCpX = null;
          lastCpY = null;
          break;
        }
        case 'V': {
          const y = isRel ? curY + args[i]! : args[i]!;
          i += 1;
          currentSubpath.segments.push({
            p0: { x: curX, y: curY },
            cp1: { x: curX, y: curY },
            cp2: { x: curX, y: y },
            p1: { x: curX, y: y }
          });
          curY = y;
          lastCpX = null;
          lastCpY = null;
          break;
        }
        case 'C': {
          const cp1x = isRel ? curX + args[i]! : args[i]!;
          const cp1y = isRel ? curY + args[i + 1]! : args[i + 1]!;
          const cp2x = isRel ? curX + args[i + 2]! : args[i + 2]!;
          const cp2y = isRel ? curY + args[i + 3]! : args[i + 3]!;
          const endX = isRel ? curX + args[i + 4]! : args[i + 4]!;
          const endY = isRel ? curY + args[i + 5]! : args[i + 5]!;
          i += 6;

          currentSubpath.segments.push({
            p0: { x: curX, y: curY },
            cp1: { x: cp1x, y: cp1y },
            cp2: { x: cp2x, y: cp2y },
            p1: { x: endX, y: endY }
          });

          lastCpX = cp2x;
          lastCpY = cp2y;
          curX = endX;
          curY = endY;
          break;
        }
        case 'S': {
          // Smooth cubic curve: cp1 is reflection of lastCp or cur if none
          let cp1x = curX;
          let cp1y = curY;
          if (lastCpX !== null && lastCpY !== null) {
            cp1x = 2 * curX - lastCpX;
            cp1y = 2 * curY - lastCpY;
          }
          const cp2x = isRel ? curX + args[i]! : args[i]!;
          const cp2y = isRel ? curY + args[i + 1]! : args[i + 1]!;
          const endX = isRel ? curX + args[i + 2]! : args[i + 2]!;
          const endY = isRel ? curY + args[i + 3]! : args[i + 3]!;
          i += 4;

          currentSubpath.segments.push({
            p0: { x: curX, y: curY },
            cp1: { x: cp1x, y: cp1y },
            cp2: { x: cp2x, y: cp2y },
            p1: { x: endX, y: endY }
          });

          lastCpX = cp2x;
          lastCpY = cp2y;
          curX = endX;
          curY = endY;
          break;
        }
        case 'Q': {
          // Quadratic curve -> convert to cubic
          const qcx = isRel ? curX + args[i]! : args[i]!;
          const qcy = isRel ? curY + args[i + 1]! : args[i + 1]!;
          const endX = isRel ? curX + args[i + 2]! : args[i + 2]!;
          const endY = isRel ? curY + args[i + 3]! : args[i + 3]!;
          i += 4;

          const cp1x = curX + (2 / 3) * (qcx - curX);
          const cp1y = curY + (2 / 3) * (qcy - curY);
          const cp2x = endX + (2 / 3) * (qcx - endX);
          const cp2y = endY + (2 / 3) * (qcy - endY);

          currentSubpath.segments.push({
            p0: { x: curX, y: curY },
            cp1: { x: cp1x, y: cp1y },
            cp2: { x: cp2x, y: cp2y },
            p1: { x: endX, y: endY }
          });

          lastCpX = qcx;
          lastCpY = qcy;
          curX = endX;
          curY = endY;
          break;
        }
        case 'T': {
          // Smooth quadratic curve
          let qcx = curX;
          let qcy = curY;
          if (lastCpX !== null && lastCpY !== null) {
            qcx = 2 * curX - lastCpX;
            qcy = 2 * curY - lastCpY;
          }
          const endX = isRel ? curX + args[i]! : args[i]!;
          const endY = isRel ? curY + args[i + 1]! : args[i + 1]!;
          i += 2;

          const cp1x = curX + (2 / 3) * (qcx - curX);
          const cp1y = curY + (2 / 3) * (qcy - curY);
          const cp2x = endX + (2 / 3) * (qcx - endX);
          const cp2y = endY + (2 / 3) * (qcy - endY);

          currentSubpath.segments.push({
            p0: { x: curX, y: curY },
            cp1: { x: cp1x, y: cp1y },
            cp2: { x: cp2x, y: cp2y },
            p1: { x: endX, y: endY }
          });

          lastCpX = qcx;
          lastCpY = qcy;
          curX = endX;
          curY = endY;
          break;
        }
        case 'A': {
          const rx = args[i]!;
          const ry = args[i + 1]!;
          const xRot = args[i + 2]!;
          const largeArc = args[i + 3]!;
          const sweep = args[i + 4]!;
          const endX = isRel ? curX + args[i + 5]! : args[i + 5]!;
          const endY = isRel ? curY + args[i + 6]! : args[i + 6]!;
          i += 7;

          const arcSegs = arcToCubicSegments(curX, curY, rx, ry, xRot, largeArc, sweep, endX, endY);
          for (const seg of arcSegs) {
            currentSubpath.segments.push(seg);
          }

          curX = endX;
          curY = endY;
          lastCpX = null;
          lastCpY = null;
          break;
        }
        case 'Z': {
          i++;
          currentSubpath.closed = true;
          // Add closing segment if not already at start
          if (Math.abs(curX - startX) > 1e-4 || Math.abs(curY - startY) > 1e-4) {
            currentSubpath.segments.push({
              p0: { x: curX, y: curY },
              cp1: { x: curX, y: curY },
              cp2: { x: startX, y: startY },
              p1: { x: startX, y: startY }
            });
          }
          curX = startX;
          curY = startY;
          lastCpX = null;
          lastCpY = null;
          break;
        }
        default:
          i++;
          break;
      }
    }
  }

  if (currentSubpath.segments.length > 0) {
    subpaths.push(currentSubpath);
  }

  return subpaths;
}

/**
 * Converts cubic segments into an array of ag-psd BezierKnot structures.
 *
 * Each BezierKnot points array has 6 coordinates:
 * [backwardControlPointX, backwardControlPointY, anchorX, anchorY, forwardControlPointX, forwardControlPointY]
 */
function cubicSegmentsToBezierKnots(
  segments: CubicSegment[],
  closed: boolean,
  offsetX = 0,
  offsetY = 0,
  scale = 1
): BezierKnot[] {
  if (segments.length === 0) return [];

  const knots: BezierKnot[] = [];
  const n = segments.length;

  for (let i = 0; i < n; i++) {
    const seg = segments[i]!;
    const prevSeg = i === 0 ? (closed ? segments[n - 1]! : null) : segments[i - 1]!;

    const anchorX = (seg.p0.x + offsetX) * scale;
    const anchorY = (seg.p0.y + offsetY) * scale;

    const fwdX = (seg.cp1.x + offsetX) * scale;
    const fwdY = (seg.cp1.y + offsetY) * scale;

    let bwdX = anchorX;
    let bwdY = anchorY;
    if (prevSeg) {
      bwdX = (prevSeg.cp2.x + offsetX) * scale;
      bwdY = (prevSeg.cp2.y + offsetY) * scale;
    }

    knots.push({
      linked: false,
      points: [bwdX, bwdY, anchorX, anchorY, fwdX, fwdY]
    });
  }

  // If path is open, add the last endpoint knot
  if (!closed) {
    const lastSeg = segments[n - 1]!;
    const anchorX = (lastSeg.p1.x + offsetX) * scale;
    const anchorY = (lastSeg.p1.y + offsetY) * scale;
    const bwdX = (lastSeg.cp2.x + offsetX) * scale;
    const bwdY = (lastSeg.cp2.y + offsetY) * scale;

    knots.push({
      linked: false,
      points: [bwdX, bwdY, anchorX, anchorY, anchorX, anchorY]
    });
  }

  return knots;
}

export interface ConvertPathOptions {
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  fillRule?: 'even-odd' | 'non-zero';
  scaleWidth?: number; // Target width (e.g. for icons 24 -> targetWidth)
  scaleHeight?: number;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
}

/**
 * Converts an arbitrary SVG path 'd' string into native Photoshop BezierPaths for ag-psd.
 */
export function svgPathToBezierPaths(
  d: string,
  options: ConvertPathOptions = {}
): BezierPath[] {
  if (!d || !d.trim()) return [];

  const subpaths = svgPathToSubpaths(d);
  if (subpaths.length === 0) return [];

  const scale = options.scale ?? 1;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const fillRule = options.fillRule ?? 'non-zero';

  // Optional icon viewBox scale factor (e.g. Lucide default 24x24)
  let sx = 1;
  let sy = 1;
  if (options.scaleWidth && options.viewBoxWidth) {
    sx = options.scaleWidth / options.viewBoxWidth;
  }
  if (options.scaleHeight && options.viewBoxHeight) {
    sy = options.scaleHeight / options.viewBoxHeight;
  }

  const bezierPaths: BezierPath[] = [];

  for (let sIdx = 0; sIdx < subpaths.length; sIdx++) {
    const sp = subpaths[sIdx]!;
    if (sp.segments.length === 0) continue;

    // Apply viewBox scaling if needed
    const transformedSegments = (sx !== 1 || sy !== 1)
      ? sp.segments.map(seg => ({
          p0: { x: seg.p0.x * sx, y: seg.p0.y * sy },
          cp1: { x: seg.cp1.x * sx, y: seg.cp1.y * sy },
          cp2: { x: seg.cp2.x * sx, y: seg.cp2.y * sy },
          p1: { x: seg.p1.x * sx, y: seg.p1.y * sy }
        }))
      : sp.segments;

    const knots = cubicSegmentsToBezierKnots(
      transformedSegments,
      sp.closed,
      offsetX,
      offsetY,
      scale
    );

    if (knots.length > 0) {
      bezierPaths.push({
        open: !sp.closed,
        operation: 'combine',
        fillRule,
        knots
      });
    }
  }

  return bezierPaths;
}
