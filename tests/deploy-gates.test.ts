import { afterAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// T095: the production deploy must measure its preconditions instead of
// trusting a typed "yes". These tests fail on the workflow that still asks
// for confirm_release_green / confirm_backup_ready, and they run the gate
// script against fixtures so a gate that passes on bad input is caught.

const ROOT = join(import.meta.dir, '..');
const SCRIPT = join(ROOT, 'scripts/deploy-gates.py');
const workflow = readFileSync(join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
const work = mkdtempSync(join(tmpdir(), 'jsm-deploy-gates-'));

afterAll(() => rmSync(work, { recursive: true, force: true }));

function inputsBlock(): string {
  const start = workflow.indexOf('    inputs:\n');
  const end = workflow.indexOf('\nconcurrency:');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

function stepIndex(name: string): number {
  const idx = workflow.indexOf(`      - name: ${name}\n`);
  expect(idx).toBeGreaterThan(-1);
  return idx;
}

function run(args: string[], cwd = ROOT) {
  return spawnSync('python3', ['-I', SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

function git(cwd: string, ...args: string[]): string {
  const out = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@example.invalid',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@example.invalid',
    },
  });
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`);
  return out.stdout.trim();
}

const SHA = 'a'.repeat(40);

function runsFile(name: string, runs: unknown): string {
  const path = join(work, name);
  writeFileSync(path, typeof runs === 'string' ? runs : JSON.stringify(runs));
  return path;
}

function okRun(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    head_sha: SHA,
    event: 'push',
    head_branch: 'main',
    status: 'completed',
    conclusion: 'success',
    ...extra,
  };
}

describe('deploy.yml: typed confirmations are replaced by measured gates', () => {
  test('confirm_release_green and confirm_backup_ready inputs are gone', () => {
    const inputs = inputsBlock();
    expect(inputs).not.toContain('confirm_release_green');
    expect(inputs).not.toContain('confirm_backup_ready');
    expect(workflow).not.toContain('inputs.confirm_release_green');
    expect(workflow).not.toContain('inputs.confirm_backup_ready');
  });

  test('no skip or force input was added in their place', () => {
    expect(inputsBlock()).not.toMatch(/^\s+(skip|force|bypass)[a-z_]*:/m);
  });

  test('the alert confirmation stays until the operator wires Alertmanager', () => {
    expect(inputsBlock()).toContain('confirm_no_p0_p1_alerts:');
    expect(workflow).toContain('if [ "${{ inputs.confirm_no_p0_p1_alerts }}" != "yes" ]; then');
  });

  test('both gates run from origin/main before any FTP upload', () => {
    const load = stepIndex('Load deploy gates from origin/main');
    const ci = stepIndex('Gate on green CI for the release SHA');
    const rollback = stepIndex('Gate on a rebuildable rollback point');
    const verify = stepIndex('Verify release SHA is on main');
    const ftp = stepIndex('Deploy via FTPS');
    expect(verify).toBeLessThan(load);
    expect(load).toBeLessThan(ci);
    expect(ci).toBeLessThan(rollback);
    expect(rollback).toBeLessThan(ftp);
    expect(workflow).toContain('git show refs/remotes/origin/main:scripts/deploy-gates.py');
    expect(workflow).toContain('deploy-gates.py" ci-wait --repository');
    expect(workflow).toContain('deploy-gates.py" rollback-point --version-file');
  });

  test('gate steps fail closed and never continue on error', () => {
    const start = stepIndex('Load deploy gates from origin/main');
    const end = stepIndex('Install Bun and run tests');
    const block = workflow.slice(start, end);
    expect(block).not.toContain('continue-on-error');
    expect(block).not.toContain('|| true');
    // The CI gate's refusal text lives in the script it runs from origin/main.
    expect(readFileSync(SCRIPT, 'utf8')).toContain('refusing to deploy unchecked');
    expect(block).toContain('cannot be identified for rollback');
  });

  test('the rollback-point gate reads the origin over FTPS when the edge blocks the runner', () => {
    const start = stepIndex('Gate on a rebuildable rollback point');
    const end = stepIndex('Install Bun and run tests');
    const block = workflow.slice(start, end);
    // Run 39698426255: Bot Fight Mode answered 403 to the runner three times
    // and the gate refused a healthy release. The origin read must exist,
    // require TLS, and keep the credentials out of the command line.
    expect(block).toContain('--ssl-reqd');
    expect(block).toContain('--netrc-file');
    expect(block).toContain('ftp://${tls_name}/version.json');
    // Run 39698812012: FTP_HOST is an IP and the certificate is *.hstgr.io.
    // TLS verification stays on; the name comes from the certificate and must
    // be an hstgr.io name.
    expect(block).toContain('--connect-to "${tls_name}:21:${host}:21"');
    expect(block).toContain("hstgr\\.io$");
    expect(block).not.toMatch(/--insecure|\s-k\s/);
    expect(block).not.toMatch(/-u\s+"?\$FTP_USER/);
    expect(block).toContain('rm -f "$netrc"');
  });

  test('the post-deploy parity check falls back to the origin over verified FTPS', () => {
    const start = stepIndex('Post-deploy smoke test');
    const block = workflow.slice(start);
    // Run 39699173273 uploaded the release and then failed: the edge
    // answered 403 for /version.json. The fallback must verify TLS by the
    // hstgr.io certificate name and still require the exact release SHA.
    expect(block).toContain('ftp://${tls_name}/version.json');
    expect(block).toContain('--ssl-reqd');
    expect(block).toContain('rm -f "$netrc"');
    expect(block).not.toMatch(/--insecure/);
    expect(block).toContain('if [ "$SERVED_SHA" != "$SHA" ]; then');
  });

  test('the job stays on a GitHub-hosted runner (CapLiving#525 containment)', () => {
    expect(workflow).toContain('runs-on: ubuntu-latest');
    expect(workflow).not.toContain('self-hosted');
  });
});

describe('deploy-gates.py ci', () => {
  test('passes only when CI, test and gitleaks succeeded on main for the SHA', () => {
    const file = runsFile('ok.json', { workflow_runs: [okRun('CI'), okRun('test'), okRun('gitleaks')] });
    const out = run(['ci', '--runs-file', file, '--sha', SHA]);
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('ok: gitleaks');
  });

  const cases: Array<[string, unknown]> = [
    ['a required workflow is missing', { workflow_runs: [okRun('CI'), okRun('test')] }],
    ['a run failed', { workflow_runs: [okRun('CI'), okRun('test', { conclusion: 'failure' }), okRun('gitleaks')] }],
    ['a run is still in progress', { workflow_runs: [okRun('CI', { status: 'in_progress', conclusion: null }), okRun('test'), okRun('gitleaks')] }],
    ['a run was skipped', { workflow_runs: [okRun('CI', { conclusion: 'skipped' }), okRun('test'), okRun('gitleaks')] }],
    ['the green run is for another SHA', { workflow_runs: [okRun('CI', { head_sha: 'b'.repeat(40) }), okRun('test'), okRun('gitleaks')] }],
    ['the green run is from a pull request', { workflow_runs: [okRun('CI', { event: 'pull_request' }), okRun('test'), okRun('gitleaks')] }],
    ['the green run is on another branch', { workflow_runs: [okRun('CI', { head_branch: 'feature' }), okRun('test'), okRun('gitleaks')] }],
    ['the response has no runs list', { message: 'Bad credentials' }],
    ['the response is empty', ''],
  ];
  for (const [label, payload] of cases) {
    test(`fails when ${label}`, () => {
      const file = runsFile(`case-${cases.findIndex((c) => c[0] === label)}.json`, payload);
      const out = run(['ci', '--runs-file', file, '--sha', SHA]);
      expect(out.status).toBe(1);
      expect(out.stdout).toContain('::error::');
    });
  }

  test('fails on a malformed release SHA', () => {
    const file = runsFile('sha.json', { workflow_runs: [okRun('CI'), okRun('test'), okRun('gitleaks')] });
    expect(run(['ci', '--runs-file', file, '--sha', 'main']).status).toBe(1);
  });

  test('fails when the runs file does not exist', () => {
    expect(run(['ci', '--runs-file', join(work, 'absent.json'), '--sha', SHA]).status).toBe(1);
  });
});

describe('deploy-gates.py rollback-point', () => {
  const repo = join(work, 'repo');
  spawnSync('mkdir', ['-p', repo]);
  git(repo, 'init', '-q', '-b', 'main');
  writeFileSync(join(repo, 'a.txt'), '1');
  git(repo, 'add', 'a.txt');
  git(repo, 'commit', '-q', '-m', 'one');
  const onMain = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '-q', '-b', 'side');
  writeFileSync(join(repo, 'a.txt'), '2');
  git(repo, 'commit', '-q', '-am', 'side');
  const offMain = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '-q', 'main');

  function served(name: string, body: string) {
    const path = join(work, name);
    writeFileSync(path, body);
    return run(['rollback-point', '--version-file', path, '--main-ref', 'refs/heads/main'], repo);
  }

  test('passes when the served release is a commit on main', () => {
    const out = served('v-ok.json', JSON.stringify({ sha: onMain, built_at: 'x' }));
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('can be redeployed for rollback');
  });

  test('fails when the served release is not contained in main', () => {
    expect(served('v-side.json', JSON.stringify({ sha: offMain })).status).toBe(1);
  });

  test('fails when the served release is unknown to the repository', () => {
    expect(served('v-unknown.json', JSON.stringify({ sha: 'c'.repeat(40) })).status).toBe(1);
  });

  test('fails when version.json has no usable sha', () => {
    expect(served('v-nosha.json', JSON.stringify({ built_at: 'x' })).status).toBe(1);
    expect(served('v-short.json', JSON.stringify({ sha: onMain.slice(0, 7) })).status).toBe(1);
  });

  test('fails when version.json is not JSON (for example a parked or challenge page)', () => {
    expect(served('v-html.json', '<html>parked</html>').status).toBe(1);
    expect(served('v-empty.json', '').status).toBe(1);
  });
});

// GATES-2: the CI gate read the runs listing once (one curl). GitHub lags
// that listing: fragantia deploy runs 39805359214 and 39807905769
// (2026-10-22) read "no run for this SHA" while completed successes already
// existed, and CapValida run 39807128934 read conclusion None for a job that
// had finished. One read is not evidence of absence. ci-wait re-reads,
// bounded, while a required workflow has no run or its run has no
// conclusion yet, judges a red run at once, and fails closed at the ceiling.
describe('deploy-gates.py ci-wait (bounded re-read against API lag)', () => {
  type Reply = { status?: number; body: unknown };

  // The fake GitHub API is a small Python HTTP server: the happy-dom
  // preload replaces the global Response, so Bun.serve cannot answer here.
  const FAKE_API = `
import http.server, json, sys
replies = json.load(open(sys.argv[1]))
log = open(sys.argv[2], "a", buffering=1)
calls = {"filtered": 0, "main": 0}
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        kind = "filtered" if "head_sha=" in self.path else "main"
        log.write(kind + " " + self.path + "\\n")
        if self.headers.get("Authorization") != "Bearer canary-token":
            reply = {"status": 401, "body": {"message": "Bad credentials"}}
        else:
            seq = replies.get(kind) or [{"body": {"workflow_runs": []}}]
            reply = seq[min(calls[kind], len(seq) - 1)]
            calls[kind] += 1
        body = json.dumps(reply["body"]).encode()
        self.send_response(reply.get("status", 200))
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
srv = http.server.HTTPServer(("127.0.0.1", 0), H)
print(srv.server_address[1], flush=True)
srv.serve_forever()
`;
  let serial = 0;

  async function serveAndRun(replies: { filtered: Reply[]; main?: Reply[] }, extra: string[] = []) {
    serial += 1;
    const serverPath = join(work, 'fake_api.py');
    writeFileSync(serverPath, FAKE_API);
    const repliesPath = join(work, `replies-${serial}.json`);
    const logPath = join(work, `api-${serial}.log`);
    writeFileSync(repliesPath, JSON.stringify(replies));
    writeFileSync(logPath, '');
    const server = Bun.spawn(['python3', '-I', serverPath, repliesPath, logPath], { stdout: 'pipe', stderr: 'pipe' });
    try {
      const reader = server.stdout.getReader();
      let first = '';
      while (!first.includes('\n')) {
        const chunk = await reader.read();
        if (chunk.done) break;
        first += new TextDecoder().decode(chunk.value);
      }
      const port = Number.parseInt(first.trim(), 10);
      expect(port).toBeGreaterThan(0);
      const proc = Bun.spawn(
        [
          'python3', '-I', SCRIPT, 'ci-wait',
          '--repository', 'owner/repo', '--sha', SHA,
          '--api-url', `http://127.0.0.1:${port}`,
          '--attempts', '4', '--delay', '0', '--transport-pause', '0',
          ...extra,
        ],
        { cwd: ROOT, env: { ...process.env, GITHUB_TOKEN: 'canary-token' }, stdout: 'pipe', stderr: 'pipe' },
      );
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const status = await proc.exited;
      const seen = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
      const filteredCalls = seen.filter((l) => l.startsWith('filtered ')).length;
      const mainCalls = seen.filter((l) => l.startsWith('main ')).length;
      return { status, stdout, stderr, filteredCalls, mainCalls, seen };
    } finally {
      server.kill();
      await server.exited;
    }
  }

  const green = { workflow_runs: [okRun('CI'), okRun('test'), okRun('gitleaks')] };

  test('a listing that lags (no runs, then green) deploys after a re-read', async () => {
    const out = await serveAndRun({ filtered: [{ body: { workflow_runs: [] } }, { body: green }] });
    expect(out.stdout + out.stderr).not.toContain('::error::');
    expect(out.status).toBe(0);
    expect(out.filteredCalls).toBe(2);
  });

  test('a run that is still in flight is re-read until it concludes', async () => {
    const inFlight = { workflow_runs: [okRun('CI', { status: 'in_progress', conclusion: null }), okRun('test'), okRun('gitleaks')] };
    const out = await serveAndRun({ filtered: [{ body: inFlight }, { body: inFlight }, { body: green }] });
    expect(out.status).toBe(0);
    expect(out.filteredCalls).toBe(3);
  });

  test('the head_sha listing lag falls back to the main push listing', async () => {
    const out = await serveAndRun({
      filtered: [{ body: { workflow_runs: [] } }],
      main: [{ body: { workflow_runs: [okRun('CI', { head_sha: 'b'.repeat(40) }), ...green.workflow_runs] } }],
    });
    expect(out.status).toBe(0);
    expect(out.filteredCalls).toBe(1);
    expect(out.seen.some((p) => p.includes('branch=main') && p.includes('event=push'))).toBe(true);
  });

  test('a red run is judged at once, without re-reading', async () => {
    const red = { workflow_runs: [okRun('CI'), okRun('test', { conclusion: 'failure' }), okRun('gitleaks')] };
    const out = await serveAndRun({ filtered: [{ body: red }] });
    expect(out.status).toBe(1);
    expect(out.stdout).toContain('::error::');
    expect(out.stdout).toContain('test');
    expect(out.filteredCalls).toBe(1);
  });

  test('a run that never appears fails closed at the ceiling, loudly', async () => {
    const out = await serveAndRun({ filtered: [{ body: { workflow_runs: [okRun('CI'), okRun('test')] } }] });
    expect(out.status).toBe(1);
    expect(out.filteredCalls).toBe(4);
    expect(out.stdout).toContain('::error::');
    expect(out.stdout).toContain('gitleaks');
    expect(out.stdout).toContain('refusing to deploy unchecked');
  });

  test('an API that keeps failing fails closed', async () => {
    const out = await serveAndRun({ filtered: [{ status: 502, body: { message: 'bad gateway' } }] });
    expect(out.status).toBe(1);
    expect(out.stdout).toContain('::error::');
  });

  test('the workflow uses ci-wait from origin/main instead of a single curl read', () => {
    const start = stepIndex('Gate on green CI for the release SHA');
    const end = stepIndex('Gate on a rebuildable rollback point');
    const block = workflow.slice(start, end);
    expect(block).toContain('deploy-gates.py" ci-wait');
    expect(block).not.toContain('curl');
    expect(block).not.toContain('--runs-file');
  });
});
