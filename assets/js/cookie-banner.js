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
    close: 'Cerrar'
  },
  en: {
    title: 'Privacy',
    body: 'I use anonymous analytics (PostHog, Umami, Cloudflare) to learn which pages help. Nothing runs until you accept.',
    link: 'Privacy notice',
    accept: 'Accept all',
    reject: 'Essentials only',
    close: 'Close'
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

function persist(storage, contract, accepted, now) {
  const nowMs = typeof now === 'number' ? now : Date.now();
  try {
    storage.setItem(contract.KEY, JSON.stringify({
      accepted: !!accepted,
      timestamp: nowMs,
      version: contract.VERSION
    }));
    return true;
  } catch (_) {
    return false;
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
  const close = banner.querySelector('[data-cookie-i18n="close"]');
  if (title) title.textContent = dict.title;
  if (accept) accept.textContent = dict.accept;
  if (reject) reject.textContent = dict.reject;
  if (close) {
    close.setAttribute('aria-label', dict.close);
    close.textContent = dict.close;
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
  applyCopy
};

if (typeof window !== 'undefined') window.JSMCookieBanner = JSMCookieBanner;
if (typeof module !== 'undefined' && module.exports) module.exports = JSMCookieBanner;
