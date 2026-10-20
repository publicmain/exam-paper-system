# 每日推词的校园内容闸门

每日新词顺着 NGSL / NAWL 按排名往后取，例句从 Tatoeba 这类公开语料拉，搭配词
再从例句里切。三样素材没有一样是为中学课堂做的：词表是通用语料排名，Tatoeba
是成年人写给成年人的开放语料。这份文档记两次事故和它们各自补上的那一层。

## 第一层：词级闸门（2026-09-21）

叶老师截图：olevel 学生当天单词测试第 1 题是 `breast`「n. 胸部, 乳房, 胸怀」。
核对生产库：`sex` 已推给 12 人（09-07 起），`breast` 7 人（09-09 起），
`sperm`（nawl@164）、`sexual`（ngsl@1609）都在各档射程内。

`school-safe-words.ts`：`BLOCKED` 10 个词（自动推送与学生查词都不给）+
`GLOSS` 6 个词（词留着，中文释义用人工版本盖掉词典堆砌的义项）。老师在词表里
手动指定的词、学生在文章里点开的词不受限 —— 前者是老师对自己班的明确决定，
后者他已经读到了，拦下来只会让工具显得坏掉。

## 第二层：句子级闸门（2026-10-20）

### 出了什么事

叶老师收到学生端截图：9/30 的单词测试里，`oral` 这个词答对后的卡片上写着

> **oral** adj. 口头的, 口述的, 口部的
> What is oral sex?

`oral` 是 NAWL 第 173 名，一个再正经不过的学术词，词级闸门照常放行。脏的是
**例句**，而第一层从来不看句子。中文翻译还老老实实跟着写了「什麼是口交？」。

### 捅了多大

| | 数量 |
|---|---|
| 「What is oral sex?」 | 19 个学生 · 24 次 · 09-28 ～ 10-20 |
| 全库同类脏例句 | 78 条 |
| 这 78 条推送 | 43 个学生 · 121 人次 · 最早 09-07 |
| 受影响的搭配词 | 38 个义项 |

不只是性内容。同一批语料还喂出了「Hitler decided to commit suicide.」
「Ziri is a terrorist.」「Russia is a terrorist state.」「I am a drug addict.」
以及好几句 fuck。

**搭配词是同一个病根的同一处伤口**：`collocationsFromExamples()` 就是从这些
例句里切两连词，所以 `oral` 的搭配里列着 "oral sex"、`yourself` 的搭配里是
**"kill yourself"**、`adolescents` 的是 "adolescents masturbate"。

### 真正的成因不是「没有名单」

名单好加。难的是 `contextForEncounter()` 里那串「挑不出就退回上一层」的兜底：

```ts
const ready = contexts.filter((row) => !row.qualityStatus || row.qualityStatus === 'ready');
const readyPool = ready.length ? ready : [...contexts];   // ← 这里
```

这些兜底是为「空例句框比略难的句子更糟」写的，本身没错，但它们**偏偏在最该
拦住的时候失效**：一个词只有一条例句、那一条正好是脏的，干净池子就是空的，
于是退回用全部 —— 脏句子原路返回。78 条里有 64 条正是该词唯一的例句。

所以光把数据标成 `blocked_school` 不够，必须在进池子之前硬过滤。

### 现在怎么拦

`school-safe-sentences.ts`，中英文都查（Tatoeba 的中译是另一批人贡献的，
英文干净中文露骨的情况真实存在），接在四处：

1. `tatoebaExamples()` —— 源头。例句和搭配词一起干净。
2. 写库时 —— AI 生成的例句不走 Tatoeba 那条路，必须独立再查一遍。脏的照样
   写进库留痕，但状态是 `blocked_school`，推送和查词的查询都带
   `qualityStatus: 'ready'`，拿不到。
3. `contextForEncounter()` —— 推送前硬过滤，剔到空就返回 `null`。调用方全是
   `context?.sentence ?? null`，学生看到的是没有例句，不会白屏。
4. `cardSnapshot()` 的搭配 / 词族 / 易混词 / 记忆提示 —— 发出去前最后一道。

**不拦**学科里正当的用法，这同样是硬要求：`asexual reproduction` 不含
`\bsexual\b` 的词边界所以天然放行；`primary alcohols into aldehydes`（化学）、
`high blood pressure`（医学）、`jumped the gun`（习语）、`My hip is killing me.`
（习语）、`numerical analysis`、`shell casing`、`help yourself` 同理。
`Tea is drunk more widely than…` 是被动语态的「喝」，所以闸门只拦
`get/got/super drunk` 那一类，不用光秃秃的 `\bdrunk\b`。
`school-safe-sentences.spec.ts` 两组用例各守一头：41 条真实脏例句必须拦下，
15 条学科用法必须放行。

### 历史数据怎么清的

一次事务，演练确认影响行数后提交：78 条例句状态改 `blocked_school`、121 条
任务快照里冻住的句子和中文翻译擦成 `null`、38 个义项的脏搭配剔掉、98 条快照
的搭配按词库重新对齐。清完复查 `oral sex` / `kill yourself` / `masturbate`
全库残留均为 0。

旧任务的快照必须一起擦 —— 学生能翻回去看历史任务，叶老师拿到的那张截图就是
9/30 的旧任务。

## 教训

**词干净不代表句子干净，句子干净不代表从它切出来的词组干净。** 每多一层自动
生成，就多一个没人看过的出口。09-21 补了词这一层，没想到句子；10-20 补句子这
一层时顺着 `collocationsFromExamples` 才摸到搭配词也中招。下次再引入任何「从
语料自动派生给学生看的东西」，先问它经不经过闸门。

**兜底逻辑要和闸门一起看。** 「挑不出就退回上一层」是为可用性写的，和「这条
不许给学生看」是直接冲突的两种意图。凡是有安全含义的过滤，必须在所有兜底
**之前**做掉，不能作为偏好项混在排序里。
