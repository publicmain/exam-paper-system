/**
 * 阶段 7E 的**阅读夹具准备**脚本 —— staging / 本地隔离库专用。
 *
 * ## 它做什么
 *
 * 把 `docs/manual-device-test-plan.md` 第 2 节那八个**虚构**账号重置成
 * 「今天可以从头做一次阅读」的状态：
 *
 *   · 两个班（`tc1` / `tc2`）当天各有一场**可作答的阅读场次**；
 *   · 八个账号当天**没有**任何阅读答卷、没有课程完成度、没有词汇测试记录；
 *   · 登录凭据、令牌版本、分级、班级关系、生词本**一个字都不动**。
 *
 * ## 它**不**做什么
 *
 * - 不改八个账号的密码 / PIN，**根本不读 PIN**；
 * - 不动 `seed-eight-test-accounts.js`（那是通用种子，两者互不覆盖）；
 * - 不改任何业务规则、schema 或迁移；
 * - **本任务不执行它**。执行需要另一份带「数据库写权限」的合同。
 *
 * ## 与通用种子的分工
 *
 * `seed-eight-test-accounts.js` 负责**把八个账号造出来**（用户、班级、
 * 生词、词汇场景）。本脚本**假定它们已经存在**，只负责把**阅读**这条线
 * 重置干净。两者的写入范围不重叠：本脚本从不写 `User` / `ClassEnrollment`
 * / `StudentWord`。
 *
 * ## 安全闸门（四道，全部在加载 Prisma 之前）
 *
 *   1. `NODE_ENV` 不是 production；
 *   2. 显式 `ALLOW_S7E_READING_PREP=yes`；
 *   3. `DATABASE_URL` **必须在进程启动快照里就存在**；
 *   4. 显式 `S7E_CONFIRM_RESET=reset-eight-reading-progress`。
 *
 * **没有 force / override / bypass。** 一旦有了，这四道就只是提示。
 *
 * 第 3 道为什么要取快照：`require('@prisma/client')` 会顺手加载仓库根的
 * `.env`，把 `DATABASE_URL` 填成本机开发库。闸门若在 require 之后才读
 * `process.env`，「我没给连接串」会被悄悄翻译成「那就用开发库吧」——
 * 正是这道闸门要防的事故。所以**先取快照、后 require**，而且 require
 * 本身也推迟到闸门全过之后。
 *
 * ## 数据库前置检查（只读，在任何写之前，且与写在同一个事务里）
 *
 *   · 库里没有不属于这八个 id 的在读学生；
 *   · 八个账号**都在**；
 *   · 两个班与班主任都在；
 *   · `NotificationConfig` 里 `enabled=true` 的行数为 0；
 *   · `NotificationLog` 行数为 0。
 *
 * 任何一条不满足 → 在写之前中止。
 *
 * ## 跑法（本任务不执行）
 *
 * ```bash
 * ALLOW_S7E_READING_PREP=yes \
 * S7E_CONFIRM_RESET=reset-eight-reading-progress \
 * DATABASE_URL=<目标库> \
 *   node apps/api/scripts/staging/prepare-s7e-reading.js
 * ```
 *
 * ## 时间窗口
 *
 * 场次的时间窗按**生产口径 08:30–09:00** 写，与通用种子一致。
 * 「全天可作答」靠 `MORNING_QUIZ_ALL_DAY` 开关，不靠把窗口放宽 ——
 * 那样 staging 测的才是真正的开关行为。真机测试若在窗口之外进行，
 * 需要该开关处于打开状态；这是执行合同的前置，不是本脚本的职责。
 */

// ⚠️ 顺序有意义：先拍环境快照，再加载任何会碰 dotenv 的东西。
// 本文件**在闸门通过之前不 require @prisma/client**。
const ENV_AT_STARTUP = {
  NODE_ENV: process.env.NODE_ENV || '',
  ALLOW_S7E_READING_PREP: process.env.ALLOW_S7E_READING_PREP || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  S7E_CONFIRM_RESET: process.env.S7E_CONFIRM_RESET || '',
};

// ─────────────────────────────────────────────────────────────
// 固定常量（全部虚构，且全部是本仓库里的字面量）
// ─────────────────────────────────────────────────────────────

/** 本脚本认识的**全部**学生 id。多一个少一个都不行。 */
const S7E_STUDENT_IDS = [
  't1_normal',
  't2_nolevel',
  't3_noatt',
  't4_newwords',
  't5_review',
  't6_done',
  't7_nocontent',
  't8_zero',
];

/** 需要预先存在的班级（由通用种子建立）。 */
const S7E_CLASS_IDS = ['tc1', 'tc2'];
const S7E_TEACHER_ID = 't_stgteacher';

/** 本脚本**自己拥有**的记录 id —— 一律 `s7e_` 前缀，不与通用种子相撞。 */
const S7E_OWNED_IDS = {
  board: 's7e_board',
  subject: 's7e_subject',
  paper: 's7e_paper',
  questions: ['s7e_q1', 's7e_q2', 's7e_q3', 's7e_q4'],
  paperQuestions: ['s7e_pq1', 's7e_pq2', 's7e_pq3', 's7e_pq4'],
  assignments: { tc1: 's7e_asg_tc1', tc2: 's7e_asg_tc2' },
  sessions: { tc1: 's7e_sess_tc1', tc2: 's7e_sess_tc2' },
};

/** 这些表本脚本**永不写入** —— 测试据此断言。 */
const PRESERVED_TABLES = ['User', 'ClassEnrollment', 'StudentWord', 'WordReviewLog', 'DictEntry'];

const S7E_PAPER_TITLE = 'Lighthouse Point（S7E 阅读夹具）';
const S7E_PASSAGE =
  'The lighthouse at Lighthouse Point has guided vessels along this coast for more than a hundred ' +
  'and forty years. Its keeper once climbed the spiral stair twice each night to trim the wick and ' +
  'wind the clockwork that turned the lens. When the light was finally automated in the nineteen ' +
  'seventies the last keeper left the island, but the harbour council still sends a volunteer out ' +
  'each spring to repaint the tower and to check that the meadow path to the jetty remains clear.';
const S7E_STEMS = [
  'How long has the lighthouse guided vessels along the coast?',
  'What did the keeper have to do twice each night?',
  'What happened to the light in the nineteen seventies?',
  'Who now maintains the tower and the path?',
];

const DESTRUCTIVE_CONFIRMATION = 'reset-eight-reading-progress';

// -------------------------------------------------------------
// 失败上报 —— fail-closed
//
// 未知错误（Prisma、连接、SQL、任何运行时异常）的 message 里**可能带着
// 连接串**：Prisma 的初始化错误会把完整的数据源 URL（协议、账号、口令、
// 主机、端口、库名）原样写进 message。把它直接打出去，等于把库的账号
// 口令写进日志或工单。
//
// 所以规则反过来：**默认什么都不说**，只有本文件自己构造的、内容完全
// 由仓库常量与夹具 id 组成的错误，才被显式标记为可以照原样显示。
// -------------------------------------------------------------

/**
 * 「本模块自己造的、内容可控的错误」名册。
 *
 * **模块私有，不导出，也没有任何往里塞东西的入口** —— 唯一的写入点是
 * 下面那个构造函数。上报器认的是「这个对象在不在名册里」，而不是对象
 * 自称什么。
 *
 * 为什么不能用公开的布尔字段：`{ s7eSafe: true, message: <连接串> }`
 * 这种对象**任何人都造得出来**，被下游库改过的错误也可能恰好带上它。
 * 数据自称的身份不是身份。
 *
 * 为什么不用 `instanceof`：同一个类在不同 realm（vm、worker、被打包两次）
 * 下会有两个不同的构造函数，`instanceof` 会漏判；而伪造一个原型链却不难。
 * WeakSet 认的是**对象本体**，两头都不吃亏，且不阻止垃圾回收。
 */
const SAFE_ERRORS = new WeakSet();

/**
 * 本模块自己构造的错误 —— 只有闸门、日期形状校验与前置检查用它。
 * 它们的 message 只由本文件里的常量、环境变量的**名字**（不是取值）
 * 和夹具 id 组成。
 *
 * 构造时把实例登记进 `SAFE_ERRORS`；这是名册的唯一写入点。
 */
class S7eSafeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'S7eSafeError';
    SAFE_ERRORS.add(this);
  }
}

/** 未知失败一律用这一句，不带任何细节。 */
const GENERIC_FAILURE = [
  'S7E 阅读夹具未执行：运行期失败。',
  '细节被刻意隐去 —— 底层错误（Prisma / 连接 / SQL）的文本里可能含有',
  '数据库连接串、账号或主机名。请在你自己的终端里排查，不要把它写进日志或工单。',
].join('\n');

/**
 * 顶层失败上报。**任何未被显式标记为安全的错误都只输出固定文案** ——
 * 不打印 message、不打印 stack、不打印 cause、不做任何序列化。
 */
function reportFailure(e, log = console.error) {
  // 只认名册里的**那个对象本体**。形状、类名、自称的标记一概不作数。
  // `WeakSet.has` 对非对象直接返回 false，所以字符串 / null / 数字
  // 天然走固定文案这一支。
  if (SAFE_ERRORS.has(e) && typeof e.message === 'string') {
    log(['', 'S7E 阅读夹具未执行：', e.message, ''].join('\n'));
    return;
  }
  log(['', GENERIC_FAILURE, ''].join('\n'));
}

// ─────────────────────────────────────────────────────────────
// SQL 字面量
//
// 值全部内联而不是走参数 —— 与通用种子同一理由（Prisma 的
// `$executeRawUnsafe` 对枚举 / jsonb / interval 的参数类型推断挑剔）。
// **这里所有值都是本文件里的常量**，唯一的动态量是日期，而它在拼进
// SQL 之前被强制校验成 `YYYY-MM-DD`。注入面为零。
// ─────────────────────────────────────────────────────────────

const L = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const J = (o) => `${L(JSON.stringify(o))}::jsonb`;
const ID_LIST = S7E_STUDENT_IDS.map(L).join(',');

// ─────────────────────────────────────────────────────────────
// 闸门
// ─────────────────────────────────────────────────────────────

/**
 * 四道环境闸门。**在加载 Prisma、建立任何连接之前**调用。
 *
 * 抛出的错误里只描述缺了什么，不回显任何取值 —— 尤其不回显
 * `DATABASE_URL`。
 */
function assertEnvGates(env = ENV_AT_STARTUP) {
  if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new S7eSafeError(
      '拒绝执行：NODE_ENV=production。\n' +
        '本脚本会删除八个虚构账号的阅读与课程进度，只能跑在 staging 或本地隔离库上。\n' +
        '没有覆盖开关 —— 需要在 production 模式的进程里跑，说明目标选错了。',
    );
  }
  if (String(env.ALLOW_S7E_READING_PREP || '').toLowerCase() !== 'yes') {
    throw new S7eSafeError(
      '拒绝执行：需要显式 ALLOW_S7E_READING_PREP=yes。\n' +
        '这道闸门让「跑到哪个库上」成为一个有意识的动作。',
    );
  }
  if (!env.DATABASE_URL) {
    throw new S7eSafeError(
      '拒绝执行：没有显式传入 DATABASE_URL。\n' +
        '仓库根的 .env 里有一个开发库连接串，@prisma/client 会自动加载它；\n' +
        '本脚本刻意**不接受**那个来源 —— 目标库必须由你在命令行里指定。',
    );
  }
  if (env.S7E_CONFIRM_RESET !== DESTRUCTIVE_CONFIRMATION) {
    throw new S7eSafeError(
      '拒绝执行：这是一次破坏性重置，需要逐字确认。\n' +
        `请设置 S7E_CONFIRM_RESET=${DESTRUCTIVE_CONFIRMATION}\n` +
        '它会删除这八个虚构账号当前的阅读答卷、课程完成度与词汇测试记录。',
    );
  }
}

/** 新加坡日历日（UTC+8），形如 `YYYY-MM-DD`。 */
function singaporeDay(nowMs = Date.now()) {
  return new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10);
}

/** 拼进 SQL 之前把日期钉死成 `YYYY-MM-DD`，杜绝任何非常量成分。 */
function assertDayShape(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) {
    throw new S7eSafeError('内部错误：日期格式必须是 YYYY-MM-DD');
  }
  return day;
}

// ─────────────────────────────────────────────────────────────
// 前置检查（只读）
// ─────────────────────────────────────────────────────────────

/**
 * 五项只读前置检查。**在同一个事务里、在任何写之前**跑完。
 *
 * 不靠「认得出生产库长什么样」（那需要把生产地址写进仓库），靠的是一个
 * 更硬的事实：真实名册里有几十个学生，而本夹具只认识八个虚构 id。
 */
async function runPreflight(tx) {
  const foreign = await tx.$queryRawUnsafe(
    `/* s7e:foreign-students */
     SELECT u.id AS id FROM "User" u
     WHERE u.role = 'student' AND u."isActive" = true
       AND u.id NOT IN (${ID_LIST})
     LIMIT 5`,
  );
  if (foreign.length > 0) {
    throw new S7eSafeError(
      `拒绝执行：目标库里有 ${foreign.length}+ 个不属于本夹具的在读学生。\n` +
        `例如：${foreign.map((r) => r.id).join(', ')}\n` +
        '这几乎一定意味着 DATABASE_URL 指错了库。',
    );
  }

  const present = await tx.$queryRawUnsafe(
    `/* s7e:expected-students */
     SELECT u.id AS id FROM "User" u
     WHERE u.role = 'student' AND u.id IN (${ID_LIST})`,
  );
  const have = new Set(present.map((r) => r.id));
  const missing = S7E_STUDENT_IDS.filter((id) => !have.has(id));
  if (missing.length > 0) {
    throw new S7eSafeError(
      `拒绝执行：这八个虚构账号里缺了 ${missing.length} 个：${missing.join(', ')}\n` +
        '请先跑通用种子 seed-eight-test-accounts.js 把它们建起来。',
    );
  }

  const classes = await tx.$queryRawUnsafe(
    `/* s7e:classes-and-teacher */
     SELECT c.id AS id FROM "Class" c WHERE c.id IN (${S7E_CLASS_IDS.map(L).join(',')})`,
  );
  const haveClasses = new Set(classes.map((r) => r.id));
  const missingClasses = S7E_CLASS_IDS.filter((id) => !haveClasses.has(id));
  if (missingClasses.length > 0) {
    throw new S7eSafeError(
      `拒绝执行：缺少夹具班级 ${missingClasses.join(', ')}。先跑通用种子。`,
    );
  }

  const teacher = await tx.$queryRawUnsafe(
    `/* s7e:teacher */
     SELECT u.id AS id FROM "User" u WHERE u.id = ${L(S7E_TEACHER_ID)} AND u.role = 'teacher'`,
  );
  if (teacher.length === 0) {
    throw new S7eSafeError(`拒绝执行：缺少夹具班主任 ${S7E_TEACHER_ID}。先跑通用种子。`);
  }

  const notify = await tx.$queryRawUnsafe(
    `/* s7e:notification-guards */
     SELECT (SELECT count(*) FROM "NotificationConfig" WHERE enabled = true)::int AS enabled_configs,
            (SELECT count(*) FROM "NotificationLog")::int                          AS sent_logs`,
  );
  const g = notify[0] || {};
  if (Number(g.enabled_configs) !== 0) {
    throw new S7eSafeError(
      `拒绝执行：目标库里有 ${g.enabled_configs} 条启用的 NotificationConfig。\n` +
        '夹具库不该往外发任何通知 —— 先把它们关掉。',
    );
  }
  if (Number(g.sent_logs) !== 0) {
    throw new S7eSafeError(
      `拒绝执行：目标库里已有 ${g.sent_logs} 条 NotificationLog。\n` +
        '这说明它不是一个干净的夹具库。',
    );
  }

  return { studentCount: S7E_STUDENT_IDS.length };
}

// ─────────────────────────────────────────────────────────────
// 写入
// ─────────────────────────────────────────────────────────────

/**
 * 把八个账号的阅读线重置干净，并给两个班各建一场当天的阅读场次。
 *
 * **删除顺序按外键倒序**：
 *   AnswerScript → VocabQuizAttempt → StudentSubmission → DailyLessonCompletion
 * （`VocabQuizAttempt` 引用 `DailyLessonCompletion`，所以必须先于它删；
 *  `AnswerScript` 引用 `StudentSubmission`，同理。）
 *
 * 随后替换两个班当天的场次：`Attendance` 引用场次，所以先删掉**这八个
 * 账号**在这两场里的考勤行，再删场次与作业单，最后按固定 id 重建。
 *
 * **绝不写** `User` / `ClassEnrollment` / `StudentWord` / `WordReviewLog`
 * / `DictEntry` —— 凭据、令牌版本、分级、班级关系、生词本全部原样保留。
 */
async function applyPreparation(tx, { day }) {
  assertDayShape(day);
  const run = (sql) => tx.$executeRawUnsafe(sql);
  const at = (t) => `('${day}T${t}+08:00')::timestamptz AT TIME ZONE 'UTC'`;
  const dayStart = `('${day}T00:00:00Z')::timestamptz`;

  // ── 1. 清掉八个账号的阅读 / 课程 / 词测痕迹（外键安全顺序）──
  await run(
    `DELETE FROM "AnswerScript" WHERE "submissionId" IN
       (SELECT id FROM "StudentSubmission" WHERE "studentId" IN (${ID_LIST}))`,
  );
  await run(`DELETE FROM "VocabQuizAttempt" WHERE "studentId" IN (${ID_LIST})`);
  await run(`DELETE FROM "StudentSubmission" WHERE "studentId" IN (${ID_LIST})`);
  await run(`DELETE FROM "DailyLessonCompletion" WHERE "studentId" IN (${ID_LIST})`);

  // ── 2. S7E 自有的卷子资源（固定 id，重复执行不产生第二份）──
  await run(
    `INSERT INTO "ExamBoard"(id,name,code)
     VALUES (${L(S7E_OWNED_IDS.board)},'S7E Board','S7EB')
     ON CONFLICT (id) DO NOTHING`,
  );
  await run(
    `INSERT INTO "Subject"(id,"examBoardId",code,name,level)
     VALUES (${L(S7E_OWNED_IDS.subject)},${L(S7E_OWNED_IDS.board)},'7799','S7E English','O_LEVEL')
     ON CONFLICT (id) DO NOTHING`,
  );
  await run(
    `INSERT INTO "Paper"(id,name,"subjectId","ownerId",status,"durationMin","totalMarksTarget",
       "totalMarksActual","generatedSeed",config,"updatedAt")
     VALUES (${L(S7E_OWNED_IDS.paper)},${L(S7E_PAPER_TITLE)},${L(S7E_OWNED_IDS.subject)},
       ${L(S7E_TEACHER_ID)},'published',30,4,4,1,'{}'::jsonb,now())
     ON CONFLICT (id) DO NOTHING`,
  );
  for (let i = 0; i < 4; i++) {
    const content = {
      passage: S7E_PASSAGE,
      passageTitle: S7E_PAPER_TITLE,
      stem: S7E_STEMS[i],
    };
    const answer = { value: 'see passage' };
    await run(
      `INSERT INTO "Question"(id,"subjectId","createdById","questionType","sourceType",
         content,"answerContent",marks,"estimatedTimeMin",difficulty,status,"updatedAt")
       VALUES (${L(S7E_OWNED_IDS.questions[i])},${L(S7E_OWNED_IDS.subject)},${L(S7E_TEACHER_ID)},
         'short_answer','original_school',${J(content)},${J(answer)},1,2,3,'active',now())
       ON CONFLICT (id) DO NOTHING`,
    );
    await run(
      `INSERT INTO "PaperQuestion"(id,"paperId","questionId","sortOrder","snapshotContent","snapshotAnswer",marks)
       VALUES (${L(S7E_OWNED_IDS.paperQuestions[i])},${L(S7E_OWNED_IDS.paper)},
         ${L(S7E_OWNED_IDS.questions[i])},${i + 1},${J(content)},${J(answer)},1)
       ON CONFLICT (id) DO NOTHING`,
    );
  }

  // ── 3. 两个班当天各一场阅读场次 ──
  const sessionIds = [];
  for (const classId of S7E_CLASS_IDS) {
    const asgId = S7E_OWNED_IDS.assignments[classId];
    const sessId = S7E_OWNED_IDS.sessions[classId];

    // 先摘掉八个账号在该班当天场次上的考勤行 —— Attendance 外键指向场次，
    // 不先删就换不掉场次。范围仍然只有这八个 id。
    await run(
      `DELETE FROM "Attendance"
       WHERE "studentId" IN (${ID_LIST})
         AND "sessionId" IN (
           SELECT id FROM "MorningQuizSession"
           WHERE "classId" = ${L(classId)} AND date = ${dayStart}
         )`,
    );
    // 该班当天的场次一律替换成本夹具这一场 —— 否则 today 可能挑中别的场次，
    // 真机测试就测不到我们准备的那份卷子。范围限定在夹具自己的两个班 + 当天。
    await run(
      `DELETE FROM "MorningQuizSession"
       WHERE "classId" = ${L(classId)} AND date = ${dayStart}`,
    );
    await run(`DELETE FROM "PaperAssignment" WHERE id = ${L(asgId)}`);

    await run(
      `INSERT INTO "PaperAssignment"(id,"paperId","classId","assignedById","assignedAt","dueAt")
       VALUES (${L(asgId)},${L(S7E_OWNED_IDS.paper)},${L(classId)},${L(S7E_TEACHER_ID)},
         now(),${at('23:59:00')})`,
    );
    await run(
      `INSERT INTO "MorningQuizSession"(id,date,"classId","paperAssignmentId","scheduledById",status,level,
         "attendanceStart","attendanceEnd","lateCutoff","quizStart","quizEnd","qrSecret")
       VALUES (${L(sessId)},${dayStart},${L(classId)},${L(asgId)},${L(S7E_TEACHER_ID)},'active','olevel',
         ${at('08:30:00')},${at('08:40:00')},${at('08:59:59')},${at('08:30:00')},${at('09:00:00')},
         's7e-fixture-qr-secret-not-used')`,
    );
    sessionIds.push(sessId);
  }

  return { day, sessionIds, students: S7E_STUDENT_IDS.length };
}

/**
 * 事务体 —— **先只读检查、后写入**，两者在同一个事务里。
 *
 * 单独导出是为了让测试能跑**真的这段组合**，而不是只扫源码里的调用顺序：
 * 假事务客户端记下读写序列，就能证明「第一条写语句出现在所有前置读之后」。
 */
async function prepareInTransaction(tx, { day }) {
  await runPreflight(tx);
  return applyPreparation(tx, { day });
}

// ─────────────────────────────────────────────────────────────
// 入口
// ─────────────────────────────────────────────────────────────

async function main() {
  // 闸门先过 —— **在这之前不加载 Prisma、不建连接**。
  assertEnvGates();

  // 延迟 require：让「没给 DATABASE_URL」不会被 dotenv 悄悄补上。
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: ENV_AT_STARTUP.DATABASE_URL } },
  });

  try {
    const day = singaporeDay();
    // 前置检查与写入**在同一个事务里**：检查过了才写，中途任何失败整体回滚。
    const result = await prisma.$transaction((tx) => prepareInTransaction(tx, { day }));
    printReceipt(result);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 回执。
 *
 * **只允许出现**：日期、虚构账号数量、场次 id，以及一句「这八个账号的
 * 阅读 / 课程进度已被重置」的警告。
 * 连接串、凭据、令牌、PIN、口令哈希、主机、端口 —— 一个都不打印。
 */
function printReceipt(result) {
  console.log(`\nS7E 阅读夹具已准备（${result.day}）`);
  console.log(`  虚构账号：${result.students} 个`);
  console.log(`  当天场次：${result.sessionIds.join(', ')}`);
  console.log(
    '\n⚠️ 这八个虚构账号原有的阅读答卷、课程完成度与词汇测试记录已被重置。\n' +
      '   登录凭据、令牌版本、分级、班级关系与生词本未被改动。\n',
  );
}

module.exports = {
  S7E_STUDENT_IDS,
  S7E_CLASS_IDS,
  S7E_TEACHER_ID,
  S7E_OWNED_IDS,
  PRESERVED_TABLES,
  DESTRUCTIVE_CONFIRMATION,
  assertEnvGates,
  singaporeDay,
  assertDayShape,
  runPreflight,
  applyPreparation,
  prepareInTransaction,
  printReceipt,
  main,
  reportFailure,
  GENERIC_FAILURE,
};

if (require.main === module) {
  main().catch((e) => {
    // 走统一的上报器 —— 未知错误只会得到固定文案，绝不回显 message / stack /
    // cause，也绝不序列化错误对象。
    reportFailure(e);
    process.exit(1);
  });
}
