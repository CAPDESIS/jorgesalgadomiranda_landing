<?php
/**
 * jorgesalgadomiranda.com contact form proxy — Resend primary, optional SMTP fallback.
 * Keeps Resend/SMTP credentials server-side (env or deploy-injected api/secrets.php).
 */
ini_set('display_errors', '0');
error_reporting(0);

define('JSM_CONTACT_PROXY', true);

require __DIR__ . '/lib/bootstrap-env.php';
require __DIR__ . '/lib/contact-validator.php';
require __DIR__ . '/lib/rate-limit.php';
require __DIR__ . '/lib/resend-mail.php';
require __DIR__ . '/lib/smtp-mail.php';

jsm_load_secrets();

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$allowed_origins = [
    'https://jorgesalgadomiranda.com',
    'https://www.jorgesalgadomiranda.com',
];

if (php_sapi_name() === 'cli-server'
    || (isset($_SERVER['SERVER_NAME']) && in_array($_SERVER['SERVER_NAME'], ['localhost', '127.0.0.1'], true))
) {
    $allowed_origins[] = 'http://localhost:3000';
    $allowed_origins[] = 'http://127.0.0.1:3000';
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Honeypot — silently succeed so bots do not learn.
if (!empty($_POST['botcheck'])) {
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit;
}

// Per-IP throttle — public endpoint, cap delivery attempts (fail-closed).
$client_ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!jsm_contact_rate_limit_allow($client_ip)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Too many requests']);
    exit;
}

$validation = jsm_validate_contact_fields($_POST);
if ($validation !== true) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $validation]);
    exit;
}

$fields = [
    'name' => trim((string) $_POST['name']),
    'email' => strtolower(trim((string) $_POST['email'])),
    'company' => trim((string) ($_POST['company'] ?? '')),
    'topic' => trim((string) ($_POST['topic'] ?? '')),
    'message' => trim((string) $_POST['message']),
    'source_page' => trim((string) ($_POST['source_page'] ?? '/')),
    'locale' => trim((string) ($_POST['locale'] ?? 'es')),
];

$subject = trim((string) ($_POST['subject'] ?? 'New lead from jorgesalgadomiranda.com'));
if ($fields['topic'] !== '') {
    $subject .= ' — ' . $fields['topic'];
}

$html = jsm_resend_contact_html($fields);
$resendConfig = jsm_resend_config_from_env();
$smtpConfig = jsm_smtp_config_from_env();

if ($resendConfig === null && $smtpConfig === null) {
    error_log('[jsm-contact] RESEND_* and SMTP_* are both unset');
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Contact service unavailable']);
    exit;
}

$result = null;
$inbox = jsm_env('RESEND_TO', 'jorgesalgadomiranda@protonmail.com');
if ($resendConfig !== null) {
    $inbox = $resendConfig['to'];
    $result = jsm_resend_send_html(
        $resendConfig,
        $inbox,
        $subject,
        $html,
        $fields['email']
    );
    if (!$result['ok'] && $smtpConfig !== null) {
        error_log('[jsm-contact] Resend failed status=' . $result['status'] . '; trying SMTP fallback');
        $result = jsm_smtp_send_html(
            $smtpConfig,
            $inbox,
            $subject,
            $html,
            $fields['email']
        );
    }
} elseif ($smtpConfig !== null) {
    // Resend not configured — SMTP is last-resort only (fleet prefers Resend primary).
    error_log('[jsm-contact] RESEND not configured; delivering via SMTP fallback only');
    $result = jsm_smtp_send_html($smtpConfig, $inbox, $subject, $html, $fields['email']);
}

if ($result === null || !$result['ok']) {
    $status = is_array($result) && isset($result['status']) ? (int) $result['status'] : 502;
    if ($status < 400 || $status > 599) {
        $status = 502;
    }
    error_log('[jsm-contact] delivery failed provider=' . (is_array($result) ? ($result['provider'] ?? '?') : '?') . ' status=' . $status);
    http_response_code($status >= 500 ? $status : 502);
    echo json_encode(['success' => false, 'message' => 'Upstream delivery failed']);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => true,
    'provider' => $result['provider'] ?? 'resend',
    'id' => is_array($result['decoded'] ?? null) ? ($result['decoded']['id'] ?? null) : null,
], JSON_UNESCAPED_UNICODE);
