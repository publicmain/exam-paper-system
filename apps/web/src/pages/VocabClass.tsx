import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Progress = {
  date: string;
  totals: { students: number; readingOverdue?: number; unfinishedWords?: number; pendingTests?: number; notebookWords?: number };
  students: Array<{
    studentId: string;
    name: string;
    englishLevel: string | null;
    reading: {
      assigned: number;
      completed: number;
      /** 今天以前还欠着的份数（T01：与学生首页同口径；已取消的不算） */
      overdue: number;
      /** 欠的是哪几天 —— 汇总能追到按日期的明细（IOS-10）。老服务端不发 */
      overdueDates?: string[];
      awaitingMarking: number;
      /** 已取消、取消前已交的留档份数（不算欠） */
      cancelledArchived?: number;
      today: string;
    };
    vocabulary: {
      notebookCount: number;
      totalLearned: number;
      masteredOrRemoved: number;
      unfinishedWords: number;
      completedDailySets: number;
      pendingTests: number;
      /** 待测题数：已生成的按冻结卷（含旧词抽查），没生成的按学完的新词（VOC06） */
      pendingTestWords: number;
      pendingTestsNotGenerated?: number;
      todayLearning: string;
      /** locked = 学完才有；not_needed = 全部延后、这天不需要正式卷（VOC08） */
      todayTest: string;
      todayTestQuestions?: number | null;
      todayLearned?: number;
      todayDeferred?: number;
    };
  }>;
};

/**
 * 五档难度 —— 教师端标签。
 *
 * 必须与学生端 `apps/student-web/src/lib/levels.ts`（唯一权威顺序/文案，
 * 只读不改）逐字一致；顺序从易到难。2026-09-11 审计 UI06（覆盖 T04/T05）
 * 之前这里把 `ielts_simplified` 标成"雅思强化"、`olevel` 标成"O-Level 基础"，
 * 与学生端完全对调，教师看到的档位名跟学生实际选的对不上号。
 */
const LEVEL_LABEL: Record<string, string> = {
  ielts_simplified: 'O-Level 基础',
  olevel_intermediate: 'O-Level 中级',
  olevel: 'O-Level 标准',
  ielts_light: '雅思轻量',
  ielts_authentic: '雅思 · 真题型',
};

export default function VocabClassPage() {
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classId, setClassId] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentDate, setAssignmentDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }));
  const [assignmentWords, setAssignmentWords] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.listClasses().then((result: any) => {
      const list = (result?.items ?? result ?? []).map((item: any) => ({ id: item.id, name: item.name }));
      setClasses(list);
      if (list.length) setClassId((current) => current || list[0].id);
    }).catch((reason: any) => setError(String(reason?.message ?? reason)));
  }, []);

  const load = useCallback(async () => {
    if (!classId) return;
    setError('');
    try {
      const [nextProgress, nextAssignments] = await Promise.all([
        api.vocabV2ClassProgress(classId), api.vocabV2Assignments(classId),
      ]);
      setProgress(nextProgress as Progress);
      setAssignments((nextAssignments as any)?.assignments ?? []);
    } catch (reason: any) {
      setError(String(reason?.message ?? reason));
    }
  }, [classId]);

  useEffect(() => { void load(); }, [load]);

  const publish = async () => {
    if (!classId || publishing) return;
    const words = assignmentWords.split(/[\s,，;；]+/).map((word) => word.trim()).filter(Boolean);
    // 词数规则与后端 vocabulary-v2.service.ts#publishTeacherAssignment 现行
    // 一致：1–20 个、互不重复；不再要求"恰好 12 个"（2026-09-11 审计 UI06 /
    // T04：旧版强制 12 个，与后端早已放宽的 1–20 规则不符）。
    if (words.length < 1) {
      setMessage('请至少输入 1 个单词再发布。');
      return;
    }
    if (words.length > 20) {
      setMessage(`每日词表最多 20 个单词，现在识别到 ${words.length} 个；请精简后再发布。`);
      return;
    }
    const seen = new Map<string, string>(); // 小写 → 原始写法（用于提示）
    const dupes = new Set<string>();
    for (const word of words) {
      const key = word.toLowerCase();
      if (seen.has(key)) dupes.add(seen.get(key)!);
      else seen.set(key, word);
    }
    if (dupes.size > 0) {
      setMessage(`有重复单词：${Array.from(dupes).join('、')}；请去重后再发布（不区分大小写）。`);
      return;
    }
    setPublishing(true); setMessage('');
    try {
      await api.vocabV2PublishAssignment({ classId, date: assignmentDate, words });
      setAssignmentWords('');
      setMessage(`${assignmentDate} 的 ${words.length} 个新词已经发布。学生开始后词单会冻结。`);
      await load();
    } catch (reason: any) {
      setMessage(describePublishError(reason));
    } finally { setPublishing(false); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[#2D3B45]">学生学习总表</h1>
        <p className="mt-1 text-sm text-gray-500">阅读、每日新词、生词本和单词测试使用同一张学生进度表，不再分别查看两套生词数据。</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">班级 <select value={classId} onChange={(event) => setClassId(event.target.value)} className="ml-2 rounded-md border px-3 py-2">{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button className="tap rounded-md border bg-white px-4 py-2 text-sm" onClick={() => void load()}>刷新记录</button>
        {progress ? <span className="text-sm text-gray-500">统计日期：{progress.date}</span> : null}
      </div>
      {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</p> : null}

      {progress ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="班级汇总">
        <Metric label="学生账号" value={progress.totals.students} />
        <Metric label="欠阅读（今天以前）" value={progress.totals.readingOverdue ?? 0} />
        <Metric label="未背单词" value={progress.totals.unfinishedWords ?? 0} />
        <Metric label="待做单词测试" value={progress.totals.pendingTests ?? 0} />
        <Metric label="生词本总词数" value={progress.totals.notebookWords ?? 0} />
      </section> : null}

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-4 py-3"><h2 className="font-bold">每个学生的完整记录</h2><p className="mt-1 text-xs text-gray-500">“欠阅读”只算今天以前、按那天实际分配给他的阅读（有答卷的认答卷，没答卷的按那天结束时的难度）；老师取消的场次不算欠，今天的另列在“今日阅读”。“测试待办”的题数：已生成的按实际卷子（含旧词抽查），还没生成的按学完的新词数。</p></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="px-4 py-3">学生</th><th className="px-3 py-3">难度</th><th className="px-3 py-3">今日阅读</th><th className="px-3 py-3">欠阅读</th><th className="px-3 py-3">今日新词</th><th className="px-3 py-3">今日测试</th><th className="px-3 py-3">未背单词</th><th className="px-3 py-3">测试待办</th><th className="px-3 py-3">生词本</th><th className="px-3 py-3">累计学过</th><th className="px-3 py-3">待批</th></tr></thead>
            <tbody className="divide-y">{(progress?.students ?? []).map((student) => <tr key={student.studentId} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium">{student.name}</td><td className="px-3 py-3">{LEVEL_LABEL[student.englishLevel ?? ''] ?? student.englishLevel ?? '未选择'}</td><td className="px-3 py-3"><Status value={student.reading.today} /></td><td className="px-3 py-3"><OverdueCell reading={student.reading} /></td><td className="px-3 py-3"><Status value={student.vocabulary.todayLearning} />{student.vocabulary.todayLearned != null && student.vocabulary.todayLearning !== 'not_started' ? <span className="mt-1 block text-xs text-gray-500">学完 {student.vocabulary.todayLearned}{student.vocabulary.todayDeferred ? ` · 延后 ${student.vocabulary.todayDeferred}` : ''}</span> : null}</td><td className="px-3 py-3"><Status value={student.vocabulary.todayTest} />{student.vocabulary.todayTestQuestions ? <span className="mt-1 block text-xs text-gray-500">{student.vocabulary.todayTestQuestions} 题</span> : null}</td><td className="px-3 py-3 tabular-nums">{student.vocabulary.unfinishedWords}</td><td className="px-3 py-3"><strong>{student.vocabulary.pendingTests}</strong><span className="text-xs text-gray-500"> 份 / {student.vocabulary.pendingTestWords} 题</span>{student.vocabulary.pendingTestsNotGenerated ? <span className="block text-xs text-gray-500">其中 {student.vocabulary.pendingTestsNotGenerated} 份卷子还没生成</span> : null}</td><td className="px-3 py-3 tabular-nums">{student.vocabulary.notebookCount}</td><td className="px-3 py-3 tabular-nums">{student.vocabulary.totalLearned}</td><td className="px-3 py-3 tabular-nums">{student.reading.awaitingMarking}</td></tr>)}</tbody>
          </table>
        </div>
        {progress && progress.students.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">这个班还没有学生账号。</p> : null}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-bold text-gray-900">发布每日新词</h2>
        <p className="mt-1 text-sm text-gray-500">词语会自动进入学生的“我的单词”。学完即自动生成测试待办，不再让学生选择今天考或明天考。每天 1–20 个不重复单词都可以发布，学生默认按 10 个左右安排学习节奏。</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[170px_1fr_auto]">
          <input type="date" value={assignmentDate} onChange={(event) => setAssignmentDate(event.target.value)} className="rounded-md border px-3 py-2" />
          <textarea value={assignmentWords} onChange={(event) => setAssignmentWords(event.target.value)} placeholder="输入 1–20 个不重复英文单词，可用空格、逗号或换行分隔" rows={3} className="rounded-md border px-3 py-2 text-sm" />
          <button type="button" disabled={publishing} onClick={() => void publish()} className="tap rounded-md bg-blue-600 px-5 py-2 font-medium text-white disabled:opacity-50">{publishing ? '发布中…' : '发布词表'}</button>
        </div>
        {assignments.length ? <div className="mt-4 grid gap-2">{assignments.slice(0, 7).map((assignment) => <div key={assignment.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm"><div className="flex justify-between gap-3"><strong>{assignment.date} · {assignment.title}</strong><span>版本 {assignment.version}</span></div><p className="mt-1 text-gray-600">{assignment.words.map((word: any) => word.headword).join(' · ')}</p></div>)}</div> : null}
      </section>
    </div>
  );
}

/**
 * 后端 `publishTeacherAssignment` 用 `throw new BadRequestException({code, ...})`
 * 抛错时，Nest 会把这个对象原样当响应体（不会套一层 message 字符串 —— 见
 * HttpException.createBody），所以 `err.message` 在这几种已知情形下不可读，
 * 必须认 `err.body?.code` 给出准确提示。未知错误退回原始 message。
 */
function describePublishError(reason: any): string {
  const body = reason?.body ?? {};
  const code = body?.code ?? body?.message?.code;
  switch (code) {
    case 'v2_assignment_word_count':
      return `每日词表需要 1–20 个单词，现在识别到 ${body.received ?? '?'} 个。`;
    case 'v2_assignment_words_must_be_unique':
      return '单词有重复，请去重后再发布。';
    case 'v2_assignment_words_not_publishable': {
      const words = Array.isArray(body.words) ? body.words.join('、') : '';
      return `词库里还没有可用释义，暂时不能发布：${words}。可先联系管理员补充词表，或换成库里已有的词。`;
    }
    case 'v2_assignment_date_invalid':
      return '日期格式不对，请重新选择日期。';
    case 'not_your_class':
      return '没有权限给这个班级发布词表。';
    default:
      return `发布失败：${String(reason?.message ?? reason)}`;
  }
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>;
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { completed: '已完成', pending: '待完成', in_progress: '进行中', not_started: '未开始', submitted: '已完成', locked: '学完才有', none: '无任务', not_needed: '不需要' };
  const good = value === 'completed' || value === 'submitted';
  const quiet = value === 'none' || value === 'not_needed' || value === 'locked';
  return <span className={`rounded-full px-2 py-1 text-xs ${good ? 'bg-emerald-50 text-emerald-700' : quiet ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>{labels[value] ?? value}</span>;
}

/** 欠阅读：份数 + 欠的是哪几天（IOS-10：汇总能追到明细）；已取消的留档另注。 */
export function OverdueCell({ reading }: { reading: { overdue: number; overdueDates?: string[]; cancelledArchived?: number } }) {
  const dates = reading.overdueDates ?? [];
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return (
    <div>
      <span className="tabular-nums">{reading.overdue}</span>
      {dates.length ? <span className="block text-xs text-gray-500" title={dates.join('、')}>{dates.slice(0, 4).map(md).join('、')}{dates.length > 4 ? ` 等 ${dates.length} 天` : ''}</span> : null}
      {reading.cancelledArchived ? <span className="block text-xs text-gray-500">另有 {reading.cancelledArchived} 份已取消（不算欠）</span> : null}
    </div>
  );
}
