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

  test('unified brand icon files exist with expected formats and dimensions', () => {
    const svg = readFileSync(join(ROOT, 'favicon.svg'), 'utf8');
    expect(svg).toContain('#0a0e1a');
    expect(svg).toContain('#00d4ff');
    expect(svg).toContain('>js<');

    const ico = readFileSync(join(ROOT, 'favicon.ico'));
    // ICO header: reserved=0, type=1, count>=2
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(2);

    const png32 = readFileSync(join(ROOT, 'assets/icons/favicon-32x32.png'));
    expect(png32.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png32.readUInt32BE(16)).toBe(32);
    expect(png32.readUInt32BE(20)).toBe(32);

    const apple = readFileSync(join(ROOT, 'apple-touch-icon.png'));
    expect(apple.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(apple.readUInt32BE(16)).toBe(180);
    expect(apple.readUInt32BE(20)).toBe(180);
    // Color type 2 = RGB (no alpha channel)
    expect(apple[25]).toBe(2);
  });

  test('all shipped HTML pages share unified root-relative js monogram icon links', () => {
    const pages = [
      'index.html',
      '404.html',
      'legal/privacy.html',
      'legal/terms.html',
      'legal/cookies.html',
      'cv/Jorge_Salgado_Miranda_CV_EN.html',
      'cv/Jorge_Salgado_Miranda_CV_ES.html',
    ];
    for (const rel of pages) {
      const html = readFileSync(join(ROOT, rel), 'utf8');
      expect(html).toContain('href="/favicon.svg"');
      expect(html).toContain('href="/favicon.ico"');
      expect(html).toContain('href="/assets/icons/favicon-32x32.png"');
      expect(html).toContain('href="/apple-touch-icon.png"');
      expect(html).not.toContain('data:image/svg+xml');
    }
  });
});
