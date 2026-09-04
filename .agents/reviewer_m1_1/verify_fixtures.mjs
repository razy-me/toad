import * as fs from 'fs';
import * as path from 'path';
import { parseTOAD } from '../../dist/parser/parser.js';
import { resolveImportsAndComponents } from '../../dist/parser/importResolver.js';
import { solveLayout } from '../../dist/parser/math.js';

const fixturesDir = path.resolve('tests/fixtures');
const files = fs.readdirSync(fixturesDir);

console.log('Testing all fixtures in', fixturesDir);

for (const file of files) {
  if (!file.endsWith('.TOAD') || file.startsWith('circular')) continue;
  const fullPath = path.join(fixturesDir, file);
  console.log(`\n=== Processing: ${file} ===`);
  const content = fs.readFileSync(fullPath, 'utf8');
  const doc = parseTOAD(content, fullPath);
  console.log(`  Parsed: ${doc.elements.length} elements, ${doc.components.length} components, ${doc.directives.length} directives, ${doc.variables.length} variables`);
  if (doc.diagnostics && doc.diagnostics.length > 0) {
    console.log(`  Diagnostics:`, doc.diagnostics);
  }
  const resolved = await resolveImportsAndComponents(doc, fullPath);
  console.log(`  Resolved: canvas=${resolved.canvas.width}x${resolved.canvas.height}, elements=${resolved.elements.length}, fonts=${resolved.fonts.length}`);
  const layout = await solveLayout(resolved);
  console.log(`  Layout: nodes=${layout.nodes.length}, canvas=${layout.canvas.width}x${layout.canvas.height} (${layout.canvas.aspectRatio}), warnings=${layout.warnings.length}`);
  if (layout.warnings.length > 0) {
    console.log(`  Warnings:`, layout.warnings);
  }
}

console.log('\nAll fixtures parsed, resolved, and laid out successfully!');
