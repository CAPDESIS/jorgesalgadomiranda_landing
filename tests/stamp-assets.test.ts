import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  cleanupScratch,
  extractRun,
  GIT_ENV,
  makeRelease,
  mustDeploy,
  read,
  ROOT,
  scratch,
  shippedPages,
  writeTree,
} from './support/release';

// The site sits behind Cloudflare and the Hostinger origin ignores the query,
// so the first copy fetched for a ?v= URL stays cached for its TTL
// (.htaccess: 7 days for css and js). A local css or js reference that goes out
// without a token keeps old bytes in caches. Both deploy paths (the official
// workflow and the scripts/deploy.sh recovery path) must stamp every local css
// and js reference in every page through the one shared script.

const STAMP = join(ROOT, 'scripts', 'stamp-assets.py');
const SHA = '0123456789abcdef0123456789abcdef01234567';
const TOKEN = SHA.slice(0, 7);
const OTHER_SHA = 'fedcba9876543210fedcba9876543210fedcba98';
const OTHER_TOKEN = OTHER_SHA.slice(0, 7);

afterEach(cleanupScratch);

// Several tests here build a throwaway git release and run the real deploy.sh or
// workflow step, which takes a second or two and several times that on a busy
// machine. The 5 s default turned one slow second into a failure, not a finding.
setDefaultTimeout(60_000);

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

// Both deploy paths, run for real against a throwaway git release (see
// tests/support/release.ts). This is what proves they share the stamping: the
// recovery path used to stamp only the index stylesheet and i18n.js, and the
// workflow listed its files by hand and missed legal/cookies.html.
describe('both deploy paths stamp through the shared script', () => {
  test('scripts/deploy.sh uploads a tree where every local css and js reference carries the token', () => {
    const release = makeRelease();
    const { captured } = mustDeploy(release);
    expect(existsSync(join(captured, 'version.json'))).toBe(true);
    // og.html is not uploaded (the exclude list drops it), so only judge the
    // pages that really go out, and insist the ones that matter are among them.
    const uploaded = release.pages.filter((page) => existsSync(join(captured, page)));
    for (const page of ['index.html', '404.html', 'legal/privacy.html', 'legal/terms.html', 'legal/cookies.html']) {
      expect(uploaded).toContain(page);
    }
    expect(unstamped(captured, uploaded, release.sha.slice(0, 7))).toEqual([]);
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
