/**
 * 简答题下面的「写作自查」提示条。
 *
 * 首发第一周判简答题，丢分里相当一部分是手误不是没懂：`bule`（blue）、
 * `internets`（interests）、`he away give wirter pen`、`she have a blue umbrella`。
 * 这些机器当场能指出来，学生自己订正完再交，判分人看到的就只剩内容问题。
 *
 * 三条界限，写在这里免得以后走样：
 *
 * 1. **只说英文写得对不对，不说答得对不对。** 它看不到参考答案，也永远不该看到。
 * 2. **只提示，不改。** 不提供「一键修正」——替学生改了，他下次还错。
 * 3. **不挡交卷。** 服务查不了、超时、功能没开，都当作没有提示，作答一切照常。
 */
import { useEffect, useRef, useState } from 'react';
import { api, type WritingIssue } from '../../lib/api';
import { readToken } from '../../lib/identity';

/** 停止输入多久之后才去查。太短会在打字中途反复报错，很烦人。 */
const IDLE_MS = 1200;

/**
 * 功能开关只查一次，整页共用 —— 每个文本框各查一次纯属浪费。
 * 查不到就当关着：宁可不显示，也不要在服务不可用时给学生一堆红字。
 */
export function useWritingCheckEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (cachedEnabled !== null) {
      setOn(cachedEnabled);
      return;
    }
    const token = readToken();
    if (!token) return;
    let alive = true;
    void api
      .writingCheckEnabled(token)
      .then((r) => {
        cachedEnabled = Boolean(r?.enabled);
        if (alive) setOn(cachedEnabled);
      })
      .catch(() => {
        cachedEnabled = false;
      });
    return () => {
      alive = false;
    };
  }, []);
  return on;
}

/** 一次会话里问一次就够。`null` = 还没问过。 */
let cachedEnabled: boolean | null = null;

/** 测试用：换页 / 换账号时把缓存清掉。 */
export function __resetWritingCheckCache() {
  cachedEnabled = null;
}

export function WritingHints({ text, enabled }: { text: string; enabled: boolean }) {
  const [issues, setIssues] = useState<WritingIssue[]>([]);
  const [checked, setChecked] = useState('');
  /** 请求代次 —— 慢的那一发回来时不能盖掉新的结果。 */
  const gen = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const body = text.trim();
    if (body.length < 12) {
      setIssues([]);
      setChecked('');
      return;
    }
    if (body === checked) return;
    const mine = ++gen.current;
    const timer = setTimeout(() => {
      const token = readToken();
      if (!token) return;
      void api
        .writingCheck(token, body)
        .then((r) => {
          if (mine !== gen.current) return;
          setIssues(r.issues ?? []);
          setChecked(body);
        })
        .catch(() => {
          // 查不了就当没提示 —— 绝不弹错误、绝不挡答题
          if (mine !== gen.current) return;
          setIssues([]);
        });
    }, IDLE_MS);
    return () => clearTimeout(timer);
  }, [text, enabled, checked]);

  if (!enabled || issues.length === 0) return null;

  return (
    <div
      data-testid="writing-hints"
      className="mt-2 rounded-lg border border-warning/35 bg-warning-soft px-3 py-2"
    >
      <p className="text-[13px] font-medium text-warning">
        这几处英文可能要改一下（只看拼写和语法，不判断答得对不对）
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {issues.map((issue, i) => (
          <li key={`${issue.offset}-${i}`} className="text-[13px] leading-6 text-warning">
            <span className="font-mono font-medium underline decoration-accent decoration-wavy underline-offset-2">
              {issue.text}
            </span>
            {issue.suggestions.length > 0 ? (
              <span> → {issue.suggestions.join(' / ')}</span>
            ) : (
              <span className="text-warning"> —— {issue.message}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
