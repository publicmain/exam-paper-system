/**
 * S12L —— 试点期的功能开关。
 *
 * ## 为什么是常量，不是环境变量
 *
 * 这是**产品决定**，不是部署差异。环境变量会让 staging 与生产静默分叉，
 * 而「错题本现在开不开放」必须两边一样、必须在代码评审里看得见、必须
 * 能被测试钉住。改一行、跑一遍测试、部署 —— 这就是恢复它的全部代价。
 *
 * 前端有一份同名镜像（`apps/student-web/src/routes.contract.ts`），
 * 两边由守卫测试断言相等。
 */

export type FeatureState = 'available' | 'paused';

/**
 * 错题本与错题重练。
 *
 * 暂停期间：
 *   · 补段的目标恒为 0，**服务端一次错题查询都不发**；
 *   · 它不进今天的分母、不挡阶段推进、不影响连续天数；
 *   · 五个错题端点返回 503 `feature_paused`；
 *   · **采集侧照常**（判分时仍然收录错题），数据一行不少。
 */
export const MISTAKES_FEATURE: FeatureState = 'paused';

/** 学生看到的那句话。段落投影与占位页共用同一份文案。 */
export const MISTAKES_UNAVAILABLE_REASON = '错题重练暂未开放 · 不计入今日完成';

export function mistakesAvailable(): boolean {
  return MISTAKES_FEATURE === 'available';
}
