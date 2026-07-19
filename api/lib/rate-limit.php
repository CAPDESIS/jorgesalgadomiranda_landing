<?php
/**
 * Simple per-IP rate limiter for the contact endpoint.
 * File-backed (sys_get_temp_dir) with flock() for atomicity; fails closed.
 */
if (!defined('JSM_CONTACT_PROXY')) {
    http_response_code(403);
    exit('Forbidden');
}

/**
 * @param string $ip Client IP (REMOTE_ADDR)
 * @param int $maxHits Maximum allowed requests per window
 * @param int $windowSeconds Window length in seconds
 * @return bool True when the request is within the limit
 */
function jsm_contact_rate_limit_allow($ip, $maxHits = 5, $windowSeconds = 3600)
{
    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'jsm-contact-rate-limit';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        error_log('[jsm-contact] rate limit: cannot create dir ' . $dir);
        return false;
    }

    $key = preg_replace('/[^A-Za-z0-9._-]/', '_', (string) $ip);
    $path = $dir . DIRECTORY_SEPARATOR . $key . '.lock';

    $handle = @fopen($path, 'c+');
    if ($handle === false) {
        error_log('[jsm-contact] rate limit: cannot open ' . $path);
        return false;
    }
    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        error_log('[jsm-contact] rate limit: cannot lock ' . $path);
        return false;
    }

    $now = time();
    $hits = [];
    $raw = stream_get_contents($handle);
    if (is_string($raw)) {
        foreach (explode("\n", trim($raw)) as $line) {
            $ts = (int) $line;
            if ($ts > 0 && $ts > $now - $windowSeconds) {
                $hits[] = $ts;
            }
        }
    }

    $allowed = count($hits) < $maxHits;
    if ($allowed) {
        $hits[] = $now;
    }

    rewind($handle);
    ftruncate($handle, 0);
    if ($hits !== []) {
        fwrite($handle, implode("\n", $hits) . "\n");
        fflush($handle);
    }
    flock($handle, LOCK_UN);
    fclose($handle);

    return $allowed;
}
