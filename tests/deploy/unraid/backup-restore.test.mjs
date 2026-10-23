import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const shellAvailable =
  process.platform !== 'win32' &&
  spawnSync('sh', ['-c', 'command -v jq >/dev/null && command -v tar >/dev/null']).status === 0;
const fixtureRoots = [];

function createFixture({ persistentData = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'game-night-recovery-'));
  fixtureRoots.push(root);

  const deployment = join(root, 'deploy', 'unraid');
  const scripts = join(deployment, 'scripts');
  const appdata = join(root, 'appdata');
  const mockBin = join(root, 'mock-bin');
  mkdirSync(scripts, { recursive: true });
  mkdirSync(mockBin);

  for (const filename of ['backup.sh', 'restore.sh']) {
    copyFileSync(
      join(repositoryRoot, 'deploy', 'unraid', 'scripts', filename),
      join(scripts, filename),
    );
  }
  writeFileSync(join(deployment, 'compose.yaml'), 'name: test\n');
  writeFileSync(join(deployment, 'supabase.override.yaml'), 'services: {}\n');
  writeFileSync(join(deployment, '.env'), `APPDATA_ROOT=${appdata}\n`);

  if (persistentData) {
    for (const name of ['postgres', 'storage', 'db-config']) {
      mkdirSync(join(appdata, name), { recursive: true });
    }
    writeFileSync(join(appdata, 'storage', 'previous.txt'), 'old storage');
    mkdirSync(join(deployment, 'upstream'));
  }

  writeFileSync(
    join(mockBin, 'docker'),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_DOCKER_LOG"
case "$*" in
  *"ps --services --status running"*) printf '%s' "\${MOCK_RUNNING_SERVICES:-}" ;;
  *"pg_isready"*) exit 0 ;;
  *"pg_restore"*) cat >/dev/null ;;
  *"pg_dump"*) printf 'test-database-dump' ;;
esac
`,
  );
  chmodSync(join(mockBin, 'docker'), 0o755);
  writeFileSync(
    join(mockBin, 'git'),
    `#!/bin/sh
printf '%s\\n' '8679b0b4d3b87e7b68e4ab91bc85f0d29c9e0110'
`,
  );
  chmodSync(join(mockBin, 'git'), 0o755);

  return { deployment, appdata, mockBin, root };
}

function runScript(fixture, script, args = [], extraEnv = {}) {
  const logFile = join(fixture.root, 'docker.log');
  return spawnSync('sh', [join(fixture.deployment, 'scripts', script), ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fixture.mockBin}${delimiter}${process.env.PATH}`,
      MOCK_DOCKER_LOG: logFile,
      ...extraEnv,
    },
  });
}

function createArchive(fixture, upstreamCommit = '8679b0b4d3b87e7b68e4ab91bc85f0d29c9e0110') {
  const contents = join(fixture.root, 'archive-contents');
  mkdirSync(join(contents, 'storage'), { recursive: true });
  mkdirSync(join(contents, 'db-config'), { recursive: true });
  mkdirSync(join(contents, 'configuration'));
  writeFileSync(
    join(contents, 'manifest.json'),
    JSON.stringify({
      format_version: 1,
      created_at: '2026-10-23T00:00:00Z',
      upstream_commit: upstreamCommit,
      contents: ['postgres.dump', 'storage', 'db-config', 'configuration'],
    }),
  );
  writeFileSync(join(contents, 'postgres.dump'), 'test-database-dump');
  writeFileSync(join(contents, 'storage', 'restored.txt'), 'restored storage');
  writeFileSync(join(contents, 'configuration', '.env'), 'APPDATA_ROOT=/appdata\n');

  const archive = join(fixture.root, 'backup.tar.gz');
  const result = spawnSync(
    'tar',
    [
      '-czf',
      archive,
      '-C',
      contents,
      'manifest.json',
      'postgres.dump',
      'storage',
      'db-config',
      'configuration',
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Unable to create test backup archive.');
  }
  return archive;
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe.skipIf(!shellAvailable)('Unraid backup and restore scripts', () => {
  it('fails with an actionable error when persistent backup paths are missing', () => {
    const fixture = createFixture();
    const result = runScript(fixture, 'backup.sh');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Required persistent data directory is missing');
  });

  it('rejects an invalid backup archive before attempting restore', () => {
    const fixture = createFixture();
    const archive = join(fixture.root, 'invalid.tar.gz');
    writeFileSync(archive, 'not a tar archive');
    const result = runScript(fixture, 'restore.sh', [archive]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Backup archive is unreadable or invalid');
  });

  it('refuses to restore while any Compose service is running', () => {
    const fixture = createFixture();
    const archive = createArchive(fixture);
    const result = runScript(fixture, 'restore.sh', [archive], {
      MOCK_RUNNING_SERVICES: 'db\n',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Stop the entire Compose project');
    expect(readFileSync(join(fixture.root, 'docker.log'), 'utf8')).not.toContain('up -d db');
  });

  it('rejects a backup from an incompatible Supabase revision before starting PostgreSQL', () => {
    const fixture = createFixture();
    const archive = createArchive(fixture, 'incompatible-revision');
    const result = runScript(fixture, 'restore.sh', [archive], { RESTORE_CONFIRM: 'YES' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Backup Supabase revision does not match');
    expect(existsSync(join(fixture.root, 'docker.log'))).toBe(false);
  });

  it('restores database and storage content and retains the previous storage directory', () => {
    const fixture = createFixture({ persistentData: true });
    const archive = createArchive(fixture);
    const result = runScript(fixture, 'restore.sh', [archive], { RESTORE_CONFIRM: 'YES' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Restore completed');
    expect(readFileSync(join(fixture.appdata, 'storage', 'restored.txt'), 'utf8')).toBe(
      'restored storage',
    );
    expect(readdirSync(fixture.appdata).some((name) => name.startsWith('storage.pre-restore-'))).toBe(
      true,
    );
    expect(readFileSync(join(fixture.root, 'docker.log'), 'utf8')).toContain('pg_restore');
    expect(readFileSync(join(fixture.root, 'docker.log'), 'utf8')).toContain('--schema storage');
    expect(readFileSync(join(fixture.root, 'docker.log'), 'utf8')).toContain('stop db');
  });

  it('creates a protected archive containing the database dump, storage, configuration, and manifest', () => {
    const fixture = createFixture({ persistentData: true });
    const result = runScript(fixture, 'backup.sh');

    expect(result.status).toBe(0);
    const archive = join(fixture.deployment, 'backups', readdirSync(join(fixture.deployment, 'backups'))[0]);
    expect(statSync(archive).mode & 0o777).toBe(0o600);
    const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });

    expect(listing.status).toBe(0);
    expect(listing.stdout).toContain('manifest.json');
    expect(listing.stdout).toContain('postgres.dump');
    expect(listing.stdout).toContain('storage/');
    expect(listing.stdout).toContain('db-config/');
    expect(listing.stdout).toContain('configuration/.env');
    expect(readFileSync(join(fixture.root, 'docker.log'), 'utf8')).toContain('--schema storage');
    expect(existsSync(join(fixture.deployment, 'upstream'))).toBe(true);
  });
});
