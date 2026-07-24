import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hwApi } from '../lib/api-homework';

/**
 * v2 — in-app notification bell (teacher + student navs). Polls every 60s;
 * no push infra by design (school-scale, PRD §4). Clicking an item marks
 * it read and jumps to its link.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const d = await hwApi.notifications();
      setUnread(d.unread);
      setItems(d.items);
    } catch {
      /* signed out or offline — bell stays quiet */
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        className="relative w-9 h-9 rounded-full hover:bg-black/5 flex items-center justify-center text-lg"
        title="通知" onClick={() => setOpen(!open)}>
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-[#E0061F] text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto bg-white border border-[#C7CDD1] rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#E8EAEC] sticky top-0 bg-white">
            <span className="text-sm font-semibold text-[#2D3B45]">通知</span>
            {unread > 0 && (
              <button className="text-xs text-[#0374B5] hover:underline"
                onClick={async () => { await hwApi.markNotificationsRead(); refresh(); }}>
                全部已读
              </button>
            )}
          </div>
          {items.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">暂无通知</div>
          )}
          {items.map((n) => (
            <button key={n.id}
              className={`block w-full text-left px-3 py-2.5 border-b border-[#F0F2F5] hover:bg-[#F5F8FA] ${n.readAt ? 'opacity-60' : ''}`}
              onClick={async () => {
                await hwApi.markNotificationsRead([n.id]).catch(() => {});
                setOpen(false);
                refresh();
                if (n.link) nav(n.link);
              }}>
              <span className="flex items-start gap-2">
                <span className="text-base leading-6">
                  {n.type === 'hw_assigned' ? '📚' : n.type === 'hw_returned' ? '✅' : '💬'}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#2D3B45] truncate">{n.title}</span>
                  {n.body && <span className="block text-xs text-[#6B7780] truncate">{n.body}</span>}
                  <span className="block text-[11px] text-gray-400 mt-0.5">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </span>
                {!n.readAt && <span className="ml-auto mt-1.5 w-2 h-2 rounded-full bg-[#0374B5] shrink-0" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
