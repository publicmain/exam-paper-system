# 周一上午 Dry-Run Checklist — Dan 老师

**日期**：周一 (2026-05-11) 上午 8:00 开始
**主持**：Dan 老师 + yao（在场协助）+ 1 个真班级 (建议 5–10 个学生，例如 G11 IELTS Test 班 TEST_MQ 抽 8 个)
**目标**：用真账号 / 真扫码 / 真 iPad 把 IELTS 7 件套和提交 / 老师看分一整条链路跑通，找出生产环境真实问题。
**总用时**：估计 60 分钟（45 分钟主流程 + 15 分钟收尾 + 容错时间）。

---

## 准备 (周日晚 / 周一早 7:30 之前)

| # | 谁 | 动作 | 通过 |
|---|---|---|---|
| P1 | Dan | 8 台 iPad 充电至 ≥ 60% | ☐ |
| P2 | Dan | 每台 iPad 装/打开 Chrome (Safari 也可，但 IELTS 拖分隔条在 Chrome 测过) | ☐ |
| P3 | Dan | 每台 iPad 关掉**自动锁屏**（设置 → 显示与亮度 → 自动锁定 → 永不） | ☐ |
| P4 | Dan | 每台 iPad **关后台屏蔽提示**（设置 → 通知 → 关掉 Chrome 推送让它静音） | ☐ |
| P5 | yao | 确认 Railway prod web + api **online**：浏览器打开 `https://nurturing-radiance-production.up.railway.app`、`https://exam-paper-system-production.up.railway.app/api/health` 都 200 | ☐ |
| P6 | yao | 把 8 个学生账号的 email + 名字打印一张表带到现场 (s001@esic.local … 那种) | ☐ |
| P7 | Dan | 校园 WiFi SSID + 密码核实（学生 iPad 必须连，IpAllowlistGuard 在校园 IP 白名单上才放行扫码） | ☐ |
| P8 | yao | 在自己电脑上**预留 Railway dashboard 标签页**和 **api/health** 标签页，便于宕机时快速判断 | ☐ |

**失败应对**：
- 如果 P5 的 health 不 200 → 立刻去 Railway 看 service 状态 + 看 Deploy logs；如果是 cold start，等 30s 重试
- 如果 P7 校园 WiFi 不工作 → **打住，今天不做** — 没有校园 IP 学生扫码会被 IpAllowlistGuard 403。改约
- 如果 iPad 数量不够 → 至少要有学生数的 iPad；这是已知前提（一人一 iPad）

---

## Phase 1 — 老师端 ⏰ 8:00–8:15

### Step 1.1 — Dan 登录 dashboard
| | |
|---|---|
| 时间 | 8:00 |
| 谁 | Dan 在自己电脑 |
| 动作 | 浏览器开 `https://nurturing-radiance-production.up.railway.app` → 用 Dan 账号登录 |
| 期望 | 跳到 Dashboard；header 看到 "Dan / teacher" badge；有 Practice / Papers / Questions / Templates / Classes / Marker / Stats / 🌅 Morning Quiz 等导航 |
| 失败 | 若被踢回 login → 检查账号是 teacher 还是 student；若是 student 立刻让 yao 在 Users 页改 role |

### Step 1.2 — Dashboard 今日待办卡片
| | |
|---|---|
| 期望 | 4 个待办格子：待复核卷子、待批改答题、连续缺勤、今日未签到。**连续缺勤数应该是真数据**（Round-10 修了算法 bug，原来 35 是误报） |
| 记录 | "连续缺勤" 数字 = ___ ；"今日未签到" 数字 = ___ |
| 失败 | 若仍显示 35 + 0 → Round-10 build 没部上去；让 yao 看 Railway Deploys |

### Step 1.3 — 看本周排课
| | |
|---|---|
| 动作 | 点 🌅 Morning Quiz → 选 5/11 那一周 |
| 期望 | 看到本周 5 张卷子，每行有 "大屏 QR / 立即激活 / 考勤 →" |
| 记录 | 今天 (5/11) 这一行的 paper name = ___ |
| 失败 | 若该行不存在 → 上周排课没生成，立刻点"一键生成下周 5 套早测"或临时手工建一张 |

### Step 1.4 — 看本周 paper 内容
| | |
|---|---|
| 动作 | 点今天 paper 行 → 跳到 PaperEdit |
| 期望 | 题目列表、每题 marks、合计 marks 与目标 marks 一致 |
| 记录 | 今天总分 = ___ marks；题数 = ___ |
| 失败 | 若题数为 0 → 这张卷子没生成完，**今天不要用** — 启用上周一张作为 fallback |

### Step 1.5 — QA Review 待审 (可选)
| | |
|---|---|
| 动作 | 进 Morning Quiz QA Review |
| 期望 | 26 张待审；每张可看 AI 摘要 / tokens / cost / 4 个动作按钮 |
| 注 | **今天不要点批准 / 驳回**——一会儿真用学生 |

---

## Phase 2 — 学生扫码登录 ⏰ 8:25–8:35

### Step 2.1 — 大屏 QR
| | |
|---|---|
| 时间 | 8:25 |
| 谁 | Dan |
| 动作 | 在 Schedule 页今天那行点"大屏 QR"按钮 → 投屏到教室大屏 |
| 期望 | 全屏 QR 显示；QR token 有 5 分钟 TTL（看右下角倒计时） |

### Step 2.2 — 学生连 WiFi
| | |
|---|---|
| 谁 | 8 个学生 |
| 动作 | iPad 设置 → WiFi → 选校园 SSID → 输密码 |
| 期望 | 连上、上网测试可达 (打开 baidu.com 或 school.local) |
| 失败 | 连不上 → 让 yao 检查校园 AP；个别 iPad 不行 → 暂用别的 iPad 替换 |

### Step 2.3 — 学生扫码
| | |
|---|---|
| 时间 | 8:30 |
| 动作 | 学生 iPad 打开 Chrome → 用 iPad 内置相机扫教室大屏的 QR → 自动跳到 `/scan/<token>` → 提示输 email → 输 s001@esic.local 等 → 提交 |
| 期望 | 跳到 `/morning-quiz/<sessionId>` 答题页 |
| 失败 1 | "not_on_school_wifi" 403 → 学生 iPad 没连校园 WiFi。重新连 |
| 失败 2 | "deviceUuid mismatch" → 这台 iPad 之前给别人扫过、现在被绑了。让 Dan 在 Admin → Users 页找该学生记录看 deviceUuid 字段，**没工具直接删** → 让 yao 跑 SQL `UPDATE "User" SET "deviceUuid"=NULL WHERE email='...'` |
| 失败 3 | "token expired" → 5 分钟 TTL 过了。Dan 重新点"大屏 QR" |
| 记录 | 8 个学生的扫码起止时间：从 ___:___ 到 ___:___ |

---

## Phase 3 — 学生答题 ⏰ 8:35–8:55

### Step 3.1 — IELTS 7 件套真按一遍 (如果是 IELTS 卷)
| 件套 | 动作 | 期望 |
|---|---|---|
| 1. 拖分隔条 | 学生用手指把中间分隔条左右拖动 | 题目 / 阅读 panel 实时跟手指走 |
| 2. 高亮 | 在阅读 panel 选一段文字 → 弹出菜单 → 点 "Highlight" | 该段被涂黄；reload 页后还在 (localStorage `mq:hl` 已验证) |
| 3. 便签 | 在阅读 panel 选一段 → 点 "Note" → 输文字 → 保存 | 便签出现在右侧 panel；reload 后还在 |
| 4. 标记复习 | 在题号导航条点某题旁的 ⚑ 标记 | 该题号变金黄；可一键跳过去 |
| 5. 题号导航 | 点导航条任意题号 | 阅读 + 题目滚到对应位置 |
| 6. 倒计时 | 看顶部倒计时是否在跑 (从答题分钟数往下) | 实时倒计时；快到 0 时变红 |
| 7. 字号 | 点字号 A− / A+ | 阅读 panel 字号变化；选择 (`mq:flags`) 持久 |

### Step 3.2 — O Level 题型 (如果是 O Level 卷)
| 题型 | 动作 | 期望 |
|---|---|---|
| Cloze (Tab 跳空) | 在 Cloze 题里输第一个空 → 按 Tab | 焦点跳到下一个空 |
| Vocab in Context | 看完整句子上下文 → 选 4 个选项之一 | 选项可点；选中变蓝 |
| Sentence Transformation | 输改写句 | 字数实时统计；超 N 字变红 |

### Step 3.3 — F12 真验证 (yao 偷偷做)
| | |
|---|---|
| 谁 | yao 在自己电脑 |
| 动作 | 用 admin 账号登录学生的 session（or Hardcode 学生 token），打开 DevTools → Network → 看 `/api/morning-quiz/sessions/<id>` 的 response body |
| 期望 | response 里**没有** `correct` / `markScheme` / `answerContent` 三个字段（E14 redaction） |
| 失败 | 如果真出现 → **立刻 yao 紧急 patch + redeploy**，否则学生 F12 看到答案 |

### Step 3.4 — iPad 横竖屏切换
| | |
|---|---|
| 谁 | 抽 1 个学生测试 |
| 动作 | iPad 转 90 度 (横→竖 or 竖→横) |
| 期望 | 答题界面 layout 重排不崩；竖屏走 fallback (single-pane 切换) 不丢答案 |
| 失败 | 若切屏后题目消失 → 记录哪题、什么操作前后；之后 yao 修 |

---

## Phase 4 — 提交 ⏰ 8:55–9:00

### Step 4.1 — 学生交卷
| | |
|---|---|
| 时间 | 8:55 |
| 动作 | 8 个学生点 "交卷" 按钮 |
| 期望 | 跳到 `/student/result/<sessionId>` 结果页；看到 score / 题目对错 |

### Step 4.2 — 双击防重
| | |
|---|---|
| 动作 | 抽 1 个学生**双击**交卷按钮 |
| 期望 | 不重复提交；按钮 disable；result 只产生一份 (E16 idempotency) |

### Step 4.3 — 9:00 自动锁卷
| | |
|---|---|
| 时间 | 9:00 |
| 动作 | 让 1 个学生**故意不交**到 9:00 |
| 期望 | 9:00 整 cron 把 session status 改 closed；该学生再点提交时 server 拒绝 (window_closed) |
| 记录 | 实际锁卷时间 = ___:___:___（≈ 9:00:00 ± 1 分钟） |

---

## Phase 5 — 老师看结果 ⏰ 9:00–9:15

### Step 5.1 — 看 session dashboard (Round-10 新页)
| | |
|---|---|
| 谁 | Dan |
| 动作 | 浏览器输 `https://.../morning-quiz/sessions/<sessionId>/dashboard` (或从 Schedule 页点跳，如果今天加了链接) |
| 期望 | 看到本 session 实时面板：按时 / 迟到 / 缺勤 / 已交卷 4 个数；学生明细表 (姓名 / 状态 / 已交 / 分数 / 提交时间) |
| 失败 | 若 404 / 跳回 Dashboard → Round-10 build 没部上去 |

### Step 5.2 — 导出 Excel
| | |
|---|---|
| 动作 | 进 Schedule → 选今天 + 本周 → 点"导出 Excel" |
| 期望 | 下载 .xlsx ≈ 5–20 KB；3 个 sheet (考勤明细 / 成绩明细 / 缺勤汇总) |
| 验证 | **真用 Excel 打开**确认能看到 8 个学生 |
| 失败 | 若文件 0 字节 / 下载失败 → 看 Network 面板 status；若 200 但 0 字节，可能是 stream 中断 → 重试一次 |

### Step 5.3 — Marker 队列 (短答 / 结构题需要批改)
| | |
|---|---|
| 动作 | 进 Marker → 看待批列表 |
| 期望 | 出现今天卷子里的 short_answer / structured 答题；MCQ 不在 (auto-graded) |
| 注 | **今天 dry-run 不真批**——快速看一眼有没有就行 |

### Step 5.4 — Ctrl+K 命令面板 (Round-10 新)
| | |
|---|---|
| 动作 | Dan 在任意页按 Ctrl+K (Mac 是 Cmd+K) |
| 期望 | 弹出搜索框；输 "marker" 出现 Marker queue；按 Enter 跳过去 |
| 失败 | 若按 Ctrl+K 无反应 → 可能浏览器把它截了 (大多浏览器 Ctrl+K 默认= 搜索栏)；试在已登录的 dashboard 页面，在文本框外面按 |

---

## Phase 6 — 紧急 fallback ⏰ 任何时候

### Fallback A — iPad 全坏 / 网炸
| | |
|---|---|
| 动作 | Dan 让学生用纸+笔做。Dan 直接在 Schedule 页点导出"PDF 备用版" (如果有的话；若没有，直接打开 Paper 页用浏览器打印 PDF) |
| 之后 | 学生答完后由 Dan 手工录入分数 (Marker 页 → 进 submission → 改分) |

### Fallback B — Railway prod 宕
| | |
|---|---|
| 动作 | yao 立刻看 Railway dashboard → 重启 service；若 ≥ 5 min 不恢复，今天作废，按 Fallback A 走纸笔 |
| 报告 | yao 在 Railway dashboard 截图 + status code，发企业微信群 |

### Fallback C — 单台 iPad 挂
| | |
|---|---|
| 动作 | 拿备用 iPad 替换；若学生已经扫过码，新 iPad 上扫的同 token 会被 deviceUuid 拒绝 → 让 yao 跑 SQL 清 deviceUuid |

---

## Phase 7 — Bug 上报模板 (任何 bug 出现都用这个填)

```
【时间戳】2026-05-11 08:43
【哪个学生 / 哪台 iPad】s003@esic.local / iPad #4
【哪步 (引 Phase + Step)】Phase 3 Step 3.1 - 拖分隔条
【期望】分隔条跟手指走
【实际】分隔条卡在 50% 不动，松手后又自动回到 50%
【截图】[拍 iPad 屏 + DevTools console (yao 帮忙抓)]
【其他线索】Chrome 124, iPad Air 4
```

发到：**企业微信【晨测系统群】 / 飞书 yao 频道**

---

## 收尾 ⏰ 9:15–9:30

| # | 动作 |
|---|---|
| C1 | Dan 关掉今天的 session (Schedule 页应该已经自动 closed)，确认 status = closed |
| C2 | yao 备份 prod 数据库 (Railway → Snapshots → Create) |
| C3 | Dan + yao 当面 debrief 5 分钟：哪些 work / 哪些 broken / Bug 列表是否齐全 |
| C4 | yao 把 bug 列表整理成 issue 列表，明天上午开始修 |

---

## 已知风险 / 接受清单

- **Pdf-worker 50 条 warning**：尚未排查；**今天不影响主流程**因为今天不导出 PDF (用 Excel)
- **Tailwind 部分页面响应式 polish 未完成**：Round-10 已修关键页 (Dashboard / QuickPaper / QA Review / Classes modal)，其他页 iPad 横屏可能仍有小排版问题——记录但不阻塞
- **Ctrl+K 是新功能**：本次 dry-run 顺便回归测；如果不能用记录但不阻塞主流程
- **Round-10 build 是否部上 Railway**：周一上午前 yao 必须确认 deploy 完成（看 Railway Deploys 页面，最新 commit hash 要等于 `git log -1` 的）

---

## Verification — yao 周日晚必须做完

| # | 动作 | 通过 |
|---|---|---|
| V1 | git push origin/main 完成 | ☐ |
| V2 | Railway api 自动部署完成 (`/api/health` 显示新 commit hash) | ☐ |
| V3 | Railway web 自动部署完成 (打开主页 view-source 看 bundle hash 变了) | ☐ |
| V4 | 手动测一遍 Ctrl+K 在 prod 弹出来 | ☐ |
| V5 | 手动测一遍 `/morning-quiz/sessions/<任一过期 session id>/dashboard` 至少能跳到该页（不是回 `/`） | ☐ |
| V6 | 手动测一遍 Class detail modal 按 ESC 关掉 + 看到 weeklyFocus textarea | ☐ |
| V7 | 调 `/api/teacher/todo/today` 看 consecutiveAbsentStudents 数字（应该 0 或与 `/api/morning-quiz/absence-alerts/current.streaks.length` 一致，不是原来的 35） | ☐ |
