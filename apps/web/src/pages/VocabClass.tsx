import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Progress = {
  date: string;
  totals: { students: number; readingOverdue?: number; unfinishedWords?: number; pendingTests?: number; notebookWords?: number };
  students: Array<{
    studentId: string;
    name: string;
    englishLevel: string | null;
    reading: { assigned: number; completed: number; overdue: number; awaitingMarking: number; today: string };
    vocabulary: {
      notebookCount: number;
      totalLearned: number;
      masteredOrRemoved: number;
      unfinishedWords: number;
      completedDailySets: number;
      pendingTests: number;
      pendingTestWords: number;
      todayLearning: string;
      todayTest: string;
    };
  }>;
};

const LEVEL_LABEL: Record<string, string> = {
  olevel: 'O-Level 基础', olevel_intermediate: 'O-Level 进阶', ielts_light: '雅思入门', ielts_authentic: '雅思进阶', ielts_simplified: '雅思强化',
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
    if (words.length !== 12 || new Set(words.map((word) => word.toLowerCase())).size !== 12) {
      setMessage(`每日词表必须正好是 12 个不重复单词；现在识别到 ${words.length} 个。`);
      return;
    }
    setPublishing(true); setMessage('');
    try {
      await api.vocabV2PublishAssignment({ classId, date: assignmentDate, words });
      setAssignmentWords('');
      setMessage(`${assignmentDate} 的 12 个新词已经发布。学生开始后词单会冻结。`);
      await load();
    } catch (reason: any) {
      setMessage(`发布失败：${String(reason?.message ?? reason)}`);
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
        <button className="rounded-md border bg-white px-4 py-2 text-sm" onClick={() => void load()}>刷新记录</button>
        {progress ? <span className="text-sm text-gray-500">统计日期：{progress.date}</span> : null}
      </div>
      {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</p> : null}

      {progress ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="班级汇总">
        <Metric label="学生账号" value={progress.totals.students} />
        <Metric label="未完成文章" value={progress.totals.readingOverdue ?? 0} />
        <Metric label="未背单词" value={progress.totals.unfinishedWords ?? 0} />
        <Metric label="待做单词测试" value={progress.totals.pendingTests ?? 0} />
        <Metric label="生词本总词数" value={progress.totals.notebookWords ?? 0} />
      </section> : null}

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-4 py-3"><h2 className="font-bold">每个学生的完整记录</h2><p className="mt-1 text-xs text-gray-500">“未完成文章”按已经发布且符合该学生难度的阅读任务计算；没有打开过任务也会显示。</p></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="px-4 py-3">学生</th><th className="px-3 py-3">难度</th><th className="px-3 py-3">今日阅读</th><th className="px-3 py-3">未完成文章</th><th className="px-3 py-3">今日新词</th><th className="px-3 py-3">未背单词</th><th className="px-3 py-3">测试待办</th><th className="px-3 py-3">生词本</th><th className="px-3 py-3">累计学过</th><th className="px-3 py-3">待批</th></tr></thead>
            <tbody className="divide-y">{(progress?.students ?? []).map((student) => <tr key={student.studentId} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium">{student.name}</td><td className="px-3 py-3">{LEVEL_LABEL[student.englishLevel ?? ''] ?? student.englishLevel ?? '未选择'}</td><td className="px-3 py-3"><Status value={student.reading.today} /></td><td className="px-3 py-3 tabular-nums">{student.reading.overdue}</td><td className="px-3 py-3"><Status value={student.vocabulary.todayLearning} /></td><td className="px-3 py-3 tabular-nums">{student.vocabulary.unfinishedWords}</td><td className="px-3 py-3"><strong>{student.vocabulary.pendingTests}</strong><span className="text-xs text-gray-400"> / {student.vocabulary.pendingTestWords} 词</span></td><td className="px-3 py-3 tabular-nums">{student.vocabulary.notebookCount}</td><td className="px-3 py-3 tabular-nums">{student.vocabulary.totalLearned}</td><td className="px-3 py-3 tabular-nums">{student.reading.awaitingMarking}</td></tr>)}</tbody>
          </table>
        </div>
        {progress && progress.students.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">这个班还没有学生账号。</p> : null}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-bold text-gray-900">发布每日 12 个新词</h2>
        <p className="mt-1 text-sm text-gray-500">词语会自动进入学生的“我的单词”。学完即自动生成测试待办，不再让学生选择今天考或明天考。</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[170px_1fr_auto]">
          <input type="date" value={assignmentDate} onChange={(event) => setAssignmentDate(event.target.value)} className="rounded-md border px-3 py-2" />
          <textarea value={assignmentWords} onChange={(event) => setAssignmentWords(event.target.value)} placeholder="输入 12 个不重复英文单词，可用空格、逗号或换行分隔" rows={3} className="rounded-md border px-3 py-2 text-sm" />
          <button type="button" disabled={publishing} onClick={() => void publish()} className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white disabled:opacity-50">{publishing ? '发布中…' : '发布词表'}</button>
        </div>
        {assignments.length ? <div className="mt-4 grid gap-2">{assignments.slice(0, 7).map((assignment) => <div key={assignment.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm"><div className="flex justify-between gap-3"><strong>{assignment.date} · {assignment.title}</strong><span>版本 {assignment.version}</span></div><p className="mt-1 text-gray-600">{assignment.words.map((word: any) => word.headword).join(' · ')}</p></div>)}</div> : null}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>;
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { completed: '已完成', pending: '待完成', in_progress: '进行中', not_started: '未开始', submitted: '已完成', locked: '待学词', none: '无任务' };
  const good = value === 'completed' || value === 'submitted';
  return <span className={`rounded-full px-2 py-1 text-xs ${good ? 'bg-emerald-50 text-emerald-700' : value === 'none' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'}`}>{labels[value] ?? value}</span>;
}
