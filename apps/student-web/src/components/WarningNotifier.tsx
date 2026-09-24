/**
 * 给单个学生的警告弹窗（2026-09-24）。
 *
 * 学生打开 App 进首页时取一次自己还没确认的警告（和徽章通知一样只在首页取，别的页面不多发请求）；
 * 有就弹出来，**点遮罩 / Esc 关不掉**，要读完、
 * 等 5 秒倒计时结束，点「我知道了」才关，关了服务端记已读、不再弹。一次只弹一条。
 * 警告开着的时候，首页的其他提醒先让开（见 lib/student-notices 的 useWarningActive）。
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '../routes.contract';
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { Icon } from '../design/Icon';
import { acknowledgeWarning, getWarnings, loadWarnings, subscribeWarnings, warningsLoaded } from '../lib/student-notices';

export const WARNING_READ_SECONDS = 5;

export default function WarningNotifier() {
  const warnings = useSyncExternalStore(subscribeWarnings, getWarnings, getWarnings);
  const current = warnings[0] ?? null;
  const [left, setLeft] = useState(WARNING_READ_SECONDS);
  const okRef = useRef<HTMLButtonElement>(null);

  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === ROUTES.today && !warningsLoaded()) void loadWarnings();
  }, [pathname]);

  // 每一条都重新倒计时
  useEffect(() => {
    if (!current) return;
    setLeft(WARNING_READ_SECONDS);
    const timer = window.setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [current?.id]);

  if (!current) return null;
  const paragraphs = (current.body ?? '').split(/\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <Dialog
      open
      dismissible={false}
      onClose={() => {}}
      title={current.title}
      size="sm"
      testId="effort-warning"
      initialFocusRef={okRef}
      footer={
        <Button
          ref={okRef}
          variant="destructive"
          disabled={left > 0}
          data-testid="effort-warning-ok"
          onClick={() => void acknowledgeWarning(current.id)}
        >
          {left > 0 ? `请先读完（${left}）` : '我知道了，以后认真做'}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        <div className="flex items-center gap-2 rounded-[12px] bg-danger-soft px-3 py-2 text-danger">
          <Icon name="alert" size={22} />
          <span className="text-headline font-bold">老师给你的警告</span>
        </div>
        {paragraphs.map((p, i) => (
          <p key={i} className={i === 0 ? 'text-callout font-semibold text-ink' : 'text-callout text-ink'}>
            {p}
          </p>
        ))}
      </div>
    </Dialog>
  );
}
