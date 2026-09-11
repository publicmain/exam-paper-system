# 整改台账 · 2026-09-11 审计与 iOS / iPadOS 重造

依据：`docs/CLAUDE-AUDIT-AND-IOS-REBUILD-PROMPT-2026-09-11.md`（全文 690 行，2026-09-11 读完）。

## 基线（开工前，未改任何代码）

| 项 | 结果 |
|---|---|
| HEAD | `6f85e6d`（分支 `audit-ios-rebuild-2026-09-11` 从这里切出） |
| 生产 API `/api/health` | commit `6f85e6d`，db up |
| 生产学生端 / 教师端 | 200；学生端包是手动 `railway up`，bundle 哈希含构建期变量，无法反推提交号 |
| API 测试 | 134 文件 3020 / 3020 通过 |
| 学生端测试 | 40 文件 908 / 908 通过（三端并行跑时有 36 条 5 秒超时，单独跑全过） |
| 教师端测试 | 38 文件 251 / 251 通过（同上，并行时 8 条超时） |
| 三端 typecheck / build | 全部 rc=0 |
| 隔离数据库 | Docker Desktop 本机启动失败（`AppData\Local\Docker\run` 建不出来，五月起就有 `run.broken-*` 备份，属本机既有问题，未动）；改用不依赖 Docker 的方案 |

原始输出在 `.local/audit/baseline/`（gitignored）。

## 状态词

待复现 / 已确认 / 已修复待验证 / 已验证 / 已有修复 / 需要明确决定 / 外部阻塞

## 分工

| 区域 | 条目 | 分支 | 明细 |
|---|---|---|---|
| 身份与安全 | S01–S04 S06–S08 · UI07 后端 | `audit/sec` | `ledger-sec.md` |
| 词汇后端 | VOC01–VOC15 后端 · UI01 · T01 · UI03 后端 | `audit/vocab` | `ledger-vocab.md` |
| 判分与教师端 | M01–M04 · T02 · UI06 · S05 · IOS-10 | `audit/marker` | `ledger-marker.md` |
| 发布、内容、运维 | PUB01–PUB03 · CONTENT01 · OPS01–OPS07 | `audit/pub` | `ledger-pub.md` |
| 学生端与设计系统 | IOS-01–IOS-09 IOS-11 IOS-12 · UI02 UI04 UI05 UI08–UI15 · 各 VOC 前端部分 | 主分支 | `ledger-student.md` |

各区域合并后，本表下方汇总最终结论。
