<?php
/**
 * Optional SMTP fallback when Resend fails or is unavailable.
 * Uses PHP mail() only when SMTP_* is fully configured via Hostinger/env —
 * Hostinger shared hosting routes mail() through the account SMTP path.
 *
 * For explicit SMTP AUTH over TLS we speak a minimal SMTP client over
 * stream_socket_client (no PHPMailer dependency on this static site).
 */
if (!defined('JSM_CONTACT_PROXY')) {
    http_response_code(403);
    exit('Forbidden');
}

/**
 * @return array{host: string, port: int, user: string, pass: string, from: string, tls: bool}|null
 */
function jsm_smtp_config_from_env(): ?array
{
    $host = jsm_env('SMTP_HOST');
    $user = jsm_env('SMTP_USER');
    $pass = jsm_env('SMTP_PASS');
    $from = jsm_env('SMTP_FROM');
    if ($from === '') {
        $from = $user;
    }
    $portRaw = jsm_env('SMTP_PORT', '465');
    $port = (int) $portRaw;
    if ($host === '' || $user === '' || $pass === '' || $from === '' || $port <= 0) {
        return null;
    }

    $tls = jsm_env('SMTP_TLS', 'true');
    $useTls = !in_array(strtolower($tls), ['0', 'false', 'no', 'off'], true);

    return [
        'host' => $host,
        'port' => $port,
        'user' => $user,
        'pass' => $pass,
        'from' => $from,
        'tls' => $useTls,
    ];
}

/**
 * @param array{host: string, port: int, user: string, pass: string, from: string, tls: bool} $config
 * @return array{ok: bool, status: int, body: string, decoded: null, provider: string}
 */
function jsm_smtp_send_html(array $config, string $to, string $subject, string $html, string $replyTo = ''): array
{
    $to = trim($to);
    $subject = trim($subject);
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'status' => 400, 'body' => 'invalid recipient', 'decoded' => null, 'provider' => 'smtp'];
    }
    if ($subject === '' || $html === '') {
        return ['ok' => false, 'status' => 400, 'body' => 'missing subject or html', 'decoded' => null, 'provider' => 'smtp'];
    }

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . $config['from'],
        'To: ' . $to,
        'Subject: ' . $encodedSubject,
    ];
    if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'Reply-To: ' . $replyTo;
    }

    $message = implode("\r\n", $headers) . "\r\n\r\n" . $html;

    $remote = ($config['tls'] && $config['port'] === 465 ? 'ssl://' : '') . $config['host'] . ':' . $config['port'];
    $errno = 0;
    $errstr = '';
    $socket = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if ($socket === false) {
        return ['ok' => false, 'status' => 502, 'body' => "smtp connect failed: {$errstr}", 'decoded' => null, 'provider' => 'smtp'];
    }
    stream_set_timeout($socket, 15);

    $fail = static function (string $body) use (&$socket): array {
        if (is_resource($socket)) {
            fclose($socket);
            $socket = null;
        }
        return ['ok' => false, 'status' => 502, 'body' => $body, 'decoded' => null, 'provider' => 'smtp'];
    };

    $read = static function () use (&$socket): string {
        $data = '';
        while (($line = fgets($socket, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $write = static function (string $cmd) use (&$socket): void {
        fwrite($socket, $cmd . "\r\n");
    };

    $banner = $read();
    if (strpos($banner, '220') !== 0) {
        return $fail('unexpected SMTP banner: ' . $banner);
    }

    $write('EHLO jorgesalgadomiranda.com');
    $ehlo = $read();
    if (strpos($ehlo, '250') !== 0) {
        return $fail('unexpected EHLO: ' . $ehlo);
    }

    if ($config['tls'] && $config['port'] === 587) {
        $write('STARTTLS');
        $tlsReply = $read();
        if (strpos($tlsReply, '220') !== 0) {
            return $fail('unexpected STARTTLS: ' . $tlsReply);
        }
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            return $fail('STARTTLS crypto failed');
        }
        $write('EHLO jorgesalgadomiranda.com');
        $ehlo2 = $read();
        if (strpos($ehlo2, '250') !== 0) {
            return $fail('unexpected post-TLS EHLO: ' . $ehlo2);
        }
    }

    $write('AUTH LOGIN');
    if (strpos($read(), '334') !== 0) {
        return $fail('AUTH LOGIN rejected');
    }
    $write(base64_encode($config['user']));
    if (strpos($read(), '334') !== 0) {
        return $fail('SMTP username rejected');
    }
    $write(base64_encode($config['pass']));
    if (strpos($read(), '235') !== 0) {
        return $fail('SMTP password rejected');
    }

    $fromEmail = $config['from'];
    if (preg_match('/<([^>]+)>/', $config['from'], $m)) {
        $fromEmail = $m[1];
    }
    $write('MAIL FROM:<' . $fromEmail . '>');
    if (strpos($read(), '250') !== 0) {
        return $fail('MAIL FROM rejected');
    }
    $write('RCPT TO:<' . $to . '>');
    if (strpos($read(), '250') !== 0) {
        return $fail('RCPT TO rejected');
    }
    $write('DATA');
    if (strpos($read(), '354') !== 0) {
        return $fail('DATA rejected');
    }

    $safeBody = preg_replace('/^\./m', '..', $message) ?? $message;
    fwrite($socket, $safeBody . "\r\n.\r\n");
    if (strpos($read(), '250') !== 0) {
        return $fail('message not accepted');
    }

    $write('QUIT');
    fclose($socket);

    return ['ok' => true, 'status' => 200, 'body' => 'smtp queued', 'decoded' => null, 'provider' => 'smtp'];
}
