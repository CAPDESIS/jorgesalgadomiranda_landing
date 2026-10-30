<?php
declare(strict_types=1);

/**
 * Contract tests for the Resend-only contact proxy.
 *
 *   php scripts/test-contact-api.php
 */
define('JSM_CONTACT_PROXY', true);

$root = dirname(__DIR__);
require $root . '/api/lib/bootstrap-env.php';
require $root . '/api/lib/contact-validator.php';
require $root . '/api/lib/resend-mail.php';

$failures = 0;
$jsmTestProcesses = [];
$jsmTestCleanupFiles = [];
$jsmTestCleanupDirectories = [];
$jsmTestCleaningUp = false;

function jsm_test_track_process($process): void
{
    global $jsmTestProcesses;
    if (is_resource($process)) {
        $jsmTestProcesses[] = $process;
    }
}

function jsm_test_track_cleanup_file(string $path): void
{
    global $jsmTestCleanupFiles;
    $jsmTestCleanupFiles[] = $path;
}

function jsm_test_track_cleanup_directory(string $path): void
{
    global $jsmTestCleanupDirectories;
    $jsmTestCleanupDirectories[] = $path;
}

function jsm_test_stop_process($process): void
{
    if (!is_resource($process)) {
        return;
    }

    $status = proc_get_status($process);
    if (!empty($status['running'])) {
        @proc_terminate($process, 15);
        for ($i = 0; $i < 10; $i++) {
            usleep(50000);
            $status = proc_get_status($process);
            if (empty($status['running'])) {
                break;
            }
        }
        if (!empty($status['running'])) {
            @proc_terminate($process, 9);
        }
    }

    @proc_close($process);
}

function jsm_test_cleanup(): void
{
    global $jsmTestProcesses, $jsmTestCleanupFiles, $jsmTestCleanupDirectories, $jsmTestCleaningUp;
    if ($jsmTestCleaningUp) {
        return;
    }
    $jsmTestCleaningUp = true;

    foreach ($jsmTestProcesses as $process) {
        jsm_test_stop_process($process);
    }
    foreach ($jsmTestCleanupFiles as $path) {
        @unlink($path);
    }
    foreach ($jsmTestCleanupDirectories as $path) {
        @rmdir($path);
    }
}

function jsm_test_remove_tree(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST) as $entry) {
        $entry->isDir() ? @rmdir($entry->getPathname()) : @unlink($entry->getPathname());
    }
    @rmdir($dir);
}

function jsm_test_handle_signal(int $signal): void
{
    jsm_test_cleanup();
    exit(128 + $signal);
}

/**
 * A loopback port the kernel reports as free right now (bind to port 0).
 */
function jsm_test_free_loopback_port(): int
{
    $socket = @stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
    if ($socket === false) {
        throw new RuntimeException("cannot reserve a loopback port: {$errstr}");
    }
    $name = (string) stream_socket_get_name($socket, false);
    fclose($socket);
    $port = (int) substr($name, (int) strrpos($name, ':') + 1);
    if ($port <= 0) {
        throw new RuntimeException("cannot read the reserved loopback port from '{$name}'");
    }
    return $port;
}

/**
 * Start `php -S` on a loopback port that THIS server is proven to own.
 *
 * The previous version picked random_int(21000, 45000) and called the server
 * ready as soon as a TCP connect to that port succeeded. When the port was
 * already taken, php -S exited with "Address already in use" while the connect
 * reached the other listener, so the test posted to the wrong server and failed
 * with a 404 from an unrelated mock (main run 40928363474, 2026-10-29).
 *
 * Now the kernel picks a free port, and the server only counts as ready when
 * its own log says it started on that port, the process is still running, and
 * the port accepts a connection. Losing the small race between reserving the
 * port and php -S binding it is detected the same way and retried on a new
 * port, at most $attempts times.
 *
 * @param list<string> $serverArgs arguments after `-S 127.0.0.1:<port>`
 * @param array<string, string> $env
 * @return array{process: resource, port: int, stdout: string, stderr: string}
 */
function jsm_test_start_php_server(array $serverArgs, string $cwd, array $env, int $attempts = 5): array
{
    $lastLog = '';
    for ($attempt = 1; $attempt <= $attempts; $attempt++) {
        $port = jsm_test_free_loopback_port();
        $stdout = (string) tempnam(sys_get_temp_dir(), 'jsm_srv_out_');
        $stderr = (string) tempnam(sys_get_temp_dir(), 'jsm_srv_err_');
        jsm_test_track_cleanup_file($stdout);
        jsm_test_track_cleanup_file($stderr);
        $process = proc_open(
            array_merge([PHP_BINARY, '-S', '127.0.0.1:' . $port], $serverArgs),
            [1 => ['file', $stdout, 'a'], 2 => ['file', $stderr, 'a']],
            $pipes,
            $cwd,
            $env
        );
        if (!is_resource($process)) {
            $lastLog = "attempt {$attempt}: proc_open failed";
            continue;
        }
        jsm_test_track_process($process);
        // php -S announces the address it actually bound, on stderr (stdout on
        // older builds), e.g. "Development Server (http://127.0.0.1:PORT) started".
        $startedHere = '#Development Server.*127\.0\.0\.1:' . $port . '\b#';
        $log = '';
        for ($i = 0; $i < 100; $i++) {
            usleep(50000);
            $log = (string) @file_get_contents($stderr) . (string) @file_get_contents($stdout);
            $running = !empty(proc_get_status($process)['running']);
            if (!$running) {
                break;
            }
            if (preg_match($startedHere, $log) === 1) {
                $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.5);
                if ($fp) {
                    fclose($fp);
                    return ['process' => $process, 'port' => $port, 'stdout' => $stdout, 'stderr' => $stderr];
                }
            }
        }
        $lastLog = "attempt {$attempt} on port {$port}: " . trim($log);
        jsm_test_stop_process($process);
    }
    throw new RuntimeException("php -S did not start after {$attempts} attempts; last: {$lastLog}");
}

register_shutdown_function('jsm_test_cleanup');
if (function_exists('pcntl_async_signals') && function_exists('pcntl_signal')) {
    pcntl_async_signals(true);
    pcntl_signal(SIGTERM, 'jsm_test_handle_signal');
    pcntl_signal(SIGINT, 'jsm_test_handle_signal');
}

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
$mockDir = sys_get_temp_dir() . '/jsm_resend_mock_' . bin2hex(random_bytes(4));
mkdir($mockDir, 0700, true);
$mockRouter = $mockDir . '/router.php';
jsm_test_track_cleanup_directory($mockDir);
jsm_test_track_cleanup_file($mockRouter);
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

$mockPort = 0;
$mockStartError = '';
try {
    $mockServer = jsm_test_start_php_server([$mockRouter], $mockDir, ['PATH' => getenv('PATH') ?: '/usr/bin']);
    $mockPort = $mockServer['port'];
} catch (RuntimeException $e) {
    $mockStartError = $e->getMessage();
}
check('resend mock server started', $mockPort > 0, $mockStartError);

putenv('RESEND_API_BASE=http://127.0.0.1:' . $mockPort);
$_ENV['RESEND_API_BASE'] = 'http://127.0.0.1:' . $mockPort;
$config = jsm_resend_config_from_env();
$send = jsm_resend_send_html($config, 'jorgesalgadomiranda@protonmail.com', 'Test lead', $html, 'ada@example.com');
check('resend mock send ok', $send['ok'] === true, 'status=' . ($send['status'] ?? '?') . ' body=' . substr((string) ($send['body'] ?? ''), 0, 120));
check('resend mock id', ($send['decoded']['id'] ?? null) === 'email_test_1');

// --- HTTP endpoint smoke via php -S ---
// The contact rate limiter keeps 5 hits per IP per hour under sys_get_temp_dir().
// Each run gets its own TMPDIR so repeated runs never exhaust the shared counter.
$contactTmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'jsm-contact-test-' . bin2hex(random_bytes(6));
mkdir($contactTmp, 0700, true);
register_shutdown_function('jsm_test_remove_tree', $contactTmp);
$docroot = $root;
$env = [
    'PATH' => getenv('PATH') ?: '/usr/bin',
    'TMPDIR' => $contactTmp,
    'RESEND_API_KEY' => 're_test_key',
    'RESEND_FROM' => 'Jorge <noreply@jorgesalgadomiranda.com>',
    'RESEND_TO' => 'jorgesalgadomiranda@protonmail.com',
    'RESEND_API_BASE' => 'http://127.0.0.1:' . $mockPort, // dead — expect 502 without fallback
];
// Start a fresh mock for the endpoint test
$mockDir2 = sys_get_temp_dir() . '/jsm_resend_mock2_' . bin2hex(random_bytes(4));
mkdir($mockDir2, 0700, true);
$mockRouter2 = $mockDir2 . '/router.php';
jsm_test_track_cleanup_directory($mockDir2);
jsm_test_track_cleanup_file($mockRouter2);
file_put_contents($mockRouter2, <<<'PHP'
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
try {
    $mockServer2 = jsm_test_start_php_server([$mockRouter2], $mockDir2, ['PATH' => getenv('PATH') ?: '/usr/bin']);
} catch (RuntimeException $e) {
    fwrite(STDERR, 'ERROR: endpoint Resend mock did not start: ' . $e->getMessage() . "\n");
    exit(1);
}
$env['RESEND_API_BASE'] = 'http://127.0.0.1:' . $mockServer2['port'];

try {
    $contactServer = jsm_test_start_php_server(['-t', $docroot], $docroot, $env);
} catch (RuntimeException $e) {
    fwrite(STDERR, 'ERROR: contact test server did not start: ' . $e->getMessage() . "\n");
    exit(1);
}
$port = $contactServer['port'];

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


// --- Resend is the only mail transport (C07-11) ---
// Fleet policy: correo solo por Resend. No SMTP code path may remain in api/.
$smtpHits = [];
$apiTree = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/api', FilesystemIterator::SKIP_DOTS));
foreach ($apiTree as $apiFile) {
    // secrets.php is generated at deploy time and gitignored; it is not code.
    if (!$apiFile->isFile() || $apiFile->getExtension() !== 'php' || $apiFile->getFilename() === 'secrets.php') {
        continue;
    }
    if (stripos((string) file_get_contents($apiFile->getPathname()), 'smtp') !== false) {
        $smtpHits[] = substr($apiFile->getPathname(), strlen($root) + 1);
    }
}
check('api/ has no SMTP transport', $smtpHits === [], implode(', ', $smtpHits));
check('api/lib/smtp-mail.php removed', !file_exists($root . '/api/lib/smtp-mail.php'));

/**
 * Start a throwaway php -S for the contact endpoint, post the payload, stop it.
 *
 * @return array{ready: bool, status: int, body: string, log: string}
 */
function jsm_test_post_contact(string $root, string $tmp, array $env, string $payload): array
{
    $env['TMPDIR'] = $tmp;
    try {
        $server = jsm_test_start_php_server(['-t', $root], $root, $env);
    } catch (RuntimeException $e) {
        return ['ready' => false, 'status' => 0, 'body' => '', 'log' => $e->getMessage()];
    }
    $proc = $server['process'];
    $port = $server['port'];
    $err = $server['stderr'];
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
    jsm_test_stop_process($proc);
    return [
        'ready' => true,
        'status' => $status,
        'body' => is_string($body) ? $body : '',
        'log' => (string) file_get_contents($err),
    ];
}

$contactPayload = http_build_query([
    'name' => 'Jorge Salgado',
    'email' => 'jorge@example.com',
    'topic' => 'security',
    'message' => 'Please review the authentication flow for our fleet apps.',
]);

// Resend configured but unreachable: 503, generic body, error logged server-side.
$resendDown = jsm_test_post_contact($root, $contactTmp, [
    'PATH' => getenv('PATH') ?: '/usr/bin',
    'RESEND_API_KEY' => 're_test_key',
    'RESEND_FROM' => 'Jorge <noreply@jorgesalgadomiranda.com>',
    'RESEND_TO' => 'jorgesalgadomiranda@protonmail.com',
    'RESEND_API_BASE' => 'http://127.0.0.1:1',
], $contactPayload);
check('resend down: server started', $resendDown['ready']);
check('resend down: 503', $resendDown['status'] === 503, 'status=' . $resendDown['status']);
$resendDownJson = json_decode($resendDown['body'], true);
check('resend down: generic message', is_array($resendDownJson)
    && ($resendDownJson['success'] ?? true) === false
    && ($resendDownJson['message'] ?? '') === 'Contact service unavailable', substr($resendDown['body'], 0, 160));
check('resend down: no transport detail leaked', stripos($resendDown['body'], '127.0.0.1') === false
    && stripos($resendDown['body'], 'smtp') === false);
check('resend down: error logged', strpos($resendDown['log'], '[jsm-contact]') !== false, substr($resendDown['log'], 0, 200));

// Only SMTP_* configured (the old fallback): must not be used. 503, no SMTP attempt.
$smtpOnly = jsm_test_post_contact($root, $contactTmp, [
    'PATH' => getenv('PATH') ?: '/usr/bin',
    'SMTP_HOST' => 'smtp.example.invalid',
    'SMTP_PORT' => '465',
    'SMTP_USER' => 'user@example.com',
    'SMTP_PASS' => 'secret',
    'SMTP_FROM' => 'user@example.com',
], $contactPayload);
check('smtp only: 503', $smtpOnly['status'] === 503, 'status=' . $smtpOnly['status']);
$smtpOnlyJson = json_decode($smtpOnly['body'], true);
check('smtp only: generic message', is_array($smtpOnlyJson)
    && ($smtpOnlyJson['message'] ?? '') === 'Contact service unavailable');
check('smtp only: error logged', strpos($smtpOnly['log'], '[jsm-contact]') !== false, substr($smtpOnly['log'], 0, 200));

jsm_test_cleanup();

echo $failures === 0 ? "\nAll contact API contract tests passed.\n" : "\n{$failures} failure(s).\n";
exit($failures === 0 ? 0 : 1);
