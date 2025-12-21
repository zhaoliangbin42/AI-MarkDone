import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const readText = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('test plan does not reference removed automation scripts', () => {
  const plan = readText('docs/test-plan/TP-001.md');

  assert.ok(!plan.includes('test:parser'), 'Remove test:parser from test plan');
  assert.ok(!plan.includes('test:prod'), 'Remove test:prod from test plan');
});
