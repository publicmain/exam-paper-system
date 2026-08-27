import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyVocabReviewPage from '../MyVocabReview';
import { api } from '../../lib/api';

/**
 * 交卷后生词环节的分流。
 *
 * 2026-08-14 把交卷后的必经环节从翻卡换成客观自测，理由是翻卡的「我记得」
 * 是自评、信号不真实。但那次只考虑了**答错自动采集的词** —— 学生在读文章
 * 时见过它们。
 *
 * 2026-08-24 加了短文层（雅思轻量 / O-Level 基础）之后出现新情况：那两层
 * 的词表是**建场时老师推进来的**，学生从没见过；而 StudentWord.due 默认
 * 就是 now()，一进本子就算到期、立刻进自测题库。直接考的结果是全错，更糟
 * 的是答错会回写 FSRS 把这批词标成「困难」，往后天天来烦他。
 *
 * 所以补了一条前置：**有没学过的词（reps===0）就先翻卡，看完再考。**
 */

vi.mock('../../lib/api', () => ({
  api: { vocabLessonCards: vi.fn(), vocabDue: vi.fn(), vocabReview: vi.fn().mockResolvedValue({}) },
}));

const card = (over: Partial<any> = {}) => ({
  headword: 'nutrient',
  surfaceForm: 'nutrients',
  contextSentence: 'The roots sit in a thin film of water carrying dissolved nutrients.',
  sourcePassageTitle: 'Farming Upwards',
  phonetic: null,
  translation: 'n. 营养物质',
  tag: ['ielts'],
  state: 'new',
  reps: 0,
  ...over,
});

function renderReview(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/my-vocab/review${search}`]}>
      <Routes>
        <Route path="/my-vocab/review" element={<MyVocabReviewPage />} />
        <Route path="/my-vocab/quiz" element={<div>QUIZ PAGE</div>} />
        <Route path="/my-history/submission/:id" element={<div>RESULT PAGE</div>} />
        <Route path="/my-history" element={<div>HISTORY PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const AFTER_SUBMIT = '?name=%E5%BC%A0%E4%B8%89&after=submit&then=%2Fmy-history%2Fsubmission%2Fs1';

beforeEach(() => vi.clearAllMocks());

describe('交卷后的生词分流', () => {
  it('有没学过的新词 → 先翻卡，不直接考', async () => {
    (api.vocabLessonCards as any).mockResolvedValue({ lessonContext: false, cards: [] });
  (api.vocabDue as any).mockResolvedValue({
      cards: [card(), card({ headword: 'wavelength', reps: 0 }), card({ headword: 'stack', reps: 0 }),
        card({ headword: 'absorb', reps: 3 })],
    });
    renderReview(AFTER_SUBMIT);
    // 停在翻卡页，而不是被送进自测
    await waitFor(() => expect(screen.getByText(/今日生词/)).toBeInTheDocument());
    expect(screen.queryByText('QUIZ PAGE')).toBeNull();
  });

  // P5：徽标从「新词」改成「第一次学」—— 语义从「这个词是新的」
  // 变成「这一张是教学卡，不是考你」。意图不变：学生要知道这不是自己忘了。
  it('新词卡片上标「第一次学」—— 学生要知道这不是自己忘了', async () => {
    (api.vocabLessonCards as any).mockResolvedValue({ lessonContext: false, cards: [] });
  (api.vocabDue as any).mockResolvedValue({ cards: [card()] });
    renderReview(AFTER_SUBMIT);
    await waitFor(() => expect(screen.getByText('第一次学')).toBeInTheDocument());
  });

  it('全是复习过的词且够 4 个 → 直接进自测（保持 08-14 的设计）', async () => {
    (api.vocabLessonCards as any).mockResolvedValue({ lessonContext: false, cards: [] });
  (api.vocabDue as any).mockResolvedValue({
      cards: [card({ reps: 2 }), card({ headword: 'b', reps: 1 }),
        card({ headword: 'c', reps: 5 }), card({ headword: 'd', reps: 3 })],
    });
    renderReview(AFTER_SUBMIT);
    await waitFor(() => expect(screen.getByText('QUIZ PAGE')).toBeInTheDocument());
  });

  it('复习过的词不足 4 个 → 翻卡（出不了像样的选择题）', async () => {
    (api.vocabLessonCards as any).mockResolvedValue({ lessonContext: false, cards: [] });
  (api.vocabDue as any).mockResolvedValue({
      cards: [card({ reps: 2 }), card({ headword: 'b', reps: 1 })],
    });
    renderReview(AFTER_SUBMIT);
    await waitFor(() => expect(screen.getByText(/今日生词/)).toBeInTheDocument());
    expect(screen.queryByText('QUIZ PAGE')).toBeNull();
  });

  it('一个词都没有 → 立刻放行去成绩页，绝不挡路', async () => {
    (api.vocabLessonCards as any).mockResolvedValue({ lessonContext: false, cards: [] });
  (api.vocabDue as any).mockResolvedValue({ cards: [] });
    renderReview(AFTER_SUBMIT);
    await waitFor(() => expect(screen.getByText('RESULT PAGE')).toBeInTheDocument());
  });

  it('接口挂了也放行 —— 复习是锦上添花，成绩才是学生来的目的', async () => {
    (api.vocabDue as any).mockRejectedValue(new Error('boom'));
    renderReview(AFTER_SUBMIT);
    await waitFor(() => expect(screen.getByText('RESULT PAGE')).toBeInTheDocument());
  });
});

describe('学生主动来练（非交卷流程）', () => {
  const SELF = '?name=%E5%BC%A0%E4%B8%89';

  it('到期队列空时不把人赶走，给一条继续学的路', async () => {
    // 学生是专门点进来背词的。只说「今天没有了」就跳走，等于告诉他
    // 「不用学了」—— 而本子里通常还压着几百个从没碰过的词。
    (api.vocabLessonCards as any).mockResolvedValue({ lessonContext: false, cards: [] });
  (api.vocabDue as any).mockResolvedValue({ cards: [] });
    renderReview(SELF);
    await waitFor(() => expect(screen.getByText(/今天到期的都复习完了/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /做一轮自测/ })).toBeInTheDocument();
    // 没有被踢回成绩页
    expect(screen.queryByText('HISTORY PAGE')).toBeNull();
  });

  it('主动进来且有新词时照常翻卡，不会被送进自测', async () => {
    (api.vocabLessonCards as any).mockResolvedValue({ lessonContext: false, cards: [] });
  (api.vocabDue as any).mockResolvedValue({
      cards: [card(), card({ headword: 'b', reps: 0 }), card({ headword: 'c', reps: 0 }),
        card({ headword: 'd', reps: 0 }), card({ headword: 'e', reps: 0 })],
    });
    renderReview(SELF);
    await waitFor(() => expect(screen.getByText(/今日生词/)).toBeInTheDocument());
    expect(screen.queryByText('QUIZ PAGE')).toBeNull();
  });
});
