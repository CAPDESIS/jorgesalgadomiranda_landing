import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

function walkHtmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'coverage' || name === 'tmp') {
      continue;
    }
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      out.push(...walkHtmlFiles(path));
    } else if (name.endsWith('.html')) {
      out.push(path);
    }
  }
  return out;
}

describe('asset integrity (zyrosite regression guard)', () => {
  const htmlFiles = walkHtmlFiles(ROOT);
  const htmlBlob = htmlFiles.map((p) => readFileSync(p, 'utf8')).join('\n');

  test('no HTML file hotlinks assets.zyrosite.com', () => {
    const hits = htmlFiles.filter((p) => readFileSync(p, 'utf8').includes('assets.zyrosite.com'));
    expect(hits).toEqual([]);
  });

  test('CSP and preconnect do not allow assets.zyrosite.com', () => {
    const htaccess = readFileSync(join(ROOT, '.htaccess'), 'utf8');
    expect(htaccess.includes('assets.zyrosite.com')).toBe(false);
    expect(htmlBlob.includes('preconnect" href="https://assets.zyrosite.com')).toBe(false);
  });

  test('every local assets/ image|logo|brand ref in index.html exists on disk', () => {
    const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const refs = [...index.matchAll(/\b(?:src|href)="(assets\/[^"?#]+)"/g)].map((m) => m[1]);
    const unique = [...new Set(refs)];
    expect(unique.length).toBeGreaterThan(10);

    const missing = unique.filter((rel) => !existsSync(join(ROOT, rel)));
    expect(missing).toEqual([]);
  });

  test('critical self-hosted partners/skills/portrait files are present', () => {
    const required = [
      'assets/images/foto_perfil.png',
      'assets/brands/paypal.svg',
      'assets/brands/capdesis.webp',
      'assets/brands/tienda-unam.svg',
      'assets/brands/flexera.svg',
      'assets/brands/udemy.svg',
      'assets/brands/ios-lab-unam.svg',
      'assets/logos/flutter.svg',
      'assets/logos/swift.svg',
      'assets/logos/kotlin.svg',
      'assets/logos/jetpack-compose.svg',
      'assets/logos/go.svg',
      'assets/logos/aws.svg',
      'assets/logos/docker.svg',
      'assets/logos/kubernetes.svg',
      'assets/logos/postgresql.svg',
      'assets/logos/graphql.svg',
      'assets/logos/firebase.svg',
      'assets/logos/neovim.svg',
    ];
    const missing = required.filter((rel) => !existsSync(join(ROOT, rel)));
    expect(missing).toEqual([]);
  });
});
