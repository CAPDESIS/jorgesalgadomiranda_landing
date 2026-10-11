import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

// Typed /privacidad, /terminos, /privacy and /terms returned 404 while the
// documents live at legal/privacy.html and legal/terms.html (LEGALS
// 2026-10-11). Hostinger Apache serves the apex, so the root .htaccess
// must 301 each alias to its single canonical page.
describe('canonical legal URL aliases', () => {
  const htaccess = readFileSync(join(ROOT, '.htaccess'), 'utf8');

  test.each([
    ['privacidad', 'legal/privacy.html'],
    ['terminos', 'legal/terms.html'],
    ['privacy', 'legal/privacy.html'],
    ['terms', 'legal/terms.html'],
  ])('/%s 301s to /%s', (alias, target) => {
    expect(htaccess).toMatch(
      new RegExp(`RewriteRule\\s+\\^${alias}/\\?\\$\\s+\\/${target}\\s+\\[R=301,L\\]`)
    );
  });

  test('keeps the https and www-to-apex redirects', () => {
    expect(htaccess).toContain('RewriteCond %{HTTPS} !=on');
    expect(htaccess).toContain('www\\.jorgesalgadomiranda\\.com');
  });
});
