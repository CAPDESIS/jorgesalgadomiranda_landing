import { describe, expect, test, beforeEach } from 'bun:test';
import { COPY, pickLang, pickCopy, createFallbackContract, persist, applyCopy } from '../assets/js/cookie-banner.js';

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
        <button id="cookie-close" data-cookie-i18n="close"></button>
      </div>`;
    return document.getElementById('cookie-banner')!;
  }

  test('fills in all text nodes from the given dictionary', () => {
    const banner = buildBanner();
    applyCopy(banner, COPY.en, document);
    expect(banner.querySelector('[data-cookie-i18n="title"]')!.textContent).toBe('Privacy');
    expect(banner.querySelector('#cookie-accept')!.textContent).toBe('Accept all');
    expect(banner.querySelector('#cookie-reject')!.textContent).toBe('Essentials only');
    const close = banner.querySelector('#cookie-close')!;
    expect(close.textContent).toBe('Close');
    expect(close.getAttribute('aria-label')).toBe('Close');
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
