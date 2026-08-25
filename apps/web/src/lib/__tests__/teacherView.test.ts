import { beforeEach, describe, expect, it } from 'vitest';
import {
  adoptTeacherViewFromUrl,
  clearTeacherView,
  setTeacherView,
  teacherViewName,
  teacherViewToken,
} from '../teacher-view';

/**
 * 教师「以学生视角查看」的令牌保管（2026-08-25）。
 *
 * 这里守两条：
 *   1. 视角令牌进 sessionStorage，**绝不碰 localStorage.auth_token** ——
 *      碰了教师就把自己挤下线了
 *   2. 令牌不留在地址栏 —— 会进历史记录、Referer、截图
 */

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState({}, '', '/me');
});

describe('teacher-view 令牌保管', () => {
  it('存取清一条龙', () => {
    expect(teacherViewToken()).toBeNull();
    setTeacherView('tok-abc', '张三');
    expect(teacherViewToken()).toBe('tok-abc');
    expect(teacherViewName()).toBe('张三');
    clearTeacherView();
    expect(teacherViewToken()).toBeNull();
  });

  it('**不碰教师自己的 auth_token**', () => {
    localStorage.setItem('auth_token', 'teacher-token');
    setTeacherView('tok-abc', '张三');
    expect(localStorage.getItem('auth_token')).toBe('teacher-token');
    clearTeacherView();
    expect(localStorage.getItem('auth_token')).toBe('teacher-token');
  });
});

describe('adoptTeacherViewFromUrl', () => {
  it('从 URL 收下令牌，并把它从地址栏抹掉', () => {
    window.history.replaceState({}, '', '/me?viewToken=tok-xyz&viewName=%E6%9D%8E%E5%9B%9B');
    expect(adoptTeacherViewFromUrl()).toBe(true);
    expect(teacherViewToken()).toBe('tok-xyz');
    expect(teacherViewName()).toBe('李四');
    // 关键：地址栏里不能再有令牌
    expect(window.location.search).not.toContain('viewToken');
    expect(window.location.search).not.toContain('viewName');
  });

  it('没有令牌参数时什么都不做（学生本人的正常访问）', () => {
    window.history.replaceState({}, '', '/me?name=%E5%BC%A0%E4%B8%89');
    expect(adoptTeacherViewFromUrl()).toBe(false);
    expect(teacherViewToken()).toBeNull();
    // 别的查询参数不能被顺手删掉
    expect(window.location.search).toContain('name=');
  });
});
