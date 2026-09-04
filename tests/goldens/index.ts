// tests/goldens/index.ts
// Golden Reference Metadata and Validation Helpers for toad E2E Workloads

export interface GoldenScenarioReference {
  name: string;
  fixturePath: string;
  canvas: {
    width: number;
    height: number;
    aspectRatio: string;
  };
  expectedPsd: {
    minLayers: number;
    expectedGroups: string[];
    expectedTextLayers: string[];
  };
  expectedElements: {
    minCount: number;
    hasGradients: boolean;
    hasFilters: boolean;
    hasRelationalPlacement: boolean;
  };
}

export const GOLDEN_WORKLOADS: Record<string, GoldenScenarioReference> = {
  social_card: {
    name: 'Social Media Card',
    fixturePath: 'tests/fixtures/social_card.toad',
    canvas: {
      width: 1200,
      height: 630,
      aspectRatio: '40:21'
    },
    expectedPsd: {
      minLayers: 6,
      expectedGroups: ['cardContainer', 'authorInfo'],
      expectedTextLayers: ['headline', 'description', 'authorName', 'authorHandle']
    },
    expectedElements: {
      minCount: 7,
      hasGradients: true,
      hasFilters: true,
      hasRelationalPlacement: true
    }
  },
  product_banner: {
    name: 'Product Showcase Banner',
    fixturePath: 'tests/fixtures/product_banner.toad',
    canvas: {
      width: 1920,
      height: 1080,
      aspectRatio: '16:9'
    },
    expectedPsd: {
      minLayers: 12,
      expectedGroups: ['headerGroup', 'productGrid'],
      expectedTextLayers: ['tagline', 'mainHeading']
    },
    expectedElements: {
      minCount: 15,
      hasGradients: false,
      hasFilters: true,
      hasRelationalPlacement: true
    }
  },
  hero_banner: {
    name: 'Hero Banner with Nested Components & Polygons',
    fixturePath: 'tests/fixtures/hero_banner.toad',
    canvas: {
      width: 1600,
      height: 900,
      aspectRatio: '16:9'
    },
    expectedPsd: {
      minLayers: 8,
      expectedGroups: ['heroContent', 'ctaGroup'],
      expectedTextLayers: ['heroTitle', 'heroBody']
    },
    expectedElements: {
      minCount: 8,
      hasGradients: true,
      hasFilters: false,
      hasRelationalPlacement: true
    }
  },
  typography_poster: {
    name: 'Typography Poster',
    fixturePath: 'tests/fixtures/typography_poster.toad',
    canvas: {
      width: 1080,
      height: 1350,
      aspectRatio: '4:5'
    },
    expectedPsd: {
      minLayers: 7,
      expectedGroups: ['typeComposition'],
      expectedTextLayers: ['kicker', 'giantNumber', 'mainWord', 'subTitle', 'bodyParagraph', 'metaDetails']
    },
    expectedElements: {
      minCount: 8,
      hasGradients: true,
      hasFilters: false,
      hasRelationalPlacement: true
    }
  },
  mobile_mockup: {
    name: 'Mobile UI Mockup',
    fixturePath: 'tests/fixtures/mobile_mockup.toad',
    canvas: {
      width: 430,
      height: 932,
      aspectRatio: '215:466'
    },
    expectedPsd: {
      minLayers: 10,
      expectedGroups: ['statusBar', 'navHeader', 'quickActions'],
      expectedTextLayers: ['timeText', 'batteryText', 'greeting', 'subGreeting']
    },
    expectedElements: {
      minCount: 12,
      hasGradients: false,
      hasFilters: false,
      hasRelationalPlacement: true
    }
  }
};
