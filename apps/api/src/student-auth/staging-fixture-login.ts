/**
 * ⚠️ **临时的 staging 测试通道 —— 上生产之前必须拆掉。**
 *
 * 一个**免密码**的一键登录，只能登进**一个虚构账号**：`t6_done`
 * （「测试六号」，邮箱 `@example.invalid`，只存在于 staging 的隔离库里）。
 *
 * ## 为什么存在
 *
 * staging 的真机验证要反复走「登录 → 上课 → 考试」这条链，而自动化那一侧
 * 不经手 PIN。与其把口令搬来搬去，不如让**一个虚构账号**在**一个虚构环境**
 * 里免密登录：没有 PIN 参与，就没有 PIN 会泄漏。
 *
 * ## 用户已明确接受的风险
 *
 * 开着的时候，**任何能打开 staging 登录页的人都能进 `t6_done`**，并改动
 * 它那份虚构数据。用户书面接受了这一条。它**不延伸**到生产、教师、真实
 * 学生、Railway / 数据库凭据，或另外七个夹具账号。
 *
 * ## 四道闸门（缺一不可，且没有覆盖开关）
 *
 *   1. `STAGING_FIXTURE_LOGIN` 必须**逐字**等于 `t6_done`；
 *      不设 = 关闭（端点 404、前端不渲染按钮）；设成别的值 = **拒绝启动**。
 *   2. `RAILWAY_PROJECT_ID` 必须逐字等于 staging 项目 id；
 *   3. `RAILWAY_PUBLIC_DOMAIN` 必须逐字等于 stg-api 的公开域名；
 *   4. 签发之前再查一次库：`role=student`、`isActive`、`archivedAt=null`、
 *      有未归档班级的在读注册、`studentAuthVersion` 取当下值。
 *
 * 第 2、3 条是这一整套设计的支点：**生产环境即使误配了第 1 条也起不来**
 * —— 它的 project id 与域名不可能等于 staging 的。所以「忘了拆」的最坏
 * 后果是生产**拒绝启动**（响亮地失败），而不是生产多出一个免密入口
 * （静默地失败）。
 *
 * **没有 force / override / bypass。** 一旦有了，上面四道就只是提示。
 *
 * ## 怎么关掉（退役步骤）
 *
 *   · 运维：把 `STAGING_FIXTURE_LOGIN`（stg-api）与
 *     `VITE_STAGING_FIXTURE_LOGIN`（stg-student-web-spike）**删掉**
 *     —— 是删掉变量，不是设成空串；然后各自重新部署。
 *   · 代码：`git revert` 引入本文件的那个提交。
 *
 * **阶段 15（灰度切换）之前、以及任何一次生产部署之前，必须完成退役。**
 */

/** 本通道**唯一**认识的账号。它是白名单，不是默认值 —— 请求给不了别的。 */
export const STAGING_FIXTURE_STUDENT_ID = 't6_done' as const;

/** staging 项目身份（不是密钥，是地址 —— `railway status` 谁都读得到）。 */
export const STAGING_PROJECT_ID = 'ed8c31c0-6499-4611-830a-64043189f7d0' as const;

/** stg-api 的公开域名。生产的域名不可能等于它。 */
export const STAGING_API_PUBLIC_DOMAIN = 'stg-api-production-46cf.up.railway.app' as const;

/** 环境变量名 —— 前后端各一个，值都必须逐字是 `t6_done`。 */
export const STAGING_FIXTURE_ENV_KEY = 'STAGING_FIXTURE_LOGIN' as const;
export const STAGING_FIXTURE_WEB_ENV_KEY = 'VITE_STAGING_FIXTURE_LOGIN' as const;

export type StagingFixtureLoginConfig =
  | { enabled: false }
  | { enabled: true; studentId: typeof STAGING_FIXTURE_STUDENT_ID };

/**
 * 配置错误。**只在「开关点了名但环境对不上」时抛** —— 不设开关是正常的
 * 关闭状态，不是错误。
 */
export class StagingFixtureConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StagingFixtureConfigError';
  }
}

type Env = Record<string, string | undefined>;

/**
 * 读配置。**不设 = 关闭；设了但环境对不上 = 抛错**（调用方在启动时把它
 * 变成「拒绝启动」）。
 *
 * 刻意不做任何 trim / 大小写归一：这个开关只有一个合法值，模糊匹配只会
 * 制造「我以为关了其实开着」。
 */
export function readStagingFixtureLoginConfig(env: Env): StagingFixtureLoginConfig {
  const raw = env[STAGING_FIXTURE_ENV_KEY];
  if (raw === undefined || raw === '') return { enabled: false };

  if (raw !== STAGING_FIXTURE_STUDENT_ID) {
    throw new StagingFixtureConfigError(
      `${STAGING_FIXTURE_ENV_KEY} 的值只接受逐字的 "${STAGING_FIXTURE_STUDENT_ID}"。\n` +
        '这是一个免密登录通道，模糊匹配等于让拼错的值也能把它打开。',
    );
  }
  if (env.RAILWAY_PROJECT_ID !== STAGING_PROJECT_ID) {
    throw new StagingFixtureConfigError(
      `${STAGING_FIXTURE_ENV_KEY} 只能在 staging 项目里打开。\n` +
        `期望 RAILWAY_PROJECT_ID = ${STAGING_PROJECT_ID}。\n` +
        '生产环境即使误配了这个开关也会停在这里 —— 这正是它的用途。',
    );
  }
  if (env.RAILWAY_PUBLIC_DOMAIN !== STAGING_API_PUBLIC_DOMAIN) {
    throw new StagingFixtureConfigError(
      `${STAGING_FIXTURE_ENV_KEY} 只能在 stg-api 上打开。\n` +
        `期望 RAILWAY_PUBLIC_DOMAIN = ${STAGING_API_PUBLIC_DOMAIN}。`,
    );
  }
  return { enabled: true, studentId: STAGING_FIXTURE_STUDENT_ID };
}

/**
 * 启动自检。与 `assertAllDayConfig` 同一个形状：**宁可起不来**，
 * 也不要一个「以为关着其实开着」的免密入口。
 */
export function assertStagingFixtureLoginConfig(env: Env): { ok: true; summary: string } | { ok: false; reason: string } {
  try {
    const cfg = readStagingFixtureLoginConfig(env);
    return {
      ok: true,
      summary: cfg.enabled
        ? `⚠️ staging 免密夹具登录**已开启**（仅 ${STAGING_FIXTURE_STUDENT_ID}）—— 上生产前必须退役`
        : 'staging 免密夹具登录：关闭',
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
