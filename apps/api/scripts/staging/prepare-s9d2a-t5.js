/**
 * S9D2A —— **只给一个账号（`t5_review`）准备「当天」的前置状态**。
 *
 * staging / 本地隔离库专用。**不是**八账号夹具，也不调用它。
 *
 * ## 为什么需要它
 *
 * S9D2（正式单词测试的 staging 实跑）在 AC-02 前置检查上停住：任务日在
 * SGT 午夜翻了页，库里最新的 `DailyLessonCompletion` 与
 * `MorningQuizSession` 都还停在**昨天**，于是 `t5_review` 今天既没有课、
 * 也不可能处在 `vocab_test`。合同禁止在那份合同里修任何东西，所以这份
 * 脚本单独存在：**把当天的阅读场次和 t5 的复习词恢复成「今天可以从头
 * 走一遍」**，剩下的（读、答、交、四张复习卡）全部由学生自己在真页面上
 * 走完 —— 脚本**不制造** `stage='vocab_test'`。
 *
 * ## 它做什么（写入范围，逐条）
 *
 *   1. **当天的阅读场次**：固定 id 的 `s9d2_` 卷子资源
 *      （`s9d2_paper` / 四道题 / 四条卷题 / `s9d2_asg_tc1` /
 *      `s9d2_sess_tc1`），挂在 t5 所在的班 `tc1` 上，状态 `active`。
 *      科目、考试局、班级、班主任**沿用已存在的夹具资源**，不新建。
 *   2. **t5 当天的场景状态**：删掉 t5 在 `s9d2_asg_tc1` 上的答卷与逐题
 *      答案、以及 t5 **当天**的任务行。让「今天」重新可以从零走。
 *   3. **t5 的四个复习词**：`ripple / vessel / willow / anchor` 重置成
 *      「教过、已到期」——`firstTaughtAt` 在九天前、`due` 在一小时前、
 *      `state='review'`、`reps=4`。这是「纯复习日」这个场景的定义。
 *
 * ## 它**不**做什么
 *
 * - **不碰另外七个账号**的任何一行（任务行、答卷、测试、生词、复习流水）；
 * - **不写** `User` / `Class` / `ClassEnrollment` / `WordReviewLog` /
 *   `DictEntry` / `Attendance` —— 凭据、令牌版本、分级、班级关系、
 *   历史复习流水一个字都不动（`PRESERVED_TABLES`）；
 * - **不创建** `VocabQuizAttempt`，也**不删除**任何一份 —— 前置检查发现
 *   t5 当天已经有正式测试就直接拒绝执行（那是成绩证据，不该被夹具清掉）；
 * - **不创建** `stage='vocab_test'` 的任务行。它连 `DailyLessonCompletion`
 *   的 INSERT 都没有 —— 任务行只由学生打开课程页时由服务端自己建。
 *   最终阶段必须是**真的走**出来的，不是写出来的。
 *
 * ## 安全闸门（七道，前五道在加载 Prisma 之前）
 *
 *   1. `NODE_ENV` 不是 production —— **没有覆盖开关**；
 *   2. 显式 `ALLOW_S9D2A_T5_PREP=yes`；
 *   3. `DATABASE_URL` **必须在进程启动快照里就存在**；
 *   4. 逐字确认 `S9D2A_CONFIRM=reset-t5-current-day`；
 *   5. **Railway 身份三元组**（project / environment / database service）
 *      必须由调用方显式给出，且与本文件里写死的 staging 常量逐字相等。
 *   6. （连库后、写之前，同一事务内）**只读前置检查**，见下；
 *   7. （同一事务内、写之后、提交之前）**回读校验**：场次落库的日历日
 *      必须正好是当天，四个复习词必须正好改到四行。
 *
 * 第 3 道为什么要取快照：`require('@prisma/client')` 会顺手加载仓库根的
 * `.env`，把 `DATABASE_URL` 填成本机开发库。闸门若在 require 之后才读
 * `process.env`，「我没给连接串」会被悄悄翻译成「那就用开发库吧」。
 *
 * 第 5 道为什么有用：前四道只能证明「操作者是有意的」，证明不了**打到
 * 哪个项目**。把 staging 的三元组写死在仓库里、要求调用方复述一遍，
 * 指错项目时它就对不上。它不是密钥，是**地址**（`railway status` 任何
 * 人都能读到），写进仓库的收益是「换个项目就跑不起来」。
 *
 * ## 只读前置检查（同一事务，任何写之前）
 *
 *   · 库里没有不属于那八个虚构 id 的在读学生（指错库的硬拦截）；
 *   · `t5_review` 在、是学生、`isActive`、`englishLevel='olevel'`；
 *   · 班 `tc1`、t5 在 `tc1` 的学生注册、班主任、科目 `stg_sub` 都在；
 *   · t5 名下**正好**拥有那四个复习词；
 *   · `NotificationConfig(enabled=true)` 与 `NotificationLog` 都是 0；
 *   · `s9d2_sess_tc1` 上没有任何考勤行（有就说明它被别的流程用过）；
 *   · `s9d2_asg_tc1` 上没有**别人**的答卷；
 *   · t5 **当天没有**正式单词测试；
 *   · t5 的班当天没有**别的** `MorningQuizSession`（两场会让服务端挑错）。
 *
 * 任何一条不满足 → 在写之前中止，整个事务回滚。
 *
 * ## 幂等性
 *
 * **场景层面幂等，不是逐字节确定性**。重复执行会把 t5 的当天状态重新
 * 推回同一个场景；但 `due` / `firstTaughtAt` 是相对此刻算的，两次运行的
 * 绝对时刻不同。**t5 当天一旦开出正式测试，脚本就拒绝再跑** —— 那时
 * 重置等于毁证据。
 *
 * ## 跑法
 *
 * ```bash
 * ALLOW_S9D2A_T5_PREP=yes \
 * S9D2A_CONFIRM=reset-t5-current-day \
 * S9D2A_RAILWAY_PROJECT_ID=<staging project id> \
 * S9D2A_RAILWAY_ENVIRONMENT_ID=<staging environment id> \
 * S9D2A_RAILWAY_DB_SERVICE_ID=<staging Postgres service id> \
 * DATABASE_URL=<staging 库> \
 *   node apps/api/scripts/staging/prepare-s9d2a-t5.js
 * ```
 *
 * 时间窗按**生产口径 08:30–09:00** 写，与另外两个夹具一致 ——「全天可
 * 作答」靠 `MORNING_QUIZ_ALL_DAY` 开关，不靠把窗口放宽。
 */

// ⚠️ 顺序有意义：先拍环境快照，再加载任何会碰 dotenv 的东西。
// 本文件**在闸门通过之前不 require @prisma/client**。
const ENV_AT_STARTUP = {
  NODE_ENV: process.env.NODE_ENV || '',
  ALLOW_S9D2A_T5_PREP: process.env.ALLOW_S9D2A_T5_PREP || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  S9D2A_CONFIRM: process.env.S9D2A_CONFIRM || '',
  S9D2A_RAILWAY_PROJECT_ID: process.env.S9D2A_RAILWAY_PROJECT_ID || '',
  S9D2A_RAILWAY_ENVIRONMENT_ID: process.env.S9D2A_RAILWAY_ENVIRONMENT_ID || '',
  S9D2A_RAILWAY_DB_SERVICE_ID: process.env.S9D2A_RAILWAY_DB_SERVICE_ID || '',
};

// ─────────────────────────────────────────────────────────────
// 固定常量（全部虚构，且全部是本仓库里的字面量）
// ─────────────────────────────────────────────────────────────

/** 本脚本**唯一**会写到的学生。 */
const S9D2A_STUDENT_ID = 't5_review';

/** 那八个虚构 id —— 只用于「指错库」这道闸，不是写入范围。 */
const FIXTURE_STUDENT_IDS = [
  't1_normal',
  't2_nolevel',
  't3_noatt',
  't4_newwords',
  't5_review',
  't6_done',
  't7_nocontent',
  't8_zero',
];

/** t5 所在的班，以及沿用的既有夹具资源（本脚本都不新建）。 */
const S9D2A_CLASS_ID = 'tc1';
const S9D2A_TEACHER_ID = 't_stgteacher';
const S9D2A_SUBJECT_ID = 'stg_sub';

/** t5 的四个复习词 —— 顺序即冻结队列的期望顺序（按 due 升序等价）。 */
const S9D2A_REVIEW_WORDS = ['ripple', 'vessel', 'willow', 'anchor'];

/** 本脚本**自己拥有**的记录 id —— 一律 `s9d2_` 前缀，不与既有夹具相撞。 */
const S9D2A_OWNED_IDS = {
  paper: 's9d2_paper',
  questions: ['s9d2_q1', 's9d2_q2', 's9d2_q3', 's9d2_q4'],
  paperQuestions: ['s9d2_pq1', 's9d2_pq2', 's9d2_pq3', 's9d2_pq4'],
  assignment: 's9d2_asg_tc1',
  session: 's9d2_sess_tc1',
};

/** 这些表本脚本**永不写入** —— 测试据此断言。 */
const PRESERVED_TABLES = [
  'User',
  'Class',
  'ClassEnrollment',
  'WordReviewLog',
  'DictEntry',
  'Attendance',
  'VocabQuizAttempt',
];

/**
 * staging 的 Railway 身份三元组。**不是密钥，是地址** ——
 * `railway status` 任何人都读得到。写死在这里，是为了让「打到别的项目」
 * 这件事对不上号。
 */
const S9D2A_RAILWAY = {
  projectName: 'exam-staging-manual',
  projectId: 'ed8c31c0-6499-4611-830a-64043189f7d0',
  environmentName: 'production',
  environmentId: '88e16ab9-7308-4e68-bdae-55e676473176',
  databaseServiceName: 'Postgres',
  databaseServiceId: '4be0aa53-8d34-45de-82b3-5e7c15a30985',
};

const DESTRUCTIVE_CONFIRMATION = 'reset-t5-current-day';

/**
 * 卷子内容 —— **原创**（`source_type=original_school`），不含任何
 * past-paper 原文。
 *
 * 长度不是随便写的：新端的渲染器按「第一题带 passage 且长度 > 200」
 * 才落到 `OLevelComprehension`（分页问答壳）。短于这个数会掉进
 * 通用 MCQ 壳，而这几道题没有选项 —— 学生会看到一张答不了的卡。
 */
const S9D2A_PAPER_TITLE = 'The River Ferry（S9D2A 阅读夹具）';
const S9D2A_PASSAGE =
  'The river ferry has crossed at this bend for as long as the town can remember. Before the ' +
  'bridge was built upstream, every cart of grain and every child walking to school waited on ' +
  'the slipway for the flat green boat to come about. The ferryman kept a bell on a post, and ' +
  'anyone arriving after dark would ring it twice and wait for a lantern to answer from the far ' +
  'bank. Today the crossing takes four minutes and carries mostly walkers and cyclists, but the ' +
  'bell is still there, and on the first Sunday of every summer the old ferryman rings it once ' +
  'for each year the boat has run.';
const S9D2A_STEMS = [
  'Where did people wait for the ferry before the bridge was built?',
  'How did someone arriving after dark call for the ferry?',
  'How long does the crossing take today?',
  'What happens on the first Sunday of every summer?',
];

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
// （与 prepare-s7e-reading.js 同一套做法，理由见那里的长注释。）
// -------------------------------------------------------------

/**
 * 「本模块自己造的、内容可控的错误」名册。模块私有、没有对外写入口；
 * 认的是**对象本体**，不是它自称什么，也不是 `instanceof`。
 */
const SAFE_ERRORS = new WeakSet();

class S9d2aSafeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'S9d2aSafeError';
    SAFE_ERRORS.add(this);
  }
}

/** 未知失败一律用这一句，不带任何细节。 */
const GENERIC_FAILURE = [
  'S9D2A 前置准备未执行：运行期失败。',
  '细节被刻意隐去 —— 底层错误（Prisma / 连接 / SQL）的文本里可能含有',
  '数据库连接串、账号或主机名。请在你自己的终端里排查，不要把它写进日志或工单。',
].join('\n');

/**
 * 顶层失败上报。**任何未被显式标记为安全的错误都只输出固定文案** ——
 * 不打印 message、不打印 stack、不打印 cause、不做任何序列化。
 */
function reportFailure(e, log = console.error) {
  if (SAFE_ERRORS.has(e) && typeof e.message === 'string') {
    log(['', 'S9D2A 前置准备未执行：', e.message, ''].join('\n'));
    return;
  }
  log(['', GENERIC_FAILURE, ''].join('\n'));
}

// ─────────────────────────────────────────────────────────────
// SQL 字面量
//
// 值全部内联而不是走参数 —— 与另外两个夹具同一理由（Prisma 的
// `$executeRawUnsafe` 对枚举 / jsonb / interval 的参数类型推断挑剔）。
// **这里所有值都是本文件里的常量**，唯一的动态量是日期，而它在拼进
// SQL 之前被强制校验成 `YYYY-MM-DD`。注入面为零。
// ─────────────────────────────────────────────────────────────

const L = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const J = (o) => `${L(JSON.stringify(o))}::jsonb`;
const FIXTURE_ID_LIST = FIXTURE_STUDENT_IDS.map(L).join(',');
const REVIEW_WORD_LIST = S9D2A_REVIEW_WORDS.map(L).join(',');
const T5 = L(S9D2A_STUDENT_ID);

// ─────────────────────────────────────────────────────────────
// 闸门
// ─────────────────────────────────────────────────────────────

/**
 * 前四道环境闸门。**在加载 Prisma、建立任何连接之前**调用。
 * 抛出的错误里只描述缺了什么，不回显任何取值 —— 尤其不回显
 * `DATABASE_URL`。
 */
function assertEnvGates(env = ENV_AT_STARTUP) {
  if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new S9d2aSafeError(
      '拒绝执行：NODE_ENV=production。\n' +
        '本脚本会重置 t5_review 当天的阅读答卷、任务行与四个复习词，\n' +
        '只能跑在 staging 或本地隔离库上。没有覆盖开关 —— 需要在 production\n' +
        '模式的进程里跑，说明目标选错了。',
    );
  }
  if (String(env.ALLOW_S9D2A_T5_PREP || '').toLowerCase() !== 'yes') {
    throw new S9d2aSafeError(
      '拒绝执行：需要显式 ALLOW_S9D2A_T5_PREP=yes。\n' +
        '这道闸门让「跑到哪个库上」成为一个有意识的动作。',
    );
  }
  if (!env.DATABASE_URL) {
    throw new S9d2aSafeError(
      '拒绝执行：没有显式传入 DATABASE_URL。\n' +
        '仓库根的 .env 里有一个开发库连接串，@prisma/client 会自动加载它；\n' +
        '本脚本刻意**不接受**那个来源 —— 目标库必须由你在命令行里指定。',
    );
  }
  if (env.S9D2A_CONFIRM !== DESTRUCTIVE_CONFIRMATION) {
    throw new S9d2aSafeError(
      '拒绝执行：这是一次破坏性重置，需要逐字确认。\n' +
        `请设置 S9D2A_CONFIRM=${DESTRUCTIVE_CONFIRMATION}\n` +
        '它会删除 t5_review 当天的阅读答卷与任务行，并把它的四个复习词\n' +
        '重置成「教过、已到期」。',
    );
  }
}

/**
 * 第五道闸门 —— **打到哪个 Railway 项目**必须被复述一遍。
 *
 * 三个值都不是密钥（`railway status` 就能读到），所以对不上时可以直接
 * 说出**期望值**；**不回显调用方给的值**，那没必要。
 */
function assertRailwayIdentity(env = ENV_AT_STARTUP, expected = S9D2A_RAILWAY) {
  const checks = [
    ['S9D2A_RAILWAY_PROJECT_ID', env.S9D2A_RAILWAY_PROJECT_ID, expected.projectId, 'project'],
    [
      'S9D2A_RAILWAY_ENVIRONMENT_ID',
      env.S9D2A_RAILWAY_ENVIRONMENT_ID,
      expected.environmentId,
      'environment',
    ],
    [
      'S9D2A_RAILWAY_DB_SERVICE_ID',
      env.S9D2A_RAILWAY_DB_SERVICE_ID,
      expected.databaseServiceId,
      'database service',
    ],
  ];
  for (const [name, got, want, what] of checks) {
    if (!got) {
      throw new S9d2aSafeError(
        `拒绝执行：缺少 ${name}。\n` +
          `本脚本只认一个目标：${expected.projectName} / ${expected.environmentName}。\n` +
          `请把该 ${what} 的 id 复述一遍（railway status --json 里读得到）。`,
      );
    }
    if (got !== want) {
      throw new S9d2aSafeError(
        `拒绝执行：${name} 与本脚本认定的 staging ${what} 不一致。\n` +
          `期望：${want}（${expected.projectName} / ${expected.environmentName}）\n` +
          '对不上说明目标选错了 —— 本脚本不接受其它项目。',
      );
    }
  }
}

/** 新加坡日历日（UTC+8），形如 `YYYY-MM-DD`。与 API 的 lessonDayKey 同口径。 */
function singaporeDay(nowMs = Date.now()) {
  return new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10);
}

/** 拼进 SQL 之前把日期钉死成 `YYYY-MM-DD`，杜绝任何非常量成分。 */
function assertDayShape(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) {
    throw new S9d2aSafeError('内部错误：日期格式必须是 YYYY-MM-DD');
  }
  return day;
}

// ─────────────────────────────────────────────────────────────
// 前置检查（只读）
// ─────────────────────────────────────────────────────────────

/**
 * 九项只读前置检查。**在同一个事务里、在任何写之前**跑完。
 *
 * 不靠「认得出生产库长什么样」（那需要把生产地址写进仓库），靠的是一个
 * 更硬的事实：真实名册里有几十个学生，而这个夹具只认识八个虚构 id。
 */
async function runPreflight(tx, { day }) {
  assertDayShape(day);
  const dayStart = `('${day}T00:00:00Z')::timestamptz`;

  const foreign = await tx.$queryRawUnsafe(
    `/* s9d2a:foreign-students */
     SELECT u.id AS id FROM "User" u
     WHERE u.role = 'student' AND u."isActive" = true
       AND u.id NOT IN (${FIXTURE_ID_LIST})
     LIMIT 5`,
  );
  if (foreign.length > 0) {
    throw new S9d2aSafeError(
      `拒绝执行：目标库里有 ${foreign.length}+ 个不属于本夹具的在读学生。\n` +
        `例如：${foreign.map((r) => r.id).join(', ')}\n` +
        '这几乎一定意味着 DATABASE_URL 指错了库。',
    );
  }

  const student = await tx.$queryRawUnsafe(
    `/* s9d2a:student */
     SELECT u.id AS id, u."englishLevel"::text AS level FROM "User" u
     WHERE u.id = ${T5} AND u.role = 'student' AND u."isActive" = true`,
  );
  if (student.length !== 1) {
    throw new S9d2aSafeError(
      `拒绝执行：找不到在读的 ${S9D2A_STUDENT_ID}。先跑通用种子 seed-eight-test-accounts.js。`,
    );
  }
  if (student[0].level !== 'olevel') {
    throw new S9d2aSafeError(
      `拒绝执行：${S9D2A_STUDENT_ID} 的 englishLevel 是 ${String(student[0].level)}，期望 olevel。\n` +
        '分级不对，服务端会挑到别的层，准备出来的场景不是这份合同要的那个。',
    );
  }

  const deps = await tx.$queryRawUnsafe(
    `/* s9d2a:dependencies */
     SELECT (SELECT count(*) FROM "Class" WHERE id = ${L(S9D2A_CLASS_ID)})::int              AS klass,
            (SELECT count(*) FROM "ClassEnrollment"
               WHERE "classId" = ${L(S9D2A_CLASS_ID)} AND "userId" = ${T5}
                 AND role = 'student')::int                                                 AS enrolled,
            (SELECT count(*) FROM "User"
               WHERE id = ${L(S9D2A_TEACHER_ID)} AND role = 'teacher')::int                 AS teacher,
            (SELECT count(*) FROM "Subject" WHERE id = ${L(S9D2A_SUBJECT_ID)})::int         AS subject,
            (SELECT count(*) FROM "StudentWord"
               WHERE "studentId" = ${T5} AND headword IN (${REVIEW_WORD_LIST}))::int        AS words`,
  );
  const d = deps[0] || {};
  const missing = [];
  if (Number(d.klass) !== 1) missing.push(`班级 ${S9D2A_CLASS_ID}`);
  if (Number(d.enrolled) !== 1) missing.push(`${S9D2A_STUDENT_ID} 在 ${S9D2A_CLASS_ID} 的学生注册`);
  if (Number(d.teacher) !== 1) missing.push(`班主任 ${S9D2A_TEACHER_ID}`);
  if (Number(d.subject) !== 1) missing.push(`科目 ${S9D2A_SUBJECT_ID}`);
  if (Number(d.words) !== S9D2A_REVIEW_WORDS.length) {
    missing.push(
      `${S9D2A_STUDENT_ID} 的四个复习词（现有 ${Number(d.words)} 个：${S9D2A_REVIEW_WORDS.join(' / ')}）`,
    );
  }
  if (missing.length > 0) {
    throw new S9d2aSafeError(
      `拒绝执行：缺少必需的既有夹具资源：\n  · ${missing.join('\n  · ')}\n` +
        '本脚本只新建自己的 s9d2_ 卷子资源，其余一律沿用 —— 先跑通用种子。',
    );
  }

  const notify = await tx.$queryRawUnsafe(
    `/* s9d2a:notification-guards */
     SELECT (SELECT count(*) FROM "NotificationConfig" WHERE enabled = true)::int AS enabled_configs,
            (SELECT count(*) FROM "NotificationLog")::int                          AS sent_logs`,
  );
  const g = notify[0] || {};
  if (Number(g.enabled_configs) !== 0) {
    throw new S9d2aSafeError(
      `拒绝执行：目标库里有 ${g.enabled_configs} 条启用的 NotificationConfig。\n` +
        '夹具库不该往外发任何通知 —— 先把它们关掉。',
    );
  }
  if (Number(g.sent_logs) !== 0) {
    throw new S9d2aSafeError(
      `拒绝执行：目标库里已有 ${g.sent_logs} 条 NotificationLog。\n` +
        '这说明它不是一个干净的夹具库。',
    );
  }

  const conflicts = await tx.$queryRawUnsafe(
    `/* s9d2a:conflicts */
     SELECT (SELECT count(*) FROM "Attendance"
               WHERE "sessionId" = ${L(S9D2A_OWNED_IDS.session)})::int                      AS attendance_rows,
            (SELECT count(*) FROM "StudentSubmission"
               WHERE "assignmentId" = ${L(S9D2A_OWNED_IDS.assignment)}
                 AND "studentId" <> ${T5})::int                                             AS foreign_subs,
            (SELECT count(*) FROM "VocabQuizAttempt"
               WHERE "studentId" = ${T5} AND date = DATE '${day}')::int                     AS t5_attempts,
            (SELECT count(*) FROM "MorningQuizSession"
               WHERE "classId" = ${L(S9D2A_CLASS_ID)} AND date = ${dayStart}
                 AND id <> ${L(S9D2A_OWNED_IDS.session)})::int                              AS other_sessions`,
  );
  const c = conflicts[0] || {};
  if (Number(c.attendance_rows) !== 0) {
    throw new S9d2aSafeError(
      `拒绝执行：${S9D2A_OWNED_IDS.session} 上已有 ${c.attendance_rows} 条考勤行。\n` +
        '本脚本从不写 Attendance —— 有行说明这个 id 被别的流程用过了。',
    );
  }
  if (Number(c.foreign_subs) !== 0) {
    throw new S9d2aSafeError(
      `拒绝执行：${S9D2A_OWNED_IDS.assignment} 上有 ${c.foreign_subs} 份**别人**的答卷。\n` +
        '本脚本只允许动 t5_review 一个人的答卷。',
    );
  }
  if (Number(c.t5_attempts) !== 0) {
    throw new S9d2aSafeError(
      `拒绝执行：${S9D2A_STUDENT_ID} 当天（${day}）已经有 ${c.t5_attempts} 份正式单词测试。\n` +
        '那是成绩证据，本脚本不删、也不覆盖。要重跑请先由人决定怎么处理它。',
    );
  }
  if (Number(c.other_sessions) !== 0) {
    throw new S9d2aSafeError(
      `拒绝执行：${S9D2A_CLASS_ID} 当天（${day}）已经有 ${c.other_sessions} 场**别的**场次。\n` +
        '两场同时 active 时服务端要在它们之间挑一场，准备出来的不一定是这一份。',
    );
  }

  return { day, student: S9D2A_STUDENT_ID };
}

// ─────────────────────────────────────────────────────────────
// 写入
// ─────────────────────────────────────────────────────────────

/**
 * 把 t5 当天的场景推回「可以从头走一遍」。
 *
 * **删除顺序按外键倒序**：`AnswerScript` → `StudentSubmission`
 * （`AnswerScript` 引用答卷；答卷引用作业单，所以作业单要更靠后删）。
 * 任务行（`DailyLessonCompletion`）没有被答卷引用，单独删；当天的
 * `VocabQuizAttempt` 由前置检查保证不存在，**这里一条都不碰**。
 *
 * **绝不写** `PRESERVED_TABLES` 里的任何一张表。
 */
async function applyPreparation(tx, { day }) {
  assertDayShape(day);
  const run = (sql) => tx.$executeRawUnsafe(sql);
  const at = (t) => `('${day}T${t}+08:00')::timestamptz AT TIME ZONE 'UTC'`;
  const dayStart = `('${day}T00:00:00Z')::timestamptz`;
  const asg = L(S9D2A_OWNED_IDS.assignment);
  const sess = L(S9D2A_OWNED_IDS.session);

  // ── 1. 清掉 t5 在本夹具作业单上的答卷 + 当天的任务行 ──
  await run(
    `DELETE FROM "AnswerScript" WHERE "submissionId" IN
       (SELECT id FROM "StudentSubmission"
         WHERE "studentId" = ${T5} AND "assignmentId" = ${asg})`,
  );
  await run(
    `DELETE FROM "StudentSubmission" WHERE "studentId" = ${T5} AND "assignmentId" = ${asg}`,
  );
  await run(`DELETE FROM "DailyLessonCompletion" WHERE "studentId" = ${T5} AND date = ${dayStart}`);

  // ── 2. 本夹具自有的卷子资源（固定 id，重复执行不产生第二份）──
  await run(
    `INSERT INTO "Paper"(id,name,"subjectId","ownerId",status,"durationMin","totalMarksTarget",
       "totalMarksActual","generatedSeed",config,"updatedAt")
     VALUES (${L(S9D2A_OWNED_IDS.paper)},${L(S9D2A_PAPER_TITLE)},${L(S9D2A_SUBJECT_ID)},
       ${L(S9D2A_TEACHER_ID)},'published',30,4,4,1,'{}'::jsonb,now())
     ON CONFLICT (id) DO NOTHING`,
  );
  for (let i = 0; i < S9D2A_STEMS.length; i++) {
    const content = {
      passage: S9D2A_PASSAGE,
      passageTitle: S9D2A_PAPER_TITLE,
      stem: S9D2A_STEMS[i],
    };
    const answer = { value: 'see passage' };
    await run(
      `INSERT INTO "Question"(id,"subjectId","createdById","questionType","sourceType",
         content,"answerContent",marks,"estimatedTimeMin",difficulty,status,"updatedAt")
       VALUES (${L(S9D2A_OWNED_IDS.questions[i])},${L(S9D2A_SUBJECT_ID)},${L(S9D2A_TEACHER_ID)},
         'short_answer','original_school',${J(content)},${J(answer)},1,2,3,'active',now())
       ON CONFLICT (id) DO NOTHING`,
    );
    await run(
      `INSERT INTO "PaperQuestion"(id,"paperId","questionId","sortOrder","snapshotContent","snapshotAnswer",marks)
       VALUES (${L(S9D2A_OWNED_IDS.paperQuestions[i])},${L(S9D2A_OWNED_IDS.paper)},
         ${L(S9D2A_OWNED_IDS.questions[i])},${i + 1},${J(content)},${J(answer)},1)
       ON CONFLICT (id) DO NOTHING`,
    );
  }

  // ── 3. 当天这一场（先删后建，只碰这两个固定 id）──
  await run(`DELETE FROM "MorningQuizSession" WHERE id = ${sess}`);
  await run(`DELETE FROM "PaperAssignment" WHERE id = ${asg}`);
  await run(
    `INSERT INTO "PaperAssignment"(id,"paperId","classId","assignedById","assignedAt","dueAt")
     VALUES (${asg},${L(S9D2A_OWNED_IDS.paper)},${L(S9D2A_CLASS_ID)},${L(S9D2A_TEACHER_ID)},
       now(),${at('23:59:00')})`,
  );
  await run(
    `INSERT INTO "MorningQuizSession"(id,date,"classId","paperAssignmentId","scheduledById",status,level,
       "attendanceStart","attendanceEnd","lateCutoff","quizStart","quizEnd","qrSecret")
     VALUES (${sess},${dayStart},${L(S9D2A_CLASS_ID)},${asg},${L(S9D2A_TEACHER_ID)},'active','olevel',
       ${at('08:30:00')},${at('08:40:00')},${at('08:59:59')},${at('08:30:00')},${at('09:00:00')},
       's9d2a-fixture-qr-secret-not-used')`,
  );

  // ── 4. 四个复习词回到「教过、已到期」──
  //
  // 只 UPDATE、不 INSERT：词是通用种子建的，本脚本不负责让它们存在
  // （前置检查已经确认四个都在）。`lastReview` 清空是有意的 —— 昨天那次
  // 复习的调度状态不该继续影响今天这一轮的场景。**历史 WordReviewLog
  // 一条都不删**（那是既成事实，且不落在今天，不参与今天的进度计数）。
  await run(
    `UPDATE "StudentWord"
        SET due = timezone('UTC',now()) - interval '1 hour',
            state = 'review',
            reps = 4,
            lapses = 0,
            stability = 3,
            difficulty = 5,
            "elapsedDays" = 0,
            "scheduledDays" = 0,
            "lastReview" = NULL,
            "firstTaughtAt" = timezone('UTC',now()) - interval '9 days',
            "updatedAt" = now()
      WHERE "studentId" = ${T5} AND headword IN (${REVIEW_WORD_LIST})`,
  );

  return {
    day,
    student: S9D2A_STUDENT_ID,
    sessionId: S9D2A_OWNED_IDS.session,
    assignmentId: S9D2A_OWNED_IDS.assignment,
    paperId: S9D2A_OWNED_IDS.paper,
    reviewWords: S9D2A_REVIEW_WORDS.length,
  };
}

/**
 * 第七道闸门 —— **写完了但还没提交**时回读一次。
 *
 * 两个东西必须自己证明自己：
 *   · 场次落库的日历日**正好**是当天（`date` 是 `@db.Date`，写进去的是
 *     一个 timestamptz，转换取决于会话时区；错一天就等于今天没有课）；
 *   · 四个复习词**正好**改到四行，且四行都到期、都「教过」。
 *
 * 任何一条不成立就抛 —— 事务整体回滚，库里什么都不会留下。
 */
async function verifyAfterWrite(tx, { day }) {
  assertDayShape(day);
  const rows = await tx.$queryRawUnsafe(
    `/* s9d2a:verify */
     SELECT (SELECT to_char(date,'YYYY-MM-DD') FROM "MorningQuizSession"
               WHERE id = ${L(S9D2A_OWNED_IDS.session)})                                    AS session_day,
            (SELECT status::text FROM "MorningQuizSession"
               WHERE id = ${L(S9D2A_OWNED_IDS.session)})                                    AS session_status,
            (SELECT count(*) FROM "PaperQuestion"
               WHERE "paperId" = ${L(S9D2A_OWNED_IDS.paper)})::int                          AS question_count,
            (SELECT count(*) FROM "StudentWord"
               WHERE "studentId" = ${T5} AND headword IN (${REVIEW_WORD_LIST})
                 AND due <= timezone('UTC',now())
                 AND "firstTaughtAt" IS NOT NULL)::int                                      AS due_taught_words,
            (SELECT count(*) FROM "DailyLessonCompletion"
               WHERE "studentId" = ${T5}
                 AND date = ('${day}T00:00:00Z')::timestamptz)::int                         AS t5_dlc_today`,
  );
  const v = rows[0] || {};
  if (v.session_day !== day) {
    throw new S9d2aSafeError(
      `回滚：场次落库的日历日是 ${String(v.session_day)}，期望 ${day}。\n` +
        '差一天等于「今天没有课」—— 宁可什么都不留下。',
    );
  }
  if (v.session_status !== 'active') {
    throw new S9d2aSafeError(
      `回滚：场次状态是 ${String(v.session_status)}，期望 active。\n` +
        '服务端只把 active 的场次当成「已发布」。',
    );
  }
  if (Number(v.question_count) !== S9D2A_STEMS.length) {
    throw new S9d2aSafeError(
      `回滚：卷子上有 ${Number(v.question_count)} 道题，期望 ${S9D2A_STEMS.length} 道。`,
    );
  }
  if (Number(v.due_taught_words) !== S9D2A_REVIEW_WORDS.length) {
    throw new S9d2aSafeError(
      `回滚：到期且教过的复习词有 ${Number(v.due_taught_words)} 个，期望 ${S9D2A_REVIEW_WORDS.length} 个。`,
    );
  }
  if (Number(v.t5_dlc_today) !== 0) {
    throw new S9d2aSafeError(
      `回滚：${S9D2A_STUDENT_ID} 当天仍有 ${Number(v.t5_dlc_today)} 条任务行。\n` +
        '本脚本必须把当天的任务行留给学生自己开 —— 阶段要走出来，不是写出来。',
    );
  }
  return {
    sessionDay: v.session_day,
    sessionStatus: v.session_status,
    questionCount: Number(v.question_count),
    dueTaughtWords: Number(v.due_taught_words),
    dlcToday: Number(v.t5_dlc_today),
  };
}

/**
 * 事务体 —— **只读检查 → 写入 → 回读校验**，三段在同一个事务里。
 *
 * 单独导出是为了让测试能跑**真的这段组合**，而不是只扫源码里的调用顺序：
 * 假事务客户端记下读写序列，就能证明「第一条写语句出现在所有前置读之后」，
 * 以及「回读校验出现在所有写之后」。
 */
async function prepareInTransaction(tx, { day }) {
  await runPreflight(tx, { day });
  const result = await applyPreparation(tx, { day });
  const verified = await verifyAfterWrite(tx, { day });
  return { ...result, verified };
}

// ─────────────────────────────────────────────────────────────
// 入口
// ─────────────────────────────────────────────────────────────

async function main() {
  // 闸门先过 —— **在这之前不加载 Prisma、不建连接**。
  assertEnvGates();
  assertRailwayIdentity();

  // 延迟 require：让「没给 DATABASE_URL」不会被 dotenv 悄悄补上。
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: ENV_AT_STARTUP.DATABASE_URL } },
  });

  try {
    const day = singaporeDay();
    // 超时**必须显式给**：Prisma 交互式事务默认只有 5 秒，而这一个事务里
    // 有 5 条前置读 + 十几条写 + 1 条回读；从本机经公共 TCP 代理连 staging，
    // 每条语句往返约 200 ms，默认值每次都会在提交前被关掉（P2028 全部回滚）。
    // 放宽的只是时间预算：语句、顺序、原子性一个字都没变。
    const result = await prisma.$transaction((tx) => prepareInTransaction(tx, { day }), {
      timeout: 60_000,
      maxWait: 10_000,
    });
    printReceipt(result);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 回执。
 *
 * **只允许出现**：日期、学生 id、夹具资源 id、复习词个数，以及一句
 * 「t5 当天的阅读答卷与任务行已被重置」的警告。
 * 连接串、凭据、令牌、PIN、口令哈希、主机、端口 —— 一个都不打印。
 */
function printReceipt(result, log = console.log) {
  log(`\nS9D2A 当天前置已准备（${result.day}）`);
  log(`  学生：${result.student}（只此一个）`);
  log(`  当天场次：${result.sessionId}（作业单 ${result.assignmentId}，卷子 ${result.paperId}）`);
  log(`  复习词重置：${result.reviewWords} 个`);
  log(
    '\n⚠️ t5_review 当天的阅读答卷与任务行已被重置，四个复习词已回到「教过、已到期」。\n' +
      '   另外七个账号、历史复习流水、登录凭据与令牌版本未被改动。\n' +
      '   当天的任务行**没有**被创建 —— 它必须由学生自己打开课程页时开出来。\n',
  );
}

module.exports = {
  S9D2A_STUDENT_ID,
  FIXTURE_STUDENT_IDS,
  S9D2A_CLASS_ID,
  S9D2A_TEACHER_ID,
  S9D2A_SUBJECT_ID,
  S9D2A_REVIEW_WORDS,
  S9D2A_OWNED_IDS,
  S9D2A_RAILWAY,
  S9D2A_PASSAGE,
  S9D2A_STEMS,
  PRESERVED_TABLES,
  DESTRUCTIVE_CONFIRMATION,
  assertEnvGates,
  assertRailwayIdentity,
  singaporeDay,
  assertDayShape,
  runPreflight,
  applyPreparation,
  verifyAfterWrite,
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
