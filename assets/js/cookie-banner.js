// Cookie banner logic (copy selection, consent persistence, DOM render of
// the bilingual copy). Extracted from the inline banner IIFE at the bottom
// of index.html so the copy contract and persistence shape are testable.
//
// The fallback contract below is intentionally self-contained (it does not
// call into assets/js/consent.js) so the banner keeps working even if the
// head consent script failed to load; this mirrors the original inline
// "defense in depth" comment.
function createFallbackContract() {
  const KEY = 'jsm-cookie-consent';
  const TTL_MS = 365 * 24 * 60 * 60 * 1000;
  const VERSION = 1;
  return {
    KEY,
    TTL_MS,
    VERSION,
    read() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION) return null;
        if ((Date.now() - parsed.timestamp) > TTL_MS) return null;
        return parsed;
      } catch (_) {
        return null;
      }
    }
  };
}

const COPY = {
  es: {
    title: 'Privacidad',
    body: 'Uso analíticas anónimas (PostHog, Umami, Cloudflare) para entender qué páginas son útiles. No se ejecutan hasta que aceptes.',
    link: 'Aviso de privacidad',
    accept: 'Aceptar todas',
    reject: 'Solo esenciales',
    configure: 'Configurar',
    prefsTitle: 'Elige qué analítica puede ejecutarse',
    prefsNecessary: 'Esenciales: siempre activas (recuerdan tu elección y el idioma).',
    prefsPosthog: 'PostHog: mide visitas e interacciones (EE. UU., usa cookies).',
    prefsUmami: 'Umami: mide visitas agregadas (auto-hospedado, sin cookies).',
    prefsCloudflare: 'Cloudflare: mide tráfico agregado (sin cookies).',
    save: 'Guardar elección'
  },
  en: {
    title: 'Privacy',
    body: 'I use anonymous analytics (PostHog, Umami, Cloudflare) to learn which pages help. Nothing runs until you accept.',
    link: 'Privacy notice',
    accept: 'Accept all',
    reject: 'Essentials only',
    configure: 'Configure',
    prefsTitle: 'Choose which analytics may run',
    prefsNecessary: 'Essentials: always on (they remember your choice and language).',
    prefsPosthog: 'PostHog: measures visits and interactions (US, uses cookies).',
    prefsUmami: 'Umami: measures aggregate visits (self-hosted, no cookies).',
    prefsCloudflare: 'Cloudflare: measures aggregate traffic (no cookies).',
    save: 'Save choice'
  }
};

// Only 'en' is a distinct branch; anything else (including missing/invalid
// attribute) falls back to 'es', matching the site default language.
function pickLang(langAttr) {
  return langAttr === 'en' ? 'en' : 'es';
}

function pickCopy(langAttr) {
  return COPY[pickLang(langAttr)];
}

function persist(storage, contract, accepted, now, providers) {
  const nowMs = typeof now === 'number' ? now : Date.now();
  try {
    const record = {
      accepted: !!accepted,
      timestamp: nowMs,
      version: contract.VERSION
    };
    // Granular choice from the preferences panel. Omitted for the legacy
    // accept-all / reject-all path so the stored shape stays unchanged.
    if (providers && typeof providers === 'object') {
      record.providers = {
        posthog: providers.posthog === true,
        umami: providers.umami === true,
        cloudflare: providers.cloudflare === true
      };
    }
    storage.setItem(contract.KEY, JSON.stringify(record));
    return true;
  } catch (_) {
    return false;
  }
}

// Reads the preferences panel checkboxes into a provider map. Unchecked
// or missing boxes read as false (opt-in).
function collectProviders(banner) {
  const out = { posthog: false, umami: false, cloudflare: false };
  if (!banner || typeof banner.querySelector !== 'function') return out;
  const names = ['posthog', 'umami', 'cloudflare'];
  for (var i = 0; i < names.length; i += 1) {
    const box = banner.querySelector('[data-cookie-provider="' + names[i] + '"]');
    out[names[i]] = !!(box && box.checked === true);
  }
  return out;
}

function applyPrefsCopy(banner, dict) {
  if (!banner || !dict) return;
  const pairs = [
    ['prefsTitle', 'title'],
    ['prefsNecessary', 'necessary'],
    ['prefsPosthog', 'posthog'],
    ['prefsUmami', 'umami'],
    ['prefsCloudflare', 'cloudflare'],
    ['save', 'save']
  ];
  for (var i = 0; i < pairs.length; i += 1) {
    const el = banner.querySelector('[data-cookie-prefs="' + pairs[i][1] + '"]');
    if (el) el.textContent = dict[pairs[i][0]];
  }
}

// Rebuilds the banner copy in place, including the inline privacy-notice
// link, so the trailing period and link text always match the active
// locale. `banner` is the #cookie-banner element; `doc` defaults to
// `document` so tests can pass a happy-dom document explicitly.
function applyCopy(banner, dict, doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!banner || !dict || !d) return;
  const title = banner.querySelector('[data-cookie-i18n="title"]');
  const bodyText = banner.querySelector('[data-cookie-i18n="body"]');
  const accept = banner.querySelector('[data-cookie-i18n="accept"]');
  const reject = banner.querySelector('[data-cookie-i18n="reject"]');
  const configure = banner.querySelector('[data-cookie-i18n="configure"]');
  if (title) title.textContent = dict.title;
  if (accept) accept.textContent = dict.accept;
  if (reject) reject.textContent = dict.reject;
  if (configure) {
    configure.setAttribute('aria-label', dict.configure);
    configure.textContent = dict.configure;
  }
  if (bodyText) {
    while (bodyText.firstChild) bodyText.removeChild(bodyText.firstChild);
    bodyText.appendChild(d.createTextNode(dict.body + ' '));
    const a = d.createElement('a');
    a.href = 'legal/privacy.html';
    a.setAttribute('data-cookie-i18n', 'link');
    a.textContent = dict.link;
    bodyText.appendChild(a);
    bodyText.appendChild(d.createTextNode('.'));
  }
}

const JSMCookieBanner = {
  COPY,
  pickLang,
  pickCopy,
  createFallbackContract,
  persist,
  collectProviders,
  applyPrefsCopy,
  applyCopy
};

if (typeof window !== 'undefined') window.JSMCookieBanner = JSMCookieBanner;
if (typeof module !== 'undefined' && module.exports) module.exports = JSMCookieBanner;
