import { afterAll, describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('package scripts for a static Hostinger site', () => {
  const pkg = JSON.parse(read('package.json')) as {
    scripts?: Record<string, string>;
  };

  test('lint and build run the static validator, not a stub echo', () => {
    expect(pkg.scripts?.lint || '').toContain('validate-static-site.py');
    expect(pkg.scripts?.build || '').toContain('validate-static-site.py');
    expect(pkg.scripts?.build || '').not.toContain('no build step required');
  });

  test('test remains bun test', () => {
    expect(pkg.scripts?.test || '').toContain('bun test');
  });
});

describe('GitHub Actions Node 24', () => {
  const dir = join(ROOT, '.github/workflows');
  const files = readdirSync(dir).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));

  test('there is at least one workflow', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    test(`${file} forces JS actions onto Node 24`, () => {
      const src = read(join('.github/workflows', file));
      expect(src).toContain('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true');
    });
  }
});

describe('contact proxy and analytics contract', () => {
  test('example contact config is tracked; live php file is gitignored', () => {
    const ignore = read('.gitignore');
    expect(ignore).toContain('api/secrets.php');
    expect(read('api/secrets.example.php')).toContain('re_xxxxxxxx');
  });

  test('index.html posts to the same-origin contact proxy, not Web3Forms', () => {
    const index = read('index.html');
    expect(index).toContain('/api/contact.php');
    expect(index.toLowerCase().includes('web3forms')).toBe(false);
    expect(index.includes('YOUR_WEB3FORMS')).toBe(false);
    expect(index.includes('name="access_key"')).toBe(false);
  });

  test('static validator matches the Resend proxy, not Web3Forms', () => {
    const src = read('scripts/validate-static-site.py');
    expect(src).toContain('must not reference Web3Forms');
    expect(src.includes('must keep the Web3Forms placeholder')).toBe(false);
    expect(src).toContain('/api/contact.php');
    expect(src).toContain('legal/privacy.html');
    expect(src).toContain('assets/styles.css');
  });

  test('index does not invent a fourth analytics vendor beyond umami, cloudflare, posthog', () => {
    const index = read('index.html');
    expect(index.includes('googletagmanager')).toBe(false);
    expect(index.includes('gtag(')).toBe(false);
    expect(index.includes('plausible.io')).toBe(false);
    expect(index.includes('analytics.google.com')).toBe(false);
  });

  test('deploy exclude list keeps audits markdown off Hostinger', () => {
    const src = read('.github/workflows/deploy.yml');
    expect(src).toContain('**/audits/**');
  });
});

describe('fleet runner policy for a public repository', () => {
  const dir = '.github/workflows';
  const GITHUB_HOSTED = /runs-on:\s*['"]?(ubuntu|macos|windows|blacksmith)-/;

  function runsOnLines(src: string): string[] {
    return src
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .filter((line) => line.includes('runs-on:'));
  }

  test('deploy.yml stays on the self-hosted deploy lane', () => {
    const lines = runsOnLines(read(join(dir, 'deploy.yml')));
    expect(lines.length).toBe(1);
    expect(GITHUB_HOSTED.test(lines[0])).toBe(false);
    expect(lines[0]).toContain('self-hosted');
    expect(lines[0]).toContain('deploy-only');
  });

  test('deploy.yml carries public-only so a real runner serves it', () => {
    // Runner group "deploys" has allows_public_repositories=false, so the
    // deploy-only runner in that group can never pick up this public repo.
    // Only ci-runner-node-public-deploy-1, in group "public-builds", serves
    // it, and that runner is reached through the public-only label. Without
    // this label the deploy job queues forever instead of failing loudly.
    const lines = runsOnLines(read(join(dir, 'deploy.yml')));
    expect(lines[0]).toContain('public-only');
  });

  test('every self-hosted label set in this repo names a runner that exists', () => {
    // A label set is only schedulable if ONE online runner carries EVERY
    // label. These are the label sets of the runners in group public-builds,
    // the only group that accepts this public repository.
    const servedBy = [
      ['self-hosted', 'Linux', 'X64', 'deploy-only', 'public-only', 'ci-runner-node'],
      ['self-hosted', 'Linux', 'X64', 'test-light', 'public-only', 'ci-runner-node', 'capmenu-php-fast'],
    ];
    const files = readdirSync(join(ROOT, dir)).filter((n) => n.endsWith('.yml') || n.endsWith('.yaml'));

    for (const file of files) {
      for (const line of runsOnLines(read(join(dir, file)))) {
        if (!line.includes('self-hosted')) continue;
        const wanted = (line.match(/\[([^\]]*)\]/)?.[1] ?? '')
          .split(',')
          .map((label) => label.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
        expect(wanted.length).toBeGreaterThan(0);
        const served = servedBy.some((labels) => wanted.every((label) => labels.includes(label)));
        if (!served) {
          throw new Error(`${file}: no runner carries every label of [${wanted.join(', ')}]`);
        }
        expect(served).toBe(true);
      }
    }
  });

  test('CI workflows use GitHub hosted runners, which is the public repo policy', () => {
    for (const file of ['ci.yml', 'gitleaks.yml', 'test.yml']) {
      const lines = runsOnLines(read(join(dir, file)));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(GITHUB_HOSTED.test(line)).toBe(true);
      }
    }
  });

  test('the coverage gate runs on main, not only on pull requests', () => {
    const src = read(join(dir, 'test.yml'));
    const triggers = src.slice(0, src.indexOf('concurrency:'));
    expect(triggers).toContain('push:');
    expect(triggers).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
  });

  test('the release policy audit is enforcing, not advisory', () => {
    const src = read(join(dir, 'release-policy.yml'));
    expect(src).toMatch(/ENFORCE:\s*'true'/);
  });
});

describe('release policy audit matcher survives an early grep exit', () => {
  // Regression for run 35266096868: workflow_has piped sed into "grep -Eiq".
  // grep exits at the first match, sed then dies of SIGPIPE writing the rest
  // of the file, and under "set -o pipefail" the pipeline reports 141, so a
  // real match read as no match. The audit then claimed deploy.yml omitted
  // public-only when the label was right there on the runs-on line. This test
  // runs the function exactly as the workflow ships it.
  const SRC = read('.github/workflows/release-policy.yml');

  function extractWorkflowHas(): string {
    const lines = SRC.split('\n');
    const start = lines.findIndex((line) => line.trim().startsWith('workflow_has()'));
    expect(start).toBeGreaterThan(-1);
    const indent = lines[start].length - lines[start].trimStart().length;
    const end = lines.findIndex((line, i) => i > start && line === `${' '.repeat(indent)}}`);
    expect(end).toBeGreaterThan(start);
    return lines
      .slice(start, end + 1)
      .map((line) => line.slice(indent))
      .join('\n');
  }

  function runMatcher(fixture: string, pattern: string): { code: number; out: string } {
    const harness = join(tmpdir(), `workflow-has-${Date.now()}-${Math.random()}.sh`);
    writeFileSync(
      harness,
      ['set -euo pipefail', extractWorkflowHas(), `if workflow_has "$1" "$2"; then echo MATCH; else echo NOMATCH; fi`].join(
        '\n',
      ),
      'utf8',
    );
    try {
      const proc = Bun.spawnSync(['bash', harness, fixture, pattern]);
      return { code: proc.exitCode ?? 1, out: proc.stdout.toString().trim() };
    } finally {
      rmSync(harness, { force: true });
    }
  }

  const fixture = join(tmpdir(), `release-policy-fixture-${Date.now()}.yml`);

  afterAll(() => {
    rmSync(fixture, { force: true });
  });

  test('a match on the first line of a large file still reports a match', () => {
    // The match must sit far ahead of the end of the file so grep exits long
    // before sed is done. A short fixture passes even with the broken pipe.
    writeFileSync(fixture, `    runs-on: [self-hosted, deploy-only, public-only]\n${'a: 1\n'.repeat(200000)}`, 'utf8');
    const result = runMatcher(fixture, 'public-only');
    expect(result.out).toBe('MATCH');
    expect(result.code).toBe(0);
  });

  test('a genuine absence still reports no match', () => {
    writeFileSync(fixture, `    runs-on: [self-hosted, deploy-only]\n${'a: 1\n'.repeat(200000)}`, 'utf8');
    expect(runMatcher(fixture, 'public-only').out).toBe('NOMATCH');
  });

  test('a term that appears only inside a comment does not match', () => {
    writeFileSync(fixture, '# this note mentions production\njobs:\n  build:\n    runs-on: ubuntu-latest\n', 'utf8');
    expect(runMatcher(fixture, 'production').out).toBe('NOMATCH');
  });

  test('a term on a real line still matches when a comment follows it', () => {
    writeFileSync(fixture, '    environment: production # deploy target\n', 'utf8');
    expect(runMatcher(fixture, 'environment:[[:space:]]*production').out).toBe('MATCH');
  });
})

describe('post-deploy smoke test only tolerates the documented Cloudflare 403', () => {
  // Regresion: el paso trataba "cualquier codigo que no sea 200" como el reto
  // de bot de Cloudflare y seguia adelante con un ::warning::. Con el sitio
  // devolviendo 429 durante dias, el deploy salia verde igualmente. Ahora solo
  // 403 se tolera y cualquier otro codigo falla el job. Este test extrae el
  // script tal y como se publica en el workflow y lo ejecuta con un curl falso.
  const DEPLOY = '.github/workflows/deploy.yml';
  const FAKE_SHA = '0123456789abcdef0123456789abcdef01234567';

  function extractSmokeRun(): string {
    const lines = read(DEPLOY).split('\n');
    const start = lines.findIndex((line) => line.trim() === '- name: Post-deploy smoke test');
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
    expect(body.join('\n')).toContain('HTML_CODE');
    return body.join('\n');
  }

  // curl falso: la peticion del HTML cache-busted devuelve el codigo que pide
  // el caso de prueba, version.json devuelve el sha que pide el caso, y todo
  // asset estatico devuelve 200.
  const CURL_STUB = [
    'curl() {',
    '  local out="" url="" prev=""',
    '  for a in "$@"; do',
    '    if [ "$prev" = "-o" ]; then out="$a"; fi',
    '    prev="$a"',
    '    url="$a"',
    '  done',
    '  if [[ "$url" == *"/version.json"* ]]; then',
    '    printf "%s" "{\\"sha\\":\\"$FAKE_SERVED_SHA\\",\\"built_at\\":\\"2026-09-24T00:00:00Z\\"}"',
    '    return 0',
    '  fi',
    '  if [[ "$url" == *"/?v="* ]]; then',
    '    if [ -n "$out" ]; then',
    '      {',
    '        printf "%s\\n" "<link href=\\"assets/styles.css?v=${SHA:0:7}\\">"',
    '        printf "%s\\n" "<img src=\\"assets/images/foto_perfil.png\\">"',
    '      } > "$out"',
    '    fi',
    '    printf "%s" "$FAKE_HTML_CODE"',
    '    if [ "$FAKE_HTML_CODE" = "200" ]; then return 0; fi',
    '    return 22',
    '  fi',
    '  if [ -n "$out" ]; then : > "$out"; fi',
    '  printf "200"',
    '}',
    'sleep() { :; }',
  ].join('\n');

  function runSmoke(htmlCode: string, servedSha: string = FAKE_SHA): { code: number; out: string } {
    const harness = join(tmpdir(), `jsm-smoke-${Date.now()}-${Math.random()}.sh`);
    writeFileSync(harness, `${CURL_STUB}\n${extractSmokeRun()}\n`, 'utf8');
    try {
      const proc = Bun.spawnSync(['bash', harness], {
        env: { ...process.env, SHA: FAKE_SHA, FAKE_HTML_CODE: htmlCode, FAKE_SERVED_SHA: servedSha },
      });
      return {
        code: proc.exitCode ?? 1,
        out: proc.stdout.toString() + proc.stderr.toString(),
      };
    } finally {
      rmSync(harness, { force: true });
    }
  }

  test('403 is tolerated because Cloudflare challenges the runner TLS fingerprint', () => {
    const result = runSmoke('403');
    expect(result.code).toBe(0);
    expect(result.out).toContain('::warning::');
    expect(result.out).toContain('403');
    expect(result.out).toContain('Smoke test: all');
  });

  test('429 fails the deploy instead of passing it as a bot challenge', () => {
    const result = runSmoke('429');
    expect(result.code).toBe(1);
    expect(result.out).toContain('::error::');
    expect(result.out).toContain('429');
  });

  for (const code of ['500', '502', '503', '000']) {
    test(`${code} fails the deploy`, () => {
      const result = runSmoke(code);
      expect(result.code).toBe(1);
      expect(result.out).toContain('::error::');
      expect(result.out).toContain(code);
    });
  }

  test('200 still runs the release content checks and passes', () => {
    const result = runSmoke('200');
    expect(result.code).toBe(0);
    expect(result.out).toContain('HTML content matches release');
    expect(result.out).toContain('Smoke test: all');
    expect(result.out).toContain('/version.json -> sha');
    expect(result.out).not.toContain('::error::');
    // Con HTML 200 la nota de "HTML omitido" seria mentira, no debe salir.
    expect(result.out).not.toContain('HTML content checks were skipped');
  });

  test('a stale version.json sha fails the deploy', () => {
    const result = runSmoke('200', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(result.code).toBe(1);
    expect(result.out).toContain('::error::');
    expect(result.out).toContain('/version.json');
  });
})

describe('CSP does not allowlist a host that does not resolve', () => {
  // cdn.capdesis.com devuelve NXDOMAIN y ningun recurso del sitio lo usa.
  // Un allowlist con hosts muertos invita a que alguien registre el nombre
  // mas adelante y quede autorizado por una politica que nadie reviso.
  test('img-src does not name cdn.capdesis.com', () => {
    expect(read('.htaccess')).not.toContain('cdn.capdesis.com');
  });

  test('the capdesis images the page really hotlinks stay allowed', () => {
    const htaccess = read('.htaccess');
    expect(htaccess).toContain('img-src');
    expect(htaccess).toContain('https://capdesis.com');
    expect(read('index.html')).toContain('https://capdesis.com/images/');
  });
})
