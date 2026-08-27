-- P8.5 —— 答案的客户端单调序号。
--
-- 在这之前 saveAnswer 是无条件 upsert：两个针对同一题的请求乱序到达
-- （重试、弱网、双击、debounce 撞车），后落库的赢。实测「旧 → 新 →
-- 延迟到达的旧」，库里留下的是旧答案 —— 学生改过的答案被自己的上一次
-- 请求覆盖掉。
--
-- clientSeq 由前端按题单调递增，服务端只接受比库里更大的值。
-- 可空：历史行没有序号，第一次带序号的写入照常放行。
ALTER TABLE "AnswerScript" ADD COLUMN "clientSeq" INTEGER;
