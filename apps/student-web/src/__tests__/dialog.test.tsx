/**
 * 模态对话框（审计 UI12 / IOS-11，WAI-ARIA APG「Dialog (Modal)」）。
 *
 * 原症状：交卷报错条（z20）在仍然打开的确认框（z40）后面，学生看不见；交卷 / 退出弹窗
 * 没有完整的焦点管理。这里钉住组件本身：焦点进出、Tab 限制、Esc、忙碌时不能关、
 * 错误显示在窗内、名称与模态语义。
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Dialog } from '../design/Dialog';

function Harness({ busy = false, error }: { busy?: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>打开</button>
      <button>背景里的按钮</button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="确认交卷？"
        description="交卷之后这份答卷就锁定了。"
        busy={busy}
        error={error}
        footer={
          <>
            <button onClick={() => setOpen(false)}>继续答题</button>
            <button>确认交卷</button>
          </>
        }
      />
    </div>
  );
}

describe('Dialog 焦点与语义', () => {
  it('**打开后焦点进入窗内**，名称与模态语义齐全', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '打开' }));
    const dlg = screen.getByRole('dialog', { name: '确认交卷？' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.getAttribute('aria-describedby')).toBeTruthy();
    expect(dlg.contains(document.activeElement)).toBe(true);
  });

  it('**Tab / Shift+Tab 在窗内循环，不跑到背景**', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '打开' }));
    const dlg = screen.getByRole('dialog');
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      expect(dlg.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab({ shift: true });
      expect(dlg.contains(document.activeElement)).toBe(true);
    }
  });

  it('**Esc 关闭，焦点回到打开它的按钮**', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: '打开' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('**请求在途（busy）时 Esc 不关** —— 否则学生看不见交卷结果', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="确认交卷？" busy footer={<button>确认交卷</button>} />,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('**错误显示在窗内**（role=alert），不在被遮住的页面上', async () => {
    render(<Harness error="交卷没成功 —— 你的答案都在。" />);
    await userEvent.click(screen.getByRole('button', { name: '打开' }));
    const dlg = screen.getByRole('dialog');
    const alert = screen.getByRole('alert');
    expect(dlg.contains(alert)).toBe(true);
    expect(alert.textContent).toContain('交卷没成功');
  });
});
