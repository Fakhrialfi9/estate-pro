#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';

const npmCommand = isWindows ? 'npm.cmd' : 'npm';

const steps = [
  {
    name: 'Clean dist/node_modules/generated',
    command: 'rm',
    args: ['-rf', 'dist', 'node_modules', 'prisma/generated'],
  },

  {
    name: 'Clean install',
    command: npmCommand,
    args: ['ci'],
  },

  {
    name: 'Prisma validate',
    command: 'npx',
    args: ['prisma', 'validate'],
  },

  {
    name: 'Prisma generate',
    command: npmCommand,
    args: ['run', 'prisma:generate'],
  },

  {
    name: 'Prisma migration status',
    command: 'npx',
    args: ['prisma', 'migrate', 'status'],
  },

  {
    name: 'Prisma migration deploy',
    command: 'npx',
    args: ['prisma', 'migrate', 'deploy'],
  },

  {
    name: 'Prisma seed',
    command: npmCommand,
    args: ['run', 'prisma:seed'],
  },

  {
    name: 'Prisma status',
    command: npmCommand,
    args: ['run', 'prisma:status'],
  },

  {
    name: 'Production dependency check',
    command: npmCommand,
    args: ['run', 'check:fix'],
  },

  {
    name: 'Lint',
    command: npmCommand,
    args: ['run', 'lint'],
  },

  {
    name: 'TypeScript typecheck',
    command: npmCommand,
    args: ['run', 'typecheck'],
  },

  {
    name: 'Format check',
    command: npmCommand,
    args: ['run', 'format:check'],
  },

  {
    name: 'Build',
    command: npmCommand,
    args: ['run', 'build'],
  },

  {
    name: 'Architecture',
    command: npmCommand,
    args: ['run', 'check:architecture'],
  },

  {
    name: 'Complete test suite',
    command: npmCommand,
    args: ['run', 'test'],
  },

  {
    name: 'Unit tests',
    command: npmCommand,
    args: ['run', 'test:unit'],
  },

  {
    name: 'Integration tests',
    command: npmCommand,
    args: ['run', 'test:integration'],
  },

  {
    name: 'E2E tests',
    command: npmCommand,
    args: ['run', 'test:e2e'],
  },

  {
    name: 'OpenAPI tests',
    command: npmCommand,
    args: ['run', 'test:openapi'],
  },

  {
    name: 'OpenAPI validation',
    command: npmCommand,
    args: ['run', 'openapi:validate'],
  },

  {
    name: 'Security tests',
    command: npmCommand,
    args: ['run', 'test:security'],
  },

  {
    name: 'Security baseline',
    command: npmCommand,
    args: ['run', 'test:security:baseline'],
  },

  {
    name: 'Coverage',
    command: npmCommand,
    args: ['run', 'test:coverage'],
  },

  {
    name: 'E2E coverage',
    command: npmCommand,
    args: ['run', 'test:coverage:e2e'],
  },

  {
    name: 'Runtime health',
    command: npmCommand,
    args: ['run', 'check:health'],
  },

  {
    name: 'Fresh install check',
    command: npmCommand,
    args: ['run', 'check:fresh'],
  },

  {
    name: 'Final aggregate tests',
    command: npmCommand,
    args: ['run', 'test:all'],
  },
];

function formatDuration(ms) {
  const seconds = ms / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${minutes}m ${remainder.toFixed(2)}s`;
}

function runStep(step, index) {
  const total = steps.length;

  console.log('');
  console.log('='.repeat(80));
  console.log(`[${index + 1}/${total}] ${step.name}`);
  console.log(`$ ${step.command} ${step.args.join(' ')}`);
  console.log('='.repeat(80));

  const startedAt = Date.now();

  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  const duration = formatDuration(Date.now() - startedAt);

  if (result.error) {
    console.error('');
    console.error(`FAILED: ${step.name}`);
    console.error(`Error: ${result.error.message}`);
    console.error(`Duration: ${duration}`);
    return false;
  }

  if (result.status !== 0) {
    console.error('');
    console.error(`FAILED: ${step.name}`);
    console.error(`Exit code: ${result.status}`);
    console.error(`Duration: ${duration}`);
    return false;
  }

  console.log('');
  console.log(`PASSED: ${step.name} (${duration})`);

  return true;
}

console.log('');
console.log(
  '╔══════════════════════════════════════════════════════════════════════════════╗',
);
console.log(
  '║                     ESTATE PRO — FINAL VALIDATION                            ║',
);
console.log(
  '╚══════════════════════════════════════════════════════════════════════════════╝',
);

console.log('');
console.log(`Node : ${process.version}`);
console.log(`OS   : ${process.platform}`);
console.log(`Steps: ${steps.length}`);

const startedAt = Date.now();

for (let index = 0; index < steps.length; index += 1) {
  const passed = runStep(steps[index], index);

  if (!passed) {
    const duration = formatDuration(Date.now() - startedAt);

    console.error('');
    console.error(
      '╔══════════════════════════════════════════════════════════════════════════════╗',
    );
    console.error(
      '║                           VALIDATION FAILED                                 ║',
    );
    console.error(
      '╚══════════════════════════════════════════════════════════════════════════════╝',
    );
    console.error('');
    console.error(`Failed step : ${steps[index].name}`);
    console.error(`Duration    : ${duration}`);
    console.error('');

    process.exit(1);
  }
}

const duration = formatDuration(Date.now() - startedAt);

console.log('');
console.log(
  '╔══════════════════════════════════════════════════════════════════════════════╗',
);
console.log(
  '║                           VALIDATION PASSED                                  ║',
);
console.log(
  '╚══════════════════════════════════════════════════════════════════════════════╝',
);
console.log('');
console.log(`All ${steps.length} validation steps passed.`);
console.log(`Total duration: ${duration}`);
console.log('');
