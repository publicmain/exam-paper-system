/**
 * 打印版纸面（2026-09-22）：阅读卷、单词表、默写纸。
 *
 * 只负责排版 —— 分组、题号、共用选项库、要不要答案，全部由服务端
 * `/print-materials/*` 算好（apps/api/src/print-materials/print-model.ts）。
 * 学生端 apps/student-web/src/print/PrintSheets.tsx 是同一份排版，改一边记得改另一边。
 */
import './print-sheet.css';

export type PrintOption = { key: string; text: string };
export type PrintQuestion = { no: number; item: string; options: PrintOption[] | null; lines: number; marks: number; answer: string | null };
export type PrintGroup = { taskType: string; title: string; instruction: string; bank: PrintOption[] | null; bankLabel: string | null; questions: PrintQuestion[] };
export type ReadingPrint = {
  title: string;
  paragraphs: Array<{ label: string | null; text: string }>;
  groups: PrintGroup[];
  questionCount: number;
  totalMarks: number;
};
export type PrintWord = { headword: string; phonetic: string | null; pos: string | null; translation: string; sentence: string | null };
export type WordSheetMode = 'list' | 'dictation';

/** 题干里的 [BLANK] 印成下划线 */
function blankify(text: string): string {
  return text.replace(/\[BLANK\]/gi, '__________');
}

function range(g: PrintGroup): string {
  const first = g.questions[0]?.no;
  const last = g.questions[g.questions.length - 1]?.no;
  if (first == null) return '';
  return last != null && last !== first ? `Questions ${first}–${last}` : `Question ${first}`;
}

export function ReadingSheet({ reading, meta, showAnswers = false }: { reading: ReadingPrint; meta: string; showAnswers?: boolean }) {
  return (
    <>
      <article className="ps-paper" data-testid="print-reading">
        <header className="ps-head">
          <div>
            <h1 className="ps-title">{reading.title}</h1>
            <div className="ps-meta">{meta}</div>
          </div>
          <div className="ps-fields">
            <span>
              姓名 <i className="ps-blank" />
            </span>
            <span>
              得分 <i className="ps-blank" style={{ minWidth: '12mm' }} /> / {reading.totalMarks}
            </span>
          </div>
        </header>

        {reading.paragraphs.map((p, i) => (
          <p key={i} className="ps-para">
            {p.label ? <span className="ps-para-label">{p.label}</span> : null}
            {p.text}
          </p>
        ))}

        {reading.groups.map((g, gi) => (
          <section key={gi} className="ps-section" data-testid="print-group">
            <h2 className="ps-group-title">
              {range(g)} · {g.title}
            </h2>
            {g.instruction ? <p className="ps-instruction">{g.instruction}</p> : null}
            {g.bank ? (
              <div className="ps-bank" data-testid="print-bank" aria-label={g.bankLabel ?? undefined}>
                {g.bank.map((o) => (
                  <span key={o.key}>
                    <b>{o.key}</b>&nbsp;&nbsp;{o.text}
                  </span>
                ))}
              </div>
            ) : null}
            {g.questions.map((q) => (
              <div key={q.no} className="ps-q" data-testid="print-question">
                <div className="ps-q-item">
                  <span className="ps-q-no">{q.no}.</span>
                  <span>{blankify(q.item)}</span>
                </div>
                {q.options ? (
                  <ul className="ps-options">
                    {q.options.map((o) => (
                      <li key={o.key}>
                        {o.key}.&nbsp;{o.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {Array.from({ length: q.lines }, (_, i) => (
                  <div key={i} className="ps-line" />
                ))}
              </div>
            ))}
          </section>
        ))}
      </article>

      {showAnswers ? (
        <article className="ps-paper" data-testid="print-answer-key">
          <header className="ps-head">
            <div>
              <h1 className="ps-title">答案 · {reading.title}</h1>
              <div className="ps-meta">{meta}</div>
            </div>
          </header>
          <ol className="ps-answers" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {reading.groups.flatMap((g) => g.questions).map((q) => (
              <li key={q.no}>
                <b>{q.no}.</b>&nbsp;{q.answer ?? '（无参考答案）'}
                {q.marks > 1 ? <span className="ps-small">（{q.marks} 分）</span> : null}
              </li>
            ))}
          </ol>
        </article>
      ) : null}
    </>
  );
}

export function WordsSheet({
  words,
  mode,
  title,
  meta,
  showAnswers = false,
}: {
  words: PrintWord[];
  mode: WordSheetMode;
  title: string;
  meta: string;
  showAnswers?: boolean;
}) {
  const dictation = mode === 'dictation';
  return (
    <>
      <article className="ps-paper" data-testid={dictation ? 'print-dictation' : 'print-wordlist'}>
        <header className="ps-head">
          <div>
            <h1 className="ps-title">{title}</h1>
            <div className="ps-meta">{meta}</div>
          </div>
          {dictation ? (
            <div className="ps-fields">
              <span>
                姓名 <i className="ps-blank" />
              </span>
              <span>
                得分 <i className="ps-blank" style={{ minWidth: '12mm' }} /> / {words.length}
              </span>
            </div>
          ) : null}
        </header>
        {words.length === 0 ? (
          <p className="ps-empty">这一天没有单词任务。</p>
        ) : dictation ? (
          <table className="ps-table">
            <thead>
              <tr>
                <th>#</th>
                <th>中文意思</th>
                <th>英文</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr key={`${w.headword}-${i}`}>
                  <td className="ps-num">{i + 1}</td>
                  <td>{w.translation}</td>
                  <td className="ps-write" />
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="ps-table">
            <thead>
              <tr>
                <th>#</th>
                <th>单词</th>
                <th>中文意思</th>
                <th>例句</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr key={`${w.headword}-${i}`}>
                  <td className="ps-num">{i + 1}</td>
                  <td>
                    <div className="ps-word">{w.headword}</div>
                    {w.phonetic ? <div className="ps-small">{w.phonetic}</div> : null}
                  </td>
                  <td>{w.translation}</td>
                  <td className="ps-small">{w.sentence ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
      {dictation && showAnswers && words.length > 0 ? (
        <article className="ps-paper" data-testid="print-dictation-answers">
          <header className="ps-head">
            <div>
              <h1 className="ps-title">答案 · {title}</h1>
              <div className="ps-meta">{meta}</div>
            </div>
          </header>
          <ol className="ps-answers" style={{ columns: 2, padding: 0, margin: 0, listStyle: 'none' }}>
            {words.map((w, i) => (
              <li key={`${w.headword}-${i}`}>
                <b>{i + 1}.</b>&nbsp;{w.headword}
              </li>
            ))}
          </ol>
        </article>
      ) : null}
    </>
  );
}
