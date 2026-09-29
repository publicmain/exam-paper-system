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
export type PrintWord = {
  headword: string;
  phonetic: string | null;
  pos: string | null;
  translation: string;
  sentence: string | null;
  /** 只在按周打印时有：当天 App 正式单词测试里答错过 */
  testWrong?: boolean;
};
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

/**
 * 默写提示只留第一组词性的前两个意思：「vt. 遇见, 遭遇, 会战；vi. 偶然相遇」→「vt. 遇见，遭遇」。
 * 词典释义整条堆砌，一格折成三行会把一周默写纸撑到三页。
 */
export function shortGloss(text: string): string {
  const first = text.split(/[；;]/)[0].trim();
  const m = first.match(/^((?:[a-z]+\.\s*)+)(.*)$/i);
  const pos = m ? m[1].trim() + ' ' : '';
  const body = m ? m[2] : first;
  const parts = body.split(/\s*[,，、]\s*/).filter(Boolean);
  const out = (pos + parts.slice(0, 2).join('，')).trim();
  return out || text.trim();
}

type WeekEntry = { kind: 'head'; date: string; label: string } | { kind: 'row'; w: PrintWord; no: number };

/** 按题数对半分成左右两栏；一天被拆开时右栏补一个「（续）」小标题。 */
function splitColumns(days: Array<{ date: string; label: string; words: PrintWord[]; rows: Array<{ w: PrintWord; no: number }> }>): WeekEntry[][] {
  const total = days.reduce((n, d) => n + d.rows.length, 0);
  const half = Math.ceil(total / 2);
  const cols: WeekEntry[][] = [[], []];
  let placed = 0;
  for (const d of days) {
    let col = placed < half ? 0 : 1;
    cols[col].push({ kind: 'head', date: d.date, label: `${d.label} · ${d.words.length} 个` });
    for (const r of d.rows) {
      const want = placed < half ? 0 : 1;
      if (want !== col) {
        col = want;
        cols[col].push({ kind: 'head', date: d.date, label: `${d.label}（续）` });
      }
      cols[col].push({ kind: 'row', w: r.w, no: r.no });
      placed += 1;
    }
  }
  return cols;
}

/**
 * 一整周的单词纸（2026-09-29，早读默写）：一个学生一份，按天分段、题号连续；
 * 当天 App 正式单词测试里答错过的词在题号前标 ★。只在老师后台用。
 */
export function WeekWordsSheet({
  days,
  mode,
  title,
  meta,
  showAnswers = false,
}: {
  days: Array<{ date: string; label: string; words: PrintWord[] }>;
  mode: WordSheetMode;
  title: string;
  meta: string;
  showAnswers?: boolean;
}) {
  const dictation = mode === 'dictation';
  const total = days.reduce((n, d) => n + d.words.length, 0);
  const anyWrong = days.some((d) => d.words.some((w) => w.testWrong));
  const numbered = days.map((d, di) => ({
    ...d,
    rows: d.words.map((w, wi) => ({ w, no: days.slice(0, di).reduce((n, x) => n + x.words.length, 0) + wi + 1 })),
  }));
  return (
    <>
      <article className="ps-paper" data-testid={dictation ? 'print-week-dictation' : 'print-week-wordlist'}>
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
                得分 <i className="ps-blank" style={{ minWidth: '12mm' }} /> / {total}
              </span>
            </div>
          ) : null}
        </header>
        {anyWrong ? <p className="ps-legend">★ = 这个词在当天 App 的单词测试里答错过，重点写。</p> : null}
        {dictation ? (
          // 默写纸两栏排，一周 50 个词争取一页纸；中文只留前几个意思（shortGloss）。
          // 自己对半分成左右两栏（不用 CSS 多栏：打印时整块放不下会被挪到下一页，留一页空白）。
          <div className="ps-week-grid">
            {splitColumns(numbered).map((col, ci) => (
              <div key={ci} className="ps-week-col">
                {col.map((e) =>
                  e.kind === 'head' ? (
                    <div key={`h-${e.date}-${ci}`} className="ps-day-head">
                      {e.label}
                    </div>
                  ) : (
                    <div key={e.no} className="ps-week-row">
                      <span className="ps-week-no">
                        {e.w.testWrong ? <span className="ps-star">★</span> : null}
                        {e.no}
                      </span>
                      <span className="ps-week-cn">{shortGloss(e.w.translation)}</span>
                      <span className="ps-week-write" />
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
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
            {numbered.map((d) => (
              <tbody key={d.date}>
                <tr className="ps-day-row">
                  <td colSpan={4}>
                    {d.label} · {d.words.length} 个
                  </td>
                </tr>
                {d.rows.map(({ w, no }) => (
                  <tr key={`${d.date}-${no}`}>
                    <td className="ps-num">
                      {w.testWrong ? <span className="ps-star">★</span> : null}
                      {no}
                    </td>
                    <td>
                      <div className="ps-word">{w.headword}</div>
                      {w.phonetic ? <div className="ps-small">{w.phonetic}</div> : null}
                    </td>
                    <td>{w.translation}</td>
                    <td className="ps-small">{w.sentence ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
      </article>
      {dictation && showAnswers && total > 0 ? (
        <article className="ps-paper" data-testid="print-week-dictation-answers">
          <header className="ps-head">
            <div>
              <h1 className="ps-title">答案 · {title}</h1>
              <div className="ps-meta">{meta}</div>
            </div>
          </header>
          <ol className="ps-answers" style={{ columns: 3, padding: 0, margin: 0, listStyle: 'none' }}>
            {numbered.flatMap((d) => d.rows).map(({ w, no }) => (
              <li key={no}>
                <b>{no}.</b>&nbsp;{w.headword}
              </li>
            ))}
          </ol>
        </article>
      ) : null}
    </>
  );
}
