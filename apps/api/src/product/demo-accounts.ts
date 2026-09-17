/**
 * 演示 / QA 账号识别（F05 / F07，2026-09-15）。
 *
 * 班级汇总（周目标）、全校统计、以后的学校报表**一律排除**这些账号；它们自己的个人记录照常能看。
 * 生产按环境变量配，不在代码里写死真实账号：
 *
 *   · `DEMO_ACCOUNT_IDS`       逗号分隔的用户 id（默认空）；
 *   · `DEMO_ACCOUNT_PREFIXES`  用户 id 前缀，默认 `p1_qa_acc_`（QA 盲测账号）；
 *   · `DEMO_CLASS_IDS`         演示 / QA 班级 id，默认 `p1_class_qa,p1_class`。
 *
 * 变量设成空串 = 关掉那一项的默认值。
 */
type Env = Record<string, string | undefined>;

export interface DemoRules {
  ids: ReadonlySet<string>;
  prefixes: readonly string[];
  classIds: ReadonlySet<string>;
}

const DEFAULT_PREFIXES = ['p1_qa_acc_'];
const DEFAULT_CLASS_IDS = ['p1_class_qa', 'p1_class'];

function list(raw: string | undefined, fallback: readonly string[]): string[] {
  if (raw == null) return [...fallback];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function demoRules(env: Env = process.env): DemoRules {
  return {
    ids: new Set(list(env.DEMO_ACCOUNT_IDS, [])),
    prefixes: list(env.DEMO_ACCOUNT_PREFIXES, DEFAULT_PREFIXES),
    classIds: new Set(list(env.DEMO_CLASS_IDS, DEFAULT_CLASS_IDS)),
  };
}

export function isDemoAccount(userId: string, rules: DemoRules = demoRules()): boolean {
  return rules.ids.has(userId) || rules.prefixes.some((p) => userId.startsWith(p));
}

export function isDemoClass(classId: string, rules: DemoRules = demoRules()): boolean {
  return rules.classIds.has(classId);
}
