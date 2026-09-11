import {
  deterministicallyGraded,
  redactSnapshotForStudent,
  scoresReleased,
} from '../morning-quiz/morning-quiz.service';

/**
 * 学生侧答卷响应的**字段白名单**（2026-09-11 审计 S01）。
 *
 * ## 修之前
 *
 * `getOwnSubmission` 用「删几个已知答案字段、其余 `...rest` 原样展开」的
 * 黑名单做脱敏。`PaperQuestion.snapshotAnswer` / `overrideAnswer` /
 * `overrideContent`、`Paper.qaReviewSummary` / `qaReviewIssues`、题目资源的
 * `aiPrompt` 都不在黑名单里 —— 学生答题时打开 devtools 就能读到答案与评分
 * 要点。开卷、交卷、作业列表几个接口更是把整行原样返回：暂存提交后的
 * `autoScore`、判分草稿里的 `awardedMarks` / `autoCorrect` / `markerComment`
 * 在老师定稿之前就到了学生手里。
 *
 * ## 修之后：只列**要给**的字段，其余一概不出
 *
 * 以后谁给表加了新列（答案、评语、内部标记），学生响应里默认**没有**它。
 *
 * 分数与判分信息按答题状态放行，口径与阅读结果页（`stripUnreleasedScores`）
 * 完全一致：
 *
 *   · 整卷分数（autoScore / manualScore / totalScore）——
 *     `scoresReleased(status)`：老师判分定稿才给；
 *   · 逐题得分 / 对错 —— 整卷已发布，**或**已最终提交且这一题是服务端
 *     确定性判的（选择题、精确匹配）；
 *   · 老师评语 —— 只跟整卷分数门走；
 *   · 答案键（正确选项、参考答案、解析、评分要点、快照答案）——
 *     **这组接口在任何状态下都不给**。已交卷后的答案只走阅读结果页
 *     （`/morning-quiz/student-result`、`/history-detail`）那两道门。
 *
 * 纯函数，可测。
 */

type AnyRow = Record<string, any>;

/** 选项只留 key / text —— 丢掉 correct、explanation 以及任何以后加的字段。 */
function optionsView(opts: unknown): unknown {
  if (!Array.isArray(opts)) return opts ?? null;
  return opts.map((o: AnyRow) => ({ key: o?.key, text: o?.text }));
}

function assetView(a: AnyRow) {
  return {
    id: a?.id,
    assetType: a?.assetType,
    storageUrl: a?.storageUrl,
    altText: a?.altText ?? null,
    sortOrder: a?.sortOrder ?? 0,
  };
}

/** 题库母题：只留渲染要的题型、分值、选项文字与配图。题干走 PaperQuestion 的快照。 */
function questionView(q: AnyRow | null | undefined) {
  if (!q) return q ?? null;
  return {
    id: q.id,
    questionType: q.questionType,
    marks: q.marks,
    options: optionsView(q.options),
    assets: Array.isArray(q.assets) ? q.assets.map(assetView) : [],
  };
}

/**
 * 试卷上的一道题。题干取老师在这份卷子里改过的版本（与 PDF 同口径：
 * `overrideContent ?? snapshotContent`），再过阅读卷的白名单脱敏器。
 */
export function paperQuestionView(pq: AnyRow | null | undefined) {
  if (!pq) return pq ?? null;
  return {
    id: pq.id,
    paperId: pq.paperId,
    questionId: pq.questionId,
    sortOrder: pq.sortOrder,
    marks: pq.marks,
    snapshotContent: redactSnapshotForStudent(pq.overrideContent ?? pq.snapshotContent),
    snapshotOptions: optionsView(pq.snapshotOptions),
    question: questionView(pq.question),
  };
}

export interface GradeGates {
  /** 整卷分数门：判分定稿（marked / graded / returned / practice） */
  scoresShown: boolean;
  /** 已最终提交（或练习卷） */
  finallySubmitted: boolean;
}

export function gradeGatesOf(sub: { status: string; finalSubmittedAt?: Date | null }): GradeGates {
  return {
    scoresShown: scoresReleased(sub.status),
    finallySubmitted: sub.status === 'practice' || sub.finalSubmittedAt != null,
  };
}

/** 学生界面不显示内部判分出身标记 —— 与结果页同样剥掉 `[ai-grade]` 前缀。 */
function publicComment(c: unknown): string | null {
  if (typeof c !== 'string') return null;
  return c.replace(/^\[ai-grade\]\s*/, '');
}

/**
 * 一份作答。答题中只回作答本身；分数、对错、评语按上面的门放行。
 * `markedById` / `markedAt` / `clientSeq` 等内部字段永不出。
 */
export function answerScriptView(
  s: AnyRow,
  gates: GradeGates,
  questionType?: string | null,
) {
  const graded = {
    questionType: questionType ?? null,
    awardedMarks: s.awardedMarks ?? null,
    autoCorrect: s.autoCorrect ?? null,
    markedById: s.markedById ?? null,
    markerComment: s.markerComment ?? null,
  };
  const releaseItem = gates.scoresShown || (gates.finallySubmitted && deterministicallyGraded(graded));
  return {
    id: s.id,
    submissionId: s.submissionId,
    paperQuestionId: s.paperQuestionId,
    selectedOption: s.selectedOption ?? null,
    textAnswer: s.textAnswer ?? null,
    updatedAt: s.updatedAt ?? null,
    awardedMarks: releaseItem ? graded.awardedMarks : null,
    autoCorrect: releaseItem ? graded.autoCorrect : null,
    markerComment: gates.scoresShown ? publicComment(graded.markerComment) : null,
  };
}

/**
 * 答卷这一行本身（开卷 / 交卷 / 作业列表里的 mySubmission 用）。
 * 不含题目与作答；整卷分数按分数门放行，门没开时键仍在、值为 null。
 */
export function submissionRowView(sub: AnyRow | null | undefined) {
  if (!sub) return sub ?? null;
  const gates = gradeGatesOf({ status: sub.status, finalSubmittedAt: sub.finalSubmittedAt ?? null });
  return {
    id: sub.id,
    assignmentId: sub.assignmentId,
    studentId: sub.studentId,
    status: sub.status,
    startedAt: sub.startedAt ?? null,
    submittedAt: sub.submittedAt ?? null,
    finalSubmittedAt: sub.finalSubmittedAt ?? null,
    maxScore: sub.maxScore ?? null,
    autoScore: gates.scoresShown ? sub.autoScore ?? null : null,
    manualScore: gates.scoresShown ? sub.manualScore ?? null : null,
    totalScore: gates.scoresShown ? sub.totalScore ?? null : null,
    scoresPending: !gates.scoresShown,
  };
}

/** 答卷详情：答卷行 + 作业 + 试卷结构（题目）+ 作答。 */
export function submissionDetailView(sub: AnyRow) {
  const gates = gradeGatesOf({ status: sub.status, finalSubmittedAt: sub.finalSubmittedAt ?? null });
  const a = sub.assignment;
  const paper = a?.paper;
  const questions: AnyRow[] = Array.isArray(paper?.questions) ? paper.questions : [];
  const typeOf = new Map<string, string | null>();
  for (const pq of questions) typeOf.set(pq.id, pq?.question?.questionType ?? null);
  for (const s of sub.scripts ?? []) {
    if (!typeOf.has(s.paperQuestionId)) {
      typeOf.set(s.paperQuestionId, s?.paperQuestion?.question?.questionType ?? null);
    }
  }
  return {
    ...submissionRowView(sub),
    assignment: a
      ? {
          id: a.id,
          paperId: a.paperId,
          classId: a.classId,
          assignedAt: a.assignedAt ?? null,
          startAt: a.startAt ?? null,
          dueAt: a.dueAt ?? null,
          durationMin: a.durationMin ?? null,
          status: a.status,
          class: a.class ? { id: a.class.id, name: a.class.name, classCode: a.class.classCode } : null,
          paper: paper
            ? {
                id: paper.id,
                name: paper.name,
                subjectId: paper.subjectId,
                durationMin: paper.durationMin,
                totalMarksActual: paper.totalMarksActual,
                examDate: paper.examDate ?? null,
                questions: questions.map(paperQuestionView),
              }
            : null,
        }
      : null,
    scripts: (sub.scripts ?? []).map((s: AnyRow) => ({
      ...answerScriptView(s, gates, typeOf.get(s.paperQuestionId)),
      paperQuestion: s.paperQuestion ? paperQuestionView(s.paperQuestion) : null,
    })),
  };
}

/** 作业列表：作业本身不含答案；只把 mySubmission 换成白名单行。 */
export function assignmentListItemView(a: AnyRow) {
  return {
    id: a.id,
    paperId: a.paperId,
    classId: a.classId,
    assignedAt: a.assignedAt ?? null,
    startAt: a.startAt ?? null,
    dueAt: a.dueAt ?? null,
    durationMin: a.durationMin ?? null,
    status: a.status,
    paper: a.paper
      ? {
          id: a.paper.id,
          name: a.paper.name,
          subjectId: a.paper.subjectId,
          durationMin: a.paper.durationMin,
          totalMarksActual: a.paper.totalMarksActual,
        }
      : null,
    class: a.class ? { id: a.class.id, name: a.class.name, classCode: a.class.classCode } : null,
    mySubmission: submissionRowView(a.mySubmission),
  };
}
