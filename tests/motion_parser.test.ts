import { describe, it, expect } from 'vitest';
import { parseMotion } from '../src/motion/parser.js';

describe('TOAD Motion: Lexer & Parser (.toadm)', () => {
  it('parses imports, motion settings, and keyframes', () => {
    const toadmCode = `
      @import "./hero.toad" as hero;
      @import "./assets/card.psd" as card;

      motion "Hero Intro Reel" {
        scene: hero;
        duration: 4.5s;
        fps: 60;
        dimensions: 1920px 1080px;
        background: #020617;

        timeline {
          #heroBadge {
            0.0s: { opacity: 0; translateY: -20px; scale: 0.9; }
            0.6s: { opacity: 1; translateY: 0px; scale: 1.0; ease: spring(stiffness: 140, damping: 12); }
          }

          #glowOrb {
            0.0s: {
              along: border of #heroBadge;
              progress: 0%;
              offset: 4px;
            }
            2.0s: {
              along: border of #heroBadge;
              progress: 100%;
              offset: 4px;
              auto-rotate: true;
              ease: ease-in-out;
            }
          }
        }
      }
    `;

    const doc = parseMotion(toadmCode, 'test.toadm');

    expect(doc.type).toBe('MotionDocument');
    expect(doc.imports.length).toBe(2);
    expect(doc.imports[0]!.path).toBe('./hero.toad');
    expect(doc.imports[0]!.alias).toBe('hero');
    expect(doc.imports[1]!.path).toBe('./assets/card.psd');
    expect(doc.imports[1]!.alias).toBe('card');

    expect(doc.motion.name).toBe('Hero Intro Reel');
    expect(doc.motion.scene).toBe('hero');
    expect(doc.motion.duration).toBe(4.5);
    expect(doc.motion.fps).toBe(60);
    expect(doc.motion.width).toBe(1920);
    expect(doc.motion.height).toBe(1080);
    expect(doc.motion.background).toBe('#020617');

    expect(doc.motion.timelines.length).toBe(2);

    const badgeTl = doc.motion.timelines[0]!;
    expect(badgeTl.targetId).toBe('#heroBadge');
    expect(badgeTl.keyframes.length).toBe(2);
    expect(badgeTl.keyframes[0]!.time).toBe(0.0);
    expect(badgeTl.keyframes[0]!.properties.opacity).toBe(0);
    expect(badgeTl.keyframes[0]!.properties.translateY).toBe(-20);
    expect(badgeTl.keyframes[1]!.time).toBe(0.6);
    expect(badgeTl.keyframes[1]!.properties.opacity).toBe(1);
    expect(badgeTl.keyframes[1]!.properties.ease?.type).toBe('spring');
    expect(badgeTl.keyframes[1]!.properties.ease?.springArgs?.stiffness).toBe(140);

    const orbTl = doc.motion.timelines[1]!;
    expect(orbTl.targetId).toBe('#glowOrb');
    expect(orbTl.keyframes[0]!.properties.along?.targetType).toBe('border');
    expect(orbTl.keyframes[0]!.properties.along?.targetId).toBe('#heroBadge');
    expect(orbTl.keyframes[0]!.properties.along?.progress).toBe(0);
    expect(orbTl.keyframes[0]!.properties.along?.offset).toBe(4);

    expect(orbTl.keyframes[1]!.properties.along?.progress).toBe(1);
    expect(orbTl.keyframes[1]!.properties.along?.autoRotate).toBe(true);
  });
});
