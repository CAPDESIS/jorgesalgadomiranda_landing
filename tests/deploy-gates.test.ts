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
    expect(workflow).toContain('deploy-gates.py" ci --runs-file');
    expect(workflow).toContain('deploy-gates.py" rollback-point --version-file');
  });

  test('gate steps fail closed and never continue on error', () => {
    const start = stepIndex('Load deploy gates from origin/main');
    const end = stepIndex('Install Bun and run tests');
    const block = workflow.slice(start, end);
    expect(block).not.toContain('continue-on-error');
    expect(block).not.toContain('|| true');
    expect(block).toContain('refusing to deploy unchecked');
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
    expect(block).toContain('ftp://${host}/version.json');
    expect(block).not.toMatch(/-u\s+"?\$FTP_USER/);
    expect(block).toContain('rm -f "$netrc"');
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
