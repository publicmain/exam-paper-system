import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

// CIE 9618 past-paper practice browser. The teacher's past-paper archive
// has been ingested + classified by the rule engine; this page lets the
// student filter by paper / topic / year and reveal mark schemes on click.
// Display strategy follows the user's earlier directive: prefer extracted
// text when it's substantial, otherwise show the rendered source page so
// diagrams / tables come through faithfully.

const PAPER_OPTIONS = [
  { code: '1', label: 'Paper 1 — Theory' },
  { code: '2', label: 'Paper 2 — Programming' },
  { code: '3', label: 'Paper 3 — Advanced Theory' },
  { code: '4', label: 'Paper 4 — Practical' },
];

interface Topic {
  code: string;
  name: string;
  questionCount: number;
}
interface Component {
  code: string;
  name: string;
  topics: Topic[];
}
interface CropBox {
  pageNo: number;
  x: number;
  y: number;
  w: number;
  h: number;
  pageW: number;
  pageH: number;
}

/**
 * Crop a rendered PDF page image to a question-specific bounding box.
 *
 * The container holds an aspect-ratio box matching the crop region. The
 * underlying image is positioned absolutely at full page width inside it,
 * scaled so the crop's width fills the container, and translated up so
 * the crop's top edge lines up with the container's top edge. CSS
 * percentages are normalised against the page dimensions stored on the
 * crop box (pageW, pageH) so we don't need an onLoad measurement.
 */
function CropImage({ sourceFileId, box }: { sourceFileId: string; box: CropBox }) {
  // The image is sized so the page's full width fits the container width;
  // since every crop is full-width (x=0, w=pageW), this is a 1:1 scale.
  // The page's full rendered height in container units is pageH/pageW × containerW.
  // We translate the image up by box.y/pageW × containerW to land box.y at top:0.
  const aspectRatio = box.h / box.w;       // container height / width
  const yPctOfPageH = (box.y / box.pageH) * 100; // translate up by % of full image height
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: `${aspectRatio * 100}%`,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <img
        src={api.sourcePageImageUrl(sourceFileId, box.pageNo)}
        alt={`page ${box.pageNo} crop`}
        style={{
          position: 'absolute',
          width: '100%',
          top: 0,
          left: 0,
          // translateY percentage is of the image's own rendered height,
          // which is the full page scaled to container width.
          transform: `translateY(-${yPctOfPageH}%)`,
        }}
      />
    </div>
  );
}
interface Question {
  id: string;
  questionNumber: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  rawExtractedText: string | null;
  cropImageUrl: string | null;
  cropBboxJson: CropBox[] | null;
  suggestedMarks: number | null;
  suggestedTopicCode: string | null;
  confidenceTopic: number | null;
  sourceFile: {
    id: string;
    rawFilename: string;
    syllabusCode: string | null;
    examYear: number | null;
    examSeason: string | null;
    paperVariant: string | null;
  };
  parts: Array<{
    id: string;
    partLabel: string;
    marks: number;
    text: string;
    sortOrder: number;
  }>;
  markSchemeItems: Array<{
    id: string;
    partLabel: string | null;
    marks: number;
    pointText: string;
    sortOrder: number;
  }>;
}

const SEASON_LABEL: Record<string, string> = { s: 'May/Jun', w: 'Oct/Nov', m: 'Feb/Mar' };

export default function PracticePage() {
  const user = useAuth((s) => s.user);
  const canEditTopic = user && (user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher');
  const [components, setComponents] = useState<Component[]>([]);
  const [paperVariants, setPaperVariants] = useState<string[]>([]);
  const [topicCodes, setTopicCodes] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [imageMode, setImageMode] = useState<Record<string, boolean>>({}); // per-question text vs image toggle
  const [offset, setOffset] = useState(0);
  const PAGE = 20;

  useEffect(() => {
    api.practiceTopics('9618').then((r: any) => setComponents(r.components || []));
  }, []);

  // Debounce search 350ms.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch questions whenever filters change.
  useEffect(() => {
    setLoading(true);
    setOffset(0);
    api
      .practiceQuestions({
        syllabusCode: '9618',
        paperVariants: paperVariants.join(','),
        topicCodes: topicCodes.join(','),
        years: years.join(','),
        search: debouncedSearch,
        limit: PAGE,
        offset: 0,
      })
      .then((r: any) => {
        setQuestions(r.items);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  }, [paperVariants, topicCodes, years, debouncedSearch]);

  const loadMore = () => {
    const next = offset + PAGE;
    setLoading(true);
    api
      .practiceQuestions({
        syllabusCode: '9618',
        paperVariants: paperVariants.join(','),
        topicCodes: topicCodes.join(','),
        years: years.join(','),
        search: debouncedSearch,
        limit: PAGE,
        offset: next,
      })
      .then((r: any) => {
        setQuestions((prev) => [...prev, ...r.items]);
        setOffset(next);
      })
      .finally(() => setLoading(false));
  };

  // Flat topic catalogue for the inline edit dropdown.
  const allTopics = useMemo(
    () => components.flatMap((c) => c.topics.map((t) => ({ code: t.code, name: t.name }))),
    [components],
  );

  const saveTopic = async (questionId: string, newCode: string) => {
    const code = newCode === '' ? null : newCode;
    // Optimistic: flip the badge immediately, roll back on error.
    setQuestions((qs) => qs.map((q) => (q.id === questionId ? { ...q, suggestedTopicCode: code } : q)));
    try {
      await api.practiceUpdateTopic(questionId, code);
    } catch (err: any) {
      alert('Failed to update topic: ' + (err?.message ?? err));
      // Refetch the visible page on failure to re-sync.
      const r: any = await api.practiceQuestions({
        syllabusCode: '9618',
        paperVariants: paperVariants.join(','),
        topicCodes: topicCodes.join(','),
        years: years.join(','),
        search: debouncedSearch,
        limit: questions.length,
        offset: 0,
      });
      setQuestions(r.items);
    }
  };

  const togglePaper = (code: string) =>
    setPaperVariants((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));
  const toggleTopic = (code: string) =>
    setTopicCodes((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));
  const toggleYear = (y: number) =>
    setYears((p) => (p.includes(y) ? p.filter((x) => x !== y) : [...p, y]));

  const yearOptions = useMemo(() => [2021, 2022, 2023, 2024, 2025], []);
  const topicCountTotal = useMemo(
    () => components.reduce((s, c) => s + c.topics.reduce((s2, t) => s2 + t.questionCount, 0), 0),
    [components],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">
          Practice <span className="text-gray-400 text-base font-normal">CIE 9618 · {topicCountTotal} questions classified</span>
        </h1>
        <div className="text-sm text-gray-500">
          Showing {questions.length} of {total} matching · click any question to reveal mark scheme
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ---------- Filter sidebar ---------- */}
        <aside className="col-span-12 md:col-span-3 space-y-4">
          <div className="card">
            <input
              className="input w-full"
              placeholder="Search question text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="card">
            <div className="text-xs font-semibold uppercase text-gray-500 mb-2">Paper</div>
            <div className="space-y-1">
              {PAPER_OPTIONS.map((p) => (
                <label key={p.code} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={paperVariants.includes(p.code)}
                    onChange={() => togglePaper(p.code)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="text-xs font-semibold uppercase text-gray-500 mb-2">Year</div>
            <div className="flex flex-wrap gap-1">
              {yearOptions.map((y) => (
                <button
                  key={y}
                  className={`px-2 py-1 text-xs rounded border ${
                    years.includes(y) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                  onClick={() => toggleYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {components.map((comp) => (
            <div className="card" key={comp.code}>
              <div className="text-xs font-semibold uppercase text-gray-500 mb-2">{comp.code} · {comp.name}</div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {comp.topics.map((t) => (
                  <label
                    key={t.code}
                    className={`flex items-center gap-2 text-sm ${t.questionCount === 0 ? 'opacity-40' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={topicCodes.includes(t.code)}
                      onChange={() => toggleTopic(t.code)}
                      disabled={t.questionCount === 0}
                    />
                    <span className="flex-1">{t.code} {t.name}</span>
                    <span className="text-xs text-gray-400">{t.questionCount}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {(paperVariants.length || topicCodes.length || years.length || debouncedSearch) ? (
            <button
              className="btn btn-secondary w-full"
              onClick={() => {
                setPaperVariants([]);
                setTopicCodes([]);
                setYears([]);
                setSearch('');
              }}
            >
              Clear filters
            </button>
          ) : null}
        </aside>

        {/* ---------- Question feed ---------- */}
        <section className="col-span-12 md:col-span-9 space-y-3">
          {loading && questions.length === 0 ? (
            <div className="card py-10 text-center text-gray-500">Loading…</div>
          ) : questions.length === 0 ? (
            <div className="card py-10 text-center text-gray-500">
              No questions match these filters.
            </div>
          ) : (
            questions.map((q) => {
              const sf = q.sourceFile;
              const seasonLabel = sf.examSeason ? SEASON_LABEL[sf.examSeason] : '';
              const text = q.rawExtractedText ?? '';
              const isShortText = text.replace(/\s+/g, ' ').length < 80;
              const showImage = imageMode[q.id] ?? isShortText;
              const isRevealed = revealed[q.id];

              return (
                <article key={q.id} className="card">
                  {/* Header strip */}
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="text-sm font-medium">
                      <span className="badge mr-2">9618/{sf.paperVariant}</span>
                      <span className="text-gray-500">
                        {seasonLabel} {sf.examYear} · Q{q.questionNumber ?? '?'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {canEditTopic ? (
                        <select
                          className="select-xs border rounded px-1 py-0.5 text-xs"
                          value={q.suggestedTopicCode ?? ''}
                          onChange={(e) => saveTopic(q.id, e.target.value)}
                          title="Reassign topic"
                        >
                          <option value="">— uncategorised —</option>
                          {allTopics.map((t) => (
                            <option key={t.code} value={t.code}>{t.code} {t.name}</option>
                          ))}
                        </select>
                      ) : (
                        q.suggestedTopicCode && <span className="badge">{q.suggestedTopicCode}</span>
                      )}
                      <span className="text-gray-400">[{q.suggestedMarks ?? '?'} marks]</span>
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => setImageMode((m) => ({ ...m, [q.id]: !showImage }))}
                      >
                        {showImage ? 'Show text' : 'Show original'}
                      </button>
                    </div>
                  </div>

                  {/* Body: text or image. Prefer per-question crop boxes
                      (computed by the splitter from the worker's text-block
                      bboxes) over a full-page image, so the question card
                      shows exactly the question region — not the previous /
                      next questions or the legal footer. */}
                  {showImage && q.cropBboxJson && q.cropBboxJson.length > 0 ? (
                    <div className="bg-gray-50 p-2 rounded space-y-2">
                      {q.cropBboxJson.map((box) => (
                        <CropImage key={`${q.id}-${box.pageNo}`} sourceFileId={sf.id} box={box} />
                      ))}
                    </div>
                  ) : showImage && q.pageStart ? (
                    <div className="bg-gray-50 p-2 rounded">
                      <img
                        src={api.sourcePageImageUrl(sf.id, q.pageStart)}
                        alt={`${sf.rawFilename} page ${q.pageStart}`}
                        className="w-full max-h-[800px] object-contain"
                      />
                      {q.pageEnd && q.pageEnd > q.pageStart && (
                        <img
                          src={api.sourcePageImageUrl(sf.id, q.pageStart + 1)}
                          alt={`${sf.rawFilename} page ${q.pageStart + 1}`}
                          className="w-full max-h-[800px] object-contain mt-2"
                        />
                      )}
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{text}</pre>
                  )}

                  {q.parts.length > 0 && !showImage && (
                    <div className="mt-3 text-sm border-t pt-3 space-y-1">
                      {q.parts.map((p) => (
                        <div key={p.id}>
                          <span className="text-gray-500">({p.partLabel}) [{p.marks}m]</span>{' '}
                          {p.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mark scheme reveal */}
                  <div className="mt-4">
                    {!isRevealed ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => setRevealed((r) => ({ ...r, [q.id]: true }))}
                      >
                        Show mark scheme ({q.markSchemeItems.length} items)
                      </button>
                    ) : (
                      <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <strong className="text-green-800">Mark scheme</strong>
                          <button
                            className="text-xs text-gray-500 hover:underline"
                            onClick={() => setRevealed((r) => ({ ...r, [q.id]: false }))}
                          >
                            Hide
                          </button>
                        </div>
                        {q.markSchemeItems.length === 0 ? (
                          <div className="text-gray-500">No mark scheme items linked.</div>
                        ) : (
                          q.markSchemeItems.map((ms) => (
                            <div key={ms.id} className="mb-2">
                              <span className="text-gray-600">
                                ({ms.partLabel ?? '-'}) [{ms.marks}m]
                              </span>{' '}
                              <span className="whitespace-pre-wrap">{ms.pointText}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}

          {questions.length > 0 && questions.length < total && (
            <button
              className="btn btn-secondary w-full"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? 'Loading…' : `Load more (${total - questions.length} remaining)`}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
