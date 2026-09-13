import * as fs from 'node:fs';
import * as path from 'node:path';

const defaultMainToad = `// ============================================================================
// 🧬 TOAD MULTI-DNA INSPIRATION MATRIX (Min 3 Personas + Min 3 Corporate Systems)
// ----------------------------------------------------------------------------
// 🎭 CREATIVE PERSONAS (the_seed/09_CREATIVE_PERSONAS_AND_STYLES/):
//   1. dieter_rams -> Disciplined functional minimalism and purposeful geometry
//   2. massimo_vignelli -> Rigorous typographic hierarchy and structural clarity
//   3. jony_ive -> Precision craft, subtle edge definition, and restrained palette
// 🏢 CORPORATE DESIGN SYSTEMS (the_seed/10_CORPORATE_DESIGN_SYSTEMS/):
//   1. apple_human_interface -> Crisp contrast, system sans typography, harmonious tokens
//   2. stripe_press -> Balanced structural padding, refined elevated surface card
//   3. vercel_geist -> Monochromatic clarity, high-contrast dark text on clean light ground
// ============================================================================

canvas {
  size: 800px 600px;
  background: #f8fafc;
}

rect #card {
  at: center of canvas;
  size: 440px 240px;
  fill: #ffffff;
  radius: 12px;
  stroke: #e2e8f0 1px;
  shadow: 0px 10px 25px alpha(#0f172a, 0.06);

  icon #statusIcon {
    at: 36px 36px;
    iconName: "check";
    size: 40px 40px;
    stroke: #059669 3px;
    fill: transparent;
  }

  text #title {
    at: 96px 40px;
    content: "toad is ready!";
    font-size: 22px;
    font-family: "Inter, -apple-system, sans-serif";
    font-weight: 700;
    color: #0f172a;
    size: 300px;
  }

  text #subtitle {
    at: 96px 74px;
    content: "Declarative Visual Design System";
    font-size: 14px;
    font-family: "Inter, -apple-system, sans-serif";
    font-weight: 500;
    color: #475569;
    size: 300px;
  }
}
`;

function getPackageJson(name: string) {
  return JSON.stringify({
    name,
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'toad main.toad --watch',
      build: 'toad main.toad --format all'
    }
  }, null, 2) + '\n';
}

export function runInit(targetName?: string): void {
  const cwd = process.cwd();
  
  let projectName = targetName;
  if (!projectName) {
    let counter = 1;
    while (fs.existsSync(path.join(cwd, `toad-project-${counter}`))) {
      counter++;
    }
    projectName = `toad-project-${counter}`;
  }

  const projectDir = path.join(cwd, projectName);
  if (fs.existsSync(projectDir)) {
    // Throw instead of exiting so library consumers can handle the error;
    // the CLI wrapper catches and reports it with exit code 1.
    throw new Error(`Directory '${projectName}' already exists. Choose another name or remove the folder.`);
  }

  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'main.toad'), defaultMainToad.trim() + '\n', 'utf-8');
  fs.writeFileSync(path.join(projectDir, 'package.json'), getPackageJson(projectName), 'utf-8');
  
  const gitignorePath = path.join(projectDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, 'utf-8');
    if (!existing.includes('dist/')) {
      fs.appendFileSync(gitignorePath, '\n# toad output\ndist/\n.toad/\n', 'utf-8');
    }
  } else {
    fs.writeFileSync(gitignorePath, 'node_modules/\ndist/\n.toad/\n', 'utf-8');
  }
  
  console.log(`\x1b[32mSUCCESS!\x1b[0m Scaffolded new toad project in \x1b[1m${projectName}\x1b[0m`);
  console.log(`\nTo get started:\n`);
  console.log(`  cd ${projectName}`);
  console.log(`  toad main.toad --watch\n`);
}
