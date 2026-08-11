import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * 技能画像 —— 早测 2.0 的核心新增。
 *
 * 立项依据（2026-08-11 对全历史作答做的诊断）：
 * 每道题都存了 taskType，但系统从来没按它聚合过 —— 学生只看到一个总分，
 * 老师也不知道该重讲哪一类题。按题型拆开之后，信息量非常大：
 *
 *   选择型（TFNG / 段落匹配 / 多选）  得分率 58-67%   空白率  6-12%
 *   打字型（句子填空 / 流程图 / 图表） 得分率 28-53%   空白率 36-51%
 *   O-Level 短答（全卷都要打字）      得分率 19%      空白率 64%
 *
 * 同一批学生、同一份卷子、同一篇文章，差别只在作答方式。所以「空白率」
 * 必须和「得分率」并列成为一级指标 —— 只看得分率会把「不会做」和
 * 「懒得打字」混为一谈，而这两者的教学干预完全不同。
 */

/** 题型 → 中文名。未知题型原样返回，不猜。 */
const LABELS: Record<string, string> = {
  matching_information: '段落信息匹配',
  matching_headings: '段落小标题匹配',
  matching_features: '特征匹配',
  classification: '分类题',
  true_false_not_given: '判断题 TRUE/FALSE/NG',
  yes_no_not_given: '判断题 YES/NO/NG',
  multiple_choice: '单项选择',
  multi_select: '多项选择',
  sentence_completion: '句子填空',
  summary_completion: '摘要填空',
  note_completion: '笔记填空',
  table_completion: '表格填空',
  flow_chart_completion: '流程图填空',
  diagram_completion: '图示填空',
  diagram_label_completion: '图表标注',
  short_answer: '简答',
  multi_match: '词义/情绪匹配',
};

/** 需要打字作答的题型 —— 空白率高低主要由它决定。 */
const TYPED = new Set([
  'sentence_completion', 'summary_completion', 'note_completion',
  'table_completion', 'flow_chart_completion', 'diagram_completion',
  'diagram_label_completion', 'short_answer',
]);

export type SkillRow = {
  taskType: string;
  label: string;
  needsTyping: boolean;
  attempted: number;
  marksGot: number;
  marksFull: number;
  pct: number;
  blankPct: number;
  classPct: number | null;
  classBlankPct: number | null;
};

@Injectable()
export class SkillProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 一名学生的技能画像。
   * windowDays 只影响统计窗口；默认 60 天，短于此的新生也能出图。
   */
  async forStudent(studentId: string, opts?: { windowDays?: number }) {
    const days = opts?.windowDays ?? 60;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        tt: string; level: string; attempted: bigint;
        got: number | null; full: number | null; blank: bigint;
      }>
    >(
      `select coalesce(pq."snapshotContent"->>'taskType','unknown') tt,
              s.level::text level,
              count(*) attempted,
              sum(a."awardedMarks") got,
              sum(pq.marks) full,
              count(*) filter (
                where btrim(coalesce(a."textAnswer",'')) = ''
                  and a."selectedOption" is null) blank
       from "MorningQuizSession" s
       join "PaperAssignment" pa on pa.id = s."paperAssignmentId"
       join "StudentSubmission" sub on sub."assignmentId" = pa.id and sub.status <> 'practice'
       join "AnswerScript" a on a."submissionId" = sub.id
       join "PaperQuestion" pq on pq.id = a."paperQuestionId"
       where sub."studentId" = $1
         and a."awardedMarks" is not null
         and s."quizStart" >= (now() at time zone 'UTC') - ($2 || ' days')::interval
       group by 1, 2`,
      studentId,
      String(days),
    );
    if (!rows.length) return { skills: [] as SkillRow[], levels: [] as string[] };

    // 同级别同窗口的班级基线，用来回答"我是不是比别人差"
    const levels = [...new Set(rows.map((r) => r.level))];
    const base = await this.classBaseline(levels, days);

    const skills: SkillRow[] = rows
      .map((r) => {
        const attempted = Number(r.attempted);
        const full = Number(r.full ?? 0);
        const got = Number(r.got ?? 0);
        const b = base.get(`${r.level}|${r.tt}`);
        return {
          taskType: r.tt,
          label: LABELS[r.tt] ?? r.tt,
          needsTyping: TYPED.has(r.tt),
          attempted,
          marksGot: got,
          marksFull: full,
          pct: full > 0 ? Math.round((1000 * got) / full) / 10 : 0,
          blankPct: attempted > 0 ? Math.round((1000 * Number(r.blank)) / attempted) / 10 : 0,
          classPct: b?.pct ?? null,
          classBlankPct: b?.blankPct ?? null,
        };
      })
      // 样本太少的题型不进画像，避免"做过 1 题得 0 分"被读成短板
      .filter((r) => r.attempted >= 4)
      .sort((a, b) => a.pct - b.pct);

    return { skills, levels };
  }

  /** 班级在这些 level 上的题型基线。 */
  private async classBaseline(levels: string[], days: number) {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ tt: string; level: string; got: number | null; full: number | null; attempted: bigint; blank: bigint }>
    >(
      `select coalesce(pq."snapshotContent"->>'taskType','unknown') tt,
              s.level::text level,
              sum(a."awardedMarks") got, sum(pq.marks) full,
              count(*) attempted,
              count(*) filter (
                where btrim(coalesce(a."textAnswer",'')) = ''
                  and a."selectedOption" is null) blank
       from "MorningQuizSession" s
       join "PaperAssignment" pa on pa.id = s."paperAssignmentId"
       join "StudentSubmission" sub on sub."assignmentId" = pa.id and sub.status <> 'practice'
       join "AnswerScript" a on a."submissionId" = sub.id
       join "PaperQuestion" pq on pq.id = a."paperQuestionId"
       where s.level::text = any($1::text[])
         and a."awardedMarks" is not null
         and s."quizStart" >= (now() at time zone 'UTC') - ($2 || ' days')::interval
       group by 1, 2`,
      levels,
      String(days),
    );
    const m = new Map<string, { pct: number; blankPct: number }>();
    for (const r of rows) {
      const full = Number(r.full ?? 0);
      const attempted = Number(r.attempted);
      m.set(`${r.level}|${r.tt}`, {
        pct: full > 0 ? Math.round((1000 * Number(r.got ?? 0)) / full) / 10 : 0,
        blankPct: attempted > 0 ? Math.round((1000 * Number(r.blank)) / attempted) / 10 : 0,
      });
    }
    return m;
  }

  /**
   * 教师端：一个班的题型 × 学生热图，外加"这周该重讲什么"的排序。
   */
  async forClass(classId: string, opts?: { windowDays?: number }) {
    const days = opts?.windowDays ?? 30;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        name: string; tt: string; level: string;
        got: number | null; full: number | null; attempted: bigint; blank: bigint;
      }>
    >(
      `select u.name,
              coalesce(pq."snapshotContent"->>'taskType','unknown') tt,
              s.level::text level,
              sum(a."awardedMarks") got, sum(pq.marks) full,
              count(*) attempted,
              count(*) filter (
                where btrim(coalesce(a."textAnswer",'')) = ''
                  and a."selectedOption" is null) blank
       from "MorningQuizSession" s
       join "PaperAssignment" pa on pa.id = s."paperAssignmentId"
       join "StudentSubmission" sub on sub."assignmentId" = pa.id and sub.status <> 'practice'
       join "User" u on u.id = sub."studentId"
       join "AnswerScript" a on a."submissionId" = sub.id
       join "PaperQuestion" pq on pq.id = a."paperQuestionId"
       where s."classId" = $1
         and a."awardedMarks" is not null
         and s."quizStart" >= (now() at time zone 'UTC') - ($2 || ' days')::interval
       group by 1, 2, 3`,
      classId,
      String(days),
    );

    const byType = new Map<string, { level: string; got: number; full: number; attempted: number; blank: number }>();
    const byStudent = new Map<string, Map<string, { pct: number; attempted: number; blankPct: number }>>();
    for (const r of rows) {
      const full = Number(r.full ?? 0);
      const got = Number(r.got ?? 0);
      const attempted = Number(r.attempted);
      const blank = Number(r.blank);
      const k = `${r.level}|${r.tt}`;
      const agg = byType.get(k) ?? { level: r.level, got: 0, full: 0, attempted: 0, blank: 0 };
      agg.got += got; agg.full += full; agg.attempted += attempted; agg.blank += blank;
      byType.set(k, agg);

      if (attempted >= 3) {
        const m = byStudent.get(r.name) ?? new Map();
        m.set(k, {
          pct: full > 0 ? Math.round((1000 * got) / full) / 10 : 0,
          attempted,
          blankPct: attempted > 0 ? Math.round((1000 * blank) / attempted) / 10 : 0,
        });
        byStudent.set(r.name, m);
      }
    }

    const skills = [...byType.entries()]
      .map(([k, v]) => {
        const tt = k.split('|')[1];
        return {
          key: k,
          level: v.level,
          taskType: tt,
          label: LABELS[tt] ?? tt,
          needsTyping: TYPED.has(tt),
          attempted: v.attempted,
          pct: v.full > 0 ? Math.round((1000 * v.got) / v.full) / 10 : 0,
          blankPct: v.attempted > 0 ? Math.round((1000 * v.blank) / v.attempted) / 10 : 0,
        };
      })
      .filter((s) => s.attempted >= 10)
      .sort((a, b) => a.pct - b.pct);

    return {
      windowDays: days,
      skills,
      students: [...byStudent.entries()]
        .map(([name, m]) => ({ name, cells: Object.fromEntries(m) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh')),
    };
  }
}
