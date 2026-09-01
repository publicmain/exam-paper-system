# 试点第一周 —— 教师答案与批改手册

> **生成文件，不要手改。** 来源是 `apps/api/scripts/pilot/content/`，
> 改完内容跑一次 `node apps/api/scripts/pilot/make-teacher-pack.js` 重新生成。
>
> **不要把这份文件发给学生。** 客观题的答案在他交卷之后才由服务端下发，
> 主观题的参考答案与评分标准从来不下发给学生端。

## 每天要批多少

| 项 | 数 |
| --- | --- |
| 每天题数 | 10 |
| 其中**服务端当场判**（客观题） | 6 |
| 其中**要老师批**（主观题） | 4 |
| 每天目标词 | 21 |
| 每个学生每天的批改量 | **4 题** |
| 10 个学生的每日批改量 | **40 题**（估 15–20 分钟） |

批改入口：`/api/marker/*` 的判分队列。**不要用 AI 判分** —— 本项目零 Anthropic API 调用。

---

# 2026-08-31

## O-Level —— 《The Night Market Cleans Up》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **B** （FALSE） | The stallholders were not careless people. |
| 2 | 判断题 | **A** （TRUE） | wrote to the town council, not about the noise, but about the drain |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **B** （the council officer） | He agreed with her, and then admitted that there was no budget for a s |
| 5 | 特征配对 | **D** （the recycling firm） | A recycling firm offered to buy clean cardboard by weight |
| 6 | 选择题 | **B** （Sorting the waste began to pay the stalls.） | The turning point was economic rather than moral. |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Complete the sentence with ONE WORD ONLY from the passage.
> Every stall in the experiment received two ______, one for food waste and one for cardboard.

- **参考答案**：crates
- **也算对**：crates / two crates
- **评分标准**：只认原文里的 crates（单复数均可）。写 boxes / baskets 不给分 —— 题干要求 ONE WORD ONLY FROM THE PASSAGE。
- **原文依据**：Each stall was given two crates, one for food waste and one for cardboard
- **为什么**：第三段逐字写了每个摊位得到两个 crates。

#### 第 8 题 · 完成句子 · 1 分

> The council used Rafi’s ______ as evidence when it applied for a grant.

- **参考答案**：notebook
- **也算对**：notebook / his notebook / Rafi's notebook
- **评分标准**：只认 notebook。写 record / diary 不给分（题干要求原文词）。
- **原文依据**：became the evidence the council used when it applied for a proper grant
- **为什么**：第四段：Rafi 的本子后来成了市政厅申请拨款时用的证据。

#### 第 9 题 · 摘要填空 · 2 分

> Complete the summary with a number or words from the passage.
> In the first month only nine stalls joined, but within a term ______ stalls were sorting their waste.

- **参考答案**：thirty-four
- **也算对**：thirty-four / 34 / thirty four
- **评分标准**：写 thirty-four 或 34 都算对（全分）。只写 nine 或其他数字不给分。拼写错但数目对（thirtyfour）给一半。
- **原文依据**：Within a term, thirty-four stalls were sorting their waste.
- **为什么**：第四段直接给了这个数字。

#### 第 10 题 · 简答题 · 2 分

> Answer in NO MORE THAN TEN WORDS.
> Give ONE reason why Rafi says the market is still not spotless.

- **参考答案**：because glass still breaks and a crate is sometimes missing
- **评分标准**：两分：给出原文里的任一条理由（玻璃仍会碎 / 有时找不到第二个筐）并表达清楚 = 2 分；意思对但表达含糊 = 1 分；写原文没说的理由（比如「学生懒」）= 0 分。
- **原文依据**：Glass still breaks, and there are Thursdays when nobody can find the second crate.
- **为什么**：最后一段给了两条具体理由，任一条即可。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | flatten | flattened | /ˈflætn/ | v. | v. 压平，压扁 |
| 2 | carton | cartons | /ˈkɑːtn/ | n. | n. 纸盒，纸板箱 |
| 3 | drift | drifting | /drɪft/ | v. | v. 漂流，随风飘动 |
| 4 | careless | careless | /ˈkeələs/ | adj. | adj. 粗心的，不在乎的 |
| 5 | rubbish | rubbish | /ˈrʌbɪʃ/ | n. | n. 垃圾，废物 |
| 6 | complaint | complaint | /kəmˈpleɪnt/ | n. | n. 投诉，抱怨 |
| 7 | retired | retired | /rɪˈtaɪəd/ | adj. | adj. 退休的 |
| 8 | council | council | /ˈkaʊnsl/ | n. | n. 市政厅，议会 |
| 9 | monsoon | monsoon | /mɒnˈsuːn/ | n. | n. 季风；雨季 |
| 10 | admit | admitted | /ədˈmɪt/ | v. | v. 承认 |
| 11 | budget | budget | /ˈbʌdʒɪt/ | n. | n. 预算 |
| 12 | experiment | experiment | /ɪkˈsperɪmənt/ | n. | n. 实验，尝试 |
| 13 | crate | crates | /kreɪt/ | n. | n. 箱，筐 |
| 14 | volunteer | volunteer | /ˌvɒlənˈtɪə/ | n. | n. 志愿者 |
| 15 | allowance | allowance | /əˈlaʊəns/ | n. | n. 津贴，零用钱 |
| 16 | voluntary | voluntary | /ˈvɒləntri/ | adj. | adj. 自愿的，非强制的 |
| 17 | economic | economic | /ˌiːkəˈnɒmɪk/ | adj. | adj. 经济上的 |
| 18 | moral | moral | /ˈmɒrəl/ | adj. | adj. 道德的 |
| 19 | separate | separated | /ˈsepəreɪt/ | v. | v. 分开，分类 |
| 20 | evidence | evidence | /ˈevɪdəns/ | n. | n. 证据 |
| 21 | spotless | spotless | /ˈspɒtləs/ | adj. | adj. 一尘不染的 |

## O-Level 基础（ielts_simplified） —— 《The Bicycle Doctor》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **A** （TRUE） | On a narrow street behind the market there is a shop with no sign. |
| 2 | 判断题 | **B** （FALSE） | Uncle Poh does not charge them. |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **B** （the girl from the secondary school） | A girl from the secondary school brought in a flat tyre and asked if s |
| 5 | 特征配对 | **C** （his own children） | His own children think he should rest. |
| 6 | 选择题 | **A** （A broken thing is not always rubbish.） | A student who can mend a puncture understands that a broken thing is n |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Complete the sentence with ONE WORD ONLY from the passage.
> In the shop, wheels hang from the ______.

- **参考答案**：ceiling
- **也算对**：ceiling / the ceiling
- **评分标准**：只认 ceiling。写 roof / wall 不给分 —— 题干要求原文词。
- **原文依据**：Wheels hang from the ceiling.
- **为什么**：第二段第二句就是「轮子挂在天花板上」。

#### 第 8 题 · 完成句子 · 1 分

> Uncle Poh says that most problems make a ______ before they become serious.

- **参考答案**：sound
- **也算对**：sound / a sound
- **评分标准**：只认 sound。写 noise 不给分 —— 题干要求原文里的那个词。
- **原文依据**：he says that most problems make a sound before they become serious
- **为什么**：第二段末句，也是他「先听后修」的理由。

#### 第 9 题 · 摘要填空 · 2 分

> Complete the summary with words or numbers from the passage.
> Every Saturday morning ______ students sit on the floor of the shop.

- **参考答案**：six or seven
- **也算对**：six or seven / 6 or 7 / six to seven
- **评分标准**：两分：写出 six or seven（或 6 or 7）= 2 分；只写 six 或只写 seven = 1 分；写别的数字 = 0 分。
- **原文依据**：Now, every Saturday morning, six or seven students sit on the floor of the shop and learn to fix their own bicycles.
- **为什么**：第三段末句给了这个数字。

#### 第 10 题 · 简答题 · 2 分

> Answer in NO MORE THAN TEN WORDS.
> Why does Uncle Poh not want to rest on Saturdays?

- **参考答案**：because the shop is noisy and full of young people
- **评分标准**：两分：写出「店里热闹 / 满是年轻人」= 2 分；只写「他喜欢工作」= 1 分；写原文没说的（比如「他缺钱」）= 0 分。
- **原文依据**：But on Saturday the shop is noisy and full of young people, and Uncle Poh says he has never felt less like resting.
- **为什么**：最后一段把理由与结论写在同一句里。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | narrow | narrow | /ˈnærəʊ/ | adj. | adj. 狭窄的 |
| 2 | sign | sign | /saɪn/ | n. | n. 招牌，标志 |
| 3 | repair | repairs | /rɪˈpeə/ | v. | v. 修理 |
| 4 | neighbour | neighbours | /ˈneɪbə/ | n. | n. 邻居 |
| 5 | crowded | crowded | /ˈkraʊdɪd/ | adj. | adj. 拥挤的 |
| 6 | ceiling | ceiling | /ˈsiːlɪŋ/ | n. | n. 天花板 |
| 7 | screw | screws | /skruː/ | n. | n. 螺丝 |
| 8 | chain | chains | /tʃeɪn/ | n. | n. 链条 |
| 9 | cable | cables | /ˈkeɪbl/ | n. | n. 缆线 |
| 10 | customer | customers | /ˈkʌstəmə/ | n. | n. 顾客 |
| 11 | serious | serious | /ˈsɪəriəs/ | adj. | adj. 严重的 |
| 12 | secondary | secondary | /ˈsekəndri/ | adj. | adj. 中学的 |
| 13 | tyre | tyre | /ˈtaɪə/ | n. | n. 轮胎 |
| 14 | tool | tools | /tuːl/ | n. | n. 工具 |
| 15 | charge | charge | /tʃɑːdʒ/ | v. | v. 收费 |
| 16 | mend | mend | /mend/ | v. | v. 修补 |
| 17 | puncture | puncture | /ˈpʌŋktʃə/ | n. | n. 扎破的洞（爆胎） |
| 18 | rubbish | rubbish | /ˈrʌbɪʃ/ | n. | n. 垃圾 |
| 19 | earn | earned | /ɜːn/ | v. | v. 挣（钱） |
| 20 | stiff | stiff | /stɪf/ | adj. | adj. 僵硬的 |
| 21 | noisy | noisy | /ˈnɔɪzi/ | adj. | adj. 吵闹的 |

## IELTS（ielts_authentic） —— 《The Slow Science of Coral》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **B** （FALSE） | The scientists who run the nurseries are, almost without exception, mo |
| 2 | 判断题 | **A** （TRUE） | those fragments can reach transplantable size in under a year |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **B** （keeping spawning density） | It can maintain a population above the density at which spawning succe |
| 5 | 特征配对 | **C** （buying time） | And it can buy time in places where the underlying threat is expected  |
| 6 | 选择题 | **A** （Nursery output is tiny compared with the area that has been lost.） | A degraded reef is measured in square kilometres; a nursery output is  |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Complete the sentence with ONE WORD ONLY from the passage.
> In the nursery, fragments are sheltered from ______ and from grazing fish.

- **参考答案**：sediment
- **也算对**：sediment / from sediment
- **评分标准**：只认 sediment。写 mud / sand 不给分（题干要求原文词）。
- **原文依据**：Suspended on ropes or trays in clear water, sheltered from sediment and from the fish that graze on new growth, those fragments can reach transplantable size in under a year.
- **为什么**：第二段把两种威胁并列写出。

#### 第 8 题 · 完成句子 · 1 分

> A single fragment can become a colony of its own because coral grows ______.

- **参考答案**：clonally
- **也算对**：clonally / clonal
- **评分标准**：只认 clonally（clonal 也接受）。
- **原文依据**：A healthy colony is broken into fragments, and because coral grows clonally, each fragment can become a colony of its own.
- **为什么**：第二段直接给出了这个机制词。

#### 第 9 题 · 摘要填空 · 2 分

> Complete the summary with words from the passage.
> Even an optimistic estimate of global restoration capacity covers only ______ of the reef lost since 1980.

- **参考答案**：a fraction of one per cent
- **评分标准**：两分：写出「不到百分之一的一小部分」= 2 分；只写「不到 1%」= 1 分；写别的比例 = 0 分。
- **原文依据**：Even an optimistic estimate of global restoration capacity covers a fraction of one per cent of the reef that has been lost since 1980.
- **为什么**：第三段给了这个量级，是全文最关键的一个数字。

#### 第 10 题 · 简答题 · 2 分

> Answer in NO MORE THAN TWELVE WORDS.
> Why do some nurseries deliberately propagate from colonies that survived bleaching?

- **参考答案**：because tolerance to bleaching appears partly heritable
- **评分标准**：两分：写出「耐受性部分可遗传」= 2 分；只写「它们更强壮」= 1 分；写原文没说的（比如「它们长得更快」）= 0 分。
- **原文依据**：Some colonies survive bleaching events that kill their neighbours, and that tolerance appears partly heritable.
- **为什么**：最后一段说明了这是在做一场按十年计的选择育种。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | restoration | restoration | /ˌrestəˈreɪʃn/ | n. | n. 修复，恢复 |
| 2 | accompany | accompany | /əˈkʌmpəni/ | v. | v. 伴随，配有 |
| 3 | fragment | fragments | /ˈfræɡmənt/ | n. | n. 碎片，断枝 |
| 4 | reef | reef | /riːf/ | n. | n. 礁，珊瑚礁 |
| 5 | cautious | cautious | /ˈkɔːʃəs/ | adj. | adj. 谨慎的 |
| 6 | colony | colony | /ˈkɒləni/ | n. | n. 群体，珊瑚群落 |
| 7 | suspend | Suspended | /səˈspend/ | v. | v. 悬挂 |
| 8 | sediment | sediment | /ˈsedɪmənt/ | n. | n. 沉积物 |
| 9 | graze | graze | /ɡreɪz/ | v. | v. 啃食 |
| 10 | degraded | degraded | /dɪˈɡreɪdɪd/ | adj. | adj. 退化的，受损的 |
| 11 | optimistic | optimistic | /ˌɒptɪˈmɪstɪk/ | adj. | adj. 乐观的 |
| 12 | capacity | capacity | /kəˈpæsəti/ | n. | n. 能力，产能 |
| 13 | substitute | substitute | /ˈsʌbstɪtjuːt/ | v. | v. 替代 |
| 14 | practitioner | practitioner | /prækˈtɪʃənə/ | n. | n. 从业者 |
| 15 | diversity | diversity | /daɪˈvɜːsəti/ | n. | n. 多样性 |
| 16 | density | density | /ˈdensəti/ | n. | n. 密度 |
| 17 | fertilise | fertilise | /ˈfɜːtəlaɪz/ | v. | v. 受精 |
| 18 | underlying | underlying | /ˌʌndəˈlaɪɪŋ/ | adj. | adj. 根本的，潜在的 |
| 19 | sewage | sewage | /ˈsuːɪdʒ/ | n. | n. 污水 |
| 20 | tolerance | tolerance | /ˈtɒlərəns/ | n. | n. 耐受性 |
| 21 | heritable | heritable | /ˈherɪtəbl/ | adj. | adj. 可遗传的 |

---

# 2026-09-01

## O-Level —— 《Learning to Swim at Forty》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **A** （TRUE） | She had grown up ten minutes from the sea and had never once put her f |
| 2 | 判断题 | **B** （FALSE） | What made the difference, Mrs Tan says, was that Danny never used the  |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 判断题 | **B** （FALSE） | One classmate gave up entirely. |
| 5 | 特征配对 | **C** （the taxi driver） | Another, a taxi driver in his fifties, went on to swim across a reserv |
| 6 | 选择题 | **A** （He gave them facts they could test for themselves.） | Trust in the coach was built out of small, checkable facts rather than |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Complete the sentence with ONE WORD ONLY from the passage.
> In the first hour Danny taught the class to blow ______.

- **参考答案**：bubbles
- **也算对**：bubbles / blow bubbles
- **评分标准**：只认 bubbles。
- **原文依据**：The instructor, a patient man called Danny, spent most of the first hour teaching them to blow bubbles.
- **为什么**：第二段逐字写了第一个小时在学吐泡泡。

#### 第 8 题 · 完成句子 · 1 分

> Mrs Tan could not swim a full length until the ______ week.

- **参考答案**：ninth
- **也算对**：ninth / 9th / the ninth week
- **评分标准**：写 ninth 或 9th 都算对。写 third 不对 —— 那是学会仰浮的那一周。
- **原文依据**：Mrs Tan could float on her back in the third week but could not swim a length until the ninth.
- **为什么**：第四段把两个时间点写在同一句里，很容易看错。

#### 第 9 题 · 摘要填空 · 2 分

> Complete the summary with words from the passage.
> According to Danny, an adult who can ______ is very unlikely to drown in calm water.

- **参考答案**：float and turn onto their back
- **评分标准**：两分：同时写出「漂浮」与「翻身仰卧」两件事 = 2 分；只写其中一件 = 1 分；写「游得快」之类 = 0 分。
- **原文依据**：An adult who can float and turn onto their back is very unlikely to drown in calm water.
- **为什么**：最后一段将“不会溺水”的条件说得很具体。

#### 第 10 题 · 简答题 · 2 分

> Answer in NO MORE THAN TEN WORDS.
> What lesson had Mrs Tan absorbed from her parents as a child?

- **参考答案**：that water is only something to look at
- **评分标准**：两分：写出「水只是用来看的 / 不是用来下的」= 2 分；写「父母不会游泳」只算背景，给 1 分；写「水很危险」不给分（原文没这么说）。
- **原文依据**：water is something you look at
- **为什么**：第一段末句就是那句「没人说出口的课」。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | absorb | absorbed | /əbˈzɔːb/ | v. | v. 吸收；领会 |
| 2 | unspoken | unspoken | /ʌnˈspəʊkən/ | adj. | adj. 没说出口的 |
| 3 | frighten | frightened | /ˈfraɪtn/ | v. | v. 使害怕 |
| 4 | waist | waist | /weɪst/ | n. | n. 腰，腰部 |
| 5 | instructor | instructor | /ɪnˈstrʌktə/ | n. | n. 教练，指导者 |
| 6 | patient | patient | /ˈpeɪʃnt/ | adj. | adj. 有耐心的 |
| 7 | dread | dreading | /dred/ | v. | v. 恐惧，害怕 |
| 8 | float | float | /fləʊt/ | v. | v. 漂浮 |
| 9 | lung | lungs | /lʌŋ/ | n. | n. 肺 |
| 10 | stiff | stiff | /stɪf/ | adj. | adj. 僵硬的 |
| 11 | sink | sinks | /sɪŋk/ | v. | v. 下沉 |
| 12 | achieve | achieves | /əˈtʃiːv/ | v. | v. 达到，实现 |
| 13 | shallow | shallow | /ˈʃæləʊ/ | adj. | adj. 浅的 |
| 14 | instruction | instruction | /ɪnˈstrʌkʃn/ | n. | n. 指令，说明 |
| 15 | checkable | checkable | /ˈtʃekəbl/ | adj. | adj. 可验证的 |
| 16 | encouragement | encouragement | /ɪnˈkʌrɪdʒmənt/ | n. | n. 鼓励 |
| 17 | uneven | uneven | /ʌnˈiːvn/ | adj. | adj. 不均匀的，时快时慢的 |
| 18 | reservoir | reservoir | /ˈrezəvwɑː/ | n. | n. 水库 |
| 19 | insist | insists | /ɪnˈsɪst/ | v. | v. 坚持说 |
| 20 | drown | drown | /draʊn/ | v. | v. 溺水，淹死 |
| 21 | hobby | hobby | /ˈhɒbi/ | n. | n. 爱好 |

## O-Level 基础（ielts_simplified） —— 《Birds on the Eleventh Floor》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **B** （FALSE） | The birds had always been there; she had simply never looked up at the |
| 2 | 判断题 | **A** （TRUE） | Then her science teacher lent her a pair of old binoculars and asked h |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 判断题 | **A** （TRUE） | he has learned to recognise a myna by its walk |
| 5 | 特征配对 | **C** （the kingfisher） | A kingfisher, bright blue and completely unexpected, sat on the railin |
| 6 | 选择题 | **A** （Nobody else watches from an ordinary window at that hour.） | The survey needs ordinary places, her teacher explained, not only park |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Complete the sentence with ONE WORD OR NUMBER from the passage.
> By the end of the first month Amirah had seen ______ kinds of bird.

- **参考答案**：nineteen
- **也算对**：nineteen / 19
- **评分标准**：写 nineteen 或 19 都算对。写 four 不对 —— 那是第一周的数字。
- **原文依据**：By the end of the month she had seen nineteen.
- **为什么**：第二段把两个数字放在相邻的两句里，容易看错。

#### 第 8 题 · 完成句子 · 1 分

> Beside each bird’s name Amirah writes the date, the ______ and the exact place.

- **参考答案**：weather
- **也算对**：weather / the weather
- **评分标准**：只认 weather。写 time / temperature 不给分。
- **原文依据**：Beside each name she writes the date, the weather and the exact place.
- **为什么**：第三段第二句列出了她每次记的三样东西。

#### 第 9 题 · 摘要填空 · 2 分

> Complete the summary with words from the passage.
> Most of the birds appear ______, when the estate is still quiet.

- **参考答案**：between six and eight in the morning
- **评分标准**：两分：写出「早上六点到八点之间」= 2 分；只写「早上」= 1 分；写别的时间 = 0 分。
- **原文依据**：Most of them appear early, between six and eight in the morning, when the estate is still quiet.
- **为什么**：第二段末句给了准确的时间段。

#### 第 10 题 · 简答题 · 2 分

> Answer in NO MORE THAN TEN WORDS.
> What is Amirah doing for her younger brother now?

- **参考答案**：she is teaching him the four commonest birds
- **评分标准**：两分：写出「教弟弟认最常见的四种鸟」= 2 分；只写「教弟弟看鸟」= 1 分；写原文没说的（比如「带他去公园」）= 0 分。
- **原文依据**：Amirah is now teaching her younger brother the four commonest birds.
- **为什么**：最后一段第一句就写了她正在教弟弟认哪几种鸟。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | strip | strip | /strɪp/ | n. | n. 长条 |
| 2 | estate | estate | /ɪˈsteɪt/ | n. | n. 住宅区，小区 |
| 3 | lend | lent | /lend/ | v. | v. 借出 |
| 4 | binoculars | binoculars | /bɪˈnɒkjələz/ | n. | n. 双筒望远镜 |
| 5 | simply | simply | /ˈsɪmpli/ | adv. | adv. 仅仅，只是 |
| 6 | appear | appear | /əˈpɪə/ | v. | v. 出现 |
| 7 | quiet | quiet | /ˈkwaɪət/ | adj. | adj. 安静的 |
| 8 | cheap | cheap | /tʃiːp/ | adj. | adj. 便宜的 |
| 9 | exact | exact | /ɪɡˈzækt/ | adj. | adj. 确切的 |
| 10 | prefer | prefers | /prɪˈfɜː/ | v. | v. 更喜欢 |
| 11 | flowering | flowering | /ˈflaʊərɪŋ/ | adj. | adj. 开花的 |
| 12 | unexpected | unexpected | /ˌʌnɪkˈspektɪd/ | adj. | adj. 出乎意料的 |
| 13 | railing | railing | /ˈreɪlɪŋ/ | n. | n. 栏杆 |
| 14 | survey | survey | /ˈsɜːveɪ/ | n. | n. 调查 |
| 15 | national | national | /ˈnæʃnəl/ | adj. | adj. 全国的 |
| 16 | surprised | surprised | /səˈpraɪzd/ | adj. | adj. 惊讶的 |
| 17 | ordinary | ordinary | /ˈɔːdnri/ | adj. | adj. 普通的 |
| 18 | forest | forests | /ˈfɒrɪst/ | n. | n. 森林 |
| 19 | commonest | commonest | /ˈkɒmənɪst/ | adj. | adj. 最常见的 |
| 20 | bored | bored | /bɔːd/ | adj. | adj. 无聊的，厌倦的 |
| 21 | recognise | recognise | /ˈrekəɡnaɪz/ | v. | v. 认出 |

## IELTS（ielts_authentic） —— 《What the Ice Remembers》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **A** （TRUE） | In places where enough snow falls each winter, the boundary between on |
| 2 | 判断题 | **B** （FALSE） | Because the air continues to circulate in the porous upper layers befo |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **B** （chemical markers） | Where accumulation is slow, layers thin and merge, and the count must  |
| 5 | 特征配对 | **D** （publishing raw measurements） | Laboratories therefore ration their samples, and increasingly they pub |
| 6 | 选择题 | **A** （It is a record of one place, not of the whole world.） | It is a record of the atmosphere above a particular ice sheet, not of  |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Complete the sentence with ONE WORD ONLY from the passage.
> Dating a core by counting downwards is compared to counting the ______ of a tree.

- **参考答案**：rings
- **也算对**：rings / tree rings / the rings
- **评分标准**：只认 rings。写 layers 不给分 —— 题目问的是树的那一半比喻。
- **原文依据**：the boundary between one year and the next can be seen with the naked eye, and a core can be dated by counting downwards in the same way that one counts the rings of a tree
- **为什么**：第二段用树的年轮作比。

#### 第 8 题 · 完成句子 · 1 分

> The age offset between the gas and the surrounding ice must be ______ rather than measured.

- **参考答案**：modelled
- **也算对**：modelled / modeled
- **评分标准**：写 modelled 或美式 modeled 都算对。
- **原文依据**：the gas in a bubble is always somewhat younger than the ice around it, and the offset must be modelled rather than measured
- **为什么**：第四段把「建模」与「测量」明确对立起来。

#### 第 9 题 · 摘要填空 · 2 分

> Complete the summary with words from the passage.
> When two distant records disagree, the disagreement is often ______ to be reconciled away.

- **参考答案**：the interesting result rather than an error
- **评分标准**：两分：写出「有意思的结果，而不是要抹平的错误」= 2 分；只写「不是错误」= 1 分；写「说明其中一个测错了」= 0 分（与原文相反）。
- **原文依据**：Where two distant records disagree, the disagreement is often the interesting result rather than an error to be reconciled away.
- **为什么**：第三段末句是全文态度最鲜明的一句。

#### 第 10 题 · 简答题 · 2 分

> Answer in NO MORE THAN TWELVE WORDS.
> Why do laboratories ration their ice-core samples?

- **参考答案**：because a core can be measured only once
- **评分标准**：两分：写出「取样是破坏性的 / 一段岩芯只能测一次」= 2 分；只写「钻探很贵」= 1 分；写原文没说的（比如「实验室缺人手」）= 0 分。
- **原文依据**：Drilling is slow, expensive and destructive: a core can be measured only once, and the deepest sections are the scarcest material in the discipline.
- **为什么**：最后一段把三个理由并列，「只能测一次」是核心那条。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | cylinder | cylinder | /ˈsɪlɪndə/ | n. | n. 圆柱体 |
| 2 | glacier | glacier | /ˈɡlæsiə/ | n. | n. 冰川 |
| 3 | atmosphere | atmosphere | /ˈætməsfɪə/ | n. | n. 大气 |
| 4 | eruption | eruption | /ɪˈrʌpʃn/ | n. | n. 火山喷发 |
| 5 | crystallise | crystallised | /ˈkrɪstəlaɪz/ | v. | v. 结晶 |
| 6 | boundary | boundary | /ˈbaʊndri/ | n. | n. 界线 |
| 7 | accumulation | accumulation | /əˌkjuːmjəˈleɪʃn/ | n. | n. 积累 |
| 8 | merge | merge | /mɜːdʒ/ | v. | v. 合并 |
| 9 | independently | independently | /ˌɪndɪˈpendəntli/ | adv. | adv. 独立地 |
| 10 | volcanic | volcanic | /vɒlˈkænɪk/ | adj. | adj. 火山的 |
| 11 | overlook | overlook | /ˌəʊvəˈlʊk/ | v. | v. 忽略 |
| 12 | interpret | Interpreting | /ɪnˈtɜːprɪt/ | v. | v. 解读 |
| 13 | reconcile | reconciled | /ˈrekənsaɪl/ | v. | v. 调和，使一致 |
| 14 | archive | archive | /ˈɑːkaɪv/ | n. | n. 档案，记录库 |
| 15 | compact | compacts | /kəmˈpækt/ | v. | v. 压实 |
| 16 | circulate | circulate | /ˈsɜːkjəleɪt/ | v. | v. 流通，循环 |
| 17 | porous | porous | /ˈpɔːrəs/ | adj. | adj. 多孔的 |
| 18 | alarming | alarming | /əˈlɑːmɪŋ/ | adj. | adj. 令人担忧的 |
| 19 | destructive | destructive | /dɪˈstrʌktɪv/ | adj. | adj. 破坏性的 |
| 20 | scarce | scarcest | /skeəs/ | adj. | adj. 稀缺的 |
| 21 | ration | ration | /ˈræʃn/ | v. | v. 限量供应 |

---

# 2026-09-02

## O-Level —— 《The Bus Stop Garden》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **B** （FALSE） | nobody regarded the stop itself as worth improving. |
| 2 | 判断题 | **A** （TRUE） | That changed when the number 67 service was diverted for roadworks. |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **B** （the coffee shop） | the coffee shop across the road agreed to save its used coffee grounds |
| 5 | 特征配对 | **D** （the town council） | it refused to build a fence because the narrow pavement had to remain  |
| 6 | 选择题 | **C** （They could survive contact with passers-by.） | volunteers chose hardy herbs that could survive being brushed by bags  |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> The first plant to survive produced ______ flowers.

- **参考答案**：purple
- **也算对**：purple
- **评分标准**：只能填写原文中的 purple。
- **原文依据**：a purple flowering plant survived the heat.
- **为什么**：第二段给出幸存植物的颜色。

#### 第 8 题 · 完成句子 · 1 分

> Volunteers kept a gap next to the bench for ______.

- **参考答案**：wheelchairs
- **也算对**：wheelchairs
- **评分标准**：只认 wheelchairs。
- **原文依据**：They left a clear gap beside the bench for wheelchairs.
- **为什么**：通道是为轮椅使用者保留的。

#### 第 9 题 · 摘要填空 · 2 分

> A survey found that passengers now arrive about ______.

- **参考答案**：three minutes earlier
- **评分标准**：写出 three minutes earlier 得 2 分；只写 three minutes 得 1 分。
- **原文依据**：passengers now reach the stop an average of three minutes earlier.
- **为什么**：最后一段给出平均提前时间。

#### 第 10 题 · 简答题 · 2 分

> Why did the council refuse to build a fence?

- **参考答案**：because the pavement had to remain accessible
- **评分标准**：答出保持人行道无障碍得 2 分；只答道路窄得 1 分。
- **原文依据**：the narrow pavement had to remain accessible.
- **为什么**：市政厅担心围栏会阻碍狭窄的人行道。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | trap | trapped | /træp/ | v. | v. 困住；聚积 |
| 2 | blank | blank | /blæŋk/ | adj. | adj. 空白的 |
| 3 | regard | regarded | /rɪˈɡɑːd/ | v. | v. 看待 |
| 4 | divert | diverted | /daɪˈvɜːt/ | v. | v. 改道 |
| 5 | elderly | elderly | /ˈeldəli/ | adj. | adj. 年长的 |
| 6 | cutting | cuttings | /ˈkʌtɪŋ/ | n. | n. 插条 |
| 7 | survive | survived | /səˈvaɪv/ | v. | v. 存活 |
| 8 | commuter | commuters | /kəˈmjuːtə/ | n. | n. 通勤者 |
| 9 | compost | compost | /ˈkɒmpɒst/ | n. | n. 堆肥 |
| 10 | ground | grounds | /ɡraʊndz/ | n. | n. 咖啡渣 |
| 11 | supply | supplied | /səˈplaɪ/ | v. | v. 提供 |
| 12 | accessible | accessible | /əkˈsesəbl/ | adj. | adj. 无障碍可进入的 |
| 13 | shape | shaped | /ʃeɪp/ | v. | v. 塑造；影响 |
| 14 | delicate | delicate | /ˈdelɪkət/ | adj. | adj. 娇嫩的 |
| 15 | hardy | hardy | /ˈhɑːdi/ | adj. | adj. 耐寒耐受的 |
| 16 | herb | herbs | /hɜːb/ | n. | n. 香草植物 |
| 17 | brush | brushed | /brʌʃ/ | v. | v. 轻擦 |
| 18 | label | labelled | /ˈleɪbl/ | v. | v. 加标签 |
| 19 | translation | translation | /trænzˈleɪʃn/ | n. | n. 翻译 |
| 20 | litter | Litter | /ˈlɪtə/ | n. | n. 垃圾 |
| 21 | average | average | /ˈævərɪdʒ/ | n. | n. 平均数 |

## O-Level 基础（ielts_simplified） —— 《The Library of Things》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **B** （FALSE） | People do not borrow books there. |
| 2 | 判断题 | **A** （TRUE） | The room opened after a neighbourhood survey found that many families  |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **B** （the tent） | The tent is collected mainly before public holidays. |
| 5 | 特征配对 | **C** （the sewing machine） | It is reserved almost every weekend |
| 6 | 选择题 | **A** （It reduces waste and builds trust.） | Mr Lee says the practical result is less waste, but the social result  |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Complete with ONE WORD from the passage.
> Borrowers pay a small ______ which they receive back later.

- **参考答案**：deposit
- **也算对**：deposit
- **评分标准**：只认 deposit。
- **原文依据**：Borrowing is free, but each person pays a small deposit.
- **为什么**：第三段说明押金会在归还物品时退回。

#### 第 8 题 · 完成句子 · 1 分

> Each object carries a ______ with a picture and instructions.

- **参考答案**：label
- **也算对**：label
- **评分标准**：只能填写原文中的 label。
- **原文依据**：Every object has a label with a picture and a short set of instructions.
- **为什么**：物品上的图片和说明写在标签上。

#### 第 9 题 · 摘要填空 · 2 分

> Complete the summary.
> During its first year, the room recorded ______ and discarded only six objects.

- **参考答案**：1,840 loans
- **评分标准**：写出 1,840 loans 得 2 分；只写 1,840 得 1 分。
- **原文依据**：After one year, the room had made 1,840 loans and thrown away only six objects.
- **为什么**：最后一段给出了第一年的借用次数。

#### 第 10 题 · 简答题 · 2 分

> Why did some families not want to own every tool they needed?

- **参考答案**：because flats had little space
- **评分标准**：答出住房空间小得 2 分；只答买不起得 1 分。
- **原文依据**：They could not afford to buy every object, and their flats had little space.
- **为什么**：第二段给出价格和空间两个原因，本题问的是不愿全部拥有。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | borrow | borrow | /ˈbɒrəʊ/ | v. | v. 借用 |
| 2 | shelf | shelf | /ʃelf/ | n. | n. 架子 |
| 3 | drill | drill | /drɪl/ | n. | n. 电钻 |
| 4 | sewing | sewing | /ˈsəʊɪŋ/ | n. | n. 缝纫 |
| 5 | member | member | /ˈmembə/ | n. | n. 成员 |
| 6 | survey | survey | /ˈsɜːveɪ/ | n. | n. 调查 |
| 7 | afford | afford | /əˈfɔːd/ | v. | v. 负担得起 |
| 8 | share | share | /ʃeə/ | v. | v. 共享 |
| 9 | donate | donated | /dəʊˈneɪt/ | v. | v. 捐赠 |
| 10 | inspect | inspect | /ɪnˈspekt/ | v. | v. 检查 |
| 11 | deposit | deposit | /dɪˈpɒzɪt/ | n. | n. 押金 |
| 12 | label | label | /ˈleɪbl/ | n. | n. 标签 |
| 13 | damage | damaged | /ˈdæmɪdʒ/ | v. | v. 损坏 |
| 14 | repair | repair | /rɪˈpeə/ | v. | v. 修理 |
| 15 | specialist | specialist | /ˈspeʃəlɪst/ | n. | n. 专业人员 |
| 16 | popular | popular | /ˈpɒpjələ/ | adj. | adj. 受欢迎的 |
| 17 | reserve | reserved | /rɪˈzɜːv/ | v. | v. 预订 |
| 18 | collect | collected | /kəˈlekt/ | v. | v. 领取 |
| 19 | practical | practical | /ˈpræktɪkl/ | adj. | adj. 实际的 |
| 20 | waste | waste | /weɪst/ | n. | n. 浪费；废物 |
| 21 | trust | trust | /trʌst/ | v. | v. 信任 |

## IELTS（ielts_authentic） —— 《Planning Corridors of Darkness》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **A** （TRUE） | A forest divided by a brightly illuminated road may remain physically  |
| 2 | 判断题 | **B** （FALSE） | Other bat species avoid illuminated edges entirely. |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **C** （turtles） | Newly hatched turtles can be drawn inland by hotel lighting |
| 5 | 特征配对 | **D** （migrating birds） | Migrating birds may alter their routes near luminous cities, especiall |
| 6 | 选择题 | **B** （Animals may be unable to reach it through lit surroundings.） | Connectivity matters because a single dark park is of limited use if e |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Animals respond not only to intensity but also to ______, direction, duration and contrast.

- **参考答案**：spectrum
- **也算对**：spectrum
- **评分标准**：只认 spectrum。
- **原文依据**：animals respond to spectrum, direction, duration and contrast.
- **为什么**：第四段列出光的多个生物相关属性。

#### 第 8 题 · 完成句子 · 1 分

> A point measurement does not describe spectrum, direction, duration or ______.

- **参考答案**：contrast
- **也算对**：contrast
- **评分标准**：只认 contrast。
- **原文依据**：animals respond to spectrum, direction, duration and contrast.
- **为什么**：同一句列出最后一个属性。

#### 第 9 题 · 摘要填空 · 2 分

> Successful policy must state its lighting priorities both ______.

- **参考答案**：spatially and temporally
- **评分标准**：完整写出 spatially and temporally 得 2 分；只写其一得 1 分。
- **原文依据**：They require priorities to be stated spatially and temporally.
- **为什么**：最后一段强调地点与时间两个维度。

#### 第 10 题 · 简答题 · 2 分

> Why must different city departments cooperate on dark corridors?

- **参考答案**：because one lit gap destroys the connected network
- **评分标准**：答出任何部门留下永久亮点都会破坏网络连续性得 2 分；只答需要统一规划得 1 分。
- **原文依据**：transport, housing and conservation teams must agree on a network whose value disappears if any one department fills its gap with permanent light.
- **为什么**：暗廊的价值依赖跨部门维持完整连接。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | nocturnal | nocturnal | /nɒkˈtɜːnl/ | adj. | adj. 夜行的 |
| 2 | illuminate | illuminated | /ɪˈluːmɪneɪt/ | v. | v. 照亮 |
| 3 | continuous | continuous | /kənˈtɪnjuəs/ | adj. | adj. 连续的 |
| 4 | fragment | fragmented | /fræɡˈment/ | v. | v. 使碎片化 |
| 5 | uniform | uniform | /ˈjuːnɪfɔːm/ | adj. | adj. 一致的 |
| 6 | exhaustion | exhaustion | /ɪɡˈzɔːstʃn/ | n. | n. 精疲力尽 |
| 7 | exploit | exploit | /ɪkˈsplɔɪt/ | v. | v. 利用 |
| 8 | luminous | luminous | /ˈluːmɪnəs/ | adj. | adj. 发光的 |
| 9 | inadequate | inadequate | /ɪnˈædɪkwət/ | adj. | adj. 不充分的 |
| 10 | emerging | emerging | /ɪˈmɜːdʒɪŋ/ | adj. | adj. 新出现的 |
| 11 | corridor | corridors | /ˈkɒrɪdɔː/ | n. | n. 生态廊道 |
| 12 | shield | shielded | /ʃiːld/ | v. | v. 遮挡 |
| 13 | connectivity | Connectivity | /ˌkɒnekˈtɪvəti/ | n. | n. 连通性 |
| 14 | intensity | intensity | /ɪnˈtensəti/ | n. | n. 强度 |
| 15 | spectrum | spectrum | /ˈspektrəm/ | n. | n. 光谱 |
| 16 | duration | duration | /djʊəˈreɪʃn/ | n. | n. 持续时间 |
| 17 | disrupt | disrupt | /dɪsˈrʌpt/ | v. | v. 扰乱 |
| 18 | amber | amber | /ˈæmbə/ | adj. | adj. 琥珀色的 |
| 19 | vegetation | vegetation | /ˌvedʒəˈteɪʃn/ | n. | n. 植被 |
| 20 | spatially | spatially | /ˈspeɪʃəli/ | adv. | adv. 在空间上 |
| 21 | administrative | administrative | /ədˈmɪnɪstrətɪv/ | adj. | adj. 行政管理的 |

---

# 2026-09-03

## O-Level —— 《A Map Made from Sound》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **B** （FALSE） | Nadia sent them out again with recording equipment and a more precise  |
| 2 | 判断题 | **A** （TRUE） | visited each square at breakfast time, lunchtime and after dark. |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **B** （under the railway bridge） | Under the railway bridge, footsteps formed a sharp echo. |
| 5 | 特征配对 | **D** （outside the stadium） | Outside the stadium, a smaller crowd created more noise by chanting in |
| 6 | 选择题 | **A** （information useful for safe movement） | suggested adding descriptions of safe crossing signals, construction w |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Restaurant fans produced a steady low ______.

- **参考答案**：hum
- **也算对**：hum
- **评分标准**：只能填写原文中的 hum。
- **原文依据**：restaurant fans made a steady low hum
- **为什么**：第二段用 hum 描述风扇持续的低声。

#### 第 8 题 · 完成句子 · 1 分

> The map used colours for loudness and ______ for movement.

- **参考答案**：arrows
- **也算对**：arrows
- **评分标准**：只能填写原文中的 arrows。
- **原文依据**：The finished sound map used colours for volume and arrows for movement.
- **为什么**：第四段说明地图的两套视觉符号。

#### 第 9 题 · 摘要填空 · 2 分

> Selecting a square played a ______ with private speech removed.

- **参考答案**：ten-second sample
- **评分标准**：写 ten-second sample 得 2 分；只写 sample 得 1 分。
- **原文依据**：Clicking a square played a ten-second sample with private speech removed.
- **为什么**：地图提供经过隐私处理的十秒音频。

#### 第 10 题 · 简答题 · 2 分

> Why can the map never capture the town permanently?

- **参考答案**：because a living town keeps changing
- **评分标准**：答出城镇声音持续变化得 2 分；举出建筑工地或关店之一得 1 分。
- **原文依据**：a living town cannot be captured permanently: every building site and closed shop changes its voice.
- **为什么**：最后一句说明声音地图会随城镇变化而过时。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | ban | banned | /bæn/ | v. | v. 禁止 |
| 2 | assignment | assignment | /əˈsaɪnmənt/ | n. | n. 作业任务 |
| 3 | equipment | equipment | /ɪˈkwɪpmənt/ | n. | n. 设备 |
| 4 | precise | precise | /prɪˈsaɪs/ | adj. | adj. 精确的 |
| 5 | divide | divided | /dɪˈvaɪd/ | v. | v. 划分 |
| 6 | volume | volume | /ˈvɒljuːm/ | n. | n. 音量 |
| 7 | rhythm | rhythm | /ˈrɪðəm/ | n. | n. 节奏 |
| 8 | burst | bursts | /bɜːst/ | n. | n. 突发声 |
| 9 | echo | echo | /ˈekəʊ/ | n. | n. 回声 |
| 10 | pedestrian | pedestrian | /pəˈdestriən/ | adj. | adj. 行人使用的 |
| 11 | hum | hum | /hʌm/ | n. | n. 嗡嗡声 |
| 12 | responsibly | responsibly | /rɪˈspɒnsəbli/ | adv. | adv. 负责任地 |
| 13 | identify | identify | /aɪˈdentɪfaɪ/ | v. | v. 识别 |
| 14 | hurried | hurried | /ˈhʌrid/ | adj. | adj. 匆忙的 |
| 15 | chant | chanting | /tʃɑːnt/ | v. | v. 齐声呼喊 |
| 16 | unison | unison | /ˈjuːnɪsn/ | n. | n. 齐声 |
| 17 | impairment | impairments | /ɪmˈpeəmənt/ | n. | n. 功能障碍 |
| 18 | construction | construction | /kənˈstrʌkʃn/ | n. | n. 施工 |
| 19 | narrow | narrowed | /ˈnærəʊ/ | v. | v. 使变窄 |
| 20 | attention | attention | /əˈtenʃn/ | n. | n. 注意力 |
| 21 | permanently | permanently | /ˈpɜːmənəntli/ | adv. | adv. 永久地 |

## O-Level 基础（ielts_simplified） —— 《The School That Saved the Rain》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **A** （TRUE） | The school paid to clean the drains after every storm and then paid ag |
| 2 | 判断题 | **B** （FALSE） | The stored water would not be safe to drink |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **A** （a filter） | a filter would stop leaves and dirt from entering |
| 5 | 特征配对 | **C** （a gauge） | A clear gauge on each tank shows the water level. |
| 6 | 选择题 | **D** （The tanks filled more quickly than expected.） | The tanks filled faster than the students had predicted, so an overflo |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> The bottle model collected ______ during one heavy shower.

- **参考答案**：twelve litres
- **也算对**：twelve litres / 12 litres
- **评分标准**：写 twelve litres。
- **原文依据**：During one heavy shower, their model collected twelve litres in twenty minutes.
- **为什么**：第三段给出模型的收集量。

#### 第 8 题 · 完成句子 · 1 分

> Garden club members open a ______ before filling their cans.

- **参考答案**：valve
- **也算对**：valve
- **评分标准**：只能填写原文中的 valve。
- **原文依据**：Garden club members open a valve to fill their watering cans
- **为什么**：阀门控制水从水箱流出。

#### 第 9 题 · 摘要填空 · 2 分

> Extra water now travels through a pipe into ______.

- **参考答案**：a shallow pond
- **评分标准**：写 shallow pond 得 2 分；只写 pond 得 1 分。
- **原文依据**：an overflow pipe was added to lead extra water into a shallow pond.
- **为什么**：最后一段说明溢出的水被引到浅池塘。

#### 第 10 题 · 简答题 · 2 分

> Why did the students build a small model?

- **参考答案**：to prove the plan could collect rainwater
- **评分标准**：答出用模型证明方案可行得 2 分；只答为了说服校长得 1 分。
- **原文依据**：The students therefore built a small model from bottles and plastic tubes.
- **为什么**：模型把抽象计划变成了可测量的结果。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | rush | rushed | /rʌʃ/ | v. | v. 奔流 |
| 2 | flood | flooded | /flʌd/ | v. | v. 淹没 |
| 3 | drain | drains | /dreɪn/ | n. | n. 排水沟 |
| 4 | measure | measured | /ˈmeʒə/ | v. | v. 测量 |
| 5 | gutter | Gutters | /ˈɡʌtə/ | n. | n. 檐沟 |
| 6 | filter | filter | /ˈfɪltə/ | n. | n. 过滤器 |
| 7 | stored | stored | /stɔːd/ | adj. | adj. 储存的 |
| 8 | supply | supply | /səˈplaɪ/ | v. | v. 供应 |
| 9 | principal | principal | /ˈprɪnsəpl/ | n. | n. 校长 |
| 10 | model | model | /ˈmɒdl/ | n. | n. 模型 |
| 11 | shower | shower | /ˈʃaʊə/ | n. | n. 阵雨 |
| 12 | display | displayed | /dɪˈspleɪ/ | v. | v. 展示 |
| 13 | persuade | persuaded | /pəˈsweɪd/ | v. | v. 说服 |
| 14 | donate | donate | /dəʊˈneɪt/ | v. | v. 捐赠 |
| 15 | gauge | gauge | /ɡeɪdʒ/ | n. | n. 测量表 |
| 16 | valve | valve | /vælv/ | n. | n. 阀门 |
| 17 | caretaker | caretaker | /ˈkeəteɪkə/ | n. | n. 校舍管理员 |
| 18 | untreated | untreated | /ˌʌnˈtriːtɪd/ | adj. | adj. 未处理的 |
| 19 | predict | predicted | /prɪˈdɪkt/ | v. | v. 预测 |
| 20 | overflow | overflow | /ˈəʊvəfləʊ/ | n. | n. 溢流 |
| 21 | ordinary | ordinary | /ˈɔːdnri/ | adj. | adj. 普通的 |

## IELTS（ielts_authentic） —— 《The Complicated Promise of Cool Pavements》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **A** （TRUE） | This stored heat is later released after sunset, contributing to the u |
| 2 | 判断题 | **B** （FALSE） | a person standing above a bright pavement may experience more radiant  |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **A** （street dirt） | Dust, tyre rubber and organic material darken a new coating, reducing  |
| 5 | 特征配对 | **B** （glare） | Glare can also make an unshaded route unpleasant |
| 6 | 选择题 | **D** （It does not capture the whole system’s effects.） | Surface temperature is one measurement within those systems, not a ver |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Some cool surfaces work by reflecting ______.

- **参考答案**：infrared radiation
- **也算对**：infrared radiation
- **评分标准**：完整写 infrared radiation。
- **原文依据**：reflects infrared radiation.
- **为什么**：第一段给出浅色之外的另一机制。

#### 第 8 题 · 完成句子 · 1 分

> Together with dust and organic material, ______ can darken a coating.

- **参考答案**：tyre rubber
- **也算对**：tyre rubber / tire rubber
- **评分标准**：完整写 tyre rubber。
- **原文依据**：Dust, tyre rubber and organic material darken a new coating
- **为什么**：第三段列出让涂层变暗的物质。

#### 第 9 题 · 摘要填空 · 2 分

> Clean laboratory samples are less informative than ______ on working streets.

- **参考答案**：long-term monitoring
- **评分标准**：写 long-term monitoring 得 2 分；只写 monitoring 得 1 分。
- **原文依据**：Laboratory measurements made on clean samples therefore reveal less than long-term monitoring on busy streets.
- **为什么**：真实街道的长期监测更能反映老化效果。

#### 第 10 题 · 简答题 · 2 分

> Why are researchers asking where cool pavements work rather than whether they work?

- **参考答案**：because climate and street form change the outcome
- **评分标准**：答出气候或街道条件会改变效果得 2 分；只列一个因素得 1 分。
- **原文依据**：Rainfall, street width, tree cover and building height all alter where reflected energy goes.
- **为什么**：同一种材料在不同热系统中的总体影响不同。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | conventional | conventional | /kənˈvenʃənl/ | adj. | adj. 传统的 |
| 2 | asphalt | asphalt | /ˈæsfælt/ | n. | n. 沥青 |
| 3 | contribute | contributing | /kənˈtrɪbjuːt/ | v. | v. 促成 |
| 4 | absorb | absorb | /əbˈzɔːb/ | v. | v. 吸收 |
| 5 | infrared | infrared | /ˌɪnfrəˈred/ | adj. | adj. 红外线的 |
| 6 | outcome | outcome | /ˈaʊtkʌm/ | n. | n. 结果 |
| 7 | reflective | reflective | /rɪˈflektɪv/ | adj. | adj. 反射的 |
| 8 | radiant | radiant | /ˈreɪdiənt/ | adj. | adj. 辐射的 |
| 9 | glare | Glare | /ɡleə/ | n. | n. 眩光 |
| 10 | organic | organic | /ɔːˈɡænɪk/ | adj. | adj. 有机物的 |
| 11 | reflectance | reflectance | /rɪˈflektəns/ | n. | n. 反射率 |
| 12 | conversely | Conversely | /ˈkɒnvɜːsli/ | adv. | adv. 相反地 |
| 13 | monitoring | monitoring | /ˈmɒnɪtərɪŋ/ | n. | n. 监测 |
| 14 | renew | renewed | /rɪˈnjuː/ | v. | v. 翻新 |
| 15 | complication | complication | /ˌkɒmplɪˈkeɪʃn/ | n. | n. 复杂因素 |
| 16 | adjacent | adjacent | /əˈdʒeɪsnt/ | adj. | adj. 相邻的 |
| 17 | alter | alter | /ˈɔːltə/ | v. | v. 改变 |
| 18 | consequently | consequently | /ˈkɒnsɪkwəntli/ | adv. | adv. 因此 |
| 19 | courtyard | courtyard | /ˈkɔːtjɑːd/ | n. | n. 庭院 |
| 20 | thermal | thermal | /ˈθɜːml/ | adj. | adj. 热的；热学的 |
| 21 | durability | durability | /ˌdjʊərəˈbɪləti/ | n. | n. 耐久性 |

---

# 2026-09-04

## O-Level —— 《The Seeds Kept for Tomorrow》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **A** （TRUE） | a room kept at minus eighteen degrees Celsius. |
| 2 | 判断题 | **B** （FALSE） | Collectors do not simply take the largest plants. |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **C** （germination testing） | A small number of seeds are removed at regular intervals and planted u |
| 5 | 特征配对 | **D** （liquid nitrogen） | the centre keeps tissue in liquid nitrogen or maintains living collect |
| 6 | 选择题 | **B** （to preserve genetic variation） | They gather from many individuals across a wide area so that the sampl |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Ice may damage seeds that still contain too much ______.

- **参考答案**：moisture
- **也算对**：moisture
- **评分标准**：只认 moisture。
- **原文依据**：Seeds that contain too much moisture can be destroyed when ice forms inside their cells.
- **为什么**：第二段解释了入库前缓慢干燥的原因。

#### 第 8 题 · 完成句子 · 1 分

> A stock may be weakening if too few test seeds ______.

- **参考答案**：germinate
- **也算对**：germinate
- **评分标准**：只认 germinate。
- **原文依据**：If too few germinate, the remaining stock may also be losing its ability to grow.
- **为什么**：发芽率下降提示整批种子活力降低。

#### 第 9 题 · 摘要填空 · 2 分

> One purpose of the bank is to provide ______.

- **参考答案**：insurance against catastrophe
- **评分标准**：写出 insurance against catastrophe 得 2 分；只写 insurance 得 1 分。
- **原文依据**：The first is insurance against catastrophe
- **为什么**：第四段直接概括第一项用途。

#### 第 10 题 · 简答题 · 2 分

> Why can many tropical trees not be stored in the usual cold room?

- **参考答案**：because drying damages their seeds
- **评分标准**：答出种子会被干燥损坏得 2 分；只答不耐低温不给分。
- **原文依据**：Many tropical trees produce seeds that are damaged by drying
- **为什么**：问题不在低温本身，而在入库前必需的干燥步骤。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | seal | sealed | /siːl/ | v. | v. 密封 |
| 2 | species | species | /ˈspiːʃiːz/ | n. | n. 物种 |
| 3 | collector | Collectors | /kəˈlektə/ | n. | n. 采集者 |
| 4 | individual | individuals | /ˌɪndɪˈvɪdʒuəl/ | n. | n. 个体 |
| 5 | preserve | preserves | /prɪˈzɜːv/ | v. | v. 保存 |
| 6 | genetic | genetic | /dʒəˈnetɪk/ | adj. | adj. 遗传的 |
| 7 | variation | variation | /ˌveəriˈeɪʃn/ | n. | n. 差异 |
| 8 | moisture | moisture | /ˈmɔɪstʃə/ | n. | n. 水分 |
| 9 | interval | intervals | /ˈɪntəvl/ | n. | n. 间隔 |
| 10 | germinate | germinate | /ˈdʒɜːmɪneɪt/ | v. | v. 发芽 |
| 11 | stock | stock | /stɒk/ | n. | n. 储备 |
| 12 | generation | generation | /ˌdʒenəˈreɪʃn/ | n. | n. 一代 |
| 13 | insurance | insurance | /ɪnˈʃʊərəns/ | n. | n. 保障 |
| 14 | catastrophe | catastrophe | /kəˈtæstrəfi/ | n. | n. 灾难 |
| 15 | variety | variety | /vəˈraɪəti/ | n. | n. 品种 |
| 16 | trait | traits | /treɪt/ | n. | n. 特征 |
| 17 | tolerance | tolerance | /ˈtɒlərəns/ | n. | n. 耐受性 |
| 18 | resistance | resistance | /rɪˈzɪstəns/ | n. | n. 抵抗力 |
| 19 | viable | viable | /ˈvaɪəbl/ | adj. | adj. 能存活生长的 |
| 20 | tissue | tissue | /ˈtɪʃuː/ | n. | n. 组织 |
| 21 | maintain | maintains | /meɪnˈteɪn/ | v. | v. 维持 |

## O-Level 基础（ielts_simplified） —— 《Friday at the Repair Café》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **B** （FALSE） | It does not sell coffee, although a volunteer usually makes tea. |
| 2 | 判断题 | **A** （TRUE） | the owner is expected to watch and help |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **B** （clothing） | They then join the correct table: electrical, clothing, wood or bicycl |
| 5 | 特征配对 | **A** （a loose wire） | A loose wire was the only fault |
| 6 | 选择题 | **C** （conversations） | they also count conversations |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> A guide records each object and its ______ on a card.

- **参考答案**：fault
- **也算对**：fault
- **评分标准**：只能填写原文中的 fault。
- **原文依据**：a guide who writes the object and its fault on a card
- **为什么**：第二段说明向导先登记故障。

#### 第 8 题 · 完成句子 · 1 分

> Objects that cannot be repaired may still be ______ correctly.

- **参考答案**：recycled
- **也算对**：recycled
- **评分标准**：只认 recycled。
- **原文依据**：show the owner where the object can be recycled
- **为什么**：志愿者会说明无法维修的物件应去哪里回收。

#### 第 9 题 · 摘要填空 · 2 分

> In the first six months, volunteers successfully repaired ______ objects.

- **参考答案**：219
- **评分标准**：写 219 得 2 分。
- **原文依据**：the café received 312 objects and repaired 219 of them.
- **为什么**：最后一段给出收到和修好的物件数量。

#### 第 10 题 · 简答题 · 2 分

> Why does the café ask owners to watch and help?

- **参考答案**：so the owner understands what went wrong
- **评分标准**：答出让物主理解故障原因得 2 分；只答学习维修得 1 分。
- **原文依据**：The café says that a repair is more useful when the owner understands what went wrong.
- **为什么**：咖啡馆希望学生带走的不只是修好的物件。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | repair | repair | /rɪˈpeə/ | v. | v. 修理 |
| 2 | volunteer | volunteer | /ˌvɒlənˈtɪə/ | n. | n. 志愿者 |
| 3 | throw | throw | /θrəʊ/ | v. | v. 扔掉 |
| 4 | fault | fault | /fɔːlt/ | n. | n. 故障 |
| 5 | skilled | skilled | /skɪld/ | adj. | adj. 熟练的 |
| 6 | examine | examines | /ɪɡˈzæmɪn/ | v. | v. 检查 |
| 7 | owner | owner | /ˈəʊnə/ | n. | n. 物主 |
| 8 | spare | Spare | /speə/ | adj. | adj. 备用的 |
| 9 | unavailable | unavailable | /ˌʌnəˈveɪləbl/ | adj. | adj. 无法获得的 |
| 10 | sealed | sealed | /siːld/ | adj. | adj. 密封的 |
| 11 | dangerous | dangerous | /ˈdeɪndʒərəs/ | adj. | adj. 危险的 |
| 12 | recycle | recycled | /ˌriːˈsaɪkl/ | v. | v. 回收利用 |
| 13 | promise | promise | /ˈprɒmɪs/ | v. | v. 保证 |
| 14 | refuse | refuse | /rɪˈfjuːz/ | v. | v. 拒绝 |
| 15 | regular | regular | /ˈreɡjələ/ | adj. | adj. 经常来的 |
| 16 | loose | loose | /luːs/ | adj. | adj. 松动的 |
| 17 | replace | replace | /rɪˈpleɪs/ | v. | v. 更换 |
| 18 | contact | contacts | /ˈkɒntækt/ | n. | n. 接触片 |
| 19 | organiser | organisers | /ˈɔːɡənaɪzə/ | n. | n. 组织者 |
| 20 | stranger | Strangers | /ˈstreɪndʒə/ | n. | n. 陌生人 |
| 21 | appliance | appliances | /əˈplaɪəns/ | n. | n. 家用电器 |

## IELTS（ielts_authentic） —— 《When a River Is Given More Room》

满分 12 分 · 十题 · 目标词 21 个

### 客观题（服务端当场判，老师不用管）

| # | 题型 | 答案 | 依据 |
| --- | --- | --- | --- |
| 1 | 判断题 | **A** （TRUE） | water would pass through a town as quickly as possible. |
| 2 | 判断题 | **B** （FALSE） | The aim is not to prevent every flood, which no landscape can guarante |
| 3 | 判断题 | **C** （NOT GIVEN） | （NOT GIVEN：原文没说） |
| 4 | 特征配对 | **B** （moving an embankment back） | An embankment may be moved back from the channel, reconnecting part of |
| 5 | 特征配对 | **D** （satellite images） | satellite images reveal how widely it spreads |
| 6 | 选择题 | **C** （Costs and benefits fall on different communities.） | The community receiving the benefit may be kilometres downstream from  |

### 主观题（**这四题要你批**）

#### 第 7 题 · 完成句子 · 1 分

> Farmers may choose crops that can survive occasional ______.

- **参考答案**：inundation
- **也算对**：inundation / flooding
- **评分标准**：只认 inundation。
- **原文依据**：Fields can be planted with crops that tolerate occasional inundation
- **为什么**：第二段说明适合洪泛区的作物特征。

#### 第 8 题 · 完成句子 · 1 分

> Wetlands and rough ______ slow water returning to the river.

- **参考答案**：vegetation
- **也算对**：vegetation
- **评分标准**：只认 vegetation。
- **原文依据**：Wetlands and rough vegetation also slow the return of that water to the channel.
- **为什么**：第三段说明植被的减速作用。

#### 第 9 题 · 摘要填空 · 2 分

> A ten-centimetre layer over one square kilometre stores ______ of water.

- **参考答案**：one hundred thousand cubic metres
- **也算对**：one hundred thousand cubic metres / 100,000 cubic metres
- **评分标准**：完整写 one hundred thousand cubic metres 得 2 分；只写数字得 1 分。
- **原文依据**：represents one hundred thousand cubic metres
- **为什么**：第三段把浅层大面积储水换算成体积。

#### 第 10 题 · 简答题 · 2 分

> Why can compulsory purchase make a project harder to operate later?

- **参考答案**：because trust is needed to maintain the scheme
- **评分标准**：答出强制收购会破坏维护所需信任得 2 分；只答农民不满意得 1 分。
- **原文依据**：compulsory purchase may destroy the local trust needed to maintain gates, paths and warning systems.
- **为什么**：工程长期运行依赖当地合作，而不只是取得土地。

### 当天目标词

| # | 词 | 文中形态 | 音标 | 词性 | 释义 |
| --- | --- | --- | --- | --- | --- |
| 1 | conveyance | conveyance | /kənˈveɪəns/ | n. | n. 输送 |
| 2 | channel | Channels | /ˈtʃænl/ | n. | n. 河道 |
| 3 | embankment | embankments | /ɪmˈbæŋkmənt/ | n. | n. 堤坝 |
| 4 | transfer | transferred | /trænsˈfɜː/ | v. | v. 转移 |
| 5 | strategy | strategy | /ˈstrætədʒi/ | n. | n. 策略 |
| 6 | catastrophic | catastrophic | /ˌkætəˈstrɒfɪk/ | adj. | adj. 灾难性的 |
| 7 | reconnect | reconnecting | /ˌriːkəˈnekt/ | v. | v. 重新连接 |
| 8 | inundation | inundation | /ˌɪnʌnˈdeɪʃn/ | n. | n. 淹水 |
| 9 | vulnerable | vulnerable | /ˈvʌlnərəbl/ | adj. | adj. 易受损的 |
| 10 | relocate | relocated | /ˌriːləʊˈkeɪt/ | v. | v. 搬迁 |
| 11 | extensive | extensive | /ɪkˈstensɪv/ | adj. | adj. 广阔的 |
| 12 | vegetation | vegetation | /ˌvedʒəˈteɪʃn/ | n. | n. 植被 |
| 13 | guarantee | guarantee | /ˌɡærənˈtiː/ | v. | v. 保证 |
| 14 | implementation | Implementation | /ˌɪmplɪmenˈteɪʃn/ | n. | n. 实施 |
| 15 | compensation | Compensation | /ˌkɒmpenˈseɪʃn/ | n. | n. 补偿 |
| 16 | restriction | restrictions | /rɪˈstrɪkʃn/ | n. | n. 限制 |
| 17 | voluntary | Voluntary | /ˈvɒləntri/ | adj. | adj. 自愿的 |
| 18 | compulsory | compulsory | /kəmˈpʌlsəri/ | adj. | adj. 强制的 |
| 19 | monitoring | Monitoring | /ˈmɒnɪtərɪŋ/ | n. | n. 监测 |
| 20 | ecological | ecological | /ˌiːkəˈlɒdʒɪkl/ | adj. | adj. 生态的 |
| 21 | withdrawal | withdrawal | /wɪðˈdrɔːəl/ | n. | n. 撤离；退出 |

---

## 原文（学生也看得到，这里只是方便你对照）

### 2026-08-31 · O-Level · 《The Night Market Cleans Up》

For thirty years the Thursday night market on Jalan Serai left the same picture behind it: a street of flattened cartons, spilled ice and plastic cups drifting towards the drain. The stallholders were not careless people. They simply had nowhere to put anything, and the lorry that collected the rubbish arrived at six in the morning, long after the wind had done its work.

The change began with a complaint that nobody expected. A retired teacher who lived above the noodle stall wrote to the town council, not about the noise, but about the drain. She had watched a blocked drain flood her void deck twice in one monsoon season, and she was certain the two problems were connected. The council sent an officer to look. He agreed with her, and then admitted that there was no budget for a second lorry.

What the market got instead was an experiment. Each stall was given two crates, one for food waste and one for cardboard, and a volunteer was paid a small allowance to wheel them to a collection point at eleven. The scheme was voluntary, and in the first month only nine of the forty stalls took part. The volunteer, a student named Rafi, kept a notebook of who joined and who did not.

The turning point was economic rather than moral. A recycling firm offered to buy clean cardboard by weight, and the money was divided among the stalls that had separated it properly. Within a term, thirty-four stalls were sorting their waste. The drain stopped blocking. Rafi’s notebook, which had begun as a way of keeping himself organised, became the evidence the council used when it applied for a proper grant.

The market is not spotless now, and Rafi is careful to say so. Glass still breaks, and there are Thursdays when nobody can find the second crate. But the difference is visible from the flats above, and the retired teacher who started it all has stopped writing letters.

### 2026-08-31 · O-Level 基础（ielts_simplified） · 《The Bicycle Doctor》

On a narrow street behind the market there is a shop with no sign. Inside, an old man called Uncle Poh repairs bicycles. He has done this for thirty-eight years, and the neighbours call him the bicycle doctor.

The shop is small and always crowded. Wheels hang from the ceiling. Boxes of screws, chains and brake cables cover the floor, and there is one chair for customers. Uncle Poh works slowly. He listens to a bicycle before he touches it, and he says that most problems make a sound before they become serious.

Three years ago something changed. A girl from the secondary school brought in a flat tyre and asked if she could watch. Uncle Poh gave her the tools and let her do it herself. She came back the next week with a friend. Now, every Saturday morning, six or seven students sit on the floor of the shop and learn to fix their own bicycles.

Uncle Poh does not charge them. He says the lesson is not really about bicycles. A student who can mend a puncture understands that a broken thing is not always rubbish. That idea, he believes, is worth more than the two dollars he would have earned.

His own children think he should rest. He is seventy-three, and his hands are stiff in the morning. But on Saturday the shop is noisy and full of young people, and Uncle Poh says he has never felt less like resting.

### 2026-08-31 · IELTS（ielts_authentic） · 《The Slow Science of Coral》

Coral restoration has an image problem. The photographs that accompany it — divers cementing bright fragments onto a frame, a reef apparently reborn — suggest a technology that can be scaled up until the damage is undone. The scientists who run the nurseries are, almost without exception, more cautious than the photographs, and their caution is worth understanding.

The method itself is not complicated. A healthy colony is broken into fragments, and because coral grows clonally, each fragment can become a colony of its own. Suspended on ropes or trays in clear water, sheltered from sediment and from the fish that graze on new growth, those fragments can reach transplantable size in under a year. A single nursery in the Caribbean has produced tens of thousands of them.

The difficulty is arithmetic. A degraded reef is measured in square kilometres; a nursery output is measured in square metres. Even an optimistic estimate of global restoration capacity covers a fraction of one per cent of the reef that has been lost since 1980. Restoration cannot substitute for reducing the pressures that killed the reef in the first place, and every serious practitioner says so in print.

What restoration can do is more specific, and arguably more interesting. It can preserve genetic diversity that would otherwise disappear when a rare colony dies. It can maintain a population above the density at which spawning succeeds, since corals release eggs into open water and a thinly scattered population fails to fertilise. And it can buy time in places where the underlying threat is expected to ease — a sewage outfall being rerouted, a harbour dredging programme ending.

The most encouraging recent work is not about growing more coral but about growing better coral. Some colonies survive bleaching events that kill their neighbours, and that tolerance appears partly heritable. Nurseries that propagate deliberately from survivors are, in effect, running a selective breeding programme on a decadal timescale. Whether the reef will be given decades is the question nobody in the field can answer.

### 2026-09-01 · O-Level · 《Learning to Swim at Forty》

Mrs Tan learned to swim at forty-one. She had grown up ten minutes from the sea and had never once put her face in it. Her parents could not swim either, and the lesson she had absorbed as a child was simple and unspoken: water is something you look at.

The class she joined was designed for adults who were frightened. There were eight of them, all older than thirty, and the first two lessons never went deeper than the waist. The instructor, a patient man called Danny, spent most of the first hour teaching them to blow bubbles. Nobody laughed. Several of them admitted afterwards that they had been dreading the moment when their feet would leave the floor.

What made the difference, Mrs Tan says, was that Danny never used the word relax. He told them instead exactly what their bodies would do. Air in the lungs makes a person float; a stiff neck sinks the hips; kicking hard achieves almost nothing if the head is lifted. Each instruction could be tested in the shallow end within a minute, and each one turned out to be true. Trust in the coach was built out of small, checkable facts rather than encouragement.

Progress was uneven. Mrs Tan could float on her back in the third week but could not swim a length until the ninth. One classmate gave up entirely. Another, a taxi driver in his fifties, went on to swim across a reservoir the following year, which Danny insists was never the point of the course.

The point, he says, is narrower and more useful. An adult who can float and turn onto their back is very unlikely to drown in calm water. Everything after that — speed, style, distance — is a hobby. Mrs Tan still swims slowly, and she still does not like the sea. But she takes her grandchildren to the pool on Sundays, and she gets in with them.

### 2026-09-01 · O-Level 基础（ielts_simplified） · 《Birds on the Eleventh Floor》

Amirah lives on the eleventh floor. From her kitchen window she can see three trees, a car park and a long strip of sky. For most of her life she thought there were no birds in her estate. Then her science teacher lent her a pair of old binoculars and asked her to count.

In the first week she saw four kinds of bird. By the end of the month she had seen nineteen. The birds had always been there; she had simply never looked up at the right time. Most of them appear early, between six and eight in the morning, when the estate is still quiet.

She keeps a list in a cheap exercise book. Beside each name she writes the date, the weather and the exact place. A sunbird, she found, prefers the flowering tree near the bin centre. Mynas walk on the grass. A kingfisher, bright blue and completely unexpected, sat on the railing of the multi-storey car park for eleven minutes in June.

Her teacher sends the list to a national bird survey every three months. Amirah was surprised that anyone wanted it. The survey needs ordinary places, her teacher explained, not only parks and forests, because nobody else is standing at an eleventh-floor window at half past six.

Amirah is now teaching her younger brother the four commonest birds. He is eight and he gets bored quickly, but he has learned to recognise a myna by its walk. She says that is enough to begin with.

### 2026-09-01 · IELTS（ielts_authentic） · 《What the Ice Remembers》

An ice core is a cylinder of frozen time. Drilled from a glacier or an ice sheet, it preserves, layer by layer, the snow that fell in a particular year, and with the snow whatever the atmosphere happened to be carrying. Dust from a distant desert, ash from an eruption, the isotopic signature of the temperature at which the snow crystallised — all of it is trapped, and none of it moves once the layer is buried.

The counting of layers is the oldest technique and still the most convincing. In places where enough snow falls each winter, the boundary between one year and the next can be seen with the naked eye, and a core can be dated by counting downwards in the same way that one counts the rings of a tree. Where accumulation is slow, layers thin and merge, and the count must be supported by chemical markers whose dates are known independently — a volcanic ash layer, for instance, that appears in cores on both sides of the planet.

What the ice does not record is easier to overlook. It is a record of the atmosphere above a particular ice sheet, not of the world. Interpreting a Greenland core as a global thermometer requires an argument, and the arguments have grown more careful as more cores have been drilled. Where two distant records disagree, the disagreement is often the interesting result rather than an error to be reconciled away.

The bubbles are a separate archive. Air becomes sealed into the ice as the snow compacts, and each bubble is a small sample of the atmosphere of its year. Because the air continues to circulate in the porous upper layers before sealing, the gas in a bubble is always somewhat younger than the ice around it, and the offset must be modelled rather than measured. This is the sort of correction that non-specialists find alarming and specialists find routine.

Drilling is slow, expensive and destructive: a core can be measured only once, and the deepest sections are the scarcest material in the discipline. Laboratories therefore ration their samples, and increasingly they publish the raw measurements rather than only the conclusions, so that a later technique can be applied to the same numbers without cutting more ice.

### 2026-09-02 · O-Level · 《The Bus Stop Garden》

For years, the bus stop outside Meranti Estate was a place people tried to leave as quickly as possible. Its metal roof trapped heat, the bench faced a blank wall, and a strip of hard soil beside it collected cigarette ends. Residents had complained about the litter, but nobody regarded the stop itself as worth improving.

That changed when the number 67 service was diverted for roadworks. During the six-week diversion, an elderly resident named Mrs Goh began watering the empty soil because, she said, an unused bus stop looked even sadder than a busy one. She planted four cuttings from her balcony. Two died, but a purple flowering plant survived the heat.

When the buses returned, other commuters noticed the flowers. A delivery rider brought a wooden box for compost, and the coffee shop across the road agreed to save its used coffee grounds. Children from the nearby primary school painted signs asking people not to step on the soil. The town council supplied a water butt, but it refused to build a fence because the narrow pavement had to remain accessible.

The lack of a fence shaped the garden. Instead of delicate plants, volunteers chose hardy herbs that could survive being brushed by bags and umbrellas. They left a clear gap beside the bench for wheelchairs. Each plant was labelled in four languages, not because every translation was necessary, but because residents enjoyed adding the names used by their grandparents.

The garden has not solved every problem. Litter still appears after Friday nights, and the coffee grounds sometimes arrive in wet plastic bags that cannot be composted. Yet a council survey found that passengers now reach the stop an average of three minutes earlier. Mrs Goh thinks this is because people have turned waiting from lost time into a brief daily visit.

### 2026-09-02 · O-Level 基础（ielts_simplified） · 《The Library of Things》

Beside the public library in Pine Street, there is a smaller room called the Library of Things. People do not borrow books there. They borrow useful objects from a long shelf: a drill, a sewing machine, a tent, cake tins and simple garden tools. A member can take one object home for seven days.

The room opened after a neighbourhood survey found that many families needed tools only once or twice a year. They could not afford to buy every object, and their flats had little space. A retired engineer named Mr Lee suggested that the community should share them. He donated the first drill and taught two volunteers how to inspect it safely.

Borrowing is free, but each person pays a small deposit. The money is returned when the object comes back. Every object has a label with a picture and a short set of instructions. If something is damaged, borrowers are asked to report it instead of hiding the problem. Volunteers then repair the object or send it to a specialist.

The sewing machine is the most popular item. It is reserved almost every weekend, often by parents making costumes for school events. The tent is collected mainly before public holidays. The cake tins are busy in December, although nobody has explained why one tin shaped like a train is requested more than all the others.

After one year, the room had made 1,840 loans and thrown away only six objects. Mr Lee says the practical result is less waste, but the social result matters too. People return things because they trust the next borrower to do the same. The room is now adding wheelchairs and walking frames, which may be borrowed for a month.

### 2026-09-02 · IELTS（ielts_authentic） · 《Planning Corridors of Darkness》

Conservation maps traditionally describe habitat in daylight terms: where an animal feeds, shelters and reproduces. Yet for nocturnal species, darkness is itself part of the habitat. A forest divided by a brightly illuminated road may remain physically continuous while becoming behaviourally fragmented. The trees are still there, but an animal unwilling to cross the light experiences two smaller forests rather than one large one.

The effect is not uniform. Some insects are attracted to lamps and circle them until exhaustion, concentrating prey around a source that certain bats exploit. Other bat species avoid illuminated edges entirely. Newly hatched turtles can be drawn inland by hotel lighting that competes with the brighter horizon over the sea. Migrating birds may alter their routes near luminous cities, especially under low cloud, when artificial glow is reflected back towards the ground.

These differences make a simple instruction to use less light inadequate. A hospital entrance, railway platform and pedestrian crossing cannot be treated like an empty warehouse yard. The emerging alternative is to plan dark corridors: connected routes along rivers, hedges, parks and building edges where lighting is absent, shielded or activated only when people are present. Connectivity matters because a single dark park is of limited use if every route leading to it is exposed.

Measuring darkness is also less straightforward than it appears. A light meter records intensity at one point, but animals respond to spectrum, direction, duration and contrast. Blue-rich white light can disrupt biological clocks more strongly than amber light of the same measured brightness. A lamp hidden from human view may still illuminate the sky, while a low, well-shielded lamp can make a path visible without casting light into neighbouring vegetation.

The practical argument for dark corridors is that they do not require cities to choose between people and wildlife everywhere. They require priorities to be stated spatially and temporally. Light can be concentrated where and when it serves a clear human purpose, while darkness is protected as deliberately as a pond or a line of mature trees. The harder task is administrative: transport, housing and conservation teams must agree on a network whose value disappears if any one department fills its gap with permanent light.

### 2026-09-03 · O-Level · 《A Map Made from Sound》

When teacher Nadia Rahman asked her class to draw a map of the town centre, she banned them from using street names. Instead, they had to map what could be heard. The assignment sounded simple, but the first group returned with a page that said only traffic, people and birds. Nadia sent them out again with recording equipment and a more precise question: how does one street sound different from the next?

The students divided the centre into twenty squares and visited each square at breakfast time, lunchtime and after dark. They measured volume, but they also described rhythm and direction. Delivery vans produced short bursts of engine noise behind the market. Under the railway bridge, footsteps formed a sharp echo. In the pedestrian lane, restaurant fans made a steady low hum that the class had never noticed before.

Human voices were harder to record responsibly. The students did not keep conversations. They noted only the number of speakers, the languages they could identify and whether voices sounded hurried or relaxed. At the hospital entrance, for example, speech was quieter than its volume would suggest because people stood close together. Outside the stadium, a smaller crowd created more noise by chanting in unison.

The finished sound map used colours for volume and arrows for movement. Clicking a square played a ten-second sample with private speech removed. A local group for people with visual impairments tested the map and suggested adding descriptions of safe crossing signals, construction work and places where parked bicycles narrowed the pavement.

Nadia had planned the project as a lesson about data. It became a lesson about attention instead. Several students changed the route they walked home because they had discovered calmer streets. The council has asked to use the map when planning road repairs, although it has warned that a living town cannot be captured permanently: every building site and closed shop changes its voice.

### 2026-09-03 · O-Level 基础（ielts_simplified） · 《The School That Saved the Rain》

At Green Hill School, rain used to create two problems. Water rushed off the hall roof and flooded the basketball court, while the garden became dry again only a few days later. The school paid to clean the drains after every storm and then paid again to water the plants during hot weeks.

A science class measured the roof and made a simple plan. They asked for four large tanks beside the hall. Gutters would carry rainwater into the tanks, and a filter would stop leaves and dirt from entering. The stored water would not be safe to drink, but it could supply the garden and wash outdoor floors.

The principal worried that the system would be expensive. The students therefore built a small model from bottles and plastic tubes. During one heavy shower, their model collected twelve litres in twenty minutes. They displayed the results at assembly and persuaded a local building company to donate two tanks. Parents paid for the other two.

The finished system holds 8,000 litres. A clear gauge on each tank shows the water level. Garden club members open a valve to fill their watering cans, and the caretaker uses a separate hose. Bright signs remind everyone that the water is untreated and must never be used for drinking.

The first wet season brought an unexpected lesson. The tanks filled faster than the students had predicted, so an overflow pipe was added to lead extra water into a shallow pond. Frogs appeared there within three months. The school still cleans its drains, but the court no longer floods after an ordinary storm.

### 2026-09-03 · IELTS（ielts_authentic） · 《The Complicated Promise of Cool Pavements》

On a hot afternoon, conventional asphalt can become far warmer than the air above it. This stored heat is later released after sunset, contributing to the urban heat island that prevents city neighbourhoods from cooling overnight. One increasingly visible response is the cool pavement: a road or footpath designed to absorb less solar energy, usually because its surface is lighter in colour or reflects infrared radiation.

The principle is sound, but the outcome is not automatically comfortable. A reflective surface remains cooler itself, yet some of the energy it rejects travels towards pedestrians and nearby walls. At midday, a person standing above a bright pavement may experience more radiant heat even while a thermometer touching the ground records a lower temperature. Glare can also make an unshaded route unpleasant and difficult for people with limited vision.

Performance changes with age. Dust, tyre rubber and organic material darken a new coating, reducing its reflectance. Conversely, ordinary asphalt may become slightly lighter as its darkest oils wear away. Laboratory measurements made on clean samples therefore reveal less than long-term monitoring on busy streets. Maintenance has its own environmental cost if a coating must be washed frequently or renewed every few years.

Climate adds another complication. In a dry city, reducing stored heat can be valuable because nights are clear and cooling is otherwise limited by hot surfaces. In a colder region, the same pavement may increase winter heating demand in adjacent buildings and slow the melting of ice in shaded places. Rainfall, street width, tree cover and building height all alter where reflected energy goes.

Researchers are consequently moving away from asking whether cool pavements work and towards asking where they work. A school courtyard with shade trees, a wide industrial road and a narrow residential canyon are different thermal systems. Surface temperature is one measurement within those systems, not a verdict. The useful comparison is the combined effect on air temperature, human exposure, drainage, durability, energy use and cost over the pavement’s full life.

### 2026-09-04 · O-Level · 《The Seeds Kept for Tomorrow》

Behind two locked doors at the National Botanic Centre is a room kept at minus eighteen degrees Celsius. It contains no rare paintings or government papers. Its shelves hold seeds: millions of them, sealed in silver packets and arranged by species. The room is a seed bank, a library whose books are living but asleep.

Seeds arrive from farms, forests and wild grasslands. Collectors do not simply take the largest plants. They gather from many individuals across a wide area so that the sample preserves genetic variation. Each collection is cleaned, dried slowly and tested. Seeds that contain too much moisture can be destroyed when ice forms inside their cells.

A packet is not put away and forgotten. A small number of seeds are removed at regular intervals and planted under controlled conditions. If too few germinate, the remaining stock may also be losing its ability to grow. Staff then plant a larger batch, allow the new plants to produce fresh seed and return that new generation to storage.

The bank has two purposes. The first is insurance against catastrophe: a crop disease, fire or conflict may destroy a local variety that farmers still need. The second is research. Plant breeders can request seeds carrying useful traits, such as tolerance of salty soil or resistance to a particular insect.

Storage is not equally successful for every species. Many tropical trees produce seeds that are damaged by drying, while some crops can remain viable for decades. For difficult plants, the centre keeps tissue in liquid nitrogen or maintains living collections outdoors. The cold room is therefore not a complete answer, but it buys time while other methods improve.

### 2026-09-04 · O-Level 基础（ielts_simplified） · 《Friday at the Repair Café》

Every Friday afternoon, the meeting room at West Park Community Centre becomes a repair café. It does not sell coffee, although a volunteer usually makes tea. People bring lamps, fans, toys, bags and small kitchen machines that have stopped working. The aim is to repair them together rather than throw them away.

Visitors first meet a guide who writes the object and its fault on a card. They then join the correct table: electrical, clothing, wood or bicycles. A skilled volunteer examines the object, but the owner is expected to watch and help. The café says that a repair is more useful when the owner understands what went wrong.

Not every object can be saved. Spare parts may be unavailable, and some sealed machines are dangerous to open. In those cases, volunteers explain the reason and show the owner where the object can be recycled. They never promise success, and they refuse to repair anything that could be unsafe afterwards.

The youngest regular visitor is eleven-year-old Hana. She first came with a broken desk lamp. A loose wire was the only fault, and she learned to replace it in fifteen minutes. She now helps at the toy table, where missing screws and dirty battery contacts cause many of the problems.

During its first six months, the café received 312 objects and repaired 219 of them. The organisers are pleased with that number, but they also count conversations. Strangers lend one another tools, compare old appliances and share memories of the people who owned them. An object may leave still broken, yet its owner often leaves knowing what to do next.

### 2026-09-04 · IELTS（ielts_authentic） · 《When a River Is Given More Room》

For much of the twentieth century, flood engineering treated a river as a problem of conveyance. Channels were straightened, banks raised and floodplains separated by embankments so that water would pass through a town as quickly as possible. The approach protected many places from frequent floods, but it also transferred water downstream faster and encouraged construction on land that appeared to have become safe.

A different strategy, often described as giving the river room, starts by asking where floodwater can spread without causing catastrophic damage. An embankment may be moved back from the channel, reconnecting part of the former floodplain. Fields can be planted with crops that tolerate occasional inundation, while the most vulnerable buildings are relocated or raised. During ordinary conditions, the land remains productive; during a flood, it temporarily stores water.

The storage is shallow but extensive. Ten centimetres of water spread across one square kilometre represents one hundred thousand cubic metres that is not moving through a town at the flood peak. Wetlands and rough vegetation also slow the return of that water to the channel. The aim is not to prevent every flood, which no landscape can guarantee, but to reduce the height and speed of the most damaging ones.

Implementation is socially harder than the engineering diagram suggests. The community receiving the benefit may be kilometres downstream from the farmers who provide the storage. Compensation must reflect not only lost crops after a flood but restrictions on buildings, drainage and future land value. Voluntary agreements can take years, yet compulsory purchase may destroy the local trust needed to maintain gates, paths and warning systems.

Monitoring has therefore become central to such projects. Gauges record when water enters and leaves the floodplain; satellite images reveal how widely it spreads; ecological surveys track changes in birds and plants. A successful scheme may deliver flood protection, habitat and recreation together, but those benefits should not be assumed. Giving a river room is not the withdrawal of management. It is a decision to manage a larger, more variable space.
