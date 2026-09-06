/**
 * 便笺（2026-09-06 第五轮盲测 3）
 *
 * 原来「+ 添加」用 window.prompt()：内嵌浏览器 / 部分 WebView 直接抛
 * "prompt() is not supported"，学生看到的就是按钮坏了。现在是页内的输入框。
 * 这里把 prompt 整个拿掉，保证组件一次都不碰它。
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StickyNoteRail } from '../lesson/shared/StickyNote';

describe('StickyNoteRail —— 不用 window.prompt', () => {
  const originalPrompt = window.prompt;
  beforeEach(() => {
    // 模拟内嵌浏览器：prompt 直接抛
    window.prompt = vi.fn(() => {
      throw new Error('prompt() is not supported.');
    }) as unknown as typeof window.prompt;
  });
  afterEach(() => {
    window.prompt = originalPrompt;
  });

  it('「+ 添加」打开页内输入框，保存后调用 onAdd', () => {
    const onAdd = vi.fn();
    render(<StickyNoteRail notes={[]} onAdd={onAdd} onEdit={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sticky-add'));
    const box = screen.getByLabelText('便笺内容');
    fireEvent.change(box, { target: { value: '第三段有线索' } });
    fireEvent.click(screen.getByTestId('sticky-save'));
    expect(onAdd).toHaveBeenCalledWith('第三段有线索');
    expect(window.prompt).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sticky-editor')).toBeNull();
  });

  it('回车也能保存；空内容不新增', () => {
    const onAdd = vi.fn();
    render(<StickyNoteRail notes={[]} onAdd={onAdd} onEdit={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sticky-add'));
    fireEvent.keyDown(screen.getByLabelText('便笺内容'), { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('sticky-add'));
    fireEvent.change(screen.getByLabelText('便笺内容'), { target: { value: 'ok' } });
    fireEvent.keyDown(screen.getByLabelText('便笺内容'), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('ok');
  });

  it('点已有便笺 → 编辑 / 删除', () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(
      <StickyNoteRail
        notes={[{ id: 'n1', text: '旧内容', createdAt: 1 }]}
        onAdd={vi.fn()}
        onEdit={onEdit}
        onRemove={onRemove}
      />,
    );
    // 有便笺时列表默认展开（第五轮复测），不用先点「便笺 (1)」
    fireEvent.click(screen.getByRole('button', { name: /旧内容/ }));
    fireEvent.change(screen.getByLabelText('便笺内容'), { target: { value: '新内容' } });
    fireEvent.click(screen.getByTestId('sticky-save'));
    expect(onEdit).toHaveBeenCalledWith('n1', '新内容');

    fireEvent.click(screen.getByRole('button', { name: /旧内容/ }));
    fireEvent.click(screen.getByTestId('sticky-delete'));
    expect(onRemove).toHaveBeenCalledWith('n1');
    expect(window.prompt).not.toHaveBeenCalled();
  });
});
