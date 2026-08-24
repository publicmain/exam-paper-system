-- 埋点盲区修复（2026-08-24 研究性分析 #0）：
-- 翻卡复习页此前没有任何埋点 kind，交卷后链路的触达从未被统计；
-- 成绩页词汇横幅需要点击埋点作转化率分子。
ALTER TYPE "PageViewKind" ADD VALUE IF NOT EXISTS 'vocab_review';
ALTER TYPE "PageViewKind" ADD VALUE IF NOT EXISTS 'vocab_banner';
