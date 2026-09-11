'use strict';
/**
 * DB-facing half of the ops-console "grade one script" write path.  All the
 * business-rule decisions live in `./grading.js` (pure functions, unit
 * tested without Postgres); this module only does I/O and calls them in
 * order. Mirrors apps/api/src/marker/marker.service.ts's scoreScript() +
 * finalize() constraints (2026-09-11 审计 S05) — same rules, no Nest/Prisma.
 *
 * Exposed as a factory (`createApplyGrade(pool, classId)`) rather than a
 * bare function so tests can inject a fake `pool` (anything with
 * `.connect()` returning a `{ query(), release() }` client) without
 * touching real Postgres or booting the Express app in server.js.
 */
const {
  checkClassOwnership,
  checkSubmissionGradable,
  checkNotMcq,
  checkAwardedMarksRange,
  checkClaimNotHeldByOther,
  checkMarkerAccount,
  computeSubmissionTotals,
} = require('./grading');

function createApplyGrade(pool, classId) {
  /**
   * Write one human mark decision + recompute the submission.  Idempotent
   * (skips scripts that are already graded).
   *
   * `markerEmail` must belong to a real, active, admin/head_teacher/teacher
   * account — 2026-09-11 之前这里直接拿"库里最早创建的管理员"顶替，所有
   * ops 判分都记同一个人名下，审计追不到谁真正做了这个操作。
   */
  return async function applyGrade(scriptId, awardedMarks, reason, markerEmail) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (!markerEmail) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'markerEmail is required' };
      }
      const markerR = await client.query(
        `select id, email, role, "isActive" from "User" where email=$1`,
        [markerEmail],
      );
      const markerAccountCheck = checkMarkerAccount(markerR.rows[0]);
      if (!markerAccountCheck.ok) {
        await client.query('ROLLBACK');
        return { ok: false, error: markerAccountCheck.error };
      }
      const markerId = markerR.rows[0].id;

      // 锁住这份答卷所在的提交行（FOR UPDATE OF ss）——串行化并发判分/
      // 正式发布，这样下面 "conditional update rowCount===0" 的 fallback
      // 分支基本不会再被真正触发；触发了也绝不盲写（见下）。
      const sR = await client.query(
        `select a."awardedMarks" awarded, a."markedById" marked_by, a."submissionId" sub, pq.marks max,
                qq."questionType" qtype, ss.status sub_status, pa."classId" class_id
           from "AnswerScript" a
           join "PaperQuestion" pq on pq.id=a."paperQuestionId"
           join "Question" qq on qq.id=pq."questionId"
           join "StudentSubmission" ss on ss.id=a."submissionId"
           join "PaperAssignment" pa on pa.id=ss."assignmentId"
          where a.id=$1
          for update of ss`,
        [scriptId],
      );
      const sc = sR.rows[0];
      if (!sc) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'script not found' };
      }

      const classCheck = checkClassOwnership(sc.class_id, classId);
      if (!classCheck.ok) {
        await client.query('ROLLBACK');
        return { ok: false, error: classCheck.error };
      }

      const statusCheck = checkSubmissionGradable(sc.sub_status);
      if (!statusCheck.ok) {
        await client.query('ROLLBACK');
        return { ok: false, error: statusCheck.error };
      }

      const typeCheck = checkNotMcq(sc.qtype);
      if (!typeCheck.ok) {
        await client.query('ROLLBACK');
        return { ok: false, error: typeCheck.error };
      }

      const claimR = await client.query(
        `select "markerId", status from "MarkerAssignment" where "submissionId"=$1`,
        [sc.sub],
      );
      const claimCheck = checkClaimNotHeldByOther(claimR.rows[0] || null, markerId);
      if (!claimCheck.ok) {
        await client.query('ROLLBACK');
        return { ok: false, error: claimCheck.error };
      }

      const marksCheck = checkAwardedMarksRange(awardedMarks, Number(sc.max));
      if (!marksCheck.ok) {
        await client.query('ROLLBACK');
        return { ok: false, error: marksCheck.error };
      }

      if (sc.marked_by && sc.awarded != null) {
        await client.query('ROLLBACK');
        return { ok: true, already: true, scriptId, submissionId: sc.sub };
      }

      await client.query(
        `update "AnswerScript" set "awardedMarks"=$2, "markerComment"=$3, "markedById"=$4, "markedAt"=now() where id=$1`,
        [scriptId, marksCheck.value, reason || null, markerId],
      );

      const subId = sc.sub;
      const scripts = (
        await client.query(
          `select a."awardedMarks" awarded, a."markedById" "markedById", qq."questionType" qtype
             from "AnswerScript" a join "PaperQuestion" pq on pq.id=a."paperQuestionId"
             join "Question" qq on qq.id=pq."questionId" where a."submissionId"=$1`,
          [subId],
        )
      ).rows;
      const totals = computeSubmissionTotals(scripts);

      let submissionStatus = sc.sub_status;
      if (totals.ungraded > 0) {
        await client.query(
          `update "StudentSubmission" set "autoScore"=$2,"manualScore"=$3,"totalScore"=$4 where id=$1`,
          [subId, totals.auto, totals.manual, totals.total],
        );
      } else {
        const upd = await client.query(
          `update "StudentSubmission" set status='marked', "autoScore"=$2,"manualScore"=$3,"totalScore"=$4 where id=$1 and status='submitted'`,
          [subId, totals.auto, totals.manual, totals.total],
        );
        if (upd.rowCount === 0) {
          // 2026-09-11 审计 S05：旧版这里会 blind-overwrite（不带 status
          // 过滤再 UPDATE 一次，还是返回 submissionStatus='marked'），导致
          // 返回的状态可能跟库里真实状态对不上。行锁下这条分支基本不该再
          // 触发；触发了也只如实报告当前状态，绝不再写一次。
          const real = await client.query(`select status from "StudentSubmission" where id=$1`, [subId]);
          await client.query('COMMIT');
          return {
            ok: true,
            scriptId,
            submissionId: subId,
            submissionStatus: real.rows[0] ? real.rows[0].status : 'unknown',
            note: "submission changed concurrently; this script's awardedMarks was saved but the submission was not re-finalized here",
            ungradedRemaining: totals.ungraded,
            totalScore: totals.total,
            maxScore: Number(sc.max),
            markedBy: markerEmail,
          };
        }
        submissionStatus = 'marked';
      }
      await client.query('COMMIT');
      return {
        ok: true,
        scriptId,
        submissionId: subId,
        submissionStatus,
        ungradedRemaining: totals.ungraded,
        totalScore: totals.total,
        maxScore: Number(sc.max),
        markedBy: markerEmail,
      };
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch (e2) {
        /* noop */
      }
      return { ok: false, error: String((e && e.message) || e) };
    } finally {
      client.release();
    }
  };
}

module.exports = { createApplyGrade };
