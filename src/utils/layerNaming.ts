/**
 * src/utils/layerNaming.ts
 * Human & Semantic Layer Naming Engine for TOAD PSD and SVG Exporters.
 *
 * Resolves natural, readable layer names for Photoshop layers and SVG vector
 * elements (data-name, inkscape:label, <title>).
 */

export interface LayerNamingContext {
  parentName?: string;
  parentType?: string;
  siblingIndex?: number;
  totalSiblings?: number;
  siblingCountsByType?: Map<string, number>;
  humanizeLayerNames?: boolean;
}

/**
 * Transforms code identifiers (camelCase, PascalCase, snake_case, kebab-case)
 * into human-readable Title Case strings.
 *
 * Examples:
 *   - "heroCard" -> "Hero Card"
 *   - "hero_card_banner" -> "Hero Card Banner"
 *   - "user-profile-pic" -> "User Profile Pic"
 *   - "bgHexagon1" -> "Bg Hexagon 1"
 *   - "card1" -> "Card 1"
 *   - "btnSave" -> "Btn Save"
 *   - "URL" -> "URL"
 */
export function humanizeIdentifier(rawId: string): string {
  if (!rawId || typeof rawId !== 'string') return '';

  // Clean out any synthetic prefixes if accidentally passed
  let s = rawId.replace(/^__auto_\d+/, '').replace(/^inst\d+_/, '');
  if (!s) return '';

  // Replace underscores and hyphens with spaces
  s = s.replace(/[-_]+/g, ' ');

  // Insert space between lowercase letter and uppercase letter (camelCase)
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  // Insert space between consecutive uppercase letters followed by lowercase (e.g. "SVGExport" -> "SVG Export")
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  // Insert space between letters and numbers ("card1" -> "Card 1", "level2Box" -> "level 2 Box")
  s = s.replace(/([a-zA-Z])([0-9]+)/g, '$1 $2');
  s = s.replace(/([0-9]+)([a-zA-Z])/g, '$1 $2');

  // Split into words, clean whitespace and capitalize each word
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const acronyms = new Set(['URL', 'SVG', 'PSD', 'PNG', 'JPG', 'CSS', 'DOM', 'HTML', 'XML', 'API', 'CTA', 'UI', 'UX', 'ID', 'FX']);

  return words.map(w => {
    const upper = w.toUpperCase();
    if (acronyms.has(upper)) return upper;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

/**
 * Sanitizes and truncates a text string for use in layer names:
 * - Collapses newlines and multiple whitespace characters into single spaces
 * - Truncates cleanly at word boundaries if exceeding maxLen
 * - Appends ellipsis if truncated
 */
export function sanitizeTextSnippet(text: string, maxLen = 30): string {
  if (!text || typeof text !== 'string') return '';
  const clean = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;

  const targetCut = maxLen - 3;
  const lastSpace = clean.lastIndexOf(' ', targetCut);
  const cutIndex = lastSpace > Math.floor(maxLen * 0.4) ? lastSpace : targetCut;
  return clean.slice(0, cutIndex).trim() + '...';
}

/**
 * Formats a text layer name following user convention: "<TEXT> Text".
 * Example: "Willkommen zurück" -> "Willkommen zurück Text"
 */
export function formatTextLayerName(textSnippet: string): string {
  const clean = textSnippet.trim();
  if (!clean) return 'Text';
  return `${clean} Text`;
}

/**
 * Extracts a humanized label from an image source path or URL.
 * Example: "./assets/team_avatar_profile.png" -> "Team Avatar Profile"
 */
export function extractFilenameLabel(src: string): string {
  if (!src || typeof src !== 'string' || src.startsWith('data:')) {
    return 'Image';
  }
  try {
    // Strip query strings and hash
    const cleanUrl = src.split('?')[0]?.split('#')[0] || src;
    const parts = cleanUrl.split(/[\/\\]/);
    const filename = parts[parts.length - 1] || '';
    const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, '');
    if (!nameWithoutExt) return 'Image';
    const humanized = humanizeIdentifier(nameWithoutExt);
    return humanized || 'Image';
  } catch {
    return 'Image';
  }
}

/**
 * Converts any string into a safe, valid XML/SVG id attribute.
 */
export function toSafeXmlId(nameOrId: string): string {
  if (!nameOrId || typeof nameOrId !== 'string') return 'elem';
  let safe = nameOrId
    .replace(/[\s:/\\._]+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
  if (/^[0-9]/.test(safe)) safe = 'el-' + safe;
  return safe || 'elem';
}

/**
 * Master semantic layer name resolution function.
 * Evaluates node properties, hierarchy, and context to produce a natural, human-friendly name.
 */
export function resolveHumanLayerName(node: any, context?: LayerNamingContext): string {
  const humanize = context?.humanizeLayerNames === true;

  // 1. Explicitly assigned name string (e.g. rect "Hero Card" or name: "Hero Card")
  if (
    node.name &&
    typeof node.name === 'string' &&
    node.name.trim() !== '' &&
    node.name !== node.id &&
    node.name !== node.type &&
    !node.name.startsWith('__auto_') &&
    !node.name.startsWith('inst')
  ) {
    return node.name.trim();
  }

  const rawType = (node.type || '').toLowerCase();
  const rawId = typeof node.id === 'string' ? node.id : '';
  const isSynthetic = !rawId || rawId.startsWith('__auto_') || (node as any).isSyntheticId;

  // 2. Type-specific semantic rules
  if (rawType === 'text') {
    let content = '';
    if (node.textLayout && Array.isArray(node.textLayout.lines) && node.textLayout.lines.length > 0) {
      content = node.textLayout.lines.join(' ');
    } else if (typeof node.text === 'string' && node.text) {
      content = node.text;
    } else if (typeof (node as any).content === 'string' && (node as any).content) {
      content = (node as any).content;
    }

    if (content && !content.startsWith('>')) {
      const snippet = sanitizeTextSnippet(content, 30);
      return formatTextLayerName(snippet);
    } else if (content && content.startsWith('>')) {
      const varName = humanize ? humanizeIdentifier(content.slice(1)) : content.slice(1);
      return formatTextLayerName(varName);
    } else if (!isSynthetic && rawId) {
      const idName = humanize ? humanizeIdentifier(rawId) : rawId;
      return formatTextLayerName(idName);
    }
    return 'Text';
  }

  if (rawType === 'image') {
    const src = node.imageLayout?.src || node.src || '';
    if (src) {
      const fnLabel = extractFilenameLabel(src);
      if (fnLabel && fnLabel !== 'Image') {
        return fnLabel;
      }
    }
    if (!isSynthetic && rawId) {
      return humanize ? humanizeIdentifier(rawId) : rawId;
    }
    return 'Image';
  }

  if (rawType === 'icon') {
    const iconName = node.iconName || node.name || node.pathLayout?.iconName;
    if (iconName && typeof iconName === 'string' && iconName !== 'icon' && !iconName.startsWith('__auto_')) {
      return `${humanizeIdentifier(iconName)} Icon`;
    }
    if (!isSynthetic && rawId) {
      return `${humanize ? humanizeIdentifier(rawId) : rawId} Icon`;
    }
    return 'Icon';
  }

  if (rawType === 'rect') {
    // Check if it acts as a clipping mask
    if (node.style?.clip === true || (node as any).clip === true) {
      return 'Clipping Mask';
    }

    // Check if it acts as a background in a container (only if anonymous)
    const isFirstSibling = context?.siblingIndex === 0;
    const hasParent = Boolean(context?.parentType && context?.parentType !== 'canvas');
    if (isFirstSibling && hasParent && (node.fill || node.style?.fill) && isSynthetic) {
      if (context?.parentName && !context.parentName.startsWith('__auto_')) {
        return `${context.parentName} Background`;
      }
      return 'Background';
    }

    if (!isSynthetic && rawId) {
      return humanize ? humanizeIdentifier(rawId) : rawId;
    }

    const radius = node.style?.borderRadius || (node as any).borderRadius;
    const isRounded = (typeof radius === 'number' && radius > 0) || (Array.isArray(radius) && radius.some((r: any) => r > 0));
    const baseName = isRounded ? 'Rounded Rectangle' : 'Rectangle';

    const count = context?.siblingCountsByType?.get('rect');
    if (count && count > 1 && context?.siblingIndex !== undefined) {
      return `${baseName} ${context.siblingIndex + 1}`;
    }
    return baseName;
  }

  if (rawType === 'circle') {
    if (!isSynthetic && rawId) {
      return humanize ? humanizeIdentifier(rawId) : rawId;
    }
    const isEllipse = node.width && node.height && Math.abs(node.width - node.height) > 1;
    return isEllipse ? 'Ellipse' : 'Circle';
  }

  if (rawType === 'polygon') {
    if (!isSynthetic && rawId) {
      return humanize ? humanizeIdentifier(rawId) : rawId;
    }
    const pts = node.polygonLayout?.points || (node as any).points;
    if (Array.isArray(pts)) {
      if (pts.length === 3) return 'Triangle';
      if (pts.length === 6) return 'Hexagon';
      if (pts.length === 8) return 'Octagon';
    }
    return 'Polygon';
  }

  if (rawType === 'star') {
    return !isSynthetic && rawId ? (humanize ? humanizeIdentifier(rawId) : rawId) : 'Star';
  }
  if (rawType === 'triangle') {
    return !isSynthetic && rawId ? (humanize ? humanizeIdentifier(rawId) : rawId) : 'Triangle';
  }
  if (rawType === 'arrow') {
    return !isSynthetic && rawId ? (humanize ? humanizeIdentifier(rawId) : rawId) : 'Arrow';
  }
  if (rawType === 'cross') {
    return !isSynthetic && rawId ? (humanize ? humanizeIdentifier(rawId) : rawId) : 'Cross';
  }
  if (rawType === 'path' || rawType === 'shape') {
    return !isSynthetic && rawId ? (humanize ? humanizeIdentifier(rawId) : rawId) : 'Vector Path';
  }

  if (rawType === 'stack') {
    if (!isSynthetic && rawId) {
      return humanize ? humanizeIdentifier(rawId) : rawId;
    }
    const dir = node.stackLayout?.direction || (node as any).direction;
    if (dir === 'horizontal') return 'Horizontal Stack';
    if (dir === 'vertical') return 'Vertical Stack';
    return 'Stack';
  }

  if (rawType === 'grid') {
    if (!isSynthetic && rawId) {
      return humanize ? humanizeIdentifier(rawId) : rawId;
    }
    return 'Grid';
  }

  if (rawType === 'group') {
    if (!isSynthetic && rawId) {
      return humanize ? humanizeIdentifier(rawId) : rawId;
    }
    if ((node as any).isComponent) {
      return (node as any).componentName ? humanizeIdentifier((node as any).componentName) : 'Component';
    }
    return 'Group';
  }

  // 3. Fallback to explicit ID if available
  if (!isSynthetic && rawId) {
    return humanize ? humanizeIdentifier(rawId) : rawId;
  }

  // 4. Default type capitalized
  const typeFallback = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : 'Layer';
  return typeFallback;
}
