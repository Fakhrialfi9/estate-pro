import { spawnSync } from 'node:child_process';

function prismaCliCommand(): { command: string; prefix: string[] } {
  if (process.platform === 'win32') {
    return { command: 'npx.cmd', prefix: ['--no-install', 'prisma'] };
  }

  return { command: 'npx', prefix: ['--no-install', 'prisma'] };
}

export function assertDatabaseSchemaMatchesMigrations(): void {
  const { command, prefix } = prismaCliCommand();
  const result = spawnSync(
    command,
    [
      ...prefix,
      'migrate',
      'diff',
      '--exit-code',
      '--from-migrations',
      './prisma/migrations',
      '--to-config-datasource',
    ],
    {
      encoding: 'utf8',
      env: process.env,
    },
  );

  if (result.error) {
    throw new Error(`Unable to verify database schema before seeding: ${result.error.message}`);
  }

  if (result.status === 0) return;

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

  if (result.status === 2) {
    throw new Error(
      [
        'Database schema does not match the committed Prisma migration history.',
        'Run `npx prisma migrate reset` for the local development database, then rerun the seed.',
        output,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  throw new Error(`Database schema verification failed before seeding.${output ? `\n${output}` : ''}`);
}
