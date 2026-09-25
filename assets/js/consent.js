// Cookie-consent contract (LFPDPPP/GDPR gate) and the analytics loading
// gate. Extracted from the inline <head> IIFE in index.html. The contract
// shape (KEY, TTL_MS, VERSION, read()) is depended on by the cookie banner
// (assets/js/cookie-banner.js), so it must not change.
const CONSENT_KEY = 'jsm-cookie-consent';
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 365 days
const CONSENT_VERSION = 1;

// Analytics providers the preferences panel can toggle individually.
// Keys match the token/injector names used by loadAnalytics below.
const PROVIDERS = ['posthog', 'umami', 'cloudflare'];

// storage defaults to localStorage, now defaults to Date.now(); both are
// injectable so tests never touch real browser storage or the clock.
function readConsent(storage, now) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const nowMs = typeof now === 'number' ? now : Date.now();
  if (!store) return null;
  try {
    const raw = store.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (typeof parsed.timestamp !== 'number') return null;
    if ((nowMs - parsed.timestamp) > CONSENT_TTL_MS) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function buildConsentRecord(accepted, now) {
  const nowMs = typeof now === 'number' ? now : Date.now();
  return { accepted: !!accepted, timestamp: nowMs, version: CONSENT_VERSION };
}

// Normalizes a per-provider preference map to strict booleans for every
// known provider. Unknown keys are dropped; missing keys default to false
// (opt-in: nothing runs unless the visitor enabled it).
function normalizeProviders(input) {
  const source = (input && typeof input === 'object') ? input : {};
  const out = {};
  for (var i = 0; i < PROVIDERS.length; i += 1) {
    out[PROVIDERS[i]] = source[PROVIDERS[i]] === true;
  }
  return out;
}

function allProvidersEnabled() {
  return { posthog: true, umami: true, cloudflare: true };
}

function noProvidersEnabled() {
  return { posthog: false, umami: false, cloudflare: false };
}

// Providers allowed by a stored record or event detail. Legacy records
// without a providers map fall back to accepted === true meaning all on.
function providersFromConsent(consent) {
  if (!consent || typeof consent !== 'object') return noProvidersEnabled();
  if (consent.providers && typeof consent.providers === 'object') {
    return normalizeProviders(consent.providers);
  }
  return consent.accepted === true ? allProvidersEnabled() : noProvidersEnabled();
}

function persistConsent(storage, accepted, now) {
  try {
    storage.setItem(CONSENT_KEY, JSON.stringify(buildConsentRecord(accepted, now)));
    return true;
  } catch (_) {
    return false;
  }
}

// A provider token only counts as configured once the deploy step has
// replaced the YOUR_ placeholder (see deploy.yml). Client code must never
// load a provider with a placeholder token.
function isTokenConfigured(token) {
  return !!token && token.indexOf('YOUR_') !== 0;
}

// Decides which analytics providers to load given the configured tokens,
// and calls the matching injector for each one. Returns the list of
// providers that were actually loaded so callers/tests can assert on the
// decision without needing a real DOM.
//
// The optional third argument carries the visitor's per-provider choice
// (see normalizeProviders). When absent, every configured provider loads,
// preserving the pre-preferences accept-all behavior.
function loadAnalytics(tokens, injectors, providers) {
  tokens = tokens || {};
  injectors = injectors || {};
  const allowed = providers ? normalizeProviders(providers) : null;
  const loadedProviders = [];
  if ((!allowed || allowed.umami) && isTokenConfigured(tokens.umamiId) && typeof injectors.umami === 'function') {
    injectors.umami(tokens.umamiId);
    loadedProviders.push('umami');
  }
  if ((!allowed || allowed.cloudflare) && isTokenConfigured(tokens.cfToken) && typeof injectors.cloudflare === 'function') {
    injectors.cloudflare(tokens.cfToken);
    loadedProviders.push('cloudflare');
  }
  if ((!allowed || allowed.posthog) && isTokenConfigured(tokens.posthogKey) && typeof injectors.posthog === 'function') {
    injectors.posthog(tokens.posthogKey, tokens.posthogHost);
    loadedProviders.push('posthog');
  }
  return loadedProviders;
}

// Builds the runtime gate used by index.html: fires onAccept() at most once,
// either immediately if a prior valid consent exists, or later when the
// cookie banner dispatches the 'jsm-cookie-consent' event.
function createConsentGate(options) {
  const opts = options || {};
  const storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const onAccept = typeof opts.onAccept === 'function' ? opts.onAccept : () => {};
  let firedOnce = false;

  const gate = {
    KEY: CONSENT_KEY,
    TTL_MS: CONSENT_TTL_MS,
    VERSION: CONSENT_VERSION,
    read() {
      return readConsent(storage, now());
    },
    // Call once at startup. Returns true if a prior acceptance fired onAccept.
    // onAccept receives the per-provider map so the loader only injects
    // what the visitor enabled (legacy all-or-nothing records map to all).
    triggerIfAccepted() {
      if (firedOnce) return false;
      const prior = gate.read();
      if (prior && prior.accepted === true) {
        firedOnce = true;
        onAccept(providersFromConsent(prior));
        return true;
      }
      return false;
    },
    // Call from the 'jsm-cookie-consent' listener with event.detail.
    handleConsentEvent(detail) {
      if (firedOnce) return false;
      if (detail && detail.accepted === true) {
        firedOnce = true;
        onAccept(providersFromConsent(detail));
        return true;
      }
      return false;
    }
  };
  return gate;
}

const JSMConsent = {
  CONSENT_KEY,
  CONSENT_TTL_MS,
  CONSENT_VERSION,
  PROVIDERS,
  readConsent,
  buildConsentRecord,
  persistConsent,
  isTokenConfigured,
  loadAnalytics,
  normalizeProviders,
  providersFromConsent,
  createConsentGate
};

if (typeof window !== 'undefined') window.JSMConsent = JSMConsent;
if (typeof module !== 'undefined' && module.exports) module.exports = JSMConsent;
