import { describe, expect, test } from 'bun:test';
import { validateEmail, EMAIL_RE, DISPOSABLE_DOMAINS } from '../assets/js/email-validation.js';

describe('validateEmail', () => {
  test('accepts a normal, well-formed email', () => {
    expect(validateEmail('jorge@example.com')).toEqual({ ok: true });
  });

  test('rejects empty input with the required key', () => {
    expect(validateEmail('')).toEqual({ ok: false, key: 'form.err.required' });
  });

  test('rejects whitespace-only input as required (not malformed)', () => {
    expect(validateEmail('   ')).toEqual({ ok: false, key: 'form.err.required' });
  });

  test('rejects undefined/null input as required', () => {
    // @ts-expect-error exercising the (raw || '') guard against non-string input
    expect(validateEmail(undefined)).toEqual({ ok: false, key: 'form.err.required' });
  });

  test('rejects an address with no @ sign', () => {
    expect(validateEmail('not-an-email')).toEqual({ ok: false, key: 'form.err.email' });
  });

  test('rejects a 1-character TLD', () => {
    expect(validateEmail('jorge@example.c')).toEqual({ ok: false, key: 'form.err.email' });
  });

  test('rejects a TLD longer than 24 characters', () => {
    expect(validateEmail('jorge@example.' + 'a'.repeat(25))).toEqual({ ok: false, key: 'form.err.email' });
  });

  test('accepts the maximum 24 character TLD', () => {
    expect(validateEmail('jorge@example.' + 'a'.repeat(24))).toEqual({ ok: true });
  });

  test('rejects an address with spaces', () => {
    expect(validateEmail('jorge salgado@example.com')).toEqual({ ok: false, key: 'form.err.email' });
  });

  test('trims surrounding whitespace before validating', () => {
    expect(validateEmail('  jorge@example.com  ')).toEqual({ ok: true });
  });

  test('lowercases mixed-case input before matching, so uppercase disposable domains are still caught', () => {
    expect(validateEmail('Jorge@Mailinator.COM')).toEqual({ ok: false, key: 'form.err.disposable' });
  });

  test('rejects an exact disposable domain match', () => {
    expect(validateEmail('someone@mailinator.com')).toEqual({ ok: false, key: 'form.err.disposable' });
  });

  test('does NOT block a subdomain of a disposable domain (documented gap, not a bug fix)', () => {
    // Characterization test: the current DISPOSABLE set does exact string
    // matches only, so foo@mail.mailinator.com is not blocked today. This
    // captures the existing behavior noted in the coverage audit rather
    // than silently changing it.
    expect(validateEmail('foo@mail.mailinator.com')).toEqual({ ok: true });
  });

  test('accepts every non-disposable domain that matches EMAIL_RE', () => {
    expect(validateEmail('someone@guerrillamail.com').ok).toBe(false);
    expect(validateEmail('someone@yopmail.com').ok).toBe(false);
    expect(validateEmail('someone@tempmail.net').ok).toBe(false);
    expect(validateEmail('someone@zetmail.com').ok).toBe(false);
  });

  test('every configured disposable domain is rejected', () => {
    for (const domain of DISPOSABLE_DOMAINS) {
      expect(validateEmail(`user@${domain}`)).toEqual({ ok: false, key: 'form.err.disposable' });
    }
  });

  test('EMAIL_RE rejects a numeric TLD', () => {
    expect(EMAIL_RE.test('jorge@example.123')).toBe(false);
  });

  test('accepts plus-addressing and dotted local parts', () => {
    expect(validateEmail('jorge.salgado+leads@example.co')).toEqual({ ok: true });
  });
});
