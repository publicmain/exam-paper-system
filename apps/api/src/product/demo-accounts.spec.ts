import { describe, expect, it } from 'vitest';
import { demoRules, isDemoAccount, isDemoClass } from './demo-accounts';

describe('演示 / QA 账号识别', () => {
  it('默认：QA 盲测账号前缀与两个 QA 班算演示；普通 id 不算', () => {
    const r = demoRules({});
    expect(isDemoAccount('p1_qa_acc_07', r)).toBe(true);
    expect(isDemoAccount('cm_real_student', r)).toBe(false);
    expect(isDemoClass('p1_class_qa', r)).toBe(true);
    expect(isDemoClass('p1_class', r)).toBe(true);
    expect(isDemoClass('sec27w', r)).toBe(false);
  });

  it('环境变量追加具体账号 id；逗号分隔、去空格', () => {
    const r = demoRules({ DEMO_ACCOUNT_IDS: ' teacher_demo_1 , stu_demo_2 ' });
    expect(isDemoAccount('teacher_demo_1', r)).toBe(true);
    expect(isDemoAccount('stu_demo_2', r)).toBe(true);
    expect(isDemoAccount('p1_qa_acc_1', r)).toBe(true);
  });

  it('设成空串 = 关掉默认值', () => {
    const r = demoRules({ DEMO_ACCOUNT_PREFIXES: '', DEMO_CLASS_IDS: '' });
    expect(isDemoAccount('p1_qa_acc_07', r)).toBe(false);
    expect(isDemoClass('p1_class_qa', r)).toBe(false);
  });
});
