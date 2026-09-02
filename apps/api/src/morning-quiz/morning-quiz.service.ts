import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  EnglishLevel,
  MorningQuizStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { authenticatedStudentWhere, studentNotEligible } from '../common/authenticated-student';
import { AuditService } from '../audit/audit.service';
import { QuickPaperInput, QuickPaperService } from '../ai/quick-paper.service';
import { PrismaService } from '../common/prisma.service';
import { closeNames } from '../common/name-suggest';
import { canActOnClass } from '../common/roles';
import { pickOnExhaustion } from './bank-exhaustion';
import { seqWhereClause, displayKeyOf } from './answer-seq';
import { ShuffleService } from '../shuffle/shuffle.service';
import { secondWindowAppliesTo } from './second-window';
import { levelBucket, levelPushesWordlist } from './level-registry';
import { MorningQuizQaService } from '../morning-quiz-qa/morning-quiz-qa.service';
import { ShortAnswerEvaluatorService } from './short-answer-evaluator.service';
import { SkillProfileService } from './skill-profile.service';
import { VocabTeacherService } from '../vocab/vocab-teacher.service';
import * as fs from 'fs';
import * as path from 'path';
import { validatePaperStructure } from './paper-structure-validator';
import { applyRetractionCredits, autoGradeScripts } from '../student/student.service';

interface ActorCtx {
  id: string;
  role: string;
  ip: string | null;
}

export interface CreateSessionInput {
  date: Date; // y-m-d in school timezone — service derives the windows
  classId: string;
  paperId: string;
  // R10 multi-level: every session belongs to a difficulty band so a
  // class can run several sessions on the same day. Defaults to
  // ielts_authentic for callers that pre-date the multi-level work.
  level?: EnglishLevel;
}

export interface BatchScheduleInput {
  /** Sunday-night-style batch: list of (date, class, paper) tuples to wire. */
  items: Array<{ date: string; classId: string; paperId: string }>;
}

// R10 — attendance window per spec:
//   8:30:00 – 8:40:00     → on_time
//   8:40:00 – 8:59:59.999 → late
//   9:00:00+              → absent (an absent attendance row gets created
//                            on attempted scan after this point so the
//                            roster shows them as no-show)
//   9:00:00               → quiz auto-locks; in-progress submissions
//                            flip to submitted by the cron tick
//
// R15-followup-14 — teacher widened the on_time window from 5 min
// (08:30–08:35) to 10 min (08:30–08:40). The end-of-quiz time stays at
// 09:00 so the total quiz duration is unchanged; students who arrive in
// the second half of the original 30-min window still get late status.
//
// lateCutoff is set at 08:59:59 (NOT 09:00:00) so the strict `<` invariant
// `lateCutoff < quizEnd` still holds and the boundary-second is unambiguous.
import { windowTimesFor, allDayEnabled, withinAllDay } from '../lesson/all-day';

const ATTENDANCE_START_LOCAL = '08:30:00';
const ATTENDANCE_END_LOCAL = '08:40:00';
const LATE_CUTOFF_LOCAL = '08:59:59';
const QUIZ_END_LOCAL = '09:00:00';

/**
 * 这一场此刻是否还能作答 —— 正式窗口，或者老师开着的补考窗口。
 *
 * 学校 2026-08 新政：早上无故缺席的学生中午补考。补考**不动正式窗口**
 * （2026-08-13 用 debug-activate 原地改写 08:30/08:40/09:00 那次，把
 * 早上的真实时间和缺席记录一起弄丢了），而是另开 makeupStart/makeupEnd
 * 一对字段。所有原本判 `now > quizEnd` 的闸门都改走这里。
 */
export function isQuizWindowOpen(
  session: {
    quizEnd: Date;
    makeupStart?: Date | null;
    makeupEnd?: Date | null;
    /** P9.5：全天模式按班灰度 —— 带上它才判断得出这个班开没开。 */
    classId?: string | null;
    /** P9.5：全天 = **这一场那一天**整天，不是永远开着。 */
    date?: Date | null;
  },
  now: Date = new Date(),
): boolean {
  //
  // P9.5 —— 全天开放要在**运行时**生效，不能只在建场次时生效。
  //
  // `windowTimesFor` 只参与创建：它把 00:00 / 23:59 写进新场次的
  // quizStart / quizEnd。可是打开开关那天，今天的场次早就建好了 ——
  // 它身上写的还是 08:30 / 09:00，学生 09:01 打开 App 照样被拒。
  // 「改个环境变量就能全天」这句话只有在这里也认了开关之后才成立。
  //
  // 仍然要求 now 落在**这一场的那一天**：全天不等于永久，昨天的卷子
  // 今天不能接着做。
  if (session.classId !== undefined && allDayEnabled(session.classId)) {
    if (!session.date) return true;
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const todayKey = new Date(now.getTime() + tzOff * 60_000).toISOString().slice(0, 10);
    // Course-app assignments do not expire.  Past papers remain writable as
    // dated backlog; future papers are still closed until their calendar day.
    return session.date.toISOString().slice(0, 10) <= todayKey;
  }
  if (now <= session.quizEnd) return true;
  return isMakeupWindowOpen(session, now);
}

/**
 * 此刻这一场真正的截止时刻 —— 学生端倒计时必须绑这个，不能绑 quizEnd。
 *
 * 2026-08-24 实测事故：第二作答窗内打开答题页，Timer 拿到的是早上
 * 09:00 的 quizEnd，判定「一挂载就已过期」，1500ms 后直接触发
 * onTimeUp 自动交卷 —— 学生连题目都没读完，卷子就被收走了。
 *
 * 规则：第二窗开着就用 makeupEnd，否则用 quizEnd。
 */
export function effectiveEndsAt(
  session: {
    quizEnd: Date;
    makeupStart?: Date | null;
    makeupEnd?: Date | null;
    /** P9.5：全天模式按班灰度 */
    classId?: string | null;
    /** P9.5：全天 = 这一场那一天 */
    date?: Date | null;
  },
  now: Date = new Date(),
): Date {
  //
  // P9.5 —— 全天模式下截止时刻是**当天 23:59**，不是场次身上写的 quizEnd。
  //
  // 不改这里的话，全天开放是假的：打开开关后学生 09:01 进得来，但页面
  // 顶部的倒计时拿到的仍是 09:00，判定「一挂载就已过期」，1.5 秒后触发
  // 自动交卷 —— 卷子在他读完第一题之前就被收走了（浏览器实测：进页面
  // 直接显示「00:00 ⏰ 时间到」）。
  //
  // 这与 2026-08-24 第二作答窗那次事故是同一个形状：倒计时绑错了截止
  // 时刻。那次的教训写在下面几行，这次是同一条。
  if (session.classId !== undefined && allDayEnabled(session.classId) && session.date) {
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    if (withinAllDay(session.date, now)) {
      // 当天 SGT 23:59:00 → UTC 瞬刻
      const dayIso = session.date.toISOString().slice(0, 10);
      return new Date(new Date(`${dayIso}T23:59:00.000Z`).getTime() - tzOff * 60_000);
    }
    const todayKey = new Date(now.getTime() + tzOff * 60_000).toISOString().slice(0, 10);
    if (session.date.toISOString().slice(0, 10) < todayKey) {
      // Historical backlog has no deadline.  Current student UI does not show
      // a countdown, while older clients receive a non-expiring timestamp and
      // therefore cannot auto-submit the paper immediately on mount.
      return new Date('9999-12-31T23:59:59.000Z');
    }
  }
  if (isMakeupWindowOpen(session, now) && session.makeupEnd) return session.makeupEnd;
  return session.quizEnd;
}

/** 此刻是否在补考窗口内（正式窗口已过）。 */
export function isMakeupWindowOpen(
  session: { makeupStart?: Date | null; makeupEnd?: Date | null },
  now: Date = new Date(),
): boolean {
  if (!session.makeupStart || !session.makeupEnd) return false;
  return now >= session.makeupStart && now <= session.makeupEnd;
}

/**
 * Whitelist of `snapshotContent` fields that are safe to send to a student
 * during an active quiz. ANY field not on this list is dropped, including
 * fields that don't exist today but may be added by a future PR
 * (correctXxx, exampleAnswer, explanation, markScheme, answerContent …).
 * The deny-by-default posture means redaction is correct-by-construction
 * — see round-3 SUMMARY C1 for why the previous omit-list was unsafe.
 *
 * If a new safe field is needed by the UI, add it here AND update
 * docs/UI-QUESTION-TYPES.md so the contract stays in sync.
 */
const SAFE_SNAPSHOT_SCALAR_FIELDS = new Set([
  // Common stem / instruction text
  'stem',
  'prompt',
  'instruction',
  // Reading-comprehension shared context
  'passage',
  'passageTitle',
  // IELTS reading task discriminator
  'taskType',
  // Vocab in context
  'contextSentence',
  'targetWord',
  // Sentence transformation
  'original',
  'starter',
  'maxWords',
  // Cloze
  // (passage already listed; per-blank correctAnswer is INTENTIONALLY omitted)
  // Renderer hint set by the AI generator (cloze / vocab / transformation)
  'uiKind',
]);

/**
 * Per-question option-bank fields nested inside snapshotContent (separate
 * from the top-level snapshotOptions). Values are arrays of {key, text};
 * we re-strip each entry to drop any "correct" flag the bank may carry.
 */
const SAFE_SNAPSHOT_BANK_FIELDS = new Set(['headingsBank', 'wordBank']);

/**
 * Strip the INTERNAL provenance sentence from a passage before showing it to
 * a student. Our AI-authored fixtures end the passage with a parenthetical
 * that bundles (a) a provenance note — "AI-authored original … not from a past
 * examination paper" — kept for teacher/audit transparency (the copyright
 * policy: be explicit these are original, not past-paper text), and (b) a
 * glossary of unusual terms that students genuinely need. Students should see
 * the glossary (real exams gloss terms) but NOT the AI-provenance line, which
 * breaks the exam-room illusion. We drop only sentence (a), keep (b); the
 * teacher/bank views don't go through this redactor, so they keep the full
 * note.
 */
export function stripProvenanceForStudent(text: string): string {
  if (typeof text !== 'string') return text;
  // Matches all three wordings the fixtures use: "not from a past exam.",
  // "not from a past exam paper.", "not from a past examination paper.".
  const NOT_PAST = String.raw`not from a past exam(?:ination)?(?:\s+paper)?\.`;
  let out = text
    // Passage glossary note: "(AI-authored original … not from a past exam
    // paper. <glossary>)" → "(<glossary>)" (keep the glossary students need).
    .replace(new RegExp(`\\(AI-authored original [^)]*?${NOT_PAST}\\s*`, 'i'), '(')
    // Instruction meta: "… Section B [N marks] — AI-authored … not from a past
    // exam paper. <rest>" → "… Section B [N marks]. <rest>".
    .replace(new RegExp(`\\s*[—–-]\\s*AI-authored .*?${NOT_PAST}\\s*`, 'i'), '. ');
  // Tidy any empty "()" left when a passage note had no glossary, and collapse
  // doubled spaces — but never touch paragraph newlines.
  out = out.replace(/\s*\(\s*\)\s*/g, ' ').replace(/[ \t]{2,}/g, ' ');
  return out.trim();
}

/**
 * Redact a `snapshotContent` JSON for delivery to a student.
 * Whitelist-based: only known-safe fields pass; everything else (incl.
 * answer-key fields like `correctOption`, `correctAnswer`, `explanation`,
 * `exampleAnswer`, `markScheme`, `answerContent`, `solution`, etc.) is
 * silently dropped.
 */
export function redactSnapshotForStudent(sc: unknown): unknown {
  if (sc == null) return sc;
  if (typeof sc !== 'object' || Array.isArray(sc)) return sc;
  const src = sc as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    if (SAFE_SNAPSHOT_SCALAR_FIELDS.has(k)) {
      // The OLEVEL ingest prepends the section instruction to each question's
      // `stem` (`instruction\n\nQ1…`), so the provenance meta rides along in
      // `stem` too — strip all three text fields. The regex only matches the
      // AI-provenance wording, so non-OLEVEL stems are untouched.
      out[k] = (k === 'passage' || k === 'instruction' || k === 'stem') && typeof src[k] === 'string'
        ? stripProvenanceForStudent(src[k] as string)
        : src[k];
    } else if (SAFE_SNAPSHOT_BANK_FIELDS.has(k) && Array.isArray(src[k])) {
      out[k] = (src[k] as unknown[]).map((b: any) => ({
        key: b?.key,
        text: b?.text,
      }));
    }
    // anything else: dropped (deny by default)
  }
  return out;
}

/**
 * Story identity of a paperKey / passageRef — strips the `_vN` version
 * suffix so a fixture recalibrated from `_v1` to `_v2` (or any later bump)
 * dedups as the SAME story. Without this, the §B `_v1→_v2` recalibration
 * silently made previously-served stories eligible again (a class saw 5/12
 * repeats the following week). Lifetime dedup keys off this, not the raw key.
 *
 * ⚠️ 2026-08-25（外部审查 P2-2）：原来是 `/_v\d+/g` —— **全局替换，
 * 匹配路径里任意位置**。于是 `ielts_v2_batch/Test1` 和 `ielts_batch/Test1`
 * 会被算成同一个 story，两篇内容完全不同的文章互相把对方判成「已服务」。
 * 现在只剥**每一段路径末尾**的版本号（`a_v2/Paper2` → `a/Paper2`），
 * 段中间出现的 `_vN` 原样保留。
 *
 * 真正的长久解法是给每篇内容一个显式 storyId（不靠文件名推导），
 * 那需要回填全部历史 fixture 与 Paper.config，另案处理。
 */
export function storyKey(key: string | null | undefined): string {
  if (key == null) return '';
  return String(key)
    .split('/')
    .map((seg) => seg.replace(/_v\d+$/, ''))
    .join('/');
}

/**
 * OLEVEL 题库的三个难度层，靠 provenanceTag 分桶。
 *
 *   standard   —— 真题 prelim（singapore_olevel_1128）+ AI 全难度自撰。
 *                 服务 `olevel` 层。排除法定义：不属于下面两个 tag 的都算。
 *   simplified —— 中间层，11 题 / 500-790 词的精简叙事。曾服务
 *                 `ielts_simplified`（原「轻雅思」），2026-07-24 停用后
 *                 目前**没有任何层读它** —— 21 篇内容原地保留，将来若
 *                 恢复中间层可直接启用，不必重做。
 *   basic      —— 2026-08-14 新增。真·基础层：短文约 250 词、5 题、
 *                 高频词，且 5 题中 3 题是点选（本校数据：打字题在最弱
 *                 学生里空白率 64%，全打字等于让他们交白卷）。
 *                 服务 `ielts_simplified` 枚举位（学生看到的名字是
 *                 「O-Level 基础」）。
 *
 * 加新层时：加 tag 常量 → 塞进 OLEVEL_NON_STANDARD_TAGS → standard 层
 * 自动把它排除掉，不会串味。
 */
export const OLEVEL_SIMPLIFIED_TAG = 'ai_authored_olevel_1128_simplified';
export const OLEVEL_BASIC_TAG = 'ai_authored_olevel_1128_basic';
const OLEVEL_NON_STANDARD_TAGS = [OLEVEL_SIMPLIFIED_TAG, OLEVEL_BASIC_TAG];

/** 雅思轻量层（2026-08-24）。250-350 词短文 + 6 题，与真题桶物理隔离 ——
 *  自撰内容绝不能混进 authentic 桶被当成剑桥原文。 */
export const IELTS_LIGHT_TAG = 'ai_authored_ielts_light';
/** 雅思标准层的自撰补料。剑桥真题库耗尽后的来源，同样与真题区分标注。 */
export const IELTS_AUTHORED_TAG = 'ai_authored_ielts_2026';

export type OlevelTier = 'standard' | 'simplified' | 'basic';

/** Prisma where 片段：把题库限定到某一层。 */
export function olevelTierCondition(tier: OlevelTier) {
  if (tier === 'simplified') return { provenanceTag: OLEVEL_SIMPLIFIED_TAG };
  if (tier === 'basic') return { provenanceTag: OLEVEL_BASIC_TAG };
  return { NOT: { provenanceTag: { in: OLEVEL_NON_STANDARD_TAGS } } };
}

/**
 * 成绩发布口径（2026-08-14 与老师们定的新政）。
 *
 * 学生交卷后**立刻**能看到每道题的正确答案（即时反馈是学生自己在
 * 沟通会上提的第一诉求），但**得分、对错判定和评语**要等老师人工
 * 判分定稿（status='marked'）之后才下发。
 *
 * 为什么连 MCQ 的自动分也一起憋住：判分是一个整体口径 ——
 * deferAi 模式下 totalScore 在人工判分前只是"选择题部分分"，
 * 之前学生把它当最终分数看，闹过好几次「我怎么才 3 分」。
 * 干脆统一：分数要么是定稿的，要么没有。
 *
 * practice（学生自发重做）不适用 —— 它的判分本来就是即时的。
 */
export function scoresReleased(status: string): boolean {
  return (
    status === 'marked' ||
    status === 'graded' ||
    status === 'returned' ||
    status === 'practice'
  );
}

/**
 * 答案发布口径（2026-08-20 第二作答窗上线后新增的第二道门）。
 *
 * 在此之前答案的门就是「交卷」——交了就看得到。第二窗把这条打破了：
 * 16:00-17:30 学生可以回来改早上写下的答案，如果交卷即给答案，早上
 * 交卷的人下午就能照着答案把卷子改成满分。
 *
 * 所以「交卷」拆成两个动作，答案只认最终提交：
 *   · 暂存提交（finalSubmittedAt = null）—— 9:00 自动收卷走这条。
 *     保留下午回来改的权利，看不到答案。
 *   · 最终提交（finalSubmittedAt 有值）—— 学生主动点「交卷并查看
 *     答案」，或 17:30 自动收尾。给答案，同时锁死不能再改。
 *
 * practice 同样即时给答案 —— 它本来就是学生自发重做，无窗口可言。
 */
export function answersReleased(input: {
  status: string;
  finalSubmittedAt: Date | null;
}): boolean {
  if (input.status === 'practice') return true;
  return input.finalSubmittedAt != null;
}

/**
 * 把未发布的成绩**和答案**从 result payload 里剥掉。**必须在服务端
 * 做** —— 前端藏起来挡不住 devtools。纯函数，可测。
 *
 * 两道独立的门（2026-08-20 第二作答窗上线后拆开）：
 *
 *   分数门 —— scoresReleased(status)，判分定稿才给。
 *     剥 autoScore / manualScore / totalScore / awardedMarks /
 *     autoCorrect / isCorrect / markerComment。
 *
 *   答案门 —— answersReleased(...)，最终提交才给。
 *     剥 correctAnswer / referenceAnswer / explanation。
 *     暂存提交（9:00 自动收卷）的学生 16:00-17:30 还能回来改答案，
 *     这时候给答案就等于让他照抄改满分。
 *
 * 两道门互相独立：最终提交但没判分 → 有答案没分数（这是常态，也正是
 * 学生要的即时反馈）；判了分但没最终提交在流程上不会出现。
 */
// ─────────────────────────────────────────────────────────────
// S12H —— 逐题判分状态 / 答案展示契约
//
// 阶段 12 首次真人验收抓到的：一道**有确定答案的选择题**在结果页显示
// 「还在判分」。根因是这里只有一道**整卷级别**的分数门 —— 卷子没判完就把
// 每一道题的分数与对错一起抹掉，包括交卷那一刻 `autoGradeScripts` 已经
// 确定性判完的那些。
//
// 新口径：**分数门仍然管整卷总分，但逐题的确定性判分在最终提交之后就放行。**
// 需要人判的题、老师的草稿分与评语，一个字都不提前给。
// ─────────────────────────────────────────────────────────────

/** 一道题此刻的判分状态。**只由服务端自己写的持久化字段推出**。 */
export type ItemGradingStatus =
  /** 服务端的确定性判分路径判完了（选择题、精确匹配、空白判 0） */
  | 'auto_graded'
  /** 老师判完且整卷已按既有口径发布 */
  | 'marked'
  /** 有作答，但确实需要人来判 */
  | 'pending_marking'
  /** 持久化状态就是「没作答」 */
  | 'not_answered';

/**
 * 答案展示 —— **语义，不是文案**。API 里不出现「正确答案 / 参考答案 /
 * 评分要点」这类中文标签，措辞归客户端。
 */
export interface AnswerDisplay {
  primaryKind: 'correct' | 'reference';
  primaryValue: string;
  /** 只有在**确实不同**时才有 —— 同一句话不许挂两个名字。 */
  rubricValue?: string;
}

export interface GradingSummary {
  autoGraded: number;
  marked: number;
  pendingMarking: number;
  notAnswered: number;
  total: number;
}

/**
 * 只用于**比较**的归一化：NFKC → 去首尾 → 折叠内部空白 → casefold。
 *
 * **不动展示值**，也不删标点或词 —— 归一化只回答「这两行是不是同一句话」。
 */
export function normalizeForAnswerCompare(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * 这一题是不是**服务端的确定性判分路径**写的。
 *
 * ## 为什么是四条**正面**判据
 *
 * v1.0 用的是反面判据：「不是老师判的、且评语不以 `[ai-grade]`
 * 开头」。复审当场拆穿：`getStudentResult` 在交给本函数**之前**就把
 * 那个前缀擦掉了（为了不把内部标记给学生看）—— 于是 AI 判的题看起来
 * 就像确定性判的，分数被提前放了出去。靠「看起来不像 AI」当证据，
 * 只要上游多洗一道就失效。
 *
 * 现在只认**已经被证明是确定性的那一条路**：MCQ。
 * `autoGradeScripts` 里 `questionType === 'mcq'` 走的是共享的 `gradeMcq`，
 * 然后直接 `continue` —— 它**永远不会**进 AI 那一支。而阅读卷里的
 * 判断题 / 选择题 / 选项配对题都是以 MCQ 形式入库的，用户报的那一题
 * 正在这个集合里。
 *
 * 精确匹配的简答题（Path 1）客观上也是确定性的，但它与 AI 判的那些
 * 共用同一组持久化字段，**没有 schema 改动就区分不了**。宁可让它继续
 * 等老师，也不能把 AI 的判断当成确定结论发出去。**失败关闭。**
 */
export function deterministicallyGraded(item: {
  questionType?: string | null;
  awardedMarks: number | null;
  autoCorrect: boolean | null;
  markedById?: string | null;
}): boolean {
  // 正面判据一：只有 MCQ 这条路被证明是确定性的。
  if (item.questionType !== 'mcq') return false;
  // 正面判据二：没有老师插手（全仓库只有 marker.service 写这个字段）。
  if (item.markedById != null) return false;
  // 正面判据三 / 四：判分路径确实落了结论。
  if (typeof item.autoCorrect !== 'boolean') return false;
  if (item.awardedMarks == null) return false;
  return true;
}

/** 有没有作答 —— 只看持久化的作答内容，不从「客户端没传」推出「没作答」。 */
function answeredOf(item: { studentAnswer?: string | null }): boolean {
  return item.studentAnswer != null && String(item.studentAnswer).trim() !== '';
}

/**
 * 一道题的判分状态。
 *
 * 顺序有讲究：**没最终提交就什么都不说**（这一屏此时本来就不该有判分信息）；
 * 提交之后确定性判分优先于「整卷发布」—— 它在整卷判完前后都是同一件事实，
 * 状态不该因为老师什么时候点定稿而跳变。
 */
export function classifyItemGrading(
  item: {
    questionType?: string | null;
    awardedMarks: number | null;
    autoCorrect: boolean | null;
    markedById?: string | null;
    studentAnswer?: string | null;
  },
  o: { finallySubmitted: boolean; scoresShown: boolean },
): ItemGradingStatus {
  const answered = answeredOf(item);
  if (!o.finallySubmitted) return answered ? 'pending_marking' : 'not_answered';
  // 确定性判 0 的空白题仍然是 auto_graded —— 0 分是结论，不是「没判」。
  if (deterministicallyGraded(item)) return 'auto_graded';
  if (o.scoresShown && item.awardedMarks != null) return 'marked';
  if (!answered) return 'not_answered';
  return 'pending_marking';
}

/**
 * 这一题该展示哪一个答案值。
 *
 * · 客观题用 `correct`，主观题用 `reference` —— 这是**题型**决定的语义；
 * · 展示值优先取 `correctAnswer`（那是规范答案），退到 `referenceAnswer`；
 * · 另一个值只有在**归一化后确实不同**时才作为 `rubricValue` 出现。
 *
 * 用户验收看到的「正确答案 / 参考答案 两行一模一样」，就是这里缺了最后一条。
 */
export function answerDisplayOf(item: {
  questionType?: string | null;
  correctAnswer?: string | null;
  referenceAnswer?: string | null;
}): AnswerDisplay | null {
  const pick = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() !== '' ? v : null;
  const correct = pick(item.correctAnswer);
  const reference = pick(item.referenceAnswer);
  if (!correct && !reference) return null;

  const primaryValue = (correct ?? reference) as string;
  const other = correct ? reference : null;
  const rubricValue =
    other != null &&
    normalizeForAnswerCompare(other) !== normalizeForAnswerCompare(primaryValue)
      ? other
      : undefined;

  return {
    primaryKind: item.questionType === 'mcq' ? 'correct' : 'reference',
    primaryValue,
    ...(rubricValue == null ? {} : { rubricValue }),
  };
}

export function gradingSummaryOf(statuses: ReadonlyArray<ItemGradingStatus>): GradingSummary {
  return {
    autoGraded: statuses.filter((s) => s === 'auto_graded').length,
    marked: statuses.filter((s) => s === 'marked').length,
    pendingMarking: statuses.filter((s) => s === 'pending_marking').length,
    notAnswered: statuses.filter((s) => s === 'not_answered').length,
    total: statuses.length,
  };
}

export function stripUnreleasedScores<
  T extends {
    status: string;
    finalSubmittedAt?: Date | null;
    autoScore: number | null;
    manualScore: number | null;
    totalScore: number | null;
    items: Array<{
      awardedMarks: number | null;
      autoCorrect: boolean | null;
      isCorrect: boolean | null;
      markerComment: string | null;
      commentSource: string | null;
      /** S12H —— 判分出身。全仓库只有 marker.service 写它。 */
      markedById?: string | null;
      /** S12H —— 「有没有作答」只看它。 */
      studentAnswer?: string | null;
      questionType?: string | null;
      correctAnswer?: string | null;
      referenceAnswer?: string | null;
      explanation?: string | null;
    }>;
  },
>(
  result: T,
): T & {
  scoresPending: boolean;
  answersPending: boolean;
  gradingSummary: GradingSummary | null;
} {
  const showScores = scoresReleased(result.status);
  // 迁移前的历史答卷已回填 finalSubmittedAt；真为 undefined 的只有
  // 未经本函数以外路径构造的测试桩，按「已发布」处理更安全 —— 旧行为
  // 就是交卷即给答案，不能因为加了一道门把历史成绩页的答案弄没。
  const finalAt =
    result.finalSubmittedAt === undefined ? new Date(0) : result.finalSubmittedAt;
  const showAnswers = answersReleased({ status: result.status, finalSubmittedAt: finalAt });
  // 「最终提交了没有」与答案门同源：练习卷（practice）也算已交。
  const finallySubmitted = result.status === 'practice' || finalAt != null;

  const statuses: ItemGradingStatus[] = [];
  const items = result.items.map((it) => {
    const status = classifyItemGrading(it, { finallySubmitted, scoresShown: showScores });
    statuses.push(status);

    // 逐题分数的放行条件：整卷已发布，**或者**已最终提交且这一题是确定性判的。
    const releaseItemScore = showScores || (finallySubmitted && deterministicallyGraded(it));
    // 评语永远只跟整卷的分数门走 —— 老师的草稿反馈不提前给。
    const releaseComment = showScores;

    // **内部字段显式抑去**。`markedById` 只用来判出身，绝不能随
    // 展开进学生响应 —— v1.0 就是这么把老师 id 漏出去的。
    // 也不换一个内部字段顶上：出身本身不是学生该知道的事。
    const { markedById: _provenance, ...publicItem } = it as typeof it & {
      markedById?: string | null;
    };
    const next = {
      ...publicItem,
      ...(releaseItemScore
        ? {}
        : { awardedMarks: null, autoCorrect: null, isCorrect: null }),
      ...(releaseComment ? {} : { markerComment: null, commentSource: null }),
      ...(showAnswers ? {} : { correctAnswer: null, referenceAnswer: null, explanation: null }),
      gradingStatus: status,
    };
    return { ...next, answerDisplay: showAnswers ? answerDisplayOf(next) : null };
  });

  return {
    ...result,
    ...(showScores ? {} : { autoScore: null, manualScore: null, totalScore: null }),
    scoresPending: !showScores,
    answersPending: !showAnswers,
    // 交卷之前不给 —— 那时「几题判完了」本身就不是学生该看到的信息。
    gradingSummary: finallySubmitted ? gradingSummaryOf(statuses) : null,
    items,
  };
}

/**
 * Combine a y-m-d and a hh:mm:ss string in school local time (assumed
 * Asia/Singapore = UTC+8) into a UTC Date. We avoid pulling a tz library
 * for this single use; the offset is hard-coded but adjustable via the
 * MORNING_QUIZ_TZ_OFFSET_MIN env var if the school ever moves.
 */
export function combineLocal(dateOnlyIso: string, timeLocal: string, tzOffsetMin = 8 * 60): Date {
  const [h, m, s] = timeLocal.split(':').map(Number);
  // dateOnlyIso = "2026-05-12"
  const [y, mo, d] = dateOnlyIso.split('-').map(Number);
  // Build UTC ms then subtract the tz offset to land on the "local" wall clock.
  const utcMs = Date.UTC(y, mo - 1, d, h, m, s ?? 0) - tzOffsetMin * 60_000;
  return new Date(utcMs);
}

@Injectable()
export class MorningQuizService {
  private readonly logger = new Logger('MorningQuizService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly shuffle: ShuffleService,
    private readonly quickPaper: QuickPaperService,
    private readonly qaReview: MorningQuizQaService,
    // Optional Claude-backed short-answer grader. Wired in the module so
    // the re-grade endpoint here applies byte-identical rules to the
    // cron's lockOne path (which uses the same evaluator).
    private readonly evaluator?: ShortAnswerEvaluatorService,
    private readonly skills?: SkillProfileService,
    // 基础层词表自动推送用。optional：既有测试直接 new 本服务，
    // 不给就只是不推词，绝不影响出卷。
    private readonly vocabTeacher?: VocabTeacherService,
  ) {}

  /**
   * 判一份卷子的所有作答。
   *
   * 2.0：短答要不要交给 Claude，由 MORNING_QUIZ_AI_GRADING 决定，**默认关闭**。
   * 本校铁律是零 Anthropic 调用，短答一律由老师人工判；关闭时走 deferAi ——
   * MCQ 仍然即时判分，短答 park 成待判（awardedMarks=null）进人工队列，
   * 而不是被判 0 分。要恢复 AI 判分，设 MORNING_QUIZ_AI_GRADING=on。
   */
  private async gradeScripts(scripts: Parameters<typeof autoGradeScripts>[0]) {
    return process.env.MORNING_QUIZ_AI_GRADING === 'on'
      ? autoGradeScripts(scripts, this.evaluator)
      : autoGradeScripts(scripts, undefined, { deferAi: true });
  }

  // ─────────────────── 2.0 技能画像 ───────────────────

  /** 学生自查。复用 history-by-name 的姓名解析（含重名消歧）。 */
  async skillProfileByName(
    rawName: string,
    studentIdFilter?: string,
    opts?: { windowDays?: number },
  ) {
    const resolved = await this.resolveStudentByName(rawName, studentIdFilter);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const student = resolved.student;
    if (!this.skills) throw new BadRequestException({ code: 'skill_profile_unavailable' });
    const { skills, levels } = await this.skills.forStudent(student.id, opts);
    return {
      student: { id: student.id, name: student.name },
      windowDays: opts?.windowDays ?? 60,
      levels,
      skills,
    };
  }

  /** 教师端班级热图。鉴权与生词本教师接口一致。 */
  async classSkillProfile(
    classId: string,
    actor: { id: string; role: string },
    opts?: { windowDays?: number },
  ) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    if (!this.skills) throw new BadRequestException({ code: 'skill_profile_unavailable' });
    return this.skills.forClass(classId, opts);
  }

  /**
   * Wraps a paper generator with the AI QA review loop.
   *
   * 1. Caller passes a fresh-paper-builder closure (passage_pick or AI gen).
   * 2. We run it, run review, and decide:
   *    - verdict=pass         → return paperId (live)
   *    - verdict=needs_review → return paperId (live but flagged for teacher)
   *    - verdict=reject       → archive the paper, bump retries, re-run the
   *      generator from step 1. Cap at 2 retries (3 total tries) before
   *      surfacing the last reject paper for manual triage.
   *
   * Retries upgrade to the strict (Opus) model so we don't get the same
   * subtle miss twice.
   */
  private async generateWithQaLoop(
    builder: () => Promise<string>,
    actor: ActorCtx,
    contextLabel: string,
  ): Promise<string> {
    const MAX_RETRIES = 2;
    let lastPaperId = '';
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const paperId = await builder();
      lastPaperId = paperId;
      try {
        const review = await this.qaReview.reviewPaper(paperId, actor, {
          strict: attempt > 0,
        });
        await this.prisma.paper.update({
          where: { id: paperId },
          data: { qaReviewRetries: attempt },
        });
        if (review.verdict === 'reject' && attempt < MAX_RETRIES) {
          this.logger.warn(
            `qa-review reject (attempt ${attempt + 1}/${MAX_RETRIES + 1}) ` +
              `paper=${paperId} ${contextLabel} — archiving + regenerating. ` +
              `summary="${review.summary.slice(0, 120)}"`,
          );
          await this.prisma.paper.update({
            where: { id: paperId },
            data: { status: 'archived' },
          });
          continue;
        }
        return paperId;
      } catch (e: any) {
        // Review itself failed (Anthropic outage, parse error). Don't loop —
        // just surface the paper as-is with verdict=pending so a teacher can
        // either re-run review or push it through manually.
        this.logger.error(
          `qa-review error paper=${paperId} ${contextLabel}: ${String(e?.message ?? e).slice(0, 200)}`,
        );
        return paperId;
      }
    }
    // Hit the retry cap. Audit it and return the last paper for triage.
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.qa_review.retry_exhausted',
      entityType: 'Paper',
      entityId: lastPaperId,
      ip: actor.ip,
      metadata: { contextLabel, attempts: MAX_RETRIES + 1 },
    });
    return lastPaperId;
  }

  async createSession(input: CreateSessionInput, actor: ActorCtx) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }

    const dateIso = input.date.toISOString().slice(0, 10);

    // No morning quiz on Sat/Sun — school doesn't run quizzes on
    // weekends. Without this guard a mis-click in the schedule UI's
    // "+ 一次性 session" modal (date picker has no weekend filter)
    // creates a real session, then lockPastSessions at quizEnd seeds
    // the entire roster as `absent`, surfacing as a fake mass-absence
    // on the parent portal / dashboards. The 2026-05-10 (Sunday) G11
    // incident produced 611 spurious absent rows before this guard
    // existed. Boundary-level reject is the cheap fix; the cron
    // carries a defense-in-depth check for legacy weekend sessions.
    const weekday = new Date(dateIso + 'T00:00:00Z').getUTCDay();
    if (weekday === 0 || weekday === 6) {
      throw new BadRequestException({
        code: 'no_weekend_sessions',
        dateIso,
        weekday,
        hint: weekday === 0 ? 'Sunday' : 'Saturday',
      });
    }

    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    // 全天开放（4.0 阶段 B）默认**关**，此时下面两行取的就是原来的
    // 08:30 / 09:00，行为一字不差。打开后窗口变成 00:00–23:59。
    // 开关支持按班灰度，回滚只需改环境变量，见 lesson/all-day.ts。
    const win = windowTimesFor(input.classId);
    const attendanceStart = combineLocal(dateIso, win.attendanceStartLocal, tzOff);
    // 出勤已于 2026-08-24 停用，attendanceEnd / lateCutoff 只为满足下面的
    // 严格递增不变量而存在。全天模式下把它们贴着开窗时刻放。
    const attendanceEnd = win.allDay
      ? new Date(attendanceStart.getTime() + 60_000)
      : combineLocal(dateIso, ATTENDANCE_END_LOCAL, tzOff);
    const lateCutoff = win.allDay
      ? new Date(attendanceStart.getTime() + 120_000)
      : combineLocal(dateIso, LATE_CUTOFF_LOCAL, tzOff);
    const quizEnd = combineLocal(dateIso, win.quizEndLocal, tzOff);

    // Invariant: window times must be strictly ordered. (create) Without this, a
    // misconfigured MORNING_QUIZ_TZ_OFFSET_MIN or a bad set of LOCAL
    // constants would silently produce a session where every scan falls
    // into the absent branch, or where lateCutoff <= attendanceEnd makes
    // 'late' status unreachable.
    if (
      !(attendanceStart < attendanceEnd) ||
      !(attendanceEnd < lateCutoff) ||
      !(lateCutoff < quizEnd)
    ) {
      throw new BadRequestException({
        code: 'invalid_session_time_window',
        windows: { attendanceStart, attendanceEnd, lateCutoff, quizEnd },
      });
    }

    const cls = await this.prisma.class.findUnique({
      where: { id: input.classId },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException({ code: 'class_not_found' });

    const paper = await this.prisma.paper.findUnique({
      where: { id: input.paperId },
      select: { id: true, totalMarksActual: true },
    });
    if (!paper) throw new NotFoundException({ code: 'paper_not_found' });

    // Pre-publish structure gate (docs/PRD §6.1). A structurally-broken paper
    // — empty options, no discoverable answer key, blank stem (the 5/26 TFNG
    // incident class) — must never reach a live session. validatePaperStructure
    // is pure + golden-fixture tested. Both callers (batch-schedule and the
    // weekly-generate cron) wrap createSession in try/catch, so a rejection
    // skips that one session and is recorded, never crashing the batch.
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: input.paperId },
      select: {
        sortOrder: true,
        snapshotOptions: true,
        snapshotContent: true,
        snapshotAnswer: true,
        question: { select: { questionType: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    const structureViolations = validatePaperStructure(paperQuestions as any);
    if (structureViolations.length > 0) {
      throw new BadRequestException({
        code: 'paper_structure_invalid',
        paperId: input.paperId,
        violations: structureViolations,
      });
    }

    // Bind paper → class via PaperAssignment (1:1). Reuse existing if present;
    // otherwise create. dueAt aligned with quizEnd so existing student.service
    // already-closed gate triggers naturally at 09:00.
    const assignment = await this.prisma.paperAssignment.upsert({
      where: { paperId_classId: { paperId: input.paperId, classId: input.classId } },
      update: { dueAt: quizEnd, startAt: attendanceStart },
      create: {
        paperId: input.paperId,
        classId: input.classId,
        assignedById: actor.id,
        dueAt: quizEnd,
        startAt: attendanceStart,
        durationMin: 30,
        status: 'scheduled',
      },
    });

    // R10 multi-level: a session is keyed on (date, class, level), so a
    // single class can run sessions across all 3 difficulty bands on the
    // same day without colliding. Default to ielts_authentic when the
    // caller didn't supply one (pre-multi-level callers).
    const sessionLevel: EnglishLevel = input.level ?? 'ielts_authentic';
    const existing = await this.prisma.morningQuizSession.findUnique({
      where: {
        date_classId_level: {
          date: attendanceStart,
          classId: input.classId,
          level: sessionLevel,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'session_already_exists',
        sessionId: existing.id,
      });
    }

    const session = await this.prisma.morningQuizSession.create({
      data: {
        date: attendanceStart,
        classId: input.classId,
        level: sessionLevel,
        paperAssignmentId: assignment.id,
        attendanceStart,
        attendanceEnd,
        lateCutoff,
        quizStart: attendanceStart,
        quizEnd,
        qrSecret: randomBytes(16).toString('hex'),
        status: MorningQuizStatus.scheduled,
        scheduledById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.session.create',
      entityType: 'MorningQuizSession',
      entityId: session.id,
      ip: actor.ip,
      metadata: { date: dateIso, classId: input.classId, paperId: input.paperId },
    });

    // 基础层（O-Level 基础，枚举位 ielts_simplified）：建场即自动推送
    // 该篇配套词表到全班生词本。这不是锦上添花 —— 调研（2026-08-14）
    // 证实基础层学生的另外两条词来源都是断的：不会主动点词，短文又
    // 刻意用高频词、自动采集的难度筛子会全部滤掉。词表是唯一供给。
    // 配套词表**不再**在建场时推 ——「谁收词」由扫码那一刻决定。
    //
    // 建场时推全班的问题（2026-08-24 审计定性）：学生选哪个难度是扫码
    // 才定的，五个层混坐一个班，推全班意味着只做雅思真题的学生也收到
    // 基础层的词，卡片例句来自他从没读过的文章。现在由
    // attendance.scanQr 在学生扫进短文层的那一刻只推给他本人
    // （levelPushesWordlist + resolveWordlistForPaperConfig）。
    return session;
  }

  /**
   * Sunday-night batch. Loops items and creates one session per (date, class,
   * paper). Each item runs in its own try/catch so a single conflict doesn't
   * abort the whole week. Returns a per-item result array the UI can render.
   */
  async batchSchedule(input: BatchScheduleInput, actor: ActorCtx) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const results: Array<
      | { ok: true; index: number; sessionId: string }
      | { ok: false; index: number; code: string; detail?: unknown }
    > = [];

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      try {
        const session = await this.createSession(
          { date: new Date(item.date), classId: item.classId, paperId: item.paperId },
          actor,
        );
        results.push({ ok: true, index: i, sessionId: session.id });
      } catch (e: any) {
        const detail = typeof e?.response === 'object' ? e.response : e?.message;
        const code = (e?.response?.code as string) ?? 'unknown_error';
        results.push({ ok: false, index: i, code, detail });
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.batch_schedule',
      entityType: 'MorningQuizSession',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        total: input.items.length,
        ok: results.filter((r) => r.ok).length,
        fail: results.filter((r) => !r.ok).length,
      },
    });

    return { results };
  }

  /**
   * AI batch — Sunday-night-style. For each weekday × class, look up the
   * class's English level, call QuickPaperService to author a fresh paper,
   * then create a MorningQuizSession bound to it. Each tuple runs in its
   * own try/catch so a single Anthropic timeout doesn't kill the week.
   */
  async batchGenerateForWeek(
    input: {
      weekStart: string;
      classIds?: string[];
      questionsPerPaper?: number;
      /**
       * Wipe existing sessions+papers in the window before generating.
       * Used when a fresh content bank has just been ingested and the
       * operator wants the week's quizzes regenerated against the new
       * bank rather than waiting for LRU rotation to organically reach
       * the new picks. Destructive: any student submissions or answer
       * scripts in the window are deleted along with the papers via FK
       * cascade.
       */
      force?: boolean;
    },
    actor: ActorCtx,
  ) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const monday = new Date(input.weekStart);
    if (Number.isNaN(monday.getTime())) {
      throw new BadRequestException({ code: 'bad_week_start' });
    }
    const targetCount = input.questionsPerPaper ?? 18;

    // Generate one entry per non-skipped weekday in the week starting at
    // `monday` (caller passes a Monday but we don't assume — we iterate
    // 7 calendar days and filter by weekday). School schedule: no morning
    // quiz on Mondays (assembly day) or weekends, so the active week is
    // Tue / Wed / Thu / Fri = 4 sessions per class per level. If the
    // school's no-quiz-day policy ever changes, update SKIP_WEEKDAYS.
    //
    // Using getUTCDay() (not getDay()) because the underlying Date columns
    // are stored as @db.Date at UTC midnight and we want the comparison
    // to match how the DB sees the day — avoids "server is in Pacific
    // tz and thinks UTC-midnight 5/12 is still 5/11" type bugs.
    const SKIP_WEEKDAYS = new Set([0, 1, 6]); // 0=Sun, 1=Mon, 6=Sat
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 86_400_000);
      if (SKIP_WEEKDAYS.has(d.getUTCDay())) continue;
      dates.push(d.toISOString().slice(0, 10));
    }

    // If caller omitted classIds, default to every class that has at least
    // one ClassEnglishLevel row — i.e. every class scheduled for morning
    // quiz. Lets school-wide regen go through with one POST instead of the
    // operator enumerating class IDs by hand.
    let classIds = input.classIds ?? [];
    if (classIds.length === 0) {
      const rows = await this.prisma.classEnglishLevel.findMany({
        distinct: ['classId'],
        select: { classId: true },
      });
      classIds = rows.map((r) => r.classId);
      if (classIds.length === 0) {
        throw new BadRequestException({
          code: 'no_classes_with_levels',
          hint: 'No class has a ClassEnglishLevel registered; nothing to generate.',
        });
      }
    }

    type Outcome =
      | { ok: true; date: string; classId: string; level: string; sessionId: string; paperId: string }
      | { ok: false; date: string; classId: string; level?: string; code: string; detail?: string };
    const outcomes: Outcome[] = [];

    // force: pre-wipe existing sessions + papers (and their FK-cascaded
    // assignments / questions / submissions / scripts) for the window.
    // We delete Paper rows by id; PaperAssignment → Cascade,
    // PaperQuestion → Cascade, MorningQuizSession → Cascade (via
    // PaperAssignment), StudentSubmission → Cascade (via PaperAssignment),
    // AnswerScript → Cascade (via StudentSubmission). One deleteMany call
    // unwinds the whole dependent tree.
    let wiped = 0;
    if (input.force) {
      // Bug 6 fix — match by half-open instant range, not by `date: { in: [UTC midnights] }`.
      // `MorningQuizSession.date` is written from `attendanceStart` (a real
      // instant), so `in: [UTC midnight, ...]` matched nothing and the wipe
      // deleted 0 sessions — even when the preview (after its own fix)
      // reported N>0. The range filter [Mon, next-Mon) is intentionally
      // wider than `dates[]` (which already filters out Mon/Sat/Sun); since
      // no session is generated on a skip-day anyway, the extra coverage is
      // a no-op in practice and we get exact agreement with the preview.
      const rangeStart = monday;                                       // inclusive
      const rangeEnd = new Date(monday.getTime() + 7 * 86_400_000);    // exclusive
      const sessions = await this.prisma.morningQuizSession.findMany({
        where: {
          classId: { in: classIds },
          date: { gte: rangeStart, lt: rangeEnd },
        },
        select: { id: true, paperAssignment: { select: { paperId: true } } },
      });
      const paperIds = sessions
        .map((s) => s.paperAssignment?.paperId)
        .filter((id): id is string => !!id);
      if (paperIds.length > 0) {
        const r = await this.prisma.paper.deleteMany({
          where: { id: { in: paperIds } },
        });
        wiped = r.count;
        this.logger.log(
          `batch-regenerate force-wiped ${wiped} paper(s) (${sessions.length} session row(s)) in [${rangeStart.toISOString().slice(0, 10)}..${rangeEnd.toISOString().slice(0, 10)})`,
        );
      }
    }

    for (const dateIso of dates) {
      for (const classId of classIds) {
        // R10 multi-level: a class can register N difficulty bands at
        // once. Fan out to one (date, classId, level) session per band.
        const levelRows = await this.prisma.classEnglishLevel.findMany({
          where: { classId },
          orderBy: { level: 'asc' },
        });
        if (levelRows.length === 0) {
          outcomes.push({ ok: false, date: dateIso, classId, code: 'class_level_not_set' });
          continue;
        }

        const cls = await this.prisma.class.findUnique({
          where: { id: classId },
          select: { weeklyFocus: true },
        });
        const weeklyFocus = cls?.weeklyFocus ?? null;

        for (const levelRow of levelRows) {
          try {
            // Idempotent — skip if a session already exists for
            // (date, class, level). Multi-level adds the level dimension
            // so different bands on the same day no longer collide.
            const existingSession = await this.prisma.morningQuizSession.findUnique({
              where: {
                date_classId_level: {
                  date: new Date(dateIso),
                  classId,
                  level: levelRow.level,
                },
              },
            });
            if (existingSession) {
              outcomes.push({
                ok: false,
                date: dateIso,
                classId,
                level: levelRow.level,
                code: 'session_already_exists',
                detail: existingSession.id,
              });
              continue;
            }

            // R10 — every level now picks pre-curated content from a
            // human-vetted bank instead of calling the AI inline:
            //   ielts_authentic   → Cambridge IELTS Academic passages
            //                       (Cambridge IELTS 8, all 12; later
            //                       books to be ingested)
            //   ielts_simplified  → Singapore O-Level 1128 §B-style
            //                       short narratives (Claude-authored,
            //                       ~350-500 words, easier vocabulary).
            //                       Used to read IELTS GT 14 but was
            //                       re-routed to O-Level syllabus for
            //                       cohort fit — the "middle band" is
            //                       now O-Level at a stretch difficulty,
            //                       not IELTS GT.
            //   olevel            → Singapore O-Level 1128 §B narratives
            //                       (real-PDF Singapore prelims + Claude-
            //                       authored full-difficulty originals)
            //
            // The QA review loop (generateWithQaLoop) is bypassed: the
            // bank items have already passed audit at ingest time and
            // re-reviewing them with AI would just burn Anthropic credit.
            //
            // weeklyFocus is preserved as a field on the paper config
            // for future use (e.g. teacher post-hoc filtering); it's no
            // longer threaded into a runtime AI prompt.
            void weeklyFocus;
            void targetCount;
            let paperId: string;
            // 等级 → 题库桶的对应关系由 level-registry 一张表统一表达。
            // 别在这里按枚举名 if/else 堆分支 —— 枚举名和实际内容早就
            // 对不上了（ielts_simplified 装的是 O-Level 基础）。
            const bucket = levelBucket(levelRow.level);
            if (bucket === 'ielts_authentic' || bucket === 'ielts_light') {
              paperId = await this.pickPassageAndCreatePaper(
                'IELTS', 'AUTH', classId, dateIso, actor,
                { provenanceFilter: bucket === 'ielts_light' ? 'light' : 'authentic' },
              );
            } else if (bucket === 'olevel_basic' || bucket === 'olevel_simplified') {
              paperId = await this.pickOlevelPaperAndCreatePaper(
                classId, dateIso, actor,
                { provenanceFilter: bucket === 'olevel_basic' ? 'basic' : 'simplified' },
              );
            } else {
              // olevel basic band: pull from OLEVEL standard tier.
              paperId = await this.pickOlevelPaperAndCreatePaper(
                classId, dateIso, actor,
                { provenanceFilter: 'standard' },
              );
            }

            const session = await this.createSession(
              { date: new Date(dateIso), classId, paperId, level: levelRow.level },
              actor,
            );
            outcomes.push({
              ok: true,
              date: dateIso,
              classId,
              level: levelRow.level,
              sessionId: session.id,
              paperId,
            });
          } catch (e: any) {
            const code = (e?.response?.code as string) ?? e?.message ?? 'unknown_error';
            outcomes.push({
              ok: false,
              date: dateIso,
              classId,
              level: levelRow.level,
              code: String(code).slice(0, 100),
            });
          }
        }
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.batch_generate',
      entityType: 'MorningQuizSession',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        weekStart: input.weekStart,
        classCount: classIds.length,
        forceWiped: wiped,
        ok: outcomes.filter((o) => o.ok).length,
        fail: outcomes.filter((o) => !o.ok).length,
      },
    });
    return { wiped, outcomes };
  }

  /**
   * Build a Paper from one whole passage in the bank instead of generating
   * unrelated questions via AI. Logic:
   *   1. Find every Question under (subjectCode, componentCode) with
   *      sourceType='past_paper_reference' (i.e. real exam content).
   *   2. Group by passage prefix parsed from sourceRef. We use the
   *      pattern `IELTS/<book>/Test<N>/P<M>` for Cambridge IELTS — an
   *      example sourceRef like `IELTS/8/Test1/P1/Q3` collapses to
   *      `IELTS/8/Test1/P1` as the passage key.
   *   3. Skip passages already used by this class within the last 30
   *      days (we stash the passageRef in Paper.config so the next call
   *      can find it without joining through PaperAssignment back-relations).
   *   4. Pick a remaining passage at random; if every passage has been
   *      used in the window, fall through to least-recent.
   *   5. Spin up a Paper + PaperQuestion rows snapshotting the questions'
   *      content / answer / options, just like the AI-gen path does.
   */
  private async pickPassageAndCreatePaper(
    subjectCode: string,
    componentCode: string,
    classId: string,
    dateIso: string,
    actor: ActorCtx,
    opts: { provenanceFilter?: 'authentic' | 'simplified' | 'light' } = {},
  ): Promise<string> {
    const subject = await this.prisma.subject.findFirst({
      where: { code: subjectCode },
      // R10 follow-up — Subject has no createdAt; cuid is itself
      // timestamp-prefixed (lexicographic order ≈ creation order),
      // so `orderBy id asc` reliably picks the OLDEST IELTS subject.
      // Both ielts-ingest and content-bootstrap use the same order
      // so ingest + picker always agree on which row to read/write.
      orderBy: { id: 'asc' },
      include: { components: { where: { code: componentCode } } },
    });
    if (!subject || subject.components.length === 0) {
      throw new BadRequestException({
        code: 'subject_or_component_not_found',
        subjectCode,
        componentCode,
      });
    }
    const component = subject.components[0];

    // 雅思侧三个桶共用同一个 Subject/Component（IELTS/AUTH），靠
    // provenanceTag 区分：
    //   authentic → 剑桥 Academic 原文 + ai_authored_ielts_2026 自撰补料
    //               （剑桥库 2026-08 耗尽后的来源，标注为非真题）
    //   light     → ai_authored_ielts_light，250-350 词短文 + 6 题
    //   simplified→ cambridge_ielts_gt（General Training，当前无层在读）
    //
    // authentic 用**排除法**（不是 GT、不是 light）而非白名单：新增一个
    // 自撰批次时不用回来改这里，标准层自动收录；反过来，light 和 GT 是
    // 精确匹配，绝不会串味 —— 短文混进真题层会让学生以为雅思就这难度。
    const filter = opts.provenanceFilter ?? 'authentic';
    const provenanceCondition =
      filter === 'simplified'
        ? { provenanceTag: 'cambridge_ielts_gt' }
        : filter === 'light'
          ? { provenanceTag: IELTS_LIGHT_TAG }
          : { NOT: { provenanceTag: { in: ['cambridge_ielts_gt', IELTS_LIGHT_TAG] } } };

    const bank = await this.prisma.question.findMany({
      where: {
        subjectId: subject.id,
        componentId: component.id,
        status: 'active',
        sourceType: 'past_paper_reference',
        ...provenanceCondition,
      },
      orderBy: { sourceRef: 'asc' },
    });

    // Group by passage prefix. e.g. "IELTS/8/Test1/P1/Q3" → "IELTS/8/Test1/P1"
    const byPassage = new Map<string, typeof bank>();
    for (const q of bank) {
      const ref = q.sourceRef ?? '';
      const m = ref.match(/^([^/]+\/[^/]+\/Test\d+\/P\d+)\//);
      if (!m) continue;
      const key = m[1];
      if (!byPassage.has(key)) byPassage.set(key, []);
      byPassage.get(key)!.push(q);
    }
    if (byPassage.size === 0) {
      throw new BadRequestException({
        code: 'no_passages_in_bank',
        hint: `No real-question bank under ${subjectCode}/${componentCode}. Ingest past-paper PDFs first.`,
      });
    }

    // Filter out passages this class has EVER been served (no time window).
    // User decision: a passage that's been used once is retired from the
    // candidate pool permanently — repeats only happen when the entire
    // bank is exhausted (LRU fallback below), at which point ops sees a
    // loud warn() and ingests more content. When a Paper row is deleted
    // (e.g. via force-regenerate), its passageRef silently rejoins the
    // candidate pool — no extra bookkeeping needed because we read the
    // ever-used set live from Paper rows.
    //
    // 5/19 WiFi-outage policy: when a morning-quiz session is *cancelled*
    // (e.g. WiFi failure prevented students from scanning, so no one
    // actually saw the paper), its passage rejoins the candidate pool.
    // Attendance rows survive the cancel — only the LRU consumption
    // tagged "this passage was burnt on this class" is reversed. The
    // OR-arm `morningQuizSession: null` preserves non-morning-quiz
    // assignments (homework etc.) which never had a session to begin
    // with.
    //
    // Round-7 hardening retained:
    //   - scope to (this subject + passage_pick mode) so unrelated picks
    //     can't skew the bucket;
    //   - track lastUsedAt per passage so the LRU fallback picks the
    //     oldest, not the deterministic [0] (which used to silent-loop
    //     "every Monday same passage");
    //   - emit a loud warn() when the bank is depleted so ops can act.
    const recentPapers = await this.prisma.paper.findMany({
      where: {
        subjectId: subject.id,
        assignments: {
          some: {
            classId,
            OR: [
              { morningQuizSession: null },
              { morningQuizSession: { status: { not: 'cancelled' } } },
            ],
          },
        },
      },
      select: { config: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const usedPassageRefs = new Set<string>();
    const lastUsedAt = new Map<string, number>();
    for (const p of recentPapers) {
      const cfg = p.config as { mode?: string; passageRef?: string } | null;
      if (cfg?.mode !== 'passage_pick' || !cfg?.passageRef) continue;
      const sk = storyKey(cfg.passageRef);
      usedPassageRefs.add(sk);
      const t = p.createdAt.getTime();
      if ((lastUsedAt.get(sk) ?? 0) < t) {
        lastUsedAt.set(sk, t);
      }
    }
    const candidates = Array.from(byPassage.keys()).filter(
      (k) => !usedPassageRefs.has(storyKey(k)),
    );
    let pick: string;
    if (candidates.length > 0) {
      pick = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // 题库耗尽。**默认硬失败**（见 bank-exhaustion.ts）—— 静默回收
      // 与「绝不重复」的铁律直接矛盾，2026-08-25 外部审查指出。
      // MORNING_QUIZ_ALLOW_REPEAT=on 时才退回 LRU。
      this.logger.warn(
        `passage_pick bank exhausted (lifetime) for class=${classId} subject=${subjectCode} ` +
          `(bank=${byPassage.size}, ever served=${usedPassageRefs.size}). Ingest more passages.`,
      );
      pick = pickOnExhaustion(
        Array.from(byPassage.keys()),
        lastUsedAt,
        storyKey,
        { classId, bucket: `IELTS/${opts?.provenanceFilter ?? 'authentic'}`, everServed: usedPassageRefs.size },
      );
    }
    // Sort questions inside the passage NUMERICALLY by Q-number — string
    // sort puts Q10..Q13 before Q2..Q9, which scrambles the test ordering.
    // We extract the trailing /Q<n> from sourceRef and sort by the integer.
    const passageQuestions = byPassage.get(pick)!.slice().sort((a, b) => {
      const an = parseInt(a.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
      const bn = parseInt(b.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
      return an - bn;
    });

    const totalMarks = passageQuestions.reduce((s, q) => s + q.marks, 0);
    const paper = await this.prisma.paper.create({
      data: {
        name: `Morning Quiz ${pick} (${dateIso})`,
        ownerId: actor.id,
        subjectId: subject.id,
        componentId: component.id,
        durationMin: 30,
        totalMarksTarget: totalMarks,
        totalMarksActual: totalMarks,
        status: 'draft',
        generatedSeed: Math.floor(Math.random() * 1e9),
        config: {
          mode: 'passage_pick',
          passageRef: pick,
          // Store the provenance filter so bankStatsForClass can bucket
          // authentic vs simplified picks correctly without resorting to
          // path-suffix heuristics on the passageRef.
          provenanceFilter: filter,
          questionCount: passageQuestions.length,
          dateIso,
        },
      },
    });
    for (let i = 0; i < passageQuestions.length; i++) {
      const q = passageQuestions[i];
      await this.prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          questionId: q.id,
          sortOrder: i + 1,
          snapshotContent: q.content as any,
          snapshotAnswer: q.answerContent as any,
          snapshotOptions: q.options as any,
          marks: q.marks,
        },
      });
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.passage_pick',
      entityType: 'Paper',
      entityId: paper.id,
      ip: actor.ip,
      metadata: {
        passageRef: pick,
        classId,
        dateIso,
        questionCount: passageQuestions.length,
      },
    });
    return paper.id;
  }

  /**
   * R10 — OLEVEL paper picker. Mirrors pickPassageAndCreatePaper but
   * for the OLEVEL bank (sourceRef prefix `OLEVEL/<setCode>/PaperN`).
   * Each "set" is a complete pre-curated paper Claude wrote and POSTed
   * via /api/olevel-ingest/paper, with mixed question types (cloze /
   * vocab / transformation). Picks the least-recently-used paper for
   * this class with lifetime de-dup — same as IELTS picker.
   */
  private async pickOlevelPaperAndCreatePaper(
    classId: string,
    dateIso: string,
    actor: ActorCtx,
    opts: { provenanceFilter?: OlevelTier } = {},
  ): Promise<string> {
    const subject = await this.prisma.subject.findFirst({
      where: { code: '1123' },
      include: { components: true },
    });
    if (!subject || subject.components.length === 0) {
      throw new BadRequestException({
        code: 'subject_not_seeded',
        hint: 'OLEVEL 1123 syllabus not seeded; run prisma seed.',
      });
    }
    // The OLEVEL ingest API stamps Question.sourceRef =
    // `OLEVEL/<setCode>/Paper<n>/Q<m>`. Group by the prefix up to /Q.
    //
    // R10 follow-up — the OLEVEL bank is now bucketed into two tiers by
    // provenanceTag:
    //   standard  → real-PDF prelims (singapore_olevel_1128) + AI-authored
    //               full-difficulty (ai_authored_olevel_1128). Serves the
    //               `olevel` basic band.
    //   simplified → AI-authored shorter/easier narratives
    //               (ai_authored_olevel_1128_simplified). Serves the
    //               `ielts_simplified` middle band, which used to read
    //               IELTS GT but now reads O-Level §B at a stretch-toward-
    //               O-Level difficulty.
    // The filter is implemented as inclusion (simplified) vs exclusion
    // (standard = anything that is NOT the simplified tag) so any future
    // standard-tier provenance tag we add (e.g. for Boon Lay, Hua Yi) is
    // picked up automatically without code changes.
    const filter: OlevelTier = opts.provenanceFilter ?? 'standard';
    const tierCondition = olevelTierCondition(filter);
    const bank = await this.prisma.question.findMany({
      where: {
        subjectId: subject.id,
        status: 'active',
        sourceType: 'past_paper_reference',
        sourceRef: { startsWith: 'OLEVEL/' },
        ...tierCondition,
      },
      orderBy: { sourceRef: 'asc' },
    });
    const byPaperKey = new Map<string, typeof bank>();
    for (const q of bank) {
      const m = q.sourceRef?.match(/^(OLEVEL\/[^/]+\/Paper\d+)\//);
      if (!m) continue;
      const key = m[1];
      if (!byPaperKey.has(key)) byPaperKey.set(key, []);
      byPaperKey.get(key)!.push(q);
    }
    if (byPaperKey.size === 0) {
      throw new BadRequestException({
        code: 'no_olevel_papers_in_bank',
        hint: 'POST OLEVEL papers via /api/olevel-ingest/paper first.',
      });
    }

    // Lifetime de-dup against this class's OLEVEL picks (no time window),
    // SCOPED TO THIS TIER. A paper that's been served once is retired
    // from the candidate pool permanently; repeats only happen when the
    // entire tier is exhausted (LRU fallback below). Cross-tier picks
    // don't dedup each other — the basic and middle bands run on
    // different days for different students. When a Paper row is deleted
    // (e.g. force-regenerate), its paperKey silently rejoins this pool.
    // 5/19 WiFi-outage policy mirrors pickPassageAndCreatePaper:
    // cancelled morning-quiz sessions release their paperKey back into the
    // candidate pool. See that function for the full rationale.
    const recent = await this.prisma.paper.findMany({
      where: {
        subjectId: subject.id,
        assignments: {
          some: {
            classId,
            OR: [
              { morningQuizSession: null },
              { morningQuizSession: { status: { not: 'cancelled' } } },
            ],
          },
        },
      },
      select: { config: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const usedKeys = new Set<string>();
    const lastUsedAt = new Map<string, number>();
    for (const p of recent) {
      const cfg = p.config as { mode?: string; paperKey?: string; provenanceFilter?: string } | null;
      if (cfg?.mode !== 'olevel_curated' || !cfg?.paperKey) continue;
      // Only count picks from the same tier. Legacy rows without
      // provenanceFilter were all standard-tier (this field landed with
      // the simplified-tier split), so default to 'standard' for those.
      const pickTier = cfg.provenanceFilter ?? 'standard';
      if (pickTier !== filter) continue;
      const sk = storyKey(cfg.paperKey);
      usedKeys.add(sk);
      const t = p.createdAt.getTime();
      if ((lastUsedAt.get(sk) ?? 0) < t) lastUsedAt.set(sk, t);
    }
    const candidates = Array.from(byPaperKey.keys()).filter((k) => !usedKeys.has(storyKey(k)));
    let pick: string;
    if (candidates.length > 0) {
      pick = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // 同 pickPassageAndCreatePaper：默认硬失败，不静默回收。
      this.logger.warn(
        `olevel pick bank exhausted (lifetime, tier=${filter}) for class=${classId} ` +
          `(bank=${byPaperKey.size}, ever served=${usedKeys.size}). Ingest more papers.`,
      );
      pick = pickOnExhaustion(
        Array.from(byPaperKey.keys()),
        lastUsedAt,
        storyKey,
        { classId, bucket: `OLEVEL/${filter}`, everServed: usedKeys.size },
      );
    }
    // Sort by trailing Q-number numerically (same trick as IELTS).
    const items = byPaperKey.get(pick)!.slice().sort((a, b) => {
      const an = parseInt(a.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
      const bn = parseInt(b.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
      return an - bn;
    });
    const totalMarks = items.reduce((s, q) => s + q.marks, 0);
    const component = subject.components[0];
    const paper = await this.prisma.paper.create({
      data: {
        name: `Morning Quiz ${pick} (${dateIso})`,
        ownerId: actor.id,
        subjectId: subject.id,
        componentId: component.id,
        durationMin: 30,
        totalMarksTarget: totalMarks,
        totalMarksActual: totalMarks,
        status: 'draft',
        generatedSeed: Math.floor(Math.random() * 1e9),
        config: {
          mode: 'olevel_curated',
          paperKey: pick,
          provenanceFilter: filter,
          dateIso,
          questionCount: items.length,
        },
      },
    });
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      await this.prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          questionId: q.id,
          sortOrder: i + 1,
          snapshotContent: q.content as any,
          snapshotAnswer: q.answerContent as any,
          snapshotOptions: q.options as any,
          marks: q.marks,
        },
      });
    }
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.olevel_pick',
      entityType: 'Paper',
      entityId: paper.id,
      ip: actor.ip,
      metadata: { paperKey: pick, classId, dateIso, questionCount: items.length },
    });
    return paper.id;
  }

  /**
   * Read-only mirror of the pick* logic: for each registered level on a
   * class, count how many unique passages/papers the bank has and how
   * many this class has EVER been served. Used by the schedule UI to
   * flag depletion BEFORE the operator hits "generate" and silently
   * lands on an LRU recycle.
   *
   * Lifetime dedup matches the dedup policy in pickPassageAndCreatePaper
   * and pickOlevelPaperAndCreatePaper — if you change one you must change
   * the other or this counter lies. Field name `usedRecent` is kept for
   * API backward-compat (UI clients still read it); semantically it now
   * means "ever served" not "in last 30 days".
   *
   * Cancelled-session exception: papers whose linked morning-quiz session
   * has status='cancelled' are NOT counted as used here. The schedule UI
   * already differentiates cancelled rows visually, and the cancel button
   * is the operator's signal that "this paper was never actually seen by
   * students" (e.g. 5/19 WiFi outage). Removing them from this tally
   * lets the operator recycle the slot for next week without touching
   * the attendance records. Filter is duplicated in the two pick
   * functions so generation honours the same release.
   */
  async bankStatsForClass(classId: string): Promise<
    Array<{
      level: EnglishLevel;
      totalBank: number;
      usedRecent: number;
      remaining: number;
      depleted: boolean;
    }>
  > {
    const levelRows = await this.prisma.classEnglishLevel.findMany({
      where: { classId },
      orderBy: { level: 'asc' },
    });
    if (levelRows.length === 0) return [];

    // Helper: count unique passage prefixes in the IELTS bank under one
    // provenance filter. Mirrors pickPassageAndCreatePaper's bucketing.
    const countIeltsBank = async (
      provenanceFilter: 'authentic' | 'simplified',
    ): Promise<number> => {
      const subject = await this.prisma.subject.findFirst({
        where: { code: 'IELTS' },
        orderBy: { id: 'asc' },
        include: { components: { where: { code: 'AUTH' } } },
      });
      if (!subject || subject.components.length === 0) return 0;
      const provenanceCondition =
        provenanceFilter === 'simplified'
          ? { provenanceTag: 'cambridge_ielts_gt' }
          : { NOT: { provenanceTag: 'cambridge_ielts_gt' } };
      const bank = await this.prisma.question.findMany({
        where: {
          subjectId: subject.id,
          componentId: subject.components[0].id,
          status: 'active',
          sourceType: 'past_paper_reference',
          ...provenanceCondition,
        },
        select: { sourceRef: true },
      });
      const passages = new Set<string>();
      for (const q of bank) {
        const m = (q.sourceRef ?? '').match(/^([^/]+\/[^/]+\/Test\d+\/P\d+)\//);
        if (m) passages.add(m[1]);
      }
      return passages.size;
    };

    // Helper: count unique OLEVEL paper prefixes in a given tier. Mirrors
    // pickOlevelPaperAndCreatePaper's bucketing — simplified =
    // ai_authored_olevel_1128_simplified only; standard = everything else
    // under OLEVEL/* (real-PDF prelims + AI-authored full-difficulty).
    const countOlevelBank = async (
      tier: OlevelTier,
    ): Promise<number> => {
      const subject = await this.prisma.subject.findFirst({
        where: { code: '1123' },
        select: { id: true },
      });
      if (!subject) return 0;
      const tierCondition = olevelTierCondition(tier);
      const bank = await this.prisma.question.findMany({
        where: {
          subjectId: subject.id,
          status: 'active',
          sourceType: 'past_paper_reference',
          sourceRef: { startsWith: 'OLEVEL/' },
          ...tierCondition,
        },
        select: { sourceRef: true },
      });
      const paperKeys = new Set<string>();
      for (const q of bank) {
        const m = q.sourceRef?.match(/^(OLEVEL\/[^/]+\/Paper\d+)\//);
        if (m) paperKeys.add(m[1]);
      }
      return paperKeys.size;
    };

    // Per-class lifetime picks (no time window), scoped to mode so we
    // don't accidentally count cross-level papers against each other.
    // Mirrors the lifetime dedup in pickPassageAndCreatePaper /
    // pickOlevelPaperAndCreatePaper.
    // 5/19 WiFi-outage policy mirrors pickPassageAndCreatePaper /
    // pickOlevelPaperAndCreatePaper: cancelled morning-quiz sessions
    // release their config.passageRef / config.paperKey back into the
    // candidate pool so the "本班累计已用 / 剩 N" tally on the schedule
    // page UI correctly reflects what's actually still recyclable.
    const recent = await this.prisma.paper.findMany({
      where: {
        assignments: {
          some: {
            classId,
            OR: [
              { morningQuizSession: null },
              { morningQuizSession: { status: { not: 'cancelled' } } },
            ],
          },
        },
      },
      select: { config: true },
    });
    const usedByMode = {
      passage_pick_authentic: new Set<string>(),
      passage_pick_simplified: new Set<string>(),
      olevel_curated_standard: new Set<string>(),
      olevel_curated_simplified: new Set<string>(),
    };
    for (const p of recent) {
      const cfg = p.config as
        | { mode?: string; passageRef?: string; paperKey?: string; provenanceFilter?: string }
        | null;
      if (!cfg) continue;
      if (cfg.mode === 'passage_pick' && cfg.passageRef) {
        // passage_pick is now the IELTS authentic path only — the middle
        // band was re-routed to olevel_curated_simplified. Any historical
        // passage_pick picks (including pre-rework GT picks) count against
        // the authentic bucket for accounting purposes; they are also
        // already dedup'd at the picker level via passageRef lifetime set.
        usedByMode.passage_pick_authentic.add(cfg.passageRef);
      } else if (cfg.mode === 'olevel_curated' && cfg.paperKey) {
        // provenanceFilter landed with the simplified-tier split; legacy
        // rows without it were all standard-tier.
        const tier = cfg.provenanceFilter === 'simplified' ? 'simplified' : 'standard';
        if (tier === 'simplified') usedByMode.olevel_curated_simplified.add(cfg.paperKey);
        else usedByMode.olevel_curated_standard.add(cfg.paperKey);
      }
    }

    const out: Array<{
      level: EnglishLevel;
      totalBank: number;
      usedRecent: number;
      remaining: number;
      depleted: boolean;
    }> = [];
    for (const lr of levelRows) {
      let totalBank = 0;
      let usedRecent = 0;
      if (lr.level === 'ielts_authentic') {
        totalBank = await countIeltsBank('authentic');
        usedRecent = usedByMode.passage_pick_authentic.size;
      } else if (lr.level === 'ielts_simplified') {
        // 2026-08-14：「O-Level 基础」层，余量按 basic 桶算。
        totalBank = await countOlevelBank('basic');
        usedRecent = usedByMode.olevel_curated_simplified.size;
      } else {
        totalBank = await countOlevelBank('standard');
        usedRecent = usedByMode.olevel_curated_standard.size;
      }
      const remaining = Math.max(0, totalBank - usedRecent);
      out.push({
        level: lr.level,
        totalBank,
        usedRecent,
        remaining,
        depleted: remaining === 0,
      });
    }
    return out;
  }

  private levelToQuickPaperInput(
    level: EnglishLevel,
    dateIso: string,
    targetCount: number,
  ): QuickPaperInput {
    // Distribute targetCount across the topic mix per level. Keep MVP simple —
    // even split with rounding adjustments. 18 default → ~4 topics × 4-5 each.
    const split = (codes: string[]): Array<{ code: string; count: number }> => {
      const base = Math.floor(targetCount / codes.length);
      const rem = targetCount - base * codes.length;
      return codes.map((c, i) => ({ code: c, count: base + (i < rem ? 1 : 0) }));
    };

    if (level === 'ielts_authentic') {
      return {
        syllabusCode: 'IELTS',
        topics: split(['IR.1', 'IR.2', 'IR.4', 'IR.6']),
        difficulty: 3,
        durationMin: 30,
        includeDiagrams: false,
        paperName: `Morning Quiz IELTS-Auth ${dateIso}`,
        multiPart: false,
      };
    }
    if (level === 'ielts_simplified') {
      // R10: this is the MIDDLE band — strong O-Level students stretching
      // toward IELTS. IELTS task types (TFNG, matching, summary completion)
      // but with O-Level-grade vocabulary and shorter passages. Keep
      // difficulty low (2) and pick the easier IELTS topic codes
      // (IR.1 = main idea, IR.2 = detail, IR.4 = factual matching) —
      // skip the harder inference / opinion / vocabulary tasks
      // (IR.3, IR.5, IR.7) used for authentic-band drills.
      return {
        syllabusCode: 'IELTS',
        topics: split(['IR.1', 'IR.2', 'IR.4']),
        difficulty: 2,
        durationMin: 30,
        includeDiagrams: false,
        paperName: `Morning Quiz IELTS-Simplified ${dateIso}`,
        multiPart: false,
      };
    }
    // olevel
    return {
      syllabusCode: '1123',
      topics: split(['EL.1', 'EL.2', 'EL.4', 'EL.5']),
      difficulty: 2,
      durationMin: 30,
      includeDiagrams: false,
      paperName: `Morning Quiz O-Level ${dateIso}`,
      multiPart: false,
    };
  }

  /** Look at a week's worth of scheduled sessions for the calendar UI.
   *  R15-Audit#2 Finding #4: hide sessions whose class has been
   *  archived — they'd otherwise pollute the schedule view with rows
   *  the operator can't act on. */
  async listScheduled(weekStart: Date) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
    return this.prisma.morningQuizSession.findMany({
      where: {
        date: { gte: weekStart, lt: weekEnd },
        class: { archivedAt: null },
      },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { include: { paper: { select: { id: true, name: true, totalMarksActual: true } } } },
      },
      orderBy: [{ date: 'asc' }, { class: { name: 'asc' } }],
    });
  }

  /**
   * Cancel — used both by teacher UI and by the holiday admin toggle. Sets
   * status=cancelled so cron skips it; existing attendance rows untouched.
   */
  async cancelSession(sessionId: string, actor: ActorCtx, reason?: string) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const before = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
    if (!before) throw new NotFoundException({ code: 'session_not_found' });

    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: { status: MorningQuizStatus.cancelled },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.session.cancel',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: { before: { status: before.status }, after: { status: after.status } },
      metadata: { reason: reason ?? null },
    });
    return after;
  }

  /**
   * Get the paper for the student, with shuffle applied. Caller must have
   * confirmed there's an Attendance row (i.e. they passed scanQr earlier).
   */
  async getStudentView(sessionId: string, studentId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: { paperAssignment: { select: { paperId: true, id: true, classId: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (session.status === MorningQuizStatus.cancelled) {
      throw new BadRequestException({ code: 'session_cancelled' });
    }

    // Confirm the student has an Attendance row (gate: only scanned-in
    // students can fetch the paper; manual_correction also qualifies).
    const att = await this.prisma.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    });
    // 「absent 就拒绝」曾经把第二作答窗整个堵死。absent 这个状态有两个
    // 来源，语义完全不同：
    //   · cron 给名册上没扫码的人插的行 —— scanTime / makeupAt 都是
    //     null，这种确实该拒绝，人根本没来。
    //   · 学生**真的扫了码**但被判为缺席 —— 出勤开着时，第二窗扫码走的
    //     正是这条（早上没来是既成事实，照实记 absent + makeupAt）。
    //     这种人拿着有效令牌站在教室里，却被这道闸挡在答题页外。
    // 2026-08-13 那次补考老师被迫用 debug-activate 把正式窗口整个挪到
    // 下午，事后归因于「想保住出勤记录」；真正的原因是走补考分支的学生
    // 压根进不来。判据改成「扫过码没有」而不是「算不算缺席」。
    const everScanned = !!att && (att.scanTime != null || att.makeupAt != null);
    //
    // P9（2026-08-27）—— **课程不再依赖考勤**。
    //
    // 产品方向改为账号制全天课程 APP：学生登录后点「开始今天的课程」，
    // 服务端建答卷。这条路上根本没有考勤行 —— 再用「有没有扫过码」当闸
    // 就是把所有自助开始的学生挡在卷子外面（实测 403 no_attendance_record）。
    //
    // 判据换成**有没有这一场的正式答卷**。它同样能拦住「拉取别班/别层
    // 卷子」：没有那一场的答卷就进不去。而且它对两条入口都成立 ——
    // 扫码建的答卷和账号制建的答卷是同一张表、同一条唯一索引。
    //
    // 考勤仍然记录（扫码那条路照旧写），只是不再是**必要条件**。
    const paperAssignmentId = session.paperAssignmentId;
    const realSubmission = paperAssignmentId
      ? await this.prisma.studentSubmission.findFirst({
          where: { assignmentId: paperAssignmentId, studentId, status: { not: 'practice' } },
          select: { id: true },
        })
      : null;
    const hasRealSubmission = realSubmission != null;
    const attendanceOk = !!att && !(att.status === AttendanceStatus.absent && !everScanned);
    if (!hasRealSubmission && !attendanceOk) {
      throw new ForbiddenException({ code: 'no_lesson_started' });
    }

    const paperId = session.paperAssignment.paperId;
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: { config: true, status: true, qaTeacherAction: true },
    });
    // Round-7 C-F3 — a teacher-rejected paper has status=archived but the
    // MorningQuizSession's PaperAssignment still points at it. Without
    // this guard a student would still receive the rejected paper.
    if (paper?.status === 'archived' || paper?.qaTeacherAction === 'rejected') {
      throw new BadRequestException({ code: 'paper_archived' });
    }
    // R10 multi-level: every session now carries its own `level` column
    // (one of ielts_authentic / ielts_simplified / olevel) so we don't
    // need to round-trip through ClassEnglishLevel anymore. Pre-multi-
    // level sessions were back-filled by the migration to ielts_authentic.
    const sessionLevel: EnglishLevel | null = session.level ?? null;
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: { sortOrder: 'asc' },
      include: {
        question: { select: { id: true, questionType: true } },
      },
    });

    // Skip question-order shuffle on passage-pick papers — IELTS Reading
    // groups questions into tasks (Q1-4 matching headings, Q5-9 T/F/NG, etc.)
    // and shuffling tears those groups apart. Option-shuffle inside MCQ
    // questions is still applied per-question by the relabel below.
    const isPassagePick =
      ((paper?.config as { mode?: string } | null)?.mode ?? null) === 'passage_pick';
    let ordered: typeof paperQuestions;
    if (isPassagePick) {
      ordered = paperQuestions;
    } else {
      const map = await this.shuffle.getOrCreate(studentId, paperId);
      ordered = this.shuffle.applyToPaper(paperQuestions, map);
    }

    // Relabel option keys A/B/C/D so the student's choices map cleanly to
    // displayed letters; the original `key` values are preserved separately
    // in the shuffle map for reverse-mapping at save time. (For passage-pick
    // we skip the relabel because keys carry semantic meaning — A=Babylonians
    // in matching_features must stay A.)
    const delivered = ordered.map((pq) => {
      if (pq.question.questionType !== 'mcq') return pq;
      if (isPassagePick) return pq;
      const opts = (pq.snapshotOptions as Array<{ key: string; text: string }> | null) ?? [];
      const relabeled = opts.map((opt, i) => ({
        ...opt,
        key: String.fromCharCode(65 + i),
      }));
      return { ...pq, snapshotOptions: relabeled };
    });

    // SECURITY: strip every answer-key field before sending to a student.
    // snapshotOptions[].correct + snapshotContent.markScheme / answerContent
    // would otherwise be readable in F12 and let the student aim for full
    // marks. Mirrors student.service.redactForStudent's contract.
    //
    // The redaction is an EXPLICIT WHITELIST — anything not on the list is
    // dropped. This avoids the omit-list trap where a future field
    // (correctOption, exampleAnswer, explanation, …) silently flows to the
    // student because nobody updated the deny list. See round-3 SUMMARY C1.
    const stripOptions = (opts: unknown) => {
      if (!Array.isArray(opts)) return opts;
      return opts.map((o: any) => ({ key: o?.key, text: o?.text }));
    };
    const stripSnapshotContent = redactSnapshotForStudent;

    // Derive the quiz UI mode for the client. `level` comes straight
    // from the session row (R10 multi-level); fallback to a paper.config
    // heuristic for any pre-migration session that somehow has level
    // null (defensive).
    const paperMode = (paper?.config as { mode?: string } | null)?.mode ?? null;
    const level = sessionLevel ?? (paperMode === 'passage_pick' ? 'ielts_authentic' : 'olevel');

    // F1 — Resume-on-different-device support. If an in-progress
    // submission already exists for this (assignment, student), pull
    // every persisted AnswerScript so the client can repopulate the
    // form on a fresh device. Returns an empty object if the student
    // has not autosaved anything yet (or if the submission has already
    // been locked / submitted — in which case existingAnswers is empty
    // and the take-paper UI starts blank, matching pre-F1 behaviour).
    const existingAnswers: Record<
      string,
      { content: any; selectedOption: string | null; textAnswer: string | null; clientSeq: number | null; flagged: boolean }
    > = {};
    const inProgressSub = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignment.id,
        studentId,
        status: { not: 'practice' },
      },
      select: { id: true, status: true },
    });
    if (inProgressSub && inProgressSub.status === 'in_progress') {
      const scripts = await this.prisma.answerScript.findMany({
        where: { submissionId: inProgressSub.id },
        select: {
          paperQuestionId: true,
          selectedOption: true,
          textAnswer: true,
          clientSeq: true,
        },
      });
      // P8.5 —— MCQ 要把**原始 key 翻回学生这次看到的字母**。
      //
      // 库里存的是原始 key（保存时反查过一次，判分才对得上答案卷），
      // 而屏幕上的选项被打乱并重新标了 A/B/C/D。直接把原始 key 发回去，
      // 恢复后高亮的是另一个选项 —— 实测：学生点了「the school」，
      // 刷新回来亮的是「the harbour」。等于系统悄悄改了他的答案。
      const shuffleMap =
        isPassagePick || scripts.length === 0
          ? null
          : await this.shuffle.getOrCreate(studentId, paperId);
      const toDisplayKey = (pqId: string, originalKey: string): string => {
        if (!shuffleMap) return originalKey;
        const src = paperQuestions.find((q) => q.id === pqId);
        if (!src || src.question.questionType !== 'mcq') return originalKey;
        const opts = (src.snapshotOptions as Array<{ key: string }> | null) ?? [];
        // 翻不动就原样返回（没打乱这一题、或 key 不在选项里）——
        // 宁可保持库里的值，也不猜一个位置。
        return (
          displayKeyOf(
            shuffleMap.optionOrders[pqId],
            opts.map((o) => o?.key),
            originalKey,
          ) ?? originalKey
        );
      };
      for (const s of scripts) {
        const selectedOption =
          s.selectedOption != null ? toDisplayKey(s.paperQuestionId, s.selectedOption) : null;
        existingAnswers[s.paperQuestionId] = {
          // `content` 是老字段，保留给还没更新的客户端。新客户端读下面
          // 两个分开的字段 —— 同时有选项和文字的题（passage-pick 的
          // 双写）在单字段形态里必定丢一半。
          content: selectedOption != null ? selectedOption : s.textAnswer,
          selectedOption,
          textAnswer: s.textAnswer,
          clientSeq: s.clientSeq,
          // `flagged` is reserved for a future "I'll come back to this
          // one" toggle — wired through here so the API shape lands
          // intact even before the column exists.
          flagged: false,
        };
      }
    }

    // 今天有没有第二作答窗（16:00-17:30）。前端拿它决定交卷弹窗是给
    // 一个按钮还是两个 —— 没有第二窗的日子，「先交，下午再改」是个
    // 骗人的选项，点了以后答案要等到 09:00 收卷才出来。
    //
    // RC1.1 —— **全天模式下没有「第二作答窗」这回事**：一整天都开着。
    //
    // 人工测试实测：MORNING_QUIZ_ALL_DAY=true 的环境里，交卷弹窗仍然写着
    // 「今天下午 16:00–17:30 还有一个作答时段」「先存着，下午再改」——
    // 与实际规则冲突（倒计时已经延到 23:59）。文案由这个字段驱动，
    // 所以在**服务端**关掉它，前端不需要自己猜配置。
    const secondWindowToday = allDayEnabled(session.classId) ? false : secondWindowAppliesTo({
      secondWindowEnv: process.env.MORNING_QUIZ_SECOND_WINDOW,
      dateIsoLocal: new Date(
        session.date.getTime() +
          Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60) * 60_000,
      )
        .toISOString()
        .slice(0, 10),
      weekdayLocal: session.date.getUTCDay(),
    });

    return {
      sessionId: session.id,
      // P9：账号制入口下没有考勤行 —— 这两个字段都要能为空。
      // submissionId 改从**真实答卷**取（考勤行上的那份只是索引，
      // 自助开始的学生根本没有考勤行）。前端拿它给本地草稿分桶。
      attendanceId: att?.id ?? null,
      submissionId: realSubmission?.id ?? att?.submissionId ?? null,
      // 学生端倒计时**必须**用这个，不是 quizEnd —— 第二窗内 quizEnd
      // 早已过期，Timer 会当场自动交卷（2026-08-24 实测事故）。
      quizEnd: effectiveEndsAt(session),
      // 正式窗的截止时刻，仅供展示/诊断，不要拿去驱动倒计时。
      regularQuizEnd: session.quizEnd,
      secondWindowToday,
      secondWindowEnd: secondWindowToday ? session.makeupEnd : null,
      level,
      paperMode,
      // Authoritative quiz mode for the client. Morning quizzes are always
      // 'test' — the server never returns answer-key data through this
      // endpoint, so a client-side `?mode=practice` URL trick can't unlock
      // it. (Practice review of a *submitted* quiz uses POST /check.)
      mode: 'test' as const,
      paperQuestions: delivered.map((pq) => ({
        id: pq.id,
        sortOrder: pq.sortOrder,
        marks: pq.marks,
        snapshotContent: stripSnapshotContent(pq.snapshotContent),
        snapshotOptions: stripOptions(pq.snapshotOptions),
        questionType: pq.question.questionType,
      })),
      // F1 — keyed by paperQuestionId; empty object if nothing autosaved.
      existingAnswers,
    };
  }

  /**
   * Server-authoritative practice-mode check. Only callable AFTER the
   * student has submitted (or the session window has closed): until then,
   * answers stay locked. Returns whether the guess matches the canonical
   * key, plus the canonical key + explanation if the student got it wrong.
   *
   * For MCQ on a non-passage-pick paper we reverse-map the displayed key
   * (A/B/C/D after relabel) back to the original key before comparing —
   * mirroring saveAnswer.
   */
  async checkAnswer(
    sessionId: string,
    body: { paperQuestionId: string; selectedOption?: string | null; textAnswer?: string | null },
    studentId: string,
  ) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: { paperAssignment: { select: { id: true, paperId: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    const submission = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
      select: { status: true, finalSubmittedAt: true },
    });
    const now = new Date();
    const windowClosed = !isQuizWindowOpen(session, now);
    const submitted =
      submission?.status === 'submitted' || submission?.status === 'graded';
    if (!windowClosed && !submitted) {
      // Block during the live window — preserves test integrity.
      throw new ForbiddenException({ code: 'check_blocked_until_submit' });
    }
    // 2026-08-20 第二作答窗：这是答案的另一个出口（单题「对一下答案」），
    // 必须和 stripUnreleasedScores 用同一道门，否则学生绕开成绩页逐题
    // 点一遍就把答案全拿到了，下午照抄。暂存提交 = 还没最终交卷 = 不给。
    if (
      submission &&
      !answersReleased({
        status: submission.status,
        finalSubmittedAt: submission.finalSubmittedAt,
      })
    ) {
      throw new ForbiddenException({ code: 'answers_pending_final_submit' });
    }

    const pq = await this.prisma.paperQuestion.findFirst({
      where: { id: body.paperQuestionId, paperId: session.paperAssignment.paperId },
      include: { question: { select: { questionType: true } } },
    });
    if (!pq) throw new NotFoundException({ code: 'paper_question_mismatch' });

    const sc = (pq.snapshotContent ?? {}) as Record<string, unknown>;
    const correctKey =
      typeof sc.correctOption === 'string'
        ? (sc.correctOption as string)
        : typeof sc.correctAnswer === 'string'
        ? (sc.correctAnswer as string)
        : null;
    const explanation =
      typeof sc.explanation === 'string' ? (sc.explanation as string) : null;
    const exampleAnswer =
      typeof sc.exampleAnswer === 'string' ? (sc.exampleAnswer as string) : null;

    let studentChoice = body.selectedOption ?? null;
    if (pq.question.questionType === 'mcq' && studentChoice) {
      const paper = await this.prisma.paper.findUnique({
        where: { id: session.paperAssignment.paperId },
        select: { config: true },
      });
      const isPassagePick =
        ((paper?.config as { mode?: string } | null)?.mode ?? null) === 'passage_pick';
      if (!isPassagePick) {
        const map = await this.shuffle.getOrCreate(studentId, session.paperAssignment.paperId);
        const displayedIdx = studentChoice.charCodeAt(0) - 65;
        const originalIdx = this.shuffle.unmapOptionIndex(map, pq.id, displayedIdx);
        if (originalIdx !== null) {
          const opts = (pq.snapshotOptions as Array<{ key: string }> | null) ?? [];
          if (originalIdx < opts.length) {
            studentChoice = opts[originalIdx].key;
          }
        }
      }
    }

    let correct: boolean | null = null;
    if (correctKey) {
      const guess = (studentChoice ?? body.textAnswer ?? '').toString().trim().toLowerCase();
      correct = guess.length > 0 && guess === correctKey.toString().trim().toLowerCase();
    }
    return {
      correct,
      correctKey: correctKey ?? null,
      explanation,
      exampleAnswer,
    };
  }

  /**
   * Save an answer, reverse-mapping any displayed-key for shuffled MCQs back
   * to the original key before delegating to the standard AnswerScript upsert.
   */
  /**
   * 保存一道题的答案（未交卷的草稿）。
   *
   * **写入是条件性的**：只有当请求带的 `clientSeq` 比库里那行更大时才落库。
   * 在这之前它是无条件 upsert，于是乱序到达的旧请求会盖掉新答案 ——
   * P8.5 实测「旧 → 新 → 延迟到达的旧」，库里留下的是旧答案。重试、
   * 弱网、双击、debounce 撞车都会走到这一步。
   *
   * 被拒的写不是错误：返回 `{ applied: false, superseded: true }`，
   * 前端据此既不报「保存失败」，也不把它当成「我这次写生效了」。
   */
  async saveAnswer(
    sessionId: string,
    body: {
      paperQuestionId: string;
      selectedOption?: string | null;
      textAnswer?: string | null;
      clientSeq?: number;
    },
    studentId: string,
  ) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: { paperAssignment: { select: { id: true, paperId: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    const now = new Date();
    if (!isQuizWindowOpen(session, now)) {
      throw new BadRequestException({ code: 'quiz_window_closed' });
    }

    const submission = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
    });
    if (!submission) throw new NotFoundException({ code: 'no_submission' });
    if (submission.status !== 'in_progress') {
      throw new BadRequestException({ code: 'submission_locked', status: submission.status });
    }

    const pq = await this.prisma.paperQuestion.findFirst({
      where: { id: body.paperQuestionId, paperId: session.paperAssignment.paperId },
      include: { question: { select: { questionType: true } } },
    });
    if (!pq) throw new NotFoundException({ code: 'paper_question_mismatch' });

    let selectedOption = body.selectedOption ?? null;
    if (pq.question.questionType === 'mcq' && selectedOption) {
      const paper = await this.prisma.paper.findUnique({
        where: { id: session.paperAssignment.paperId },
        select: { config: true },
      });
      const isPassagePick =
        ((paper?.config as { mode?: string } | null)?.mode ?? null) === 'passage_pick';
      // Passage-pick papers display option keys verbatim (matching_features
      // letters carry semantic meaning), so no reverse-map is needed.
      if (!isPassagePick) {
        const map = await this.shuffle.getOrCreate(studentId, session.paperAssignment.paperId);
        const displayedIdx = selectedOption.charCodeAt(0) - 65;
        const originalIdx = this.shuffle.unmapOptionIndex(map, pq.id, displayedIdx);
        if (originalIdx === null) {
          // No shuffle for this question — store as-is. (Unusual edge case.)
        } else {
          const opts = (pq.snapshotOptions as Array<{ key: string }> | null) ?? [];
          if (originalIdx < opts.length) {
            selectedOption = opts[originalIdx].key;
          }
        }
      }
    }

    const seq = body.clientSeq;
    const answerData = {
      selectedOption,
      textAnswer: body.textAnswer ?? null,
      clientSeq: seq ?? null,
        // 答案一改，这一题此前的判分就作废 —— 第二作答窗（2026-08-20）
        // 让学生下午能回来改早上写的答案，如果老师上午已经判过、或者
        // 09:00 的自动判分已经写过分，不清掉的话评语和分数会留在一份
        // 已经不存在的答案上：学生看到「你写的 X」配着针对旧答案 Y 的
        // 评语。清空后 finalSubmit / 17:30 收尾会整题重判。
      // 答案一改，这一题此前的判分就作废 —— 第二作答窗（2026-08-20）
      // 让学生下午能回来改早上写的答案，如果老师上午已经判过、或者
      // 09:00 的自动判分已经写过分，不清掉的话评语和分数会留在一份
      // 已经不存在的答案上：学生看到「你写的 X」配着针对旧答案 Y 的
      // 评语。清空后 finalSubmit / 17:30 收尾会整题重判。
      awardedMarks: null,
      autoCorrect: null,
      markerComment: null,
      markedById: null,
      markedAt: null,
    };

    if (seq == null) {
      // 不带序号的调用（老客户端、内部调用）—— 保持原来的无条件写入，
      // 不因为一次升级把还没刷新页面的学生挡在外面。
      const row = await this.prisma.answerScript.upsert({
        where: {
          submissionId_paperQuestionId: { submissionId: submission.id, paperQuestionId: pq.id },
        },
        create: { submissionId: submission.id, paperQuestionId: pq.id, ...answerData },
        update: answerData,
      });
      return { applied: true, clientSeq: row.clientSeq, updatedAt: row.updatedAt };
    }

    // 条件写：库里没有序号（历史行 / 老客户端写的）也放行，否则只接受更大的。
    const updated = await this.prisma.answerScript.updateMany({
      where: {
        submissionId: submission.id,
        paperQuestionId: pq.id,
        ...seqWhereClause(seq),
      },
      data: answerData,
    });

    if (updated.count === 0) {
      // 要么这题还没有行（下面补建），要么来的是**过期请求**。
      const existing = await this.prisma.answerScript.findUnique({
        where: {
          submissionId_paperQuestionId: { submissionId: submission.id, paperQuestionId: pq.id },
        },
        select: { clientSeq: true, updatedAt: true },
      });
      if (existing) {
        return {
          applied: false,
          superseded: true,
          clientSeq: existing.clientSeq,
          updatedAt: existing.updatedAt,
        };
      }
      try {
        const row = await this.prisma.answerScript.create({
          data: { submissionId: submission.id, paperQuestionId: pq.id, ...answerData },
        });
        return { applied: true, clientSeq: row.clientSeq, updatedAt: row.updatedAt };
      } catch {
        // 并发下另一个请求刚建好这一行 —— 用同样的条件再写一次，
        // 谁的序号大谁赢。两个请求都不会凭空创建第二行（唯一约束）。
        const retry = await this.prisma.answerScript.updateMany({
          where: {
            submissionId: submission.id,
            paperQuestionId: pq.id,
            ...seqWhereClause(seq),
          },
          data: answerData,
        });
        const now = await this.prisma.answerScript.findUnique({
          where: {
            submissionId_paperQuestionId: { submissionId: submission.id, paperQuestionId: pq.id },
          },
          select: { clientSeq: true, updatedAt: true },
        });
        return {
          applied: retry.count > 0,
          superseded: retry.count === 0,
          clientSeq: now?.clientSeq ?? null,
          updatedAt: now?.updatedAt ?? null,
        };
      }
    }
    return { applied: true, clientSeq: seq };
  }

  /** R10 — was an upsert that REPLACED the class's single bound level
   *  (back when ClassEnglishLevel.classId was unique). With multi-level,
   *  this is now an "add this band" call. Idempotent: re-adding an
   *  already-registered band is a no-op. Use removeClassEnglishLevel to
   *  drop a band. */
  async setClassEnglishLevel(classId: string, level: EnglishLevel, actor: ActorCtx) {
    if (!['admin', 'head_teacher'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const upserted = await this.prisma.classEnglishLevel.upsert({
      where: { classId_level: { classId, level } },
      create: { classId, level, effectiveFrom: new Date() },
      update: { effectiveFrom: new Date() },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.class_level.add',
      entityType: 'ClassEnglishLevel',
      entityId: upserted.id,
      ip: actor.ip,
      metadata: { classId, level },
    });
    return upserted;
  }

  /** R10 multi-level — drop one band from a class. The class's existing
   *  sessions for that band are left in place (so historical data
   *  survives), but no new sessions will be generated for it. */
  async removeClassEnglishLevel(classId: string, level: EnglishLevel, actor: ActorCtx) {
    if (!['admin', 'head_teacher'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const r = await this.prisma.classEnglishLevel.deleteMany({
      where: { classId, level },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.class_level.remove',
      entityType: 'ClassEnglishLevel',
      entityId: `${classId}:${level}`,
      ip: actor.ip,
      metadata: { classId, level, removed: r.count },
    });
    return { classId, level, removed: r.count };
  }

  /**
   * DEBUG ONLY — gated behind MORNING_QUIZ_DEBUG=true. Fast-forwards a
   * session into "currently active" state by overwriting time windows to
   * NOW + standard offsets and flipping status to active. Used for off-hours
   * end-to-end smoke testing of the scan flow. Audit-logged.
   */
  /**
   * Inverse of debugActivateNow — restore a session that was force-activated
   * by debugActivateNow (for a dry-run) back to its canonical pre-dry-run
   * state: recompute attendanceStart / attendanceEnd / lateCutoff / quizStart
   * / quizEnd from session.date using the standard 08:30 / 08:40 / 08:59:59
   * / 09:00 SGT constants, and flip status back to `scheduled`. Does NOT
   * touch Attendance / StudentSubmission / AnswerScript rows — those are
   * handled by clearStudentTestData. Audit-logged.
   *
   * Gated the same way as debugActivateNow: MORNING_QUIZ_DEBUG=true AND
   * admin role. The controller does the env-flag check; this service
   * method only does the canActOnClass test.
   */
  /**
   * 打开补考窗口（学校 2026-08 新政：早上无故缺席 → 中午补考）。
   *
   * **不动正式窗口**。2026-08-13 第一次补考是拿 debug-activate 开的，
   * 那个调试端点会把 attendanceStart/lateCutoff/quizEnd 整体挪到当前
   * 时刻，于是当天 08:30/08:40/09:00 被改写成 13:21/13:42/13:52，
   * 早上的真实时间没了，它还顺手删掉了 9 点已生成的缺席行 ——
   * 三名补考学生最终被记成「准时出勤」。
   *
   * 这里只写 makeupStart/makeupEnd，并把状态放回 active 让学生能扫码。
   * 补考扫码在 attendance.service 里落成 absent + makeupAt。
   */
  async openMakeupWindow(
    sessionId: string,
    actor: ActorCtx,
    opts: { minutes: number },
  ) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (!(await canActOnClass(this.prisma, actor, session.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    if (session.status === MorningQuizStatus.cancelled) {
      throw new BadRequestException({ code: 'session_cancelled' });
    }
    const minutes = Math.min(Math.max(Math.round(opts.minutes), 5), 120);
    const now = new Date();
    if (now <= session.quizEnd) {
      // 正式场还没结束就开补考没有意义，而且会让「补考」这个统计口径
      // 失真（人还在正常考试窗口里）。
      throw new BadRequestException({
        code: 'regular_window_still_open',
        quizEnd: session.quizEnd,
      });
    }
    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        makeupStart: now,
        makeupEnd: new Date(now.getTime() + minutes * 60_000),
        makeupOpenedById: actor.id,
        status: MorningQuizStatus.active,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.makeup_window_open',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: {
        before: { status: session.status },
        after: { makeupStart: after.makeupStart, makeupEnd: after.makeupEnd, minutes },
      },
    });
    return after;
  }

  /** 手动关闭补考窗口（不等它自然到期）。下一轮 lock cron 收尾。 */
  async closeMakeupWindow(sessionId: string, actor: ActorCtx) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (!(await canActOnClass(this.prisma, actor, session.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      // makeupStart 留着 —— 它是「今天开过补考」的凭据，报表要用。
      data: { makeupEnd: new Date() },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.makeup_window_close',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: { before: { makeupEnd: session.makeupEnd }, after: { makeupEnd: after.makeupEnd } },
    });
    return after;
  }

  async revertSessionToScheduled(sessionId: string, actor: ActorCtx) {
    const before = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
    if (!before) throw new NotFoundException({ code: 'session_not_found' });
    if (!(await canActOnClass(this.prisma, actor, before.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const dateIso = before.date.toISOString().slice(0, 10);
    // 全天开放（4.0 阶段 B）默认**关**，此时取的就是原来的 08:30 / 09:00，
    // 行为一字不差。打开后窗口变成 00:00–23:59。见 lesson/all-day.ts。
    const win = windowTimesFor(before.classId);
    const attendanceStart = combineLocal(dateIso, win.attendanceStartLocal, tzOff);
    // 出勤已于 2026-08-24 停用，attendanceEnd / lateCutoff 只为满足下面的
    // 严格递增不变量而存在。全天模式下把它们贴着开窗时刻放。
    const attendanceEnd = win.allDay
      ? new Date(attendanceStart.getTime() + 60_000)
      : combineLocal(dateIso, ATTENDANCE_END_LOCAL, tzOff);
    const lateCutoff = win.allDay
      ? new Date(attendanceStart.getTime() + 120_000)
      : combineLocal(dateIso, LATE_CUTOFF_LOCAL, tzOff);
    const quizEnd = combineLocal(dateIso, win.quizEndLocal, tzOff);
    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        attendanceStart,
        attendanceEnd,
        lateCutoff,
        quizStart: attendanceStart,
        quizEnd,
        status: MorningQuizStatus.scheduled,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.revert_to_scheduled',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: {
        before: { status: before.status, attendanceStart: before.attendanceStart },
        after: { status: after.status, attendanceStart: after.attendanceStart },
      },
    });
    return after;
  }

  async debugActivateNow(
    sessionId: string,
    actor: ActorCtx,
    opts?: { at?: Date },
  ) {
    const before = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
    if (!before) throw new NotFoundException({ code: 'session_not_found' });
    const now = new Date();
    // Anchor the window around `opts.at` if supplied (admin wants a
    // future-time cron dry-run), else around NOW (the original
    // "make-it-active-immediately" behaviour). Same offsets either way:
    //   attendanceStart = anchor - 30s
    //   attendanceEnd   = anchor + 2m
    //   lateCutoff      = anchor + 20m
    //   quizEnd         = anchor + 30m
    // If anchor is in the future, leave status as `scheduled` so the
    // EVERY_MINUTE activate cron flips it at T-30s — that exercises the
    // production cron path instead of bypassing it. If anchor is now/past,
    // force `active` immediately (matches the original no-arg semantics so
    // existing callers keep working).
    const anchor = opts?.at ?? now;
    const isFuture = anchor.getTime() > now.getTime() + 5_000;
    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        attendanceStart: new Date(anchor.getTime() - 30_000),
        attendanceEnd: new Date(anchor.getTime() + 2 * 60_000),
        lateCutoff: new Date(anchor.getTime() + 20 * 60_000),
        quizStart: new Date(anchor.getTime() - 30_000),
        quizEnd: new Date(anchor.getTime() + 30 * 60_000),
        status: isFuture
          ? MorningQuizStatus.scheduled
          : MorningQuizStatus.active,
      },
    });
    // Clear any absent attendance rows the cron may have inserted before
    // we re-activated. Without this, a pre-existing absent row poisons
    // the upsert in scanQr (which doesn't update status on the update
    // branch), so the test student stays "absent" even after a clean scan.
    await this.prisma.attendance.deleteMany({
      where: { sessionId, status: AttendanceStatus.absent, scanTime: null },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.debug_activate',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: {
        before: { status: before.status, attendanceStart: before.attendanceStart },
        after: { status: after.status, attendanceStart: after.attendanceStart },
      },
    });
    return after;
  }

  /**
   * Admin-only — wipe one student's data on one session. Used to clean up
   * after dry-runs (teacher tested scan flow with student X; now wants X's
   * attendance + submission + answer scripts gone so the morning's real
   * dashboard isn't polluted). Idempotent — if there's nothing to delete
   * the call still succeeds and returns zero counts.
   *
   * Deletes:
   *   - Attendance(sessionId, studentId)                (1 row or 0)
   *   - StudentSubmission(assignmentId, studentId)      (1 row or 0)
   *   - AnswerScript(submission)                        (cascade from above)
   *
   * Does NOT delete the Paper/PaperAssignment/MorningQuizSession themselves
   * — those belong to the whole class and must stay intact for other
   * students. Compare with force-regenerate (batchGenerateForWeek with
   * force=true) which wipes the entire session and recreates it; use that
   * instead when you want to throw away ALL student data on a session.
   */
  async clearStudentTestData(
    sessionId: string,
    studentId: string,
    actor: ActorCtx,
  ): Promise<{ attendanceDeleted: number; submissionDeleted: number; scriptDeleted: number }> {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { paperAssignmentId: true },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });

    // Count scripts BEFORE deleting the submission so the audit log carries
    // an accurate number — once StudentSubmission is gone the cascade has
    // already taken AnswerScript with it.
    const scriptCount = await this.prisma.answerScript.count({
      where: {
        submission: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // Submission first (AnswerScript cascades), then attendance. Order
      // doesn't really matter since both have unique constraints; doing
      // submission first keeps the script delete inside the same tx.
      const subDel = await tx.studentSubmission.deleteMany({
        where: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
      });
      const attDel = await tx.attendance.deleteMany({
        where: { sessionId, studentId },
      });
      return { submissionDeleted: subDel.count, attendanceDeleted: attDel.count };
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.clear_student_test_data',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      metadata: {
        sessionId,
        studentId,
        attendanceDeleted: result.attendanceDeleted,
        submissionDeleted: result.submissionDeleted,
        scriptDeleted: scriptCount,
      },
    });

    return {
      attendanceDeleted: result.attendanceDeleted,
      submissionDeleted: result.submissionDeleted,
      scriptDeleted: scriptCount,
    };
  }

  /**
   * Re-run autoGradeScripts on every submitted submission in a session.
   * Used to recover scoring on already-locked submissions when:
   *   - The auto-grader code has changed since last grading
   *   - The ANTHROPIC_API_KEY was missing at lock time but is now set
   *   - A bug in autoGradeScripts caused scripts to be skipped (e.g. the
   *     pre-fix length>80 path that left long-mark-scheme answers
   *     un-graded, awarded marks = null)
   *
   * Re-grades in a single transaction, updates submission.autoScore +
   * each answerScript.{autoCorrect, awardedMarks, markerComment}.
   * Does NOT touch manualScore (teacher overrides preserved) or
   * submission.status (still 'submitted' / 'locked' / etc.). Audit-logged
   * with per-submission delta counts.
   */
  /**
   * Bug 2 — preview what batchGenerateForWeek({force:true}) would
   * destroy. Returns counts of sessions / attendances / submissions /
   * answer scripts in the (weekStart..+5d) window for the given classes
   * (defaults to all classes with at least one ClassEnglishLevel).
   *
   * The UI calls this BEFORE confirm() so the operator sees concrete
   * numbers ("会删除 19 份提交、247 条答题") rather than an abstract
   * warning. Read-only — no audit log, no DB mutation.
   */
  async previewRegenerateImpact(
    input: { weekStart: string; classIds?: string[] },
  ): Promise<{
    sessions: number;
    submissions: number;
    attendances: number;
    answerScripts: number;
  }> {
    const monday = new Date(input.weekStart);
    if (Number.isNaN(monday.getTime())) {
      throw new BadRequestException({ code: 'bad_week_start' });
    }
    // Bug 6 fix — use a half-open [Mon, next-Mon) range filter rather than
    // a `date: { in: dates }` list of UTC midnights. `MorningQuizSession.date`
    // is written from `attendanceStart` (a real instant like 00:30 UTC for
    // SGT 08:30), not the UTC-midnight date, so `in` matched zero rows and
    // the preview always reported 0. A range filter catches every session
    // whose `date` instant lies inside the target week regardless of how
    // the time-of-day component was set. The range MUST match exactly what
    // the force-wipe block below uses so the preview count == wipe count.
    const rangeStart = monday;                                       // inclusive
    const rangeEnd = new Date(monday.getTime() + 7 * 86_400_000);    // exclusive
    let classIds = input.classIds ?? [];
    if (classIds.length === 0) {
      const rows = await this.prisma.classEnglishLevel.findMany({
        distinct: ['classId'], select: { classId: true },
      });
      classIds = rows.map((r) => r.classId);
    }
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { classId: { in: classIds }, date: { gte: rangeStart, lt: rangeEnd } },
      select: { id: true, paperAssignment: { select: { paperId: true } } },
    });
    if (sessions.length === 0) {
      return { sessions: 0, submissions: 0, attendances: 0, answerScripts: 0 };
    }
    const sessionIds = sessions.map((s) => s.id);
    const paperIds = sessions
      .map((s) => s.paperAssignment?.paperId)
      .filter((p): p is string => !!p);
    const [attendances, submissions, answerScripts] = await Promise.all([
      this.prisma.attendance.count({ where: { sessionId: { in: sessionIds } } }),
      this.prisma.studentSubmission.count({
        where: { assignment: { paperId: { in: paperIds } } },
      }),
      this.prisma.answerScript.count({
        where: { submission: { assignment: { paperId: { in: paperIds } } } },
      }),
    ]);
    return {
      sessions: sessions.length,
      submissions,
      attendances,
      answerScripts,
    };
  }

  async regradeSession(
    sessionId: string,
    actor: ActorCtx,
  ): Promise<{
    sessionId: string;
    submissionsRegraded: number;
    scriptsUpdated: number;
    autoScoreDelta: number;
    errors: Array<{ submissionId: string; error: string }>;
  }> {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true, paperAssignmentId: true },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (!(await canActOnClass(this.prisma, actor, session.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }

    // Critical: DO NOT wrap the AI calls in a single big $transaction. Each
    // Claude API call is 2–3s; 19 submissions × ~10 short-answer items =
    // ~500 seconds of AI calls. The default Prisma transaction timeout is
    // ~5 s, so the whole regrade returned "Transaction timed out / already
    // closed" the moment AI grading exceeded it. Fix: load the submissions
    // upfront (no tx needed for reads), call autoGradeScripts per submission
    // OUTSIDE any tx, then commit each submission's writes in a small
    // dedicated tx. Failures on one submission don't roll back others.
    const submissions = await this.prisma.studentSubmission.findMany({
      where: {
        assignmentId: session.paperAssignmentId,
        // Only submissions that actually carry student work; in_progress
        // is left to the cron's lockOne so we don't race the lock flow.
        status: { in: ['submitted', 'locked'] },
      },
      include: {
        scripts: {
          include: {
            paperQuestion: {
              include: {
                question: {
                  select: { questionType: true, options: true, answerContent: true, content: true },
                },
              },
            },
          },
        },
      },
    });

    let submissionsRegraded = 0;
    let scriptsUpdated = 0;
    let autoScoreDelta = 0;
    const errors: Array<{ submissionId: string; error: string }> = [];

    for (const sub of submissions) {
      try {
        // AI calls happen here, outside any tx. Slow but doesn't hold a
        // db transaction open. 2.0 起同样受 MORNING_QUIZ_AI_GRADING 开关约束。
        const rawGrade = await this.gradeScripts(sub.scripts);
        // R15-followup-21 — retraction sweep so a manual admin regrade
        // can't quietly drop a retracted question's awardAllStudents
        // credit back to 0.
        const { autoScore, scriptUpdates } = await applyRetractionCredits(
          this.prisma,
          sub.scripts as any,
          rawGrade,
        );
        const before = sub.autoScore ?? 0;

        // Tiny atomic write per submission. If one fails (e.g. another
        // tx is updating the same script row), we log + move on instead
        // of nuking everyone else's regrade.
        await this.prisma.$transaction(async (tx) => {
          // R15-followup-14 — was only writing `autoScore`. The student /
          // parent dashboards display `totalScore` (= autoScore + manualScore)
          // which is cached on the submission row. Without recomputing it,
          // a successful regrade would update individual script awardedMarks
          // BUT the student would still see the old totalScore — exactly the
          // confusing "I picked the right answer and the system still says 0"
          // pattern teachers reported after the 5/14 IELTS bulk regrade.
          // Mirror the convention from resolveAppeal: totalScore = autoScore
          // + manualScore (0 when unset).
          const manualScore = sub.manualScore ?? 0;
          const totalScore = autoScore + manualScore;
          await tx.studentSubmission.update({
            where: { id: sub.id },
            data: { autoScore, totalScore },
          });
          for (const u of scriptUpdates) {
            await tx.answerScript.update({
              where: { id: u.id },
              data: {
                autoCorrect: u.autoCorrect,
                awardedMarks: u.awardedMarks,
                ...(u.aiReason ? { markerComment: `[ai-grade] ${u.aiReason}` } : {}),
              },
            });
          }
        });
        scriptsUpdated += scriptUpdates.length;
        autoScoreDelta += autoScore - before;
        submissionsRegraded++;
      } catch (e: any) {
        this.logger.error(`regrade submission ${sub.id} failed: ${e?.message ?? e}`);
        errors.push({ submissionId: sub.id, error: String(e?.message ?? e).slice(0, 200) });
      }
    }

    const result = { submissionsRegraded, scriptsUpdated, autoScoreDelta, errors };

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.regrade_session',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      metadata: {
        sessionId,
        submissionsRegraded: result.submissionsRegraded,
        scriptsUpdated: result.scriptsUpdated,
        autoScoreDelta: result.autoScoreDelta,
      },
    });

    return { sessionId, ...result };
  }

  /**
   * Admin-only — wipe ALL Papers whose questions were generated from a
   * retired provenance bank (currently: cambridge_0510, which we
   * switched away from in commit be96aa6 when the OLEVEL bank moved to
   * Singapore-Cambridge 1128 / 1184).
   *
   * Why this exists — even after `cambridge_0510` Questions were marked
   * status='retired' (so the picker stops choosing them), Papers /
   * MorningQuizSessions / Attendances / Submissions / AnswerScripts
   * generated BEFORE that switch still exist and pollute student-facing
   * views. e.g. 牟歌's portal shows a 5/18 attendance row that's
   * actually a 5/11 test-activate scan on a retired 0510 paper.
   *
   * Strategy — find Papers where ANY PaperQuestion → Question carries
   * the cambridge_0510 provenance tag, then `paper.deleteMany`. FK
   * cascade pulls down PaperQuestion + PaperAssignment +
   * MorningQuizSession + StudentSubmission + Attendance + AnswerScript
   * (see schema.prisma — every dependent FK on this tree is
   * onDelete: Cascade).
   *
   * Audit-logged with count of papers deleted.
   */
  async cleanupRetiredContent(actor: ActorCtx): Promise<{
    papersDeleted: number;
    provenanceTagsCovered: string[];
  }> {
    if (actor.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const RETIRED_TAGS = ['cambridge_0510'];
    const oldPapers = await this.prisma.paper.findMany({
      where: {
        questions: {
          some: { question: { provenanceTag: { in: RETIRED_TAGS } } },
        },
      },
      select: { id: true, name: true },
    });
    const ids = oldPapers.map((p) => p.id);
    let deleted = 0;
    if (ids.length > 0) {
      // Best-effort delete; if some FK is unexpectedly Restrict we log
      // and continue to the next one rather than failing the whole batch.
      for (const id of ids) {
        try {
          await this.prisma.paper.delete({ where: { id } });
          deleted++;
        } catch (e: any) {
          this.logger.warn(`could not delete retired paper ${id}: ${e?.message ?? e}`);
        }
      }
    }
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.cleanup_retired_content',
      entityType: 'Paper',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        provenanceTags: RETIRED_TAGS,
        candidates: ids.length,
        deleted,
      },
    });
    return { papersDeleted: deleted, provenanceTagsCovered: RETIRED_TAGS };
  }

  /**
   * Admin-only — delete every MorningQuizSession (and its Paper, via FK
   * cascade) scheduled for a weekday the school doesn't run morning
   * quiz on. Currently: Mondays (assembly day) and weekends (Sat/Sun).
   *
   * Why this exists — the old batchGenerateForWeek emitted Mon-Fri
   * (5 days), so up to today we've been creating Monday sessions that
   * never get used in practice and just pollute student portals as
   * "absent" rows. After updating the generator to skip Mondays
   * (this same commit), we still need to clean up historical Monday
   * sessions sitting in the DB.
   *
   * Strategy — iterate all MorningQuizSession rows, filter to weekdays
   * in SKIP set, delete their backing Paper. FK cascade handles the
   * rest. We don't try to be clever with a SQL WHERE on weekday because
   * neither Postgres nor Prisma exposes "DATE_PART('dow', date)" through
   * Prisma's typed query API without raw SQL — JS filter is simple and
   * the table is small.
   */
  async cleanupNonSchoolDaySessions(actor: ActorCtx): Promise<{
    sessionsConsidered: number;
    papersDeleted: number;
    skipDays: string[];
  }> {
    if (actor.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const SKIP_WEEKDAYS = new Set([0, 1, 6]); // 0=Sun, 1=Mon, 6=Sat
    const all = await this.prisma.morningQuizSession.findMany({
      select: { id: true, date: true, paperAssignmentId: true },
    });
    const offending = all.filter((s) => SKIP_WEEKDAYS.has(new Date(s.date).getUTCDay()));
    const assignmentIds = offending.map((s) => s.paperAssignmentId);
    const assignments = assignmentIds.length > 0
      ? await this.prisma.paperAssignment.findMany({
          where: { id: { in: assignmentIds } },
          select: { paperId: true },
        })
      : [];
    const paperIds = Array.from(new Set(assignments.map((a) => a.paperId)));
    let papersDeleted = 0;
    for (const id of paperIds) {
      try {
        await this.prisma.paper.delete({ where: { id } });
        papersDeleted++;
      } catch (e: any) {
        this.logger.warn(`could not delete non-school-day paper ${id}: ${e?.message ?? e}`);
      }
    }
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.cleanup_non_school_days',
      entityType: 'Paper',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        skipWeekdays: ['Sun', 'Mon', 'Sat'],
        sessionsConsidered: offending.length,
        papersDeleted,
      },
    });
    return {
      sessionsConsidered: offending.length,
      papersDeleted,
      skipDays: ['Sun', 'Mon', 'Sat'],
    };
  }

  /** Find the StudentSubmission tied to (session, student) — used by the
   *  controller's submit endpoint to delegate to the canonical
   *  student.service.finalSubmit. */
  async findSubmissionForSession(sessionId: string, studentId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { paperAssignmentId: true },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    return this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
    });
  }

  /**
   * Aggregated dashboard for one (classId, date): merges the 1–N sessions
   * (one per registered EnglishLevel) into a single roster + counts view.
   *
   * Why this exists — each student picks exactly ONE level on the
   * /scan/<token> page, so a student appears in at most one of the (date,
   * class) sessions. The per-session dashboard splits the roster across
   * level pages, which makes the teacher hop between 1–3 dashboards just
   * to see "who scanned today". This merges them: each row carries its
   * source sessionId + level so the per-student 「清除测试数据」 button still
   * targets the right session, but the teacher sees one unified table.
   */
  async getClassDayDashboard(
    classId: string,
    dateIso: string,
    actor: ActorCtx,
  ) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    // Date column in MorningQuizSession is @db.Date — Prisma represents it
    // as a Date at the start of that UTC day. Build the [day, nextDay)
    // range so the filter matches regardless of how the caller phrased
    // the date string.
    const day = new Date(`${dateIso}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime())) {
      throw new BadRequestException({ code: 'bad_date', hint: 'expect YYYY-MM-DD' });
    }
    const nextDay = new Date(day.getTime() + 86_400_000);

    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { classId, date: { gte: day, lt: nextDay } },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { include: { paper: { select: { id: true, name: true, totalMarksActual: true } } } },
        attendances: {
          include: {
            student: { select: { id: true, name: true } },
            submission: { select: { id: true, autoScore: true, totalScore: true, submittedAt: true } },
          },
        },
      },
      orderBy: { level: 'asc' },
    });
    if (sessions.length === 0) {
      throw new NotFoundException({ code: 'no_sessions_for_class_day' });
    }

    // Merge attendance rows from all N sessions, tagging each with its
    // source sessionId + level so the row-level 🗑️ clear button still
    // targets the correct session.
    //
    // Then DEDUPE by studentId — the cron's lockOne creates an `absent`
    // row for every enrolled student on every session, so a student
    // enrolled in 3 levels who scans only one will produce 3 attendance
    // rows (1 real + 2 spurious absent). Naïve concatenation gave the UI
    // 3 rows per student and a 3× inflated absent count. Keep only the
    // highest-priority row per student: on_time > late > absent. The
    // kept row's level/sessionId reflects where the student ACTUALLY
    // scanned (or arbitrary level if they truly didn't show on any).
    const raw: Array<any> = [];
    for (const s of sessions) {
      for (const a of s.attendances) {
        raw.push({
          ...a,
          sessionId: s.id,
          level: s.level,
        });
      }
    }
    const PRIORITY: Record<string, number> = { on_time: 3, late: 2, absent: 1 };
    const byStudent = new Map<string, (typeof raw)[number]>();
    for (const a of raw) {
      const sid = a.studentId;
      const existing = byStudent.get(sid);
      if (!existing) {
        byStudent.set(sid, a);
        continue;
      }
      const newP = PRIORITY[a.status] ?? 0;
      const oldP = PRIORITY[existing.status] ?? 0;
      // If equal priority (e.g. two absent rows for the same student),
      // prefer the row that has a submission attached — keeps any quiz
      // data visible even if status ended up tied. 补考行（absent +
      // makeupAt）也要赢过同级别的空缺席行，否则「已补考」的标记会在
      // 多级别班级里被另一条纯缺席行盖掉。
      const tieBreak =
        newP === oldP &&
        ((a.submission && !existing.submission) || (a.makeupAt && !existing.makeupAt));
      if (newP > oldP || tieBreak) {
        byStudent.set(sid, a);
      }
    }
    const attendances = Array.from(byStudent.values()).sort((a, b) => {
      const an = a.student?.name ?? '';
      const bn = b.student?.name ?? '';
      return an.localeCompare(bn, 'zh-CN');
    });
    // Recompute counts on the deduped set — one tally per student, not
    // per attendance row.
    const counts = { on_time: 0, late: 0, absent: 0, makeup: 0 };
    for (const a of attendances) {
      counts[a.status]++;
      // 补考不是第四种出勤状态 —— 它是 absent 的一个子集（早上没来、
      // 中午补了）。单独计数是给老师看「今天有几个人补了」，同步
      // Seiue 时仍按 absent 报。
      if (a.makeupAt) counts.makeup++;
    }

    return {
      classId,
      date: dateIso,
      className: sessions[0].class.name,
      // 出勤停用时面板要换一套口径，否则「缺勤 0」会被读成全勤
      attendanceTracking: process.env.MORNING_QUIZ_ATTENDANCE_TRACKING === 'on',
      sessions: sessions.map((s) => ({
        id: s.id,
        level: s.level,
        status: s.status,
        paper: s.paperAssignment.paper,
        makeupStart: s.makeupStart,
        makeupEnd: s.makeupEnd,
        /** 此刻补考窗口是否开着 —— 面板据此显示「补考进行中」 */
        makeupOpen: isMakeupWindowOpen(s),
      })),
      counts,
      attendances,
    };
  }

  async getDashboard(sessionId: string, actor: ActorCtx) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { include: { paper: { select: { id: true, name: true, totalMarksActual: true } } } },
        attendances: {
          include: {
            student: { select: { id: true, name: true } },
            submission: { select: { id: true, autoScore: true, totalScore: true, submittedAt: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });

    // Round 2 IDOR fix — admin/head_teacher pass through; a regular
    // teacher must teach this session's class. Otherwise an English
    // teacher could pull the dashboard for the maths class by guessing
    // sessionIds.
    if (!(await canActOnClass(this.prisma, actor, session.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }

    const counts = { on_time: 0, late: 0, absent: 0 };
    for (const a of session.attendances) counts[a.status]++;

    return {
      session: {
        id: session.id,
        date: session.date,
        status: session.status,
        class: session.class,
        paper: session.paperAssignment.paper,
      },
      counts,
      // 2026-08-20 起早测默认不记出勤：不再插缺席行、迟到也统一记
      // on_time。面板必须知道这件事，否则「缺勤 0」会被老师读成「全勤」，
      // 而真相是「这个数字已经不再统计了」。
      attendanceTracking: process.env.MORNING_QUIZ_ATTENDANCE_TRACKING === 'on',
      attendances: session.attendances,
    };
  }

  /**
   * F3 — student post-submit result page payload.
   *
   * Strict invariant: only callable by the student who owns the
   * submission AND only after submission.status === 'submitted' (or
   * the quiz window has closed). Until then, returns ForbiddenException
   * with code='result_locked_until_submit' so a curl poll can't pre-leak
   * the answer key.
   *
   * Per-question content goes through the same redactSnapshotForStudent
   * whitelist as the take-paper view, then we explicitly add ONLY the
   * fields appropriate for the post-submit screen:
   *   - correctAnswer (the canonical key)
   *   - explanation   (one-sentence rationale, if the source question
   *                    carried one — never markScheme verbatim)
   *   - studentAnswer (this student's submitted choice/text)
   *   - awardedMarks  (auto-graded for MCQ; null for un-marked structured)
   *
   * We deliberately do NOT include fields like `markScheme`,
   * `exampleAnswer`, or any per-paperQuestion override that could leak
   * teacher-internal data. Other students' answers are NEVER included
   * (the query is scoped to this submission only).
   */
  async getStudentResult(sessionId: string, studentId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: {
        paperAssignment: {
          select: { id: true, paperId: true, paper: { select: { name: true } } },
        },
      },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });

    const submission = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId: session.paperAssignmentId,
        studentId,
        status: { not: 'practice' },
      },
      select: {
        id: true,
        status: true,
        autoScore: true,
        manualScore: true,
        totalScore: true,
        maxScore: true,
        submittedAt: true,
        finalSubmittedAt: true,
        scripts: {
          select: {
            paperQuestionId: true,
            selectedOption: true,
            textAnswer: true,
            awardedMarks: true,
            autoCorrect: true,
            // S12H —— 判分出身。逐题状态靠它区分「服务端判的」与「老师判的」，
            // 全仓库只有 marker.service 写这个字段。
            markedById: true,
            // R10 follow-up — surface the AI grader's rationale to students
            // so when the AI credits a paraphrase or denies a sounds-right
            // wrong answer they can see why. finalSubmit writes
            // `[ai-grade] <reason>` to markerComment when Claude
            // intervened; this select pulls it through to the result page.
            markerComment: true,
          },
        },
      },
    });
    if (!submission) throw new NotFoundException({ code: 'no_submission' });
    const now = new Date();
    const windowClosed = !isQuizWindowOpen(session, now);
    const submitted =
      submission.status === 'submitted' || submission.status === 'graded' ||
      submission.status === 'returned' || submission.status === 'marked';
    if (!submitted && !windowClosed) {
      throw new ForbiddenException({ code: 'result_locked_until_submit' });
    }

    // Pull paper questions in display order so the result page lines up
    // with the take-paper experience.
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: session.paperAssignment.paperId },
      orderBy: { sortOrder: 'asc' },
      include: {
        // R10: also pull answerContent so the result page can display the
        // canonical short_answer text answer ("ii", "pendulum clock") even
        // when snapshotContent / snapshotOptions don't carry it. This is
        // server-side only; the take-paper getStudentView still strips it.
        question: { select: { questionType: true, answerContent: true } },
      },
    });

    const scriptByPq = new Map(
      submission.scripts.map((s) => [s.paperQuestionId, s]),
    );

    const items = paperQuestions.map((pq) => {
      const sc = (pq.snapshotContent ?? {}) as Record<string, unknown>;
      // R10-fix: snapshotContent often omits correctOption / correctAnswer
      // (IELTS passage-pick papers store the answer key on snapshotOptions
      // as `{key, correct: true}`, leaving snapshotContent with only stem +
      // passage). Fall back to the snapshotOptions array so the result page
      // can show the correct letter.
      let correctKey: string | null =
        typeof sc.correctOption === 'string'
          ? (sc.correctOption as string)
          : typeof sc.correctAnswer === 'string'
          ? (sc.correctAnswer as string)
          : null;
      if (!correctKey && Array.isArray(pq.snapshotOptions)) {
        const correctOpt = (pq.snapshotOptions as any[]).find((o) => o?.correct === true);
        if (correctOpt?.key) correctKey = String(correctOpt.key);
      }
      // R10: final fallback — Question.answerContent.text. This is where
      // IELTS short_answer (matching headings, summary completion, diagram
      // labels) keeps the canonical answer. Server-side only; never sent
      // during the live take-paper flow (getStudentView redacts).
      if (!correctKey) {
        const ac = (pq.question as any)?.answerContent as { text?: unknown } | null;
        if (typeof ac?.text === 'string' && ac.text.length <= 80) {
          correctKey = ac.text;
        }
      }
      const explanation =
        typeof sc.explanation === 'string'
          ? (sc.explanation as string).slice(0, 600)
          : null;
      // Reference answer for non-MCQ review (short_answer / structured /
      // essay), pulled from Question.answerContent (text or markScheme).
      // Kept SEPARATE from correctKey on purpose: correctKey stays capped
      // at 80 chars and drives isCorrect; this longer mark-scheme text is
      // display-only and NEVER feeds isCorrect, so surfacing it can't flip
      // a graded short answer to ✗. Same post-submit/window-closed gate as
      // every other answer-key field here, so it can't pre-leak mid-quiz.
      let referenceAnswer: string | null = null;
      if (pq.question.questionType !== 'mcq') {
        const ac = (pq.question as any)?.answerContent as
          | { text?: unknown; markScheme?: unknown }
          | null;
        const rawRef =
          typeof ac?.text === 'string'
            ? ac.text
            : typeof ac?.markScheme === 'string'
            ? ac.markScheme
            : null;
        if (rawRef && rawRef.trim().length > 0) {
          referenceAnswer =
            rawRef.length > 600 ? rawRef.slice(0, 600) + '…' : rawRef;
        }
      }
      const script = scriptByPq.get(pq.id);
      const studentChoice = script?.selectedOption ?? script?.textAnswer ?? null;
      // R10-fix: prefer the persisted autoCorrect that finalSubmit's
      // autoGradeScripts already wrote — it's authoritative and survives
      // the snapshotContent missing-correct-key case above. Recompute from
      // correctKey only as a defensive fallback for older submissions
      // (where the script row predates the autoGrade writeback).
      let isCorrect: boolean | null = null;
      if (typeof script?.autoCorrect === 'boolean') {
        isCorrect = script.autoCorrect;
      } else if (correctKey != null && studentChoice != null) {
        isCorrect =
          String(studentChoice).trim().toLowerCase() ===
          String(correctKey).trim().toLowerCase();
      }
      return {
        paperQuestionId: pq.id,
        sortOrder: pq.sortOrder,
        marks: pq.marks,
        questionType: pq.question.questionType,
        // Whitelist redacted content (strips correctOption/markScheme/
        // exampleAnswer; keeps stem/passage/options).
        snapshotContent: redactSnapshotForStudent(pq.snapshotContent),
        // Display-only options (no `correct` flag).
        snapshotOptions: Array.isArray(pq.snapshotOptions)
          ? (pq.snapshotOptions as any[]).map((o) => ({ key: o?.key, text: o?.text }))
          : null,
        // Result-page-only fields (added after redaction since the quiz
        // window has closed for this student):
        studentAnswer: studentChoice,
        correctAnswer: correctKey,
        explanation,
        awardedMarks: script?.awardedMarks ?? null,
        autoCorrect: script?.autoCorrect ?? null,
        // S12H —— 只喂给 stripUnreleasedScores 做出身判定；它会在返回前
        // 连同判分状态一起处理，不作为对外字段的新增语义。
        markedById: script?.markedById ?? null,
        isCorrect,
        // Strip the internal `[ai-grade] ` prefix before showing students;
        // they don't need the marker tag, only the rationale itself.
        // Teacher-side dashboards keep the raw markerComment with the prefix.
        markerComment:
          typeof script?.markerComment === 'string'
            ? script.markerComment.replace(/^\[ai-grade\]\s*/, '')
            : null,
        // Lets the student UI label the comment correctly. Human marker
        // comments — the norm here, grading is done by a teacher, never the
        // API — carry no prefix → 'teacher'; the AI-grader fallback writes a
        // `[ai-grade]` prefix → 'ai'. Null when there is no comment.
        commentSource:
          typeof script?.markerComment === 'string'
            ? /^\[ai-grade\]/.test(script.markerComment)
              ? 'ai'
              : 'teacher'
            : null,
        referenceAnswer,
      };
    });

    // 新政（2026-08-14）：答案即时可见，分数评语等 marked 才下发。
    // strip 在服务端做，history-detail 复用本方法所以同样被覆盖。
    return stripUnreleasedScores({
      sessionId: session.id,
      paperName: session.paperAssignment.paper.name,
      submissionId: submission.id,
      status: submission.status,
      // 答案门看这个：暂存提交(null)的学生下午还能改，不能给答案
      finalSubmittedAt: submission.finalSubmittedAt,
      autoScore: submission.autoScore,
      manualScore: submission.manualScore,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      submittedAt: submission.submittedAt,
      items,
    });
  }

  // ─────────────────── Wave-2 private helpers ───────────────────

  /**
   * Resolve a (name, optional studentId) tuple to one student row, mirroring
   * the disambiguation rules used by /history-by-name (Round-13 fix
   * included: filter isActive=true and archivedAt=null so soft-deleted /
   * withdrawn students don't appear). Returns either:
   *   - { kind: 'one', student }     → unique match, caller proceeds
   *   - { kind: 'disambig', list }   → multiple matches + no studentId
   * Throws NotFoundException if no candidate matches at all.
   */
  private async resolveStudentByName(
    rawName: string,
    studentIdFilter?: string,
    authStudentId?: string,
  ): Promise<
    | {
        kind: 'one';
        student: {
          id: string;
          name: string;
          classes: Array<{ id: string; name: string; classCode: string }>;
        };
      }
    | {
        kind: 'disambig';
        candidates: Array<{
          studentId: string;
          name: string;
          classes: Array<{ id: string; name: string; classCode: string }>;
        }>;
      }
  > {
    // 阶段 5A —— **已认证路径优先**：用令牌里的 id 精确查，
    // 不查姓名、不消歧（永远不会返回 kind: 'disambig'）、不给近似姓名建议。
    // 资格谓词与 vocab 那条共用同一份定义。
    if (authStudentId) {
      const row = await this.prisma.user.findFirst({
        where: authenticatedStudentWhere(authStudentId),
        select: {
          id: true,
          name: true,
          classEnrollments: {
            where: { role: 'student', class: { archivedAt: null } },
            select: { class: { select: { id: true, name: true, classCode: true } } },
          },
        },
      });
      if (!row) throw studentNotEligible();
      return {
        kind: 'one' as const,
        student: { id: row.id, name: row.name, classes: row.classEnrollments.map((e) => e.class) },
      };
    }

    const name = (rawName ?? '').trim();
    if (!name) throw new BadRequestException({ code: 'name_required' });
    if (name.length > 50) throw new BadRequestException({ code: 'name_too_long' });
    // R15-Audit#2 Finding #1 — the controller-side historyByName fix
    // (also requiring `classEnrollments: { some: { role: 'student' } }`)
    // was incomplete: this shared helper feeds upcoming-for-name +
    // trend + 4 other endpoints. The phantom 李永轩 would still show
    // through any of them. Mirror the controller's predicate AND
    // require the enrollment's class itself to be active (not
    // archived).
    const allCandidates = await this.prisma.user.findMany({
      where: {
        name,
        role: 'student',
        isActive: true,
        archivedAt: null,
        classEnrollments: {
          some: { role: 'student', class: { archivedAt: null } },
        },
      },
      select: {
        id: true,
        name: true,
        classEnrollments: {
          where: { role: 'student', class: { archivedAt: null } },
          select: { class: { select: { id: true, name: true, classCode: true } } },
        },
      },
    });
    if (allCandidates.length === 0) {
      // 输错一个字的学生需要一条出路，不是一句「找不到」（学生十问 #9）。
      // 只在查无此人时才多查一次名册 —— 正常路径零额外开销。
      let suggestions: string[] = [];
      try {
        const roster = await this.prisma.user.findMany({
          where: {
            role: 'student',
            isActive: true,
            archivedAt: null,
            classEnrollments: { some: { role: 'student', class: { archivedAt: null } } },
          },
          select: { name: true },
        });
        suggestions = closeNames(name, roster.map((r) => r.name));
      } catch { /* 建议是锦上添花，失败不影响报错本身 */ }
      throw new NotFoundException({ code: 'student_not_found', typed: name, suggestions });
    }
    if (studentIdFilter) {
      const matched = allCandidates.find((c) => c.id === studentIdFilter);
      if (!matched) {
        throw new NotFoundException({
          code: 'student_not_found',
          message: 'no candidate matches studentId for this name',
        });
      }
      return {
        kind: 'one',
        student: {
          id: matched.id,
          name: matched.name,
          classes: matched.classEnrollments.map((e) => e.class),
        },
      };
    }
    if (allCandidates.length > 1) {
      return {
        kind: 'disambig',
        candidates: allCandidates.map((c) => ({
          studentId: c.id,
          name: c.name,
          classes: c.classEnrollments.map((e) => e.class),
        })),
      };
    }
    const only = allCandidates[0];
    return {
      kind: 'one',
      student: {
        id: only.id,
        name: only.name,
        classes: only.classEnrollments.map((e) => e.class),
      },
    };
  }

  // ─────────────────── F2 — Upcoming today by name ───────────────────

  /**
   * Public, IP-gated, rate-limited. Reuses the name+studentId disambig
   * shape from /history-by-name. Returns every non-cancelled session
   * for any of the student's classes whose date == today (Asia/Shanghai)
   * AND whose quizEnd >= now. "Today" is computed via the same
   * UTC-noon-+8 trick used elsewhere in this module: the DB stores
   * MorningQuizSession.date at UTC-00:00 of the school-local day, so
   * we floor `now + tzOffset` to a UTC midnight to match.
   */
  async upcomingForName(rawName: string, studentIdFilter?: string) {
    const resolved = await this.resolveStudentByName(rawName, studentIdFilter);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const student = resolved.student;
    const classIds = student.classes.map((c) => c.id);
    if (classIds.length === 0) {
      return { student, upcoming: [] };
    }
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const now = new Date();
    // Floor `now` to a UTC midnight that matches @db.Date storage for
    // "today in school-local". E.g. 2026-05-12T03:00Z + 8h offset is
    // 2026-05-12T11:00 local → school-local day = 2026-05-12 → DB stores
    // 2026-05-12T00:00Z. Add tzOff, take UTC YMD, then rebuild the
    // midnight Date.
    const localMs = now.getTime() + tzOff * 60_000;
    const localDay = new Date(localMs);
    const dayIso = `${localDay.getUTCFullYear()}-${String(
      localDay.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(localDay.getUTCDate()).padStart(2, '0')}`;
    const dayStart = new Date(`${dayIso}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: {
        classId: { in: classIds },
        date: { gte: dayStart, lt: dayEnd },
        status: { not: 'cancelled' },
        // 补考窗口开着的场次也要出现在「今天可以考」的列表里，
        // 否则补考学生进来看到的是空页。
        OR: [{ quizEnd: { gte: now } }, { makeupEnd: { gte: now } }],
      },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { select: { paper: { select: { name: true } } } },
      },
      orderBy: { attendanceStart: 'asc' },
    });
    return {
      student,
      upcoming: sessions.map((s) => ({
        sessionId: s.id,
        classId: s.classId,
        className: s.class.name,
        level: s.level,
        attendanceStart: s.attendanceStart,
        quizStart: s.quizStart,
        quizEnd: s.quizEnd,
        paperName: s.paperAssignment.paper.name,
        status: s.status,
      })),
    };
  }

  // ─────────────────── F10 — Grade appeals ───────────────────

  /**
   * Public (IP-gated, rate-limited) — student creates a grade-appeal row
   * tied to a submitted submission. Name+studentId disambig matches
   * /history-by-name. Validates that the submission belongs to the
   * verified student (defeat scraping submissionIds with someone else's
   * name).
   */
  async createAppeal(
    input: {
      submissionId: string;
      paperQuestionId?: string;
      message: string;
      studentName: string;
      studentId?: string;
      /** 阶段 5A：已认证学生的 id。给了就走精确 ID 路径，不查姓名。 */
      authStudentId?: string;
    },
    ip: string | null,
  ) {
    const message = (input.message ?? '').trim();
    if (!message) throw new BadRequestException({ code: 'message_required' });
    if (message.length > 4000) throw new BadRequestException({ code: 'message_too_long' });
    const resolved = await this.resolveStudentByName(
      input.studentName,
      input.studentId,
      input.authStudentId,
    );
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: input.submissionId },
      select: { id: true, studentId: true, assignmentId: true, status: true },
    });
    if (!sub) throw new NotFoundException({ code: 'submission_not_found' });
    if (sub.studentId !== resolved.student.id) {
      throw new ForbiddenException({ code: 'submission_not_yours' });
    }
    if (input.paperQuestionId) {
      // Verify the paperQuestionId is actually one of the paper's questions.
      const asgmt = await this.prisma.paperAssignment.findUnique({
        where: { id: sub.assignmentId },
        select: { paperId: true },
      });
      if (asgmt) {
        const pq = await this.prisma.paperQuestion.findFirst({
          where: { id: input.paperQuestionId, paperId: asgmt.paperId },
          select: { id: true },
        });
        if (!pq) throw new BadRequestException({ code: 'paper_question_mismatch' });
      }
    }
    const appeal = await this.prisma.gradeAppeal.create({
      data: {
        submissionId: sub.id,
        paperQuestionId: input.paperQuestionId ?? null,
        studentMessage: message,
        status: 'open',
      },
    });
    await this.audit.log({
      actorId: resolved.student.id,
      actorRole: 'student',
      action: 'morning_quiz.appeal.create',
      entityType: 'GradeAppeal',
      entityId: appeal.id,
      ip,
      metadata: {
        submissionId: sub.id,
        paperQuestionId: input.paperQuestionId ?? null,
      },
    });
    return { appealId: appeal.id, status: appeal.status };
  }

  /**
   * Teacher / head_teacher / admin — paginated list of appeals. Filterable
   * by status (default 'open') and classId (admin sees everything; class-
   * scoped teachers only see their own classes). Joins submission + paper
   * + student for display.
   */
  async listAppeals(
    actor: ActorCtx,
    filters: { status?: string; classId?: string; page?: number; pageSize?: number },
  ) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
    const status = filters.status ?? 'open';
    // Scope by classId if supplied AND caller can act on it.
    let assignmentFilter: Prisma.GradeAppealWhereInput = {};
    if (filters.classId) {
      if (!(await canActOnClass(this.prisma, actor, filters.classId))) {
        throw new ForbiddenException({ code: 'not_your_class' });
      }
      assignmentFilter = {
        submission: { assignment: { classId: filters.classId } },
      };
    } else if (actor.role === 'teacher') {
      // Teacher (non-head) gets scoped to the classes they teach.
      const enrollments = await this.prisma.classEnrollment.findMany({
        where: { userId: actor.id, role: { not: 'student' } },
        select: { classId: true },
      });
      const allowedClassIds = enrollments.map((e) => e.classId);
      assignmentFilter = {
        submission: { assignment: { classId: { in: allowedClassIds } } },
      };
    }
    const where: Prisma.GradeAppealWhereInput = {
      status,
      ...assignmentFilter,
    };
    const [items, total] = await Promise.all([
      this.prisma.gradeAppeal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          submission: {
            select: {
              id: true,
              studentId: true,
              autoScore: true,
              maxScore: true,
              student: { select: { id: true, name: true } },
              assignment: {
                select: {
                  paper: { select: { id: true, name: true } },
                  class: { select: { id: true, name: true } },
                },
              },
            },
          },
          paperQuestion: {
            select: { id: true, sortOrder: true, marks: true },
          },
          reviewer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.gradeAppeal.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Teacher / head_teacher / admin — accept or reject an appeal. When
   * accepting WITH a scoreOverride + paperQuestionId, also rewrite the
   * AnswerScript's awardedMarks and recompute the parent submission's
   * autoScore. Audit-logged.
   */
  async resolveAppeal(
    appealId: string,
    actor: ActorCtx,
    body: {
      accept: boolean;
      note?: string;
      scoreOverride?: number | null;
      paperQuestionId?: string;
    },
  ) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const appeal = await this.prisma.gradeAppeal.findUnique({
      where: { id: appealId },
      include: {
        submission: {
          select: {
            id: true,
            assignmentId: true,
            assignment: { select: { classId: true } },
          },
        },
      },
    });
    if (!appeal) throw new NotFoundException({ code: 'appeal_not_found' });
    if (!(await canActOnClass(this.prisma, actor, appeal.submission.assignment.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    if (appeal.status !== 'open') {
      throw new BadRequestException({ code: 'appeal_already_resolved', status: appeal.status });
    }
    const newStatus = body.accept ? 'accepted' : 'rejected';
    const note = body.note ? String(body.note).slice(0, 4000) : null;
    const targetPqId = body.paperQuestionId ?? appeal.paperQuestionId ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.gradeAppeal.update({
        where: { id: appealId },
        data: {
          status: newStatus,
          reviewerId: actor.id,
          reviewerNote: note,
          reviewedAt: new Date(),
        },
      });
      // If accepting AND there's a scoreOverride targeting a specific
      // paperQuestion, rewrite the AnswerScript and recompute autoScore.
      if (
        body.accept &&
        typeof body.scoreOverride === 'number' &&
        targetPqId
      ) {
        const script = await tx.answerScript.findUnique({
          where: {
            submissionId_paperQuestionId: {
              submissionId: appeal.submissionId,
              paperQuestionId: targetPqId,
            },
          },
          select: { id: true },
        });
        if (script) {
          await tx.answerScript.update({
            where: { id: script.id },
            data: {
              awardedMarks: body.scoreOverride,
              autoCorrect: body.scoreOverride > 0,
            },
          });
        }
        // Recompute autoScore = sum of awardedMarks across this submission.
        const updatedScripts = await tx.answerScript.findMany({
          where: { submissionId: appeal.submissionId },
          select: { awardedMarks: true },
        });
        const autoScore = updatedScripts.reduce(
          (acc, s) => acc + (s.awardedMarks ?? 0),
          0,
        );
        // R15-Audit#2 Finding #2 — also write totalScore. The student
        // and parent dashboards read `totalScore`, not `autoScore`;
        // previously the override silently had no visible effect on a
        // `marked` submission. totalScore = autoScore + (manualScore ?? 0)
        // matches the convention used by finalSubmit + regradeSession.
        const sub = await tx.studentSubmission.findUnique({
          where: { id: appeal.submissionId },
          select: { manualScore: true },
        });
        const manualScore = sub?.manualScore ?? null;
        const totalScore = autoScore + (manualScore ?? 0);
        await tx.studentSubmission.update({
          where: { id: appeal.submissionId },
          data: { autoScore, totalScore },
        });
      }
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.appeal.resolve',
      entityType: 'GradeAppeal',
      entityId: appealId,
      ip: actor.ip,
      metadata: {
        accept: body.accept,
        scoreOverride: body.scoreOverride ?? null,
        paperQuestionId: targetPqId,
      },
    });
    return { id: appealId, status: newStatus };
  }

  // ─────────────────── F13 — Fuzzy student search ───────────────────

  /**
   * Teacher / head_teacher / admin — case-insensitive substring search
   * on User.name + User.email scoped to a class's active enrollments.
   * No real pinyin yet — when we wire opencc / pinyin-pro we'll
   * normalise both sides; for now ASCII substring + zh literal hits
   * cover the dashboard use case.
   *
   * Returns up to 50 results (cap); use a more specific query to drill in.
   */
  async searchStudentsInClass(classId: string, rawQuery: string, actor: ActorCtx) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const q = (rawQuery ?? '').trim();
    if (!q) return { items: [] };
    if (q.length > 50) throw new BadRequestException({ code: 'query_too_long' });
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: {
        classId,
        role: 'student',
        user: {
          isActive: true,
          archivedAt: null,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      take: 50,
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return {
      items: enrollments.map((e) => e.user),
    };
  }

  // ─────────────────── F15 — Question retraction ───────────────────

  /**
   * Teacher / head_teacher / admin — mark a paper question as retracted.
   * Unique on paperQuestionId — second retract returns 409. If
   * awardAllStudents=true, every existing StudentSubmission for this
   * paper has its AnswerScript for this question rewritten to
   * `autoCorrect=true, awardedMarks=pq.marks` and the parent submission's
   * autoScore recomputed. Each affected submission gets an audit row
   * with the before/after delta.
   */
  async retractQuestion(
    paperId: string,
    body: {
      paperQuestionId: string;
      reason: string;
      awardAllStudents: boolean;
    },
    actor: ActorCtx,
  ) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const reason = (body.reason ?? '').trim();
    if (!reason) throw new BadRequestException({ code: 'reason_required' });
    if (reason.length > 1000) throw new BadRequestException({ code: 'reason_too_long' });
    // Verify the question is on this paper.
    const pq = await this.prisma.paperQuestion.findFirst({
      where: { id: body.paperQuestionId, paperId },
      select: { id: true, marks: true },
    });
    if (!pq) throw new NotFoundException({ code: 'paper_question_not_found' });
    // Per-class scoping — teachers must own at least one assignment of
    // this paper. Admin / head_teacher pass through.
    if (actor.role === 'teacher') {
      const owned = await this.prisma.paperAssignment.findFirst({
        where: { paperId },
        select: { classId: true },
      });
      if (!owned || !(await canActOnClass(this.prisma, actor, owned.classId))) {
        throw new ForbiddenException({ code: 'not_your_class' });
      }
    }
    const existing = await this.prisma.questionRetraction.findUnique({
      where: { paperQuestionId: body.paperQuestionId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'already_retracted',
        retractionId: existing.id,
      });
    }
    const retraction = await this.prisma.questionRetraction.create({
      data: {
        paperQuestionId: body.paperQuestionId,
        reason,
        awardAllStudents: body.awardAllStudents,
        actorId: actor.id,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.question.retract',
      entityType: 'QuestionRetraction',
      entityId: retraction.id,
      ip: actor.ip,
      metadata: {
        paperId,
        paperQuestionId: body.paperQuestionId,
        awardAllStudents: body.awardAllStudents,
      },
    });
    let submissionsRegraded = 0;
    if (body.awardAllStudents) {
      // Find every (non-practice) StudentSubmission for this paper. Walk
      // each one, rewrite the script for the retracted question, recompute
      // autoScore. Per-submission tx so a single failure doesn't roll the
      // whole batch back.
      const submissions = await this.prisma.studentSubmission.findMany({
        where: {
          assignment: { paperId },
          status: { not: 'practice' },
        },
        select: {
          id: true,
          autoScore: true,
          scripts: {
            where: { paperQuestionId: body.paperQuestionId },
            select: { id: true, awardedMarks: true },
          },
        },
      });
      for (const sub of submissions) {
        try {
          const oldMark = sub.scripts[0]?.awardedMarks ?? 0;
          const newMark = pq.marks;
          await this.prisma.$transaction(async (tx) => {
            if (sub.scripts[0]) {
              await tx.answerScript.update({
                where: { id: sub.scripts[0].id },
                data: { autoCorrect: true, awardedMarks: newMark },
              });
            } else {
              // No script row for this question yet (student never opened
              // it). Create one so the credit shows up. Empty content.
              await tx.answerScript.create({
                data: {
                  submissionId: sub.id,
                  paperQuestionId: body.paperQuestionId,
                  autoCorrect: true,
                  awardedMarks: newMark,
                },
              });
            }
            // Recompute autoScore as sum of awardedMarks. Cheaper to
            // recount than diff-track when the underlying script set
            // may have just grown by one.
            const allScripts = await tx.answerScript.findMany({
              where: { submissionId: sub.id },
              select: { awardedMarks: true },
            });
            const autoScore = allScripts.reduce(
              (acc, s) => acc + (s.awardedMarks ?? 0),
              0,
            );
            await tx.studentSubmission.update({
              where: { id: sub.id },
              data: { autoScore },
            });
          });
          await this.audit.log({
            actorId: actor.id,
            actorRole: actor.role,
            action: 'morning_quiz.question.retract.regrade',
            entityType: 'StudentSubmission',
            entityId: sub.id,
            ip: actor.ip,
            metadata: {
              retractionId: retraction.id,
              paperQuestionId: body.paperQuestionId,
              oldMark,
              newMark,
            },
          });
          submissionsRegraded++;
        } catch (e: any) {
          this.logger.error(
            `retract regrade submission ${sub.id} failed: ${e?.message ?? e}`,
          );
        }
      }
    }
    return {
      retractionId: retraction.id,
      paperQuestionId: body.paperQuestionId,
      submissionsRegraded,
    };
  }

  // ─────────────────── F16 — Practice mode ───────────────────

  /**
   * Public (IP-gated, rate-limited) — start a fresh practice attempt
   * against an existing submission's paper. The caller MUST verify their
   * identity via the standard name+studentId disambig flow. Practice
   * submissions live as status='practice' rows with no sessionId binding,
   * so the cron's lockOne (which filters by sessionId) ignores them and
   * the stats endpoints exclude them via status filter.
   *
   * NOTE: StudentSubmission has @@unique([assignmentId, studentId]) so
   * a second practice attempt against the same assignment will hit a
   * P2002. Spec covers this in v1 as "punt — schema team owns dropping
   * the unique to (assignmentId, studentId, status)". Catch + 409 for
   * now so callers can degrade gracefully.
   */
  async startPractice(
    submissionId: string,
    body: { studentName: string; studentId?: string },
    ip: string | null,
  ) {
    const resolved = await this.resolveStudentByName(body.studentName, body.studentId);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        studentId: true,
        assignmentId: true,
        assignment: { select: { paperId: true } },
      },
    });
    if (!sub) throw new NotFoundException({ code: 'submission_not_found' });
    if (sub.studentId !== resolved.student.id) {
      throw new ForbiddenException({ code: 'submission_not_yours' });
    }
    // maxScore mirrors the paper's totalMarksActual at the moment of
    // creation, same as finalSubmit does for real submissions.
    const paper = await this.prisma.paper.findUnique({
      where: { id: sub.assignment.paperId },
      select: { totalMarksActual: true },
    });
    if (!paper) throw new NotFoundException({ code: 'paper_not_found' });
    let practice;
    try {
      practice = await this.prisma.studentSubmission.create({
        data: {
          assignmentId: sub.assignmentId,
          studentId: sub.studentId,
          status: 'practice',
          maxScore: paper.totalMarksActual,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        // Schema-team punt — @@unique([assignmentId, studentId]) still
        // present so we can't have both a real submission AND a practice
        // submission. Surface a clear error instead of a 500.
        throw new ConflictException({
          code: 'practice_unique_blocked',
          message: 'Schema migration pending: cannot create practice submission while real submission exists for this assignment.',
        });
      }
      throw e;
    }
    // Pre-seed empty AnswerScript rows for every PaperQuestion so the
    // take-quiz UI has rows to fill.
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: sub.assignment.paperId },
      select: { id: true },
    });
    if (paperQuestions.length > 0) {
      await this.prisma.answerScript.createMany({
        data: paperQuestions.map((pq) => ({
          submissionId: practice.id,
          paperQuestionId: pq.id,
        })),
      });
    }
    await this.audit.log({
      actorId: resolved.student.id,
      actorRole: 'student',
      action: 'morning_quiz.practice.start',
      entityType: 'StudentSubmission',
      entityId: practice.id,
      ip,
      metadata: { sourceSubmissionId: submissionId },
    });
    return {
      practiceSubmissionId: practice.id,
      paperId: sub.assignment.paperId,
      sessionId: null,
    };
  }

  /**
   * Public (IP-gated, rate-limited) — fetch a practice paper for replay.
   * Returns the paper questions (whitelist-redacted, same as
   * getStudentView) plus the existing answers the student has saved on
   * this practice run.
   */
  async getPractice(
    practiceSubmissionId: string,
    body: { studentName: string; studentId?: string },
  ) {
    const resolved = await this.resolveStudentByName(body.studentName, body.studentId);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: practiceSubmissionId },
      select: {
        id: true,
        studentId: true,
        status: true,
        autoScore: true,
        maxScore: true,
        submittedAt: true,
        assignment: {
          select: {
            paperId: true,
            // 前端 PracticeSubmissionView 一直声明着 paperName/level/
            // paperMode，服务端却没返回 —— 结果页标题长期是空的「(练习)」。
            paper: { select: { name: true, config: true } },
            morningQuizSession: { select: { level: true } },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException({ code: 'submission_not_found' });
    if (sub.status !== 'practice') {
      throw new BadRequestException({ code: 'not_a_practice_submission' });
    }
    if (sub.studentId !== resolved.student.id) {
      throw new ForbiddenException({ code: 'submission_not_yours' });
    }
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: sub.assignment.paperId },
      orderBy: { sortOrder: 'asc' },
      include: { question: { select: { id: true, questionType: true, answerContent: true } } },
    });
    const scripts = await this.prisma.answerScript.findMany({
      where: { submissionId: sub.id },
      select: {
        id: true,
        paperQuestionId: true,
        selectedOption: true,
        textAnswer: true,
        autoCorrect: true,
        awardedMarks: true,
        markerComment: true,
      },
    });
    const existingAnswers: Record<string, { content: any; flagged: boolean }> = {};
    for (const s of scripts) {
      existingAnswers[s.paperQuestionId] = {
        content: s.selectedOption != null ? s.selectedOption : s.textAnswer,
        flagged: false,
      };
    }
    const stripOptions = (opts: unknown) => {
      if (!Array.isArray(opts)) return opts;
      return opts.map((o: any) => ({ key: o?.key, text: o?.text }));
    };
    // R15-followup-7: when the student already submitted this practice
    // attempt, return the same perQuestion grading payload that
    // submitPractice returns so the FE can render PracticeResultView
    // immediately. Without this, visiting /practice/:id of a finished
    // attempt re-shows the editable form and the only entry point back
    // to "what did I score" is to re-submit, which feels broken.
    // Use autoScore (not submittedAt) as the "already graded" flag —
    // legacy practice rows from before R15-followup-7 have
    // submittedAt=null but a real autoScore; treating those as
    // "unsubmitted" would re-show the form and make /my-history's
    // 「查看练习卷」 confusing for any data created before this fix.
    const alreadySubmitted = sub.autoScore != null;
    let perQuestion: any[] | null = null;
    if (alreadySubmitted) {
      const scriptByPq = new Map(scripts.map((s) => [s.paperQuestionId, s]));
      perQuestion = paperQuestions.map((pq) => {
        const s = scriptByPq.get(pq.id);
        const sc = (pq.snapshotContent ?? {}) as any;
        let correctKey: string | null =
          typeof sc.correctOption === 'string'
            ? sc.correctOption
            : typeof sc.correctAnswer === 'string'
            ? sc.correctAnswer
            : null;
        if (!correctKey && Array.isArray(pq.snapshotOptions)) {
          const correctOpt = (pq.snapshotOptions as any[]).find(
            (o) => o?.correct === true,
          );
          if (correctOpt?.key) correctKey = String(correctOpt.key);
        }
        if (!correctKey) {
          const ac = (pq.question as any)?.answerContent as { text?: unknown } | null;
          if (typeof ac?.text === 'string' && ac.text.length <= 80) {
            correctKey = ac.text;
          }
        }
        const studentAnswer = s?.selectedOption ?? s?.textAnswer ?? null;
        // markerComment is stored as `[ai-grade] <reason>`; strip the
        // prefix so the FE displays just the reasoning.
        const rawComment = s?.markerComment ?? null;
        const aiReason = rawComment?.startsWith('[ai-grade] ')
          ? rawComment.slice('[ai-grade] '.length)
          : rawComment;
        return {
          scriptId: s?.id ?? null,
          paperQuestionId: pq.id,
          sortOrder: pq.sortOrder,
          marks: pq.marks,
          autoCorrect: s?.autoCorrect ?? null,
          isCorrect: s?.autoCorrect ?? null,
          awardedMarks: s?.awardedMarks ?? 0,
          studentAnswer,
          correctAnswer: correctKey,
          explanation:
            typeof sc.explanation === 'string' ? sc.explanation.slice(0, 600) : null,
          aiReason,
        };
      });
    }
    return {
      practiceSubmissionId: sub.id,
      paperId: sub.assignment.paperId,
      paperName: sub.assignment.paper?.name ?? '',
      level: sub.assignment.morningQuizSession?.level ?? null,
      paperMode:
        ((sub.assignment.paper?.config as any)?.mode === 'passage_pick'
          ? 'passage_pick'
          : 'standard') as 'passage_pick' | 'standard',
      paperQuestions: paperQuestions.map((pq) => ({
        id: pq.id,
        sortOrder: pq.sortOrder,
        marks: pq.marks,
        snapshotContent: redactSnapshotForStudent(pq.snapshotContent),
        snapshotOptions: stripOptions(pq.snapshotOptions),
        questionType: pq.question.questionType,
      })),
      existingAnswers,
      alreadySubmitted,
      autoScore: sub.autoScore,
      maxScore: sub.maxScore,
      perQuestion,
    };
  }

  /**
   * Public (IP-gated, rate-limited) — submit a practice attempt. Runs
   * autoGradeScripts so the student sees a score, but DOES NOT mark the
   * submission as 'submitted' (status stays 'practice'). DOES NOT fire
   * score_ready notifications. Stats / trend / wrong-rate endpoints
   * filter out status='practice' so this never counts.
   */
  async submitPractice(
    practiceSubmissionId: string,
    body: {
      studentName: string;
      studentId?: string;
      answers: Array<{
        paperQuestionId: string;
        selectedOption?: string | null;
        textAnswer?: string | null;
      }>;
    },
    ip: string | null,
  ) {
    const resolved = await this.resolveStudentByName(body.studentName, body.studentId);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: practiceSubmissionId },
      select: {
        id: true,
        studentId: true,
        status: true,
        maxScore: true,
        assignment: {
          select: { paperId: true, paper: { select: { name: true } } },
        },
      },
    });
    if (!sub) throw new NotFoundException({ code: 'submission_not_found' });
    if (sub.status !== 'practice') {
      throw new BadRequestException({ code: 'not_a_practice_submission' });
    }
    if (sub.studentId !== resolved.student.id) {
      throw new ForbiddenException({ code: 'submission_not_yours' });
    }
    // Upsert all answers.
    for (const a of body.answers ?? []) {
      await this.prisma.answerScript.upsert({
        where: {
          submissionId_paperQuestionId: {
            submissionId: sub.id,
            paperQuestionId: a.paperQuestionId,
          },
        },
        create: {
          submissionId: sub.id,
          paperQuestionId: a.paperQuestionId,
          selectedOption: a.selectedOption ?? null,
          textAnswer: a.textAnswer ?? null,
        },
        update: {
          selectedOption: a.selectedOption ?? null,
          textAnswer: a.textAnswer ?? null,
        },
      });
    }
    // Load + grade.
    const scripts = await this.prisma.answerScript.findMany({
      where: { submissionId: sub.id },
      include: {
        paperQuestion: {
          include: {
            question: {
              select: {
                questionType: true,
                options: true,
                answerContent: true,
                content: true,
              },
            },
          },
        },
      },
    });
    // 2.0 — 与 09:00 锁定 cron 同一个开关，默认不调 AI（见 morning-quiz.cron.ts
    // 里的长注释）。练习模式是学生随时可点的，若不收口，任何一次带文字作答的
    // 重做都会发一次真实 Anthropic 请求。
    const rawGrade = await this.gradeScripts(scripts);
    // R15-followup-21 — practice mode also honours retractions so a
    // student re-doing a paper post-retract sees the same credit they'd
    // see on the real submission.
    const { autoScore, scriptUpdates } = await applyRetractionCredits(
      this.prisma,
      scripts as any,
      rawGrade,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.studentSubmission.update({
        where: { id: sub.id },
        // Stamp submittedAt so /my-history can sort practice rows by
        // recency and the student can see "submitted just now" timing.
        // status stays 'practice' so stats/trend/wrong-rate still skip it.
        data: { autoScore, submittedAt: new Date() },
      });
      for (const u of scriptUpdates) {
        await tx.answerScript.update({
          where: { id: u.id },
          data: {
            autoCorrect: u.autoCorrect,
            awardedMarks: u.awardedMarks,
            ...(u.aiReason ? { markerComment: `[ai-grade] ${u.aiReason}` } : {}),
          },
        });
      }
    });
    await this.audit.log({
      actorId: resolved.student.id,
      actorRole: 'student',
      action: 'morning_quiz.practice.submit',
      entityType: 'StudentSubmission',
      entityId: sub.id,
      ip,
      metadata: { autoScore, maxScore: sub.maxScore },
    });
    // R15-followup — the FE result page expects per-question
    // metadata (sortOrder, marks, studentAnswer, correctAnswer,
    // explanation) so it can render "Q3 · 1/1 · ✓ · my answer: X /
    // correct: Y". Without these, the result page renders every row
    // as "Q? · 得分:0 · (空答)" even when answers were submitted.
    // ⚠️ perQuestion 必须按**试卷题目**组装，不能按 AnswerScript 组装。
    //
    // 未作答的题在库里根本没有 AnswerScript 行（本项目的老坑，2026-08-13
    // 在成绩页栽过一次）。原来这里 `scripts.map(...)`，学生一题没答就
    // 返回空数组，结果页「逐题回顾」整块空白 —— 连正确答案都看不到，
    // 而看答案恰恰是练习模式唯一的价值。getPractice（重访路径）一直是
    // 按 paperQuestions 组装的，两条路径口径必须一致。
    const scriptById = new Map(scriptUpdates.map((u) => [u.id, u]));
    const scriptByPq = new Map(scripts.map((s) => [s.paperQuestionId, s]));
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: sub.assignment.paperId },
      orderBy: { sortOrder: 'asc' },
      include: { question: { select: { answerContent: true } } },
    });
    return {
      autoScore,
      maxScore: sub.maxScore,
      paperName: sub.assignment.paper?.name ?? '',
      perQuestion: paperQuestions.map((pq) => {
        const s = scriptByPq.get(pq.id);
        const u = s ? scriptById.get(s.id) : undefined;
        const autoCorrect = u?.autoCorrect ?? s?.autoCorrect ?? null;
        const awardedMarks = u?.awardedMarks ?? s?.awardedMarks ?? 0;
        const sc = (pq.snapshotContent ?? {}) as any;
        // 正确答案的三级回退，与 getStudentResult / getPractice 同一套：
        // snapshotContent.correctOption|correctAnswer → snapshotOptions
        // 里 correct=true 的那项 → question.answerContent.text。
        let correctKey: string | null =
          typeof sc.correctOption === 'string'
            ? sc.correctOption
            : typeof sc.correctAnswer === 'string'
            ? sc.correctAnswer
            : null;
        if (!correctKey && Array.isArray(pq.snapshotOptions)) {
          const correctOpt = (pq.snapshotOptions as any[]).find((o) => o?.correct === true);
          if (correctOpt?.key) correctKey = String(correctOpt.key);
        }
        if (!correctKey) {
          const ac = (pq.question as any)?.answerContent as { text?: unknown } | null;
          if (typeof ac?.text === 'string' && ac.text.length <= 80) correctKey = ac.text;
        }
        return {
          scriptId: s?.id ?? null,
          paperQuestionId: pq.id,
          sortOrder: pq.sortOrder,
          marks: pq.marks,
          autoCorrect,
          isCorrect: autoCorrect,
          awardedMarks,
          studentAnswer: s?.selectedOption ?? s?.textAnswer ?? null,
          correctAnswer: correctKey,
          explanation:
            typeof sc.explanation === 'string' ? sc.explanation.slice(0, 600) : null,
          aiReason: u?.aiReason ?? null,
        };
      }),
    };
  }

  // ─────────────────── F17 — Score trend by week ───────────────────

  /**
   * Public (IP-gated, rate-limited) — last N weeks of (week × level)
   * averages for one student. Week boundary is Monday in school-local
   * time (UTC+8), same as the date storage convention used throughout
   * this module. Excludes practice submissions and unsubmitted rows.
   */
  async historyTrendByName(
    rawName: string,
    studentIdFilter?: string,
    rawWeeks?: number,
  ) {
    const resolved = await this.resolveStudentByName(rawName, studentIdFilter);
    if (resolved.kind === 'disambig') {
      return { needDisambiguation: true, candidates: resolved.candidates };
    }
    const weeks = Math.min(52, Math.max(1, rawWeeks ?? 12));
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    // Build the cutoff: Monday-00:00 of (this week - weeks weeks).
    const now = new Date();
    const localMs = now.getTime() + tzOff * 60_000;
    const local = new Date(localMs);
    const dow = local.getUTCDay(); // 0=Sun..6=Sat
    // Distance back to Monday (Mon=1). If today is Sunday, that's 6 days
    // back, not -1.
    const daysBackToMonday = (dow + 6) % 7;
    const monLocal = new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() - daysBackToMonday,
      ),
    );
    // monLocal is UTC midnight of "this Monday in local". Subtract
    // (weeks-1) weeks to get the earliest week we care about.
    const earliestMonLocal = new Date(
      monLocal.getTime() - (weeks - 1) * 7 * 86_400_000,
    );
    // Convert that back to UTC instant for the DB filter: localMidnight
    // - tzOff = UTC instant.
    const cutoffUtc = new Date(earliestMonLocal.getTime() - tzOff * 60_000);
    const submissions = await this.prisma.studentSubmission.findMany({
      where: {
        studentId: resolved.student.id,
        // 2026-08-14 新政：未定稿（submitted）的分数是 MCQ 部分分，
        // 进趋势图会画出一个假的低分点 —— 只取已发布口径。
        status: { in: ['graded', 'returned', 'marked'] },
        submittedAt: { gte: cutoffUtc },
      },
      select: {
        id: true,
        autoScore: true,
        totalScore: true,
        maxScore: true,
        submittedAt: true,
        assignmentId: true,
      },
    });
    if (submissions.length === 0) {
      return { student: resolved.student, weeks: [] };
    }
    // Resolve level from MorningQuizSession (paperAssignmentId → session).
    const assignmentIds = Array.from(new Set(submissions.map((s) => s.assignmentId)));
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { paperAssignmentId: { in: assignmentIds } },
      select: { paperAssignmentId: true, level: true },
    });
    const levelByAsgmt = new Map<string, string>();
    for (const s of sessions) {
      if (!levelByAsgmt.has(s.paperAssignmentId)) {
        levelByAsgmt.set(s.paperAssignmentId, s.level);
      }
    }
    // Bucket by (weekStart-YMD, level).
    type Bucket = { totalPct: number; count: number };
    const buckets = new Map<string, Bucket>();
    for (const sub of submissions) {
      if (!sub.submittedAt) continue;
      const level = levelByAsgmt.get(sub.assignmentId);
      if (!level) continue;
      const subLocalMs = sub.submittedAt.getTime() + tzOff * 60_000;
      const subLocal = new Date(subLocalMs);
      const subDow = subLocal.getUTCDay();
      const subDaysBack = (subDow + 6) % 7;
      const subMonLocal = new Date(
        Date.UTC(
          subLocal.getUTCFullYear(),
          subLocal.getUTCMonth(),
          subLocal.getUTCDate() - subDaysBack,
        ),
      );
      const weekStart = `${subMonLocal.getUTCFullYear()}-${String(
        subMonLocal.getUTCMonth() + 1,
      ).padStart(2, '0')}-${String(subMonLocal.getUTCDate()).padStart(2, '0')}`;
      const key = `${weekStart}|${level}`;
      const max = sub.maxScore || 0;
      const got = sub.totalScore ?? sub.autoScore ?? 0;
      const pct = max > 0 ? (got / max) * 100 : 0;
      const b = buckets.get(key) ?? { totalPct: 0, count: 0 };
      b.totalPct += pct;
      b.count += 1;
      buckets.set(key, b);
    }
    const rows: Array<{
      weekStart: string;
      level: string;
      avgPct: number;
      submissionCount: number;
    }> = [];
    for (const [key, b] of buckets.entries()) {
      const [weekStart, level] = key.split('|');
      rows.push({
        weekStart,
        level,
        avgPct: b.count > 0 ? b.totalPct / b.count : 0,
        submissionCount: b.count,
      });
    }
    rows.sort((a, b) =>
      a.weekStart === b.weekStart
        ? a.level.localeCompare(b.level)
        : a.weekStart.localeCompare(b.weekStart),
    );
    return {
      student: resolved.student,
      weeks: rows,
    };
  }

  // ─────────────────── F18 — Per-question wrong rate ───────────────────

  /**
   * Teacher / head_teacher / admin — per-question wrong rate for one
   * paper. Excludes practice submissions. Wrong = autoCorrect === false;
   * scripts without an autoCorrect (never auto-graded) are excluded from
   * the denominator to keep "wrongRate" meaningful.
   */
  async paperWrongRate(paperId: string, actor: ActorCtx) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    // Scope check for non-admins — at least one assignment of this paper
    // must touch one of their classes.
    if (actor.role === 'teacher') {
      const anyAsgmt = await this.prisma.paperAssignment.findFirst({
        where: { paperId },
        select: { classId: true },
      });
      if (!anyAsgmt || !(await canActOnClass(this.prisma, actor, anyAsgmt.classId))) {
        throw new ForbiddenException({ code: 'not_your_class' });
      }
    }
    const pqs = await this.prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: { sortOrder: 'asc' },
      include: { question: { select: { questionType: true, content: true } } },
    });
    if (pqs.length === 0) return { items: [] };
    const pqIds = pqs.map((p) => p.id);
    const scripts = await this.prisma.answerScript.findMany({
      where: {
        paperQuestionId: { in: pqIds },
        submission: { status: { not: 'practice' } },
      },
      select: {
        paperQuestionId: true,
        autoCorrect: true,
      },
    });
    type Counter = { totalAttempts: number; wrongCount: number };
    const counters = new Map<string, Counter>();
    for (const s of scripts) {
      if (s.autoCorrect == null) continue; // not graded
      const c = counters.get(s.paperQuestionId) ?? { totalAttempts: 0, wrongCount: 0 };
      c.totalAttempts += 1;
      if (s.autoCorrect === false) c.wrongCount += 1;
      counters.set(s.paperQuestionId, c);
    }
    const items = pqs.map((pq, i) => {
      const c = counters.get(pq.id) ?? { totalAttempts: 0, wrongCount: 0 };
      // taskType lives on the question content blob for IELTS reading;
      // surface it when present so the UI can group by task.
      const content = (pq.question.content as Record<string, unknown> | null) ?? null;
      const taskType =
        typeof content?.taskType === 'string' ? (content.taskType as string) : null;
      return {
        paperQuestionId: pq.id,
        n: i + 1,
        taskType,
        totalAttempts: c.totalAttempts,
        wrongCount: c.wrongCount,
        wrongRate: c.totalAttempts > 0 ? c.wrongCount / c.totalAttempts : 0,
      };
    });
    return { items };
  }
}
