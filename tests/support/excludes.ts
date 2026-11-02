import { read, ROOT } from './release';

// What the official upload (SamKirkland/FTP-Deploy-Action, which matches each
// path with multimatch {dot: true, matchBase: true}) leaves out, read straight
// from the `exclude:` block of .github/workflows/deploy.yml.
//
// This is an independent oracle for scripts/prune-excluded.py: it turns each
// pattern into a regular expression instead of walking path segments, and it
// shares no code with the script. Rules it implements:
//   - a directory is tested with a trailing slash, a file without
//   - patterns run in order per path; a plain pattern excludes, a "!" pattern
//     puts back what an earlier pattern excluded
//   - "**" crosses directories, "*" and "?" stay inside one name, dotfiles are
//     matched by both
//   - a path is uploaded only when it and every parent directory survive

export function workflowExcludePatterns(workflowRel: string = '.github/workflows/deploy.yml'): string[] {
  const lines = read(ROOT, workflowRel).split('\n');
  const start = lines.findIndex((line) => line.trim() === 'exclude: |');
  expectFound(start, `no "exclude: |" block in ${workflowRel}`);
  const keyIndent = lines[start].length - lines[start].trimStart().length;
  const patterns: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (line.length - line.trimStart().length <= keyIndent) break;
    patterns.push(line.trim());
  }
  return patterns;
}

function expectFound(index: number, message: string): void {
  if (index < 0) throw new Error(message);
}

function escapeLiteral(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function segmentToRegex(segment: string): string {
  return [...segment]
    .map((char) => (char === '*' ? '[^/]*' : char === '?' ? '[^/]' : escapeLiteral(char)))
    .join('');
}

function patternToRegExp(pattern: string): RegExp {
  const segments = pattern.split('/');
  let source = '^';
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (segment === '**') {
      source += last ? '.*' : '(?:.*/)?';
    } else {
      source += segmentToRegex(segment) + (last ? '/?' : '/');
    }
  });
  return new RegExp(`${source}$`);
}

type Rule = { negated: boolean; regex: RegExp };

export function compileRules(patterns: string[]): Rule[] {
  return patterns.map((raw) => {
    const negated = raw.startsWith('!');
    return { negated, regex: patternToRegExp(negated ? raw.slice(1) : raw) };
  });
}

// True when the pattern list leaves this entry out. `path` has no trailing
// slash; `isDir` appends it, as the upload does.
export function isExcluded(rules: Rule[], path: string, isDir: boolean): boolean {
  const item = isDir ? `${path}/` : path;
  let excluded = false;
  for (const rule of rules) {
    if (rule.regex.test(item)) excluded = !rule.negated;
  }
  return excluded;
}

// The files (relative paths) that survive: every parent directory and the file
// itself must survive.
export function survivors(files: string[], rules: Rule[]): string[] {
  const dirVerdict = new Map<string, boolean>();
  const dirKept = (dir: string): boolean => {
    let kept = dirVerdict.get(dir);
    if (kept === undefined) {
      const parent = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
      kept = (parent === '' || dirKept(parent)) && !isExcluded(rules, dir, true);
      dirVerdict.set(dir, kept);
    }
    return kept;
  };
  return files
    .filter((file) => {
      const parent = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
      return (parent === '' || dirKept(parent)) && !isExcluded(rules, file, false);
    })
    .sort();
}
