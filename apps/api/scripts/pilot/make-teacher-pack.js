/**
 * 从内容包生成**教师用的答案与批改手册**。
 *
 * 手动维护一份答案表，一定会和真正落库的那份漂移 —— 而漂移的后果是老师
 * 照着错答案批学生的卷子。所以它由内容包生成，改内容就重新生成一次：
 *
 * ```bash
 * node apps/api/scripts/pilot/make-teacher-pack.js > docs/pilot/s12m-teacher-pack.md
 * ```
 */
'use strict';
const c = require('./content');

const LEVEL_LABEL = {
  olevel: 'O-Level',
  ielts_simplified: 'O-Level 基础（ielts_simplified）',
  ielts_authentic: 'IELTS（ielts_authentic）',
};
const TASK_LABEL = {
  true_false_not_given: '判断题',
  matching_features: '特征配对',
  multiple_choice: '选择题',
  sentence_completion: '完成句子',
  summary_completion: '摘要填空',
  short_answer: '简答题',
};

const out = [];
const w = (s = '') => out.push(s);

w('# 试点第一周 —— 教师答案与批改手册');
w();
w('> **生成文件，不要手改。** 来源是 `apps/api/scripts/pilot/content/`，');
w('> 改完内容跑一次 `node apps/api/scripts/pilot/make-teacher-pack.js` 重新生成。');
w('>');
w('> **不要把这份文件发给学生。** 客观题的答案在他交卷之后才由服务端下发，');
w('> 主观题的参考答案与评分标准从来不下发给学生端。');
w();
w('## 每天要批多少');
w();
w('| 项 | 数 |');
w('| --- | --- |');
w(`| 每天题数 | ${c.QUESTIONS_PER_DAY} |`);
w(`| 其中**服务端当场判**（客观题） | ${c.MIN_AUTO_PER_DAY} |`);
w(`| 其中**要老师批**（主观题） | ${c.MAX_HUMAN_PER_DAY} |`);
w(`| 每天目标词 | ${c.WORDS_PER_DAY} |`);
w('| 每个学生每天的批改量 | **4 题** |');
w('| 10 个学生的每日批改量 | **40 题**（估 15–20 分钟） |');
w();
w('批改入口：`/api/marker/*` 的判分队列。**不要用 AI 判分** —— 本项目零 Anthropic API 调用。');
w();

for (const date of c.DATES) {
  w('---');
  w();
  w(`# ${date}`);
  w();
  for (const level of Object.keys(c.LEVELS)) {
    const d = c.lessonFor(level, date);
    if (!d) continue;
    const total = d.questions.reduce((a, q) => a + q.marks, 0);
    w(`## ${LEVEL_LABEL[level] ?? level} —— 《${d.title}》`);
    w();
    w(`满分 ${total} 分 · 十题 · 目标词 ${d.words.length} 个`);
    w();
    w('### 客观题（服务端当场判，老师不用管）');
    w();
    w('| # | 题型 | 答案 | 依据 |');
    w('| --- | --- | --- | --- |');
    d.questions.forEach((q, i) => {
      if (q.questionType !== 'mcq') return;
      const opt = (q.options || []).find((o) => o.key === q.answer);
      const ev = q.evidence ? q.evidence.replace(/\|/g, '\|').slice(0, 70) : '（NOT GIVEN：原文没说）';
      w(`| ${i + 1} | ${TASK_LABEL[q.taskType] ?? q.taskType} | **${q.answer}** ${opt ? `（${opt.text}）` : ''} | ${ev} |`);
    });
    w();
    w('### 主观题（**这四题要你批**）');
    w();
    d.questions.forEach((q, i) => {
      if (q.questionType !== 'short_answer') return;
      w(`#### 第 ${i + 1} 题 · ${TASK_LABEL[q.taskType] ?? q.taskType} · ${q.marks} 分`);
      w();
      w('> ' + q.stem.split('\n').join('\n> '));
      w();
      w(`- **参考答案**：${q.answer}`);
      if (q.accept) w(`- **也算对**：${q.accept.join(' / ')}`);
      w(`- **评分标准**：${q.rubric}`);
      if (q.evidence) w(`- **原文依据**：${q.evidence}`);
      w(`- **为什么**：${q.explanation}`);
      w();
    });
    w('### 当天目标词');
    w();
    w('| # | 词 | 文中形态 | 音标 | 词性 | 释义 |');
    w('| --- | --- | --- | --- | --- | --- |');
    d.words.forEach((x, i) => {
      w(`| ${i + 1} | ${x.headword} | ${x.surfaceForm} | ${x.phonetic} | ${x.pos} | ${x.translation} |`);
    });
    w();
  }
}

w('---');
w();
w('## 原文（学生也看得到，这里只是方便你对照）');
w();
for (const date of c.DATES) {
  for (const level of Object.keys(c.LEVELS)) {
    const d = c.lessonFor(level, date);
    if (!d) continue;
    w(`### ${date} · ${LEVEL_LABEL[level] ?? level} · 《${d.title}》`);
    w();
    for (const para of d.passage.split('\n\n')) w(para + '\n');
  }
}

process.stdout.write(out.join('\n'));
