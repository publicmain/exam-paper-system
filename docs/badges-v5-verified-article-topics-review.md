# V5 阅读主题固定索引审查（2026-09-17）

## 审查结论

- 对发布副本基线 `92a082e` 中第一至第四周全部 **100 篇**课程正文完成逐篇阅读，并给每篇一个稳定的主要主题。
- 这是 **AI 代理对正文的主题复核**，不是教师人工签字，也不替代文章事实、题目、答案、版权或考纲终审。
- 索引不修改文章、题目、已答卷快照、学生记录或生产数据库；不使用可变题库标签推断主题。
- 100 篇是仓库中准备好的内容，不能据此声称生产已发布了100篇。按文档日期截至2026-09-17的内容70篇，之后准备内容30篇。实际生产覆盖应再与只读导出的冻结正文hash比对。
- 跨全部难度7个主题各有至少3篇；**没有任何一个固定难度的现有20篇同时覆盖5个主题各3篇**。不能为了让奖章立即可得而把家庭叙事贴成科技或历史。多元阅读隐藏奖章仍为未来课程逐步达到的长线目标，后续备课需要补足主题覆盖。

## 分类原则

每篇只选正文的主要探讨对象，不因为故事提到手机就算科技、提到食物就算饮食文化、背景在学校就算学习。叙事依据主要经历和意义，说明文依据解释对象；交叉主题只计一个。

- `nature`：自然与环境。
- `technology`：科技与工程。
- `culture`：文化与艺术。
- `learning`：学习与成长。
- `community`：家庭与社区。
- `health`：健康与运动。
- `history`：历史与经济。
- `psychology`：心理与行为。

边界示例：`The Spare Motor` 的主线是跨校互助，因此是社区，不因机器人道具记科技；`The Durian` 围绕父亲承诺与家庭，不因水果名称记自然；`The Egg Drop` 解释冲击吸收和实际测试，记科技；`The Most Valuable Rock` 的主体是盐贸易、税和政治变化，记历史经济。

## 实际覆盖（含全部已准备四周，不代表已发布）

| 难度 | 自然与环境 | 科技与工程 | 文化与艺术 | 学习与成长 | 家庭与社区 | 健康与运动 | 历史与经济 | 心理与行为 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ielts_simplified | 3 | 1 | 1 | 3 | 12 | 0 | 0 | 0 |
| olevel_intermediate | 1 | 1 | 4 | 4 | 6 | 4 | 0 | 0 |
| olevel | 2 | 1 | 3 | 1 | 8 | 5 | 0 | 0 |
| ielts_light | 7 | 8 | 1 | 0 | 1 | 1 | 2 | 0 |
| ielts_authentic | 8 | 3 | 0 | 0 | 0 | 4 | 3 | 2 |

## 日期不晚于2026-09-17的内容覆盖（仍不是生产发布证明）

| 难度 | 自然与环境 | 科技与工程 | 文化与艺术 | 学习与成长 | 家庭与社区 | 健康与运动 | 历史与经济 | 心理与行为 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ielts_simplified | 1 | 1 | 1 | 2 | 9 | 0 | 0 | 0 |
| olevel_intermediate | 1 | 0 | 3 | 2 | 5 | 3 | 0 | 0 |
| olevel | 2 | 1 | 2 | 1 | 6 | 2 | 0 | 0 |
| ielts_light | 3 | 6 | 1 | 0 | 1 | 1 | 2 | 0 |
| ielts_authentic | 7 | 2 | 0 | 0 | 0 | 1 | 3 | 1 |

## 数据与运行接口

- `apps/api/src/achievements/verified-article-topics.manifest.json` 每条保留：规范化正文SHA-256、唯一主要主题、标题、难度、教学日期、仓库相对来源、来源引用、审查日期、审查方式、分类理由和逐字原文证据。
- `verifiedPrimaryTopicForArticleKey(key)` 只接收 `article:<64位小写SHA256>`；精确命中返回主题，未知正文返回 `undefined`。运行时不访问数据库、题库、网络或付费API。
- 规范化完全遵循 `frozenCollectionArticle`：NFKC、独立段落编号行删除、弯引号/长破折号统一、合并空白、转小写，再SHA-256。文章标题、日期、mutable tags不参与。
- 同一hash如出现冲突分类或不完整审查记录，该hash主题不可用，不能由数组顺序覆盖。冻结快照的显式可信主题如与索引冲突，同样应由调用方拒绝计主题。
- 索引中出现未来课文不代表学生已经阅读；只有原事实加载器认可的已提交正式阅读才能贡献进度，未来日期、未答正文、练习、系统自动交卷等过滤仍有效。

## 维护与安全

1. 新课文先实际通读，确认主要主题，再为对应规范化正文添加新的审查记录；禁止仅按标题自动贴标签。
2. 不自动覆盖旧hash。改动正文得到新hash后必须重新复核，不得悄悄改变旧学生快照。
3. 已发旧文章如果不在100篇内，保持未知；取得其原冻结正文后按同一方法补审，不能根据当前可变题库反推。
4. 原文精确重复仍只算一个文章hash；日期换了不增加阅读数量。
5. 内容新增而未审查会使完整覆盖测试失败，提醒备课流程更新，不会触发运行时付费分类。

## 已执行验证

`npx vitest run src/achievements/verified-article-topics.spec.ts`：**5/5通过**。

覆盖100篇真实来源文件导出、实际正文hash、逐字证据、唯一性、归类集合；验证未知正文/正文实质更改不继承旧主题、非法键拒绝、冲突和缺失审查资料不算主题。测试不连接数据库。

## 逐篇索引

以下短理由是主题判定，不是文章事实正确性的背书。完整hash和逐字证据见manifest。

| 日期 | 难度 | 标题 | 主要主题 | 复核理由 |
| --- | --- | --- | --- | --- |
| 2026-08-31 | ielts_simplified | The Bicycle Doctor | 家庭与社区 | Neighbourhood repair mentorship and reuse are the central social activity. |
| 2026-09-01 | ielts_simplified | Birds on the Eleventh Floor | 自然与环境 | Urban bird observation and citizen-science recording. |
| 2026-09-02 | ielts_simplified | The Library of Things | 家庭与社区 | A community lending service shares objects, trust and accessibility aids. |
| 2026-09-03 | ielts_simplified | The School That Saved the Rain | 科技与工程 | Students design a rainwater capture, filter, tank and overflow system. |
| 2026-09-04 | ielts_simplified | Friday at the Repair Café | 家庭与社区 | A volunteer repair cafe combines practical help with community connections. |
| 2026-09-07 | ielts_simplified | The Umbrella | 家庭与社区 | A cleaner's quiet kindness gives the pupil an umbrella. |
| 2026-09-08 | ielts_simplified | The Empty Seat | 家庭与社区 | Loss of a seatmate and an emerging friendship through everyday generosity. |
| 2026-09-09 | ielts_simplified | The Durian | 家庭与社区 | A family ritual preserves a father's childhood promise; not a botany article. |
| 2026-09-10 | ielts_simplified | The Library Clock | 学习与成长 | A pupil reconsiders the purpose of a deliberately fast library clock. |
| 2026-09-11 | ielts_simplified | The Long Way Round | 家庭与社区 | A changed walking route creates recognition and neighbourly connection. |
| 2026-09-14 | ielts_simplified | The Fish That Went Missing | 学习与成长 | A pupil learns to ask for help and check evidence rather than assume a fish has died. |
| 2026-09-15 | ielts_simplified | Two Blue Lunch Boxes | 家庭与社区 | Accidentally exchanged lunches become a friendship and shared routine. |
| 2026-09-16 | ielts_simplified | The Wrong List | 文化与艺术 | A mistaken club sign-up becomes singing practice and a school concert. |
| 2026-09-17 | ielts_simplified | The Boy by the Gates | 家庭与社区 | A pupil helps a separated child and station staff reunite him with his mother. |
| 2026-09-18 | ielts_simplified | The Tin Under the Bed | 家庭与社区 | A sister's sustained saving and birthday gift express care. |
| 2026-09-21 | ielts_simplified | The Question I Did Not Ask | 学习与成长 | Classroom help-seeking replaces fear of asking a question. |
| 2026-09-22 | ielts_simplified | The Early Alarm | 家庭与社区 | An early arrival introduces a pupil to a guard as a person. |
| 2026-09-23 | ielts_simplified | The Bean That Did Not Grow | 自然与环境 | A bean-growing failure illustrates a seed's need for air as well as water. |
| 2026-09-24 | ielts_simplified | The Parrot Next Door | 自然与环境 | A parrot learns voices and repeated words from its surroundings. |
| 2026-09-25 | ielts_simplified | The Ring in the Rice | 家庭与社区 | A lost wedding ring leads to a family search and shared relief. |
| 2026-08-31 | olevel_intermediate | Auntie Lim's Bee Hoon | 家庭与社区 | An unspoken bond between a hawker and a departing pupil. |
| 2026-09-01 | olevel_intermediate | The Frog at MacRitchie | 自然与环境 | A field trip becomes a decision to respect a frog's habitat. |
| 2026-09-02 | olevel_intermediate | The Drawing on the Wall | 文化与艺术 | Creating a mural matters more to the painter than the exhibition credit. |
| 2026-09-03 | olevel_intermediate | The Library Card | 家庭与社区 | A lost library card reveals the attention and care of strangers. |
| 2026-09-04 | olevel_intermediate | The Last Runner | 健康与运动 | A school relay and physical effort challenge a pupil's view of his sporting ability. |
| 2026-09-07 | olevel_intermediate | The Lost Wallet | 家庭与社区 | Returning a stranger's money is an ethical choice informed by empathy. |
| 2026-09-08 | olevel_intermediate | The New Glasses | 健康与运动 | Accepting corrective glasses restores vision and participation despite teasing. |
| 2026-09-09 | olevel_intermediate | The Paper Lantern | 文化与艺术 | A Mid-Autumn lantern walk is the central cultural practice and shared memory. |
| 2026-09-10 | olevel_intermediate | The Swimming Lesson | 健康与运动 | Swimming instruction teaches floating and overcoming fear of the water. |
| 2026-09-11 | olevel_intermediate | The Wrong Name | 文化与艺术 | Pronouncing a personal name correctly is linked to linguistic identity and respect. |
| 2026-09-14 | olevel_intermediate | The Group Project | 学习与成长 | A group project exposes assumptions about a quiet classmate's work. |
| 2026-09-15 | olevel_intermediate | The Lunch Rush | 学习与成长 | Learning a busy stall job through mistakes and non-shaming guidance. |
| 2026-09-16 | olevel_intermediate | The Question Jar | 家庭与社区 | A family question jar rebuilds conversation and reveals parents' earlier lives. |
| 2026-09-17 | olevel_intermediate | Just a Joke | 家庭与社区 | A damaging group-chat joke leads to responsibility, repair and friendship. |
| 2026-09-18 | olevel_intermediate | Twelve Moves | 学习与成长 | A chess player's defeat teaches humility and learning from another pupil. |
| 2026-09-21 | olevel_intermediate | The Voice Message | 家庭与社区 | A misdirected accusation changes how a pupil handles conflict with friends. |
| 2026-09-22 | olevel_intermediate | Upside Down | 学习与成长 | An orienteering mistake changes a leader's willingness to listen. |
| 2026-09-23 | olevel_intermediate | Teaching My Father to Ride | 健康与运动 | An adult gradually learns cycling through practice and family support. |
| 2026-09-24 | olevel_intermediate | Is This Yours? | 文化与艺术 | A failed magic performance is rescued through humour and stagecraft. |
| 2026-09-25 | olevel_intermediate | The Egg Drop | 科技与工程 | An egg-drop engineering exercise compares impact absorption and field testing. |
| 2026-08-31 | olevel | The Night Market Cleans Up | 自然与环境 | Waste separation and recycling solve litter and drain blockage. |
| 2026-09-01 | olevel | Learning to Swim at Forty | 健康与运动 | Adult swimming instruction develops water safety through physical skills. |
| 2026-09-02 | olevel | The Bus Stop Garden | 家庭与社区 | Residents co-create an accessible public garden and change daily social use. |
| 2026-09-03 | olevel | A Map Made from Sound | 科技与工程 | Sound mapping uses structured recordings and an accessible interactive data product. |
| 2026-09-04 | olevel | The Seeds Kept for Tomorrow | 自然与环境 | Seed banking conserves genetic diversity, viability and crop resilience. |
| 2026-09-07 | olevel | Thursday Afternoons with Mr Ng | 家庭与社区 | A grieving tutor is treated with discreet kindness by a student and family. |
| 2026-09-08 | olevel | The Void Deck | 家庭与社区 | A neighbourhood wake reveals a life of small acts of help. |
| 2026-09-09 | olevel | The Recipe Card | 文化与艺术 | A family curry recipe passes on tacit cooking knowledge across generations. |
| 2026-09-10 | olevel | The Letter from Tekong | 家庭与社区 | A brother's letters create trust and communication within a family. |
| 2026-09-11 | olevel | Taking the Other Side | 学习与成长 | Debate research changes a pupil's thinking about educational opportunity. |
| 2026-09-14 | olevel | The Understudy | 文化与艺术 | An understudy's rehearsal and prompting reveal her place in a musical production. |
| 2026-09-15 | olevel | The Trophy on the Shelf | 家庭与社区 | Concealing damage to a sibling's trophy becomes a lesson in family honesty. |
| 2026-09-16 | olevel | Speaking for My Mother | 家庭与社区 | A child's misleading translation tests trust, while a parent gains her own voice. |
| 2026-09-17 | olevel | Properly This Time | 健康与运动 | Father and child renegotiate fair sporting competition through badminton. |
| 2026-09-18 | olevel | The Spare Motor | 家庭与社区 | Competitors show reciprocal help and sporting generosity during a robotics event. |
| 2026-09-21 | olevel | Let Him Finish | 健康与运动 | Speech-therapy advice replaces interrupting a person who stammers with patient listening. |
| 2026-09-22 | olevel | The Armband | 健康与运动 | Football captaincy involves inclusive team leadership, tactics and participation. |
| 2026-09-23 | olevel | The Longest Day | 文化与艺术 | Participating in Ramadan fasting leads to respect for a friend's religious practice. |
| 2026-09-24 | olevel | The Fifty-First Stamp | 健康与运动 | A first blood donation reveals preparation, care and an experienced donor's vulnerability. |
| 2026-09-25 | olevel | Heads or Tails | 家庭与社区 | A sibling rethinks the fairness of a scarce family opportunity. |
| 2026-08-31 | ielts_light | Bees in the City | 自然与环境 | Urban habitats affect bee forage, season and pesticide exposure. |
| 2026-09-01 | ielts_light | Working Against the Clock | 健康与运动 | Circadian rhythms explain night-shift health burdens and mitigations. |
| 2026-09-02 | ielts_light | Roads Made of Rubbish | 科技与工程 | Plastic-modified asphalt balances material performance and environmental uncertainty. |
| 2026-09-03 | ielts_light | The Last Speakers | 文化与艺术 | Language endangerment and revitalisation concern linguistic heritage. |
| 2026-09-04 | ielts_light | Farming Upwards | 科技与工程 | Vertical-farm engineering trades land and water savings against power costs. |
| 2026-09-07 | ielts_light | Power from the Tide | 科技与工程 | Tidal generation compares barrages, turbines and maintenance constraints. |
| 2026-09-08 | ielts_light | What Libraries Became | 家庭与社区 | Public libraries become inclusive spaces for practical and social support. |
| 2026-09-09 | ielts_light | The Most Valuable Rock | 历史与经济 | Salt preservation and taxation shaped trade routes, states and political protest. |
| 2026-09-10 | ielts_light | Keeping Time by Rail | 历史与经济 | Rail transport drove the historical adoption of common time and time zones. |
| 2026-09-11 | ielts_light | The Smell of Rain | 自然与环境 | Soil and plant chemistry, aerosols and wind explain the smell before rain. |
| 2026-09-14 | ielts_light | No Lead in the Pencil | 科技与工程 | Graphite-clay processing produces controllable pencil hardness. |
| 2026-09-15 | ielts_light | Money That Survives the Wash | 科技与工程 | Polymer currency addresses forgery and durability through material design. |
| 2026-09-16 | ielts_light | A Bottle Built Around Nothing | 科技与工程 | Vacuum-flask design limits conduction, convection and radiation. |
| 2026-09-17 | ielts_light | A Burn Without a Flame | 自然与环境 | Capsaicin chemistry connects sensory biology to a plant's seed-dispersal strategy. |
| 2026-09-18 | ielts_light | Otters Among the Office Towers | 自然与环境 | Clean waterways enable urban otter recovery and human-wildlife coexistence. |
| 2026-09-21 | ielts_light | Lines in the Sand | 科技与工程 | Barcode invention and standardisation create machine-readable retail information. |
| 2026-09-22 | ielts_light | The Burr on the Dog | 科技与工程 | Burdock hooks inspire a reusable nylon hook-and-loop fastener. |
| 2026-09-23 | ielts_light | Where the Salt Comes From | 自然与环境 | Weathering, transport, evaporation and mineral removal explain ocean salinity. |
| 2026-09-24 | ielts_light | Roots That Breathe | 自然与环境 | Mangrove root adaptations manage oxygen and salt in coastal ecosystems. |
| 2026-09-25 | ielts_light | Why Ice Floats | 自然与环境 | Water's molecular structure, density and freezing behaviour sustain aquatic habitats. |
| 2026-08-31 | ielts_authentic | The Slow Science of Coral | 自然与环境 | Coral restoration concerns reef ecology, genetic diversity and ecological limits. |
| 2026-09-01 | ielts_authentic | What the Ice Remembers | 自然与环境 | Ice cores record and constrain interpretations of past climate. |
| 2026-09-02 | ielts_authentic | Planning Corridors of Darkness | 自然与环境 | Conservation treats darkness and connectivity as wildlife habitat. |
| 2026-09-03 | ielts_authentic | The Complicated Promise of Cool Pavements | 科技与工程 | Reflective pavement design requires full-system thermal and lifecycle evaluation. |
| 2026-09-04 | ielts_authentic | When a River Is Given More Room | 自然与环境 | Restoring floodplain space manages flood storage and habitat across a river landscape. |
| 2026-09-07 | ielts_authentic | The Leaf That Moved Ships | 历史与经济 | Tea monopolies, trade imbalance, plantations and labour reshaped global history. |
| 2026-09-08 | ielts_authentic | Reading the Signs of a Volcano | 自然与环境 | Geological, deformation and gas evidence inform volcano-hazard assessment. |
| 2026-09-09 | ielts_authentic | The Root Network | 自然与环境 | Research tests the extent and function of forest mycorrhizal networks. |
| 2026-09-10 | ielts_authentic | Cement That Heals | 科技与工程 | Concrete self-healing mechanisms and durability incentives concern construction materials. |
| 2026-09-11 | ielts_authentic | The Horse Before the Wheel | 历史与经济 | Ancient DNA and archaeology trace horse domestication and its political consequences. |
| 2026-09-14 | ielts_authentic | Why Birds Fly in a V | 自然与环境 | Aerodynamics and tracking studies explain migratory bird formation and cooperation. |
| 2026-09-15 | ielts_authentic | The Unremarkable Box | 历史与经济 | Container standardisation transforms port labour, logistics and world trade. |
| 2026-09-16 | ielts_authentic | The Trouble with the Marshmallow Test | 心理与行为 | Replication, confounding and trust qualify interpretations of delayed-gratification experiments. |
| 2026-09-17 | ielts_authentic | A Cure Mixed in a Cup | 健康与运动 | Oral rehydration research and adoption address diarrhoeal dehydration. |
| 2026-09-18 | ielts_authentic | The Forecast That Took Six Weeks | 科技与工程 | Numerical weather forecasting develops through computation, initial-condition control and ensembles. |
| 2026-09-21 | ielts_authentic | The Mould That Waited | 健康与运动 | Penicillin became a useful treatment through extraction, trials and production. |
| 2026-09-22 | ielts_authentic | The Banana Problem | 自然与环境 | Genetic uniformity leaves banana crops vulnerable to disease and motivates diversity. |
| 2026-09-23 | ielts_authentic | A Limit on Friendship? | 心理与行为 | Dunbar's social-brain hypothesis and its statistical limits concern relationship cognition. |
| 2026-09-24 | ielts_authentic | The Pill With Nothing in It | 健康与运动 | Open-label placebo trials examine symptom relief, care and clinical limitations. |
| 2026-09-25 | ielts_authentic | Mosquitoes Against Mosquitoes | 健康与运动 | Wolbachia mosquito programmes compare public-health methods for dengue control. |

