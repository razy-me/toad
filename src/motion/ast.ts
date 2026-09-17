/**
 * src/motion/ast.ts
 * Authoritative TypeScript AST Node Definitions for the "toad motion" (.toadm) language.
 */

import { BaseNode, Position, SourceLocation } from '../parser/ast.js';

export type EasingType =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier'
  | 'spring';

export interface EasingDefinition {
  type: EasingType;
  bezierArgs?: [number, number, number, number];
  springArgs?: {
    stiffness?: number;
    damping?: number;
    mass?: number;
  };
}

export interface AlongPathDefinition {
  targetType: 'border' | 'path';
  targetId: string;
  progress: number; // 0.0 to 1.0
  offset?: number;  // px normal offset (+ is outward, - is inward)
  autoRotate?: boolean;
}

export interface KeyframeProperties {
  opacity?: number;
  translateX?: number;
  translateY?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number; // degrees
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  blur?: number;
  ease?: EasingDefinition;
  along?: AlongPathDefinition;
  [customProp: string]: any;
}

export interface KeyframeNode extends BaseNode {
  type: 'Keyframe';
  time: number; // in seconds
  properties: KeyframeProperties;
}

export interface StaggerDefinition {
  delay: number; // delay between each child in seconds
  from?: number;  // start time in seconds
  duration?: number;
  properties?: KeyframeProperties;
}

export interface MotionTimelineNode extends BaseNode {
  type: 'MotionTimeline';
  targetId: string; // e.g. "#heroBadge", "#ctaGroup > *"
  isChildrenSelector?: boolean; // e.g. "#ctaGroup > *"
  keyframes: KeyframeNode[];
  stagger?: StaggerDefinition;
}

export interface MotionImportNode extends BaseNode {
  type: 'MotionImport';
  path: string;
  alias: string;
}

export interface MotionDeclarationNode extends BaseNode {
  type: 'MotionDeclaration';
  name: string;
  scene?: string; // alias of imported scene (e.g. "hero")
  duration: number; // total duration in seconds
  fps: number; // frames per second (default 60)
  width?: number;
  height?: number;
  background?: string;
  timelines: MotionTimelineNode[];
}

export interface MotionDocumentNode extends BaseNode {
  type: 'MotionDocument';
  imports: MotionImportNode[];
  motion: MotionDeclarationNode;
}
