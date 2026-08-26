import { beforeEach, describe, expect, it } from 'vitest';
import { lessonLaunchRedirect, shouldRedirectToLesson } from '../lesson-entry';

/**
 * PWA 启动跳转（4.0 入口）。
 *
 * 这里守的是一条双向的约束：
 *   · 从主屏图标打开 → **必须**落到今天的课（否则 4.0 对学生不存在）
 *   · 其余任何访问 → **绝不能**被弹走（否则想看成绩的人被困在循环里）
 */

const base = {
  standalone: true,
  search: '',
  savedName: '张三',
  alreadyRedirected: false,
};

describe('shouldRedirectToLesson', () => {
  it('主屏启动（standalone + 裸 URL + 存过名字）→ 跳', () => {
    expect(shouldRedirectToLesson(base)).toBe(true);
  });

  it('浏览器里打开 → 不跳（他们就是想看成绩）', () => {
    expect(shouldRedirectToLesson({ ...base, standalone: false })).toBe(false);
  });

  it('带任何查询参数 → 不跳（深链/页内导航/分享链接）', () => {
    for (const search of ['?name=%E5%BC%A0%E4%B8%89', '?submissionId=x', '?from=lesson']) {
      expect(shouldRedirectToLesson({ ...base, search })).toBe(false);
    }
  });

  it('没存过名字 → 不跳（跳过去也是白屏，留在原页输名字）', () => {
    expect(shouldRedirectToLesson({ ...base, savedName: null })).toBe(false);
    expect(shouldRedirectToLesson({ ...base, savedName: '  ' })).toBe(false);
  });

  it('本会话已跳过一次 → 不再跳（防「想看成绩永远被弹走」的死循环）', () => {
    expect(shouldRedirectToLesson({ ...base, alreadyRedirected: true })).toBe(false);
  });
});

describe('lessonLaunchRedirect（副作用版）', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/my-history');
  });

  it('非 standalone 环境（jsdom 默认）→ null，什么都不写', () => {
    localStorage.setItem('mq:history:name', '张三');
    expect(lessonLaunchRedirect()).toBeNull();
    expect(sessionStorage.getItem('lesson:launch-redirected')).toBeNull();
  });

  it('standalone 下带 studentId 一起带走', () => {
    localStorage.setItem('mq:history:name', '张三');
    localStorage.setItem('mq:history:studentId', 'stu-1');
    (navigator as any).standalone = true;
    try {
      const url = lessonLaunchRedirect();
      expect(url).toBe('/my-lesson?name=%E5%BC%A0%E4%B8%89&studentId=stu-1');
      // 标记已写，第二次调用不再跳
      expect(lessonLaunchRedirect()).toBeNull();
    } finally {
      delete (navigator as any).standalone;
    }
  });
});
