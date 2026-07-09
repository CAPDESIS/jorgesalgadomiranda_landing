import { describe, expect, test } from 'bun:test';
import { computeYearsSince, subYears, checkI18nParity } from '../assets/js/i18n-utils.js';
import '../assets/i18n.js';

describe('computeYearsSince', () => {
  test('subtracts the start year from now', () => {
    expect(computeYearsSince(2018, 2026)).toBe(8);
  });

  test('returns 0 when the start year is the current year', () => {
    expect(computeYearsSince(2026, 2026)).toBe(0);
  });
});

describe('subYears', () => {
  test('substitutes a single {{yearsSince:YYYY}} token', () => {
    expect(subYears('Shipping since {{yearsSince:2018}}.', 2026)).toBe('Shipping since 8.');
  });

  test('substitutes multiple tokens in the same string', () => {
    expect(subYears('{{yearsSince:2018}} and {{yearsSince:2020}}', 2026)).toBe('8 and 6');
  });

  test('leaves a string with no tokens untouched', () => {
    expect(subYears('no tokens here', 2026)).toBe('no tokens here');
  });
});

describe('checkI18nParity', () => {
  test('detects keys missing from one side', () => {
    const result = checkI18nParity({ a: '1', b: '2' }, { a: '1' });
    expect(result.missingInEs).toEqual(['b']);
    expect(result.missingInEn).toEqual([]);
    expect(result.isInSync).toBe(false);
  });

  test('reports isInSync true when both dictionaries share every key', () => {
    const result = checkI18nParity({ a: '1' }, { a: 'uno' });
    expect(result.isInSync).toBe(true);
  });

  test('handles empty/undefined dictionaries without throwing', () => {
    expect(checkI18nParity(undefined as any, undefined as any)).toEqual({
      missingInEs: [],
      missingInEn: [],
      isInSync: true
    });
  });

  test('the real assets/i18n.js EN and ES dictionaries are in sync', () => {
    const I18N = (globalThis as any).window.__I18N__;
    expect(I18N).toBeDefined();
    const result = checkI18nParity(I18N.en, I18N.es);
    expect(result.missingInEn).toEqual([]);
    expect(result.missingInEs).toEqual([]);
  });

  test('the real dictionaries expose the keys the app depends on for title/desc', () => {
    const I18N = (globalThis as any).window.__I18N__;
    expect(typeof I18N.en.title).toBe('string');
    expect(typeof I18N.es.title).toBe('string');
    expect(typeof I18N.en.desc).toBe('string');
    expect(typeof I18N.es.desc).toBe('string');
  });
});
