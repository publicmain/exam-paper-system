/**
 * 路由外壳。
 *
 * 路由表**由 `routes.contract.ts` 生成** —— 那里是单一事实源，
 * 测试断言这两边逐项相等（守卫 G6）。
 *
 * 未知 URL 的落点只有两个：已登录 → `/today`，未登录 → `/login`。
 * **没有第三种兜底** —— 旧端有三个不同的 `*` 目标（`/login`、`/student`、
 * `/my-history`），那正是它外壳混乱的症状之一。
 */
import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { bootstrap, getState, subscribe } from './lib/auth-store';
import { ROUTES, fallbackPath } from './routes.contract';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import TodayPage from './pages/Today';
import AccountPage from './pages/Account';
import LessonPlaceholder from './pages/LessonPlaceholder';
import { Screen } from './ui';

export default function App() {
  const state = useSyncExternalStore(subscribe, getState, getState);
  const loc = useLocation();

  useEffect(() => {
    void bootstrap();
  }, []);

  if (state.status === 'loading') {
    return (
      <Screen>
        <p className="text-center text-slate-400">载入中…</p>
      </Screen>
    );
  }

  const authed = state.status === 'authenticated';
  const isPublic = loc.pathname === ROUTES.login || loc.pathname === ROUTES.register;

  // 未登录闯私有页 → 登录页。**不是姓名页**（契约 §2.3）。
  if (!authed && !isPublic) {
    return <Navigate to={ROUTES.login} replace />;
  }
  // 已登录还停在登录/注册页 → 送去今天的课
  if (authed && isPublic) {
    return <Navigate to={ROUTES.today} replace />;
  }

  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.register} element={<RegisterPage />} />
      <Route path={ROUTES.today} element={<TodayPage />} />
      <Route path={ROUTES.account} element={<AccountPage />} />
      {/*
        五条课程路由 —— 阶段 6A 起**真的注册**，渲染统一占位页。
        阶段 7–10 各自实现时只替换这里的组件，路径不动。
      */}
      <Route path={ROUTES.reading} element={<LessonPlaceholder stage="reading" />} />
      <Route path={ROUTES.readingResult} element={<LessonPlaceholder stage="readingResult" />} />
      <Route path={ROUTES.lessonVocab} element={<LessonPlaceholder stage="lessonVocab" />} />
      <Route path={ROUTES.lessonTest} element={<LessonPlaceholder stage="lessonTest" />} />
      <Route path={ROUTES.summary} element={<LessonPlaceholder stage="summary" />} />
      <Route path="*" element={<Navigate to={fallbackPath(authed)} replace />} />
    </Routes>
  );
}
