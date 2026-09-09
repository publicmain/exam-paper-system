import { afterEach, describe, expect, it, vi } from 'vitest';
import { WritingCheckService } from './writing-check.service';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function ltResponse(matches: unknown[]) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ matches }),
  } as unknown as Response);
}

describe('写作自查', () => {
  it('没配 LANGUAGETOOL_URL → 功能关闭，接口回 503', async () => {
    vi.stubEnv('LANGUAGETOOL_URL', '');
    const svc = new WritingCheckService();
    expect(svc.enabled()).toBe(false);
    await expect(svc.check('some text here')).rejects.toMatchObject({
      response: { code: 'writing_check_disabled' },
    });
  });

  it('地址带不带 /v2 都能拼对', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => { seen.push(url); return ltResponse([]); }));
    for (const base of ['http://lt:8010', 'http://lt:8010/', 'http://lt:8010/v2', 'http://lt:8010/v2/']) {
      vi.stubEnv('LANGUAGETOOL_URL', base);
      await new WritingCheckService().check('a sentence long enough');
    }
    expect(seen).toEqual([
      'http://lt:8010/v2/check',
      'http://lt:8010/v2/check',
      'http://lt:8010/v2/check',
      'http://lt:8010/v2/check',
    ]);
  });

  it('把 LanguageTool 的结果压成学生端要的形状', async () => {
    vi.stubEnv('LANGUAGETOOL_URL', 'http://lt:8010');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        ltResponse([
          {
            offset: 13,
            length: 6,
            message: 'Possible spelling mistake found.',
            rule: { issueType: 'misspelling' },
            replacements: [{ value: 'writer' }, { value: 'winter' }, { value: 'Winter' }, { value: 'wither' }],
          },
          {
            offset: 3,
            length: 4,
            shortMessage: '主谓不一致',
            message: 'The pronoun he is usually used with a third-person verb.',
            rule: { issueType: 'grammar' },
            replacements: [{ value: 'gives' }],
          },
        ]),
      ),
    );
    const { issues } = await new WritingCheckService().check('he away give wirter pen');
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ kind: 'spelling', text: 'wirter' });
    // 建议最多留三条，多了学生挑不过来
    expect(issues[0].suggestions).toEqual(['writer', 'winter', 'Winter']);
    expect(issues[1]).toMatchObject({ kind: 'grammar', message: '主谓不一致' });
  });

  it('LanguageTool 挂了 → 回空结果，绝不挡住学生答题', async () => {
    vi.stubEnv('LANGUAGETOOL_URL', 'http://lt:8010');
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))));
    await expect(new WritingCheckService().check('a sentence long enough')).resolves.toEqual({ issues: [] });
  });

  it('返回 500 也当作查不了，不抛给学生', async () => {
    vi.stubEnv('LANGUAGETOOL_URL', 'http://lt:8010');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 } as unknown as Response)));
    await expect(new WritingCheckService().check('a sentence long enough')).resolves.toEqual({ issues: [] });
  });

  it('只要拼写和语法，不要风格说教', async () => {
    vi.stubEnv('LANGUAGETOOL_URL', 'http://lt:8010');
    let sentBody = '';
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => { sentBody = String(init.body); return ltResponse([]); }));
    await new WritingCheckService().check('a sentence long enough');
    expect(sentBody).toContain('language=en-GB');
    expect(sentBody).toContain('STYLE');
  });
});
