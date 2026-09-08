/**
 * src/tools/designAuditor.ts
 * Deep Static Design Auditor, Prepress Flightchecker & Anti-AI-Slop Heuristics Engine.
 *
 * Implements 8 comprehensive analytical dimensions:
 * 1. WCAG 2.2 Relative Contrast & APCA (Accessible Perceptual Contrast Algorithm)
 * 2. Print Prepress, Bleed Safety & CMYK Total Area Coverage (TAC)
 * 3. Typographic Hierarchy, Modular Scaling & Reading Measure (Line-Length)
 * 4. Negative Space & Canvas Fill Density Profiler (Axiom UNI-01: Less is More)
 * 5. Complete Anti-AI-Slop Scanner (Purple Haze, Bento, Buzzwords, Soap Radii, Emojis, Muddy Gradients)
 * 6. Color Harmony & Palette Discipline
 * 7. Optical Alignment & Badge Cap-Height Metric Parity
 * 8. Layout & Structure Hygiene
 */

import { LayoutResult, LayoutNode } from '../parser/math.js';
import { DocumentNode } from '../parser/ast.js';
import { parseColorToRgba, ColorRgba } from '../engine/drawUtils.js';
import { runAntiSlopAudit, SlopContext } from './antiSlopRules.js';
import {
  calculateOpticalCentroid,
  calculateWhitespaceDistribution,
  OpticalCentroidResult,
  WhitespaceDistributionResult
} from './metrics/spatialDistribution.js';
import {
  analyzeTypographicTelemetry,
  TypographicTelemetryResult
} from './metrics/typographicAnalysis.js';
import {
  analyzeColorTelemetry,
  ColorTelemetryResult
} from './metrics/colorEntropy.js';

export type AuditSeverity = 'pass' | 'info' | 'warn' | 'error';

export type AuditCategory =
  | 'accessibility'
  | 'contrast'
  | 'print'
  | 'typography'
  | 'density'
  | 'anti-slop'
  | 'color'
  | 'geometry'
  | 'hygiene'
  | 'boundary';

export interface AuditFinding {
  code: string;
  category: AuditCategory;
  severity: AuditSeverity;
  type?: 'error' | 'warning' | 'pass';
  nodeId?: string;
  elementId?: string;
  message: string;
  details?: string;
  help?: string;
  recommendation?: string;
  fixSnippet?: string;
  axiom?: string;
  location?: string;
}

export type DesignIssue = AuditFinding;

export interface CategoryScore {
  name: string;
  score: number; // 0 - 100
  grade: string; // A+, A, B, C, D
  passes: number;
  warnings: number;
  errors: number;
}

export interface DesignAuditStats {
  elementsTotal: number;
  textsTotal: number;
  errors: number;
  warnings: number;
}

export interface ColorPaletteSwatch {
  hex: string;
  usageCount: number;
  luminance: number;
}

export interface TypeScaleEntry {
  size: number;
  weights: Array<string | number>;
  count: number;
}

export interface ContrastAuditPair {
  nodeId: string;
  textSnippet: string;
  fgHex: string;
  bgHex: string;
  wcagRatio: number;
  apcaLc: number;
  passesWcag: boolean;
  passesApca: boolean;
}

export interface DesignAuditMetrics {
  canvasWidth: number;
  canvasHeight: number;
  canvasDpi: number;
  aspectRatio: string;
  totalAreaPx: number;
  canvasDensityPercent: number;
  negativeSpacePercent: number;
  distinctFontFamilies: string[];
  distinctHues: number;
  maxTotalAreaCoverage: number;
  avgLineLengthChars: number;
  maxLineLengthChars: number;
  slopFindingsCount: number;
  slopFatalCount?: number;
  slopWarningCount?: number;
  slopScore?: number;
  slopRiskLevel?: 'clean' | 'low' | 'moderate' | 'high' | 'critical';
  slopCapActive?: boolean;
  slopCapScore?: number;
  elementCensus: {
    total: number;
    texts: number;
    rects: number;
    groups: number;
    shapes: number;
    images: number;
  };
  paletteSwatches: ColorPaletteSwatch[];
  typeScale: TypeScaleEntry[];
  contrastPairs: ContrastAuditPair[];
  opticalCentroid?: OpticalCentroidResult;
  whitespaceDistribution?: WhitespaceDistributionResult;
  typographicTelemetry?: TypographicTelemetryResult;
  colorTelemetry?: ColorTelemetryResult;
}

export interface AuditReport {
  file?: string;
  timestamp: number;
  overallScore: number;
  overallGrade: string;
  score: number;
  grade: string;
  issues: DesignIssue[];
  stats: DesignAuditStats;
  metrics: DesignAuditMetrics;
  categories: {
    accessibility: CategoryScore;
    print: CategoryScore;
    typography: CategoryScore;
    density: CategoryScore;
    antiSlop: CategoryScore;
    color: CategoryScore;
    geometry: CategoryScore;
    hygiene: CategoryScore;
  };
  findings: AuditFinding[];
}

export type DesignAuditResult = AuditReport;

// ============================================================================
// Mathematical & Perceptual Color Helpers
// ============================================================================

/**
 * Calculates WCAG 2.2 relative luminance for an sRGB color.
 */
export function calculateLuminance(rgba: ColorRgba): number {
  const srgb = [rgba.r, rgba.g, rgba.b].map(v => {
    const val = v / 255;
    return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!;
}

/**
 * Calculates WCAG contrast ratio between two colors (ranges from 1.0 to 21.0).
 */
export function calculateContrastRatio(fg: ColorRgba, bg: ColorRgba): number {
  const l1 = calculateLuminance(fg);
  const l2 = calculateLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Converts sRGB channel (0-255) to linear luminance component for APCA.
 */
function sRgbToY(r: number, g: number, b: number): number {
  const sR = Math.pow(r / 255, 2.4);
  const sG = Math.pow(g / 255, 2.4);
  const sB = Math.pow(b / 255, 2.4);
  return 0.2126729 * sR + 0.7151522 * sG + 0.0721750 * sB;
}

/**
 * Calculates Accessible Perceptual Contrast Algorithm (APCA) Lightness Contrast Lc.
 * Returns signed Lc (-114 to +114).
 * Positive = Dark text on light background.
 * Negative = Light text on dark background.
 */
export function calculateApca(txtRgba: ColorRgba, bgRgba: ColorRgba): number {
  const Ytxt = sRgbToY(txtRgba.r, txtRgba.g, txtRgba.b);
  const Ybg = sRgbToY(bgRgba.r, bgRgba.g, bgRgba.b);

  if (Ybg > Ytxt) {
    // Dark text on light background
    const sapc = (Math.pow(Ybg, 0.56) - Math.pow(Ytxt, 0.57)) * 1.14;
    return Math.round(sapc * 100);
  } else {
    // Light text on dark background
    const sapc = (Math.pow(Ybg, 0.65) - Math.pow(Ytxt, 0.62)) * 1.14;
    return Math.round(sapc * 100);
  }
}

/**
 * Approximates CMYK Total Area Coverage (TAC) from sRGB (0% to 400%).
 */
export function calculateTac(rgba: ColorRgba): { c: number; m: number; y: number; k: number; tac: number } {
  const cNorm = 1 - rgba.r / 255;
  const mNorm = 1 - rgba.g / 255;
  const yNorm = 1 - rgba.b / 255;
  const kNorm = Math.min(cNorm, Math.min(mNorm, yNorm));

  if (kNorm >= 1) {
    return { c: 0, m: 0, y: 0, k: 100, tac: 100 };
  }

  const c = Math.round(((cNorm - kNorm) / (1 - kNorm)) * 100);
  const m = Math.round(((mNorm - kNorm) / (1 - kNorm)) * 100);
  const y = Math.round(((yNorm - kNorm) / (1 - kNorm)) * 100);
  const k = Math.round(kNorm * 100);
  return { c, m, y, k, tac: c + m + y + k };
}

/**
 * Converts RGB to HSL hue (0-360).
 */
function rgbToHue(r: number, g: number, b: number): number {
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

function calculateGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'D';
}

function flattenNodes(nodes: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  const seen = new Set<LayoutNode>();
  function walk(list: LayoutNode[]) {
    for (const node of list) {
      if (!seen.has(node)) {
        seen.add(node);
        result.push(node);
      }
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return result;
}

function enrichFinding(f: AuditFinding): AuditFinding {
  if (f.fixSnippet && f.axiom) return f;
  const code = f.code;
  let fixSnippet = f.fixSnippet;
  let axiom = f.axiom;

  switch (code) {
    case 'SLOP-WEB-001':
      fixSnippet = 'Entferne Weichzeichner-Filter und ersetze diffuse Blobs durch eine fokussierte Spotlight-Geometrie.';
      axiom = 'the_seed/rules/anti_ai_slop_donts.yaml#SLOP-WEB-001 (Purple Haze)';
      break;
    case 'SLOP-WEB-002':
      fixSnippet = 'Reduziere die Anzahl uniformer Karten auf max. 3–4 oder führe eine klare asymmetrische Hierarchie ein.';
      axiom = 'SLOP-WEB-002 (Bento-Grid Overkill)';
      break;
    case 'SLOP-WEB-003':
      fixSnippet = 'Ersetze Marketing-Hülsen durch konkrete Fakten, Zahlen oder domänenspezifische Werkzeuge.';
      axiom = 'SLOP-WEB-003 (Phrasen-Dreschmaschine)';
      break;
    case 'SLOP-WEB-004':
      fixSnippet = 'Lösche isolierte Schmuckkreuze (+, ✕) und unmotivierte Deko-Partikel aus dem freien Raum.';
      axiom = 'SLOP-WEB-004 (Floating Debris)';
      break;
    case 'SLOP-WEB-005':
      fixSnippet = 'Verwende einen dezenten zweifarbigen Verlauf oder eine monochrome Markenfläche für den Button.';
      axiom = 'SLOP-WEB-005 (Rainbow Neon Gradient)';
      break;
    case 'SLOP-WEB-007':
      fixSnippet = 'Reduziere den Eckenradius auf disziplinierte 6px bis 12px (radius: 8px;).';
      axiom = 'SLOP-WEB-007 (Soap-Bar Radii)';
      break;
    case 'SLOP-WEB-008':
      fixSnippet = 'Schaffe mindestens 40% bis 60% freien Negativraum. Vergrößere das Canvas oder reduziere Elementflächen.';
      axiom = 'Axiom UNI-01 (WENIGER IST MEHR)';
      break;
    case 'SLOP-WEB-009':
      fixSnippet = 'Entferne den schmalen linken Zierstreifen; strukturiere Inhalte stattdessen durch Spationierung und Typografie.';
      axiom = 'SLOP-WEB-009 (Left Border Stripe Crutch)';
      break;
    case 'SLOP-WEB-012':
      fixSnippet = 'Verleihe einer Karte visuelle Dominanz (Hero-Card) statt 3 identische Klone nebeneinander zu setzen.';
      axiom = 'SLOP-WEB-012 (Monotone Triplet Clones)';
      break;
    case 'SLOP-TYPE-001':
      fixSnippet = 'Kombiniere die Fließtextschrift mit einem markanten Display-Font (z. B. Cabinet Grotesk oder General Sans).';
      axiom = 'SLOP-TYPE-001 (Inter/Roboto Monoculture)';
      break;
    case 'SLOP-TYPE-002':
      fixSnippet = 'Setze Fließtext ab 3 Zeilen linksbündig (align: left;), um eine feste Orientierungskante für das Auge zu bieten.';
      axiom = 'Axiom UNI-03 & SLOP-TYPE-002 (Centered Multi-line Prose)';
      break;
    case 'SLOP-TYPE-004':
      fixSnippet = 'Füge Versaltexten ein positives Spationieren hinzu: letter-spacing: 0.12em;';
      axiom = 'Axiom UNI-04 & Regel 13 (Versaliensperrung)';
      break;
    case 'SLOP-TYPE-008':
      fixSnippet = 'Wende einen optischen Cap-Height-Versatz an: offset (0, 2px);';
      axiom = 'Regel 13 (Cap-Height Offset in Badges)';
      break;
    case 'SLOP-TYPE-009':
      fixSnippet = 'Reduziere Gedankenstriche (—) und formuliere klare Teilsätze mit Kommata oder Punkten.';
      axiom = 'SLOP-TYPE-009 (Em-Dash Inflation)';
      break;
    case 'SLOP-TYPE-010':
      fixSnippet = 'Entferne Sparkle-Sterne (✨/✦) und hebe Merkmale durch typografische Gewichtung hervor.';
      axiom = 'SLOP-TYPE-010 (AI Sparkle Overuse)';
      break;
    case 'SLOP-GFX-003':
      fixSnippet = 'Verwende Farbübergänge im OKLCH-Farbraum oder füge einen Zwischenstopp ein, um Schmutzzonen zu vermeiden.';
      axiom = 'SLOP-GFX-003 (Muddy Linear RGB Bleed)';
      break;
    case 'SLOP-COLOR-001':
      fixSnippet = 'Reduziere die Farbpalette auf maximal 1 Primär-Akzentfarbe + neutrale Schattierungen.';
      axiom = 'SLOP-COLOR-001 (Cyberpunk Spectrum)';
      break;
    case 'SLOP-COLOR-002':
      fixSnippet = 'Verringere die Deckkraft des Schattens auf maximal 12–16% (z. B. shadow: 0 12px 24px alpha(#000000, 0.12);).';
      axiom = 'SLOP-COLOR-002 (Harsh Mud Shadow)';
      break;
    case 'SLOP-CODE-005':
      fixSnippet = 'Verwende professionelle Vektor-Pfade (path oder svg) anstelle von bunten Betriebssystem-Emojis.';
      axiom = 'SLOP-CODE-005 (Emoji Cheap Substitution)';
      break;
    case 'SLOP-ICON-001':
      fixSnippet = 'Harmonisiere alle Icon-Strokes auf eine einheitliche Strichstärke (z. B. 1.5px oder 2px).';
      axiom = 'SLOP-ICON-001 (Stroke Inconsistency)';
      break;
    case 'SLOP-ASSET-001':
      fixSnippet = 'Ersetze Platzhalter-Links durch finale Bild-Assets in Ihrem Projektverzeichnis.';
      axiom = 'SLOP-ASSET-001 (Placeholder Remnants)';
      break;
    case 'SLOP-ASSET-004':
      fixSnippet = 'Ersetze Dummy-Kontakte durch reale Projekt- oder Kundendaten.';
      axiom = 'SLOP-ASSET-004 (Dummy Contact Remnants)';
      break;
    case 'SLOP-LOGO-004':
      fixSnippet = 'Erhöhe die minimale Linienstärke im Logo auf mindestens 1.5px bis 2.0px für die Favicon-Skalierung.';
      axiom = 'SLOP-LOGO-004 (Favicon Micro-Detail Smear)';
      break;
    case 'SLOP-GEOM-001':
      fixSnippet = 'Passe den Innenradius nach der Formel R_inner = max(0, R_outer - padding) an.';
      axiom = 'SLOP-GEOM-001 (Concentric Radii Mismatch)';
      break;
    case 'SLOP-WEB-014':
      fixSnippet = 'Entferne den dekorativen grünen Blink-Punkt oder nutze ein klares semantisches Kicker-Label.';
      axiom = 'SLOP-WEB-014 (Ornamental Live-Pulse Badge)';
      break;
    case 'SLOP-WEB-015':
      fixSnippet = 'Verflache die Container-Hierarchie und entferne überflüssige umschließende Boxen mit Rahmen.';
      axiom = 'SLOP-WEB-015 (Russian-Doll Nesting)';
      break;
    case 'SLOP-DECK-002':
      fixSnippet = 'Verzichte auf gigantische Satzzeichen als Füllgrafik; setze das Zitat typografisch edel in den Weißraum.';
      axiom = 'SLOP-DECK-002 (Megalithic Quote Monument)';
      break;
    case 'SLOP-PRINT-001':
      fixSnippet = 'Entferne Zier-Passmarken aus dem Layout; baue stattdessen ein echtes modulares Rastersystem.';
      axiom = 'SLOP-PRINT-001 (Swiss-Slop & Grid Cosplay)';
      break;
    case 'SLOP-PRINT-003':
      fixSnippet = 'Entferne beliebige GPS-Koordinaten; dokumentiere echte Kolophondaten oder lasse Negativraum wirken.';
      axiom = 'SLOP-PRINT-003 (Telemetry Stamping)';
      break;
    case 'SLOP-DASH-001':
      fixSnippet = 'Versehen Sie Datenkurven mit messbaren Achsen, Skalen und realistischen Datenpunkten.';
      axiom = 'SLOP-DASH-001 (Hero Fake-Dashboard Mirage)';
      break;
    case 'SLOP-WEB-017':
      fixSnippet = 'Verwende verifizierte Fallstudien mit echten Namen anstelle von generischen gestapelten Fake-Avataren.';
      axiom = 'SLOP-WEB-017 (Fake Social Proof Avatar Pile)';
      break;
    case 'SLOP-WEB-018':
      fixSnippet = 'Brich die stereotype 5-Stufen-Schablone auf: Nutze asymmetrisches Storytelling oder Split-Screen-Layouts.';
      axiom = 'SLOP-WEB-018 (Stereotypical Hero Formula)';
      break;
    case 'SLOP-WEB-019':
      fixSnippet = 'Erde frei schwebende Karten durch architektonische Helligkeitsabstufung und 1px Kantenlicht statt Riesen-Glows.';
      axiom = 'SLOP-WEB-019 (Void Glow Halo Backlight)';
      break;
    case 'SLOP-WEB-020':
      fixSnippet = 'Präsentiere maximal 2–3 ausführliche Testimonials mit konkreten Kennzahlen statt generischer Lobeshymnen-Raster.';
      axiom = 'SLOP-WEB-020 (Infinite Testimonial Grid)';
      break;
    case 'SLOP-UI-001':
      fixSnippet = 'Definiere eine einheitliche virtuelle Lichtquelle (z. B. 270° senkrecht von oben) für alle Schatten.';
      axiom = 'SLOP-UI-001 (Contradictory Virtual Lighting)';
      break;
    case 'SLOP-UI-002':
      fixSnippet = 'Schatten müssen Helligkeit subtrahieren (abdunkeln). Nutze abgedunkelte Farbtöne oder Alpha-Schwarz.';
      axiom = 'SLOP-UI-002 (Luminous Inverted Shadows)';
      break;
    case 'SLOP-UI-003':
      fixSnippet = 'Unterlege transluzentes Milchglas mit einem soliden Fallback (min. 85% Opazität) für WCAG-AA Lesbarkeit.';
      axiom = 'SLOP-UI-003 (Glassmorphism Contrast Collapse)';
      break;
    case 'SLOP-UI-004':
      fixSnippet = 'Halte mindestens 24px unteren Sicherheitsabstand (env(safe-area-inset-bottom)) für mobile Home-Indikatoren.';
      axiom = 'SLOP-UI-004 (Safe-Area Blindness)';
      break;
    case 'SLOP-UI-005':
      fixSnippet = 'Gestalte "Abbrechen" als dezenten Ghost-Button und hebe destruktive Aktionen klar asymmetrisch hervor.';
      axiom = 'SLOP-UI-005 (Destructive Action Ambiguity)';
      break;
    case 'SLOP-UI-006':
      fixSnippet = 'Verwende Status-Pills nur für Ausnahmen (Fehler/Warnungen) und fasse 100% laufende Systeme im Header zusammen.';
      axiom = 'SLOP-UI-006 (Dead Status Pill Overkill)';
      break;
    case 'SLOP-TYPE-011':
      fixSnippet = 'Vergrößere den Zeilenabstand bei Headlines auf mindestens 1.15em bis 1.25em, um Kollisionen zu verhindern.';
      axiom = 'SLOP-TYPE-011 (Leading Collision & Baseline Strangulation)';
      break;
    case 'SLOP-TYPE-012':
      fixSnippet = 'Vereinheitliche alle Navigations- und Menütexte durchgängig auf Sentence case oder striktes Title Case.';
      axiom = 'SLOP-TYPE-012 (Inconsistent Title/Sentence Case)';
      break;
    case 'SLOP-TYPE-013':
      fixSnippet = 'Verhindere isolierte Wörter am Zeilenende durch geschützte Leerzeichen oder text-wrap: balance.';
      axiom = 'SLOP-TYPE-013 (Orphan & Widow Baseline Stragglers)';
      break;
    case 'SLOP-TYPE-014':
      fixSnippet = 'Runde Textkoordinaten auf ganze Pixel (Math.round), um verwaschenes Subpixel-Rendern zu vermeiden.';
      axiom = 'SLOP-TYPE-014 (Fractional Sub-Pixel Font Blur)';
      break;
    case 'SLOP-TYPE-015':
      fixSnippet = 'Etabliere klaren Schriftgrößen-Kontrast (min. 1.5x Sprung zwischen Titel und Body) und nutze fette Schriftschnitte.';
      axiom = 'SLOP-TYPE-015 (Hierarchy Gap Deficit)';
      break;
    case 'SLOP-GFX-009':
      fixSnippet = 'Sortiere isometrische Vektoren strikt nach Tiefenformel: Tiefe = (x + y) / sqrt(2) + z.';
      axiom = 'SLOP-GFX-009 (Impossible Isometric Spatial Intersection)';
      break;
    case 'SLOP-GFX-010':
      fixSnippet = 'Entferne Eckenradien von Barcodes (radius: 0px;) und stelle intakte Ruhezonen für echte Lesbarkeit sicher.';
      axiom = 'SLOP-GFX-010 (Faux-Brutalist Barcode Abuse)';
      break;
    case 'SLOP-GFX-011':
      fixSnippet = 'Lösche dekorative Fake-Telemetriestrings und zeige stattdessen echte Produktionsdaten oder freien Weißraum.';
      axiom = 'SLOP-GFX-011 (Telemetry Noise & Pseudocode Greebling)';
      break;
    case 'SLOP-GFX-012':
      fixSnippet = 'Ersetze amorphe Shader-Ölfilm-Blobs durch strukturierte Typografie, technische Diagramme oder echte UI-Artefakte.';
      axiom = 'SLOP-GFX-012 (Shader-Toy Iridescent Oil-Slick Blob)';
      break;
    case 'SLOP-PRINT-007':
      fixSnippet = 'Präsentiere Druckentwürfe als ehrliche 2D-Vektorgrafik oder wende physikalisch korrekte Displacement-Maps an.';
      axiom = 'SLOP-PRINT-007 (Fake Paper Fold Texture Deficit)';
      break;
    case 'SLOP-PRINT-008':
      fixSnippet = 'Verschiebe Passermarken und Schnittzeichen vollständig in den externen Anschnittbereich (Slug Zone).';
      axiom = 'SLOP-PRINT-008 (Pseudo-Swiss Crop Marks in Live Area)';
      break;
    case 'SLOP-PRINT-009':
      fixSnippet = 'Nutze echte fotografierte Papierfasertexturen mit multiplizierender Luminanzdichte statt digitaler Gleichrauschfilter.';
      axiom = 'SLOP-PRINT-009 (Analog Laundering Noise Washing)';
      break;
    case 'SLOP-PRINT-010':
      fixSnippet = 'Vergrößere den Innenbund (Bundsteg) auf mindestens 20–25mm, damit kein Text im Bindefalz verschwindet.';
      axiom = 'SLOP-PRINT-010 (Gutter Strangulation)';
      break;
    case 'SLOP-DASH-002':
      fixSnippet = 'Modelliere reale Zeitreihendaten mit natürlicher Varianz und transparenten Messpunkten statt steriler Wunschkurven.';
      axiom = 'SLOP-DASH-002 (Monotonic Utopian Curve)';
      break;
    case 'SLOP-DASH-003':
      fixSnippet = 'Verankere Diagramme mit expliziten X/Y-Achsen, Zahlenwerten, Einheiten und einem klaren Nullpunkt.';
      axiom = 'SLOP-DASH-003 (Ghost Axes & Disembodied Datapoints)';
      break;
    case 'SLOP-DASH-004':
      fixSnippet = 'Begrenze Donut-Diagramme auf max. 4–5 Kategorien und platziere den aggregierten KPI-Wert fett im Zentrum.';
      axiom = 'SLOP-DASH-004 (Rainbow Spectral Doughnut Catastrophe)';
      break;
    case 'SLOP-DASH-005':
      fixSnippet = 'Nutze Grün für Wachstum/Erfolg und Rot/Rose für Verluste/Fehler (semantische Farbpolarität).';
      axiom = 'SLOP-DASH-005 (Chromatic Semantic Polarity Inversion)';
      break;
    case 'SLOP-MOB-001':
      fixSnippet = 'Baue echtes responsives Reflow: Einspaltiger Stack mit min. 16px Schriftgröße statt Verkleinern via zoom/scale.';
      axiom = 'SLOP-MOB-001 (Desktop Viewport Zoom Trap)';
      break;
    case 'SLOP-MOB-002':
      fixSnippet = 'Platziere primäre mobile Aktionen in der unteren Daumenzone (z. B. Sticky Bottom Bar) statt links oben.';
      axiom = 'SLOP-MOB-002 (One-Thumb Hostility)';
      break;
    case 'SLOP-COLOR-003':
      fixSnippet = 'Füge einen Zwischenfarbstop ein oder nutze OKLCH-Interpolation, um schmutzige Grauwerte in der Verlaufmitte zu verhindern.';
      axiom = 'SLOP-COLOR-003 (Linear sRGB Dead-Zone Mud Gradient)';
      break;
    case 'A11Y-LOW-CONTRAST':
      fixSnippet = 'Erhöhe die Helligkeitsdifferenz zwischen Schrift und Hintergrund für WCAG AA Konformität (min. 4.5:1).';
      axiom = 'WCAG 2.2 Kontrastrichtlinie';
      break;
    case 'APCA-CONTRAST-NOTICE':
      fixSnippet = 'Optimiere die Polarität für ermüdungsfreies Lesen (Ziel APCA |Lc| >= 75 für Fließtext).';
      axiom = 'APCA (Advanced Perceptual Contrast Algorithm)';
      break;
    case 'PRINT-TRIM-COLLISION':
      fixSnippet = 'Rücke das Element mindestens 12px bis 16px (3–4mm) von der äußeren Schnittkante ein.';
      axiom = 'Prepress Flightcheck: Beschnitt-Sicherheit';
      break;
    case 'PRINT-TAC-EXCEEDED':
      fixSnippet = 'Reduziere den Gesamtfarbauftrag unter 320% TAC zur Vermeidung von Farbschmieren im Druck.';
      axiom = 'Prepress Flightcheck: Total Area Coverage (ISO 12647)';
      break;
    case 'PRINT-HAIRLINE-STROKE':
      fixSnippet = 'Erhöhe die Strichstärke auf mindestens 0.25pt (0.35px), damit Linien im Offset-Druck nicht wegbrechen.';
      axiom = 'Prepress Flightcheck: Haarlinien-Mindeststärke';
      break;
    case 'SLOP-PILL-PADDING':
      fixSnippet = 'Erweitere den horizontalen Innenabstand der Kapsel um 15%–20%, um Clipping auf fremden OS zu verhindern.';
      axiom = 'Regel 10 (Badge & Pill Margins)';
      break;
  }

  return {
    ...f,
    fixSnippet: fixSnippet || f.help,
    axiom: axiom || f.category.toUpperCase()
  };
}

// ============================================================================
// Core Audit Engine Implementation
// ============================================================================

export function auditDesign(
  input: LayoutResult | { layout: LayoutResult; entryPath?: string },
  doc?: DocumentNode,
  filePath?: string
): AuditReport {
  const layout = (input as any)?.layout ? ((input as any).layout as LayoutResult) : (input as LayoutResult);
  const resolvedPath = filePath || (input as any)?.entryPath;

  const findings: AuditFinding[] = [];
  const allNodes = flattenNodes(layout.nodes);
  const textNodes = allNodes.filter(n => n.type === 'text');

  // Baseline canvas background
  const bgRgba = parseColorToRgba(
    typeof layout.canvas.background === 'string'
      ? layout.canvas.background
      : (layout.canvas.background as any)?.stops?.[0]?.color || '#ffffff'
  );

  const canvasWidth = layout.canvas.width || 800;
  const canvasHeight = layout.canvas.height || 600;
  const canvasArea = canvasWidth * canvasHeight;

  // --------------------------------------------------------------------------
  // 1. Accessibility, WCAG 2.2 & APCA Perceptual Contrast
  // --------------------------------------------------------------------------
  const contrastPairs: ContrastAuditPair[] = [];
  for (const node of textNodes) {
    const fgStr = node.style.color || '#000000';
    const fgRgba = parseColorToRgba(fgStr);

    // Multi-layer background blend resolution
    let effectiveBg = bgRgba;
    for (const other of allNodes) {
      if (other === node) break;
      if (other.type === 'rect' || other.type === 'circle' || other.type === 'polygon') {
        const isChild = Boolean(other.children && other.children.some(c => c === node || c.id === node.id));
        const textMidX = node.x + node.width / 2;
        const textMidY = node.y + node.height / 2;
        const centerInside =
          other.x <= textMidX &&
          other.x + other.width >= textMidX &&
          other.y <= textMidY &&
          other.y + other.height >= textMidY;

        const containsText = isChild || centerInside || (
          other.x <= node.x &&
          other.y <= node.y &&
          other.x + other.width >= node.x + node.width &&
          other.y + other.height >= node.y + node.height
        );
        if (containsText && typeof other.fill === 'string') {
          const shapeCol = parseColorToRgba(other.fill);
          if (shapeCol.a >= 0.95) {
            effectiveBg = shapeCol;
          } else if (shapeCol.a > 0) {
            // Composite alpha over current effective background
            effectiveBg = {
              r: Math.round(shapeCol.r * shapeCol.a + effectiveBg.r * (1 - shapeCol.a)),
              g: Math.round(shapeCol.g * shapeCol.a + effectiveBg.g * (1 - shapeCol.a)),
              b: Math.round(shapeCol.b * shapeCol.a + effectiveBg.b * (1 - shapeCol.a)),
              a: 1
            };
          }
        }
      }
    }

    const contrast = calculateContrastRatio(fgRgba, effectiveBg);
    const apca = calculateApca(fgRgba, effectiveBg);
    const absApca = Math.abs(apca);

    const fontSize = node.textLayout?.fontSize || 16;
    const isBold = Number(node.textLayout?.fontWeight) >= 700 || String(node.textLayout?.fontWeight).includes('bold');
    const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold);
    const minContrast = isLargeText ? 3.0 : 4.5;
    const minApca = isLargeText ? 60 : 75;

    const rawId = node.id || node.name || 'text';
    const idLabel = node.id ? `#${node.id}` : (node.name || 'text');

    contrastPairs.push({
      nodeId: idLabel,
      textSnippet: String(node.content || (node as any).textLayout?.text || idLabel).slice(0, 32),
      fgHex: fgStr,
      bgHex: `rgb(${effectiveBg.r}, ${effectiveBg.g}, ${effectiveBg.b})`,
      wcagRatio: Math.round(contrast * 100) / 100,
      apcaLc: Math.round(apca),
      passesWcag: contrast >= minContrast,
      passesApca: absApca >= minApca
    });

    if (contrast < minContrast) {
      findings.push({
        code: 'WCAG-CONTRAST-FAIL',
        category: 'contrast',
        severity: 'error',
        type: 'error',
        nodeId: idLabel,
        elementId: rawId,
        message: `${idLabel}: Low contrast ratio ${contrast}:1 (minimum required: ${minContrast}:1, APCA Lc: ${apca}).`,
        details: `Foreground ${fgStr} on background rgb(${effectiveBg.r}, ${effectiveBg.g}, ${effectiveBg.b}).`,
        help: `Increase contrast between text and background to at least ${minContrast}:1 to comply with WCAG 2.2 AA.`,
        recommendation: `Increase contrast to at least ${minContrast}:1.`
      });
    } else if (absApca < minApca) {
      findings.push({
        code: 'APCA-CONTRAST-NOTICE',
        category: 'contrast',
        severity: 'warn',
        type: 'warning',
        nodeId: idLabel,
        elementId: rawId,
        message: `${idLabel}: Passes WCAG ratio (${contrast}:1), but APCA Lc rating is low (|Lc| = ${absApca}, target: ${minApca}).`,
        help: 'APCA models human perception across polarities. Consider adjusting lightness difference for effortless readability.'
      });
    } else if (contrast < 7.0 && !isLargeText) {
      findings.push({
        code: 'WCAG-AAA-NOTICE',
        category: 'contrast',
        severity: 'info',
        type: 'pass',
        nodeId: idLabel,
        elementId: rawId,
        message: `${idLabel}: Passes AA (${contrast}:1, APCA Lc ${apca}), but below AAA standard (7.0:1).`,
        details: `Contrast: ${contrast}:1.`
      });
    } else {
      findings.push({
        code: 'WCAG-CONTRAST-PASS',
        category: 'contrast',
        severity: 'pass',
        type: 'pass',
        nodeId: idLabel,
        elementId: rawId,
        message: `${idLabel}: Excellent contrast (${contrast}:1, APCA Lc ${apca}).`
      });
    }

    // Micro-Text Safety
    if (fontSize < 10) {
      findings.push({
        code: 'A11Y-MICRO-TEXT',
        category: 'accessibility',
        severity: 'warn',
        type: 'warning',
        nodeId: idLabel,
        elementId: rawId,
        message: `${idLabel}: Font-size (${fontSize}px) is below minimum legibility threshold (10px).`,
        help: 'Increase font-size to at least 11px–12px for assistive reading and screen legibility.'
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. Print Prepress, Bleed Safety & Total Area Coverage (TAC)
  // --------------------------------------------------------------------------
  const bleed = layout.canvas.bleed || 0;
  const isPrint = (layout.canvas.dpi && layout.canvas.dpi >= 150) || bleed > 0;
  const safeMargin = 12; // ~3mm in standard 96 DPI points

  if (bleed > 0) {
    findings.push({
      code: 'PRINT-BLEED-ACTIVE',
      category: 'print',
      severity: 'pass',
      message: `Bleed margin active (${bleed}px / ~${(bleed / 3.78).toFixed(1)}mm).`
    });
  }

  // Trim safety checks
  for (const node of textNodes) {
    const idLabel = node.id ? `#${node.id}` : (node.name || 'text');
    const tooCloseLeft = node.x < safeMargin;
    const tooCloseTop = node.y < safeMargin;
    const tooCloseRight = node.x + node.width > layout.canvas.width - safeMargin;
    const tooCloseBottom = node.y + node.height > layout.canvas.height - safeMargin;

    if (tooCloseLeft || tooCloseTop || tooCloseRight || tooCloseBottom) {
      findings.push({
        code: 'PRINT-TRIM-COLLISION',
        category: 'print',
        severity: isPrint ? 'error' : 'warn',
        nodeId: idLabel,
        message: `${idLabel} is within ${safeMargin}px of canvas cut line.`,
        help: 'Maintain at least 3mm–4mm (12–16px) safety distance from outer cut margin.'
      });
    }
  }

  // Prepress TAC (Total Area Coverage) check on shapes and canvas
  let maxTacFound = 0;
  for (const node of allNodes) {
    if (node.fill && typeof node.fill === 'string') {
      const col = parseColorToRgba(node.fill);
      const cmyk = calculateTac(col);
      if (cmyk.tac > maxTacFound) maxTacFound = cmyk.tac;

      if (isPrint && cmyk.tac > 320) {
        const idLabel = node.id ? `#${node.id}` : (node.name || 'shape');
        findings.push({
          code: 'PRINT-TAC-EXCEEDED',
          category: 'print',
          severity: 'error',
          type: 'error',
          nodeId: idLabel,
          message: `${idLabel}: Total Area Coverage (${cmyk.tac}%) exceeds offset limit (320%).`,
          details: `CMYK breakdown: C:${cmyk.c}% M:${cmyk.m}% Y:${cmyk.y}% K:${cmyk.k}%.`,
          help: 'Excessive ink saturation causes smearing and drying failure in offset print. Reduce black undercolor.'
        });
      }

      // Pure Black vs. Rich Black for large print backgrounds (> 200px width/height)
      if (isPrint && node.width > 200 && node.height > 200 && col.r < 10 && col.g < 10 && col.b < 10) {
        if (cmyk.c === 0 && cmyk.m === 0 && cmyk.y === 0 && cmyk.k === 100) {
          findings.push({
            code: 'PRINT-PURE-BLACK-SURFACE',
            category: 'print',
            severity: 'info',
            type: 'warning',
            nodeId: node.id ? `#${node.id}` : '#background',
            message: `Large solid black background uses pure 100% K ink.`,
            help: 'Consider using Rich Black (e.g. C:60 M:40 Y:40 K:100) for deep, luxurious print blacks without dull grays.'
          });
        }
      }
    }

    // Hairline vector check (< 0.33px / 0.25pt)
    if (node.stroke && node.style?.strokeWidth !== undefined) {
      const sw = Number(node.style.strokeWidth);
      if (sw > 0 && sw < 0.35) {
        findings.push({
          code: 'PRINT-HAIRLINE-VECTOR',
          category: 'print',
          severity: isPrint ? 'error' : 'warn',
          type: 'warning',
          nodeId: node.id ? `#${node.id}` : '#stroke',
          message: `Stroke width (${sw}px) is a hazardous hairline (< 0.25pt).`,
          help: 'Hairlines below 0.25pt break or disappear on commercial CTP offset printing plates.'
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. Typographic Hierarchy, Modular Scaling & Reading Measure
  // --------------------------------------------------------------------------
  let totalLineLengthChars = 0;
  let maxLineLengthChars = 0;
  let measuredTextsCount = 0;

  // Helper to reliably get text content from node.content or joined textLayout.lines
  const getNodeContent = (node: LayoutNode): string => {
    if (typeof node.content === 'string' && node.content.length > 0) return node.content;
    if (node.textLayout && Array.isArray(node.textLayout.lines) && node.textLayout.lines.length > 0) {
      return node.textLayout.lines.join(' ');
    }
    return '';
  };

  for (const node of textNodes) {
    const idLabel = node.id ? `#${node.id}` : (node.name || 'text');
    const content = getNodeContent(node);
    const charLen = content.length;

    if (charLen > 0) {
      totalLineLengthChars += charLen;
      if (charLen > maxLineLengthChars) maxLineLengthChars = charLen;
      measuredTextsCount++;
    }

    const lines = node.textLayout?.lines || [];
    const isCentered = node.style.align === 'center';

    // Reading Measure: Uncomfortably long lines (> 85 characters per line)
    if (lines.length > 1) {
      const avgCharsPerLine = Math.round(charLen / lines.length);
      if (avgCharsPerLine > 85) {
        findings.push({
          code: 'TYPO-MEASURE-TOO-LONG',
          category: 'typography',
          severity: 'warn',
          type: 'warning',
          nodeId: idLabel,
          message: `${idLabel}: Average line measure (${avgCharsPerLine} chars) exceeds optimal reading length (45–75 chars).`,
          help: 'Narrow the container width or reduce font size to prevent eye fatigue while scanning line ends.'
        });
      }
    }

    // Line height collision check
    const fontSize = node.textLayout?.fontSize || 16;
    const lineHeight = node.textLayout?.lineHeight || fontSize;
    if (lines.length > 1 && lineHeight < fontSize * 1.1) {
      findings.push({
        code: 'TYPO-LINE-HEIGHT-TIGHT',
        category: 'typography',
        severity: 'warn',
        type: 'warning',
        nodeId: idLabel,
        elementId: node.id || node.name || 'text',
        message: `${idLabel}: Line-height (${lineHeight}px) is too tight for font-size (${fontSize}px).`,
        help: 'Set line-height to at least 1.25x to 1.5x font-size to prevent ascender/descender collisions.'
      });
    }
  }

  // Distinct font families
  const fontFamilies = Array.from(
    new Set(
      textNodes
        .map(n => (n.textLayout?.fontFamily || '').replace(/^['"]+|['"]+$/g, '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (fontFamilies.length > 3) {
    findings.push({
      code: 'TYPO-FONT-OVERLOAD',
      category: 'typography',
      severity: 'warn',
      type: 'warning',
      message: `Document uses ${fontFamilies.length} distinct font families (${fontFamilies.join(', ')}).`,
      help: 'Disciplined design systems use at most 2–3 paired font families (Headline, Body, Accent).'
    });
  } else {
    findings.push({
      code: 'TYPO-FONT-DISCIPLINE',
      category: 'typography',
      severity: 'pass',
      type: 'pass',
      message: `Typographic discipline: ${fontFamilies.length} font family/families in use.`
    });
  }

  // --------------------------------------------------------------------------
  // 4. Negative Space & Density Profiler (Axiom UNI-01 / WENIGER IST MEHR)
  // --------------------------------------------------------------------------
  // We measure root-level layout nodes to prevent double-counting children inside cards
  let occupiedArea = 0;
  for (const node of layout.nodes) {
    if (node.parent || node.parentId) continue;
    // Skip full-canvas background rects (e.g. >= 90% of both dimensions)
    if (node.width >= canvasWidth * 0.90 && node.height >= canvasHeight * 0.90) continue;
    occupiedArea += Math.min(node.width * node.height, canvasArea);
  }

  // If there are no root non-background nodes (e.g. only canvas background + texts), measure text/shape bounds
  if (occupiedArea === 0) {
    for (const node of allNodes) {
      if (node.parent || node.parentId) continue;
      if (node.width >= canvasWidth * 0.90 && node.height >= canvasHeight * 0.90) continue;
      occupiedArea += Math.min(node.width * node.height, canvasArea);
    }
  }

  // Approximate overlapping bounding boxes ratio
  const rawDensity = Math.min(1.0, occupiedArea / canvasArea);
  const canvasDensityPercent = Math.round(rawDensity * 100);
  const negativeSpacePercent = Math.max(0, 100 - canvasDensityPercent);

  // If density is excessive (> 85% occupied / < 15% negative space) with multiple clutter elements
  if (negativeSpacePercent < 20 && allNodes.length >= 8) {
    findings.push({
      code: 'SLOP-WEB-008',
      category: 'density',
      severity: 'warn',
      type: 'warning',
      message: `Horror Vacui alert: Negative space (${negativeSpacePercent}%) is severely constrained (< 20%).`,
      help: 'Axiom UNI-01: Weniger ist mehr. Reserve generous negative space and remove redundant visual clutter.'
    });
  } else {
    findings.push({
      code: 'DENSITY-BALANCED',
      category: 'density',
      severity: 'pass',
      type: 'pass',
      message: `Negative space ratio: ${negativeSpacePercent}% open breathing room.`
    });
  }

  // --------------------------------------------------------------------------
  // 5. Anti-AI-Slop Comprehensive Scanner (The Seed Heuristics & Modern Tropes)
  // --------------------------------------------------------------------------
  const slopCtx: SlopContext = {
    layout,
    allNodes,
    textNodes,
    bgRgba,
    canvasWidth,
    canvasHeight,
    canvasArea,
    negativeSpacePercent
  };

  const slopResults = runAntiSlopAudit(slopCtx);
  for (const sr of slopResults) {
    const sev: AuditSeverity = sr.severity === 'fatal' ? 'error' : (sr.severity === 'warn' ? 'warn' : 'info');
    findings.push({
      code: sr.code,
      category: 'anti-slop',
      severity: sev,
      type: sr.severity === 'fatal' ? 'error' : 'warning',
      nodeId: sr.nodeId,
      elementId: sr.elementId,
      message: sr.message,
      details: sr.details,
      help: sr.help
    });
  }

  // --------------------------------------------------------------------------
  // 6. Color Harmony & Palette Discipline
  // --------------------------------------------------------------------------
  const distinctHues = new Set<number>();
  for (const node of allNodes) {
    if (typeof node.fill === 'string') {
      const col = parseColorToRgba(node.fill);
      if (col.a > 0.2) {
        const hue = rgbToHue(col.r, col.g, col.b);
        distinctHues.add(Math.round(hue / 30) * 30); // 30-degree hue buckets
      }
    }
  }

  if (distinctHues.size > 6) {
    findings.push({
      code: 'COLOR-HUE-CHAOS',
      category: 'color',
      severity: 'warn',
      type: 'warning',
      message: `High color divergence: Layout uses ${distinctHues.size} distant color wheel hues.`,
      help: 'Restrict dominant color palettes to 1 primary accent + 1 secondary support hue + neutral shades.'
    });
  } else {
    findings.push({
      code: 'COLOR-HARMONY-PASS',
      category: 'color',
      severity: 'pass',
      type: 'pass',
      message: `Color discipline: Harmonious palette across ${distinctHues.size} tonal families.`
    });
  }

  // --------------------------------------------------------------------------
  // 7. Optical Alignment & Badge Cap-Height Metric Parity (Rule 10 & 13)
  // --------------------------------------------------------------------------
  for (const node of layout.nodes) {
    if (node.type === 'rect' && node.style.borderRadius) {
      const insideTexts = textNodes.filter(
        t => t.x >= node.x && t.x + t.width <= node.x + node.width && t.y >= node.y && t.y + t.height <= node.y + node.height
      );
      for (const t of insideTexts) {
        const hPadding = (node.width - t.width) / 2;
        const paddingRatio = hPadding / node.width;

        // Rule 10: Badge/Pill safety padding
        if (paddingRatio < 0.12 && node.width > 40 && node.height < 45) {
          findings.push({
            code: 'SLOP-PILL-PADDING',
            category: 'geometry',
            severity: 'warn',
            type: 'warning',
            nodeId: node.id ? `#${node.id}` : '#badge',
            elementId: node.id || node.name || 'badge',
            message: `Pill/Badge container #${node.id || 'badge'} has only ${(paddingRatio * 100).toFixed(0)}% horizontal safety padding.`,
            help: 'Maintain at least 15% to 20% horizontal padding around badge text to prevent cross-engine metric clipping.'
          });
        }

        // Rule 13 / SLOP-TYPE-008: Optical vertical centering in compact badges
        if (node.height >= 20 && node.height <= 36) {
          const topGap = t.y - node.y;
          const botGap = (node.y + node.height) - (t.y + t.height);
          // If text sits visibly higher than lower margin due to top baseline bias
          if (topGap < botGap - 2) {
            findings.push({
              code: 'SLOP-TYPE-008',
              category: 'geometry',
              severity: 'warn',
              type: 'warning',
              nodeId: t.id ? `#${t.id}` : '#badgeText',
              message: `Top-baseline clinging in pill #${node.id || 'badge'}: Text sits ${botGap - topGap}px too high.`,
              help: 'Rule 13: Apply optical Cap-Height offset (+1.5px to +2.5px) to achieve flawless midline alignment.'
            });
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 8. Layout & Structure Hygiene
  // --------------------------------------------------------------------------
  if (layout.warnings && layout.warnings.length > 0) {
    for (const w of layout.warnings) {
      findings.push({
        code: 'LAYOUT-WARNING',
        category: 'hygiene',
        severity: 'warn',
        type: 'warning',
        message: w
      });
    }
  } else {
    findings.push({
      code: 'DOM-CLEAN',
      category: 'hygiene',
      severity: 'pass',
      type: 'pass',
      message: 'Clean layout hierarchy with zero unresolved relational anchors.'
    });
  }

  // --------------------------------------------------------------------------
  // Rich Telemetry & Census Extraction
  // --------------------------------------------------------------------------
  const paletteCounts = new Map<string, number>();
  const registerColor = (cStr?: string) => {
    if (!cStr || typeof cStr !== 'string') return;
    if (cStr.startsWith('#') || cStr.startsWith('rgb') || cStr.startsWith('alpha(')) {
      try {
        const parsed = parseColorToRgba(cStr);
        const hex = `#${parsed.r.toString(16).padStart(2, '0')}${parsed.g.toString(16).padStart(2, '0')}${parsed.b.toString(16).padStart(2, '0')}`;
        paletteCounts.set(hex, (paletteCounts.get(hex) || 0) + 1);
      } catch {}
    }
  };
  if (typeof layout.canvas.background === 'string') registerColor(layout.canvas.background);
  for (const n of allNodes) {
    if (typeof n.fill === 'string') registerColor(n.fill);
    if (typeof n.style?.color === 'string') registerColor(n.style.color);
    if (typeof n.style?.stroke === 'string') registerColor(n.style.stroke);
  }
  const paletteSwatches: ColorPaletteSwatch[] = Array.from(paletteCounts.entries())
    .map(([hex, usageCount]) => {
      const col = parseColorToRgba(hex);
      return { hex, usageCount, luminance: Math.round(calculateLuminance(col) * 100) / 100 };
    })
    .sort((a, b) => b.usageCount - a.usageCount);

  const fontSizeMap = new Map<number, { count: number; weights: Set<string | number> }>();
  for (const node of textNodes) {
    const sz = node.textLayout?.fontSize || (node.style as any)?.fontSize || 16;
    const wt = node.textLayout?.fontWeight || (node.style as any)?.fontWeight || 400;
    if (!fontSizeMap.has(sz)) {
      fontSizeMap.set(sz, { count: 0, weights: new Set() });
    }
    const entry = fontSizeMap.get(sz)!;
    entry.count++;
    entry.weights.add(wt);
  }
  const typeScale: TypeScaleEntry[] = Array.from(fontSizeMap.entries())
    .map(([size, d]) => ({ size, count: d.count, weights: Array.from(d.weights) }))
    .sort((a, b) => b.size - a.size);

  const elementCensus = {
    total: allNodes.length,
    texts: textNodes.length,
    rects: allNodes.filter(n => n.type === 'rect').length,
    groups: allNodes.filter(n => n.type === 'group' || n.type === 'stack').length,
    shapes: allNodes.filter(n => n.type === 'circle' || n.type === 'path' || n.type === 'polygon').length,
    images: allNodes.filter(n => n.type === 'image').length
  };

  // --------------------------------------------------------------------------
  // Finding Deduplication & Axiom/Fix Enrichment
  // --------------------------------------------------------------------------
  const rawFindings = findings.map(enrichFinding);
  const uniqueFindings: AuditFinding[] = [];
  const seenKeys = new Set<string>();
  for (const f of rawFindings) {
    const key = `${f.code}::${f.nodeId || ''}::${f.category}::${f.message}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueFindings.push(f);
    }
  }

  // --------------------------------------------------------------------------
  // Scoring & Grade Aggregations
  // --------------------------------------------------------------------------
  const calcCat = (categoriesToMatch: AuditCategory[], name: string): CategoryScore => {
    const list = uniqueFindings.filter(f => categoriesToMatch.includes(f.category));
    const passes = list.filter(f => f.severity === 'pass').length;
    const warnings = list.filter(f => f.severity === 'warn').length;
    const errors = list.filter(f => f.severity === 'error').length;

    let penalty = 0;
    if (categoriesToMatch.includes('anti-slop')) {
      // Drastic scoring penalty for AI Slop: -35 per fatal error, -18 per warning
      penalty = errors * 35 + warnings * 18;
    } else {
      penalty = errors * 25 + warnings * 10;
    }
    let score = Math.max(0, 100 - penalty);
    if (list.length === 0) score = 100;

    return {
      name,
      score,
      grade: calculateGrade(score),
      passes,
      warnings,
      errors
    };
  };

  const categories = {
    accessibility: calcCat(['accessibility', 'contrast'], 'Accessibility & Contrast (WCAG/APCA)'),
    print: calcCat(['print'], 'Print & Prepress Safety (Bleed/TAC)'),
    typography: calcCat(['typography'], 'Typography & Hierarchy'),
    density: calcCat(['density'], 'Negative Space & Density (Axiom 1)'),
    antiSlop: calcCat(['anti-slop'], 'Anti-AI-Slop Scanner'),
    color: calcCat(['color'], 'Color Harmony & Palette Discipline'),
    geometry: calcCat(['geometry'], 'Geometry & Optical Alignment'),
    hygiene: calcCat(['hygiene'], 'Layout & Structure Hygiene')
  };

  const fatalSlopCount = uniqueFindings.filter(f => f.category === 'anti-slop' && f.severity === 'error').length;
  const warnSlopCount = uniqueFindings.filter(f => f.category === 'anti-slop' && f.severity === 'warn').length;

  let computedScore = Math.round(
    categories.accessibility.score * 0.20 +
    categories.print.score * 0.10 +
    categories.typography.score * 0.15 +
    categories.density.score * 0.15 +
    categories.antiSlop.score * 0.20 +
    categories.color.score * 0.05 +
    categories.geometry.score * 0.05 +
    categories.hygiene.score * 0.10
  );

  let slopCapActive = false;
  let slopCapScore: number | undefined;

  // Drastic Slop Penalty:
  // If any fatal slop violation exists, cap overall score at 78% (max Grade C+)
  // If 2+ fatal slop violations exist, cap overall score at 58% (Grade D)
  if (fatalSlopCount >= 2) {
    if (computedScore > 58) {
      computedScore = 58;
      slopCapActive = true;
      slopCapScore = 58;
    }
  } else if (fatalSlopCount === 1) {
    if (computedScore > 78) {
      computedScore = 78;
      slopCapActive = true;
      slopCapScore = 78;
    }
  } else if (warnSlopCount >= 3) {
    if (computedScore > 84) {
      computedScore = 84;
      slopCapActive = true;
      slopCapScore = 84;
    }
  }

  const totalScore = Math.max(0, computedScore);

  let slopRiskLevel: 'clean' | 'low' | 'moderate' | 'high' | 'critical' = 'clean';
  if (fatalSlopCount >= 2) slopRiskLevel = 'critical';
  else if (fatalSlopCount === 1) slopRiskLevel = 'high';
  else if (warnSlopCount >= 2) slopRiskLevel = 'moderate';
  else if (warnSlopCount === 1) slopRiskLevel = 'low';

  const totalErrors = uniqueFindings.filter(f => f.severity === 'error').length;
  const totalWarnings = uniqueFindings.filter(f => f.severity === 'warn').length;
  const slopFindings = uniqueFindings.filter(f => f.category === 'anti-slop' && f.severity !== 'pass').length;

  // Advanced Statistical & Computational Design Telemetry
  const opticalCentroid = calculateOpticalCentroid(allNodes, canvasWidth, canvasHeight);
  const whitespaceDistribution = calculateWhitespaceDistribution(allNodes, canvasWidth, canvasHeight, negativeSpacePercent);
  const typographicTelemetry = analyzeTypographicTelemetry(textNodes);
  const allParsedColors = paletteSwatches.map(p => parseColorToRgba(p.hex));
  const colorTelemetry = analyzeColorTelemetry(allParsedColors);

  const metrics: DesignAuditMetrics = {
    canvasWidth,
    canvasHeight,
    canvasDpi: layout.canvas.dpi || 72,
    aspectRatio: layout.canvas.aspectRatio || `${(canvasWidth / canvasHeight).toFixed(2)}:1`,
    totalAreaPx: canvasArea,
    canvasDensityPercent,
    negativeSpacePercent,
    distinctFontFamilies: fontFamilies,
    distinctHues: distinctHues.size,
    maxTotalAreaCoverage: maxTacFound,
    avgLineLengthChars: measuredTextsCount > 0 ? Math.round(totalLineLengthChars / measuredTextsCount) : 0,
    maxLineLengthChars,
    slopFindingsCount: slopFindings,
    slopFatalCount: fatalSlopCount,
    slopWarningCount: warnSlopCount,
    slopScore: categories.antiSlop.score,
    slopRiskLevel,
    slopCapActive,
    slopCapScore,
    elementCensus,
    paletteSwatches,
    typeScale,
    contrastPairs,
    opticalCentroid,
    whitespaceDistribution,
    typographicTelemetry,
    colorTelemetry
  };

  return {
    file: resolvedPath,
    timestamp: Date.now(),
    overallScore: totalScore,
    overallGrade: calculateGrade(totalScore),
    score: totalScore,
    grade: calculateGrade(totalScore),
    issues: uniqueFindings,
    stats: {
      elementsTotal: allNodes.length,
      textsTotal: textNodes.length,
      errors: totalErrors,
      warnings: totalWarnings
    },
    metrics,
    categories,
    findings: uniqueFindings
  };
}

// ============================================================================
// Formatter: Flawless ANSI & Unicode Console Dashboard
// ============================================================================

export interface FormatReportOptions {
  verbose?: boolean;
  slopOnly?: boolean;
  compact?: boolean;
  showFixes?: boolean;
}

export function formatWarningsSection(report: AuditReport, options?: { standalone?: boolean }): string {
  const c = {
    bold: (s: string) => `\x1b[1m${s}\x1b[22m`,
    dim: (s: string) => `\x1b[2m${s}\x1b[22m`,
    green: (s: string) => `\x1b[32m${s}\x1b[39m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
    red: (s: string) => `\x1b[31m${s}\x1b[39m`,
    cyan: (s: string) => `\x1b[36m${s}\x1b[39m`,
    blue: (s: string) => `\x1b[34m${s}\x1b[39m`,
    bgRed: (s: string) => `\x1b[41m\x1b[37m\x1b[1m${s}\x1b[0m`,
    bgYellow: (s: string) => `\x1b[43m\x1b[30m\x1b[1m${s}\x1b[0m`,
    bgBlue: (s: string) => `\x1b[44m\x1b[37m\x1b[1m${s}\x1b[0m`
  };

  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
  const RULE_W = 74;
  const topBorder = (title: string) => c.bold(`┌─ ${title} ${'─'.repeat(Math.max(2, RULE_W - stripAnsi(title).length - 5))}`);
  const midBorder = (title?: string) => {
    if (!title) return c.bold(`├${'─'.repeat(RULE_W - 1)}`);
    return c.bold(`├─ ${title} ${'─'.repeat(Math.max(2, RULE_W - stripAnsi(title).length - 5))}`);
  };
  const bottomBorder = () => c.bold(`└${'─'.repeat(RULE_W - 1)}`);
  const gutter = (content = '') => c.bold('│  ') + content;
  const emptyGutter = () => c.bold('│');

  const lines: string[] = [];
  const activeIssues = report.findings.filter(f => f.severity !== 'pass');

  if (options?.standalone) {
    lines.push('');
    lines.push(topBorder('⚠️ Begründungen für Bewertungen < 100% (Warnings & Ursachen)'));
  } else {
    lines.push(emptyGutter());
    lines.push(midBorder('⚠️ Begründungen für Bewertungen < 100% (Warnings & Ursachen)'));
  }
  lines.push(emptyGutter());

  if (activeIssues.length === 0) {
    lines.push(gutter(c.green('   ✔ Alle Kategorien erreichen 100%. Keine Beanstandungen oder Warnungen vorhanden.')));
  } else {
    const categoryMappings: Array<{
      key: keyof typeof report.categories;
      matchCats: AuditCategory[];
    }> = [
      { key: 'accessibility', matchCats: ['accessibility', 'contrast'] },
      { key: 'print', matchCats: ['print'] },
      { key: 'typography', matchCats: ['typography'] },
      { key: 'density', matchCats: ['density'] },
      { key: 'antiSlop', matchCats: ['anti-slop'] },
      { key: 'color', matchCats: ['color'] },
      { key: 'geometry', matchCats: ['geometry', 'boundary'] },
      { key: 'hygiene', matchCats: ['hygiene'] }
    ];

    const renderedIssues = new Set<AuditFinding>();

    for (const entry of categoryMappings) {
      const cat = report.categories[entry.key];
      if (!cat) continue;
      const catIssues = activeIssues.filter(f => entry.matchCats.includes(f.category));

      if (cat.score < 100 || cat.warnings > 0 || cat.errors > 0 || catIssues.length > 0) {
        lines.push(gutter(`   ${c.bold(c.cyan('📌 ' + cat.name))} ${c.bold(`[${cat.score}% / Note: ${cat.grade}]`)} ${c.dim(`— ${cat.errors} Fehler, ${cat.warnings} Warnung(en)`)}`));
        lines.push(emptyGutter());

        if (catIssues.length === 0) {
          lines.push(gutter(c.yellow('     (Punktabzug durch übergreifende Kriterien)')));
        } else {
          for (const issue of catIssues) {
            renderedIssues.add(issue);
            const isErr = issue.severity === 'error';
            const sevBadge = isErr ? c.bgRed(' ✖ ERROR ') : (issue.severity === 'warn' ? c.bgYellow(' ⚠ WARN ') : c.bgBlue(' ℹ NOTICE '));
            const penaltyStr = isErr ? c.red('(-25 bis -35 Pkt)') : c.yellow('(-10 bis -18 Pkt)');

            lines.push(gutter(`     ${sevBadge} ${c.bold(issue.code)} ${penaltyStr}`));
            if (issue.nodeId) lines.push(gutter(`       ${c.bold('Ziel-Element:')} ${c.cyan(issue.nodeId)}`));
            lines.push(gutter(`       ${c.bold('Begründung:')}   ${issue.message}`));
            if (issue.axiom) lines.push(gutter(`       ${c.bold('Axiom/Regel:')}  ${c.dim(issue.axiom)}`));
            if (issue.details) lines.push(gutter(`       ${c.bold('Details:')}      ${c.dim(issue.details)}`));
            lines.push(gutter(c.dim(`       ${'─'.repeat(66)}`)));
          }
        }
        lines.push(emptyGutter());
      }
    }

    const unrenderedIssues = activeIssues.filter(f => !renderedIssues.has(f));
    if (unrenderedIssues.length > 0) {
      lines.push(gutter(`   ${c.bold(c.cyan('📌 Weitere Befunde & Abzüge'))}`));
      lines.push(emptyGutter());
      for (const issue of unrenderedIssues) {
        const isErr = issue.severity === 'error';
        const sevBadge = isErr ? c.bgRed(' ✖ ERROR ') : (issue.severity === 'warn' ? c.bgYellow(' ⚠ WARN ') : c.bgBlue(' ℹ NOTICE '));
        const penaltyStr = isErr ? c.red('(-25 Pkt)') : c.yellow('(-10 Pkt)');
        lines.push(gutter(`     ${sevBadge} ${c.bold(issue.code)} ${penaltyStr} [${c.dim(issue.category)}]`));
        if (issue.nodeId) lines.push(gutter(`       ${c.bold('Ziel-Element:')} ${c.cyan(issue.nodeId)}`));
        lines.push(gutter(`       ${c.bold('Begründung:')}   ${issue.message}`));
        if (issue.axiom) lines.push(gutter(`       ${c.bold('Axiom/Regel:')}  ${c.dim(issue.axiom)}`));
        if (issue.details) lines.push(gutter(`       ${c.bold('Details:')}      ${c.dim(issue.details)}`));
        lines.push(gutter(c.dim(`       ${'─'.repeat(66)}`)));
      }
      lines.push(emptyGutter());
    }
  }

  if (options?.standalone) {
    lines.push(bottomBorder());
  }

  return lines.join('\n');
}

export function formatFixesSection(report: AuditReport, options?: { standalone?: boolean }): string {
  const c = {
    bold: (s: string) => `\x1b[1m${s}\x1b[22m`,
    dim: (s: string) => `\x1b[2m${s}\x1b[22m`,
    green: (s: string) => `\x1b[32m${s}\x1b[39m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
    red: (s: string) => `\x1b[31m${s}\x1b[39m`,
    cyan: (s: string) => `\x1b[36m${s}\x1b[39m`,
    blue: (s: string) => `\x1b[34m${s}\x1b[39m`,
    bgRed: (s: string) => `\x1b[41m\x1b[37m\x1b[1m${s}\x1b[0m`,
    bgYellow: (s: string) => `\x1b[43m\x1b[30m\x1b[1m${s}\x1b[0m`,
    bgBlue: (s: string) => `\x1b[44m\x1b[37m\x1b[1m${s}\x1b[0m`
  };

  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
  const RULE_W = 74;
  const topBorder = (title: string) => c.bold(`┌─ ${title} ${'─'.repeat(Math.max(2, RULE_W - stripAnsi(title).length - 5))}`);
  const midBorder = (title?: string) => {
    if (!title) return c.bold(`├${'─'.repeat(RULE_W - 1)}`);
    return c.bold(`├─ ${title} ${'─'.repeat(Math.max(2, RULE_W - stripAnsi(title).length - 5))}`);
  };
  const bottomBorder = () => c.bold(`└${'─'.repeat(RULE_W - 1)}`);
  const gutter = (content = '') => c.bold('│  ') + content;
  const emptyGutter = () => c.bold('│');

  const lines: string[] = [];
  const activeIssues = report.findings.filter(f => f.severity !== 'pass');

  if (options?.standalone) {
    lines.push('');
    lines.push(topBorder('🔍 Befunde & Handlungsempfehlungen (Mit Quick-Fix)'));
  } else {
    lines.push(emptyGutter());
    lines.push(midBorder('🔍 Befunde & Handlungsempfehlungen (Mit Quick-Fix)'));
  }
  lines.push(emptyGutter());

  if (activeIssues.length === 0) {
    lines.push(gutter(c.green('   ✔ All heuristics passed cleanly. Alle Kriterien vollständig erfüllt.')));
  } else {
    for (const issue of activeIssues) {
      const isErr = issue.severity === 'error';
      const sevBadge = isErr ? c.bgRed(' ✖ ERROR ') : (issue.severity === 'warn' ? c.bgYellow(' ⚠ WARN ') : c.bgBlue(' ℹ NOTICE '));
      const penaltyStr = isErr ? c.red('(-25 bis -35 Pkt)') : c.yellow('(-10 bis -18 Pkt)');

      lines.push(gutter(`   ${sevBadge} ${c.bold(issue.code)} ${penaltyStr} [${c.dim(issue.category)}]`));
      if (issue.nodeId) lines.push(gutter(`     ${c.bold('Ziel-Element:')} ${c.cyan(issue.nodeId)}`));
      lines.push(gutter(`     ${c.bold('Problem:')}      ${issue.message}`));
      if (issue.axiom) lines.push(gutter(`     ${c.bold('Axiom/Regel:')}  ${c.dim(issue.axiom)}`));
      if (issue.fixSnippet) {
        lines.push(gutter(`     ${c.green(c.bold('💡 QUICK FIX:'))}  ${c.green(issue.fixSnippet)}`));
      }
      lines.push(gutter(c.dim(`     ${'─'.repeat(68)}`)));
    }
  }

  if (activeIssues.length > 0) {
    lines.push(emptyGutter());
    lines.push(midBorder('🚀 Priorisierter Sofort-Aktionsplan (Top 3 Empfohlene Schritte)'));
    lines.push(emptyGutter());

    const sorted = [...activeIssues].sort((a, b) => {
      const score = (sev: string) => sev === 'error' ? 2 : (sev === 'warn' ? 1 : 0);
      return score(b.severity) - score(a.severity);
    });

    const topFixes = sorted.slice(0, 3);
    topFixes.forEach((fix, idx) => {
      const num = `${idx + 1}.`;
      const impact = fix.severity === 'error' ? c.red('[Dringlich / Fatal]') : c.yellow('[Wichtig]');
      lines.push(gutter(`   ${c.bold(num)} ${impact} ${c.bold(fix.code)}: ${fix.message}`));
      if (fix.fixSnippet) {
        lines.push(gutter(`      ${c.green('➜')} ${c.dim(fix.fixSnippet)}`));
      }
    });
  }

  if (options?.standalone) {
    lines.push(emptyGutter());
    lines.push(bottomBorder());
  }

  return lines.join('\n');
}

export function formatTerminalReport(
  report: AuditReport,
  options?: FormatReportOptions
): string {
  const c = {
    bold: (s: string) => `\x1b[1m${s}\x1b[22m`,
    dim: (s: string) => `\x1b[2m${s}\x1b[22m`,
    green: (s: string) => `\x1b[32m${s}\x1b[39m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
    red: (s: string) => `\x1b[31m${s}\x1b[39m`,
    cyan: (s: string) => `\x1b[36m${s}\x1b[39m`,
    magenta: (s: string) => `\x1b[35m${s}\x1b[39m`,
    blue: (s: string) => `\x1b[34m${s}\x1b[39m`,
    white: (s: string) => `\x1b[37m${s}\x1b[39m`,
    bgGreen: (s: string) => `\x1b[42m\x1b[30m\x1b[1m${s}\x1b[0m`,
    bgYellow: (s: string) => `\x1b[43m\x1b[30m\x1b[1m${s}\x1b[0m`,
    bgRed: (s: string) => `\x1b[41m\x1b[37m\x1b[1m${s}\x1b[0m`,
    bgCyan: (s: string) => `\x1b[46m\x1b[30m\x1b[1m${s}\x1b[0m`,
    bgBlue: (s: string) => `\x1b[44m\x1b[37m\x1b[1m${s}\x1b[0m`
  };

  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

  const RULE_W = 74;
  const topBorder = (title: string) => c.bold(`┌─ ${title} ${'─'.repeat(Math.max(2, RULE_W - stripAnsi(title).length - 5))}`);
  const midBorder = (title?: string) => {
    if (!title) return c.bold(`├${'─'.repeat(RULE_W - 1)}`);
    return c.bold(`├─ ${title} ${'─'.repeat(Math.max(2, RULE_W - stripAnsi(title).length - 5))}`);
  };
  const bottomBorder = () => c.bold(`└${'─'.repeat(RULE_W - 1)}`);
  const gutter = (content = '') => c.bold('│  ') + content;
  const emptyGutter = () => c.bold('│');

  const makeBar = (score: number, len = 14) => {
    const filled = Math.max(0, Math.min(len, Math.round((score / 100) * len)));
    const empty = len - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    if (score >= 90) return c.green(bar);
    if (score >= 75) return c.yellow(bar);
    return c.red(bar);
  };

  const gradeBadge = (grade: string, score: number) => {
    const text = ` ${grade} (${score} / 100) `;
    if (score >= 90) return c.bgGreen(text);
    if (score >= 75) return c.bgYellow(text);
    return c.bgRed(text);
  };

  const m = report.metrics;
  const lines: string[] = [];

  // --------------------------------------------------------------------------
  // Slop Threat Level Badge
  // --------------------------------------------------------------------------
  let slopThreatBadge = c.green('🛡 SLOP-FREE (0)');
  if (m?.slopRiskLevel === 'critical') {
    slopThreatBadge = c.bgRed(` 🚨 CRITICAL SLOP (${m.slopFindingsCount}) `);
  } else if (m?.slopRiskLevel === 'high') {
    slopThreatBadge = c.red(c.bold(`🚨 HIGH SLOP (${m?.slopFindingsCount})`));
  } else if (m?.slopRiskLevel === 'moderate') {
    slopThreatBadge = c.yellow(c.bold(`⚠️ MODERATE SLOP (${m?.slopFindingsCount})`));
  } else if (m?.slopFindingsCount && m.slopFindingsCount > 0) {
    slopThreatBadge = c.yellow(`${m.slopFindingsCount} Slop Issue(s)`);
  }

  // --------------------------------------------------------------------------
  // If Slop-Only mode requested
  // --------------------------------------------------------------------------
  if (options?.slopOnly) {
    lines.push('');
    lines.push(topBorder('Anti-AI-Slop Scanner Deep Inspection'));
    lines.push(emptyGutter());
    lines.push(gutter(`${c.bold('Bedrohungs-Stufe:')} ${slopThreatBadge}   |   ${c.bold('Score:')} ${report.categories.antiSlop.score}% [${report.categories.antiSlop.grade}]`));
    lines.push(gutter(c.dim(`26 Heuristiken evaluiert (${26 - (m?.slopFindingsCount || 0)} bestanden, ${m?.slopFindingsCount || 0} Beanstandungen)`)));
    lines.push(emptyGutter());
    lines.push(midBorder('Auffälligkeiten'));
    lines.push(emptyGutter());

    const slopIssues = report.findings.filter(f => f.category === 'anti-slop' && f.severity !== 'pass');
    if (slopIssues.length === 0) {
      lines.push(gutter(c.green('✔ All heuristics passed cleanly. Keine AI-Slop Muster gefunden.')));
    } else {
      for (const issue of slopIssues) {
        const marker = issue.severity === 'error' ? c.bgRed(' FATAL ') : c.bgYellow(' WARN ');
        lines.push(gutter(`${marker} ${c.bold(issue.code)}: ${issue.message}`));
        if (issue.nodeId) lines.push(gutter(`     ${c.dim('Ziel:')} ${c.cyan(issue.nodeId)}`));
        if (issue.help) lines.push(gutter(`     ${c.cyan('➜')} ${c.dim(issue.help)}`));
        if (issue.fixSnippet) lines.push(gutter(`     ${c.green('💡 Quick Fix:')} ${c.dim(issue.fixSnippet)}`));
        lines.push(gutter(c.dim(`     ${'─'.repeat(64)}`)));
      }
    }
    lines.push(emptyGutter());
    lines.push(bottomBorder());
    lines.push('');
    return lines.join('\n');
  }

  // --------------------------------------------------------------------------
  // Header Hero Box
  // --------------------------------------------------------------------------
  lines.push('');
  lines.push(topBorder('TOAD DESIGN, PREPRESS & ANTI-AI-SLOP AUDIT'));
  lines.push(emptyGutter());

  const titleText = 'TOAD DESIGN & PRODUCTION QUALITY AUDITOR';
  lines.push(gutter(c.bold(titleText) + '   ' + gradeBadge(report.overallGrade, report.overallScore)));

  if (report.file) {
    lines.push(gutter(c.dim('Datei:   ') + c.cyan(report.file)));
    lines.push(gutter(c.dim('Prüfung: ') + c.dim(new Date(report.timestamp).toLocaleTimeString())));
  }

  lines.push(emptyGutter());

  let statusVerdict = '';
  if (report.overallScore >= 90) {
    statusVerdict = c.green(c.bold('★ STATUS: AUSGEZEICHNET')) + c.dim(' — Erstklassige visuelle Disziplin, barrierefrei & slop-frei.');
  } else if (report.overallScore >= 75) {
    statusVerdict = c.yellow(c.bold('✔ STATUS: SOLIDE')) + c.dim(' — Grundlagen erfüllt; gezielte Optimierungen für Note A empfohlen.');
  } else {
    statusVerdict = c.red(c.bold('🚨 STATUS: REVISION ERFORDERLICH')) + c.dim(' — Erhebliche Gestaltungs-, Lesbarkeits- oder Slop-Mängel.');
  }
  lines.push(gutter(statusVerdict));

  if (m?.slopCapActive) {
    lines.push(emptyGutter());
    lines.push(gutter(c.bgRed(' SLOP-CAP AKTIV ') + c.red(` Note wurde wegen ${m.slopFatalCount || 1} fatalem Slop-Fund auf max. ${m.slopCapScore}% gedeckelt!`)));
  }

  // --------------------------------------------------------------------------
  // Section 1: Scene Vitals & Telemetry Dashboard
  // --------------------------------------------------------------------------
  lines.push(emptyGutter());
  lines.push(midBorder('📊 Scene Vitals & Telemetrie Dashboard'));
  lines.push(emptyGutter());

  // 1. Geometry & Density
  const spaceBadge = (m?.negativeSpacePercent ?? 0) >= 40 && (m?.negativeSpacePercent ?? 0) <= 65
    ? c.green('Optimal (40–65%)')
    : ((m?.negativeSpacePercent ?? 0) < 20 ? c.red('Horror Vacui (< 20%)') : c.yellow('Check'));

  lines.push(gutter(c.bold(c.cyan('📐 Geometrie & Flächenauslastung'))));
  lines.push(gutter(`   Canvas:         ${m?.canvasWidth || 800} × ${m?.canvasHeight || 600} px (${(m?.totalAreaPx || 480000).toLocaleString()} px²) • Seitenverhältnis: ${m?.aspectRatio || '4:3'}`));
  const isPrint = (m?.canvasDpi || 72) >= 150;
  lines.push(gutter(`   Farbraum/Modus: ${isPrint ? 'Druck / Print (CMYK)' : 'Web (sRGB)'} @ ${m?.canvasDpi || 72} DPI • Anschnitt: ${isPrint ? 'Aktiv (3mm)' : 'Digital (0 px)'}`));
  const ec = m?.elementCensus;
  if (ec) {
    lines.push(gutter(`   Elemente-Census: ${ec.total} Nodes (${ec.texts} Text, ${ec.rects} Rect, ${ec.groups} Group/Stack, ${ec.shapes} Shape, ${ec.images} Image)`));
  }
  lines.push(gutter(`   Flächen-Dichte: Belegt: ${m?.canvasDensityPercent || 0}% • Weißraum: ${m?.negativeSpacePercent || 0}% [${spaceBadge}]`));
  lines.push(emptyGutter());

  // 2. Typography
  const fontList = m?.distinctFontFamilies?.length ? m.distinctFontFamilies.join(', ') : 'Default Sans';
  lines.push(gutter(c.bold(c.cyan('🔤 Typografie & Satzmetrik'))));
  lines.push(gutter(`   Schriftfamilien: ${c.cyan(fontList)}`));
  if (m?.typeScale && m.typeScale.length > 0) {
    const scaleStr = m.typeScale.slice(0, 5).map(t => `${t.size}px (${t.count}×)`).join(' ➜ ');
    lines.push(gutter(`   Hierarchie-Leiter: ${c.dim(scaleStr)}`));
  }
  const measureStatus = (m?.avgLineLengthChars ?? 0) >= 45 && (m?.avgLineLengthChars ?? 0) <= 75
    ? c.green('Optimal (45–75)')
    : ((m?.avgLineLengthChars ?? 0) > 85 ? c.yellow('Zu lang (> 85)') : c.dim('Kompakt'));
  lines.push(gutter(`   Satzspiegel:       Ø ${m?.avgLineLengthChars || 0} Zeichen/Zeile • Max: ${m?.maxLineLengthChars || 0} Zeichen [${measureStatus}]`));
  lines.push(emptyGutter());

  // 3. Palette & Contrast
  lines.push(gutter(c.bold(c.cyan('🎨 Farbpalette & Kontrast-Matrix'))));
  if (m?.paletteSwatches && m.paletteSwatches.length > 0) {
    const swatchesStr = m.paletteSwatches.slice(0, 6).map(s => `■ ${s.hex} (${s.usageCount}×)`).join('  ');
    lines.push(gutter(`   Swatches:       ${swatchesStr}`));
  }
  const hueDiscipline = (m?.distinctHues ?? 0) <= 4 ? c.green('✔ Harmonisch diszipliniert') : c.yellow('⚠️ Erhöhte Divergenz');
  lines.push(gutter(`   Farb-Harmonie:  ${m?.distinctHues || 1} Farbton-Sektoren [${hueDiscipline}]`));
  if (m?.contrastPairs && m.contrastPairs.length > 0) {
    lines.push(gutter(c.dim('   Kontrast-Stichproben:')));
    for (const cp of m.contrastPairs.slice(0, 3)) {
      const apcaBadge = cp.passesApca ? c.green(`|Lc|=${Math.abs(cp.apcaLc)}`) : c.yellow(`|Lc|=${Math.abs(cp.apcaLc)} (Notice)`);
      const wcagBadge = cp.passesWcag ? c.green(`${cp.wcagRatio}:1`) : c.red(`${cp.wcagRatio}:1 (Fail)`);
      lines.push(gutter(`    • ${c.bold(cp.nodeId)}: WCAG ${wcagBadge} | APCA ${apcaBadge} | ${c.dim(cp.fgHex)} auf ${c.dim(cp.bgHex)}`));
    }
  }
  lines.push(emptyGutter());

  // 4. Prepress
  lines.push(gutter(c.bold(c.cyan('🖨 Prepress & Flightcheck'))));
  const tacStatus = (m?.maxTotalAreaCoverage ?? 0) > 320 ? c.red('✖ TAC Überschritten (> 320%)') : c.green('✔ Sicher für Bogenoffset');
  lines.push(gutter(`   Gesamtfarbauftrag: Max TAC: ${m?.maxTotalAreaCoverage || 0}% [${tacStatus}]`));
  const printIssues = report.findings.filter(f => f.category === 'print' && f.severity !== 'pass');
  if (printIssues.length > 0) {
    lines.push(gutter(`   Schnittkanten:     ${c.yellow(`⚠️ ${printIssues.length} Element(e) ragen in die 12px-Schnittzone`)}`));
  } else {
    lines.push(gutter(`   Schnittkanten:     ${c.green('✔ Alle Elemente halten mindestens 12px (3mm) Beschnitt-Abstand')}`));
  }
  lines.push(emptyGutter());

  // 5. Computational Design & Mathematische Telemetrie
  lines.push(gutter(c.bold(c.cyan('📐 Mathematische Telemetrie & Computational Design'))));
  if (m?.opticalCentroid) {
    const oc = m.opticalCentroid;
    const dySign = oc.deltaYPercent >= 0 ? '+' : '';
    const dxSign = oc.deltaXPercent >= 0 ? '+' : '';
    lines.push(gutter(`   Optischer Schwerpunkt:  [ ${oc.visualMassCenter.x}, ${oc.visualMassCenter.y} ] px (ΔY: ${dySign}${oc.deltaYPercent}%, ΔX: ${dxSign}${oc.deltaXPercent}%) • ${c.dim(oc.balanceStatus)}`));
    lines.push(gutter(`   Quadranten-Masse:       TL: ${oc.quadrantMass.topLeftPercent}% │ TR: ${oc.quadrantMass.topRightPercent}% │ BL: ${oc.quadrantMass.bottomLeftPercent}% │ BR: ${oc.quadrantMass.bottomRightPercent}%`));
  }
  if (m?.whitespaceDistribution) {
    const wd = m.whitespaceDistribution;
    const giniBadge = wd.voronoiGini >= 0.40 && wd.voronoiGini <= 0.75 ? c.green(`Gini: ${wd.voronoiGini}`) : c.yellow(`Gini: ${wd.voronoiGini}`);
    const hviBadge = wd.horrorVacuiIndex <= 0.45 ? c.green(`HVI: ${wd.horrorVacuiIndex}`) : c.red(`HVI: ${wd.horrorVacuiIndex}`);
    lines.push(gutter(`   Raum-Architektur:       ${giniBadge} • ${hviBadge} • ${c.dim(wd.message)}`));
  }
  if (m?.typographicTelemetry) {
    const tt = m.typographicTelemetry;
    const r2Badge = tt.modularScale.r2Score >= 0.88 ? c.green(`R² = ${tt.modularScale.r2Score.toFixed(2)}`) : c.yellow(`R² = ${tt.modularScale.r2Score.toFixed(2)}`);
    lines.push(gutter(`   Typo-Skalen-Fidelity:   ${tt.modularScale.bestScaleName} (${tt.modularScale.bestRatio.toFixed(3)}) • ${r2Badge} [${tt.modularScale.isHarmonious ? c.green('Harmonisch') : c.yellow('Ausreißer')}]`));
    const marginBadge = tt.hasCenteredProse ? c.red('✖ Zentrierter Fließtext') : c.green('✔ Strikte linke Lesekante');
    const capsBadge = tt.unspacedAllCapsCount > 0 ? c.yellow(`⚠️ ${tt.unspacedAllCapsCount}x All-Caps ungesperrt`) : c.green('✔ Versalien gesperrt');
    lines.push(gutter(`   Leseführung & Rhythmus: ${marginBadge} • ${capsBadge}`));
  }
  if (m?.colorTelemetry) {
    const ct = m.colorTelemetry;
    const triadBadge = ct.slopTriadDistance >= 0.25 ? c.green(`Dist: ${ct.slopTriadDistance}`) : c.red(`Dist: ${ct.slopTriadDistance} (Klon-Verdacht)`);
    lines.push(gutter(`   OKLCH-Farbspektrum:     Entropie: ${ct.shannonEntropyBits} Bits • Slop-Triad: ${triadBadge} • ${c.dim(ct.paletteCharacter)}`));
  }

  // --------------------------------------------------------------------------
  // Section 2: Anti-AI-Slop Deep Inspection Card
  // --------------------------------------------------------------------------
  lines.push(emptyGutter());
  lines.push(midBorder('🛡 Anti-AI-Slop Scanner Deep Inspection'));
  lines.push(emptyGutter());
  lines.push(gutter(`  Bedrohungs-Stufe:  ${slopThreatBadge}   |   Slop-Score: ${report.categories.antiSlop.score}% [${report.categories.antiSlop.grade}]`));
  lines.push(gutter(c.dim(`  59 Heuristiken aktiv: Web & Hero (15), UI & Lighting (6), Typo (12), Gradients & Color (4), Vektoren & Greebling (11), Print (6), Dashboards (5), Mobile (2)`)));
  lines.push(emptyGutter());

  const slopErrors = report.findings.filter(f => f.category === 'anti-slop' && f.severity === 'error');
  const slopWarns = report.findings.filter(f => f.category === 'anti-slop' && f.severity === 'warn');

  if (slopErrors.length === 0 && slopWarns.length === 0) {
    lines.push(gutter(c.green('  ✔ All heuristics passed cleanly. Keine AI-Slop-Muster detektiert.')));
    lines.push(gutter(c.dim('    Geprüft: Purple Haze, Bento Overkill, Floating Debris, Soap-Bar Radii, Rainbow Pills,')));
    lines.push(gutter(c.dim('    Phrasen-Dreschmaschine, Typo-Monokultur, Muddy RGB Bleed, Dummy Assets, uvm.')));
  } else {
    lines.push(gutter(c.bold('  Gefundene AI-Slop Auffälligkeiten:')));
    for (const se of slopErrors) {
      lines.push(gutter(`   ${c.bgRed(' FATAL -35 ')} ${c.bold(se.code)}: ${se.message}`));
      if (se.nodeId) lines.push(gutter(`               ${c.dim('Ziel:')} ${c.cyan(se.nodeId)}`));
    }
    for (const sw of slopWarns) {
      lines.push(gutter(`   ${c.bgYellow(' WARN -18 ')} ${c.bold(sw.code)}: ${sw.message}`));
      if (sw.nodeId) lines.push(gutter(`               ${c.dim('Ziel:')} ${c.cyan(sw.nodeId)}`));
    }
  }

  // --------------------------------------------------------------------------
  // Section 3: Scorecard Matrix (8 Dimensions)
  // --------------------------------------------------------------------------
  lines.push(emptyGutter());
  lines.push(midBorder('📊 Scorecard Matrix (8 Dimensionen)'));
  lines.push(emptyGutter());

  const catEntries: Array<{ key: keyof typeof report.categories; weight: number }> = [
    { key: 'accessibility', weight: 20 },
    { key: 'print', weight: 10 },
    { key: 'typography', weight: 15 },
    { key: 'density', weight: 15 },
    { key: 'antiSlop', weight: 20 },
    { key: 'color', weight: 5 },
    { key: 'geometry', weight: 5 },
    { key: 'hygiene', weight: 10 }
  ];

  const colCat = 'Kategorie'.padEnd(36);
  const colPkt = 'Pkt'.padStart(5) + ' ';
  const colBar = 'Balken'.padEnd(16);
  const colGew = 'Gewicht'.padStart(7) + ' ';
  const colNot = 'Note'.padEnd(7);
  const colSta = 'Status';
  lines.push(gutter(c.dim(`   ${colCat} ${colPkt} ${colBar} ${colGew} ${colNot} ${colSta}`)));
  lines.push(gutter(c.dim(`   ${'─'.repeat(74)}`)));

  for (const entry of catEntries) {
    const cat = report.categories[entry.key];
    if (!cat) continue;

    const nameStr = cat.name.padEnd(36);
    const scoreStr = (String(cat.score) + '%').padStart(5) + ' ';
    const barStr = makeBar(cat.score, 14) + ' ';
    const weightStr = `${entry.weight}%`.padStart(7) + ' ';
    const gradeStr = `[${cat.grade}]`.padEnd(7);
    const issues = cat.errors > 0 ? c.red(`${cat.errors} Err`) : (cat.warnings > 0 ? c.yellow(`${cat.warnings} Warn`) : c.green('✔ Sauber'));

    lines.push(gutter(`   ${nameStr} ${c.bold(scoreStr)} ${barStr} ${weightStr} ${gradeStr} ${issues}`));
  }

  lines.push(gutter(c.dim(`   ${'─'.repeat(74)}`)));
  const totName = '★ GESAMT-BEWERTUNG'.padEnd(36);
  const totScore = (String(report.overallScore) + '%').padStart(5) + ' ';
  const totBar = makeBar(report.overallScore, 14) + ' ';
  const totWeight = '100%'.padStart(7) + ' ';
  const totGrade = `[${report.overallGrade}]`.padEnd(7);
  const totStatus = report.overallScore >= 90 ? c.green('Bestanden') : c.yellow('Prüfen');

  lines.push(gutter(c.bold(`   ${totName} ${totScore} ${totBar} ${totWeight} ${totGrade} ${totStatus}`)));

  // --------------------------------------------------------------------------
  // Section 4: Detailed Findings with Code & Quick-Fix (Optional / Interactive)
  // --------------------------------------------------------------------------
  const activeIssues = report.findings.filter(f => f.severity !== 'pass');

  if (options?.showFixes !== false) {
    lines.push(formatWarningsSection(report));
    lines.push(formatFixesSection(report));
  } else if (activeIssues.length > 0) {
    lines.push(emptyGutter());
    lines.push(midBorder('💡 Handlungsempfehlungen & Quick-Fixes'));
    lines.push(emptyGutter());
    lines.push(gutter(`   ${c.yellow(c.bold(`[ ${activeIssues.length} Befunde & Quick-Fixes verfügbar ]`))}`));
    lines.push(gutter(c.dim('   Drücke [Enter], um die Begründungen (< 100%) anzuzeigen, oder [F] zum Kopieren.')));
  }

  lines.push(emptyGutter());
  lines.push(bottomBorder());
  lines.push('');
  return lines.join('\n');
}
