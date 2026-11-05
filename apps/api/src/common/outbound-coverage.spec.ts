import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import ts from 'typescript';

// Review aid: catch a newly added raw fetch or an SDK constructor that bypasses
// the gate. Never read excluded files, local working files, or database tests.
const excluded = new Set(['.local', 'node_modules', 'dist', '.git',
  'fix-2026-08-13-makeup.ts', 'login-name-match.spec.ts', 'name-suggest.spec.ts']);
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (excluded.has(entry.name) || entry.isSymbolicLink()) return [];
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.(?:ts|js|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('outbound source coverage', () => {
  it('contains no unguarded fetch or Anthropic constructor in readable API source/scripts', () => {
    const violations: string[] = [];
    for (const path of [...files(resolve('src')), ...files(resolve('scripts'))]) {
      const label = relative(process.cwd(), path).replace(/\\/g, '/');
      const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      const check = (node: ts.Node) => {
        if (ts.isCallExpression(node) &&
          (node.expression.getText(source) === 'fetch' || node.expression.getText(source) === 'globalThis.fetch') &&
          !['src/common/outbound-gate.ts', 'src/common/outbound-policy.cjs'].includes(label)) {
          violations.push(`${label}: raw fetch`);
        }
        if (ts.isNewExpression(node) && node.expression.getText(source) === 'Anthropic') {
          const options = node.arguments?.[0]?.getText(source) ?? '';
          if (!options.includes("outboundFetch('anthropic'")) violations.push(`${label}: SDK transport bypass`);
        }
        ts.forEachChild(node, check);
      };
      check(source);
    }
    expect(violations).toEqual([]);
  });
});
