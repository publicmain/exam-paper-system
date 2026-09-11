/**
 * 通知里的学生端链接不带姓名（身份规则 + 审计 S02 收尾）。
 *
 * 源码级守卫：score_ready 的两个发出点都用 scoreResultPath()，仓库里不再有
 * `/my-history?name=` 这种把姓名放进 URL 的链接。
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { scoreResultPath } from './student-links';

const SRC = path.join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

describe('学生端链接', () => {
  it('指向学生端 canonical 的 /scores/:submissionId，只有答卷 id', () => {
    expect(scoreResultPath('sub-1')).toBe('/scores/sub-1');
    expect(scoreResultPath('a/b?name=x')).toBe('/scores/a%2Fb%3Fname%3Dx');
  });

  it('**源码里不再有把姓名放进 URL 的旧链接**', () => {
    const hits = walk(SRC).filter((f) => /['"`]\/my-history\?name=/.test(fs.readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('score_ready 的两个发出点都用 scoreResultPath()', () => {
    for (const rel of ['morning-quiz/morning-quiz.cron.ts', 'student/student.service.ts']) {
      const text = fs.readFileSync(path.join(SRC, rel), 'utf8');
      expect(text, rel).toMatch(/resultUrl: scoreResultPath\(/);
    }
  });
});
