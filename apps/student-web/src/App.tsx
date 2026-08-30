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
import ReadingPage from './pages/Reading';
import ReadingResultPage from './pages/ReadingResult';
import LessonVocabPage from './pages/LessonVocab';
import LessonTestPage from './pages/LessonTest';
import LessonSummaryPage from './pages/LessonSummary';
import ScoresPage from './pages/Scores';
import ScoreDetailPage from './pages/ScoreDetail';
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
      {/* 阶段 7C / 8A / 9A / 9B1 起只剩「今日总结」是占位。 */}
      <Route path={ROUTES.reading} element={<ReadingPage />} />
      <Route path={ROUTES.readingResult} element={<ReadingResultPage />} />
      <Route path={ROUTES.lessonVocab} element={<LessonVocabPage />} />
      <Route path={ROUTES.lessonTest} element={<LessonTestPage />} />
      <Route path={ROUTES.summary} element={<LessonSummaryPage />} />
      {/*
        历史成绩（阶段 11）—— **同一外壳里的独立页面**，不是七步链的一环。
        详情页的 `:submissionId` 是唯一的选择器；归属由服务端按令牌判定。
      */}
      <Route path={ROUTES.scores} element={<ScoresPage />} />
      <Route path={ROUTES.scoreDetail} element={<ScoreDetailPage />} />
      <Route path="*" element={<Navigate to={fallbackPath(authed)} replace />} />
    </Routes>
  );
}
