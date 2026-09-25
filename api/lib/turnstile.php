<?php
/**
 * Cloudflare Turnstile verification for the contact proxy.
 *
 * The secret is injected at deploy time (TURNSTILE_SECRET_KEY env or
 * api/secrets.php). Without a secret the check stays open (current
 * behavior: honeypot plus rate limit); provisioning the secret activates
 * enforcement. Deploy is manual, so nothing activates by surprise.
 */
if (!defined('JSM_CONTACT_PROXY')) {
    http_response_code(403);
    exit('Forbidden');
}

define('JSM_TURNSTILE_VERIFY_URL', 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
define('JSM_TURNSTILE_TOKEN_FIELD', 'cf-turnstile-response');

/** @var callable|null Override in tests to stub Cloudflare siteverify. */
$GLOBALS['jsm_turnstile_verify_handler'] = null;

/**
 * @return bool true when a token must be presented and verified.
 */
function jsm_turnstile_should_enforce(): bool
{
    return trim((string) (getenv('TURNSTILE_SECRET_KEY') ?: '')) !== '';
}

/**
 * @return string the widget token from the POST body or header, '' when absent.
 */
function jsm_turnstile_extract_token(array $post, array $server): string
{
    $headerToken = $server['HTTP_X_TURNSTILE_TOKEN'] ?? '';
    if (is_string($headerToken) && trim($headerToken) !== '') {
        return trim($headerToken);
    }
    $bodyToken = $post[JSM_TURNSTILE_TOKEN_FIELD] ?? '';
    if (is_string($bodyToken) && trim($bodyToken) !== '') {
        return trim($bodyToken);
    }

    return '';
}

/**
 * @return bool true only when Cloudflare accepts the token.
 */
function jsm_turnstile_verify(string $token, string $clientIp): bool
{
    $handler = $GLOBALS['jsm_turnstile_verify_handler'] ?? null;
    if (is_callable($handler)) {
        return (bool) $handler($token, $clientIp);
    }

    $secret = trim((string) (getenv('TURNSTILE_SECRET_KEY') ?: ''));
    if ($secret === '' || $token === '') {
        return false;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query([
                'secret' => $secret,
                'response' => $token,
                'remoteip' => $clientIp,
            ]),
            'timeout' => 5,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents(JSM_TURNSTILE_VERIFY_URL, false, $context);
    if ($raw === false) {
        return false;
    }

    $decoded = json_decode($raw, true);

    return is_array($decoded) && !empty($decoded['success']);
}
