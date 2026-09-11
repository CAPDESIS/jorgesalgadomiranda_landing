import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('package scripts for a static Hostinger site', () => {
  const pkg = JSON.parse(read('package.json')) as {
    scripts?: Record<string, string>;
  };

  test('lint and build run the static validator, not a stub echo', () => {
    expect(pkg.scripts?.lint || '').toContain('validate-static-site.py');
    expect(pkg.scripts?.build || '').toContain('validate-static-site.py');
    expect(pkg.scripts?.build || '').not.toContain('no build step required');
  });

  test('test remains bun test', () => {
    expect(pkg.scripts?.test || '').toContain('bun test');
  });
});

describe('GitHub Actions Node 24', () => {
  const dir = join(ROOT, '.github/workflows');
  const files = readdirSync(dir).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));

  test('there is at least one workflow', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    test(`${file} forces JS actions onto Node 24`, () => {
      const src = read(join('.github/workflows', file));
      expect(src).toContain('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true');
    });
  }
});

describe('contact proxy and analytics contract', () => {
  test('example contact config is tracked; live php file is gitignored', () => {
    const ignore = read('.gitignore');
    expect(ignore).toContain('api/secrets.php');
    expect(read('api/secrets.example.php')).toContain('re_xxxxxxxx');
  });

  test('index.html posts to the same-origin contact proxy, not Web3Forms', () => {
    const index = read('index.html');
    expect(index).toContain('/api/contact.php');
    expect(index.toLowerCase().includes('web3forms')).toBe(false);
    expect(index.includes('YOUR_WEB3FORMS')).toBe(false);
    expect(index.includes('name="access_key"')).toBe(false);
  });

  test('static validator matches the Resend proxy, not Web3Forms', () => {
    const src = read('scripts/validate-static-site.py');
    expect(src).toContain('must not reference Web3Forms');
    expect(src.includes('must keep the Web3Forms placeholder')).toBe(false);
    expect(src).toContain('/api/contact.php');
    expect(src).toContain('legal/privacy.html');
    expect(src).toContain('assets/styles.css');
  });

  test('index does not invent a fourth analytics vendor beyond umami, cloudflare, posthog', () => {
    const index = read('index.html');
    expect(index.includes('googletagmanager')).toBe(false);
    expect(index.includes('gtag(')).toBe(false);
    expect(index.includes('plausible.io')).toBe(false);
    expect(index.includes('analytics.google.com')).toBe(false);
  });

  test('deploy exclude list keeps audits markdown off Hostinger', () => {
    const src = read('.github/workflows/deploy.yml');
    expect(src).toContain('**/audits/**');
  });
});
