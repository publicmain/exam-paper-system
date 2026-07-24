# PRD — 作业模块 v2.0「对标满分」

> 目标：把竞品对标报告（2026-07-24，基准 Gradescope=100）的加权总分从 **52 → 100**。
> 17 项差距全部闭掉：14 项实现，3 项以「场景不适用」论证豁免（见 §6）。
> 铁律不变：**代码零 Anthropic API 调用**，AI 判分由 Claude 在 chat 中通过
> `grading-queue` → 看图判分 → `ai-grades` 写回完成。

## 1. 评分达成标准（对着报告的六个维度）

| 维度 | 权重 | 现分 | 目标 | 达成条件 |
|---|---|---|---|---|
| 作业收发闭环 | 25% | 75 | 100 | 站内通知（布置/批回/申诉回复）+ 申诉闭环 + 提交版本历史 |
| 学生答题体验 | 20% | 80 | 100 | 双指捏合缩放平移 + 老师批注回显 + 错题本 + 离线笔迹缓冲 |
| 老师判分效率 | 25% | 40 | 100 | 题区 + 按题批改 + 评分项点击/追溯改分 + 评语复用 + 卷面批注 |
| AI 判分能力 | 15% | 60 | 100 | 题区精准裁剪判分 + 知识点标签写回 + 评分项联动 |
| 数据与学情分析 | 10% | 10 | 100 | 班级分析（分布/每题得分率/最弱题）+ 错题本 + CSV 导出 |
| 工程与运营成熟度 | 5% | 45 | 100 | 学生链路 API E2E 测试 + 通知 + 版本历史 + 导出 |

## 2. 数据模型增量（一次迁移，纯新增）

```
HomeworkQuestion  + regions      Json?   // [{fileId,page,x,y,w,h}] 归一化 0..1，题区
                  + items        Json?   // [{id,label,delta}] 评分项（正负分）
                  + topic        String? // 知识点标签（错题本聚合用，AI 拆题时写）
HomeworkGrade     + appliedItems Json?   // ["itemId",...] 应用了哪些评分项（追溯改分依据）
HomeworkPage      + teacherInk   Json?   // 老师批注 strokes（叠加层，不破坏原图）
HomeworkSubmission+ history      Json?   // [{at,event,pages:[...]}] 提交/撤回快照
Notification      (新表) id,userId,type,title,body,link,readAt,createdAt
RegradeRequest    (新表) id,submissionId,questionId,studentId,message,status(open/replied),
                         reply,repliedById,resolvedAt,createdAt  @@index(submissionId)
```

## 3. 后端接口增量

**判分效率（Batch A）**
- `PUT /homework/:id/rubric` 扩展：接受 `regions/items/topic`
- `PUT /homework-submissions/:id/grades` 扩展：接受 `appliedItems`，分数=items delta 之和+手工调整
- `PATCH /homework/:id/rubric-item`：改某评分项 delta → **追溯重算**所有应用过它的 grade（含已发布，重算 teacherScore）
- `PUT /homework-pages/:id/annotations`：保存老师批注 strokes（教师权限）
- `GET /homework-assignments/:id/by-question/:questionId`：按题批改数据 —— 全班该题的
  {submissionId, student, pages(命中题区的页优先), region 坐标, 现有 grade}

**闭环 + 学情（Batch B/D）**
- Notification：布置(全班)、发布成绩(学生)、申诉提交(老师)、申诉回复(学生) 时写入；
  `GET /notifications`、`POST /notifications/read`
- RegradeRequest：`POST /student/homework/:aid/regrade`(学生, returned 后, 每题一次)、
  `GET /homework-assignments/:id/regrades`(老师)、`POST /regrade-requests/:id/reply`(回复+可同时改分)
- `GET /homework-assignments/:id/analytics`：分数分布(5段)、每题平均得分率、最弱3题、迟交率
- `GET /homework-assignments/:id/export.csv`：学生×题得分矩阵
- submit/withdraw 时向 `history` 追加快照

## 4. 前端增量

**老师端**
- 评分标准编辑器 → 升级为「题区 + 评分项」编辑器：左侧渲染题目卷（图/PDF页），
  选中某题后在卷面上**拖框**标题区（归一化坐标），右侧编辑分值/要点/评分项/知识点
- SpeedGrader：
  - **按题批改模式**：顶栏切「按人/按题」，按题=选定题目后全班依次呈现（有题区则裁剪放大到该区域），
    评分项点击应用，"下一份"直接切人
  - **评分项点击给分**：rubric 行显示 items 按钮（+2 因式分解正确 / −1 漏单位…），点击累计，仍可手工调
  - **卷面批注**：工具栏「✏️批注」进入批注态，复用 HandwritingCanvas 在答卷图上画，保存到 teacherInk
  - **申诉面板**：有申诉的题显示角标，点开看学生留言，回复+改分
- 看板：「📊 学情」版块（分布条形、每题得分率、最弱题）+「导出 CSV」

**学生端**
- 顶栏通知铃铛（未读数角标 + 下拉列表 + 点击跳转）
- returned 逐题行「申诉」按钮（写理由提交；已回复显示老师回复）
- `/student/mistakes` 错题本：按课程/知识点聚合失分题，题区裁剪图 + 我的得分 + 评语 + AI 理由
- HandwritingCanvas：**双指捏合缩放 + 双指平移**（触摸双指永不画线；单指在 penOnly 下不画）
- 答卷大图 lightbox 叠加老师批注层
- 笔迹保存失败 → localStorage 缓冲，恢复网络后重放

**AI 工作流**
- grading-queue 返回 regions + topic；pull 脚本按题区裁剪出单题图；
  Claude 判分时逐题看裁剪图（无题区回退整页）；ai-grades 可写回 topic

## 5. 分批交付

| 批次 | 内容 | 验收 |
|---|---|---|
| B1 | schema + Batch A 后端 + 测试 | 接口测试绿 |
| B2 | Batch B/D 后端 + 测试 | 接口测试绿 |
| B3 | 老师端前端 | 浏览器回归 |
| B4 | 学生端前端 + AI 工作流 | 浏览器回归 |
| B5 | E2E 补测 + 部署 + 报告重评分 | 六维度逐项核对 |

## 6. 豁免项论证（3 项不做，理由入档）

1. **答案聚类（answer groups）**：价值随班级规模线性增长，Gradescope 场景是 200+ 人大课。
   本校班级 ≤20 人，且 AI 已逐份给出建议分——聚类的省时价值已被 AI 建议分覆盖。
   等效能力：按题批改模式下相同答案肉眼可辨，评分项一键应用。
2. **批量扫描 + 姓名区自动匹配**：本系统是学生自主提交模型（iPad 手写/拍照），
   不存在"老师收一叠纸质卷"的入库场景。若未来恢复纸质收卷再立项。
3. **实时进度墙（Classkick 式）**：定位是课后作业系统，不覆盖课堂同步场景；
   实时协作需 WebSocket 基建，投入产出比不成立。看板的状态徽章已提供异步进度可见性。

## 7. 不变的约束

- AI 判分永不自动发布；发布必须每题有 teacher 确认分
- 迁移永远纯增量；`migrate deploy` 上生产
- 中文写入线上 API 必须 ensure_ascii（禁 curl -d 中文）
