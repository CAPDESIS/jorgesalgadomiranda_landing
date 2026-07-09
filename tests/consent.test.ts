import { describe, expect, test, mock, beforeEach } from 'bun:test';
import {
  CONSENT_KEY,
  CONSENT_TTL_MS,
  CONSENT_VERSION,
  readConsent,
  buildConsentRecord,
  persistConsent,
  isTokenConfigured,
  loadAnalytics,
  createConsentGate
} from '../assets/js/consent.js';

// happy-dom's localStorage is one global shared across every test file in
// this process, so clear it before each test to avoid cross-file leakage.
beforeEach(() => {
  localStorage.clear();
});

function fakeStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    _data: data
  };
}

describe('readConsent', () => {
  test('returns null when storage has no entry', () => {
    expect(readConsent(fakeStorage(), 1000)).toBeNull();
  });

  test('returns null on invalid JSON', () => {
    const storage = fakeStorage({ [CONSENT_KEY]: '{not json' });
    expect(readConsent(storage, 1000)).toBeNull();
  });

  test('returns null when the stored value is not an object', () => {
    const storage = fakeStorage({ [CONSENT_KEY]: '"just a string"' });
    expect(readConsent(storage, 1000)).toBeNull();
  });

  test('returns null when the version does not match', () => {
    const storage = fakeStorage({ [CONSENT_KEY]: JSON.stringify({ accepted: true, timestamp: 1000, version: 2 }) });
    expect(readConsent(storage, 1000)).toBeNull();
  });

  test('returns null when timestamp is not numeric', () => {
    const storage = fakeStorage({ [CONSENT_KEY]: JSON.stringify({ accepted: true, timestamp: 'yesterday', version: CONSENT_VERSION }) });
    expect(readConsent(storage, 1000)).toBeNull();
  });

  test('returns null once the TTL has expired', () => {
    const record = { accepted: true, timestamp: 0, version: CONSENT_VERSION };
    const storage = fakeStorage({ [CONSENT_KEY]: JSON.stringify(record) });
    expect(readConsent(storage, CONSENT_TTL_MS + 1)).toBeNull();
  });

  test('returns the parsed record just before TTL expiry', () => {
    const record = { accepted: true, timestamp: 0, version: CONSENT_VERSION };
    const storage = fakeStorage({ [CONSENT_KEY]: JSON.stringify(record) });
    expect(readConsent(storage, CONSENT_TTL_MS)).toEqual(record);
  });

  test('returns null when storage throws (private-mode Safari style)', () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError');
      }
    };
    expect(readConsent(storage as any, 1000)).toBeNull();
  });

  test('returns null when no storage is available at all', () => {
    expect(readConsent(null as any, 1000)).toBeNull();
  });
});

describe('buildConsentRecord / persistConsent', () => {
  test('buildConsentRecord coerces accepted to a strict boolean', () => {
    expect(buildConsentRecord(1 as any, 500)).toEqual({ accepted: true, timestamp: 500, version: CONSENT_VERSION });
    expect(buildConsentRecord(0 as any, 500)).toEqual({ accepted: false, timestamp: 500, version: CONSENT_VERSION });
  });

  test('persistConsent writes the exact contract shape', () => {
    const storage = fakeStorage();
    const ok = persistConsent(storage, true, 42);
    expect(ok).toBe(true);
    expect(JSON.parse(storage._data[CONSENT_KEY])).toEqual({ accepted: true, timestamp: 42, version: CONSENT_VERSION });
  });

  test('persistConsent returns false when storage throws', () => {
    const storage = {
      setItem: () => {
        throw new Error('quota exceeded');
      }
    };
    expect(persistConsent(storage as any, true, 42)).toBe(false);
  });
});

describe('isTokenConfigured', () => {
  test('rejects empty/undefined tokens', () => {
    expect(isTokenConfigured('')).toBe(false);
    expect(isTokenConfigured(undefined as any)).toBe(false);
  });

  test('rejects placeholder tokens starting with YOUR_', () => {
    expect(isTokenConfigured('YOUR_UMAMI_WEBSITE_ID')).toBe(false);
  });

  test('accepts a real-looking token', () => {
    expect(isTokenConfigured('abc123')).toBe(true);
  });
});

describe('loadAnalytics', () => {
  test('loads no provider when every token is a placeholder', () => {
    const injectors = { umami: mock(), cloudflare: mock(), posthog: mock() };
    const loaded = loadAnalytics({ umamiId: 'YOUR_X', cfToken: 'YOUR_Y', posthogKey: 'YOUR_Z' }, injectors);
    expect(loaded).toEqual([]);
    expect(injectors.umami).not.toHaveBeenCalled();
    expect(injectors.cloudflare).not.toHaveBeenCalled();
    expect(injectors.posthog).not.toHaveBeenCalled();
  });

  test('loads only the providers with configured tokens', () => {
    const injectors = { umami: mock(), cloudflare: mock(), posthog: mock() };
    const loaded = loadAnalytics({ umamiId: 'real-id', cfToken: 'YOUR_Y', posthogKey: 'real-key', posthogHost: 'https://x' }, injectors);
    expect(loaded).toEqual(['umami', 'posthog']);
    expect(injectors.umami).toHaveBeenCalledWith('real-id');
    expect(injectors.cloudflare).not.toHaveBeenCalled();
    expect(injectors.posthog).toHaveBeenCalledWith('real-key', 'https://x');
  });

  test('handles missing tokens/injectors object gracefully', () => {
    expect(loadAnalytics(undefined as any, undefined as any)).toEqual([]);
  });

  test('loads the cloudflare beacon when its token is configured', () => {
    const injectors = { cloudflare: mock() };
    const loaded = loadAnalytics({ cfToken: 'real-cf-token' }, injectors);
    expect(loaded).toEqual(['cloudflare']);
    expect(injectors.cloudflare).toHaveBeenCalledWith('real-cf-token');
  });
});

describe('createConsentGate', () => {
  test('exposes the exact contract shape the cookie banner depends on', () => {
    const gate = createConsentGate({ storage: fakeStorage(), now: () => 0 });
    expect(gate.KEY).toBe(CONSENT_KEY);
    expect(gate.TTL_MS).toBe(CONSENT_TTL_MS);
    expect(gate.VERSION).toBe(CONSENT_VERSION);
    expect(typeof gate.read).toBe('function');
  });

  test('triggerIfAccepted fires onAccept once when a prior accepted consent exists', () => {
    const record = { accepted: true, timestamp: 0, version: CONSENT_VERSION };
    const storage = fakeStorage({ [CONSENT_KEY]: JSON.stringify(record) });
    const onAccept = mock();
    const gate = createConsentGate({ storage, now: () => 0, onAccept });
    expect(gate.triggerIfAccepted()).toBe(true);
    expect(onAccept).toHaveBeenCalledTimes(1);
    // Calling again must not double-fire.
    expect(gate.triggerIfAccepted()).toBe(false);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test('triggerIfAccepted does nothing when prior consent was rejected', () => {
    const record = { accepted: false, timestamp: 0, version: CONSENT_VERSION };
    const storage = fakeStorage({ [CONSENT_KEY]: JSON.stringify(record) });
    const onAccept = mock();
    const gate = createConsentGate({ storage, now: () => 0, onAccept });
    expect(gate.triggerIfAccepted()).toBe(false);
    expect(onAccept).not.toHaveBeenCalled();
  });

  test('handleConsentEvent fires onAccept only when detail.accepted is exactly true', () => {
    const storage = fakeStorage();
    const onAccept = mock();
    const gate = createConsentGate({ storage, now: () => 0, onAccept });
    expect(gate.handleConsentEvent({ accepted: false })).toBe(false);
    expect(gate.handleConsentEvent(undefined)).toBe(false);
    expect(onAccept).not.toHaveBeenCalled();
    expect(gate.handleConsentEvent({ accepted: true })).toBe(true);
    expect(onAccept).toHaveBeenCalledTimes(1);
    // Once fired, a later event must not fire again.
    expect(gate.handleConsentEvent({ accepted: true })).toBe(false);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test('gate.read() reflects the injected now() clock', () => {
    const record = { accepted: true, timestamp: 0, version: CONSENT_VERSION };
    const storage = fakeStorage({ [CONSENT_KEY]: JSON.stringify(record) });
    let clock = 0;
    const gate = createConsentGate({ storage, now: () => clock });
    expect(gate.read()).toEqual(record);
    clock = CONSENT_TTL_MS + 1;
    expect(gate.read()).toBeNull();
  });

  test('falls back to real localStorage and Date.now when no options are given', () => {
    (globalThis as any).localStorage.removeItem(CONSENT_KEY);
    const gate = createConsentGate();
    expect(gate.read()).toBeNull();
    expect(gate.triggerIfAccepted()).toBe(false);
  });
});
