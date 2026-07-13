<?php
declare(strict_types=1);

/**
 * Contract tests for the Resend/SMTP contact proxy.
 *
 *   php scripts/test-contact-api.php
 */
define('JSM_CONTACT_PROXY', true);

$root = dirname(__DIR__);
require $root . '/api/lib/bootstrap-env.php';
require $root . '/api/lib/contact-validator.php';
require $root . '/api/lib/resend-mail.php';
require $root . '/api/lib/smtp-mail.php';

$failures = 0;

function check(string $name, bool $ok, string $details = ''): void
{
    global $failures;
    if ($ok) {
        echo "PASS: {$name}\n";
        return;
    }
    $suffix = $details !== '' ? " ({$details})" : '';
    echo "FAIL: {$name}{$suffix}\n";
    $failures++;
}

// --- Validator ---
check('valid payload accepted', jsm_validate_contact_fields([
    'name' => 'Jorge Salgado',
    'email' => 'jorge@example.com',
    'company' => 'Capdesis',
    'topic' => 'architecture',
    'message' => 'Need a short architecture review for our API.',
]) === true);

check('short message rejected', jsm_validate_contact_fields([
    'name' => 'Jorge',
    'email' => 'jorge@example.com',
    'topic' => 'other',
    'message' => 'too short',
]) === 'Invalid message');

check('bad email rejected', jsm_validate_contact_fields([
    'name' => 'Jorge',
    'email' => 'not-an-email',
    'topic' => 'other',
    'message' => 'This message is long enough for validation.',
]) === 'Invalid email');

check('bad topic rejected', jsm_validate_contact_fields([
    'name' => 'Jorge',
    'email' => 'jorge@example.com',
    'topic' => 'hacking',
    'message' => 'This message is long enough for validation.',
]) === 'Invalid topic');

// --- Resend config ---
putenv('RESEND_API_KEY');
putenv('RESEND_FROM');
putenv('RESEND_TO');
unset($_ENV['RESEND_API_KEY'], $_ENV['RESEND_FROM'], $_ENV['RESEND_TO']);
check('resend config null without key', jsm_resend_config_from_env() === null);

putenv('RESEND_API_KEY=re_test_key');
$_ENV['RESEND_API_KEY'] = 're_test_key';
putenv('RESEND_FROM=Jorge <noreply@jorgesalgadomiranda.com>');
$_ENV['RESEND_FROM'] = 'Jorge <noreply@jorgesalgadomiranda.com>';
$config = jsm_resend_config_from_env();
check('resend config loads', is_array($config) && ($config['api_key'] ?? '') === 're_test_key');
check('resend default to', is_array($config) && ($config['to'] ?? '') === 'jorgesalgadomiranda@protonmail.com');

$html = jsm_resend_contact_html([
    'name' => 'Ada',
    'email' => 'ada@example.com',
    'message' => "Hello\nWorld",
]);
check('html includes name', strpos($html, 'Ada') !== false);
check('html escapes', strpos($html, '<script>') === false);

// Mock Resend with a local PHP server
$mockPort = random_int(21000, 45000);
$mockDir = sys_get_temp_dir() . '/jsm_resend_mock_' . bin2hex(random_bytes(4));
mkdir($mockDir, 0700, true);
$mockRouter = $mockDir . '/router.php';
file_put_contents($mockRouter, <<<'PHP'
<?php
header('Content-Type: application/json');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/emails' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    http_response_code(200);
    echo json_encode(['id' => 'email_test_1']);
    return true;
}
http_response_code(404);
echo json_encode(['error' => 'not found']);
return true;
PHP);

$stdout = tempnam(sys_get_temp_dir(), 'jsm_out_');
$stderr = tempnam(sys_get_temp_dir(), 'jsm_err_');
$cmd = escapeshellarg(PHP_BINARY) . ' -S 127.0.0.1:' . $mockPort . ' ' . escapeshellarg($mockRouter);
$proc = proc_open($cmd, [1 => ['file', $stdout, 'a'], 2 => ['file', $stderr, 'a']], $pipes, $mockDir, ['PATH' => getenv('PATH') ?: '/usr/bin']);

$ready = false;
for ($i = 0; $i < 50; $i++) {
    usleep(40000);
    $errno = 0;
    $errstr = '';
    $fp = @fsockopen('127.0.0.1', $mockPort, $errno, $errstr, 0.2);
    if ($fp) {
        fclose($fp);
        $ready = true;
        break;
    }
}
check('resend mock server started', is_resource($proc) && $ready, $errstr ?: 'no connect');

putenv('RESEND_API_BASE=http://127.0.0.1:' . $mockPort);
$_ENV['RESEND_API_BASE'] = 'http://127.0.0.1:' . $mockPort;
$config = jsm_resend_config_from_env();
$send = jsm_resend_send_html($config, 'jorgesalgadomiranda@protonmail.com', 'Test lead', $html, 'ada@example.com');
check('resend mock send ok', $send['ok'] === true, 'status=' . ($send['status'] ?? '?') . ' body=' . substr((string) ($send['body'] ?? ''), 0, 120));
check('resend mock id', ($send['decoded']['id'] ?? null) === 'email_test_1');

if (is_resource($proc)) {
    $status = proc_get_status($proc);
    if (!empty($status['pid'])) {
        posix_kill((int) $status['pid'], 15);
    }
    proc_close($proc);
}
@unlink($stdout);
@unlink($stderr);
@unlink($mockRouter);
@rmdir($mockDir);

// --- SMTP config gate ---
putenv('SMTP_HOST');
putenv('SMTP_USER');
putenv('SMTP_PASS');
unset($_ENV['SMTP_HOST'], $_ENV['SMTP_USER'], $_ENV['SMTP_PASS']);
check('smtp config null without creds', jsm_smtp_config_from_env() === null);

putenv('SMTP_HOST=smtp.example.com');
putenv('SMTP_USER=user@example.com');
putenv('SMTP_PASS=secret');
putenv('SMTP_PORT=465');
$_ENV['SMTP_HOST'] = 'smtp.example.com';
$_ENV['SMTP_USER'] = 'user@example.com';
$_ENV['SMTP_PASS'] = 'secret';
$_ENV['SMTP_PORT'] = '465';
$smtp = jsm_smtp_config_from_env();
check('smtp config loads', is_array($smtp) && ($smtp['host'] ?? '') === 'smtp.example.com');

// --- HTTP endpoint smoke via php -S ---
$docroot = $root;
$port = random_int(21000, 45000);
$out = tempnam(sys_get_temp_dir(), 'jsm_contact_out_');
$err = tempnam(sys_get_temp_dir(), 'jsm_contact_err_');
$env = [
    'PATH' => getenv('PATH') ?: '/usr/bin',
    'RESEND_API_KEY' => 're_test_key',
    'RESEND_FROM' => 'Jorge <noreply@jorgesalgadomiranda.com>',
    'RESEND_TO' => 'jorgesalgadomiranda@protonmail.com',
    'RESEND_API_BASE' => 'http://127.0.0.1:' . $mockPort, // dead — expect 502 without fallback
];
// Start a fresh mock for the endpoint test
$mockPort2 = random_int(21000, 45000);
$mockDir2 = sys_get_temp_dir() . '/jsm_resend_mock2_' . bin2hex(random_bytes(4));
mkdir($mockDir2, 0700, true);
file_put_contents($mockDir2 . '/router.php', <<<'PHP'
<?php
header('Content-Type: application/json');
if (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) === '/emails' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    http_response_code(200);
    echo json_encode(['id' => 'email_ep']);
    return true;
}
http_response_code(404);
echo json_encode(['error' => 'not found']);
return true;
PHP);
$mockProc = proc_open(
    escapeshellarg(PHP_BINARY) . ' -S 127.0.0.1:' . $mockPort2 . ' ' . escapeshellarg($mockDir2 . '/router.php'),
    [1 => ['file', tempnam(sys_get_temp_dir(), 'm2o'), 'a'], 2 => ['file', tempnam(sys_get_temp_dir(), 'm2e'), 'a']],
    $pipes2,
    $mockDir2,
    ['PATH' => getenv('PATH') ?: '/usr/bin']
);
$env['RESEND_API_BASE'] = 'http://127.0.0.1:' . $mockPort2;
for ($i = 0; $i < 50; $i++) {
    usleep(40000);
    $fp = @fsockopen('127.0.0.1', $mockPort2, $errno, $errstr, 0.2);
    if ($fp) {
        fclose($fp);
        break;
    }
}

$server = proc_open(
    escapeshellarg(PHP_BINARY) . ' -S 127.0.0.1:' . $port . ' -t ' . escapeshellarg($docroot),
    [1 => ['file', $out, 'a'], 2 => ['file', $err, 'a']],
    $pipes3,
    $docroot,
    $env
);
usleep(250000);

$payload = http_build_query([
    'name' => 'Jorge Salgado',
    'email' => 'jorge@example.com',
    'company' => 'Capdesis',
    'topic' => 'security',
    'message' => 'Please review the authentication flow for our fleet apps.',
    'subject' => 'New lead from jorgesalgadomiranda.com',
]);

$ch = curl_init('http://127.0.0.1:' . $port . '/api/contact.php');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_TIMEOUT => 10,
]);
$body = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
$decoded = is_string($body) ? json_decode($body, true) : null;
check('contact endpoint 200', $status === 200, 'status=' . $status . ' body=' . substr((string) $body, 0, 200));
check('contact endpoint success', is_array($decoded) && ($decoded['success'] ?? false) === true);
check('contact endpoint provider resend', is_array($decoded) && ($decoded['provider'] ?? '') === 'resend');

// honeypot
$ch = curl_init('http://127.0.0.1:' . $port . '/api/contact.php');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'name' => 'Bot',
        'email' => 'bot@example.com',
        'topic' => 'other',
        'message' => 'This would be spam content long enough.',
        'botcheck' => 'http://spam.example',
    ]),
]);
$honeypotBody = curl_exec($ch);
$honeypotStatus = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
$honeypotJson = is_string($honeypotBody) ? json_decode($honeypotBody, true) : null;
check('honeypot soft-succeeds', $honeypotStatus === 200 && ($honeypotJson['success'] ?? false) === true);

foreach ([$server, $mockProc] as $p) {
    if (is_resource($p)) {
        $st = proc_get_status($p);
        if (!empty($st['pid'])) {
            posix_kill((int) $st['pid'], 15);
        }
        proc_close($p);
    }
}
@array_map('unlink', glob($mockDir2 . '/*') ?: []);
@rmdir($mockDir2);
@unlink($out);
@unlink($err);

echo $failures === 0 ? "\nAll contact API contract tests passed.\n" : "\n{$failures} failure(s).\n";
exit($failures === 0 ? 0 : 1);
