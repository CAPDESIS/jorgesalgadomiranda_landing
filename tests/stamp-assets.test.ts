import { afterEach, describe, expect, test } from 'bun:test';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// The site sits behind Cloudflare and the Hostinger origin ignores the query,
// so the first copy fetched for a ?v= URL stays cached for its TTL
// (.htaccess: 7 days for css and js). A local css or js reference that goes out
// without a token keeps old bytes in caches. Both deploy paths (the official
// workflow and the scripts/deploy.sh recovery path) must stamp every local css
// and js reference in every page through the one shared script.

const ROOT = join(import.meta.dir, '..');
const STAMP = join(ROOT, 'scripts', 'stamp-assets.py');
const SHA = '0123456789abcdef0123456789abcdef01234567';
const TOKEN = SHA.slice(0, 7);
const OTHER_SHA = 'fedcba9876543210fedcba9876543210fedcba98';
const OTHER_TOKEN = OTHER_SHA.slice(0, 7);

let scratchDirs: string[] = [];
afterEach(() => {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  scratchDirs = [];
});

function scratch(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `jsm-stamp-${label}-`));
  scratchDirs.push(dir);
  return dir;
}

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
}

function read(root: string, rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

function stamp(root: string, sha: string = SHA): { code: number | null; out: string; err: string } {
  const proc = Bun.spawnSync(['python3', STAMP, '--root', root, '--sha', sha], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() };
}

function mustStamp(root: string, sha: string = SHA): string {
  const result = stamp(root, sha);
  if (result.code !== 0) {
    throw new Error(`stamp-assets.py exited ${result.code}: ${result.err}${result.out}`);
  }
  return result.out;
}

// Independent oracle, deliberately not a port of the script: a plain regex over
// href/src attributes. Anything it reports is a local css or js reference that
// would go out without this release's token.
const ATTR = /(?<![\w:.-])(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|(?!["'])([^\s>]+))/gi;

function localStylesheetAndScriptRefs(html: string): string[] {
  const refs: string[] = [];
  for (const match of html.matchAll(ATTR)) {
    const url = match[1] ?? match[2] ?? match[3] ?? '';
    const own = /^https:\/\/(www\.)?jorgesalgadomiranda\.com\//.test(url);
    const external = url.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(url);
    if (external && !own) continue;
    const path = url.split('#')[0].split('?')[0];
    if (/\.(css|m?js)$/i.test(path)) refs.push(url);
  }
  return refs;
}

function withoutToken(url: string, token: string): boolean {
  const query = url.split('#')[0].split('?')[1] ?? '';
  return !query.split('&').includes(`v=${token}`);
}

function unstamped(root: string, pages: string[], token: string = TOKEN): string[] {
  const missing: string[] = [];
  for (const page of pages) {
    for (const url of localStylesheetAndScriptRefs(read(root, page))) {
      if (withoutToken(url, token)) missing.push(`${page}: ${url}`);
    }
  }
  return missing;
}

describe('stamp-assets.py on a fixture tree', () => {
  const SITE: Record<string, string> = {
    'index.html': [
      '<!doctype html>',
      '<html lang="en"><head>',
      '<script src="assets/js/consent.js"></script>',
      '<link rel="preload" href="fonts/geist.woff2" as="font" type="font/woff2" crossorigin>',
      '<link rel="stylesheet" href="assets/styles.css">',
      '<link rel="stylesheet" href="https://fonts.example.com/css?family=x">',
      '<script defer src="https://stats.example.com/script.js"></script>',
      '<script async src="//static.example.com/beacon.min.js"></script>',
      '</head><body>',
      '<script src="assets/i18n.js"></script>',
      "<script src='assets/js/i18n-utils.js'></script>",
      '<script src=assets/js/welcome-modal.js></script>',
      '<script type="module" src="assets/js/email-validation.js"></script>',
      '<script src="assets/js/cookie-banner.js"></script>',
      '<img src="assets/images/foto_perfil.png"><a href="legal/privacy.html">Privacy</a>',
      '</body></html>',
      '',
    ].join('\n'),
    '404.html': '<link rel="stylesheet" href="/assets/styles.css">\n',
    'legal/privacy.html': '<link rel="stylesheet" href="/assets/styles.css">\n',
    'legal/terms.html': '<link rel="stylesheet" href="/assets/styles.css">\n',
    'legal/cookies.html': '<link rel="stylesheet" href="/assets/styles.css">\n',
    'cv/Jorge_Salgado_Miranda_CV_EN.html': '<style>body { margin: 0 }</style>\n',
  };
  const PAGES = Object.keys(SITE);

  test('stamps every local css and js reference in every page', () => {
    const root = scratch('site');
    writeTree(root, SITE);
    const out = mustStamp(root);
    expect(unstamped(root, PAGES)).toEqual([]);
    // Spot checks that do not depend on the oracle: quoted, single-quoted,
    // unquoted, module and root-absolute forms are all rewritten.
    const index = read(root, 'index.html');
    expect(index).toContain(`href="assets/styles.css?v=${TOKEN}"`);
    expect(index).toContain(`src='assets/js/i18n-utils.js?v=${TOKEN}'`);
    expect(index).toContain(`src=assets/js/welcome-modal.js?v=${TOKEN}>`);
    expect(index).toContain(`type="module" src="assets/js/email-validation.js?v=${TOKEN}"`);
    for (const page of ['404.html', 'legal/privacy.html', 'legal/terms.html', 'legal/cookies.html']) {
      expect(read(root, page)).toContain(`href="/assets/styles.css?v=${TOKEN}"`);
    }
    // 7 references in index.html + 1 in each of 4 stylesheet-only pages.
    expect(out).toContain('11 reference(s) in 5 page(s)');
  });

  test('changes nothing except the token on local css and js references', () => {
    const root = scratch('bytes');
    writeTree(root, SITE);
    mustStamp(root);
    for (const page of PAGES) {
      expect(read(root, page).replaceAll(`?v=${TOKEN}`, '')).toBe(SITE[page]);
    }
    const index = read(root, 'index.html');
    expect(index).toContain('href="https://fonts.example.com/css?family=x"');
    expect(index).toContain('src="https://stats.example.com/script.js"');
    expect(index).toContain('src="//static.example.com/beacon.min.js"');
    expect(index).toContain('href="fonts/geist.woff2"');
    expect(index).toContain('src="assets/images/foto_perfil.png"');
    expect(index).toContain('href="legal/privacy.html"');
  });

  test('does not stamp references that are not tags: comments and script strings', () => {
    const root = scratch('inert');
    const page = [
      '<link rel="stylesheet" href="assets/styles.css">',
      '<!-- <script src="assets/js/commented-out.js"></script> -->',
      '<script>',
      "  const t = '<script src=\"assets/js/in-a-string.js\"><\\/script>';",
      '  // href="assets/in-a-comment.css"',
      '</script>',
      '',
    ].join('\n');
    writeTree(root, { 'index.html': page });
    mustStamp(root);
    const stamped = read(root, 'index.html');
    expect(stamped).toContain(`href="assets/styles.css?v=${TOKEN}"`);
    expect(stamped).toContain('<script src="assets/js/commented-out.js"></script>');
    expect(stamped).toContain('<script src="assets/js/in-a-string.js"><\\/script>');
    expect(stamped).toContain('href="assets/in-a-comment.css"');
    expect(stamped.replaceAll(`?v=${TOKEN}`, '')).toBe(page);
  });

  test('leaves pages the deploy excludes untouched', () => {
    const root = scratch('excluded');
    const bare = '<script src="assets/js/consent.js"></script>\n';
    const excluded = [
      'docs/guide.html',
      'tests/fixture.html',
      'scripts/tool.html',
      'audits/report.html',
      'node_modules/pkg/index.html',
      'coverage/index.html',
      '.github/page.html',
      '.remember/page.html',
    ];
    writeTree(root, {
      'index.html': '<link rel="stylesheet" href="assets/styles.css">\n',
      ...Object.fromEntries(excluded.map((rel) => [rel, bare])),
    });
    mustStamp(root);
    for (const rel of excluded) {
      expect(read(root, rel)).toBe(bare);
    }
  });

  test('re-stamping replaces the old token instead of stacking a second one', () => {
    const root = scratch('restamp');
    writeTree(root, SITE);
    mustStamp(root, SHA);
    mustStamp(root, OTHER_SHA);
    expect(unstamped(root, PAGES, OTHER_TOKEN)).toEqual([]);
    for (const page of PAGES) {
      expect(read(root, page)).not.toContain(`v=${TOKEN}`);
      expect(read(root, page)).not.toMatch(/\?v=[0-9a-f]{7}[^"'\s>]*\?v=/);
    }
    const once = read(root, 'index.html');
    mustStamp(root, OTHER_SHA);
    expect(read(root, 'index.html')).toBe(once);
  });

  test('keeps other query parameters and the fragment', () => {
    const root = scratch('query');
    writeTree(root, {
      'index.html': [
        '<script src="assets/js/a.js?foo=1#frag"></script>',
        '<link rel="stylesheet" href="assets/styles.css?v=deadbee">',
        '<link rel="stylesheet" href="assets/b.css?x=1&amp;v=deadbee&amp;y=2">',
        '',
      ].join('\n'),
    });
    mustStamp(root);
    const stamped = read(root, 'index.html');
    expect(stamped).toContain(`src="assets/js/a.js?foo=1&v=${TOKEN}#frag"`);
    expect(stamped).toContain(`href="assets/styles.css?v=${TOKEN}"`);
    expect(stamped).toContain(`href="assets/b.css?x=1&y=2&v=${TOKEN}"`);
    expect(stamped).not.toContain('deadbee');
  });

  test('stamps absolute references to this site and skips other origins', () => {
    const root = scratch('origin');
    writeTree(root, {
      'index.html': [
        '<link rel="stylesheet" href="https://jorgesalgadomiranda.com/assets/styles.css">',
        '<link rel="stylesheet" href="https://www.jorgesalgadomiranda.com/assets/b.css">',
        '<link rel="stylesheet" href="https://example.com/assets/c.css">',
        '<script src="javascript:void(0)"></script>',
        '',
      ].join('\n'),
    });
    mustStamp(root);
    const stamped = read(root, 'index.html');
    expect(stamped).toContain(`https://jorgesalgadomiranda.com/assets/styles.css?v=${TOKEN}`);
    expect(stamped).toContain(`https://www.jorgesalgadomiranda.com/assets/b.css?v=${TOKEN}`);
    expect(stamped).toContain('href="https://example.com/assets/c.css"');
    expect(stamped).toContain('src="javascript:void(0)"');
  });

  test('keeps CRLF line endings byte for byte', () => {
    const root = scratch('crlf');
    const page = '<link rel="stylesheet" href="assets/styles.css">\r\n<p>\r\n</p>\r\n<script src="assets/i18n.js"></script>\r\n';
    writeTree(root, { 'index.html': page });
    mustStamp(root);
    const stamped = read(root, 'index.html');
    expect(stamped.replaceAll('\r\n', '')).not.toContain('\n');
    expect(stamped.replaceAll(`?v=${TOKEN}`, '')).toBe(page);
    expect(unstamped(root, ['index.html'])).toEqual([]);
  });

  test('refuses a SHA that is not 40 hex characters and writes nothing', () => {
    for (const bad of ['', 'abc1234', SHA.slice(0, 39), `${SHA}0`, 'z'.repeat(40)]) {
      const root = scratch('badsha');
      writeTree(root, SITE);
      const result = stamp(root, bad);
      expect(result.code).toBe(1);
      expect(result.err).toContain('40');
      for (const page of PAGES) {
        expect(read(root, page)).toBe(SITE[page]);
      }
    }
  });

  test('fails closed when the tree has no stamped reference at all', () => {
    const root = scratch('empty');
    writeTree(root, { 'cv/Jorge_Salgado_Miranda_CV_EN.html': SITE['cv/Jorge_Salgado_Miranda_CV_EN.html'] });
    const result = stamp(root);
    expect(result.code).toBe(1);
    expect(result.err).toContain('no local');
  });

  test('fails closed when the root is not a directory', () => {
    const result = stamp(join(scratch('missing'), 'nope'));
    expect(result.code).toBe(1);
    expect(result.err).toContain('not a directory');
  });

  test('writes no page at all when one page cannot be read', () => {
    const root = scratch('atomic');
    writeTree(root, SITE);
    writeFileSync(join(root, 'legal', 'broken.html'), Buffer.from([0xff, 0xfe, 0x3c, 0x70, 0x3e]));
    const result = stamp(root);
    expect(result.code).toBe(1);
    expect(result.err).toContain('broken.html');
    for (const page of PAGES) {
      expect(read(root, page)).toBe(SITE[page]);
    }
  });
});

// The pages the site really ships, listed by git so a new page is covered
// without anyone editing this file. Not-deployed directories are left out the
// same way the upload excludes them.
const NOT_DEPLOYED = new Set(['docs', 'tests', 'scripts', 'audits', 'node_modules', 'coverage']);

function shippedPages(): string[] {
  const proc = Bun.spawnSync(['git', '-C', ROOT, 'ls-files', '*.html'], { stdout: 'pipe', stderr: 'pipe' });
  const pages = proc.stdout
    .toString()
    .split('\n')
    .filter(Boolean)
    .filter((rel) => !NOT_DEPLOYED.has(rel.split('/')[0]));
  expect(pages).toContain('index.html');
  return pages;
}

function copyPages(to: string): string[] {
  const pages = shippedPages();
  for (const rel of pages) {
    mkdirSync(dirname(join(to, rel)), { recursive: true });
    cpSync(join(ROOT, rel), join(to, rel));
  }
  return pages;
}

describe('stamp-assets.py on the pages this repo ships', () => {
  const REQUIRED: Record<string, string[]> = {
    'index.html': [
      'assets/styles.css',
      'assets/i18n.js',
      'assets/js/consent.js',
      'assets/js/i18n-utils.js',
      'assets/js/welcome-modal.js',
      'assets/js/email-validation.js',
      'assets/js/cookie-banner.js',
    ],
    '404.html': ['/assets/styles.css'],
    'legal/privacy.html': ['/assets/styles.css'],
    'legal/terms.html': ['/assets/styles.css'],
    'legal/cookies.html': ['/assets/styles.css'],
  };

  test('the references this test pins exist in the repo', () => {
    for (const [page, refs] of Object.entries(REQUIRED)) {
      expect(existsSync(join(ROOT, page))).toBe(true);
      for (const ref of refs) {
        expect(existsSync(join(ROOT, ref.replace(/^\//, '')))).toBe(true);
        expect(read(ROOT, page)).toContain(`"${ref}"`);
      }
    }
  });

  test('every local css and js reference in every shipped page carries the token', () => {
    const root = scratch('real');
    const pages = copyPages(root);
    mustStamp(root);
    expect(unstamped(root, pages)).toEqual([]);
    for (const [page, refs] of Object.entries(REQUIRED)) {
      const stamped = read(root, page);
      for (const ref of refs) {
        expect(stamped).toContain(`"${ref}?v=${TOKEN}"`);
      }
    }
  });
});

// Both deploy paths, run for real against a throwaway git release. This is what
// proves they share the stamping: the recovery path used to stamp only the index
// stylesheet and i18n.js, and the workflow listed its files by hand and missed
// legal/cookies.html.
const GIT_ENV = {
  PATH: process.env.PATH ?? '',
  HOME: process.env.HOME ?? '',
  TMPDIR: process.env.TMPDIR ?? tmpdir(),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
};

function git(cwd: string, args: string[]): string {
  const proc = Bun.spawnSync(['git', ...args], { cwd, env: GIT_ENV, stdout: 'pipe', stderr: 'pipe' });
  if (proc.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${proc.stderr.toString()}`);
  }
  return proc.stdout.toString().trim();
}

function makeRelease(): { work: string; sha: string; pages: string[] } {
  const base = scratch('release');
  const origin = join(base, 'origin.git');
  const work = join(base, 'work');
  git(base, ['init', '-q', '--bare', '-b', 'main', origin]);
  mkdirSync(work);
  const pages = copyPages(work);
  // Copied only when present, so the same test can run against a tree that
  // does not have the shared script yet and fail on the real behaviour.
  for (const rel of ['scripts/deploy.sh', 'scripts/write-version-json.py', 'scripts/stamp-assets.py']) {
    if (existsSync(join(ROOT, rel))) {
      mkdirSync(dirname(join(work, rel)), { recursive: true });
      cpSync(join(ROOT, rel), join(work, rel));
    }
  }
  git(work, ['init', '-q', '-b', 'main']);
  git(work, ['add', '-A']);
  git(work, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-q', '-m', 'release fixture']);
  git(work, ['remote', 'add', 'origin', origin]);
  git(work, ['push', '-q', 'origin', 'main']);
  return { work, sha: git(work, ['rev-parse', 'HEAD']), pages };
}

// Stands in for lftp: records the tree deploy.sh would mirror to the server.
const FAKE_LFTP = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  'script="$(cat)"',
  `dir="$(printf '%s\\n' "$script" | sed -n 's/^lcd "\\(.*\\)"$/\\1/p' | head -n 1)"`,
  'test -n "$dir" && test -d "$dir"',
  'cp -R "$dir/." "$CAPTURE_DIR/"',
  '',
].join('\n');

function extractRun(workflowRel: string, stepName: string): string {
  const lines = read(ROOT, workflowRel).split('\n');
  const start = lines.findIndex((line) => line.trim() === `- name: ${stepName}`);
  expect(start).toBeGreaterThan(-1);
  const runAt = lines.findIndex((line, i) => i > start && line.trim() === 'run: |');
  expect(runAt).toBeGreaterThan(start);
  const indent = lines[runAt].length - lines[runAt].trimStart().length + 2;
  const body: string[] = [];
  for (let i = runAt + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') {
      body.push('');
      continue;
    }
    if (line.length - line.trimStart().length < indent) break;
    body.push(line.slice(indent));
  }
  return body.join('\n');
}

describe('both deploy paths stamp through the shared script', () => {
  test('scripts/deploy.sh uploads a tree where every local css and js reference carries the token', () => {
    const { work, sha, pages } = makeRelease();
    const bin = scratch('bin');
    writeFileSync(join(bin, 'lftp'), FAKE_LFTP);
    chmodSync(join(bin, 'lftp'), 0o755);
    const captured = scratch('captured');
    const proc = Bun.spawnSync(['bash', join(work, 'scripts', 'deploy.sh')], {
      cwd: work,
      env: {
        ...GIT_ENV,
        PATH: `${bin}:${GIT_ENV.PATH}`,
        RELEASE_SHA: sha,
        FTP_HOST: 'ftp.invalid',
        FTP_USER: 'fixture',
        FTP_PASS: 'fixture',
        FTP_REMOTE_DIR: './',
        CAPTURE_DIR: captured,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode !== 0) {
      throw new Error(`deploy.sh exited ${proc.exitCode}: ${proc.stderr.toString()}`);
    }
    expect(existsSync(join(captured, 'version.json'))).toBe(true);
    expect(unstamped(captured, pages, sha.slice(0, 7))).toEqual([]);
  });

  function runWorkflowStep(work: string, sha: string): void {
    const harness = join(scratch('step'), 'step.sh');
    writeFileSync(harness, extractRun('.github/workflows/deploy.yml', 'Cache-bust asset URLs'));
    const proc = Bun.spawnSync(['bash', '-e', harness], {
      cwd: work,
      env: { ...GIT_ENV, SHA: sha, RUNNER_TEMP: scratch('runner-temp') },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode !== 0) {
      throw new Error(`workflow step exited ${proc.exitCode}: ${proc.stderr.toString()}${proc.stdout.toString()}`);
    }
  }

  test('the deploy.yml cache-bust step stamps every local css and js reference in the release tree', () => {
    const { work, sha, pages } = makeRelease();
    runWorkflowStep(work, sha);
    expect(unstamped(work, pages, sha.slice(0, 7))).toEqual([]);
  });

  test('the deploy.yml step also stamps a rollback release that predates the script', () => {
    // A release older than the script has no scripts/stamp-assets.py of its own.
    // The step must take the script from origin/main, like the deploy gates, or
    // the documented rollback (dispatch an older release_sha) would break.
    const { work, sha, pages } = makeRelease();
    rmSync(join(work, 'scripts', 'stamp-assets.py'), { force: true });
    runWorkflowStep(work, sha);
    expect(unstamped(work, pages, sha.slice(0, 7))).toEqual([]);
  });

  test('neither path keeps its own copy of the stamping', () => {
    // Booleans, not toContain: a failed toContain would print the whole script.
    const deploySh = read(ROOT, 'scripts/deploy.sh');
    expect(deploySh.includes('stamp-assets.py')).toBe(true);
    expect(deploySh.includes("html.replace('href=\"assets/styles.css\"'")).toBe(false);
    expect(deploySh.includes("html.replace('src=\"assets/i18n.js\"'")).toBe(false);

    const step = extractRun('.github/workflows/deploy.yml', 'Cache-bust asset URLs');
    expect(step.includes('stamp-assets.py')).toBe(true);
    expect(step.includes('sed -i')).toBe(false);
  });
});
