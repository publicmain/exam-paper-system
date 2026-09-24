/**
 * 给单个学生的警告弹窗（2026-09-24，叶老师：糊弄交卷的学生下次打开 App 要看到专属警告）。
 *
 * 一个很小的外部 store：App 层的 WarningNotifier 负责取和确认；首页的其他提醒（学习时间通知、
 * 还有测试没做）看 `useWarningActive` 决定要不要先让开，免得两个弹窗叠在一起。
 *
 * **警告跟登录令牌绑在一起**：共用设备上 A 没确认就退出、B 登录，B 看不到 A 的警告，
 * 而且会重新取 B 自己的（owner ≠ 当前令牌 → 视为没取过、列表为空）。
 */
import { useSyncExternalStore } from 'react';
import { api, type StudentNotice } from './api';
import { readToken } from './identity';

const EMPTY: StudentNotice[] = [];
let pending: StudentNotice[] = EMPTY;
let owner: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const mine = () => owner !== null && owner === readToken();

export function subscribeWarnings(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getWarnings = (): StudentNotice[] => (mine() ? pending : EMPTY);
/** 这个登录身份取过没有（进首页只取一次） */
export const warningsLoaded = (): boolean => mine();

/** 取还没确认的警告。取不到（网络 / 老师只读视角 403）就当没有，不打扰学生。 */
export async function loadWarnings(): Promise<void> {
  const token = readToken();
  if (!token) return;
  owner = token;
  pending = EMPTY;
  emit();
  let items: StudentNotice[] = EMPTY;
  try {
    const r = await api.studentNotices(token);
    items = Array.isArray(r?.items) && r.items.length ? r.items : EMPTY;
  } catch {
    items = EMPTY;
  }
  if (owner !== token) return; // 取的过程中换了人
  pending = items;
  emit();
}

/** 学生点了「我知道了」。服务端确认失败也先从眼前拿掉 —— 下次打开会再弹，不会丢。 */
export async function acknowledgeWarning(id: string): Promise<void> {
  const token = readToken();
  const rest = pending.filter((n) => n.id !== id);
  pending = rest.length ? rest : EMPTY;
  emit();
  if (!token) return;
  try {
    await api.readStudentNotice(token, id);
  } catch {
    /* 下次打开再弹 */
  }
}

/** 还有没确认的警告时，首页的其他弹窗先别出来。 */
export function useWarningActive(): boolean {
  return useSyncExternalStore(subscribeWarnings, getWarnings, getWarnings).length > 0;
}

export function __resetWarningsForTest(): void {
  pending = EMPTY;
  owner = null;
  emit();
}
