# STUDENT-WEB ORIGIN SPIKE

重建阶段 **3B / S2** 的一次性验证件。**不是产品代码。**

## 它要回答什么

方案 A（学生端独立源）在 Railway 上是否成立：

1. 能不能在 staging 项目里再起一个**独立的**静态服务，并拿到它自己的
   Railway 生成域名？
2. 那个新源的**深层路径**（如 `/app/today`）能不能靠 SPA 兜底直接打开？
3. 起了它之后，**既有的三个服务与它们的路由有没有任何变化**？

## 它刻意不包含什么

没有 React 或任何产品代码、**没有 Service Worker**、**没有 manifest**、
不发任何 API 请求、不做认证、不读任何环境变量、不含任何密钥或学生数据。

之所以连 SW 和 manifest 都不放：S3 要在装着旧 PWA 的真机上做测试，
这个页面必须是一个**干净的对照组** —— 它不能自己注册 SW，否则分不清
观察到的行为是谁造成的。

## 证据面

| 面 | 值 |
|---|---|
| 可见文字 | `STUDENT-WEB ORIGIN SPIKE` |
| HTML 标记 | `<!-- spike-marker: student-web-origin -->` |
| 响应头 | `X-Spike-Service: student-web-origin` |
| 缓存 | `Cache-Control: no-store` |

## 生命周期

**用完即删。** S3 结束后，或方案 A 被否决时，删除
`stg-student-web-spike` 服务即可 —— 它与既有三个服务没有任何耦合，
没有共享变量、没有数据库连接、没有私有网络调用。

## 部署方式（记录用，不要随手重跑）

在 `spikes/student-web-origin/` 目录下对 staging 项目的
`stg-student-web-spike` 服务执行上传部署，然后为它生成一个 Railway
域名。**任何一步都不得触碰 `stg-web` / `stg-api` / `Postgres`。**
