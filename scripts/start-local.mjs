import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supabaseCommand = 'supabase';
const envFile = path.join(projectRoot, '.env.local');
const childProcesses = [];

function runSupabase(args, options = {}) {
  const result = spawnSync(supabaseCommand, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });

  if (result.error) {
    throw new Error(
      'Could not run the Supabase CLI. Install it and make sure "supabase" is available on PATH.',
      { cause: result.error },
    );
  }
  if (result.status !== 0) {
    throw new Error(`Supabase command failed: supabase ${args.join(' ')}`);
  }
  return result.stdout ?? '';
}

function verifySupabaseCli() {
  const result = spawnSync(supabaseCommand, ['--version'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'ignore',
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      'The Supabase CLI is required. Install it and make sure "supabase" is available on PATH.',
      { cause: result.error },
    );
  }
}

function parseEnvironment(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, key, rawValue]) => [key, rawValue.replace(/^(['"])(.*)\1$/, '$2')]),
  );
}

async function writeLocalEnvironment() {
  const values = parseEnvironment(runSupabase(['status', '--output', 'env'], { capture: true }));
  const url = values.API_URL ?? values.SUPABASE_URL;
  const publishableKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      'Could not read the local API URL and anon/publishable key from "supabase status --output env".',
    );
  }

  let existing = '';
  try {
    existing = await readFile(envFile, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const preservedLines = existing
    .split(/\r?\n/)
    .filter((line) => !/^\s*VITE_SUPABASE_(URL|PUBLISHABLE_KEY)\s*=/.test(line));
  while (preservedLines.at(-1) === '') preservedLines.pop();
  preservedLines.push(`VITE_SUPABASE_URL=${url}`);
  preservedLines.push(`VITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`);
  await writeFile(envFile, `${preservedLines.join('\n')}\n`, 'utf8');
}

function startService(label, command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  childProcesses.push(child);

  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ label, code, signal }));
  });
  return { child, exited, label };
}

function stopServices() {
  for (const child of childProcesses) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

async function main() {
  verifySupabaseCli();
  runSupabase(['start']);
  runSupabase(['migration', 'up', '--local']);

  await writeLocalEnvironment();
  console.log('\nStarting Edge Functions and the web app. Press Ctrl+C to stop.');

  const functions = startService('Supabase Edge Functions', supabaseCommand, [
    'functions',
    'serve',
  ]);
  const vite = startService('Vite', process.execPath, [
    'node_modules/vite/bin/vite.js',
    '--host',
    'localhost',
  ]);

  let stoppingBySignal = false;
  const handleSignal = () => {
    stoppingBySignal = true;
    stopServices();
  };
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  const result = await Promise.race([functions.exited, vite.exited]);
  stopServices();
  process.off('SIGINT', handleSignal);
  process.off('SIGTERM', handleSignal);

  if (!stoppingBySignal && result.code !== 0) {
    throw new Error(`${result.label} stopped unexpectedly (${result.signal ?? result.code}).`);
  }
}

main().catch((error) => {
  stopServices();
  console.error(`\nLocal startup failed: ${error.message}`);
  process.exitCode = 1;
});
