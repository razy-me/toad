/**
 * TOAD DSL — Formal Abstract Syntax Tree & Type Declarations
 * Target Engines: Headless Skia, W3C SVG 1.1/2.0, Adobe Photoshop PSD
 * Language Version: 3.0
 */

export type DimensionUnit = 'px' | '%' | 'pt' | 'mm' | 'cm' | 'in' | 'em' | 'rem' | 'deg' | 'rad';

export interface Dimension {
  value: number;
  unit: DimensionUnit;
}

export type SizeMode = 'hug' | 'fill' | Dimension | number;

export type FontWeight =
  | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
  | 'thin' | 'extralight' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export type AnchorEdge =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'above' | 'below' | 'left of' | 'right of'
  | 'inside';

export interface RelationalAnchor {
  edge: AnchorEdge;
  targetId: string | 'canvas' | 'parent';
  offsetX?: number | Dimension;
  offsetY?: number | Dimension;
}

export type ColorHex = `#${string}`;

export interface ColorAlpha {
  fn: 'alpha';
  color: ColorHex | string;
  opacity: number;
}

export interface GradientStop {
  color: string;
  position: number; // 0.0 to 1.0 or percentage
}

export interface LinearGradient {
  type: 'linear';
  angle?: number | string; // e.g. 135deg, 'to bottom'
  stops: GradientStop[];
}

export interface RadialGradient {
  type: 'radial';
  cx?: number | string;
  cy?: number | string;
  stops: GradientStop[];
}

export type PaintFill = ColorHex | ColorAlpha | LinearGradient | RadialGradient | 'transparent';

export interface DropShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread?: number;
  color: string;
  inset?: boolean;
}

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export interface BaseNode {
  id?: string;
  name?: string;
  at?: RelationalAnchor | [number | Dimension, number | Dimension];
  rotation?: number; // degrees
  scale?: number;
  opacity?: number; // 0.0 to 1.0
  blendMode?: BlendMode;
  shadow?: DropShadow | DropShadow[];
  filter?: string;
  clip?: boolean | string; // sibling mask reference
}

export interface CanvasNode {
  type: 'canvas';
  name: string;
  width: Dimension | number;
  height: Dimension | number;
  background?: PaintFill;
  fontFamily?: string;
  dpi?: number;
  bleed?: Dimension | number;
  cropMarks?: boolean;
  colorMode?: 'rgb' | 'cmyk';
  export?: 'all' | 'png' | 'svg' | 'psd' | 'jpg' | 'webp';
  children: ElementNode[];
}

export interface RectNode extends BaseNode {
  type: 'rect';
  width?: SizeMode;
  height?: SizeMode;
  size?: [SizeMode, SizeMode] | SizeMode;
  fill?: PaintFill;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number | [number, number, number, number];
  fillOpacity?: number; // Photoshop fillOpacity (0.0 to 1.0)
  layerColor?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'gray' | 'none';
  lock?: 'position' | 'transparency' | 'all';
  children?: ElementNode[];
}

export interface CircleNode extends BaseNode {
  type: 'circle';
  radius: number | Dimension;
  fill?: PaintFill;
  stroke?: string;
  strokeWidth?: number;
}

export interface PathNode extends BaseNode {
  type: 'path';
  d: string; // SVG path data
  fill?: PaintFill;
  stroke?: string;
  strokeWidth?: number;
}

export interface PolygonNode extends BaseNode {
  type: 'polygon';
  points: Array<[number | Dimension, number | Dimension]>;
  fill?: PaintFill;
  stroke?: string;
  strokeWidth?: number;
}

export interface TextNode extends BaseNode {
  type: 'text';
  content: string;
  fontFamily?: string;
  fontSize?: number | Dimension;
  fontWeight?: FontWeight;
  lineHeight?: number;
  letterSpacing?: number | Dimension;
  color?: string; // Text glyph color (CANNOT use fill on text)
  align?: TextAlign;
  size?: SizeMode; // Explicit multiline wrapping width
  width?: SizeMode;
  fontFeatures?: string;
  fontVariation?: string;
}

export interface ImageNode extends BaseNode {
  type: 'image';
  src: string;
  size?: [SizeMode, SizeMode] | SizeMode;
  fit?: 'cover' | 'contain' | 'fill';
}

export interface GroupNode extends BaseNode {
  type: 'group';
  children: ElementNode[];
}

export interface StackNode extends BaseNode {
  type: 'stack';
  direction: 'horizontal' | 'vertical';
  gap: number | Dimension;
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  padding?: number | Dimension | [number, number] | [number, number, number, number];
  children: ElementNode[];
}

export interface GridNode extends BaseNode {
  type: 'grid';
  columns: string | number; // e.g. "repeat(3, 1fr)" or 3
  rows?: string | number;
  gap: number | Dimension;
  children: ElementNode[];
}

export interface SlotNode {
  type: 'slot';
}

export interface ComponentDeclaration {
  type: 'component';
  name: string;
  parameters: Array<{
    name: string;
    defaultValue?: any;
  }>;
  elements: ElementNode[];
}

export type ElementNode =
  | RectNode
  | CircleNode
  | PathNode
  | PolygonNode
  | TextNode
  | ImageNode
  | GroupNode
  | StackNode
  | GridNode
  | SlotNode;
