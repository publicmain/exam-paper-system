/**
 * 一周内容包里「学生肉眼能看到的文字」的指纹 —— 审查和发布两边用同一个函数。
 *
 * 2026-10-20 叶老师的硬规则：每周五备好下周内容后、部署之前，学生能看到的所有内容都要
 * 先审一遍。光靠记性不够，所以发布脚本要能认出两件事：这一周审过没有；审完之后内容
 * 有没有又改过。指纹就是为第二件事：标题、正文、题目每个字段、生词表每个字段，改一个字
 * 指纹就变，审核记录就作废。
 *
 *   weekly-visible-review.js   导出时把指纹写进 00-manifest；--approve 时写进
 *                              content/<week>/review-approval.json
 *   prepare-pilot-week.js      发布前重算，和 review-approval.json 对不上就拒绝发布
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');

const CONTENT_ROOT = path.join(__dirname, 'content');

/** 从 2026-10-26（第九周）起，发布前必须有审核记录。之前的周已经上线，不追溯。 */
const REVIEW_REQUIRED_FROM = '2026-10-26';

/** 键排好序再序列化，免得对象字段顺序变一下指纹就变。 */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/** 只取学生能看到的字段 —— 内部用的 source 之类不进指纹，改了不该让审核作废。 */
function visibleOf(levels) {
  return Object.keys(levels).sort().map((level) => ({
    level,
    days: levels[level].map((day) => ({
      date: day.date,
      title: day.title,
      passage: day.passage,
      questions: (day.questions || []).map((q) => ({
        taskType: q.taskType, questionType: q.questionType, marks: q.marks, stem: q.stem,
        options: q.options, answer: q.answer, accept: q.accept, explanation: q.explanation,
        rubric: q.rubric, evidence: q.evidence,
      })),
      words: (day.words || []).map((w) => ({
        headword: w.headword, surfaceForm: w.surfaceForm, phonetic: w.phonetic, pos: w.pos,
        translation: w.translation, definition: w.definition,
        context: w.context, contextTranslation: w.contextTranslation,
      })),
    })),
  }));
}

function loadWeek(week, root = CONTENT_ROOT) {
  const pack = require(path.join(root, week, 'index.js'));
  return pack.LEVELS || pack;
}

function weekFingerprint(week, root = CONTENT_ROOT) {
  return createHash('sha256').update(canonical(visibleOf(loadWeek(week, root))), 'utf8').digest('hex');
}

/** 哪个周目录的 dates.js 里有这一天。没有返回 null（旧的固定内容不在周目录里）。 */
function weekForDay(day, root = CONTENT_ROOT) {
  for (const dir of fs.readdirSync(root).filter((d) => /^week\d+$/.test(d))) {
    const datesFile = path.join(root, dir, 'dates.js');
    if (!fs.existsSync(datesFile)) continue;
    const { DATES } = require(datesFile);
    if (Array.isArray(DATES) && DATES.includes(day)) return dir;
  }
  return null;
}

function approvalPath(week, root = CONTENT_ROOT) {
  return path.join(root, week, 'review-approval.json');
}

/**
 * 发布前的检查：返回 null 表示可以发；否则返回一段说明为什么不能发的话。
 * 只读文件，不碰数据库。
 */
function reviewProblem(day, { root = CONTENT_ROOT } = {}) {
  if (day < REVIEW_REQUIRED_FROM) return null;
  const week = weekForDay(day, root);
  if (!week) return `${day} 不在任何周目录（content/weekN/dates.js）里，找不到对应的审核记录。`;
  const file = approvalPath(week, root);
  if (!fs.existsSync(file)) {
    return [
      `${week} 还没有审核记录（${path.relative(process.cwd(), file)}）。`,
      '按 2026-10-20 的硬规则，发布前要把学生能看到的所有文字审一遍：',
      `  1. railway run -s Postgres -e production -- node apps/api/scripts/pilot/weekly-visible-review.js --week=${week}`,
      '  2. 每份派一个 agent 逐字审，按结论改内容包，改完重新导出再审变了的部分',
      `  3. 全部过了：node apps/api/scripts/pilot/weekly-visible-review.js --week=${week} --no-db --approve`,
    ].join('\n');
  }
  const approval = JSON.parse(fs.readFileSync(file, 'utf8'));
  const now = weekFingerprint(week, root);
  if (approval.fingerprint !== now) {
    return [
      `${week} 审核之后内容又改过了 —— 审核记录里的指纹和现在的内容对不上。`,
      `  审核时：${String(approval.fingerprint).slice(0, 16)}…（${approval.approvedAt}）`,
      `  现在：  ${now.slice(0, 16)}…`,
      '改过的部分要重新导出、重新审，过了再 --approve。',
    ].join('\n');
  }
  return null;
}

module.exports = { REVIEW_REQUIRED_FROM, canonical, visibleOf, weekFingerprint, weekForDay, approvalPath, reviewProblem };
