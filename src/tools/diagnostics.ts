export const KNOWN_PROPERTIES = [
  'size', 'dimensions', 'width', 'height', 'fill', 'color', 'background', 'background-color', 'backgroundColor',
  'radius', 'borderRadius', 'border-radius', 'shadow', 'box-shadow', 'drop-shadow', 'inner-shadow', 'innerShadow',
  'glow', 'outer-glow', 'outerGlow', 'inner-glow', 'innerGlow', 'bevel', 'bevel-emboss', 'bevelEmboss',
  'layer-stroke', 'layerStroke', 'overlay', 'color-overlay', 'colorOverlay', 'gradient-overlay', 'gradientOverlay',
  'opacity', 'stroke', 'stroke-width', 'strokeWidth', 'stroke-style', 'strokeStyle',
  'stroke-cap', 'strokeCap', 'cap', 'stroke-join', 'strokeJoin', 'join',
  'font', 'font-family', 'fontFamily', 'font-size', 'fontSize', 'font-weight', 'fontWeight', 'weight',
  'font-style', 'fontStyle', 'style', 'line-height', 'lineHeight', 'letter-spacing', 'letterSpacing', 'tracking',
  'text-transform', 'textTransform', 'content', 'text', 'wrap-width', 'wrapWidth', 'max-lines', 'maxLines', 'overflow',
  'vertical-align', 'verticalAlign', 'font-features', 'fontFeatures', 'font-variation', 'fontVariation',
  'hanging-punctuation', 'hangingPunctuation',
  'margin', 'padding', 'gap', 'column-gap', 'columnGap', 'row-gap', 'rowGap', 'flow',
  'direction', 'align', 'text-align', 'columns', 'at', 'position', 'rotation', 'scale', 'scales',
  'skewX', 'skewY', 'skew-x', 'skew-y',
  'transform-origin', 'transformOrigin', 'clip', 'mask', 'blend-mode', 'blendMode',
  'filter', 'backdrop-filter', 'backdropFilter', 'export', 'exports', 'format', 'formats',
  'ratio', 'aspect-ratio', 'aspectRatio', 'resolution', 'density', 'quality', 'compress', 'compression', 'preset',
  'bleed', 'crop-marks', 'cropMarks', 'dpi', 'color-mode', 'colorMode',
  'src', 'fit', 'points', 'd', 'path', 'iconName', 'icon-name', 'shapeType', 'z-index', 'zIndex',
  'layer-color', 'layerColor', 'fill-opacity', 'fillOpacity', 'lock', 'protected', 'knockout', 'shadows',
  'guides', 'guide', 'global-light', 'globalLight'
];

/**
 * Calculates the Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Given an unknown property name, returns the closest matching known property,
 * or null if no reasonable match is found.
 */
export function suggestProperty(unknownProp: string, threshold = 3): string | null {
  let closestMatch: string | null = null;
  let minDistance = Infinity;

  const normalizedUnknown = unknownProp.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const prop of KNOWN_PROPERTIES) {
    const normalizedProp = prop.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Quick skip for very different lengths to save compute
    if (Math.abs(normalizedProp.length - normalizedUnknown.length) > threshold) {
      continue;
    }

    const distance = levenshteinDistance(normalizedUnknown, normalizedProp);
    if (distance < minDistance && distance <= threshold) {
      minDistance = distance;
      closestMatch = prop;
    }
  }

  // If the suggestion is exactly the same after normalization, it was just a casing/dash issue!
  return closestMatch;
}
