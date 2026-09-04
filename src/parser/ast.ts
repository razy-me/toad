/**
 * src/parser/ast.ts
 * Authoritative TypeScript AST Node Definitions for the "toad" language.
 */

// ============================================================================
// 1. Source Location & Metadata
// ============================================================================

export interface Position {
  line: number;    // 1-based line number
  column: number;  // 1-based column number
  offset: number;  // 0-based byte/character offset
}

export interface SourceLocation {
  start: Position;
  end: Position;
  file?: string;   // File path for multi-file ASTs
}

export interface BaseNode {
  type: string;
  loc: SourceLocation;
}

// ============================================================================
// 2. Document & Directives
// ============================================================================

export interface DocumentNode extends BaseNode {
  type: 'Document';
  directives: DirectiveNode[];
  variables: VariableDeclarationNode[];
  components: ComponentDeclarationNode[];
  canvas?: CanvasDeclarationNode;
  canvases?: CanvasDeclarationNode[];
  elements: ElementNode[];
  diagnostics?: Diagnostic[];
}

export type DirectiveNode = ImportDirectiveNode | FontDirectiveNode;

export interface ImportDirectiveNode extends BaseNode {
  type: 'ImportDirective';
  path: string; // Quoted string value resolved, e.g. "./tokens.toad"
}

export interface FontDirectiveNode extends BaseNode {
  type: 'FontDirective';
  path: string;   // Path to font binary, e.g. "./fonts/Inter-Bold.ttf"
  family: string; // Registered family name, e.g. "Inter"
  weight?: string | number;
  style?: 'normal' | 'italic' | 'oblique';
}

// ============================================================================
// 3. Variables & Components
// ============================================================================

export interface VariableDeclarationNode extends BaseNode {
  type: 'VariableDeclaration';
  name: string; // Identifier without leading '>'
  value: ValueNode;
}

export interface ComponentParameterNode extends BaseNode {
  type: 'ComponentParameter';
  name: string;
  defaultValue?: ValueNode;
}

export interface ComponentDeclarationNode extends BaseNode {
  type: 'ComponentDeclaration';
  name: string;
  parameters: ComponentParameterNode[];
  properties: PropertyNode[];
  elements: ElementNode[];
}

// ============================================================================
// 4. Canvas & Elements
// ============================================================================

export interface CanvasDeclarationNode extends BaseNode {
  type: 'CanvasDeclaration';
  name?: string;
  mode?: 'graphic' | 'photo';
  photoSrc?: string;
  properties: PropertyNode[];
  elements?: ElementNode[];
}

export type ElementType =
  | 'rect'
  | 'circle'
  | 'text'
  | 'polygon'
  | 'path'
  | 'image'
  | 'adjust'
  | 'group'
  | 'grid'
  | 'stack'
  | 'component_instance'
  | 'icon'
  | 'shape'
  | 'slot';

export type ElementNode =
  | RectElementNode
  | CircleElementNode
  | TextElementNode
  | PolygonElementNode
  | PathElementNode
  | ImageElementNode
  | AdjustElementNode
  | GroupElementNode
  | GridElementNode
  | StackElementNode
  | ComponentInstanceNode
  | IconElementNode
  | ShapeElementNode
  | SlotElementNode;

export interface BaseElementNode extends BaseNode {
  id?: string;            // e.g. "#header" -> "header"
  name?: string;          // Human-readable layer name
  properties: PropertyNode[];
  children?: ElementNode[];
}

export interface RectElementNode extends BaseElementNode {
  type: 'RectElement';
}

export interface CircleElementNode extends BaseElementNode {
  type: 'CircleElement';
}

export interface TextElementNode extends BaseElementNode {
  type: 'TextElement';
  text?: string;          // Extracted text content shorthand if specified in header
}

export interface PolygonElementNode extends BaseElementNode {
  type: 'PolygonElement';
}

export interface PathElementNode extends BaseElementNode {
  type: 'PathElement';
}

export interface ImageElementNode extends BaseElementNode {
  type: 'ImageElement';
}

export interface AdjustElementNode extends BaseElementNode {
  type: 'AdjustElement';
}

export interface GroupElementNode extends BaseElementNode {
  type: 'GroupElement';
  children: ElementNode[];
}

export interface GridElementNode extends BaseElementNode {
  type: 'GridElement';
  children: ElementNode[];
}

export interface StackElementNode extends BaseElementNode {
  type: 'StackElement';
  children: ElementNode[];
}

export interface ComponentArgumentNode extends BaseNode {
  type: 'ComponentArgument';
  name?: string;          // Named argument name, or undefined if positional
  value: ValueNode;
}

export interface ComponentInstanceNode extends BaseElementNode {
  type: 'ComponentInstance';
  componentName: string;
  arguments: ComponentArgumentNode[];
  children?: ElementNode[];
}

export interface IconElementNode extends BaseElementNode {
  type: 'IconElement';
  iconName?: string;
}

export type ShapeType = 'star' | 'triangle' | 'arrow' | 'cross';

export interface ShapeElementNode extends BaseElementNode {
  type: 'ShapeElement';
  shapeType: ShapeType;
}

export interface SlotElementNode extends BaseElementNode {
  type: 'SlotElement';
}

// ============================================================================
// 5. Properties & Values
// ============================================================================

export interface PropertyNode extends BaseNode {
  type: 'Property';
  name: string;           // e.g. 'at', 'size', 'fill', 'stroke', 'font', 'filter'
  value: ValueNode;
}

export type ValueNode =
  // Literals
  | NumberLiteralNode
  | DimensionLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | ColorLiteralNode
  | IdentifierNode
  | VariableReferenceNode
  | ElementReferenceNode
  | ObjectLiteralNode
  // Complex values
  | CoordinateValueNode
  | RelationalPositionNode
  | GradientValueNode
  | FilterValueNode
  | StrokeValueNode
  | FontValueNode
  | PointsValueNode
  | ArrayLiteralNode
  | ExpressionListNode
  | ColorTransformNode
  | CalcValueNode;

export interface CalcValueNode extends BaseNode {
  type: 'CalcValue';
  expression: string; // The raw string inside calc() for now, or we can parse it later
}

export interface ObjectLiteralNode extends BaseNode {
  type: 'ObjectLiteral';
  properties: Record<string, ValueNode>;
}

export interface ColorTransformNode extends BaseNode {
  type: 'ColorTransform';
  functionName: 'alpha' | 'lighten' | 'darken';
  color: ValueNode;
  amount: ValueNode;
}

// --- Literal Nodes ---

export interface NumberLiteralNode extends BaseNode {
  type: 'NumberLiteral';
  value: number;
  raw: string;
}

export type UnitType = 'px' | '%' | 'deg' | 'rad' | 'em' | 'rem' | 'pt' | 'vw' | 'vh' | 'mm' | 'cm' | 'in';

export interface DimensionLiteralNode extends BaseNode {
  type: 'DimensionLiteral';
  value: number;
  unit: UnitType;
  raw: string;
}

export interface StringLiteralNode extends BaseNode {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteralNode extends BaseNode {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface ColorLiteralNode extends BaseNode {
  type: 'ColorLiteral';
  format: 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'cmyk' | 'named' | 'currentColor';
  value: string;         // Canonical normalized string e.g. "#3b82f6" or "cmyk(0%, 100%, 100%, 0%)"
  r?: number;
  g?: number;
  b?: number;
  a?: number;
  c?: number;
  m?: number;
  y?: number;
  k?: number;
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface VariableReferenceNode extends BaseNode {
  type: 'VariableReference';
  name: string;          // Variable name without '>'
}

export interface ElementReferenceNode extends BaseNode {
  type: 'ElementReference';
  targetId: string;      // ID string without '#'
}

// --- Complex Value Nodes ---

export interface CoordinateValueNode extends BaseNode {
  type: 'CoordinateValue';
  x: ValueNode;
  y: ValueNode;
}

export type RelationalRelation =
  | 'right of'
  | 'left of'
  | 'above'
  | 'below'
  | 'center of'
  | 'inside'
  | 'top-left of'
  | 'top-right of'
  | 'bottom-left of'
  | 'bottom-right of';

export interface RelationalPositionNode extends BaseNode {
  type: 'RelationalPosition';
  relation: RelationalRelation;
  target: string;        // Element ID without '#' or 'canvas' | 'parent'
  offset?: ValueNode;    // Optional offset dimension e.g. 20px
}

export type GradientValueNode = LinearGradientNode | RadialGradientNode | ConicGradientNode;

export interface GradientStopNode extends BaseNode {
  type: 'GradientStop';
  color: ValueNode;
  position?: ValueNode;  // Optional position dimension/number (e.g. 0%, 50%, 100%, 0.5)
}

export interface LinearGradientNode extends BaseNode {
  type: 'LinearGradient';
  direction?: ValueNode; // Angle (e.g. 45deg) or Direction String ('to right')
  stops: GradientStopNode[];
}

export interface RadialGradientNode extends BaseNode {
  type: 'RadialGradient';
  shape?: 'circle' | 'ellipse';
  stops: GradientStopNode[];
}

export interface ConicGradientNode extends BaseNode {
  type: 'ConicGradient';
  angle?: ValueNode;     // e.g. 90deg
  stops: GradientStopNode[];
}

export interface FilterFunctionNode extends BaseNode {
  type: 'FilterFunction';
  name: string;          // 'blur', 'saturate', 'brightness', etc.
  arguments: ValueNode[];
}

export interface FilterValueNode extends BaseNode {
  type: 'FilterValue';
  filters: FilterFunctionNode[];
}

export interface StrokeValueNode extends BaseNode {
  type: 'StrokeValue';
  color?: ValueNode;
  width?: ValueNode;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface FontValueNode extends BaseNode {
  type: 'FontValue';
  size?: ValueNode;
  family?: string;
  weight?: string | number;
  style?: 'normal' | 'italic' | 'oblique';
}

export interface Point2DNode extends BaseNode {
  type: 'Point2D';
  x: ValueNode;
  y: ValueNode;
}

export interface PointsValueNode extends BaseNode {
  type: 'PointsValue';
  points: Point2DNode[];
}

export interface ArrayLiteralNode extends BaseNode {
  type: 'ArrayLiteral';
  elements: ValueNode[];
}

export interface ExpressionListNode extends BaseNode {
  type: 'ExpressionList';
  expressions: ValueNode[];
}

// ============================================================================
// 6. Diagnostics & Errors
// ============================================================================

export interface Diagnostic {
  code: string;           // e.g. "TOAD-E001"
  message: string;        // Human-readable message
  severity: 'error' | 'warning' | 'info';
  loc: SourceLocation;
  sourceSnippet?: string; // Formatted 3-line code preview with caret indicator
}

export class ParseError extends Error {
  public loc: SourceLocation;
  public code: string;

  constructor(message: string, loc: SourceLocation, code = 'TOAD-E001') {
    super(message);
    this.name = 'ParseError';
    this.loc = loc;
    this.code = code;
  }
}

// ============================================================================
// 7. Resolved / Canonical Element & Tree Nodes
// ============================================================================

export interface GlowStyle {
  size: number;
  color: string;
  opacity?: number;
}

export interface BevelStyle {
  type: 'inner-bevel' | 'outer-bevel' | 'emboss' | 'pillow-emboss' | 'stroke-emboss' | 'smooth' | 'chisel-hard' | 'chisel-soft';
  depth?: number;
  size: number;
  soften?: number;
  direction?: 'up' | 'down';
  angle?: number;
  altitude?: number;
}

export interface LayerStrokeStyle {
  position: 'inside' | 'outside' | 'center';
  width: number;
  color: string;
  opacity?: number;
  fillType?: 'color' | 'gradient';
  gradient?: ResolvedGradient;
}

export interface ResolvedDocumentNode {
  canvas: ResolvedCanvasNode;
  canvases?: ResolvedCanvasNode[];
  fonts: FontDirectiveNode[];
  elements: ResolvedElementNode[];
  filePath?: string;
  dependencies?: string[];
  warnings?: string[];
}

export interface ResolvedCanvasNode {
  name?: string;
  mode?: 'graphic' | 'photo';
  photoSrc?: string;
  explicitWidth?: boolean;
  explicitHeight?: boolean;
  width: number;
  height: number;
  fill?: string | ResolvedGradient;
  aspectRatio: { w: number; h: number; gcd: number; str: string };
  exports?: string[];
  scales?: number[];
  resolution?: number | string;
  dpi?: number;
  hasExplicitDpi?: boolean;
  bleed?: number;
  cropMarks?: boolean;
  colorMode?: 'rgb' | 'cmyk';
  ratio?: string;
  quality?: number;
  guides?: Array<{ location: number; direction: 'horizontal' | 'vertical' }>;
  globalLight?: { angle: number; altitude?: number };
  properties: Record<string, any>;
  elements?: ResolvedElementNode[];
}

export interface ResolvedGradientStop {
  color: string;         // Hex/RGBA
  offset: number;        // Normalized 0.0 to 1.0
}

export interface ResolvedGradient {
  type: 'linear' | 'radial' | 'conic';
  angleDeg?: number;     // 0 to 360
  direction?: string;
  shape?: 'circle' | 'ellipse';
  stops: ResolvedGradientStop[];
}

export interface ResolvedStroke {
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  cap?: 'round' | 'square' | 'butt';
  join?: 'miter' | 'round' | 'bevel';
}

export interface ResolvedFont {
  family: string;
  size: number;
  weight: string | number;
  style: 'normal' | 'italic' | 'oblique';
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  fontFeatures?: string | string[];
  fontVariation?: Record<string, number> | string;
  hangingPunctuation?: boolean;
}

export interface ResolvedFilter {
  type: string;
  value: number | string;
}

export interface ResolvedElementNode {
  id?: string;
  name: string;
  type: 'rect' | 'circle' | 'text' | 'polygon' | 'path' | 'image' | 'adjust' | 'group' | 'grid' | 'stack' | 'icon' | 'shape' | 'slot';
  isComponent?: boolean;
  // Computed & resolved styling properties
  at?: {
    x?: number | string;
    y?: number | string;
    relational?: {
      relation: RelationalRelation;
      targetId: string;
      offset: number | { x: number, y: number };
    };
  };
  size?: {
    w?: number | string;
    h?: number | string;
  };
  fill?: string | ResolvedGradient;
  stroke?: ResolvedStroke;
  opacity?: number;
  fillOpacity?: number;
  layerColor?: 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'gray';
  lock?: 'all' | 'position' | 'transparency' | 'composite';
  knockout?: boolean;
  blendMode?: string;
  rotation?: number;     // In degrees
  scale?: number | { x: number, y: number };
  skewX?: number;
  skewY?: number;
  transformOrigin?: { x: number | string, y: number | string };
  radius?: number | [number, number, number, number];
  filter?: ResolvedFilter[];
  clip?: boolean;
  mask?: string;         // ID of the mask element
  strokeCap?: 'round' | 'square' | 'butt';
  strokeJoin?: 'miter' | 'round' | 'bevel';
  shadow?: { offsetX: number; offsetY: number; blur: number; color: string; useGlobalLight?: boolean; noise?: number };
  shadows?: Array<{ offsetX: number; offsetY: number; blur: number; color: string; useGlobalLight?: boolean; noise?: number }>;
  innerShadow?: { offsetX: number; offsetY: number; blur: number; color: string };
  outerGlow?: GlowStyle;
  innerGlow?: GlowStyle;
  bevel?: BevelStyle;
  layerStroke?: LayerStrokeStyle;
  colorOverlay?: string;
  gradientOverlay?: ResolvedGradient;
  zIndex?: number;
  backdropFilter?: ResolvedFilter[];
  // Text specifics
  letterSpacing?: number;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  wrapWidth?: number;
  maxLines?: number;
  overflow?: 'ellipsis' | 'clip' | 'visible';
  text?: string;
  font?: ResolvedFont;
  align?: 'left' | 'center' | 'right' | 'justify';
  fontFeatures?: string | string[];
  fontVariation?: Record<string, number> | string;
  hangingPunctuation?: boolean;
  // Specific element fields
  points?: Array<{ x: number; y: number }>; // Center-relative coordinates
  d?: string;                               // SVG Path data
  src?: string;
  fit?: 'fill' | 'cover' | 'contain' | 'none';
  iconName?: string;
  shapeType?: ShapeType;
  // Grid properties
  columns?: number;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  flow?: 'row' | 'column';
  // Stack (Auto-Layout) properties
  direction?: 'horizontal' | 'vertical' | 'row' | 'column';
  padding?: number | [number, number, number, number];
  margin?: number | [number, number, number, number];
  // Hierarchy
  children?: ResolvedElementNode[];
  // Adjust element properties
  adjustRadius?: number;
  feather?: number;
  adjustParams?: {
    exposure?: number;
    contrast?: number;
    brightness?: number;
    saturation?: number;
    warmth?: number;
    highlights?: number;
    shadows?: number;
  };
}
