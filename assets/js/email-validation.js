// Pure email validation logic for the contact form (index.html #contact-form).
// Extracted from the inline contact-form IIFE so it is importable by bun
// test. Loaded as a classic script (see index.html) so it keeps working
// with zero bundler, same pattern as assets/i18n.js.
const DISPOSABLE_DOMAINS = [
  '10minutemail.com', '10minutemail.net', '20minutemail.com', '30minutemail.com', 'mailinator.com', 'mailinator.net', 'mailinator2.com',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de', 'sharklasers.com', 'grr.la',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj',
  'trashmail.com', 'trashmail.net', 'trashmail.org', 'trashmail.io', 'trashmail.de', 'trash-mail.com', 'trashinbox.com',
  'throwawaymail.com', 'throwawayemail.com', 'dispostable.com', 'getnada.com', 'nada.email', 'maildrop.cc', 'mailcatch.com',
  'fakeinbox.com', 'fakemailgenerator.com', 'fake-email.com', 'tempail.com', 'tempmail.com', 'tempmail.net', 'tempmailaddress.com',
  'tempr.email', 'tmpmail.org', 'tmpmail.net', 'tmpeml.com', 'temp-mail.org', 'temp-mail.io', 'temp-mail.ru',
  'mohmal.com', 'emailondeck.com', 'moakt.com', 'mailnesia.com', 'mailnull.com', 'mytemp.email', 'discard.email', 'burnermail.io',
  'mailtemp.info', 'emailfake.com', '10mail.org', 'anonbox.net', 'boun.cr', 'inboxbear.com', 'inboxkitten.com', 'mintemail.com',
  'mvrht.com', 'spamgourmet.com', 'spambog.com', 'spambox.us', 'guerrillamailblock.com', 'sneakemail.com', 'tempemail.co',
  'throwam.com', 'yopmail.org', 'zetmail.com'
];

const DISPOSABLE_DOMAIN_SET = new Set(DISPOSABLE_DOMAINS);

// Conservative RFC5322-ish regex, good enough for client-side UX gating.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}$/;

// value -> { ok: true } | { ok: false, key: <i18n key> }
function validateEmail(raw) {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return { ok: false, key: 'form.err.required' };
  if (!EMAIL_RE.test(value)) return { ok: false, key: 'form.err.email' };
  const domain = value.split('@')[1];
  if (DISPOSABLE_DOMAIN_SET.has(domain)) return { ok: false, key: 'form.err.disposable' };
  return { ok: true };
}

const JSMEmailValidation = {
  DISPOSABLE_DOMAINS,
  EMAIL_RE,
  validateEmail
};

if (typeof window !== 'undefined') window.JSMEmailValidation = JSMEmailValidation;
if (typeof module !== 'undefined' && module.exports) module.exports = JSMEmailValidation;
