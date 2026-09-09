/**
 * 点已有高亮应该把它取消（2026-09-09 叶老师报：学生高亮之后取消不了）。
 *
 * 原因：阅读页给 Highlighter 传了 `onWordTap`（轻点查词，阶段 12C）。点在
 * 高亮上时，`pointerup` 先于 `click` 触发，查词弹窗抢先打开，`<mark>` 上的
 * 移除点击就没了下文 —— 学生看到的是「点高亮弹出查词卡，高亮还在」。
 *
 * 修法：轻点落在 `<mark>` 上时不走查词，让它归移除。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Highlighter } from '../lesson/shared/Highlighter';

const BODY = 'The girl opened her umbrella and walked to school.';

/**
 * jsdom 没有布局，`caretRangeFromPoint` 不存在，`wordAtPoint` 永远返回 null ——
 * 于是查词那条路在测试里根本不会触发，bug 也就复现不出来。这里按真实浏览器的
 * 行为把它桩上：落点解析成「点到了哪个文本节点的第几个字符」。
 */
function stubCaret(getTarget: () => { node: Node; offset: number } | null) {
  (document as unknown as { caretRangeFromPoint?: unknown }).caretRangeFromPoint = () => {
    const hit = getTarget();
    if (!hit) return null;
    const r = document.createRange();
    r.setStart(hit.node, hit.offset);
    r.setEnd(hit.node, hit.offset);
    return r;
  };
}

beforeEach(() => {
  (document as unknown as { caretRangeFromPoint?: unknown }).caretRangeFromPoint = undefined;
});
afterEach(() => {
  delete (document as unknown as { caretRangeFromPoint?: unknown }).caretRangeFromPoint;
});
const HIGHLIGHT = [{ id: 'h1', start: 4, end: 8 }]; // "girl"

function setup(withWordTap: boolean) {
  const onChange = vi.fn();
  const onWordTap = vi.fn();
  render(
    <Highlighter
      testId="passage"
      body={BODY}
      highlights={HIGHLIGHT}
      onChange={onChange}
      {...(withWordTap ? { onWordTap } : {})}
    />,
  );
  const mark = screen.getByText('girl');
  return { onChange, onWordTap, mark };
}

/** 真实浏览器里点一下的事件顺序：pointerdown → pointerup → click。 */
function tap(el: Element) {
  fireEvent.pointerDown(el, { clientX: 10, clientY: 10, pointerType: 'mouse' });
  fireEvent.pointerUp(el, { clientX: 10, clientY: 10, pointerType: 'mouse' });
  fireEvent.click(el, { clientX: 10, clientY: 10 });
}

describe('取消高亮', () => {
  it('点高亮 → 移除它', () => {
    const { onChange, mark } = setup(false);
    tap(mark);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('**查词开着时也要能取消** —— 点高亮不该被查词抢走', () => {
    const { onChange, onWordTap, mark } = setup(true);
    // 真实浏览器里点在高亮上，落点就在 mark 内的文本节点上
    stubCaret(() => ({ node: mark.firstChild as Node, offset: 1 }));
    tap(mark);
    expect(onWordTap).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('点没高亮的地方照常查词', () => {
    const { onChange, onWordTap } = setup(true);
    const passage = screen.getByTestId('passage');
    // 落点在高亮之外的正文上（"umbrella" 那一段）
    const plain = [...passage.childNodes].find(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.includes('umbrella'),
    ) as Node;
    stubCaret(() => ({ node: plain, offset: plain.textContent!.indexOf('umbrella') + 2 }));
    tap(plain.parentElement ?? passage);
    expect(onWordTap).toHaveBeenCalledWith('umbrella', expect.anything());
    expect(onChange).not.toHaveBeenCalled();
  });
});
