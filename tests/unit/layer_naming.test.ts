import { describe, it, expect } from 'vitest';
import {
  humanizeIdentifier,
  sanitizeTextSnippet,
  formatTextLayerName,
  extractFilenameLabel,
  toSafeXmlId,
  resolveHumanLayerName
} from '../../src/utils/layerNaming.js';

describe('Human Layer Naming Engine', () => {
  describe('humanizeIdentifier', () => {
    it('converts camelCase and PascalCase to Title Case', () => {
      expect(humanizeIdentifier('heroCard')).toBe('Hero Card');
      expect(humanizeIdentifier('HeroCard')).toBe('Hero Card');
      expect(humanizeIdentifier('userProfilePic')).toBe('User Profile Pic');
    });

    it('converts snake_case and kebab-case to Title Case', () => {
      expect(humanizeIdentifier('hero_card_banner')).toBe('Hero Card Banner');
      expect(humanizeIdentifier('user-profile-pic')).toBe('User Profile Pic');
      expect(humanizeIdentifier('cta-button')).toBe('CTA Button');
    });

    it('handles numbers cleanly', () => {
      expect(humanizeIdentifier('card1')).toBe('Card 1');
      expect(humanizeIdentifier('bgHexagon2')).toBe('Bg Hexagon 2');
      expect(humanizeIdentifier('level3SubGroup')).toBe('Level 3 Sub Group');
    });

    it('strips compiler synthetic prefixes', () => {
      expect(humanizeIdentifier('__auto_42')).toBe('');
      expect(humanizeIdentifier('inst1_buttonBg')).toBe('Button Bg');
    });
  });

  describe('sanitizeTextSnippet & formatTextLayerName', () => {
    it('removes newlines, tabs, and excess whitespace', () => {
      const raw = '  Welcome\n\nback   to the\tPlatform  ';
      expect(sanitizeTextSnippet(raw, 50)).toBe('Welcome back to the Platform');
    });

    it('formats text layers according to user spec: "<TEXT> Text"', () => {
      expect(formatTextLayerName('Welcome Back')).toBe('Welcome Back Text');
      expect(formatTextLayerName('')).toBe('Text');
    });

    it('truncates cleanly at word boundaries with ellipsis', () => {
      const longText = 'Vector Precision Meets Raster Power in One Unified Engine';
      const snippet = sanitizeTextSnippet(longText, 30);
      expect(snippet.endsWith('...')).toBe(true);
      expect(snippet.length).toBeLessThanOrEqual(30);
      expect(formatTextLayerName(snippet)).toBe(`${snippet} Text`);
    });
  });

  describe('extractFilenameLabel', () => {
    it('extracts and humanizes local file paths', () => {
      expect(extractFilenameLabel('./assets/team_avatar_profile.png')).toBe('Team Avatar Profile');
      expect(extractFilenameLabel('../images/hero-sunset.jpg')).toBe('Hero Sunset');
    });

    it('handles URLs and query parameters', () => {
      expect(extractFilenameLabel('https://cdn.example.com/icons/search_icon.svg?v=2')).toBe('Search Icon');
    });

    it('returns Image for data URIs or empty strings', () => {
      expect(extractFilenameLabel('data:image/png;base64,iVBORw0KGgo=')).toBe('Image');
      expect(extractFilenameLabel('')).toBe('Image');
    });
  });

  describe('toSafeXmlId', () => {
    it('produces valid XML id slugs', () => {
      expect(toSafeXmlId('Hero Card Banner')).toBe('hero-card-banner');
      expect(toSafeXmlId('123 Numbers')).toBe('el-123-numbers');
    });
  });

  describe('resolveHumanLayerName', () => {
    it('preserves explicit user name strings with highest priority', () => {
      const node = { type: 'rect', id: 'heroCard', name: 'Custom Hero Background' };
      expect(resolveHumanLayerName(node)).toBe('Custom Hero Background');
    });

    it('resolves text elements to "<TEXT> Text"', () => {
      const node = {
        type: 'text',
        id: 'welcomeMsg',
        textLayout: { lines: ['Willkommen zurück', 'im Dashboard'] }
      };
      expect(resolveHumanLayerName(node)).toBe('Willkommen zurück im Dashboard Text');
    });

    it('resolves image elements with filename label', () => {
      const node = {
        type: 'image',
        id: '__auto_1',
        imageLayout: { src: './assets/company_logo.png' }
      };
      expect(resolveHumanLayerName(node)).toBe('Company Logo');
    });

    it('detects container background rect role', () => {
      const node = {
        type: 'rect',
        id: '__auto_2',
        fill: '#ffffff'
      };
      const context = {
        parentName: 'Card Container',
        parentType: 'group',
        siblingIndex: 0
      };
      expect(resolveHumanLayerName(node, context)).toBe('Card Container Background');
    });

    it('detects clipping masks', () => {
      const node = {
        type: 'rect',
        id: '__auto_3',
        style: { clip: true }
      };
      expect(resolveHumanLayerName(node)).toBe('Clipping Mask');
    });

    it('humanizes explicit IDs on shapes and stacks', () => {
      expect(resolveHumanLayerName({ type: 'stack', id: 'heroNavActions' }, { humanizeLayerNames: true })).toBe('Hero Nav Actions');
      expect(resolveHumanLayerName({ type: 'circle', id: 'avatarCircle' }, { humanizeLayerNames: true })).toBe('Avatar Circle');
    });

    it('never emits __auto_ IDs as layer names', () => {
      const node = { type: 'rect', id: '__auto_99' };
      expect(resolveHumanLayerName(node)).not.toContain('__auto_');
      expect(resolveHumanLayerName(node)).toBe('Rectangle');
    });
  });
});
