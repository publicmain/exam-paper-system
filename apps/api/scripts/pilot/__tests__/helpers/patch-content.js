/**
 * 集成测试用：在发布脚本加载内容包**之前**，按 `PILOT_PATCH` 改掉某一题。
 *
 *   NODE_OPTIONS=--require <本文件> PILOT_PATCH='{"level":"olevel","date":"2026-09-15","q":0,"stem":"…"}'
 *
 * 模拟「内容包在发布之后又被改过」—— 发布脚本 require('./content') 拿到的
 * 是同一个模块缓存，所以这里改的就是它看到的。只在测试子进程里生效。
 */
'use strict';

const path = require('path');

const raw = process.env.PILOT_PATCH;
if (raw) {
  const patch = JSON.parse(raw);
  const content = require(path.resolve(__dirname, '..', '..', 'content'));
  const day = content.lessonFor(patch.level, patch.date);
  if (!day) throw new Error(`patch-content：没有 ${patch.level}/${patch.date}`);
  const q = day.questions[patch.q];
  if (patch.stem != null) q.stem = patch.stem;
  if (patch.marks != null) q.marks = patch.marks;
  if (patch.rubric != null) q.rubric = patch.rubric;
}
