# IELTS PDF → 题库自动导入 工作流

**触发条件**：用户在任何对话里说 "导入 IELTS PDF"、"传一个剑桥雅思 PDF"、"解析这本剑 X"、或直接给一个剑桥 IELTS PDF 文件路径。

**Claude 默认动作**：按本文档流程做，不需要再询问 schema。

---

## 一句话原理

不写规则解析器。**Claude 当解析器**：用 PyMuPDF 抽 PDF 文字，把每个 Reading Passage 的 passage / 题 / 答案整理成结构化 JSON，POST 到 `/api/ielts-ingest/passage`。重复 POST 是 idempotent 的（按 sourceRef 去重）。

---

## 1. 入手前的检查清单

| 检查 | 动作 |
|---|---|
| 本地 API 是否在跑？ | `curl -sf http://localhost:4000/api/health` 不通 → `cd apps/api && nohup node dist/main.js > /tmp/exam-api.log 2>&1 &` |
| 本地 .env 有 `ANTHROPIC_API_KEY` 之外有什么需要？ | 不需要额外 env — ingest 不调 LLM；Claude 自己当解析器 |
| Python + PyMuPDF 装了吗？ | `python -c "import fitz; print(fitz.__doc__[:50])"` 应该有版本号 |
| 用户的 PDF 在哪？ | 默认 Windows 路径在 `D:\BaiduNetdiskDownload\剑X真题&听力\剑X真题&听力\` 下；Chinese filename 可能 mojibake，用 `Get-ChildItem -LiteralPath` 列 |

---

## 2. 复制 PDF 到 worktree

```powershell
# 找 PDF (大 PDF 通常是真题, 小 PDF 通常是听力, > 50MB 的常常是中文精讲不要)
Get-ChildItem -LiteralPath '<下载目录>' -Recurse -Filter *.pdf | Where-Object {$_.Length -gt 5MB -and $_.Length -lt 30MB}
# 复制
Copy-Item -LiteralPath <src.pdf> -Destination 'apps/api/test-fixtures/cambridge-ielts-<N>.pdf' -Force
```

---

## 3. 找页码

剑桥 IELTS 系列固定结构：
- 前面：Contents (p2)、Introduction、Test 1 (Listening + Reading + Writing)、Test 2、…
- 末尾：Tapescripts → **Listening and Reading Answer Keys** → Sample Answers → Acknowledgements

用 `extract_page.py` 看 Contents 拿到每个 Test 起始页 + Answer Keys 起始页。

```bash
cd apps/api/test-fixtures && python extract_page.py 2 2   # contents
cd apps/api/test-fixtures && python extract_page.py 17 22 # 找 Test 1 Reading
cd apps/api/test-fixtures && python extract_page.py 152 154 # answer keys
```

剑 8 实际页码（参考）：
- Test 1 Reading: p17-32
- Test 2 Reading: p40-55
- Test 3 Reading: p63-79
- Test 4 Reading: p88-103
- Answer Keys: p152

每个 Test 3 个 Reading Passage，每 Passage ~13 题，共 **12 passages × ~13 题 = ~156 题/书**。

---

## 4. 提取 + 拼 JSON

每个 passage 一个 JSON 文件，命名 `camb<N>-test<T>-passage<P>.json`，放在 `apps/api/test-fixtures/`。

Schema（zod 在 `apps/api/src/ielts-ingest/ielts-ingest.controller.ts`）：

```jsonc
{
  "bookCode": "cambridge_ielts_8",         // 整本书一个 code, 影响 sourceRef + provenanceTag
  "testNumber": 1,                          // 1-4
  "passageNumber": 1,                       // 1-3
  "passage": {
    "title": "<原文导读句 / 标题>",
    "body": "A ...\n\nB ...\n\nC ..."     // 段落用 A/B/C 开头, \n\n 隔
  },
  "questions": [
    // 13 道题, schema 详见 controller
  ]
}
```

**questionType 与 taskType 的对照**（决定 short_answer 还是 mcq）：

| IELTS taskType | Claude 通常归类为 | 答案形态 |
|---|---|---|
| matching_information | short_answer | 段落字母 A-H |
| matching_headings | short_answer | 罗马数字 i-x |
| matching_features | mcq（带固定选项 list） | 选项 key |
| multiple_choice | mcq | A/B/C/D |
| true_false_not_given | mcq（3 选项 TRUE/FALSE/NOT GIVEN） | A/B/C |
| yes_no_not_given | mcq（3 选项 YES/NO/NOT GIVEN） | A/B/C |
| sentence_completion | short_answer | 1-3 个单词 |
| summary_completion | short_answer | 1-3 个单词 |
| diagram_label_completion | short_answer | 1-2 个单词 |
| flow_chart_completion | short_answer | 1-2 个单词 |
| table_completion | short_answer | 1-2 个单词 |
| note_completion | short_answer | 1-2 个单词 |

**答案 key 处理**：
- 答案带括号备选（"(ship's) anchor / (an/the) anchor"）→ 取核心词（"anchor"）。autoGradeScripts normalize 已做大小写 / trim / 末尾标点容错
- 答案是数字 → 字符串形式（"5" 而不是 5）
- 答案带 `/` 表示多个等效答案 → **当前 schema 只支持一个**，挑最常见 / 最短的；将来可扩展 array

---

## 5. POST 到 API

```bash
TOKEN=$(curl -sS -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@school.local","password":"admin123"}' \
  | sed 's/.*"token":"\([^"]*\)".*/\1/')

for f in apps/api/test-fixtures/camb8-test*.json; do
  echo "=== $f ==="
  curl -sS -X POST http://localhost:4000/api/ielts-ingest/passage \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data @"$f"
  echo
done
```

返回 `{sourceRefPrefix, created, skipped, questionIds}`。`created + skipped == 13` 就是成功（重跑不重复）。

---

## 6. 验证

```bash
cd apps/api && node -e '
const{PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
p.question.count({where:{sourceRef:{startsWith:"IELTS/cambridge_ielts_8"}}})
  .then(c=>{console.log("imported:",c);return p.$disconnect()})'
```

也可以登录 admin 进 web `Questions` 页搜索 "IELTS/cambridge_ielts_8"，每道题点开看 stem + 答案。

---

## 7. Morning Quiz 自动 pickup

入库后**不用再做任何配置**。`morning-quiz.service.pickPassageAndCreatePaper` 的 sourceRef 正则 `^([^/]+\/[^/]+\/Test\d+\/P\d+)\/` 会自动把每个新 passage 当作一个 pool unit；下次 schedule "一键生成下周 5 套" 时会从扩大后的 pool 里挑没用过的。

---

## 8. 错了怎么办

如果某 passage 的 JSON 出错（答案错 / stem 错），删掉那 13 道题再 re-ingest：

```bash
cd apps/api && node -e '
const{PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
p.question.deleteMany({where:{sourceRef:{startsWith:"IELTS/cambridge_ielts_8/Test1/P1"}}})
  .then(r=>{console.log("deleted:",r.count);return p.$disconnect()})'
```

然后重新 POST 那个 JSON。

---

## 9. 整本书估时

- 抽 PDF 文字 + 找页码：5 分钟
- 写 12 个 JSON 文件（每个 ~13 题）：每 passage 5-10 分钟，全本约 1-2 小时
- POST + 验证：5 分钟
- **总计：2-3 小时一本剑桥 IELTS**

如果 Claude 在一个 session 里跑（用户开 plus 模式或 long context）能一口气搞完一本。

---

## 10. 已知坑

| 坑 | 应对 |
|---|---|
| PyMuPDF 列文字时表格 / 流程图位置乱（diagram_label 题位置在图里） | 看 stem 时如果发现 "/9/..." 这种占位符, 答案直接照 Answer Keys 写, stem 用 "/9/" 这种简化 placeholder, 学生看不懂图就只看 instruction |
| matching_headings 共享一个 List of Headings | 把 list 塞到每道题的 instruction 里 (重复); 简单可靠 |
| 答案 key 列被 PyMuPDF 切乱（剑 8 答案 key 是 4 列布局） | 先 print 整页, 用罗马数字 / 字母规则人肉切片; 或者多读几页对照确认 |
| Question 13+ 但 Answer key 不止 13 个 (Reading 总共 40 道题分 3 篇) | 每 passage 单独切 13 (或 14) 个答案; 不要全 40 一锅烩 |
| Listening 答案也在同一个 Answer Keys 区 | 跳过 — 我们只做 Reading |
