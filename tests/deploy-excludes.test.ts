import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { compileRules, survivors, workflowExcludePatterns } from './support/excludes';
import {
  cleanupScratch,
  makeRelease,
  mustDeploy,
  read,
  ROOT,
  runDeploySh,
  scratch,
  trackedFiles,
  writeTree,
} from './support/release';

// Both deploy paths must publish exactly the same set of files. The official
// upload (.github/workflows/deploy.yml, FTP-Deploy-Action) leaves out whatever
// its `exclude:` block names. scripts/deploy.sh, the recovery path, used to keep
// its own hand-written lftp list and let tests/, audits/, bunfig.toml and
// bun.lock through. The block in deploy.yml is now the single list: deploy.sh
// reads it through scripts/prune-excluded.py and uploads only what is left.

afterEach(cleanupScratch);

const PRUNE = join(ROOT, 'scripts', 'prune-excluded.py');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'deploy.yml');

type Run = { code: number | null; out: string; err: string };

function prune(root: string, workflow: string = WORKFLOW, extra: string[] = []): Run {
  const proc = Bun.spawnSync(['python3', PRUNE, '--workflow', workflow, '--root', root, ...extra], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() };
}

function mustPrune(root: string, workflow: string = WORKFLOW, extra: string[] = []): string {
  const run = prune(root, workflow, extra);
  if (run.code !== 0) {
    throw new Error(`prune-excluded.py exited ${run.code}: ${run.err}${run.out}`);
  }
  return run.out;
}

// Every file under `root`, relative and sorted. Empty directories do not count.
function listFiles(root: string, dir: string = ''): string[] {
  const files: string[] = [];
  for (const name of readdirSync(join(root, dir)).sort()) {
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(root, rel)).isDirectory()) files.push(...listFiles(root, rel));
    else files.push(rel);
  }
  return files;
}

function listDirs(root: string, dir: string = ''): string[] {
  const dirs: string[] = [];
  for (const name of readdirSync(join(root, dir)).sort()) {
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(root, rel)).isDirectory()) dirs.push(rel, ...listDirs(root, rel));
  }
  return dirs;
}

// A workflow with just an `exclude:` block, for testing the matcher on its own.
function writeWorkflow(patterns: string[], extraBlock: string = ''): string {
  const file = join(scratch('workflow'), 'deploy.yml');
  const body = [
    'jobs:',
    '  deploy:',
    '    steps:',
    '      - name: Deploy via FTPS',
    '        uses: SamKirkland/FTP-Deploy-Action@v4',
    '        with:',
    '          exclude: |',
    ...patterns.map((pattern) => `            ${pattern}`),
    '',
    '      - name: Next step',
    '        run: echo done',
    extraBlock,
    '',
  ].join('\n');
  writeFileSync(file, body);
  return file;
}

function treeOf(paths: string[]): string {
  const root = scratch('tree');
  writeTree(root, Object.fromEntries(paths.map((rel) => [rel, 'x'])));
  return root;
}

describe('prune-excluded.py applies the deploy.yml exclude list', () => {
  // Authoritative expectations, written by hand from the workflow's own
  // comments, so neither implementation can vouch for itself.
  const VERDICTS: Array<[string, boolean]> = [
    ['index.html', true],
    ['404.html', true],
    ['assets/js/consent.js', true],
    ['assets/styles.css', true],
    ['fonts/geist.woff2', true],
    ['cv/Jorge_Salgado_Miranda_CV_EN.html', true],
    ['legal/privacy.html', true],
    ['api/contact.php', true],
    // generated at deploy time, must be uploaded
    ['api/secrets.php', true],
    ['version.json', true],
    // the site's Apache config and ACME / security.txt stay publishable
    ['.htaccess', true],
    ['sub/.htaccess', true],
    ['.well-known/security.txt', true],
    ['.well-known/acme-challenge/token', true],
    // names that only look like excluded ones
    ['sub/docs', true],
    ['README.markdown', true],
    ['verify.png', true],
    ['logfile', true],
    ['gitignore.txt', true],
    ['readme.md', true],
    // internal directories, at the root and nested
    ['tests/stamp-assets.test.ts', false],
    ['audits/CIERRE-2026-09-11.md', false],
    ['docs/DEPLOY.md', false],
    ['scripts/deploy.sh', false],
    ['.github/workflows/deploy.yml', false],
    ['node_modules/pkg/index.js', false],
    ['coverage/lcov.info', false],
    ['.remember/note.md', false],
    ['.playwright-mcp/shot.png', false],
    ['.idea/workspace.xml', false],
    ['.vscode/settings.json', false],
    ['assets/docs/internal.md', false],
    ['assets/tests/inner.ts', false],
    ['deep/nested/scripts/run.sh', false],
    // dotfiles and dot directories, except the two exceptions above
    ['.env', false],
    ['.env.local', false],
    ['.env.example', false],
    ['.gitignore', false],
    ['.gitattributes', false],
    ['.git-credentials', false],
    ['.gitleaks.toml', false],
    ['.pre-commit-config.yaml', false],
    ['.DS_Store', false],
    ['assets/.DS_Store', false],
    ['.hidden/file.txt', false],
    ['deep/.hidden/file.txt', false],
    // repository metadata, lockfiles, logs, scratch screenshots
    ['package.json', false],
    ['sub/package.json', false],
    ['package-lock.json', false],
    ['bun.lock', false],
    ['bun.lockb', false],
    ['bunfig.toml', false],
    ['README.md', false],
    ['sub/README.md', false],
    ['CLAUDE.md', false],
    ['HANDOFF.md', false],
    ['og.html', false],
    ['legal/og.html', false],
    ['verify-home.png', false],
    ['deep/nested/debug.log', false],
    ['api/secrets.example.php', false],
  ];

  test('keeps and drops every path as the workflow list says', () => {
    const root = treeOf(VERDICTS.map(([rel]) => rel));
    mustPrune(root);
    const kept = new Set(listFiles(root));
    const wrong = VERDICTS.filter(([rel, keep]) => kept.has(rel) !== keep).map(
      ([rel, keep]) => `${rel}: want ${keep ? 'kept' : 'dropped'}`,
    );
    expect(wrong).toEqual([]);
  });

  test('agrees with the independent oracle on every one of those paths', () => {
    const rules = compileRules(workflowExcludePatterns());
    const paths = VERDICTS.map(([rel]) => rel);
    const root = treeOf(paths);
    mustPrune(root);
    expect(listFiles(root)).toEqual(survivors(paths, rules));
  });

  test('reads the same number of patterns the workflow carries', () => {
    const root = treeOf(['index.html']);
    const out = mustPrune(root);
    expect(out).toContain(`${workflowExcludePatterns().length} pattern(s)`);
  });

  test('removes a directory it prunes whole, and a directory it emptied', () => {
    const root = treeOf(['only-logs/a.log', 'only-logs/deeper/b.log', 'kept/c.txt', 'tests/t.ts']);
    mustPrune(root);
    expect(listFiles(root)).toEqual(['kept/c.txt']);
    expect(listDirs(root)).toEqual(['kept']);
  });

  test('prints what it removed', () => {
    const root = treeOf(['index.html', 'tests/a.ts', 'tests/b.ts', 'audits/r.md', 'bunfig.toml']);
    const out = mustPrune(root);
    expect(out).toContain('tests/');
    expect(out).toContain('audits/');
    expect(out).toContain('bunfig.toml');
    expect(out).not.toContain('index.html');
  });
});

describe('prune-excluded.py matcher semantics (the rules the upload action uses)', () => {
  const run = (patterns: string[], paths: string[], extra: string[] = []): string[] => {
    const root = treeOf(paths);
    mustPrune(root, writeWorkflow(patterns), ['--min-patterns', '1', ...extra]);
    return listFiles(root);
  };

  test('a later "!" pattern puts back what an earlier pattern dropped', () => {
    expect(run(['**/.*', '!**/.keep'], ['.keep', '.other', 'd/.keep', 'd/.other', 'plain.txt'])).toEqual([
      '.keep',
      'd/.keep',
      'plain.txt',
    ]);
  });

  test('a "!" pattern placed before the pattern it undoes has no effect', () => {
    expect(run(['!**/.keep', '**/.*'], ['.keep', 'plain.txt'])).toEqual(['plain.txt']);
  });

  test('a pattern without a slash matches the file name at any depth', () => {
    expect(run(['*.log'], ['x.log', 'a/b/x.log', 'x.logs', 'a/xlog'])).toEqual(['a/xlog', 'x.logs']);
  });

  test('a directory pattern needs the directory, so a file with that name stays', () => {
    expect(run(['**/cache/**'], ['cache', 'a/cache/b/c', 'z/cache/d', 'a/cachex/d'])).toEqual([
      'a/cachex/d',
      'cache',
    ]);
  });

  test('* and ? stay inside one name and are case sensitive', () => {
    expect(
      run(['**/v?-*.png', '**/README.md'], ['v1-a.png', 'v10-a.png', 'x/v2-b.png', 'readme.md', 'x/README.md']),
    ).toEqual(['readme.md', 'v10-a.png']);
  });

  test('a parent directory that is dropped takes its children, even ones a "!" would put back', () => {
    expect(run(['**/private/**', '**/*.keep', '!**/*.keep'], ['private/a.keep', 'public/a.keep'])).toEqual([
      'public/a.keep',
    ]);
  });
});

describe('prune-excluded.py fails closed', () => {
  const PATTERNS = ['**/a', '**/b'];

  function expectRefusal(workflow: string, message: string, extra: string[] = []): void {
    const root = treeOf(['index.html', 'tests/t.ts', 'a']);
    const before = listFiles(root);
    const result = prune(root, workflow, extra);
    expect(result.code).toBe(1);
    expect(result.err).toContain(message);
    expect(listFiles(root)).toEqual(before);
  }

  test('a workflow that does not exist', () => {
    expectRefusal(join(scratch('missing'), 'nope.yml'), 'cannot read');
  });

  test('a workflow with no exclude block', () => {
    const file = join(scratch('noblock'), 'deploy.yml');
    writeFileSync(file, 'jobs:\n  deploy:\n    steps:\n      - run: echo hi\n');
    expectRefusal(file, 'no "exclude: |" block');
  });

  test('a workflow with two exclude blocks, because it cannot tell which one uploads', () => {
    const second = ['      - name: Other', '        with:', '          exclude: |', '            **/c'].join('\n');
    expectRefusal(writeWorkflow(PATTERNS, second), 'more than one', ['--min-patterns', '1']);
  });

  test('an empty block', () => {
    expectRefusal(writeWorkflow([]), 'no patterns', ['--min-patterns', '1']);
  });

  test('fewer patterns than the floor, in case a bad edit truncated the list', () => {
    expectRefusal(writeWorkflow(PATTERNS), 'minimum');
  });

  for (const [label, pattern] of [
    ['braces', '**/{a,b}'],
    ['a character class', '**/[ab]'],
    ['an extglob', '**/+(a|b)'],
    ['an escape', '**/a\\b'],
    ['a comment line', '# not a comment in a block scalar'],
    ['a double negation', '!!**/a'],
  ] as const) {
    test(`syntax it cannot reproduce faithfully: ${label}`, () => {
      expectRefusal(writeWorkflow([...PATTERNS, pattern]), 'unsupported', ['--min-patterns', '1']);
    });
  }

  test('a root that is not a directory', () => {
    const result = prune(join(scratch('noroot'), 'nope'));
    expect(result.code).toBe(1);
    expect(result.err).toContain('not a directory');
  });
});

describe('scripts/deploy.sh uploads exactly what deploy.yml uploads', () => {
  // Files that exist in a working copy but never in a release archive, plus
  // ones that are easy to get wrong. `git add -f` puts them in the throwaway
  // release so a leak shows up as a leak.
  const SHOULD_STAY_OFF: Record<string, string> = {
    'node_modules/pkg/index.js': 'x',
    'coverage/lcov.info': 'x',
    '.env': 'SECRET=1',
    '.env.local': 'x',
    '.remember/note.md': 'x',
    '.playwright-mcp/shot.png': 'x',
    '.idea/workspace.xml': 'x',
    '.vscode/settings.json': 'x',
    '.DS_Store': 'x',
    'assets/.DS_Store': 'x',
    'deep/nested/debug.log': 'x',
    'verify-home.png': 'x',
    'assets/docs/internal.md': 'x',
    'assets/tests/inner.ts': 'x',
    'package-lock.json': '{}',
    'bun.lockb': 'x',
    '.hidden/file.txt': 'x',
    '.git-credentials': 'x',
    'CLAUDE.md': 'x',
  };
  const SHOULD_GO_UP: Record<string, string> = {
    '.well-known/security.txt': 'Contact: mailto:security@example.invalid',
    'deep/nested/ok.txt': 'x',
  };

  test('the recovery path publishes nothing from tests/ or audits/', () => {
    const release = makeRelease();
    const run = mustDeploy(release);
    const internal = listFiles(run.captured).filter((rel) => /^(tests|audits)\//.test(rel));
    expect(internal).toEqual([]);
  });

  test('the uploaded set is exactly the set the workflow list lets through', () => {
    const release = makeRelease({ ...SHOULD_STAY_OFF, ...SHOULD_GO_UP });
    const rules = compileRules(workflowExcludePatterns());
    const everything = [...trackedFiles(), ...Object.keys(SHOULD_STAY_OFF), ...Object.keys(SHOULD_GO_UP)];
    // version.json is written by deploy.sh from the release SHA.
    const expected = [...survivors(everything, rules), 'version.json'].sort();

    const uploaded = listFiles(mustDeploy(release).captured);

    expect(uploaded.filter((rel) => !expected.includes(rel))).toEqual([]);
    expect(expected.filter((rel) => !uploaded.includes(rel))).toEqual([]);
    // The oracle and the script agree with hand-written facts too.
    for (const rel of Object.keys(SHOULD_STAY_OFF)) expect(uploaded).not.toContain(rel);
    for (const rel of Object.keys(SHOULD_GO_UP)) expect(uploaded).toContain(rel);
    for (const rel of ['index.html', '404.html', '.htaccess', 'robots.txt', 'sitemap.xml', 'og.png', 'version.json']) {
      expect(uploaded).toContain(rel);
    }
    for (const rel of ['bunfig.toml', 'bun.lock', 'package.json', 'README.md', 'og.html', 'api/secrets.example.php']) {
      expect(uploaded).not.toContain(rel);
    }
  });

  test('lftp is given no exclude list of its own, so there is only one list', () => {
    const run = mustDeploy(makeRelease());
    expect(run.lftpScript).not.toBeNull();
    expect((run.lftpScript ?? '').includes('--exclude-glob')).toBe(false);
    expect((run.lftpScript ?? '').includes('mirror --reverse')).toBe(true);
  });

  test('a workflow without an exclude block stops the upload before lftp is called', () => {
    const release = makeRelease();
    const workflow = join(release.work, '.github', 'workflows', 'deploy.yml');
    writeFileSync(workflow, read(release.work, '.github/workflows/deploy.yml').replace('exclude: |', 'excluded: |'));
    const run = runDeploySh(release);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain('exclude');
    expect(run.lftpScript).toBeNull();
    expect(existsSync(join(run.captured, 'index.html'))).toBe(false);
  });

  test('deploy.sh keeps no list of its own', () => {
    // Booleans, not toContain: a failed toContain would print the whole script.
    const deploySh = read(ROOT, 'scripts/deploy.sh');
    expect(deploySh.includes('prune-excluded.py')).toBe(true);
    expect(deploySh.includes('--exclude-glob')).toBe(false);
  });

  test('the list the script reads is the one the official upload action is given', () => {
    const lines = read(ROOT, '.github/workflows/deploy.yml').split('\n');
    const uses = lines.findIndex((line) => line.includes('SamKirkland/FTP-Deploy-Action'));
    const block = lines.findIndex((line) => line.trim() === 'exclude: |');
    expect(uses).toBeGreaterThan(-1);
    expect(block).toBeGreaterThan(uses);
    // Nothing between the action and its exclude block opens another step.
    expect(lines.slice(uses, block).some((line) => line.trim().startsWith('- name:'))).toBe(false);
    expect(workflowExcludePatterns().length).toBeGreaterThanOrEqual(10);
    expect(relative(ROOT, WORKFLOW)).toBe('.github/workflows/deploy.yml');
  });
});
