import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { formatPhonetic } from '../lib/word-display';
import { splitSentences } from '../lesson/questions/IELTSReadingPassage';

/**
 * 旧 iPad / iPhone Safari 兼容（2026-09-14）。
 *
 * 学生的 iPad 进「单词」必崩（「页面出了点问题」）：学词卡调 formatPhonetic，
 * 里面有一条后行断言正则 `(?<=…)`。Safari 到 16.4 才支持后行断言，更早的版本
 * 能打开应用，但一执行到这条正则就抛 SyntaxError，整页进错误边界。
 * Vite / esbuild 不会改写正则，所以只能在源码里不用。
 */

const SRC = path.resolve(__dirname, '..');

function allSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allSourceFiles(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** 剥掉注释再扫：注释里写明「为什么不用后行断言」是有价值的，不能判死。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('旧 Safari 兼容 —— 源码里不许出现正则后行断言', () => {
  it('学生端源码（不含测试）没有 (?<= 或 (?<!', () => {
    const hits = allSourceFiles(SRC)
      .filter((f) => !f.includes('__tests__'))
      .flatMap((f) =>
        stripComments(fs.readFileSync(f, 'utf8'))
          .split('\n')
          .map((line, i) => ({ f: path.relative(SRC, f), line: i + 1, text: line }))
          .filter((l) => /\(\?<[=!]/.test(l.text)),
      );
    expect(hits.map((h) => `${h.f}:${h.line} ${h.text.trim()}`)).toEqual([]);
  });
});

describe('去掉后行断言后行为不变', () => {
  // 测试跑在 Node 里，Node 支持后行断言 —— 用原来的正则当对照。
  const oldPhoneticDots = (s: string) => s.replace(new RegExp('(?<=[^\\s])\\.(?=[^\\s])', 'g'), '');
  const oldSplit = (s: string) => s.split(new RegExp('(?<=[.!?][\'"’”]?)\\s+'));

  it('formatPhonetic 的音节点处理与原正则一致', () => {
    for (const raw of ['ˈsɪl.vər', '/ˈæs.ɪd/', 'ə.ˈbaʊt', 'a..b', '.ab', 'ab.', 'a .b', 'a. b', 'ˌɪn.fər.ˈmeɪ.ʃən']) {
      const expected = oldPhoneticDots(raw.replace(/[[\]/]/g, '')).replace(/\s+/g, ' ').trim();
      expect(formatPhonetic(raw)).toBe(expected ? `/${expected}/` : null);
    }
  });

  it('splitSentences 与原来的 split 结果一致', () => {
    const samples = [
      'The ships rest in the harbour. Then they sail again!',
      'He said, "Stop." Then he left. Did he? Yes.',
      '“I did it,” I said. “On Saturday.” He looked away.',
      'No punctuation here at all',
      'Ends with a space. ',
      '  Leading spaces. Two  spaces.   Three.',
      "It's Mr Ng's class. Dr. Tan arrived at 3.5 p.m. and left.",
      'Wait?! Really... Okay.',
    ];
    for (const s of samples) expect(splitSentences(s)).toEqual(oldSplit(s));
  });
});
