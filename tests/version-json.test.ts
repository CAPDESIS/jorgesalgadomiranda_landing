import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SCRIPT = join(ROOT, 'scripts', 'write-version-json.py');
const VALID_SHA = '0fdf67039ca93f90038f5e6c941368a54b3b99dd';

let scratchDirs: string[] = [];
afterEach(() => {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  scratchDirs = [];
});

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jsm-version-json-'));
  scratchDirs.push(dir);
  return dir;
}

function runScript(args: string[]): { exitCode: number | null; stderr: string } {
  const proc = Bun.spawnSync(['python3', SCRIPT, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: proc.exitCode,
    stderr: proc.stderr.toString(),
  };
}

describe('write-version-json.py', () => {
  test('writes sha and built_at for a valid SHA', () => {
    const out = join(scratch(), 'version.json');
    const result = runScript(['--sha', VALID_SHA, '--out', out]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(out)).toBe(true);
    const payload = JSON.parse(readFileSync(out, 'utf8')) as Record<string, unknown>;
    expect(payload.sha).toBe(VALID_SHA);
    expect(typeof payload.built_at).toBe('string');
    expect(payload.built_at as string).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    const builtAt = Date.parse(payload.built_at as string);
    expect(Number.isNaN(builtAt)).toBe(false);
    expect(Math.abs(Date.now() - builtAt)).toBeLessThan(5 * 60 * 1000);
  });

  test('writes no sensitive fields', () => {
    const out = join(scratch(), 'version.json');
    const result = runScript(['--sha', VALID_SHA, '--out', out]);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(readFileSync(out, 'utf8')) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['built_at', 'sha']);
  });

  test('rejects a short SHA without writing', () => {
    const out = join(scratch(), 'version.json');
    const result = runScript(['--sha', 'abc123', '--out', out]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('40-char');
    expect(existsSync(out)).toBe(false);
  });

  test('rejects a non-hex SHA without writing', () => {
    const out = join(scratch(), 'version.json');
    const result = runScript(['--sha', 'z'.repeat(40), '--out', out]);
    expect(result.exitCode).not.toBe(0);
    expect(existsSync(out)).toBe(false);
  });
});

describe('version.json deploy contract', () => {
  const deployYml = readFileSync(join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
  const htaccess = readFileSync(join(ROOT, '.htaccess'), 'utf8');

  test('deploy writes version.json from the release SHA before upload', () => {
    expect(deployYml).toContain('scripts/write-version-json.py');
    expect(deployYml).toContain('--sha');
    expect(deployYml).toContain('steps.release.outputs.release_sha');
  });

  test('deploy fails when the served sha is not the release', () => {
    expect(deployYml).toContain('/version.json');
    expect(deployYml).toContain('steps.release.outputs.release_sha');
  });

  test('version.json is never committed by hand', () => {
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(ignore).toContain('version.json');
    expect(existsSync(join(ROOT, 'version.json'))).toBe(false);
  });

  test('version.json is served without cache', () => {
    expect(htaccess).toContain('version.json');
    expect(htaccess).toContain('no-cache');
  });
});
