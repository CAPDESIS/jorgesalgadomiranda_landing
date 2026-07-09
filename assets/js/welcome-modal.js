// Welcome-modal dismiss timing. Extracted from the inline welcome-modal
// block in index.html (shows after 12s, once per 7 days once dismissed).
const WELCOME_STORAGE_KEY = 'jsm_welcome_v1';
const WELCOME_DISMISS_DAYS = 7;
const WELCOME_SHOW_DELAY_MS = 12000;

// localStorage always returns strings; a missing/corrupt value parses to
// NaN via parseInt, which parseDismissedAt normalizes to 0 (never hidden).
function parseDismissedAt(raw) {
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

function isStillHidden(dismissedAt, now, days) {
  const d = typeof days === 'number' ? days : WELCOME_DISMISS_DAYS;
  if (!dismissedAt) return false;
  return (now - dismissedAt) < d * 86400000;
}

const JSMWelcomeModal = {
  WELCOME_STORAGE_KEY,
  WELCOME_DISMISS_DAYS,
  WELCOME_SHOW_DELAY_MS,
  parseDismissedAt,
  isStillHidden
};

if (typeof window !== 'undefined') window.JSMWelcomeModal = JSMWelcomeModal;
if (typeof module !== 'undefined' && module.exports) module.exports = JSMWelcomeModal;
