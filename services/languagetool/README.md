# LanguageTool 服务

学生在简答题里写完，失焦一秒多之后自动查一次拼写和语法，只提示不代改。

## 它不做什么

**不判分。** 它看不到参考答案，也永远不该看到。所以这是「写作反馈」，
与「零 Anthropic 调用」的判分铁律无关。

## 部署

Railway 上新建一个服务，Root Directory 指向本目录，走 `railway.json` 里的
Dockerfile。起来之后把内网地址配给 API：

    LANGUAGETOOL_URL = http://<服务名>.railway.internal:8010

**API 侧没配这个变量时整个功能自动关闭** —— 学生端问一次 `/writing-check/status`
拿到 `enabled: false` 就不显示提示区，作答和交卷完全不受影响。

## 内存

只装英语约 700 MB，`Java_Xmx` 设了 768m。如果 Railway 上给的规格更小，
把 `Java_Xmx` 调低即可；查不动的时候 API 侧是 6 秒超时后静默降级，不会挡住学生。

## 验证

    curl -s -X POST http://localhost:8010/v2/check \
      --data-urlencode "text=he away give wirter pen" --data "language=en-GB" | head -c 400

---

## 附：为什么没做「Wiktionary 替换 ECDICT」

2026-09-09 调研本来把这一项列为「建议接」，实际动手后发现缺口比想象的小：

- 生产 4182 个词条里只有 **54 个缺音标**（1.3%），另有 221 个是老式记号 ——
  老式那批已经在学生端显示层转成新式 IPA（`lib/word-display.ts`），不用动库。
- 「查 was 出华盛顿州」「rice 出词作家」这类错义项，已经由指针词条还原和
  人名地名过滤解决（`vocab.service.ts` / `word-display.ts`）。

剩下那 54 个试过两条路，都放弃了：

- **kaikki.org 全量包 3 GB 且已标记废弃**，为 54 个词导 3 GB 不划算。
- **CMUdict 离线换算**：写了 ARPAbet→IPA 转换器，但 CMUdict 是**美音且带儿化**，
  换算出的英音不可靠 —— `seismologists` 出来是 `/ˌsaɪˈzmɒlədʒəsts/`（正确是
  `/saɪzˈmɒlədʒɪsts/`，重音位置要靠音节合法性判断），`years` 出来是 `/jɪrz/`
  （英音是 `/jɪəz/`，非儿化）。**给学生看错的音标比不给更糟**，所以砍掉。

这 54 个词现在没有音标，学生端本来就兼容（不显示那一行）。真要补，正确的做法是
从 Wiktionary 取英音 IPA，而不是从美音词典换算。
