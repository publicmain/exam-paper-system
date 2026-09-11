import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '../Dialog';

/**
 * 审计 IOS-10 / IOS-11 —— 教师端模态对话框按 WAI-ARIA 模态对话框模式：
 * 焦点进入、Tab 不跑到背景、Esc 关闭、关闭后焦点归还、名称与模态语义、错误在框内。
 */
function Harness({ busy = false, error = null as string | null, onConfirm = () => {} }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        打开
      </button>
      <button type="button">背景按钮</button>
      <Dialog
        open={open}
        title="发布成绩？"
        description="发布后学生能看到成绩。"
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)}>
              返回检查
            </button>
            <button type="button" onClick={onConfirm}>
              确认发布
            </button>
          </>
        }
      />
    </div>
  );
}

describe('Dialog', () => {
  it('名称、描述、aria-modal；打开后焦点在框内；Tab / Shift+Tab 在框内循环', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: '打开' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: '发布成绩？' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('发布后学生能看到成绩。');
    const back = screen.getByRole('button', { name: '返回检查' });
    const confirm = screen.getByRole('button', { name: '确认发布' });
    expect(document.activeElement).toBe(back);

    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(back);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('Esc 关闭并把焦点还给打开它的按钮', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: '打开' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('请求进行中 Esc 不关闭；错误显示在对话框内', () => {
    const onConfirm = vi.fn();
    render(<Harness busy error="发布失败：网络断开" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(dialog).toContainElement(screen.getByRole('alert'));
    expect(screen.getByRole('alert')).toHaveTextContent('网络断开');
  });
});
