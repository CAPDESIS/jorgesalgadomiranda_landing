<?php
/**
 * Validate contact form fields before Resend/SMTP delivery.
 */
if (!defined('JSM_CONTACT_PROXY')) {
    http_response_code(403);
    exit('Forbidden');
}

/**
 * @param array<string, mixed> $fields
 * @return true|string True if valid, error message if invalid
 */
function jsm_validate_contact_fields(array $fields)
{
    $name = trim((string) ($fields['name'] ?? ''));
    if ($name === '' || strlen($name) < 2 || strlen($name) > 80) {
        return 'Invalid name';
    }
    if (!preg_match("/^[a-zA-ZÀ-ÿ\\x{00f1}\\x{00d1}\\s'\\-]{2,80}$/u", $name)) {
        return 'Invalid name';
    }

    $email = strtolower(trim((string) ($fields['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 120) {
        return 'Invalid email';
    }

    $company = trim((string) ($fields['company'] ?? ''));
    if (strlen($company) > 120) {
        return 'Invalid company';
    }

    $topic = trim((string) ($fields['topic'] ?? ''));
    $allowedTopics = ['architecture', 'security', 'performance', 'costs', 'mobile', 'other', ''];
    if (!in_array($topic, $allowedTopics, true)) {
        return 'Invalid topic';
    }

    $message = trim((string) ($fields['message'] ?? ''));
    if (strlen($message) < 10 || strlen($message) > 2000) {
        return 'Invalid message';
    }

    return true;
}
