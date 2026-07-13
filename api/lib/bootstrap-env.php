<?php
/**
 * Load deploy-injected secrets into the process environment.
 *
 * Prefer getenv / Hostinger panel env when present. Fall back to
 * api/secrets.php generated at deploy time (never commit that file).
 */
if (!defined('JSM_CONTACT_PROXY')) {
    http_response_code(403);
    exit('Forbidden');
}

/**
 * @return void
 */
function jsm_load_secrets(): void
{
    $file = dirname(__DIR__) . '/secrets.php';
    if (!is_readable($file)) {
        return;
    }

    $secrets = require $file;
    if (!is_array($secrets)) {
        return;
    }

    foreach ($secrets as $key => $value) {
        if (!is_string($key) || $key === '' || !is_scalar($value)) {
            continue;
        }
        $string = trim((string) $value);
        if ($string === '') {
            continue;
        }
        $existing = getenv($key);
        if (is_string($existing) && trim($existing) !== '') {
            continue;
        }
        putenv($key . '=' . $string);
        $_ENV[$key] = $string;
    }
}

/**
 * Read a trimmed env string from getenv or $_ENV.
 */
function jsm_env(string $key, string $default = ''): string
{
    $value = getenv($key);
    if ($value === false || $value === '') {
        $value = $_ENV[$key] ?? $default;
    }
    return trim((string) $value);
}
