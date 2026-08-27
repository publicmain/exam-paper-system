/**
 * 真机测试用的八个虚构账号 —— staging / 本地专用种子。
 *
 * 对应 `docs/manual-device-test-plan.md` 第 2 节那张表。重建计划的
 * 阶段 1 要求把它纳入版本管理（原来只存在于临时目录里，换一台机器
 * 或换一次会话就没了）。
 *
 * ## 为什么是 .js 而不是 .ts
 *
 * 它当初是为了在**已部署的容器里**跑而写的 —— 那里只有编译好的
 * `dist/` 和 `@prisma/client`，没有 TypeScript 工具链。保持纯 JS，
 * 将来无论落到哪种执行环境都不需要额外的构建步骤。
 *
 * （**但现在还不能在 `stg-api` 容器里跑** —— 那个服务是
 * `NODE_ENV=production`，第 1 道闸门会拒绝。详见下面「在 staging
 * 容器里跑不通」一节。）
 *
 * ## 性质
 *
 * - **全部是虚构数据**。八个「测试N号」不对应任何真实学生，
 *   邮箱一律 `@example.invalid`（RFC 6761 保留域，永远解析不出去）。
 * - **测试场景层面可重复（幂等）**，**不是逐字节确定性**。每次先清掉
 *   这八个 id 的当日痕迹，再重建成预期初始态；测试把数据点乱了，
 *   重跑一次，八个账号回到 `docs/manual-device-test-plan.md` 第 2 节
 *   那张表描述的场景。**但落库的字节不完全一样**，见下面两条。
 *
 * - **每次运行会变的东西**（不要假设它们稳定）：
 *
 *   1. **bcrypt 哈希**。`passwordHash` 与 `pinHash` 的输入是常量，
 *      但 bcrypt 每次用新的盐，落库的哈希字符串每次都不同。校验结果
 *      相同 —— 同一个 PIN 照样能登录。
 *   2. **`studentAuthVersion` 每次 +1**（见下面的 `ON CONFLICT DO
 *      UPDATE`）。这是**有意为之**：它是令牌撤销计数器，加一就让
 *      **之前签发的所有学生令牌立刻失效**。所以重新播种 = 把这八个
 *      账号在所有设备上踢下线，正在测试的人要重新登录。这正是我们
 *      想要的（重置就该是干净的重置），但**必须知道会发生**。
 *   3. **相对时间戳**。`due`、`firstTaughtAt`、`submittedAt` 等按
 *      「此刻减去 N 小时/天」写入，所以两次运行的绝对时刻不同。
 *      场景语义不变（「一小时前到期」「九天前教过」）。
 *
 * - **不含任何生产 URL、凭据或密钥**。连接串完全来自 `DATABASE_URL`；
 *   测试 PIN 必须由 `STAGING_SEED_PIN` 显式给出 —— 本文件里没有
 *   任何密码值。
 *
 * ## 跑法
 *
 * ```bash
 * # 本地隔离库
 * ALLOW_TEST_SEED=yes STAGING_SEED_PIN=<6 位测试 PIN> DATABASE_URL=<本地库> \
 *   node apps/api/scripts/staging/seed-eight-test-accounts.js
 * ```
 *
 * PIN 的取值见 `docs/manual-device-test-plan.md` 第 2 节 —— 那是给
 * 八个虚构账号用的临时口令，不放进这个文件。
 *
 * ## ⚠️ 在 staging 容器里跑不通 —— 而且这是对的
 *
 * 直觉的写法是这样：
 *
 * ```bash
 * railway ssh --service stg-api \
 *   "cd /app/apps/api && ALLOW_TEST_SEED=yes STAGING_SEED_PIN=<...> node <路径>"
 * ```
 *
 * **它会被第 1 道闸门拒绝。** `stg-api` 这个服务的环境变量里
 * `NODE_ENV=production`（为了让 staging 与生产用同一套运行模式跑，
 * 这本身是刻意的），而第 1 道闸门看的就是 `NODE_ENV`。
 *
 * **不要为此加覆盖开关。** 「production 环境里不许播种」这条规则的
 * 价值全在于它没有例外 —— 一旦有了 `--force`，它就只是个提示。
 *
 * 正确的解法是**为夹具找一个安全的执行环境**，而不是削弱闸门。
 * 这件事被列为阶段 3 与阶段 14 的前置（见
 * `docs/reconstruction/migration-plan.md`），在有结论之前
 * **不得执行本夹具**。可能的方向（都还没验证）：
 *
 *   · 一个 `NODE_ENV` 不是 production 的一次性任务容器
 *   · 给 staging 的 Postgres 开一条临时的外网通道，从本机跑
 *   · staging 单独用一个非 production 的 `NODE_ENV` 值
 *
 * 三条各有代价，选哪条是阶段 3 的事。
 *
 * ## 安全闸门（四道）
 *
 * 1. `NODE_ENV=production` → **无条件拒绝**，没有覆盖开关。
 * 2. 必须显式 `ALLOW_TEST_SEED=yes` —— 让「跑到哪个库上」成为一个
 *    有意识的动作。
 * 3. `DATABASE_URL` **必须显式传给这个进程**。
 * 4. 目标库里若存在**不属于这八个 id 的在读学生**，一律拒绝。
 *    这一条不需要知道生产库长什么样：真实名册里有几十个学生，
 *    指错库时它就会拦下来。
 *
 * ### 第 3 道为什么要在 require 之前取快照
 *
 * `require('@prisma/client')` 会顺手加载仓库根的 `.env`（dotenv），
 * 把 `DATABASE_URL` 填成**本机开发库**。如果闸门在 require 之后才读
 * `process.env`，「我没给连接串」会被悄悄翻译成「那就用开发库吧」——
 * 正是这道闸门要防的那类事故。所以先取快照，再 require。
 */

// ⚠️ 顺序有意义：先拍环境快照，再加载任何会碰 dotenv 的东西。
const ENV_AT_STARTUP = {
  NODE_ENV: process.env.NODE_ENV || '',
  ALLOW_TEST_SEED: process.env.ALLOW_TEST_SEED || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  STAGING_SEED_PIN: process.env.STAGING_SEED_PIN || '',
};

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────────────────────
// 固定数据（全部虚构）
// ─────────────────────────────────────────────────────────────

/**
 * 测试 PIN —— **必须由环境变量给出，本文件不带默认值**。
 *
 * 这八个账号是虚构的，PIN 也只是 staging 的临时口令，但把任何口令
 * 写进版本库都不是好习惯：一旦有了默认值，它就会跟着仓库到处走，
 * 而且没人再想起来改。
 */
const PIN = ENV_AT_STARTUP.STAGING_SEED_PIN;

const WORDS = {
  harbour: 'n. 海港', lantern: 'n. 灯笼', meadow: 'n. 草地', pebble: 'n. 卵石',
  ripple: 'n. 涟漪', vessel: 'n. 船', willow: 'n. 柳树', anchor: 'n. 锚',
};

/** [id, 姓名, englishLevel, classId, 这个账号是为了测什么] */
const STUDENTS = [
  ['t1_normal',    '测试一号', 'olevel', 'tc1', '正常已定级学生'],
  ['t2_nolevel',   '测试二号', null,     'tc1', 'englishLevel = null，开始课程时自动定级'],
  ['t3_noatt',     '测试三号', 'olevel', 'tc1', '无任何考勤记录，照样能上课'],
  ['t4_newwords',  '测试四号', 'olevel', 'tc1', '纯新词（四个词都没教过）'],
  ['t5_review',    '测试五号', 'olevel', 'tc1', '纯复习（四个词都教过、已到期）'],
  ['t6_done',      '测试六号', 'olevel', 'tc1', '今天已全部完成，词汇满分'],
  ['t7_nocontent', '测试七号', 'olevel', 'tc2', '今天没有内容（该班没排课）'],
  ['t8_zero',      '测试八号', 'olevel', 'tc1', '正式词汇测试 0 分 + 阶段未推进的旧坏行'],
];
const IDS = STUDENTS.map((s) => s[0]);

const CLASSES = [['tc1', 'G11 实测班'], ['tc2', 'G12 无内容班']];
const TEACHER_ID = 't_stgteacher';

const TASK = ['harbour', 'lantern', 'meadow', 'pebble'];
const REVIEW = ['ripple', 'vessel', 'willow', 'anchor'];

const PAPER_TITLE = 'Harbour Town（实测样卷）';
const PASSAGE =
  'The harbour has served the town for four centuries. Fishing boats still leave before dawn, ' +
  'and the old lantern on the pier is lit every evening by a volunteer. Visitors walk the meadow ' +
  'path above the water, where pebbles from the shore have been used to mark the way.';
const STEMS = [
  '第 1 题：港口为这座城镇服务了多久？',
  '第 2 题：码头上的灯是谁点的？',
  '第 3 题：游客沿什么路走？',
  '第 4 题：岸边的卵石被用来做什么？',
];

// ─────────────────────────────────────────────────────────────
// SQL 字面量
//
// 值全部内联而不是走参数，因为 Prisma 的 $executeRawUnsafe 对参数
// 类型推断挑剔（枚举、jsonb、interval 都会踩）。这里所有值都是本文件
// 里的常量，没有任何外部输入，注入面为零。
// ─────────────────────────────────────────────────────────────

const L = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const J = (o) => `${L(JSON.stringify(o))}::jsonb`;

// ─────────────────────────────────────────────────────────────
// 安全闸门
// ─────────────────────────────────────────────────────────────

function assertNotProduction() {
  if (ENV_AT_STARTUP.NODE_ENV.toLowerCase() === 'production') {
    throw new Error(
      '拒绝执行：NODE_ENV=production。\n' +
        '这个脚本会删除并重建八个账号的当日数据，只能跑在 staging 或本地隔离库上。\n' +
        '没有覆盖开关 —— 如果你确实要在一个 NODE_ENV=production 的进程里播种，\n' +
        '说明目标选错了。',
    );
  }
  if (ENV_AT_STARTUP.ALLOW_TEST_SEED.toLowerCase() !== 'yes') {
    throw new Error(
      '拒绝执行：需要显式 ALLOW_TEST_SEED=yes。\n' +
        '这一道闸门是为了让「跑到哪个库上」成为一个有意识的动作。',
    );
  }
  if (!ENV_AT_STARTUP.DATABASE_URL) {
    throw new Error(
      '拒绝执行：没有显式传入 DATABASE_URL。\n' +
        '注意：仓库根的 .env 里有一个开发库连接串，@prisma/client 会自动加载它。\n' +
        '本脚本刻意**不接受**那个来源 —— 目标库必须由你在命令行里指定。',
    );
  }
  if (!/^\d{6,}$/.test(PIN)) {
    throw new Error(
      '拒绝执行：需要 STAGING_SEED_PIN（至少 6 位数字）。\n' +
        '本文件刻意不带默认口令。取值见 docs/manual-device-test-plan.md 第 2 节。',
    );
  }
}

/**
 * 第 4 道闸门 —— 目标库里不能有别人。
 *
 * 前三道只看环境变量，在连库之前就拦下了。**这一道需要一次只读
 * 查询**，所以它是唯一一个「已经连上库」之后才生效的闸门 ——
 * 但它仍然在任何写操作之前。
 *
 * 不靠「认得出生产库长什么样」（那需要把生产地址写进仓库，正是不能做的
 * 事），靠的是一个更硬的事实：真实名册里有几十个学生，而这个夹具只认识
 * 八个虚构 id。指错库 → 查出别人 → 拒绝。
 */
async function assertOnlyOurStudents(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT u.id, u.name FROM "User" u
     WHERE u.role = 'student' AND u."isActive" = true
       AND u.id NOT IN (${IDS.map(L).join(',')})
     LIMIT 5`,
  );
  if (rows.length > 0) {
    throw new Error(
      `拒绝执行：目标库里有 ${rows.length}+ 个不属于本夹具的在读学生。\n` +
        `例如：${rows.map((r) => r.id).join(', ')}\n` +
        '这几乎一定意味着 DATABASE_URL 指错了库。本夹具只能跑在\n' +
        '「除了这八个虚构账号之外没有别的学生」的库上。',
    );
  }
}

// ─────────────────────────────────────────────────────────────

async function main() {
  assertNotProduction();

  // 显式传库 —— 不让 Prisma 回落到 .env 里的开发库。
  const prisma = new PrismaClient({
    datasources: { db: { url: ENV_AT_STARTUP.DATABASE_URL } },
  });
  const run = (sql) => prisma.$executeRawUnsafe(sql);
  const idList = IDS.map(L).join(',');

  await assertOnlyOurStudents(prisma);

  // 当天（SGT）。时间是脚本唯一的外部输入 —— 下面的相对偏移
  // （「一小时前」「九天前」）每次跑出来的绝对时刻都不同，
  // 但场景语义不变。
  const day = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const at = (t) => `('${day}T${t}+08:00')::timestamptz AT TIME ZONE 'UTC'`;

  // ── 幂等清理：只删这八个 id 的痕迹 ──
  await run(`DELETE FROM "AnswerScript" WHERE "submissionId" IN
             (SELECT id FROM "StudentSubmission" WHERE "studentId" IN (${idList}))`);
  await run(`DELETE FROM "VocabQuizAttempt" WHERE "studentId" IN (${idList})`);
  await run(`DELETE FROM "WordReviewLog" WHERE "studentWordId" IN
             (SELECT id FROM "StudentWord" WHERE "studentId" IN (${idList}))`);
  await run(`DELETE FROM "StudentSubmission" WHERE "studentId" IN (${idList})`);
  await run(`DELETE FROM "DailyLessonCompletion" WHERE "studentId" IN (${idList})`);
  await run(`DELETE FROM "StudentWord" WHERE "studentId" IN (${idList})`);
  await run(`DELETE FROM "Attendance" WHERE "studentId" IN (${idList})`);

  // 两个哈希的**输入都是常量**，但 bcrypt 每次换盐 —— 落库的字符串
  // 每次都不同，校验结果相同。所以本夹具是「场景可重复」，不是
  // 「逐字节确定性」，不要拿哈希值做断言。
  const pw = await bcrypt.hash('staging-fixture-placeholder-not-a-login-path', 4);
  const pin = await bcrypt.hash(PIN, 10);

  // ── 词典 ──
  for (const [w, tr] of Object.entries(WORDS)) {
    await run(`INSERT INTO "DictEntry"(word,phonetic,pos,translation,definition,tag,bnc)
               VALUES (${L(w)},'/x/','n.',${L(tr)},'a thing','{}',4000)
               ON CONFLICT (word) DO NOTHING`);
  }

  // ── 班级与班主任 ──
  for (const [id, nm] of CLASSES) {
    await run(`INSERT INTO "Class"(id,name,"classCode","updatedAt")
               VALUES (${L(id)},${L(nm)},${L(nm)},now())
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`);
  }
  await run(`INSERT INTO "User"(id,email,name,role,"passwordHash","isActive")
             VALUES (${L(TEACHER_ID)},'stg-teacher@example.invalid','测试班主任','teacher',${L(pw)},true)
             ON CONFLICT (id) DO NOTHING`);
  for (const [cid] of CLASSES) {
    await run(`INSERT INTO "ClassEnrollment"(id,"classId","userId",role)
               VALUES (${L('e_t_' + cid)},${L(cid)},${L(TEACHER_ID)},'teacher')
               ON CONFLICT (id) DO NOTHING`);
  }

  // ── 八个学生 ──
  for (const [id, name, level, cid] of STUDENTS) {
    const lvl = level ? `${L(level)}::"EnglishLevel"` : 'NULL';
    // 注意 `studentAuthVersion + 1`：这是令牌撤销计数器。重新播种会
    // **让这八个账号之前签发的所有令牌立刻失效** —— 正在手机上测试
    // 的人会被踢回登录页。这是有意的（重置就该是干净的重置），
    // 但它也意味着本夹具在这一点上不是「无副作用的重放」。
    await run(`INSERT INTO "User"(id,email,name,role,"passwordHash","pinHash","isActive","englishLevel","studentAuthVersion")
               VALUES (${L(id)},${L(id + '@example.invalid')},${L(name)},'student',${L(pw)},${L(pin)},true,${lvl},1)
               ON CONFLICT (id) DO UPDATE
                 SET name=EXCLUDED.name, "pinHash"=EXCLUDED."pinHash",
                     "englishLevel"=EXCLUDED."englishLevel", "isActive"=true,
                     "studentAuthVersion"="User"."studentAuthVersion"+1`);
    await run(`INSERT INTO "ClassEnrollment"(id,"classId","userId",role)
               VALUES (${L('e_' + id)},${L(cid)},${L(id)},'student')
               ON CONFLICT (id) DO NOTHING`);
  }

  // ── 样卷 ──
  await run(`INSERT INTO "ExamBoard"(id,name,code) VALUES ('stg_eb','StagingBoard','STGB')
             ON CONFLICT (id) DO NOTHING`);
  await run(`INSERT INTO "Subject"(id,"examBoardId",code,name,level)
             VALUES ('stg_sub','stg_eb','9999','Staging English','O_LEVEL')
             ON CONFLICT (id) DO NOTHING`);
  await run(`INSERT INTO "Paper"(id,name,"subjectId","ownerId",status,"durationMin","totalMarksTarget",
               "totalMarksActual","generatedSeed",config,"updatedAt")
             VALUES ('stg_p',${L(PAPER_TITLE)},'stg_sub',${L(TEACHER_ID)},'published',30,4,4,1,'{}'::jsonb,now())
             ON CONFLICT (id) DO NOTHING`);

  for (let i = 1; i <= 4; i++) {
    const content = { passage: PASSAGE, passageTitle: PAPER_TITLE, taskType: 'short', stem: STEMS[i - 1] };
    const ans = { value: 'see passage' };
    await run(`INSERT INTO "Question"(id,"subjectId","createdById","questionType","sourceType",
                 content,"answerContent",marks,"estimatedTimeMin",difficulty,status,"updatedAt")
               VALUES (${L('stg_q' + i)},'stg_sub',${L(TEACHER_ID)},'short_answer','original_school',
                 ${J(content)},${J(ans)},1,2,3,'active',now())
               ON CONFLICT (id) DO NOTHING`);
    await run(`INSERT INTO "PaperQuestion"(id,"paperId","questionId","sortOrder","snapshotContent","snapshotAnswer",marks)
               VALUES (${L('stg_pq' + i)},'stg_p',${L('stg_q' + i)},${i},${J(content)},${J(ans)},1)
               ON CONFLICT (id) DO NOTHING`);
  }

  // ── 今天的场次 ──
  // 时间窗写**生产口径 08:30–09:00** —— 全天开放靠 MORNING_QUIZ_ALL_DAY
  // 开关，不靠把窗口放宽。这样 staging 测的才是真正的开关行为。
  await run(`DELETE FROM "MorningQuizSession" WHERE id='stg_sess'`);
  await run(`DELETE FROM "PaperAssignment" WHERE id='stg_asg'`);
  await run(`INSERT INTO "PaperAssignment"(id,"paperId","classId","assignedById","assignedAt","dueAt")
             VALUES ('stg_asg','stg_p','tc1',${L(TEACHER_ID)},now(), ${at('23:59:00')})`);
  await run(`INSERT INTO "MorningQuizSession"(id,date,"classId","paperAssignmentId","scheduledById",status,level,
               "attendanceStart","attendanceEnd","lateCutoff","quizStart","quizEnd","qrSecret")
             VALUES ('stg_sess',('${day}T00:00:00Z')::timestamptz,'tc1','stg_asg',${L(TEACHER_ID)},'active','olevel',
               ${at('08:30:00')}, ${at('08:40:00')}, ${at('08:59:59')}, ${at('08:30:00')}, ${at('09:00:00')},
               'staging-fixture-qr-secret-not-used')`);

  // ── 每个账号的初始态 ──
  const mkWord = (sid, w, i, o = {}) =>
    run(`INSERT INTO "StudentWord"(id,"studentId",headword,"surfaceForm","contextSentence",
           "sourcePassageTitle","sourceType",due,stability,difficulty,reps,lapses,state,"firstTaughtAt","updatedAt")
         VALUES (${L(sid + '_w' + i)},${L(sid)},${L(w)},${L(w)},${L(`The ${w} lay still in the evening light.`)},
           ${L(PAPER_TITLE)},'click', timezone('UTC',now()) - interval '1 hour',
           ${o.stability ?? 0},5,${o.reps ?? 0},0,${L(o.state ?? 'new')},${o.taught ?? 'NULL'},now())`);

  for (const sid of ['t1_normal', 't2_nolevel', 't3_noatt', 't4_newwords']) {
    for (const [i, w] of TASK.entries()) await mkWord(sid, w, i);
  }
  for (const [i, w] of REVIEW.entries()) {
    await mkWord('t5_review', w, i, {
      taught: `timezone('UTC',now()) - interval '9 days'`, reps: 4, stability: 3, state: 'review',
    });
  }

  for (const sid of ['t6_done', 't8_zero']) {
    for (const [i, w] of TASK.entries()) {
      await mkWord(sid, w, i, { taught: `timezone('UTC',now()) - interval '2 hours'` });
    }
    await run(`INSERT INTO "StudentSubmission"(id,"assignmentId","studentId",status,"totalScore","maxScore",
                 "startedAt","submittedAt","finalSubmittedAt","submitSource")
               VALUES (${L('sub_' + sid)},'stg_asg',${L(sid)},'graded',3,4,
                 timezone('UTC',now()) - interval '2 hours',
                 timezone('UTC',now()) - interval '90 minutes',
                 timezone('UTC',now()) - interval '90 minutes','student')`);
    // 注意 stage='vocab_test'：t8 靠它构造出「卷子交了但阶段没推进」的
    // 旧坏行（RC1.1-E 修复前的形态），用来验证它不会卡住学生。
    // t6 在下面被推到 done。
    await run(`INSERT INTO "DailyLessonCompletion"(id,"studentId",date,"readTarget","vocabTarget","drillTarget",
                 "vocabWords","targetsFrozenAt","rulesVersion",stage,"vocabCursor","updatedAt")
               VALUES (${L('dlc_' + sid)},${L(sid)},('${day}T00:00:00Z')::timestamptz,1,4,0,
                 ${J(TASK)},now(),2,'vocab_test',4,now())`);
  }

  // 答题时间由当天日期推出来，不用 new Date() —— 保证确定性。
  const answeredAt = `${day}T01:00:00.000Z`;
  const mkItems = (correct) =>
    TASK.map((w) => ({
      qtype: 'word_to_meaning', headword: w, prompt: w,
      options: [WORDS[w], '别的意思 A', '别的意思 B', '别的意思 C'],
      correctIndex: 0, answer: null, phonetic: null, translation: WORDS[w],
      contextSentence: null,
      studentIndex: correct ? 0 : 1,
      studentAnswer: correct ? WORDS[w] : '别的意思 A',
      isCorrect: correct, answeredAt,
    }));

  await run(`INSERT INTO "VocabQuizAttempt"(id,"studentId",date,"dailyLessonCompletionId",status,
               "startedAt","submittedAt",total,correct,score,items,"updatedAt")
             VALUES ('att_t8','t8_zero',('${day}T00:00:00Z')::timestamptz,'dlc_t8_zero','submitted',
               timezone('UTC',now()) - interval '80 minutes',
               timezone('UTC',now()) - interval '75 minutes',4,0,0,${J(mkItems(false))},now())`);
  await run(`INSERT INTO "VocabQuizAttempt"(id,"studentId",date,"dailyLessonCompletionId",status,
               "startedAt","submittedAt",total,correct,score,items,"updatedAt")
             VALUES ('att_t6','t6_done',('${day}T00:00:00Z')::timestamptz,'dlc_t6_done','submitted',
               timezone('UTC',now()) - interval '80 minutes',
               timezone('UTC',now()) - interval '75 minutes',4,4,100,${J(mkItems(true))},now())`);
  await run(`UPDATE "DailyLessonCompletion" SET stage='done' WHERE id='dlc_t6_done'`);

  // t7 无内容：tc2 班今天不排课，也不给词 —— 什么都不用做。

  // ── 回执 ──
  const rows = await prisma.$queryRawUnsafe(
    `SELECT u.name AS name, u.id AS id, u."englishLevel"::text AS level, c.name AS class
     FROM "User" u JOIN "ClassEnrollment" e ON e."userId"=u.id
     JOIN "Class" c ON c.id=e."classId"
     WHERE u.id IN (${idList}) ORDER BY u.id`,
  );
  console.log(`\n播种完成（${day}），PIN = ${PIN}：`);
  for (const r of rows) {
    console.log(`  ${r.name}  ${String(r.id).padEnd(13)} ${String(r.level)}  ${r.class}`);
  }

  const chk = await prisma.$queryRawUnsafe(
    `SELECT (SELECT count(*) FROM "NotificationConfig" WHERE enabled = true)::int AS notify_enabled,
            (SELECT count(*) FROM "NotificationLog")::int                        AS notify_sent,
            (SELECT count(*) FROM "Attendance")::int                             AS attendance,
            (SELECT count(*) FROM "MorningQuizSession" WHERE id='stg_sess')::int AS session_today`,
  );
  console.log('\n环境自查（前三项必须为 0，最后一项必须为 1）：', JSON.stringify(chk[0]));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('\n播种未执行 / 失败：\n' + (e && e.message ? e.message : e) + '\n');
  process.exit(1);
});
