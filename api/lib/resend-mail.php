<?php
/**
 * Thin Resend HTTP client for jorgesalgadomiranda.com contact leads.
 * Pattern shared with CapdesisWebLanding public/api/lib/resend-mail.php.
 */
if (!defined('JSM_CONTACT_PROXY')) {
    http_response_code(403);
    exit('Forbidden');
}

/**
 * Read Resend API key from RESEND_API_KEY or RESEND_API_KEY_FILE.
 */
function jsm_resend_read_api_key(): string
{
    $direct = jsm_env('RESEND_API_KEY');
    if ($direct !== '') {
        return $direct;
    }

    $file = jsm_env('RESEND_API_KEY_FILE');
    if ($file === '' || !is_readable($file)) {
        return '';
    }

    $contents = file_get_contents($file);
    if ($contents === false) {
        return '';
    }

    return trim($contents);
}

/**
 * @return array{api_key: string, from: string, to: string, reply_to: string, api_base: string}|null
 */
function jsm_resend_config_from_env(): ?array
{
    $apiKey = jsm_resend_read_api_key();
    if ($apiKey === '') {
        return null;
    }

    $from = jsm_env('RESEND_FROM');
    if ($from === '') {
        return null;
    }

    $to = jsm_env('RESEND_TO');
    if ($to === '') {
        $to = 'jorgesalgadomiranda@protonmail.com';
    }

    $replyTo = jsm_env('RESEND_REPLY_TO');
    $apiBase = rtrim(jsm_env('RESEND_API_BASE'), '/');
    if ($apiBase === '') {
        $apiBase = 'https://api.resend.com';
    }

    return [
        'api_key' => $apiKey,
        'from' => $from,
        'to' => $to,
        'reply_to' => $replyTo,
        'api_base' => $apiBase,
    ];
}

/**
 * @param array<string, string> $fields
 */
function jsm_resend_contact_html(array $fields): string
{
    $rows = '';
    $labels = [
        'name' => 'Name',
        'email' => 'Email',
        'company' => 'Company',
        'topic' => 'Topic',
        'message' => 'Message',
        'source_page' => 'Source page',
        'locale' => 'Locale',
    ];

    foreach ($labels as $key => $label) {
        $value = htmlspecialchars($fields[$key] ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        if ($value === '') {
            continue;
        }
        $rows .= '<tr><td style="padding:6px 0;font-weight:600;vertical-align:top;">'
            . htmlspecialchars($label, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '</td><td style="padding:6px 0;white-space:pre-wrap;">'
            . nl2br($value)
            . '</td></tr>';
    }

    return '<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;">'
        . '<h2 style="margin:0 0 16px;">New lead from jorgesalgadomiranda.com</h2>'
        . '<table style="border-collapse:collapse;width:100%;max-width:640px;">'
        . $rows
        . '</table></body></html>';
}

/**
 * @param array{api_key: string, from: string, to: string, reply_to: string, api_base: string} $config
 * @return array{ok: bool, status: int, body: string, decoded: ?array, provider: string}
 */
function jsm_resend_send_html(array $config, string $to, string $subject, string $html, string $replyTo = ''): array
{
    $to = trim($to);
    $subject = trim($subject);
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'status' => 400, 'body' => 'invalid recipient', 'decoded' => null, 'provider' => 'resend'];
    }
    if ($subject === '' || $html === '') {
        return ['ok' => false, 'status' => 400, 'body' => 'missing subject or html', 'decoded' => null, 'provider' => 'resend'];
    }
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'status' => 500, 'body' => 'curl missing', 'decoded' => null, 'provider' => 'resend'];
    }

    $payload = [
        'from' => $config['from'],
        'to' => [$to],
        'subject' => $subject,
        'html' => $html,
    ];
    $effectiveReplyTo = $replyTo !== '' ? $replyTo : $config['reply_to'];
    if ($effectiveReplyTo !== '') {
        $payload['reply_to'] = $effectiveReplyTo;
    }

    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return ['ok' => false, 'status' => 500, 'body' => 'json encode failed', 'decoded' => null, 'provider' => 'resend'];
    }

    $ch = curl_init($config['api_base'] . '/emails');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: Bearer ' . $config['api_key'],
        ],
        CURLOPT_POSTFIELDS => $json,
    ]);

    $response = curl_exec($ch);
    if ($response === false) {
        $message = curl_error($ch) ?: 'Unknown Resend HTTP error';
        curl_close($ch);
        return ['ok' => false, 'status' => 502, 'body' => $message, 'decoded' => null, 'provider' => 'resend'];
    }

    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    $decoded = null;
    if ($response !== '') {
        $parsed = json_decode($response, true);
        if (is_array($parsed)) {
            $decoded = $parsed;
        }
    }

    return [
        'ok' => $status >= 200 && $status < 300,
        'status' => $status,
        'body' => (string) $response,
        'decoded' => $decoded,
        'provider' => 'resend',
    ];
}
