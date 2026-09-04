import * as fs from 'node:fs';
import * as path from 'node:path';

const defaultMainToad = `canvas {
  size: 800px 600px;
  background: #f8fafc;
}

group {
  at: center;
  
  rect {
    size: 240px 240px;
    fill: #ffffff;
    radius: 24px;
    shadow: 0px 10px 30px rgba(0, 0, 0, 0.1);
  }

  icon {
    iconName: 'check';
    size: 80px 80px;
    at: center;
    stroke: #10b981 4px;
    fill: transparent;
  }

  text {
    text: "toad is ready!";
    font-size: 24px;
    font-family: "Inter";
    font-weight: 700;
    fill: #0f172a;
    at: center;
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
  
  console.log(`\x1b[32mSUCCESS!\x1b[0m Scaffolded new toad project in \x1b[1m${projectName}\x1b[0m`);
  console.log(`\nTo get started:\n`);
  console.log(`  cd ${projectName}`);
  console.log(`  toad main.toad --watch\n`);
}
