// Cookie-consent contract (LFPDPPP/GDPR gate) and the analytics loading
// gate. Extracted from the inline <head> IIFE in index.html. The contract
// shape (KEY, TTL_MS, VERSION, read()) is depended on by the cookie banner
// (assets/js/cookie-banner.js), so it must not change.
const CONSENT_KEY = 'jsm-cookie-consent';
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 365 days
const CONSENT_VERSION = 1;

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
function loadAnalytics(tokens, injectors) {
  tokens = tokens || {};
  injectors = injectors || {};
  const loadedProviders = [];
  if (isTokenConfigured(tokens.umamiId) && typeof injectors.umami === 'function') {
    injectors.umami(tokens.umamiId);
    loadedProviders.push('umami');
  }
  if (isTokenConfigured(tokens.cfToken) && typeof injectors.cloudflare === 'function') {
    injectors.cloudflare(tokens.cfToken);
    loadedProviders.push('cloudflare');
  }
  if (isTokenConfigured(tokens.posthogKey) && typeof injectors.posthog === 'function') {
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
    triggerIfAccepted() {
      if (firedOnce) return false;
      const prior = gate.read();
      if (prior && prior.accepted === true) {
        firedOnce = true;
        onAccept();
        return true;
      }
      return false;
    },
    // Call from the 'jsm-cookie-consent' listener with event.detail.
    handleConsentEvent(detail) {
      if (firedOnce) return false;
      if (detail && detail.accepted === true) {
        firedOnce = true;
        onAccept();
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
  readConsent,
  buildConsentRecord,
  persistConsent,
  isTokenConfigured,
  loadAnalytics,
  createConsentGate
};

if (typeof window !== 'undefined') window.JSMConsent = JSMConsent;
if (typeof module !== 'undefined' && module.exports) module.exports = JSMConsent;
