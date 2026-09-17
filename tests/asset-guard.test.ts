import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SCRIPT = join(ROOT, 'scripts', 'check-local-assets.py');

// Scratch surface lives inside the scanned tree on purpose: the guard only
// walks files under the repository root, so a fixture outside it would never
// be visited and the test would prove nothing.
const FIXTURE_DIR = join(ROOT, 'legal');
const FIXTURE = join(FIXTURE_DIR, '__asset_guard_fixture.html');

function runGuard(): { code: number; out: string } {
  const proc = Bun.spawnSync(['python3', SCRIPT], { cwd: ROOT });
  return {
    code: proc.exitCode ?? 1,
    out: `${proc.stdout.toString()}${proc.stderr.toString()}`,
  };
}

function writeFixture(body: string): void {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(FIXTURE, body, 'utf8');
}

afterEach(() => {
  rmSync(FIXTURE, { force: true });
});

describe('check-local-assets guard', () => {
  test('the committed tree passes the guard', () => {
    const { code, out } = runGuard();
    expect(out).toContain('Asset guard OK');
    expect(code).toBe(0);
  });

  test('root-absolute refs resolve against the site root, not the file directory', () => {
    // Regression: legal/*.html and 404.html link /assets/styles.css and
    // /fonts/*.woff2. Resolving those against the referencing file's parent
    // produced filesystem paths outside the repo and failed CI even though
    // every file exists. A nested page must be able to link them.
    writeFixture(
      [
        '<!DOCTYPE html>',
        '<html lang="en"><head>',
        '<link rel="stylesheet" href="/assets/styles.css" />',
        '<link rel="preload" as="font" href="/fonts/geist.woff2" />',
        '</head><body></body></html>',
        '',
      ].join('\n'),
    );
    const { code, out } = runGuard();
    expect(out).toContain('Asset guard OK');
    expect(code).toBe(0);
  });

  test('a root-absolute ref to a file that does not exist still fails', () => {
    writeFixture(
      [
        '<!DOCTYPE html>',
        '<html lang="en"><head>',
        '<link rel="stylesheet" href="/assets/this-file-does-not-exist.css" />',
        '</head><body></body></html>',
        '',
      ].join('\n'),
    );
    const { code, out } = runGuard();
    expect(code).toBe(1);
    expect(out).toContain('assets/this-file-does-not-exist.css');
  });

  test('a relative ref to a file that does not exist still fails', () => {
    writeFixture(
      [
        '<!DOCTYPE html>',
        '<html lang="en"><head>',
        '<link rel="stylesheet" href="../assets/also-missing.css" />',
        '</head><body></body></html>',
        '',
      ].join('\n'),
    );
    const { code, out } = runGuard();
    expect(code).toBe(1);
    expect(out).toContain('also-missing.css');
  });
});
