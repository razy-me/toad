/**
 * src/motion/motionSolver.ts
 * Temporal evaluator and frame renderer for TOAD Motion.
 * Computes node transformations at time t and renders high-fidelity frames.
 */

import { createCanvas, Canvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import { MotionDocumentNode, MotionTimelineNode, KeyframeNode, KeyframeProperties } from './ast.js';
import { MotionScene, MotionSceneElement } from './sceneLoader.js';
import { lerp, lerpColor, resolveEasing } from './interpolator.js';
import { ParametricPath } from './pathSampler.js';

export interface ElementMotionState {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotateDeg: number;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeStart?: number;
  strokeEnd?: number;
  strokeOffset?: number;
  trimMode?: 'parallel' | 'sequential';
}

export class MotionSolver {
  private doc: MotionDocumentNode;
  private scene: MotionScene;
  private pathSamplers = new Map<string, ParametricPath>();

  constructor(doc: MotionDocumentNode, scene: MotionScene) {
    this.doc = doc;
    this.scene = scene;
  }

  private getPathSampler(targetId: string): ParametricPath | undefined {
    const cleanId = targetId.startsWith('#') ? targetId : '#' + targetId;
    if (this.pathSamplers.has(cleanId)) {
      return this.pathSamplers.get(cleanId);
    }

    const segments = this.scene.getBorderSegments(cleanId);
    if (segments.length === 0) return undefined;

    const sampler = new ParametricPath(segments);
    this.pathSamplers.set(cleanId, sampler);
    return sampler;
  }

  /**
   * Computes the interpolated state of a scene element at time t (in seconds).
   */
  public evaluateElement(
    element: MotionSceneElement,
    time: number,
    visited = new Set<string>()
  ): ElementMotionState {
    const state: ElementMotionState = {
      x: element.box.x,
      y: element.box.y,
      scaleX: 1,
      scaleY: 1,
      rotateDeg: 0,
      opacity: element.style.opacity ?? 1
    };

    if (visited.has(element.id)) {
      return state;
    }
    visited.add(element.id);

    const timeline = this.doc.motion.timelines.find(
      tl => tl.targetId === element.id || tl.targetId === element.id.replace(/^#/, '')
    );

    if (timeline && timeline.keyframes.length > 0) {
      const kfs = timeline.keyframes;

      let k1: KeyframeNode;
      let k2: KeyframeNode;
      let alpha = 0;

      if (time <= kfs[0]!.time) {
        k1 = kfs[0]!;
        k2 = kfs[0]!;
        alpha = 0;
      } else if (time >= kfs[kfs.length - 1]!.time) {
        k1 = kfs[kfs.length - 1]!;
        k2 = kfs[kfs.length - 1]!;
        alpha = 1;
      } else {
        let idx = 0;
        for (let i = 0; i < kfs.length - 1; i++) {
          if (time >= kfs[i]!.time && time <= kfs[i + 1]!.time) {
            idx = i;
            break;
          }
        }
        k1 = kfs[idx]!;
        k2 = kfs[idx + 1]!;
        const span = k2.time - k1.time;
        alpha = span > 1e-6 ? (time - k1.time) / span : 0;
      }

      // Apply easing
      const easer = resolveEasing(k2.properties.ease);
      const easedAlpha = easer(alpha);

      // 1. Opacity
      const op1 = k1.properties.opacity ?? state.opacity;
      const op2 = k2.properties.opacity ?? op1;
      state.opacity = lerp(op1, op2, easedAlpha);

      // 2. Translation
      const tx1 = k1.properties.translateX ?? 0;
      const tx2 = k2.properties.translateX ?? tx1;
      const ty1 = k1.properties.translateY ?? 0;
      const ty2 = k2.properties.translateY ?? ty1;
      state.x += lerp(tx1, tx2, easedAlpha);
      state.y += lerp(ty1, ty2, easedAlpha);

      // 3. Scaling
      const sx1 = k1.properties.scaleX ?? 1;
      const sx2 = k2.properties.scaleX ?? sx1;
      const sy1 = k1.properties.scaleY ?? 1;
      const sy2 = k2.properties.scaleY ?? sy1;
      state.scaleX = lerp(sx1, sx2, easedAlpha);
      state.scaleY = lerp(sy1, sy2, easedAlpha);

      // 4. Rotation
      const r1 = k1.properties.rotate ?? 0;
      const r2 = k2.properties.rotate ?? r1;
      state.rotateDeg = lerp(r1, r2, easedAlpha);

      // 5. Stroke trim / draw animation
      const ss1 = k1.properties.strokeStart;
      const ss2 = k2.properties.strokeStart ?? ss1;
      if (ss1 !== undefined || ss2 !== undefined) {
        state.strokeStart = lerp(ss1 ?? 0, ss2 ?? (ss1 ?? 0), easedAlpha);
      }

      const se1 = k1.properties.strokeEnd;
      const se2 = k2.properties.strokeEnd ?? se1;
      if (se1 !== undefined || se2 !== undefined) {
        state.strokeEnd = lerp(se1 ?? 1, se2 ?? (se1 ?? 1), easedAlpha);
      }

      const so1 = k1.properties.strokeOffset;
      const so2 = k2.properties.strokeOffset ?? so1;
      if (so1 !== undefined || so2 !== undefined) {
        state.strokeOffset = lerp(so1 ?? 0, so2 ?? (so1 ?? 0), easedAlpha);
      }

      if (k2.properties.trimMode || k1.properties.trimMode) {
        state.trimMode = k2.properties.trimMode ?? k1.properties.trimMode;
      }

      if (k1.properties.stroke || k2.properties.stroke) {
        const c1 = k1.properties.stroke ?? k2.properties.stroke!;
        const c2 = k2.properties.stroke ?? k1.properties.stroke!;
        state.stroke = lerpColor(c1, c2, easedAlpha);
      }
      if (k1.properties.strokeWidth !== undefined || k2.properties.strokeWidth !== undefined) {
        const sw1 = k1.properties.strokeWidth ?? 1;
        const sw2 = k2.properties.strokeWidth ?? sw1;
        state.strokeWidth = lerp(sw1, sw2, easedAlpha);
      }
      if (k1.properties.fill || k2.properties.fill) {
        const f1 = k1.properties.fill ?? k2.properties.fill!;
        const f2 = k2.properties.fill ?? k1.properties.fill!;
        state.fill = lerpColor(f1, f2, easedAlpha);
      }

      // 6. Motion along path / border
      const alongDef = k2.properties.along ?? k1.properties.along;
      if (alongDef && alongDef.targetId) {
        const p1 = k1.properties.along?.progress ?? 0;
        const p2 = k2.properties.along?.progress ?? (k1.properties.along ? 1 : 0);
        const progress = lerp(p1, p2, easedAlpha);

        const off1 = k1.properties.along?.offset ?? 0;
        const off2 = k2.properties.along?.offset ?? off1;
        const offset = lerp(off1, off2, easedAlpha);

        const sampler = this.getPathSampler(alongDef.targetId);
        if (sampler) {
          const sampled = sampler.sample(progress, offset);
          // Position at the sampled point, centering the element and preserving any keyframe translation deltas
          const txDelta = lerp(tx1, tx2, easedAlpha);
          const tyDelta = lerp(ty1, ty2, easedAlpha);
          state.x = sampled.x - element.box.width / 2 + txDelta;
          state.y = sampled.y - element.box.height / 2 + tyDelta;

          if (alongDef.autoRotate) {
            state.rotateDeg += sampled.angleDeg;
          }
        }
      }
    }

    // 7. Inherit parent container transform and opacity
    const parentId = element.layoutNode?.parentId || (element.layoutNode as any)?.parent;
    if (parentId) {
      const parentEl = this.scene.getElement(parentId);
      if (parentEl && parentEl !== element) {
        const parentState = this.evaluateElement(parentEl, time, visited);
        state.opacity *= parentState.opacity;
        const pDeltaX = parentState.x - parentEl.box.x;
        const pDeltaY = parentState.y - parentEl.box.y;
        state.x += pDeltaX;
        state.y += pDeltaY;
        state.scaleX *= parentState.scaleX;
        state.scaleY *= parentState.scaleY;
        state.rotateDeg += parentState.rotateDeg;
      }
    }

    return state;
  }

  /**
   * Renders a single frame at time t onto a Canvas.
   */
  public renderFrame(time: number): Canvas {
    const width = this.doc.motion.width ?? this.scene.width ?? 1920;
    const height = this.doc.motion.height ?? this.scene.height ?? 1080;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background fill
    const bg = this.doc.motion.background ?? this.scene.background ?? '#000000';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Render all elements in scene z-order
    for (const id of this.scene.order) {
      const element = this.scene.elements.get(id);
      if (!element) continue;

      const state = this.evaluateElement(element, time);
      if (state.opacity <= 0.001) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, state.opacity));

      const cx = state.x + element.box.width / 2;
      const cy = state.y + element.box.height / 2;

      // Transform matrix centered on element
      ctx.translate(cx, cy);
      if (state.rotateDeg !== 0) {
        ctx.rotate((state.rotateDeg * Math.PI) / 180);
      }
      if (state.scaleX !== 1 || state.scaleY !== 1) {
        ctx.scale(state.scaleX, state.scaleY);
      }
      ctx.translate(-element.box.width / 2, -element.box.height / 2);

      // Draw element
      element.render(ctx, 1.0, state);

      ctx.restore();
    }

    return canvas;
  }
}
