import { clearTeacherView, teacherViewName, teacherViewToken } from '../lib/teacher-view';

/**
 * 「你正在以某学生的视角查看」横幅（2026-08-25）。
 *
 * 教师视角和学生本人的界面**长得一模一样** —— 这正是它有用的原因，
 * 也正是它危险的原因：不标出来，教师会以为自己在看自己的页面，或者
 * 忘了自己还在别人的视角里。
 *
 * 横幅是常驻的（不可关闭），并明说**只读** —— 教师点了写操作会收到
 * 403 `teacher_view_is_read_only`，先在这里讲清楚比让他撞墙好。
 */
export default function TeacherViewBanner() {
  const tok = teacherViewToken();
  if (!tok) return null;
  const name = teacherViewName() || '该学生';
  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-white text-[13px] px-4 py-2 flex items-center justify-between gap-3">
      <span className="min-w-0 truncate">
        👁 教师视角 —— 你正在查看<strong className="mx-1">{name}</strong>的页面（<strong>只读</strong>，任何操作都不会写入）
      </span>
      <button
        onClick={() => {
          clearTeacherView();
          window.close();
          // window.close() 对非脚本打开的标签页无效 —— 兜底刷新，
          // 让页面回到「没有视角令牌」的状态
          window.location.reload();
        }}
        className="shrink-0 underline underline-offset-2"
      >
        退出视角
      </button>
    </div>
  );
}
