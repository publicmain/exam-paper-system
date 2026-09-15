/**
 * 学习周报不算哪些账号 / 班级（2026-09-15）。
 *
 * 与升级分支 `product/demo-accounts.ts` 用**同一组环境变量、同一个含义**，两边合并后
 * 可以直接换成那一份：
 *
 *   · `DEMO_ACCOUNT_IDS`       逗号分隔的用户 id
 *   · `DEMO_ACCOUNT_PREFIXES`  用户 id 前缀，默认 `p1_qa_acc_`（QA 盲测 / 验收账号）
 *   · `DEMO_CLASS_IDS`         演示 / QA 班级 id，默认 `p1_class_qa,p1_class`
 *
 * 变量设成空串 = 关掉那一项的默认值。
 *
 * 和那一份唯一的不同：`DEMO_ACCOUNT_IDS` **没配置**时，默认排除两个已知的测试号 ——
 * 叶老师自己的「老师测试号」和 9/2 建的「用户验收账号」。它们都挂在真实班 IAL28S 里，
 * 不排除的话每周都会多出两个「整周没做」的人。上线时在 Railway 配上 `DEMO_ACCOUNT_IDS`
 * 之后，这里的默认值就不起作用。
 */
type Env = Record<string, string | undefined>;

export interface ReportExclusions {
  ids: ReadonlySet<string>;
  prefixes: readonly string[];
  classIds: ReadonlySet<string>;
}

const DEFAULT_IDS = ['cmtqgmjl200u6stuq31xrad59', 'cmtjkrzy8014gutrz29rnhjb9'];
const DEFAULT_PREFIXES = ['p1_qa_acc_'];
const DEFAULT_CLASS_IDS = ['p1_class_qa', 'p1_class'];

function list(raw: string | undefined, fallback: readonly string[]): string[] {
  if (raw == null) return [...fallback];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function reportExclusions(env: Env = process.env): ReportExclusions {
  return {
    ids: new Set(list(env.DEMO_ACCOUNT_IDS, DEFAULT_IDS)),
    prefixes: list(env.DEMO_ACCOUNT_PREFIXES, DEFAULT_PREFIXES),
    classIds: new Set(list(env.DEMO_CLASS_IDS, DEFAULT_CLASS_IDS)),
  };
}

export function isExcludedAccount(userId: string, rules: ReportExclusions): boolean {
  return rules.ids.has(userId) || rules.prefixes.some((p) => userId.startsWith(p));
}

export function isExcludedClass(classId: string, rules: ReportExclusions): boolean {
  return rules.classIds.has(classId);
}
