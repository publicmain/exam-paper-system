import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import StudentBadgesCard from '../components/StudentBadgesCard';

/** Independent collection view; no growth reports, goals or new learning tasks. */
export default function StudentBadgesPage() {
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [classesLoading, setClassesLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const loading = classesLoading || studentsLoading;
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true; setClassesLoading(true); setError('');
    api.listClasses().then((result: any) => { if (alive) setClasses((result?.items ?? result ?? []).map((row: any) => ({ id: row.id, name: row.name }))); })
      .catch(() => { if (alive) setError('班级暂时没加载出来，请重试。'); })
      .finally(() => { if (alive) setClassesLoading(false); });
    return () => { alive = false; };
  }, [retry]);
  useEffect(() => {
    let alive = true; setStudents([]); setStudentId(''); setError('');
    if (!classId) { setStudentsLoading(false); return; }
    setStudentsLoading(true);
    api.getClass(classId).then((result: any) => {
      if (!alive) return;
      setStudents((result?.enrollments ?? []).filter((row: any) => row.role === 'student' && row.user && !row.user.archivedAt)
        .map((row: any) => ({ id: row.user.id, name: row.user.name })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id)));
    }).catch(() => { if (alive) setError('学生名单暂时没加载出来，请重试。'); })
      .finally(() => { if (alive) setStudentsLoading(false); });
    return () => { alive = false; };
  }, [classId, retry]);
  return <main className="mx-auto max-w-5xl space-y-5 px-6 py-6" data-testid="student-badges-page">
    <header><h1 className="text-2xl font-semibold">学生徽章</h1><p className="mt-2 text-sm text-gray-600">查看任教班级的真实收藏。四级分别保存，不增加学习任务。</p></header>
    <div className="flex flex-wrap gap-4">
      <label className="text-sm">班级<select aria-label="班级" data-testid="badges-class" value={classId} onChange={event => { setClassId(event.target.value); setStudentId(''); setStudents([]); }} className="ml-2 min-h-[44px] rounded border px-3"><option value="">选择班级</option>{classes.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="text-sm">学生<select aria-label="学生" data-testid="badges-student" value={studentId} disabled={!students.length} onChange={event => setStudentId(event.target.value)} className="ml-2 min-h-[44px] rounded border px-3"><option value="">{classId ? '选择学生' : '先选择班级'}</option>{students.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    </div>
    {loading && <p role="status" className="text-sm text-gray-600">正在读取名单…</p>}
    {error && <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}<button className="ml-2 min-h-[44px] underline" onClick={() => setRetry(value => value + 1)}>重试</button></div>}
    {!loading && !error && (!classes.length || (classId && !students.length)) && <p className="text-sm text-gray-600">{classes.length ? '这个班还没有学生。' : '暂时没有可查看的班级。'}</p>}
    {classId && studentId && <StudentBadgesCard key={classId + ':' + studentId} classId={classId} studentId={studentId} />}
  </main>;
}
