/**
 * Adapted from echo-type/use-typing-reducer.ts, MIT License.
 * Copyright (c) 2026 Talljack
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Retains the correct-character advance / wrong-character stay transition.
 * Omits keystroke statistics, timers and error-word trails. State is memory-only.
 */
import { normalizeRecallSpelling } from '../../lib/recall-spelling';
export interface TypingState { expected: string; position: number; wrong: boolean; hadError: boolean }
export function initialTyping(text: string): TypingState {
  return { expected: normalizeRecallSpelling(text), position: 0, wrong: false, hadError: false };
}
export function typingReducer(state: TypingState, action: { type: 'KEY_PRESS'; key: string }): TypingState {
  if (state.position >= state.expected.length) return state;
  const typed = action.key === ' ' ? ' ' : normalizeRecallSpelling(action.key);
  if (typed === state.expected[state.position]) return { ...state, position: state.position + 1, wrong: false };
  return { ...state, wrong: true, hadError: true };
}
