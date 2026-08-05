#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_RELEASE_SHA="${RELEASE_SHA-}"
ENV_FTP_HOST="${FTP_HOST-}"
ENV_FTP_USER="${FTP_USER-}"
ENV_FTP_PASS="${FTP_PASS-}"
ENV_FTP_REMOTE_DIR="${FTP_REMOTE_DIR-}"
ENV_UMAMI_WEBSITE_ID="${UMAMI_WEBSITE_ID-}"
ENV_CF_BEACON_TOKEN="${CF_BEACON_TOKEN-}"
ENV_PUBLIC_POSTHOG_KEY="${PUBLIC_POSTHOG_KEY-}"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

[ -n "$ENV_RELEASE_SHA" ] && RELEASE_SHA="$ENV_RELEASE_SHA"
[ -n "$ENV_FTP_HOST" ] && FTP_HOST="$ENV_FTP_HOST"
[ -n "$ENV_FTP_USER" ] && FTP_USER="$ENV_FTP_USER"
[ -n "$ENV_FTP_PASS" ] && FTP_PASS="$ENV_FTP_PASS"
[ -n "$ENV_FTP_REMOTE_DIR" ] && FTP_REMOTE_DIR="$ENV_FTP_REMOTE_DIR"
[ -n "$ENV_UMAMI_WEBSITE_ID" ] && UMAMI_WEBSITE_ID="$ENV_UMAMI_WEBSITE_ID"
[ -n "$ENV_CF_BEACON_TOKEN" ] && CF_BEACON_TOKEN="$ENV_CF_BEACON_TOKEN"
[ -n "$ENV_PUBLIC_POSTHOG_KEY" ] && PUBLIC_POSTHOG_KEY="$ENV_PUBLIC_POSTHOG_KEY"

: "${RELEASE_SHA:?RELEASE_SHA not set. Use RELEASE_SHA=<40-character-main-sha> bun run deploy.}"
: "${FTP_HOST:?FTP_HOST not set. Copy .env.example to .env and fill it in.}"
: "${FTP_USER:?FTP_USER not set}"
FTP_PASS="${FTP_PASS:-${FTP_PASSWORD:-}}"
: "${FTP_PASS:?FTP_PASS not set. Use FTP_PASS in local .env; FTP_PASSWORD is accepted as a compatibility alias.}"
: "${FTP_REMOTE_DIR:=./}"

if ! printf '%s' "$RELEASE_SHA" | grep -Eq '^[0-9a-fA-F]{40}$'; then
  echo "RELEASE_SHA must be the exact 40-character commit SHA approved for production." >&2
  exit 1
fi
RELEASE_SHA="$(printf '%s' "$RELEASE_SHA" | tr '[:upper:]' '[:lower:]')"

case "$FTP_REMOTE_DIR" in
  /public_html|public_html|public_html/)
    echo "FTP_REMOTE_DIR=$FTP_REMOTE_DIR is the old double-nesting value. Use ./ for Hostinger chrooted FTP, or ./public_html/ only for a verified non-chrooted account." >&2
    exit 1
    ;;
esac

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "scripts/deploy.sh must run from a git checkout so RELEASE_SHA can be verified." >&2
  exit 1
fi

git fetch --no-tags origin main:refs/remotes/origin/main
git cat-file -e "$RELEASE_SHA^{commit}"
if ! git merge-base --is-ancestor "$RELEASE_SHA" refs/remotes/origin/main; then
  echo "RELEASE_SHA $RELEASE_SHA is not contained in origin/main." >&2
  exit 1
fi

if ! command -v lftp >/dev/null 2>&1; then
  echo "lftp not installed. brew install lftp" >&2
  exit 1
fi

DEPLOY_SOURCE_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$DEPLOY_SOURCE_DIR"
}
trap cleanup EXIT

git archive "$RELEASE_SHA" | tar -x -C "$DEPLOY_SOURCE_DIR"

python3 - "$DEPLOY_SOURCE_DIR/index.html" "$RELEASE_SHA" <<'PY'
from pathlib import Path
import os
import sys

path = Path(sys.argv[1])
release_sha = sys.argv[2]
short_sha = release_sha[:7]
html = path.read_text(encoding="utf-8")

replacements = {
    "YOUR_UMAMI_WEBSITE_ID": os.environ.get("UMAMI_WEBSITE_ID", ""),
    "YOUR_CF_BEACON_TOKEN": os.environ.get("CF_BEACON_TOKEN", ""),
    "YOUR_POSTHOG_KEY": os.environ.get("PUBLIC_POSTHOG_KEY", ""),
}

for placeholder, value in replacements.items():
    if value:
        html = html.replace(placeholder, value)

html = html.replace('href="assets/styles.css"', f'href="assets/styles.css?v={short_sha}"')
html = html.replace('src="assets/i18n.js"', f'src="assets/i18n.js?v={short_sha}"')

if 'assets/styles.css?v=' not in html or 'assets/i18n.js?v=' not in html:
    print("Asset cache-bust rewrite missed expected CSS/JS references.", file=sys.stderr)
    sys.exit(1)

path.write_text(html, encoding="utf-8")
PY

echo "Uploading $RELEASE_SHA to $FTP_HOST:$FTP_REMOTE_DIR"

LFTP_PASSWORD="$FTP_PASS" lftp --env-password -u "$FTP_USER" "$FTP_HOST" <<EOF
set ssl:verify-certificate yes
set ftp:ssl-force true
lcd "$DEPLOY_SOURCE_DIR"
mirror --reverse \
  --delete \
  --verbose \
  --parallel=4 \
  --exclude-glob .git \
  --exclude-glob .git/ \
  --exclude-glob .github/ \
  --exclude-glob .env \
  --exclude-glob .env.example \
  --exclude-glob .env.local \
  --exclude-glob .gitignore \
  --exclude-glob .gitleaks.toml \
  --exclude-glob .pre-commit-config.yaml \
  --exclude-glob .remember/ \
  --exclude-glob .playwright-mcp/ \
  --exclude-glob .idea/ \
  --exclude-glob .vscode/ \
  --exclude-glob node_modules/ \
  --exclude-glob scripts/ \
  --exclude-glob docs/ \
  --exclude-glob package.json \
  --exclude-glob package-lock.json \
  --exclude-glob bun.lockb \
  --exclude-glob README.md \
  --exclude-glob CLAUDE.md \
  --exclude-glob HANDOFF.md \
  --exclude-glob MASTER_SPEC.md \
  --exclude-glob og.html \
  --exclude-glob verify-*.png \
  --exclude-glob *.log \
  --exclude-glob .DS_Store \
  ./ "$FTP_REMOTE_DIR"
bye
EOF

echo "Done."
