'use strict';
/**
 * Pure, DB-free grading constraints shared by applyGrade() in server.js.
 *
 * 审计 S05（2026-09-11）—— `/api/grade` 之前只检查 awardedMarks 落在
 * 0..max 之间和"这题是不是已经判过"，没有校验班级归属 / 提交状态 / 题型 /
 * 认领，还用"库里最早创建的管理员"顶替真实操作人，返回的 `marked` 也可能
 * 跟实际状态不一致（并发时的 fallback 分支盲写）。
 *
 * 这里把与正式判分服务（apps/api/src/marker/marker.service.ts 的
 * scoreScript / finalize）同一套业务规则抽成纯函数 —— 不是另造一套更松的
 * 规则，只是同样的检查换一个没有 Nest/Prisma 的运行时。全部函数不碰
 * 数据库，可以离线单测；server.js 的 applyGrade() 只做 I/O 和把这些函数
 * 串起来。
 */

/** 需要人工判分的题型 —— 与 marker.service.ts 的 STRUCTURED_TYPES 一致。 */
const STRUCTURED_TYPES = ['structured', 'short_answer', 'essay'];

/** 允许持有判分权限的角色 —— 与 canActOnClass / marker 路由的角色门一致。 */
const GRADER_ROLES = ['admin', 'head_teacher', 'teacher'];

/**
 * 是否"看起来在生产跑" —— Railway 会自动注入 RAILWAY_* 环境变量（不管
 * 具体 environment 名叫什么），本地 `node server.js` 开发不会有这些变量。
 * 用这个而不是死认 NODE_ENV===production，因为这个服务的 railway.json
 * 没有显式设置 NODE_ENV。
 */
function isProductionLike(env) {
  return Boolean(
    env.NODE_ENV === 'production' || env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID,
  );
}

/**
 * 生产环境必须配 ACCESS_KEY，否则拒绝启动（而不是像旧版 `gate()` 那样
 * 在没配 key 时对所有人放行）。本地开发保留"没配 key 就不设防"的便利。
 */
function assertAccessKeyConfigured(env) {
  if (isProductionLike(env) && !env.ACCESS_KEY) {
    return {
      ok: false,
      error:
        'ACCESS_KEY is required when running in production (Railway) — refusing to start an unauthenticated ops console.',
    };
  }
  return { ok: true };
}

function checkClassOwnership(actualClassId, expectedClassId) {
  if (actualClassId !== expectedClassId) {
    return {
      ok: false,
      error: `submission belongs to class ${actualClassId}, not the configured class ${expectedClassId}`,
    };
  }
  return { ok: true };
}

function checkSubmissionGradable(status) {
  if (status !== 'submitted') {
    return { ok: false, error: `submission status=${status}; can only grade 'submitted' submissions` };
  }
  return { ok: true };
}

function checkNotMcq(questionType) {
  if (questionType === 'mcq') {
    return { ok: false, error: 'MCQ scripts are auto-graded; cannot manually score' };
  }
  return { ok: true };
}

function checkAwardedMarksRange(awardedMarks, maxMarks) {
  const am = Number(awardedMarks);
  if (!Number.isFinite(am) || am < 0 || am > maxMarks) {
    return { ok: false, error: `awardedMarks must be 0..${maxMarks}` };
  }
  return { ok: true, value: am };
}

/**
 * 认领校验 —— `claim` 是 `{ markerId, status }` 或 null/undefined。
 * 只挡"别人正在网页判分界面批这一份"；没人认领，或认领人正是这次要落到
 * markedById 的那个人，都放行 —— 同一个老师用聊天判分补写自己已认领的
 * 答卷，不该被自己挡住。
 */
function checkClaimNotHeldByOther(claim, resolvedMarkerId) {
  if (claim && claim.status === 'active' && claim.markerId !== resolvedMarkerId) {
    return {
      ok: false,
      error: `submission is actively claimed by another marker (${claim.markerId}) in the marking UI`,
    };
  }
  return { ok: true };
}

/**
 * 判分人必须是真实存在、启用中、有判分权限角色的账号 —— 不能拿"库里最早
 * 创建的管理员"顶替，那样每一条 ops 判分记录都会写成同一个人，审计追不到
 * 谁真正做了这个操作。
 */
function checkMarkerAccount(user) {
  if (!user) return { ok: false, error: 'unknown markerEmail — no such user' };
  if (user.isActive === false) return { ok: false, error: `marker account ${user.email} is deactivated` };
  if (!GRADER_ROLES.includes(user.role)) {
    return { ok: false, error: `marker account ${user.email} has role=${user.role}, cannot grade` };
  }
  return { ok: true };
}

/**
 * 由一份答卷的全部 AnswerScript 明细算出 auto / manual / total —— 与
 * marker.service.ts#finalize 同一套口径：mcq 和"没有 markedById 的主观题"
 * 算自动分，"有 markedById 的主观题"算人工分，避免自动判分和人工覆写
 * 重复计分（那正是 2026-05-25 那次的回归根因）。
 *
 * `scripts` 每项：`{ qtype, awarded, markedById }`。
 */
function computeSubmissionTotals(scripts) {
  let mcq = 0;
  let auto = 0;
  let manual = 0;
  let ungraded = 0;
  for (const s of scripts) {
    if (s.qtype === 'mcq') {
      mcq += Number(s.awarded) || 0;
      continue;
    }
    if (s.awarded == null) {
      ungraded += 1;
      continue;
    }
    if (s.markedById != null) manual += Number(s.awarded);
    else auto += Number(s.awarded);
  }
  auto += mcq;
  return { auto, manual, total: auto + manual, ungraded };
}

module.exports = {
  STRUCTURED_TYPES,
  GRADER_ROLES,
  isProductionLike,
  assertAccessKeyConfigured,
  checkClassOwnership,
  checkSubmissionGradable,
  checkNotMcq,
  checkAwardedMarksRange,
  checkClaimNotHeldByOther,
  checkMarkerAccount,
  computeSubmissionTotals,
};
