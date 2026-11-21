/** @jest-environment node */
import { expect, test } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dockerfile = await fs.readFile(path.join(root, 'Dockerfile'), 'utf8');
const baseStage = dockerfile.split(' AS base-runtime')[1].split('\nFROM ')[0];

test('production installs a pinned websockify with target verification', () => {
  expect(dockerfile).toMatch(/^FROM base-runtime AS prod\s*$/m);
  const installs = baseStage.match(/\/opt\/venv\/bin\/pip install[^\n]*/g) || [];
  expect(installs).toHaveLength(1);
  const pins = [...installs[0].matchAll(/(?:^|\s)websockify==(\d+)\.(\d+)\.(\d+)(?=\s|$)/g)];
  expect(pins).toHaveLength(1);
  const [major, minor] = pins[0].slice(1).map(Number);
  expect(major > 0 || minor >= 13).toBe(true);
});

test('production base installs a system CA bundle', () => {
  const installs = baseStage.match(/apt-get install\b[\s\S]*?(?=&&)/g) || [];
  expect(installs.some((command) => /\bca-certificates\b/.test(command))).toBe(true);
});

test('production entrypoint enables TLS for the configured Mumble target', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'websockify-entrypoint-'));
  try {
    await fs.writeFile(path.join(tempDir, 'websockify'), '#!/bin/sh\nprintf "ARG:%s\\n" "$@"\n', { mode: 0o755 });
    const env = {
      ...process.env,
      PATH: `${tempDir}${path.delimiter}${process.env.PATH}`,
      HOST: '127.0.0.1',
      PORT: '8081',
      MUMBLE_SERVER: 'murmur:64738',
      MUMBLE_PASSWORD: 'test-password',
      SKIP_AUTH_SERVER: '1',
    };
    delete env.SKIP_TUNNEL;

    const output = execFileSync('bash', [path.join(root, 'docker-entrypoint.sh')], { env, encoding: 'utf8' });
    const argumentsPassed = output.split('\n')
      .filter((line) => line.startsWith('ARG:'))
      .map((line) => line.slice(4));
    const expected = [`--web=${path.join(root, 'dist')}`, '127.0.0.1:8081', 'murmur:64738'];
    expected.unshift('--ssl-target');
    expect(argumentsPassed).toEqual(expected);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
