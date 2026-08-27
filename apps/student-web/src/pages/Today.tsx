/**
 * 今天的课 —— **阶段 4A 只是个占位**。
 *
 * 现在只显示「你好，{昵称}」和去账号设置的入口。**不读 `/lesson/today`、
 * 不渲染任何课程功能** —— 那是阶段 6 起的事。
 */
import { Link } from 'react-router-dom';
import { getState } from '../lib/auth-store';
import { ROUTES } from '../routes.contract';
import { Card, Screen } from '../ui';

export default function TodayPage() {
  const st = getState();
  const who = st.status === 'authenticated' ? st.profile.nickname || st.profile.name : '';
  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold mb-6">你好，{who}</h1>
        <p className="text-sm text-slate-500 mb-6">
          今天的课还没接上来 —— 这一版只做了登录和账号。
        </p>
        <Link to={ROUTES.account} className="text-blue-600 underline text-sm">
          账号设置 →
        </Link>
      </Card>
    </Screen>
  );
}
