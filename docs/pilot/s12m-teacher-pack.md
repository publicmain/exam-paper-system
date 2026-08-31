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
| 6 | complaint | complaint | /kəmˈpleɪnt/ | n. | n. 投诉，抄怨 |
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
| 20 | drown | drown | /draʊn/ | v. | v. 溺水，浹死 |
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
