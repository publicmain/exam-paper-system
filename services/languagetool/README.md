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
