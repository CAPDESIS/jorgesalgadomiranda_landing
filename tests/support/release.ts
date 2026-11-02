import { expect } from 'bun:test';
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

// Shared harness for the tests that run the real deploy paths against a
// throwaway git release: scripts/deploy.sh (through a fake lftp) and the step
// blocks of .github/workflows/deploy.yml.

export const ROOT = join(import.meta.dir, '..', '..');

let scratchDirs: string[] = [];

export function scratch(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `jsm-${label}-`));
  scratchDirs.push(dir);
  return dir;
}

export function cleanupScratch(): void {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  scratchDirs = [];
}

export function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
}

export function read(root: string, rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

export const GIT_ENV = {
  PATH: process.env.PATH ?? '',
  HOME: process.env.HOME ?? '',
  TMPDIR: process.env.TMPDIR ?? tmpdir(),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
};

export function git(cwd: string, args: string[]): string {
  const proc = Bun.spawnSync(['git', ...args], { cwd, env: GIT_ENV, stdout: 'pipe', stderr: 'pipe' });
  if (proc.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${proc.stderr.toString()}`);
  }
  return proc.stdout.toString().trim();
}

// Every file of this checkout that is tracked or about to be, relative paths.
// Ignored files (node_modules, coverage, .env) are not part of a release.
export function trackedFiles(): string[] {
  const proc = Bun.spawnSync(
    ['git', '-c', 'core.fsmonitor=false', '-C', ROOT, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const files = proc.stdout.toString().split('\0').filter(Boolean);
  expect(files).toContain('index.html');
  return files.filter((rel) => existsSync(join(ROOT, rel)));
}

// The html pages the site really ships, listed by git so a new page is covered
// without anyone editing a test. Not-deployed directories are left out the same
// way the upload excludes them.
const NOT_DEPLOYED = new Set(['docs', 'tests', 'scripts', 'audits', 'node_modules', 'coverage']);

export function shippedPages(): string[] {
  return trackedFiles().filter((rel) => rel.endsWith('.html') && !NOT_DEPLOYED.has(rel.split('/')[0]));
}

export type Release = { work: string; sha: string; pages: string[] };

// A git release of this repository's real files, plus `extra` files that are
// added even when .gitignore would hide them (a release archive never has them,
// but an unexpected one must still be kept off the server). `work` is the
// checkout the deploy runs from; `origin.git` next to it is its origin/main.
export function makeRelease(extra: Record<string, string> = {}): Release {
  const base = scratch('release');
  const origin = join(base, 'origin.git');
  const work = join(base, 'work');
  git(base, ['init', '-q', '--bare', '-b', 'main', origin]);
  mkdirSync(work);
  for (const rel of trackedFiles()) {
    mkdirSync(dirname(join(work, rel)), { recursive: true });
    cpSync(join(ROOT, rel), join(work, rel));
  }
  writeTree(work, extra);
  git(work, ['init', '-q', '-b', 'main']);
  git(work, ['add', '-f', '-A']);
  git(work, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-q', '-m', 'release fixture']);
  git(work, ['remote', 'add', 'origin', origin]);
  git(work, ['push', '-q', 'origin', 'main']);
  return { work, sha: git(work, ['rev-parse', 'HEAD']), pages: shippedPages() };
}

// Stands in for lftp: records the tree deploy.sh would mirror to the server and
// the exact script it was given. It honours --exclude-glob under the most
// generous reading of lftp's globs (matched against the path relative to the
// mirror root and against the file name; a trailing slash means directories
// only), so a verdict of "still uploaded" cannot come from reading them too
// narrowly.
//
// When REMOTE_DIR is set it also plays the server. `mirror --reverse` copies
// every non-excluded local file over the remote one, and `--delete` removes
// every non-excluded remote file that has no local counterpart, then the
// directories that emptied. Excluded paths are neither transferred nor deleted,
// on either side: that is how lftp documents --exclude with --delete, and it is
// the model the secrets test relies on. It has not been run against a real lftp
// (none is installed here and no server is contacted).
const FAKE_LFTP = `#!/usr/bin/env python3
import fnmatch
import os
import shlex
import shutil
import sys

script = sys.stdin.read()
with open(os.environ["LFTP_SCRIPT_OUT"], "w") as handle:
    handle.write(script)

source = None
globs = []
for line in script.splitlines():
    if line.startswith('lcd "'):
        source = line[len('lcd "'):-1]
    if line.startswith("mirror"):
        tokens = shlex.split(line)
        for index, token in enumerate(tokens):
            if token in ("--exclude-glob", "-X") and index + 1 < len(tokens):
                globs.append(tokens[index + 1])
            elif token.startswith("--exclude-glob="):
                globs.append(token.split("=", 1)[1])
if not source or not os.path.isdir(source):
    sys.exit("fake lftp: no lcd directory in the script")

def excluded(rel, is_dir):
    name = os.path.basename(rel)
    for glob in globs:
        directory_only = glob.endswith("/")
        pattern = glob.rstrip("/")
        if directory_only and not is_dir:
            continue
        if fnmatch.fnmatchcase(rel, pattern) or fnmatch.fnmatchcase(name, pattern):
            return True
    return False

capture = os.environ["CAPTURE_DIR"]
remote = os.environ.get("REMOTE_DIR")
delete = "--delete" in script
transferred = set()
for dirpath, dirnames, filenames in os.walk(source):
    rel_dir = os.path.relpath(dirpath, source)
    rel_dir = "" if rel_dir == "." else rel_dir
    dirnames[:] = [d for d in dirnames if not excluded(os.path.join(rel_dir, d), True)]
    for name in filenames:
        rel = os.path.join(rel_dir, name)
        if excluded(rel, False):
            continue
        transferred.add(rel)
        for destination in (capture, remote):
            if not destination:
                continue
            target = os.path.join(destination, rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(os.path.join(source, rel), target)

if remote and delete:
    for dirpath, dirnames, filenames in os.walk(remote, topdown=True):
        rel_dir = os.path.relpath(dirpath, remote)
        rel_dir = "" if rel_dir == "." else rel_dir
        dirnames[:] = [d for d in dirnames if not excluded(os.path.join(rel_dir, d), True)]
        for name in filenames:
            rel = os.path.join(rel_dir, name)
            if not excluded(rel, False) and rel not in transferred:
                os.unlink(os.path.join(remote, rel))
    for dirpath, dirnames, filenames in os.walk(remote, topdown=False):
        rel_dir = os.path.relpath(dirpath, remote)
        if rel_dir != "." and not excluded(rel_dir, True) and not os.listdir(dirpath):
            os.rmdir(dirpath)
`;

export type DeployRun = {
  code: number | null;
  stdout: string;
  stderr: string;
  captured: string;
  // The fake server after the run. Empty unless `server` files were given.
  remote: string;
  lftpScript: string | null;
};

// Runs the checkout's scripts/deploy.sh for the release, with the fake lftp
// first on PATH. Nothing leaves the machine. `server` seeds the fake server
// with files that already live there (for example the secrets file the official
// workflow generates), so a mirror that would delete or overwrite them shows.
export function runDeploySh(release: Release, server: Record<string, string> = {}): DeployRun {
  const bin = scratch('bin');
  writeFileSync(join(bin, 'lftp'), FAKE_LFTP);
  chmodSync(join(bin, 'lftp'), 0o755);
  const captured = scratch('captured');
  const remote = scratch('server');
  writeTree(remote, server);
  const scriptOut = join(scratch('lftp-script'), 'script.txt');
  const proc = Bun.spawnSync(['bash', join(release.work, 'scripts', 'deploy.sh')], {
    cwd: release.work,
    env: {
      ...GIT_ENV,
      PATH: `${bin}:${GIT_ENV.PATH}`,
      RELEASE_SHA: release.sha,
      FTP_HOST: 'ftp.invalid',
      FTP_USER: 'fixture',
      FTP_PASS: 'fixture',
      FTP_REMOTE_DIR: './',
      CAPTURE_DIR: captured,
      REMOTE_DIR: remote,
      LFTP_SCRIPT_OUT: scriptOut,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
    captured,
    remote,
    lftpScript: existsSync(scriptOut) ? readFileSync(scriptOut, 'utf8') : null,
  };
}

export function mustDeploy(release: Release, server: Record<string, string> = {}): DeployRun {
  const run = runDeploySh(release, server);
  if (run.code !== 0) {
    throw new Error(`deploy.sh exited ${run.code}: ${run.stderr}${run.stdout}`);
  }
  return run;
}

// The body of a step's `run: |` block, as published in the workflow.
export function extractRun(workflowRel: string, stepName: string): string {
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
