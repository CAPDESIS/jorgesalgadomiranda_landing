#!/usr/bin/env bash
# Contract for the CVE-2026-109618 / CVE-2026-109619 workaround block in
# .htaccess (PHP advisory 2026-10-21).
#
# It extracts the marked block from the real .htaccess (the file the FTPS
# deploy uploads to the Hostinger account root), serves it from an
# Apache + mod_php container with AllowOverride All, and checks, through a
# CI-only probe that never ships, that PHP applies the values to real
# requests:
#   - session.upload_progress.enabled is off, memory_limit is -1 and
#     post_max_size is 1M under SAPI apache2handler;
#   - a 2 MiB multipart body is dropped (post_max_size enforced before the
#     script runs), while a small multipart form still reaches $_POST.
# Without the block every assertion fails (defaults: On, 128M, 8M).
#
# Production runs LiteSpeed, which honours the same php_value/php_flag lines
# inside <IfModule LiteSpeed>; this test exercises the mod_php copy.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
htaccess="${1:-$root/.htaccess}"
image="${PHP_APACHE_IMAGE:-php:8.5.12-apache@sha256:e25ab14ef2cfec3bab9dd66c6cf871691146f428fbd72241b1a2c38fcacf92f5}"
work=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/php-advisory.XXXXXXXX")
chmod 755 "$work"
container="php-advisory-$(basename "$work" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$work/docroot"
sed -n '/^# BEGIN php-advisory-2026-10-21$/,/^# END php-advisory-2026-10-21$/p' "$htaccess" > "$work/docroot/.htaccess"
if ! grep -q '^# END php-advisory-2026-10-21$' "$work/docroot/.htaccess"; then
  echo "PHP-ADVISORY-FAIL: $htaccess has no complete php-advisory-2026-10-21 block" >&2
  exit 1
fi

cat > "$work/docroot/zz-php-advisory-probe.php" <<'PHP'
<?php
header('Content-Type: application/json');
echo json_encode([
    'sapi' => PHP_SAPI,
    'upload_progress' => filter_var(ini_get('session.upload_progress.enabled'), FILTER_VALIDATE_BOOLEAN),
    'memory_limit' => ini_get('memory_limit'),
    'post_max_size' => ini_get('post_max_size'),
    'post_fields' => count($_POST),
]);
PHP
chmod 644 "$work/docroot/.htaccess" "$work/docroot/zz-php-advisory-probe.php"

docker run --detach --name "$container" \
  --label com.capdesis.ephemeral=ci \
  --log-driver=none \
  -v "$work/docroot:/var/www/html:ro" \
  "$image" \
  sh -c "sed -ri 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf && exec apache2-foreground" >/dev/null

# The client runs inside the container (php streams), so the runner needs no
# curl and no published port.
docker exec -i "$container" php -- <<'PHP'
<?php
$url = 'http://127.0.0.1/zz-php-advisory-probe.php';
function call(string $url, ?string $body = null, string $boundary = ''): array {
    $opts = ['http' => ['ignore_errors' => true, 'timeout' => 10]];
    if ($body !== null) {
        $opts['http']['method'] = 'POST';
        $opts['http']['header'] = "Content-Type: multipart/form-data; boundary={$boundary}\r\n";
        $opts['http']['content'] = $body;
    }
    $raw = @file_get_contents($url, false, stream_context_create($opts));
    // With display_errors on, PHP prints the post_max_size startup warning
    // before the probe output, so decode from the probe's JSON object.
    $start = is_string($raw) ? strpos($raw, '{"sapi"') : false;
    $data = $start !== false ? json_decode(substr($raw, $start), true) : null;
    return is_array($data) ? $data : [];
}
function multipart(string $boundary, string $value): string {
    return "--{$boundary}\r\nContent-Disposition: form-data; name=\"message\"\r\n\r\n{$value}\r\n--{$boundary}--\r\n";
}
for ($i = 0; $i < 30; $i++) {
    $state = call($url);
    if ($state !== []) { break; }
    usleep(500000);
}
$fail = [];
if (($state['sapi'] ?? '') !== 'apache2handler') { $fail[] = 'sapi=' . var_export($state['sapi'] ?? null, true); }
if (($state['upload_progress'] ?? true) !== false) { $fail[] = 'session.upload_progress.enabled is on'; }
if (($state['memory_limit'] ?? '') !== '-1') { $fail[] = 'memory_limit=' . var_export($state['memory_limit'] ?? null, true); }
if (($state['post_max_size'] ?? '') !== '1M') { $fail[] = 'post_max_size=' . var_export($state['post_max_size'] ?? null, true); }
$b = 'jsmAdvisoryBoundary';
$big = call($url, multipart($b, str_repeat('a', 2 * 1024 * 1024)), $b);
if (($big['post_fields'] ?? -1) !== 0) { $fail[] = '2 MiB multipart body reached $_POST (post_fields=' . var_export($big['post_fields'] ?? null, true) . ')'; }
$small = call($url, multipart($b, 'hola'), $b);
if (($small['post_fields'] ?? -1) !== 1) { $fail[] = 'small multipart form did not reach $_POST (post_fields=' . var_export($small['post_fields'] ?? null, true) . ')'; }
if ($fail !== []) {
    fwrite(STDERR, "PHP-ADVISORY-FAIL: " . implode('; ', $fail) . "\n");
    exit(1);
}
echo "PHP-ADVISORY-PASS sapi={$state['sapi']} php=" . PHP_VERSION . " memory_limit={$state['memory_limit']} post_max_size={$state['post_max_size']} upload_progress=off big_post_dropped small_post_ok\n";
PHP
