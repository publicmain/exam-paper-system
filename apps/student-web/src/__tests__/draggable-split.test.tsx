/**
 * 分栏拖动（审计 UI08）与窄屏跳转（IOS-05）。
 *
 * 原症状：分栏处理 touchend 但不处理 touchcancel；模拟「开始 → 取消 → 普通移动」后比例
 * 仍被改到 70%，而且还在拦截页面滚动。这里用指针事件逐条钉住。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DraggableSplit } from '../lesson/shared/DraggableSplit';

const KEY = 'sw:reading:split:test';

// jsdom 没有带 pointerId / clientX 的 PointerEvent —— 补一个最小实现
if (typeof window.PointerEvent === 'undefined' || !('pointerId' in new window.PointerEvent('pointerdown'))) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
}

function mockWidth(w: number) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ x: 0, y: 0, left: 0, top: 0, right: w, bottom: 800, width: w, height: 800, toJSON: () => ({}) }) as DOMRect,
  );
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function mount() {
  return render(
    <DraggableSplit storageKey={KEY} initial={0.5} left={<p>原文内容</p>} right={<input aria-label="第一题答案" />} testId="split" />,
  );
}

const ratio = () => Number(screen.getByRole('separator').getAttribute('aria-valuenow'));

describe('UI08 拖动生命周期', () => {
  it('**开始 → 取消 → 普通移动：比例不变**', () => {
    mockWidth(1000);
    mount();
    const sep = screen.getByRole('separator');
    fireEvent.pointerDown(sep, { pointerId: 7, button: 0, clientX: 500 });
    fireEvent.pointerCancel(sep, { pointerId: 7 });
    fireEvent.pointerMove(sep, { pointerId: 7, clientX: 700 });
    expect(ratio()).toBe(50);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('失去指针捕获同样结束拖动', () => {
    mockWidth(1000);
    mount();
    const sep = screen.getByRole('separator');
    fireEvent.pointerDown(sep, { pointerId: 3, button: 0, clientX: 500 });
    fireEvent(sep, new window.PointerEvent('lostpointercapture', { bubbles: true, pointerId: 3 }));
    fireEvent.pointerMove(sep, { pointerId: 3, clientX: 650 });
    expect(ratio()).toBe(50);
  });

  it('正常拖动：只认按下的那个指针，松开后不再跟随', () => {
    mockWidth(1000);
    mount();
    const sep = screen.getByRole('separator');
    fireEvent.pointerDown(sep, { pointerId: 1, button: 0, clientX: 500 });
    fireEvent.pointerMove(sep, { pointerId: 2, clientX: 900 }); // 另一根手指，不理
    expect(ratio()).toBe(50);
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 600 });
    expect(ratio()).toBe(60);
    fireEvent.pointerUp(sep, { pointerId: 1 });
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 400 });
    expect(ratio()).toBe(60);
    expect(localStorage.getItem(KEY)).toBe('0.6');
  });

  it('窗口失焦（切到后台、来电）结束拖动', () => {
    mockWidth(1000);
    mount();
    const sep = screen.getByRole('separator');
    fireEvent.pointerDown(sep, { pointerId: 1, button: 0, clientX: 500 });
    fireEvent(window, new Event('blur'));
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 650 });
    expect(ratio()).toBe(50);
  });

  it('**比例夹在 30%–70%**，拖到边外也不会把一栏挤没', () => {
    mockWidth(1000);
    mount();
    const sep = screen.getByRole('separator');
    fireEvent.pointerDown(sep, { pointerId: 1, button: 0, clientX: 500 });
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 990 });
    expect(ratio()).toBe(70);
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 5 });
    expect(ratio()).toBe(30);
  });

  it('键盘替代：← → 调整、Home / End 到两头；读屏名字是中文', () => {
    mockWidth(1000);
    mount();
    const sep = screen.getByRole('separator', { name: '调整原文和题目的宽度' });
    sep.focus();
    fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(ratio()).toBe(52);
    fireEvent.keyDown(sep, { key: 'End' });
    expect(ratio()).toBe(70);
    fireEvent.keyDown(sep, { key: 'Home' });
    expect(ratio()).toBe(30);
  });

  it('拖柄只拦自己的手势（touch-action: none），不影响页面滚动', () => {
    mockWidth(1000);
    mount();
    expect((screen.getByRole('separator') as HTMLElement).style.touchAction).toBe('none');
  });
});

describe('IOS-05 按容器宽度决定分栏 / 窄屏跳转', () => {
  it('**容器窄于 900px 就不分栏**（带侧栏的 1024 宽 iPad 横屏也算窄）', () => {
    mockWidth(792);
    mount();
    expect(screen.getByTestId('split').getAttribute('data-layout')).toBe('stacked');
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('窄屏：两块都在文档里；切到「题目」再切回来，填了一半的答案还在', () => {
    mockWidth(390);
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    mount();
    expect(screen.getByText('原文内容')).toBeTruthy();
    const input = screen.getByLabelText('第一题答案') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'half' } });
    fireEvent.click(screen.getByTestId('jump-right'));
    fireEvent.click(screen.getByTestId('jump-left'));
    expect((screen.getByLabelText('第一题答案') as HTMLInputElement).value).toBe('half');
    expect(scrollTo).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
