/**
 * 「学习时间有调整」一次性通知（叶老师 2026-09-21）。
 *
 * 每个学生第一次进首页弹一次：下午 4:30 词汇阅读课上做今日阅读和每日新词；
 * 复习、补做随时都可以做，落下的要尽快补上。
 *
 * 记号存的是「看过的那个学生」的摘要，不是 studentId（契约 §2.3 不许把 id 持久化）。
 * 它在 `sw:` 前缀下，退出登录时照常被扫掉 —— 共用设备换人登录，下一个人也会看到。
 * 以后要再发一次新的通知，换一个键名（v2）就行。
 */
import { ownerDigest } from './identity';

export const CLASS_TIME_NOTICE_KEY = 'sw:class-time-notice-v1';

export function classTimeNoticeSeen(studentId: string): boolean {
  try {
    return localStorage.getItem(CLASS_TIME_NOTICE_KEY) === ownerDigest(studentId);
  } catch {
    // 无痕模式读不了：宁可再弹一次，也别让学生错过
    return false;
  }
}

export function markClassTimeNoticeSeen(studentId: string): void {
  try {
    localStorage.setItem(CLASS_TIME_NOTICE_KEY, ownerDigest(studentId));
  } catch {
    /* 记不住就下次再弹 */
  }
}
