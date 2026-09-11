import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '../assets/i18n.js';

const ROOT = join(import.meta.dir, '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function styleBlocks(html: string): string {
  const blocks: string[] = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    blocks.push(match[1]);
  }
  return blocks.join('\n');
}

const HEX_TOKEN = /--[a-z0-9-]+:\s*#[0-9a-fA-F]{3,8}\b/;

describe('legal pages consume the site stylesheet', () => {
  const pages = ['legal/privacy.html', 'legal/terms.html'];

  for (const page of pages) {
    test(`${page} links /assets/styles.css`, () => {
      const html = read(page);
      expect(html).toContain('rel="stylesheet"');
      expect(html).toMatch(/href="\/assets\/styles\.css(?:\?[^"]*)?"/);
    });

    test(`${page} does not declare loose hex palette tokens`, () => {
      const css = styleBlocks(read(page));
      expect(HEX_TOKEN.test(css)).toBe(false);
      expect(css.includes('--ink:')).toBe(false);
      expect(css.includes('--paper:')).toBe(false);
    });

    test(`${page} uses the legal-doc surface so tokens apply`, () => {
      const html = read(page);
      expect(html).toContain('data-surface="aux"');
      expect(html).toContain('class="legal-doc"');
    });
  }

  test('privacy stays bilingual EN + ES', () => {
    const html = read('legal/privacy.html');
    expect(html).toContain('Privacy Notice');
    expect(html).toContain('Aviso de Privacidad');
    expect(html).toContain('lang="es"');
  });

  test('terms stays bilingual EN + ES', () => {
    const html = read('legal/terms.html');
    expect(html).toContain('Terms of Use');
    expect(html).toContain('Términos de Uso');
    expect(html).toContain('lang="es"');
  });

  test('legal chrome in styles.css maps to site tokens, not hex ink', () => {
    const css = read('assets/styles.css');
    expect(css).toContain('body.legal-doc');
    expect(css).toContain('color: var(--accent)');
    expect(css).toContain('background: var(--bg)');
    expect(css.includes('.legal-doc') && /body\.legal-doc[^{]*\{[^}]*--ink:/.test(css)).toBe(false);
  });
});

describe('404 page uses site tokens and root-relative assets', () => {
  const html = read('404.html');

  test('links the site stylesheet with a root-relative href', () => {
    expect(html).toContain('rel="stylesheet"');
    expect(html).toMatch(/href="\/assets\/styles\.css(?:\?[^"]*)?"/);
  });

  test('does not inline a duplicate token palette or font-face', () => {
    const css = styleBlocks(html);
    expect(css.includes('@font-face')).toBe(false);
    expect(css.includes('--bg: oklch')).toBe(false);
    expect(HEX_TOKEN.test(css)).toBe(false);
  });

  test('uses the page-404 surface', () => {
    expect(html).toContain('data-surface="aux"');
    expect(html).toContain('class="page-404"');
  });

  test('stays bilingual without a JS dictionary', () => {
    expect(html).toContain('This page slipped through the cracks.');
    expect(html).toContain('Esta página se perdió.');
    expect(html).toContain('lang="es"');
    expect(html).toContain('Back to home');
    expect(html).toContain('Volver al inicio');
  });

  test('does not mix capdesis.com telemetry setup into this site', () => {
    expect(html.includes('stats.capdesis.com')).toBe(false);
    expect(html.includes('capdesis.com')).toBe(false);
  });

  test('does not invent analytics loaders on the 404 surface', () => {
    expect(html.includes('umami')).toBe(false);
    expect(html.includes('posthog')).toBe(false);
    expect(html.includes('cloudflareinsights')).toBe(false);
    expect(html.includes('gtag(')).toBe(false);
    expect(html.includes('googletagmanager')).toBe(false);
  });

  test('styles.css keeps the 404 chrome on site tokens', () => {
    const css = read('assets/styles.css');
    expect(css).toContain('body.page-404');
    expect(css).toContain('html[data-surface="aux"]');
  });
});

describe('i18n catalog still covers footer legal links', () => {
  test('index data-i18n keys exist in both dictionaries', () => {
    const index = read('index.html');
    const keys = [...index.matchAll(/\bdata-i18n="([^"]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(20);
    expect(keys).toContain('footer.privacy');
    expect(keys).toContain('footer.terms');

    const I18N = (globalThis as any).window.__I18N__;
    expect(I18N).toBeDefined();
    const missingEn = keys.filter((k) => typeof I18N.en[k] !== 'string');
    const missingEs = keys.filter((k) => typeof I18N.es[k] !== 'string');
    expect(missingEn).toEqual([]);
    expect(missingEs).toEqual([]);
  });
});
