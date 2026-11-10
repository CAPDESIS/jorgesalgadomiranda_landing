import { describe, expect, test, beforeEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COPY, pickLang, pickCopy, createFallbackContract, persist, collectProviders, applyPrefsCopy, applyCopy } from '../assets/js/cookie-banner.js';

describe('pickLang / pickCopy', () => {
  test('returns es for anything that is not exactly "en"', () => {
    expect(pickLang(undefined as any)).toBe('es');
    expect(pickLang('')).toBe('es');
    expect(pickLang('ES')).toBe('es');
    expect(pickLang('fr')).toBe('es');
  });

  test('returns en only for the exact "en" value', () => {
    expect(pickLang('en')).toBe('en');
  });

  test('pickCopy returns the matching dictionary object', () => {
    expect(pickCopy('en')).toBe(COPY.en);
    expect(pickCopy('es')).toBe(COPY.es);
    expect(pickCopy(undefined as any)).toBe(COPY.es);
  });

  test('both locale dictionaries define the same set of copy keys', () => {
    expect(Object.keys(COPY.en).sort()).toEqual(Object.keys(COPY.es).sort());
  });
});

describe('createFallbackContract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('read() returns null when nothing is stored', () => {
    const contract = createFallbackContract();
    expect(contract.read()).toBeNull();
  });

  test('read() returns null on invalid JSON', () => {
    localStorage.setItem(createFallbackContract().KEY, '{broken');
    expect(createFallbackContract().read()).toBeNull();
  });

  test('read() returns null for a version mismatch', () => {
    const contract = createFallbackContract();
    localStorage.setItem(contract.KEY, JSON.stringify({ version: 2, timestamp: Date.now() }));
    expect(contract.read()).toBeNull();
  });

  test('read() returns null once the TTL has elapsed', () => {
    const contract = createFallbackContract();
    localStorage.setItem(contract.KEY, JSON.stringify({ version: contract.VERSION, timestamp: Date.now() - contract.TTL_MS - 1000 }));
    expect(contract.read()).toBeNull();
  });

  test('read() returns the record when it is fresh and valid', () => {
    const contract = createFallbackContract();
    const record = { version: contract.VERSION, timestamp: Date.now(), accepted: true };
    localStorage.setItem(contract.KEY, JSON.stringify(record));
    expect(contract.read()).toEqual(record);
  });
});

describe('persist', () => {
  test('writes accepted/timestamp/version in the exact contract shape', () => {
    const data: Record<string, string> = {};
    const storage = { setItem: (k: string, v: string) => { data[k] = v; } };
    const contract = { KEY: 'k', VERSION: 1 };
    expect(persist(storage as any, contract, true, 123)).toBe(true);
    expect(JSON.parse(data.k)).toEqual({ accepted: true, timestamp: 123, version: 1 });
  });

  test('coerces accepted to a strict boolean', () => {
    const data: Record<string, string> = {};
    const storage = { setItem: (k: string, v: string) => { data[k] = v; } };
    persist(storage as any, { KEY: 'k', VERSION: 1 }, 0 as any, 123);
    expect(JSON.parse(data.k).accepted).toBe(false);
  });

  test('returns false when storage throws', () => {
    const storage = { setItem: () => { throw new Error('nope'); } };
    expect(persist(storage as any, { KEY: 'k', VERSION: 1 }, true, 1)).toBe(false);
  });

  test('stores the granular provider map when one is given', () => {
    const data: Record<string, string> = {};
    const storage = { setItem: (k: string, v: string) => { data[k] = v; } };
    persist(storage as any, { KEY: 'k', VERSION: 1 }, true, 123, { posthog: false, umami: true, cloudflare: false });
    expect(JSON.parse(data.k)).toEqual({
      accepted: true,
      timestamp: 123,
      version: 1,
      providers: { posthog: false, umami: true, cloudflare: false },
    });
  });

  test('coerces provider flags to strict booleans and drops unknown keys', () => {
    const data: Record<string, string> = {};
    const storage = { setItem: (k: string, v: string) => { data[k] = v; } };
    persist(storage as any, { KEY: 'k', VERSION: 1 }, true, 123, { posthog: 1, gtag: true } as any);
    expect(JSON.parse(data.k).providers).toEqual({ posthog: false, umami: false, cloudflare: false });
  });
});

describe('collectProviders', () => {
  function buildPrefs() {
    document.body.innerHTML = `
      <div id="cookie-banner">
        <input type="checkbox" data-cookie-provider="posthog" checked />
        <input type="checkbox" data-cookie-provider="umami" />
        <input type="checkbox" data-cookie-provider="cloudflare" checked />
      </div>`;
    return document.getElementById('cookie-banner')!;
  }

  test('reads each provider checkbox state', () => {
    expect(collectProviders(buildPrefs())).toEqual({ posthog: true, umami: false, cloudflare: true });
  });

  test('missing checkboxes read as false (opt-in)', () => {
    document.body.innerHTML = '<div id="cookie-banner"></div>';
    expect(collectProviders(document.getElementById('cookie-banner')!)).toEqual({
      posthog: false,
      umami: false,
      cloudflare: false,
    });
  });

  test('returns all false without a banner element', () => {
    expect(collectProviders(null as any)).toEqual({ posthog: false, umami: false, cloudflare: false });
  });
});

describe('applyPrefsCopy', () => {
  function buildPrefs() {
    document.body.innerHTML = `
      <div id="cookie-banner">
        <p data-cookie-prefs="title"></p>
        <p data-cookie-prefs="necessary"></p>
        <span data-cookie-prefs="posthog"></span>
        <span data-cookie-prefs="umami"></span>
        <span data-cookie-prefs="cloudflare"></span>
        <button data-cookie-prefs="save"></button>
      </div>`;
    return document.getElementById('cookie-banner')!;
  }

  test('fills every preferences label from the dictionary', () => {
    const banner = buildPrefs();
    applyPrefsCopy(banner, COPY.en);
    expect(banner.querySelector('[data-cookie-prefs="title"]')!.textContent).toBe(COPY.en.prefsTitle);
    expect(banner.querySelector('[data-cookie-prefs="necessary"]')!.textContent).toBe(COPY.en.prefsNecessary);
    expect(banner.querySelector('[data-cookie-prefs="posthog"]')!.textContent).toBe(COPY.en.prefsPosthog);
    expect(banner.querySelector('[data-cookie-prefs="umami"]')!.textContent).toBe(COPY.en.prefsUmami);
    expect(banner.querySelector('[data-cookie-prefs="cloudflare"]')!.textContent).toBe(COPY.en.prefsCloudflare);
    expect(banner.querySelector('[data-cookie-prefs="save"]')!.textContent).toBe(COPY.en.save);
  });

  test('is a no-op without banner or dictionary', () => {
    expect(() => applyPrefsCopy(null as any, COPY.en)).not.toThrow();
    expect(() => applyPrefsCopy(buildPrefs(), null as any)).not.toThrow();
  });
});

describe('applyCopy', () => {
  function buildBanner() {
    document.body.innerHTML = `
      <div id="cookie-banner">
        <h2 data-cookie-i18n="title"></h2>
        <p data-cookie-i18n="body">
          placeholder <a href="legal/privacy.html" data-cookie-i18n="link">placeholder</a>.
        </p>
        <button id="cookie-accept" data-cookie-i18n="accept"></button>
        <button id="cookie-reject" data-cookie-i18n="reject"></button>
        <button id="cookie-configure" data-cookie-i18n="configure"></button>
      </div>`;
    return document.getElementById('cookie-banner')!;
  }

  test('fills in all text nodes from the given dictionary', () => {
    const banner = buildBanner();
    applyCopy(banner, COPY.en, document);
    expect(banner.querySelector('[data-cookie-i18n="title"]')!.textContent).toBe('Privacy');
    expect(banner.querySelector('#cookie-accept')!.textContent).toBe('Accept all');
    expect(banner.querySelector('#cookie-reject')!.textContent).toBe('Essentials only');
    const configure = banner.querySelector('#cookie-configure')!;
    expect(configure.textContent).toBe('Configure');
    expect(configure.getAttribute('aria-label')).toBe('Configure');
  });

  test('rebuilds the body paragraph with the link and trailing period', () => {
    const banner = buildBanner();
    applyCopy(banner, COPY.es, document);
    const body = banner.querySelector('[data-cookie-i18n="body"]')!;
    expect(body.textContent).toBe(COPY.es.body + ' ' + COPY.es.link + '.');
    const link = body.querySelector('a[data-cookie-i18n="link"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('legal/privacy.html');
  });

  test('is a no-op when the banner element does not exist', () => {
    expect(() => applyCopy(null as any, COPY.en, document)).not.toThrow();
  });

  test('is a no-op when the dictionary is missing', () => {
    const banner = buildBanner();
    expect(() => applyCopy(banner, null as any, document)).not.toThrow();
  });

  test('skips optional elements gracefully when they are absent from the DOM', () => {
    document.body.innerHTML = '<div id="cookie-banner"></div>';
    const banner = document.getElementById('cookie-banner')!;
    expect(() => applyCopy(banner, COPY.en, document)).not.toThrow();
  });
});

describe('banner markup contract', () => {
  const index = readFileSync(join(import.meta.dir, '..', 'index.html'), 'utf8');

  test('offers accept, reject and configure as three equally visible buttons', () => {
    expect(index).toContain('id="cookie-accept"');
    expect(index).toContain('id="cookie-reject"');
    expect(index).toContain('id="cookie-configure"');
    expect(index.includes('id="cookie-close"')).toBe(false);
  });

  test('preferences panel carries one checkbox per provider plus save', () => {
    expect(index).toContain('id="cookie-prefs"');
    expect(index).toContain('data-cookie-provider="posthog"');
    expect(index).toContain('data-cookie-provider="umami"');
    expect(index).toContain('data-cookie-provider="cloudflare"');
    expect(index).toContain('id="cookie-save"');
  });

  test('contact form links the privacy notice', () => {
    expect(index).toContain('data-i18n="form.privacy"');
    expect(index).toContain('href="legal/privacy.html"');
  });

  test('#cookie-banner-title meets WCAG AA (>= 4.5:1) in dark and light themes', () => {
    const styles = readFileSync(join(import.meta.dir, '..', 'assets', 'styles.css'), 'utf8');

    function parseOklch(block: string, varName: string): [number, number, number] {
      const re = new RegExp(`${varName}:\\s*oklch\\(\\s*([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s*\\)`);
      const m = block.match(re);
      if (!m) throw new Error(`Missing ${varName} oklch token`);
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    }

    function oklchToLinearRgb([L, C, hDeg]: [number, number, number]): [number, number, number] {
      const h = (hDeg * Math.PI) / 180;
      const a = C * Math.cos(h);
      const b = C * Math.sin(h);
      const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
      const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
      const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
      const encodeSrgb = (c: number) => {
        const x = clamp01(c);
        return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
      };
      const decodeSrgbByte = (byteVal: number) => {
        const x = byteVal / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
      // Round through 8-bit sRGB channels just like browser compositing / axe-core.
      return [rLin, gLin, bLin].map((c) => decodeSrgbByte(Math.round(encodeSrgb(c) * 255))) as [
        number,
        number,
        number,
      ];
    }

    function luminance([r, g, b]: [number, number, number]): number {
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
      const l1 = luminance(oklchToLinearRgb(fg));
      const l2 = luminance(oklchToLinearRgb(bg));
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    expect(index).toMatch(/\.cookie-banner-title\s*\{[\s\S]*?color:\s*var\(--accent\)/);

    const rootBlock = styles.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const lightBlock = styles.match(/\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const auxLightBlock =
      styles.match(/html\[data-surface="aux"\]:not\(\[data-theme="dark"\]\)\s*\{([\s\S]*?)\n  \}/)?.[1] ?? '';

    const darkRatio = contrastRatio(parseOklch(rootBlock, '--accent'), parseOklch(rootBlock, '--bg-elev'));
    const lightRatio = contrastRatio(parseOklch(lightBlock, '--accent'), parseOklch(lightBlock, '--bg-elev'));
    const lightBgRatio = contrastRatio(parseOklch(lightBlock, '--accent'), parseOklch(lightBlock, '--bg'));
    const auxLightRatio = contrastRatio(parseOklch(auxLightBlock, '--accent'), parseOklch(auxLightBlock, '--bg-elev'));

    expect(darkRatio).toBeGreaterThanOrEqual(4.8);
    expect(lightRatio).toBeGreaterThanOrEqual(4.8);
    expect(lightBgRatio).toBeGreaterThanOrEqual(4.8);
    expect(auxLightRatio).toBeGreaterThanOrEqual(4.8);
  });
});
