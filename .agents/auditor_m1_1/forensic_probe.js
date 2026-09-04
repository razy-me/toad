import { parseTOAD } from '../../dist/parser/parser.js';
import { resolveImportsAndComponents } from '../../dist/parser/importResolver.js';
import { solveLayout, layoutText, computeGcd, computeAspectRatio } from '../../dist/parser/math.js';
import { DependencyGraph, CyclicDependencyError } from '../../dist/parser/dependencyGraph.js';

async function runForensics() {
  console.log('--- Phase 1: Mathematical Logic Verification ---');
  const gcd1 = computeGcd(1920, 1080);
  const ar1 = computeAspectRatio(1920, 1080);
  console.log(`computeGcd(1920, 1080) = ${gcd1} (Expected 120)`);
  console.log(`computeAspectRatio(1920, 1080) = ${ar1.ratioString} (Expected 16:9)`);

  const gcd2 = computeGcd(1200, 630);
  const ar2 = computeAspectRatio(1200, 630);
  console.log(`computeGcd(1200, 630) = ${gcd2} (Expected 30)`);
  console.log(`computeAspectRatio(1200, 630) = ${ar2.ratioString} (Expected 40:21)`);

  console.log('\n--- Phase 2: Component Expansion & Scoped Variable Substitution ---');
  const src1 = `
    $basePadding = 25px;
    $brandColor = #9333ea;
    
    component Card(title = "Default Title", width = 300px, color = $brandColor) {
      group {
        rect #bg {
          size: $width 150px;
          fill: $color;
        }
        text $title #label {
          at: 10px 10px;
          fill: currentColor;
        }
      }
    }

    Card(title: "Custom Card 1", width: 450px) #c1 {
      at: 50px 50px;
    }
  `;
  const doc1 = parseTOAD(src1);
  const resolved1 = await resolveImportsAndComponents(doc1, 'test.TOAD');
  const layout1 = await solveLayout(resolved1);

  console.log('Layout 1 node count:', layout1.nodes.length);
  const c1Group = layout1.nodes[0];
  console.log('c1 type:', c1Group.type, 'box:', JSON.stringify(c1Group.box));
  const c1Bg = c1Group.children?.find(c => c.id?.includes('bg'));
  console.log('c1 bg width:', c1Bg?.width, 'fill:', c1Bg?.style.fill);

  console.log('\n--- Phase 3: Relational Positioning & Relational DAG ---');
  const src3 = `
    canvas { size: 1000px 1000px; }
    rect #anchor { at: 100px 100px; size: 200px 300px; }
    rect #rightElem { at: right of #anchor offset 15px; size: 50px 50px; }
    rect #belowElem { at: below #anchor offset 20px; size: 50px 50px; }
    rect #centerElem { at: center of #anchor; size: 40px 40px; }
  `;
  const doc3 = parseTOAD(src3);
  const resolved3 = await resolveImportsAndComponents(doc3, 'test.TOAD');
  const layout3 = await solveLayout(resolved3);
  const rElem = layout3.nodes.find(n => n.id === 'rightElem');
  const bElem = layout3.nodes.find(n => n.id === 'belowElem');
  const cElem = layout3.nodes.find(n => n.id === 'centerElem');

  console.log(`rightElem at (${rElem?.x}, ${rElem?.y}) [Expected (315, 100)]`);
  console.log(`belowElem at (${bElem?.x}, ${bElem?.y}) [Expected (100, 420)]`);
  console.log(`centerElem at (${cElem?.x}, ${cElem?.y}) [Expected (180, 230)]`);

  console.log('\n--- Phase 4: Cyclic Dependency Detection (3-Node Cycle) ---');
  const src2 = `
    rect #nodeA { at: right of #nodeB; size: 100px 50px; }
    rect #nodeB { at: below #nodeC; size: 100px 50px; }
    rect #nodeC { at: left of #nodeA; size: 100px 50px; }
  `;
  const doc2 = parseTOAD(src2);
  const resolved2 = await resolveImportsAndComponents(doc2, 'test.TOAD');
  try {
    await solveLayout(resolved2);
    console.error('FAIL: Expected cycle error not thrown');
  } catch (err) {
    console.log('Cycle Error Caught Successfully:', err.message);
  }

  console.log('\n--- Phase 5: Skia Headless Text Layout & Word Wrap ---');
  const t1 = layoutText('Single Line Text', { fontSize: 20, fontFamily: 'sans-serif' });
  console.log('Unwrapped text lines:', t1.lines.length, 'width:', t1.width, 'height:', t1.height);

  const t2 = layoutText('The quick brown fox jumps over the lazy dog and runs across the open meadow', {
    fontSize: 16,
    fontFamily: 'sans-serif',
    explicitWidth: 140
  });
  console.log('Wrapped text lines count:', t2.lines.length, 'lines:', JSON.stringify(t2.lines));

  console.log('\n--- Forensic Verification Probe Completed ---');
}

runForensics().catch(err => {
  console.error('Forensic probe error:', err);
  process.exit(1);
});
