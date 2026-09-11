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

---

## 最终汇总（2026-09-11，分支 `audit-ios-rebuild-2026-09-11`）

状态说明：**已验证** = 修复 + 自动化测试（多数附修前红）；**已修复待验证** = 代码与测试都在，但缺一类本机做不了的验证
（写明是哪类）；**待授权** = 方案 / dry-run 已备好，执行需要你在当前对话明确同意；**外部** = 需要账号、设备或权限。
各条的修复位置、测试、修前红与剩余依赖在对应分台账里。

### 5.1 安全与身份

| ID | 状态 | 分台账 | 备注 |
|---|---|---|---|
| S01 | 已验证 | sec | 答题 / 恢复 / 详情按状态白名单 |
| S02 | 已验证 | sec；student（合并收尾） | 历史接口只认令牌；四类旧接口改走 authStudentId（dc90f73）；通知链接不再带姓名（8c751e7） |
| S03 | 已验证（教职工令牌一处剩余依赖） | sec | 教职工登录签发的令牌尚未带版本号 —— 「停用后恢复」「重置密码」对**教职工**旧令牌不立即失效；不在本次学生端范围 |
| S04 | 已验证；**存量数据修复待授权** | sec | 旧版前缀停用账号的 SQL 修复是 dry-run |
| S05 | 已验证 | marker | 运维判分入口补正式约束与真实操作人 |
| S06 | 已验证 | sec；student | 合并后补 3 处（cancel / audio / english-level）按学生分桶 |
| S07 | 已验证 | sec | |
| S08 | 已验证 | sec；vocab；student | 隐式写库 GET 清单已清空（词汇 profile / overview 纯读；答题页 `shuffle.peek`） |

### 5.2 学生端（UI）

| ID | 状态 | 分台账 |
|---|---|---|
| UI01 | 已修复待验证（内存假库；真实 Postgres 未验）；**迁移需随部署执行** | vocab；student（花名册改档也记录） |
| UI02 UI04 UI05 UI08–UI15 | 已验证 | student |
| UI03 | 已验证（后端游标 + 前端加载更多，31/65/500 词） | vocab；student |
| UI06 | 已验证 | marker |
| UI07 | 已验证（后端 + 前端） | sec；student |

### 5.3 词汇（VOC）

| ID | 状态 | 备注 |
|---|---|---|
| VOC01 VOC02 VOC07 | 已修复待验证 | 并发 / 行锁只在内存假库近似，**需隔离 Postgres 验证**（本机 Docker 起不来） |
| VOC14 | 已修复待验证 | 条件更新依赖 Prisma extendedWhereUnique，需真实库验证 |
| VOC03 VOC04 VOC05 VOC06 VOC08 VOC09 VOC10 VOC11 VOC12 VOC13 VOC15 | 已验证（服务层内存假库 + 前端接通） | VOC05 前端带 sourceRef（16f6c3c）；VOC15 阅读查词侧对齐（e56a26e） |

### 5.4 判分与教师统计

| ID | 状态 | 分台账 |
|---|---|---|
| M01–M04 | 已验证 | marker |
| T01 | 已修复待验证（后端，同 UI01）；教师表已接新口径 | vocab；student（9fae1c2） |
| T02 | 已验证 | marker |

### 5.5 发布、内容、运维

| ID | 状态 | 分台账 |
|---|---|---|
| PUB01–PUB03 | 已验证 | pub |
| CONTENT01 | 内容已订正；**生产冻结快照文字订正待授权**（dry-run 脚本已备，不影响任何分数） | pub |
| OPS01 | 仓库内已修复；分支保护 / 「CI 通过才部署」**外部** | pub |
| OPS02 | 只读复核完成；`npm audit fix` 与 overrides **外部**（需可装依赖的环境） | pub |
| OPS03 | 巡检脚本已加；Sentry DSN / 告警接收方**待你决定** | pub |
| OPS04 | 缺口已核清：09-16 起没有内容 | pub |
| OPS05 | 方案已写；备份恢复演练、压测环境、真机**外部** | pub |
| OPS06 | 只读核对完成，未发现 staging 泄漏 | pub |
| OPS07 | 全量回归基线已重建；本文末有最终数字 | pub；本表 |

### iOS / iPadOS 重造

| ID | 状态 |
|---|---|
| IOS-01 – IOS-09、IOS-11 | 已验证（见 `ledger-student.md`） |
| IOS-10 | 已验证（判分队列、逐题判分、班级统计、词表页、词汇进度表） |
| IOS-12 | 视口矩阵与构建体积已测；**真机待验**（iPhone Safari / PWA、iPad 分屏、软键盘、放大字体、Android） |

设计系统说明：`design-system.md`（HIG / WCAG 依据、token、组件、文案规则、验证方法）。

## 最终验证（本机，2026-09-11）

| 项 | 结果 | 原始输出 |
|---|---|---|
| API 测试 | 171 文件：3525 通过 / 9 跳过（基线 134 文件 3020） | `.local/audit/final/test-all.txt` |
| 教师端测试 | 44 文件 295 / 295（基线 251） | 同上 |
| 学生端测试 | 46 文件 1044 / 1044（基线 908） | 同上 |
| 三端 typecheck | 通过 | `.local/audit/final/typecheck.txt` |
| 三端构建 | 通过；学生端首包 JS 501.84 kB / gzip 163.34 kB（基线 140.94），CSS gzip 8.58 kB | `.local/audit/final/build.txt` |
| ops-dashboard 语法检查 | 通过 | `.local/audit/final/check-scripts.txt` |
| 生产 `/api/health`（只读） | commit `6f85e6d` —— **本次没有推送、没有部署** | — |

截图矩阵与改前改后对照：见 `ledger-student.md` 的 IOS-12 与 `.local/audit/compare/index.html`。
