/**
 * 学生端单独打包（Railway 只上传 apps/student-web），不能 import 后端源码，
 * 所以切句规则在学生端有一份拷贝。后端是本体（音频哈希按它算），两份必须逐字一致，
 * 否则学生端切出的句子对不上音频。改后端时把文件整份拷过来。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('切句规则两份拷贝一致', () => {
  it('apps/student-web/src/lib/sentences.ts 与 apps/api/src/audio/sentences.ts 逐字相同', () => {
    const here = resolve(__dirname, '..', 'lib', 'sentences.ts');
    const api = resolve(__dirname, '..', '..', '..', 'api', 'src', 'audio', 'sentences.ts');
    const norm = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    expect(norm(here)).toBe(norm(api));
  });
  it('学生端源码不 import 学生端目录以外的文件', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const root = resolve(__dirname, '..');
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = resolve(dir, name);
        if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
          if (!resolve(dir, m[1]).startsWith(resolve(root, '..'))) bad.push(`${p}: ${m[1]}`);
        }
      }
    };
    walk(root);
    expect(bad).toEqual([]);
  });
});
