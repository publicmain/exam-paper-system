-- 早测 3.0：英语等级从 3 个扩到 5 个
--
-- 新增两个：
--   ielts_light          雅思轻量（250-350 词短文 + 6 题 + 词汇），
--                        设计风格对齐 O-Level 基础层，但保留雅思题型骨架
--                        （TFNG + 句子填空），练的是雅思的思维方式。
--   olevel_intermediate  O-Level 进阶 —— 复活 ai_authored_olevel_1128_simplified
--                        桶里那 21 篇中间难度内容。「轻雅思」层停用后它们
--                        一直没有任何等级在读，白白闲置。
--
-- 为什么不顺手把 ielts_simplified 改名成 olevel_basic：那个枚举位的语义
-- 已经变过一次（原「轻雅思」→ 2026-08-14 起是「O-Level 基础」），库里挂着
-- 几个月的场次 / 答卷 / 考勤。重命名要改枚举并回填全部历史行，风险远大于
-- 收益。代码里用 level-registry.ts 一张映射表统一对外显示名，禁止别处硬编码。
--
-- ⚠️ ALTER TYPE ... ADD VALUE 在 Postgres 里**不能跑在事务块内**。Prisma
-- migrate 默认把每个迁移文件包进事务，所以这两条必须单独成文件、且文件里
-- 不能有其他语句 —— 否则报 "ALTER TYPE ... cannot run inside a transaction block"。
ALTER TYPE "EnglishLevel" ADD VALUE IF NOT EXISTS 'ielts_light';
ALTER TYPE "EnglishLevel" ADD VALUE IF NOT EXISTS 'olevel_intermediate';
