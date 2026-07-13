<?php
/**
 * Example deploy-injected secrets for the contact proxy.
 * Copy to secrets.php on the host (or let CI generate it) — never commit secrets.php.
 *
 * Resend is primary. SMTP_* is optional fallback when Resend fails/quota.
 */
return [
    // Required for Resend primary:
    'RESEND_API_KEY' => 're_xxxxxxxx',
    'RESEND_FROM' => 'Jorge Salgado Miranda <noreply@jorgesalgadomiranda.com>',
    'RESEND_TO' => 'jorgesalgadomiranda@protonmail.com',
    // 'RESEND_REPLY_TO' => 'jorgesalgadomiranda@protonmail.com',
    // 'RESEND_API_BASE' => 'https://api.resend.com',

    // Optional SMTP fallback (Hostinger or other):
    // 'SMTP_HOST' => 'smtp.hostinger.com',
    // 'SMTP_PORT' => '465',
    // 'SMTP_USER' => 'noreply@jorgesalgadomiranda.com',
    // 'SMTP_PASS' => 'replace_me',
    // 'SMTP_FROM' => 'Jorge Salgado Miranda <noreply@jorgesalgadomiranda.com>',
    // 'SMTP_TLS' => 'true',
];
