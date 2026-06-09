/**
 * Smoke Boot Test
 *
 * Starts the NestJS app on a non-default port (3105), waits for the
 * "Nest application successfully started" message, then kills the process.
 *
 * Usage:
 *   node scripts/smoke-boot.mjs
 *
 * Exit codes:
 *   0 = boot succeeded
 *   1 = timeout or error
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 3105;
const TIMEOUT_MS = 30_000;

async function main() {
  console.log(`[smoke] Starting app on port ${PORT}...`);

  const child = spawn('npm', ['run', 'start'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(text);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(text);
  });

  const bootPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout after ${TIMEOUT_MS}ms — app did not boot`));
    }, TIMEOUT_MS);

    const check = () => {
      if (stdout.includes('Nest application successfully started')) {
        clearTimeout(timeout);
        console.log('\n[smoke] Boot detected ✓');
        resolve();
      }
    };

    child.stdout.on('data', check);
    child.stderr.on('data', check);

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  try {
    await bootPromise;
    child.kill();
    await delay(500);
    process.exit(0);
  } catch (err) {
    console.error(`\n[smoke] FAILED: ${err.message}`);
    child.kill();
    await delay(500);
    process.exit(1);
  }
}

main();
