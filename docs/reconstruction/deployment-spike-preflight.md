# 部署 spike 预检（阶段 3A）

> 2026-08-27 · 建立于基线 `c07c9c2`
> **S1 修订**（同日，C1 只读授权下）—— §2 的官方调研有错，已更正；
> U1–U5 逐条定案；拓扑推荐重算。修订处标 **[S1]**。
> **阶段 3A = 不碰 staging 的那一半。** 本文件只做三件事：把仓库能证明的
> 事实钉死、用官方文档回答能回答的、把 S1–S7 变成一份可授权、可执行、
> 可回滚的阶段 3B 清单。
>
> **本轮没有执行任何外部动作** —— 没跑 Railway CLI、没开面板、没部署、
> 没建服务或域名、没改环境变量、没连数据库、没执行夹具、没动任何设备上
> 的浏览器或 PWA。
>
> **阶段 3（S1–S7）仍未完成，仍是阻断项。** 阶段 3B 需要单独授权。

---

## 0. 分支状态快照（**2026-08-27**）

> **这是一个带日期的快照，不是活数据。** 之后它必然过时 —— 要当前值请
> 自己跑 `git status -sb` / `git rev-list --count origin/main..HEAD`。
> 其他文档（README / CLAUDE.md / product-contract）**刻意不再记录**这些
> 数字，因为它们每提交一次就变。

| 项 | 2026-08-27 的值 |
|---|---|
| 本地 `main` HEAD | `c07c9c2` |
| `origin/main` | `b72212e`（`docs: P1 完成登记`） |
| 本地领先 `origin/main` | 43 个提交 |
| RC1.1 代码推到过的分支 | 只有 `staging-manual-test`（tip `69c21f7`） |
| 冻结标签 | `pre-student-reconstruction-4ad1ead` → `4ad1ead` |

**这份快照能证明的**：重建期的提交不在 `origin/main` 上。
**它不能证明的**：生产实际部署的是哪个提交 —— 那要看部署平台自己的
记录，本仓库没有。生产状态一律记为 **UNVERIFIED**。

---

## 1. 仓库能证明的部署事实

全部来自本仓库文件，可复查。

| # | 事实 | 证据 |
|---|---|---|
| F1 | **web 镜像只服务一个 SPA**，nginx 静态托管 | `apps/web/Dockerfile`：`nginx:alpine` + `COPY --from=builder /app/dist /usr/share/nginx/html` |
| F2 | **`/` 走 SPA 兜底** | `apps/web/nginx.conf`：`location / { try_files $uri $uri/ /index.html; }` |
| F3 | **不存在 `/app` 的路径分流或反向代理** | `nginx.conf` 只有三个 location：`/`、`~* \.mjs$`、`~* \.(js\|css\|svg\|png\|jpg\|jpeg\|gif\|woff2?)$`。没有 `proxy_pass`，没有 `/app` |
| F4 | **nginx 监听 8080** | `nginx.conf`：`listen 8080;`；`Dockerfile`：`EXPOSE 8080` |
| F5 | **`BrowserRouter` 没有 `basename`** | `apps/web/src/main.tsx`：`<BrowserRouter>` 无属性。换句话说现有前端**假定自己挂在根路径** |
| F6 | **旧 SW 注册在 `/sw.js`，作用域 `/`** | `main.tsx`：`navigator.serviceWorker.register('/sw.js')`，未传 `scope`，默认作用域 = 脚本所在目录 = `/` |
| F7 | **缓存名 `zaoce-pwa-v4`，`skipWaiting()` + `clients.claim()`** | `apps/web/public/sw.js` |
| F8 | **导航 network-first，同源静态资源 cache-first** | `sw.js`：`isNavigation` 分支先 `fetch` 再回落缓存；`sameOrigin` 分支先 `caches.match` |
| F9 | **`/api/*` 从不缓存、从不由缓存回答** | `sw.js`：`if (isApi) { event.respondWith(fetch(req, { cache: 'no-store' })); return; }` |
| F10 | **离线导航兜底会去找 `/my-lesson` → `/my-history` → `/`** | `sw.js` 的 `catch` 分支。这三个是**旧路由**——新端在同源下会继承这个兜底 |
| F11 | **manifest `start_url` = `/my-lesson`，`scope` = `/`** | `apps/web/public/manifest.webmanifest` |
| F12 | **SW 只在 `import.meta.env.PROD` 注册** | `main.tsx` |
| F13 | **生产环境下 API 强制要求显式 CORS 白名单，否则拒绝启动** | `apps/api/src/main.ts` `resolveCorsOrigin()`：`NODE_ENV === 'production'` 且 `CORS_ORIGINS`/`ALLOWED_ORIGINS` 为空或 `*` → `process.exit(1)` |
| F14 | **API 的 CORS 开着 `credentials: true`** | `main.ts`：`cors: { origin: resolveCorsOrigin(), credentials: true }` |
| F15 | **前端 API base 是构建期常量** | `apps/web/src/lib/api.ts:4`：`export const BASE = import.meta.env?.VITE_API_URL \|\| ''`；`Dockerfile` 里是 `ARG VITE_API_URL` |
| F16 | **`BASE` 为空 → 同源相对路径 `/api/...`** | 同上，`fetch(\`${BASE}/api${path}\`)` |
| F17 | **学生身份走 `Authorization: Bearer`，令牌存 `localStorage.auth_token`，不用 Cookie** | `api.ts:22,26-30` |
| F18 | **唯一用 `credentials: 'include'` 的是教师端考勤导出** | `api.ts:751`。学生端不涉及 |
| F19 | **workspaces 是 `apps/*`** | 根 `package.json`。新增 `apps/student-web` 会被自动纳入 |
| F20 | **两个 Railway 服务各有自己的 `railway.json`** | 根 `railway.json`（API，`apps/api/Dockerfile`，健康检查 `/api/health`）；`apps/web/railway.json`（nginx） |

**F5 + F6 + F11 合起来的含义**：现有前端在**代码层面**假定自己独占一个源
的根路径。把新端塞进同一个源的 `/app/*`，会同时触碰路由基名、SW 作用域
和 manifest 作用域三件事。

---

## 2. Railway 官方文档调研

**只用官方文档**（`docs.railway.com`）。访问日期：**2026-08-27**。
下面严格区分「文档写了的」与「我的推断」。

### 2.0 [S1] 上一版这一节错在哪

上一版写的是「Railway 文档从未提及路径匹配」。**这是错的。**
Railway 有 **Edge Rules**，其匹配条件**明确包含 Path**。

错误的根源是把两件事混成了一件：

| | 是什么 | Railway 支持吗 |
|---|---|---|
| **(a) 路径匹配 / 重定向** | 按路径命中一条规则，然后 block / allow / challenge / **redirect** / 改缓存 | **支持**（Edge Rules，见 R6/R7） |
| **(b) 同源路径级多服务反向代理** | 按路径把请求**转发到另一个 Railway 服务**，浏览器地址栏不变 | **官方文档里没有任何动作能做到**（见 R8） |

**重定向 ≠ 反向代理。** 重定向是把浏览器打发去另一个地址（地址栏会变、
跨源就是跨源、多一次往返）；反向代理是同一个源里悄悄换后端。
本文件后续一律区分这两者，不再混用。

### 2.1 文档明确写了的

| # | 结论 | 出处 |
|---|---|---|
| R1 | 自定义域名通过 DNS 的 `CNAME` + `TXT` 记录配置，**两条都必须** | [Public Networking](https://docs.railway.com/networking/public-networking) |
| R2 | 支持**通配符域名**；不能嵌套（`*.*.yourdomain.com` 不行）；可用于任意子域层级 | [Working with Domains](https://docs.railway.com/networking/domains/working-with-domains) |
| R3 | 添加自定义域名时**要选一个端口**，「选定的端口将处理路由到该域名的全部流量」 | [Working with Domains](https://docs.railway.com/networking/domains/working-with-domains) |
| R4 | 私有网络：服务间用 `SERVICE_NAME.railway.internal`；「所有服务间通信使用 Wireguard 加密」；「无需暴露或配置端口」 | [Private Networking](https://docs.railway.com/networking/private-networking) |
| R5 | Advanced Concepts 描述的「路由」只有三类：同服务多副本负载均衡、私有网络服务间通信、公网域名指向单个服务 | [Advanced Concepts](https://docs.railway.com/overview/advanced-concepts) |
| **R6 [S1]** | **Edge Rules 的匹配条件包含 Path** —— 「the normalized request path (case-sensitive)」，另有 Client IP（IPv4 / CIDR）、Host、Header | [Edge Rules](https://docs.railway.com/networking/edge-rules) |
| **R7 [S1]** | **Edge Rules 的动作只有五个**：`Block`（返回 400–499，默认 403）、`Allow`（「Forwards the request to **your service** and skips all later rules」）、`Challenge`（浏览器验证页）、`Redirect`（「Redirects to another host or an exact HTTP or HTTPS URL」，支持 301/302/307/308，主机重定向**可保留原路径与查询串**）、`Override cache` | [Edge Rules](https://docs.railway.com/networking/edge-rules) |
| **R8 [S1]** | **五个动作里没有一个能把命中的请求转发到*另一个* Railway 服务。** `Allow` 的措辞是「your service」—— 就是这条域名本来指向的那个服务 | [Edge Rules](https://docs.railway.com/networking/edge-rules) |
| **R9 [S1]** | Edge Rules「require a public domain and a plan with an edge-rule allowance」；硬上限：规则集 64 KiB、单规则 32 个子句、表达式深度 4 | [Edge Rules](https://docs.railway.com/networking/edge-rules) |
| **R10 [S1]** | **一个服务可以有多个域名** —— 「enabling you to expose multiple HTTP ports through the use of multiple domains」。**按套餐限额**：Trial 1 个自定义域名；Hobby **每服务 2 个**；Pro **每服务 20 个**（可申请提高） | [Working with Domains](https://docs.railway.com/networking/domains/working-with-domains) |
| **R11 [S1]** | **私有 DNS 的地址族有时间分界**：「New environments (created after October 16, 2025): DNS names resolve to both internal IPv4 and IPv6 addresses. Legacy environments: DNS names resolve to IPv6 addresses only.」 | [Private Networking · How it works](https://docs.railway.com/networking/private-networking/how-it-works) |
| **R12 [S1]** | **私有网络流量不计入 egress 计费** —— 「Internal traffic doesn't count toward egress billing」 | [Private Networking · How it works](https://docs.railway.com/networking/private-networking/how-it-works) |
| **R13 [S1]** | CLI **没有**远程一次性任务/作业执行命令。`railway run` 是「Run command with Railway env vars」—— **在本机执行**、只注入远端变量；`railway ssh` 是「SSH into service container」—— 进的是**已部署服务**的容器 | [CLI](https://docs.railway.com/cli) |
| **R14 [S1]** | CLI 自带帮助文本：「There is a maximum of **1 railway provided domain per service**」 | `railway domain --help`（官方 CLI 输出） |

### 2.2 U1–U5 定案 [S1]

| # | 状态 | 证据 / 还缺什么 |
|---|---|---|
| **U1** 平台是否支持按路径前缀把一个域名分流到多个服务 | **RESOLVED —— 不支持（就 (b) 而言）** | R6 证明**能按路径匹配**；R7 列出全部五个动作；R8 证明**没有一个能转发到另一个服务**。所以：**(a) 路径匹配 + 重定向 → 支持；(b) 同源路径级多服务反向代理 → 平台不提供，只能自建代理** |
| **U2** 同一主机名能否挂到两个服务 | **UNKNOWN** | 官方文档未涉及。**缺的证据**：在面板上把同一自定义域名加到第二个服务，看是否被拒 —— 那是**写操作（C4）**，C1 下不可做。**但此问已不影响决策**：即便可挂，R8 也决定了没有动作能按路径分流到不同服务 |
| **U3** 一个服务能挂几个域名 | **RESOLVED** | R10：文档明确支持一服务多域名，且给出按套餐的限额（Trial 1 / Hobby 2 / Pro 20）。R14：**Railway 生成域名每服务上限 1 个**。**本项目实际套餐未查证** —— 见 §2.3 |
| **U4** 私有网络地址族 / 绑定 / 默认开启 / egress | **部分 RESOLVED** | R11 解决地址族（2025-10-16 之后创建的环境 IPv4+IPv6；更早的仅 IPv6）；R12 解决 egress（不计费）。**仍 UNKNOWN**：应用是否必须绑定特定网卡（`::` vs `0.0.0.0`）、私有网络是否默认开启 —— 该页未覆盖 |
| **U5** 是否有一次性任务/作业执行形态 | **RESOLVED —— 没有** | R13：`railway run` 在本机跑，`railway ssh` 进已部署服务的容器；命令列表里没有任何 one-off job。**这直接毙掉 §9 的 P1 选项** |

### 2.3 [S1] 仍需面板只读才能回答的

| 问题 | 为什么 CLI 答不了 |
|---|---|
| 本项目所在套餐是否含 **edge-rule allowance**（R9 的前提） | CLI 没有 edge-rules 子命令；套餐信息在面板。**本轮未查** |
| Edge Rules **界面**实际显示的动作列表是否与文档一致 | 需要打开面板。**本轮未查** —— 文档口径见 R7 |
| 界面上是否存在任何「转发到另一个服务」的选项 | 同上。**本轮未查** —— 文档口径见 R8（没有） |

> 这三项都属于**面板只读**。本轮的 C1 是通过 CLI 行使的（GraphQL 令牌
> 已失效），面板未打开。它们不阻断 U1 的结论 —— R8 已经从文档层面
> 给出了否定答案。

---

## 2.5 [S1] C1 只读勘察记录（2026-08-27）

**授权**：C1（Railway 只读）。**只看了 staging 项目 `exam-staging-manual`，
没有访问任何生产项目、服务、域名、部署、日志或变量。**

**执行过的命令（全部只读）**：`railway whoami`、`railway --help`、
`railway service --help`、`railway domain --help`（仅帮助文本）、
`railway status`、`railway service list`。

**刻意未执行**：`railway variables`（明令禁止）、`railway domain`
（**无参数会创建域名 —— 是写操作**）、`up` / `deploy` / `add` / `down` /
`redeploy` / `restart` / `connect` / `run` / `ssh` / `logs`。

> **GraphQL API 本轮不可用** —— 本机 `~/.railway/config.json` 里的令牌对
> `backboard.railway.com` 返回 `Not Authorized`（CLI 自身仍是登录状态）。
> 因此本次勘察走 CLI，面板未打开。

### 观察到的（不含任何变量值、凭据或内部密钥）

| 项 | 观察结果 |
|---|---|
| 项目 | `exam-staging-manual`（**staging**，与生产项目不同） |
| 环境 | 单一环境，名为 `production`（这是**环境名**，不是生产项目） |
| 服务 | **3 个**：`Postgres`、`stg-api`、`stg-web`，均 Online |
| 部署来源 | `Postgres` 用镜像 `ghcr.io/railwayapp-templates/postgres-ssl:18`；`stg-api` / `stg-web` 由本机 `railway up` 上传部署（无 GitHub 仓库触发器） |
| 域名 | 三个服务**各有且仅有一个 Railway 生成域名**（`*.up.railway.app`）；`railway status` / `service list` **没有显示任何自定义域名** |
| 卷 | `Postgres` 挂了一个 volume（`/var/lib/postgresql/data`） |
| 生成域名上限 | 每服务 1 个（R14） |

### 本次勘察**没有**回答的（需要面板只读，见 §2.3）

套餐是否含 edge-rule allowance；Edge Rules 界面的动作列表；界面上有无
「转发到另一个服务」的选项。

### 状态未变更的证明

勘察前后各取一次 `railway service list`，服务数、服务 id、部署 id、
域名**逐项一致**（部署 id 仍是上一轮部署时记录的那几个）。
**本轮没有创建、提交、生成、附加、解除或修改任何东西。**

---

## 3. [S1] 三种部署拓扑的对比（重算）

U1 定案后，选项从两个变成三个 —— 因为「Edge Rule 路径重定向」是一个
**真实存在**的中间形态，上一版把它和反向代理混为一谈了。

### 方案 A —— 学生端独立源

新端一个 Railway 服务 + 自己的主机名（自定义域名，或该服务自带的那一个
生成域名，R14）。旧端在应用层做跨源跳转。

### 方案 B —— 同源 `/app/*` 反向代理

同一个主机名，`/app/*` 由新端应答、**地址栏不变**。

**U1 已定案：Railway 平台不提供这个能力**（R8）。**唯一实现方式是自建
反向代理服务**：域名 → 自建代理（nginx / rpxy 等）→ 经私有网络
（R4，`SERVICE.railway.internal`）分发到两个后端。

### 方案 C —— Edge Rule 路径重定向到独立源 [S1 新增]

同一个主机名上加一条 Edge Rule：`Path` 前缀命中（R6）→ `Redirect` 到
新端的主机名（R7，301/302/307/308，主机重定向**可保留原路径与查询串**）。

**这不是反向代理。** 浏览器**会真的跳过去**，地址栏变成新端的主机名，
结果和方案 A 是同一个终点 —— 区别只在于「谁把人送过去」：
A 是应用代码送，C 是边缘规则送。

| 维度 | A 独立源 | B 同源反代 | C 边缘重定向 → 独立源 |
|---|---|---|---|
| **平台支持** | 落在 Railway 明确支持的模型上（R3/R5/R14） | **平台不提供**（R8）→ 必须自建代理 | 支持，但**依赖套餐含 edge-rule allowance**（R9，未查证） |
| **最终落点** | 新源 | **同源**（地址栏不变） | **新源**（地址栏会变） |
| **CORS** | 需把新源加进 `CORS_ORIGINS`（F13） | 不需要 | 需要（同 A） |
| **认证令牌** | 按源隔离 → 新源重登一次 | 共享 | 按源隔离 → 重登一次（同 A） |
| **旧 SW 干扰** | **新源上不可能**（跨源）；**但从旧源跳过去的那一次导航仍受旧 SW 影响**（见 §3.1） | 旧 SW 作用域 `/`（F6）会拦 `/app/*` 的导航与同源静态资源（F8），离线兜底还指向旧路由（F10） | **同 A** —— 重定向由旧源发起，那一跳**仍在旧 SW 作用域内**（见 §3.1） |
| **既有书签 / 主屏图标** | 靠**应用层**跳转送走（要等 SPA 加载 + JS 执行） | 继续有效 | 靠**边缘**送走 —— **在线时**比 A 更早：不用等 SPA 加载、不依赖 JS。**但仍要先过旧 SW 这一关**（§3.1），**离线时可能根本到不了边缘**。**UNVERIFIED，待 S3** |
| **灰度** | 应用层（§5.1） | 应用层 | **不能按学生分流** —— Edge Rule 只能按 IP / Host / Path / Header 匹配（R6），而学生身份在认证之后才知道（§5.1）。所以 C 只能做**全量**切换，灰度仍得在应用层 |
| **回滚** | 关灰度开关 / 下掉新服务 | 改代理配置（代理本身是新单点） | 删掉那条 Edge Rule（快，但**是写操作 C4**） |
| **新增基础设施** | 一个静态服务 | **一个代理服务（学生唯一入口前的新单点）** | 无（只是一条规则） |
| **运维复杂度** | 低 | 高 | 低 |

### 推荐：**A（独立源）为主**；**C 作为切换后的可选加速器（UNVERIFIED）**；**B 为最后退路**

三点变化：

1. **B 从「退路」降为「最后退路」。** U1 已定案：平台不提供路径级多服务
   转发（R8），B 必然要在学生唯一入口前引入一个自建代理。这不再是
   「未知成本」，而是**已知的、确定的**新单点。
2. **C 是新发现的、有价值的选项 —— 但它是 A 的补充，不是替代。**
   C 的终点和 A 一样是独立源；它的价值在于**把「送走旧入口」这件事从
   应用层挪到边缘**：在线时不用等 SPA 加载、不依赖 JS。它**可能**缓解
   A 的最大痛点（已装 PWA 与旧书签的迁移，O2 的风险面）——
   **但「可能」两个字要当真，理由见 §3.1。C 在 S3 做完之前一律记
   UNVERIFIED。**
3. **C 不能替代应用层灰度。** Edge Rule 只能按 IP / Host / Path / Header
   匹配（R6），**匹配不到学生身份**（§5.1：身份在认证之后才知道）。
   所以灰度开关仍归 API，C 只适合**整班切换之后**用来一次性把旧入口
   全量导向新端。

**落地顺序建议**：先按 A 建新端并用应用层灰度（阶段 15）；**整班切换
稳定后**再考虑加 C 的 Edge Rule 做全量导流。两者不冲突。

### 3.1 [S2 更正] Edge Rule 重定向**并不能**绕过旧 Service Worker

上一版（S1）写的是「边缘重定向旧 SW 也拦不住」。**这句话是错的，
现予更正。** 它把「重定向在边缘发生」误当成「请求不经过 SW」。

实际的时序是这样的：

```
学生点主屏图标 / 书签
   → 浏览器在**旧源**上发起一次 navigation 请求
   → **旧 SW 的 fetch 事件先触发**（它的作用域是 /，F6）
   → 旧 SW 决定：走网络？还是回缓存？
        · 在线 → network-first（F8）→ 请求真的出去 → **这时才轮到边缘**
                 → Edge Rule 命中 → 302/307 → 浏览器跳到新源
        · 离线 → fetch 抛错 → **回落到缓存的旧壳**（F10 的兜底：
                 /my-lesson → /my-history → /）→ **根本走不到边缘**
   → （只有当导航真的抵达新源之后）新源在旧 SW 的作用域之外
```

**四条必须写清楚的事实**：

1. **旧 SW 会先拦到那次导航** —— 它发生在旧源上，边缘还没参与。
2. **在线时**旧 SW 是 network-first，请求会出去，**因此能到达
   重定向** —— 这是 C 能工作的前提，但它是「因为 SW 恰好是
   network-first」，不是「因为 SW 被绕过了」。
3. **离线时**旧 SW 会返回缓存的旧壳，**重定向根本不会发生**。
4. **新源在旧 SW 作用域之外这一点，只有在导航真正抵达新源之后才成立** ——
   它不能倒推出「这一跳不受旧 SW 影响」。

**同一条更正也适用于方案 A** —— A 的跳转在应用层，比 C 更晚，
自然更受旧 SW 影响（还要多等 SPA 加载与 JS 执行）。

**结论**：C 相对 A 在**在线**路径上确实更早、更少依赖；但**两者都要
过旧 SW 这一关**，**离线路径两者都可能失败**。
**C 的实际行为在 S3 做完之前一律记 UNVERIFIED。**

### 前提假设（阶段 3B 要验的）

- **A1 [S1 部分解决]** 新服务能拿到**一个生成域名**（R14 明确每服务上限
  1 个）→ **技术上成立**。**仍未定**：是否接受把 `*.up.railway.app`
  的生成域名交给学生，还是要申请自定义域名。**这是产品判断。**
- **A2** API 的 `CORS_ORIGINS` 可追加新源 —— 由 F13 可知它是环境变量
  驱动的；改它属于 **C2**。
- **A3** 学生在新源重新登录一次是可接受的产品体验。**产品判断，需叶老师确认。**
- **A4 [S1 新增]** 若要用方案 C，需先确认套餐含 edge-rule allowance
  （R9）—— **面板只读即可回答**。

### 什么样的阶段 3B 观察会推翻这个推荐

| 观察 | 后果 |
|---|---|
| **O1** 生成域名被判定不可交给学生，且拿不到自定义域名 | A / C 都失去前提 → 只剩 B |
| **O2** S3 实测：已装的旧 PWA（standalone）无法把学生送到新源 | **C 正是为此准备的**（边缘重定向绕开 SW 与 JS）—— 先试 C；C 也不行才转 B |
| **O3** 跨源带 `Authorization` 的请求出现无法靠配置解决的预检失败 | 重新评估；按 F13/F14 不太可能 |
| ~~**O4** U1 被证实为原生支持路径分流~~ | **已排除** —— R8 给出否定答案 |

> 这仍是推荐，**不是已验证的部署事实**。S2 / S3 未做。

## 4. S1–S7 的可执行定义

每一项都给：前置 / 需要的确切读写动作 / 目标服务与环境 / 期望证据 /
通过判据 / 回滚 / **授权类别**（类别定义见 §6）。

**S1、S2 已完成（PASS）；S3 只完成了 S3A（设备观察，见 §10.5）；S3B 与 S4–S7 仍未完成。**

### S1 —— 主机名与路由能力确认　**✅ 已完成**（2026-08-27，C1）

| | |
|---|---|
| **前置** | 无 |
| **实际做了什么** | ① 官方文档：Edge Rules / Working with Domains / Private Networking(+How it works) / CLI，得到 **R6–R14**；② **C1 只读**勘察 staging（§2.5） |
| **目标** | 官方文档 + Railway 项目 `exam-staging-manual`（只读） |
| **证据** | §2.1 的 R6–R14（每条带官方链接）、§2.2 的 U1–U5 定案、§2.5 的勘察记录 |
| **通过判据 [S2 更正]** | **U1 给出关于「平台有没有原生的路径级多服务转发」的确定答案。** U2 不在判据里 —— 见下 |
| **结果** | **PASS** —— **U1 RESOLVED**：平台**不支持**路径级多服务转发（R8），但**支持**路径匹配 + 重定向（R6/R7） |
| **回滚** | 无（纯读；勘察前后状态逐项一致） |
| **授权** | **C1 Railway 读** ✓ 已行使 |

> **[S2 更正] 上一版把通过判据写成「U1、U2 都有确定答案」，然后又说
> U2 没答案也算 PASS —— 判据与结论自相矛盾。** 正确的判据只有 U1。
>
> **U2 为什么不该进判据**：U1 的结论是**动作层面**的 —— Edge Rules 的
> 五个动作里没有一个能转发到另一个服务（R8）。U2 问的是**绑定层面**的
> 事（同一主机名能否挂两个服务）。**绑定层面的任何答案都改变不了动作
> 层面的结论**：即便同一主机名真能挂到两个服务，也依然没有动作能按
> 路径把请求分给其中某一个。所以 U2 **UNKNOWN，且非阻断**。
> 严格闭合它需要**写操作（C4）**，本轮的授权不含它，也不值得为此申请。

### S2 —— 独立源拓扑验证　**✅ 已完成 · PASS**（2026-08-27）

> **[S2] 实际做法与上一版设计的差异**：上一版设计的是「两个空白页」
> （新旧各一个）。实际只需要**一个** —— 旧端 `stg-web` 已经在线且
> **本轮不得改动**，它自己就是对照组。这样既少一次部署，也把「旧端
> 零改动」变成可验证的事实。

| | |
|---|---|
| **前置** | S1 通过；拓扑选定为 A（独立源） |
| **授权** | C1 + C2-LIMITED（只配新服务）+ C3-LIMITED（建一个一次性服务）+ C4-LIMITED（生成一个 Railway 域名） |
| **实际写操作** | ① 新建空服务 `stg-student-web-spike`（无变量、无数据库、无仓库、无镜像）② 只上传 `spikes/student-web-origin/` 部署到它 ③ 为它生成**一个** Railway 域名（端口 8080） |
| **未做** | 自定义域名 / DNS、Edge Rule、代理服务、CORS、任何环境变量；**没有触碰** `stg-web` / `stg-api` / `Postgres` 及其域名 |

#### 新源结果（四条路由，全绿）

| 路由 | HTTP | `X-Spike-Service` | `Cache-Control` | 可见文字 | HTML 标记 |
|---|---|---|---|---|---|
| `/` | 200 | `student-web-origin` | `no-store` | ✓ | ✓ |
| `/app/today` | 200 | `student-web-origin` | `no-store` | ✓ | ✓ |
| `/app/lesson/reading` | 200 | `student-web-origin` | `no-store` | ✓ | ✓ |
| `/deep/nested/route` | 200 | `student-web-origin` | `no-store` | ✓ | ✓ |

**深层路径经 SPA 兜底回同一页面** —— 这是新端将来作为 SPA 的必要条件，
已成立。

#### 既有路由零退化

写入前后各测一遍，**逐项一致**：

| 路由 | 前 | 后 | 含 spike 头？ |
|---|---|---|---|
| 旧端 `/` · `/me` · `/my-lesson` · `/my-history` · `/my-vocab` · `/my-mistakes` | 200 / 1162B / text/html | **完全相同** | **0**（必须 0）|
| 旧端 `/sw.js` | 200 / 3152B / application/javascript | **完全相同**，内容指纹未变 | 0 |
| 旧端 `/manifest.webmanifest` | 200 / 905B | **完全相同**，内容指纹未变 | 0 |
| API `/api/health` | 200 | 200 | — |

**隔离性**：旧源上的 `/app/today` 仍由**旧端**的 SPA 兜底应答，
**不带 spike 头、不含 spike 标记**（计数 0）。两个源互不串扰。

#### 服务隔离证明

| 检查 | 结果 |
|---|---|
| `Postgres` / `stg-api` / `stg-web` 的**部署 id** | **三个全部未变**（与写入前快照逐项比对） |
| 既有三个服务的域名 | **未变** |
| 服务数 | 3 → 4，**新增的只有** `stg-student-web-spike` |
| 新服务的变量 | **零**（建的是空服务，未设任何变量） |
| 新服务与既有服务的耦合 | **无** —— 不共享变量、不连数据库、不走私有网络 |

> 比对脚本的输出里 `stg-web` 曾出现在「新增」一栏 —— 那是因为写入后
> 它带了 `(linked)` 后缀导致字符串不等，**不是真的变化**：它的部署 id
> 与域名都与写入前一致。记在这里免得日后误读。

#### 回滚状态

**未回滚 —— 刻意保留。** S2 通过，且 S3（SW / PWA 真机矩阵）需要这个
新源作为测试目标。spike 服务**保持在线，不再改动**。

**它随时可删**：删掉生成的域名 + 删掉 `stg-student-web-spike` 即可回到
写入前的三服务状态。因为它与既有服务零耦合，删除不影响任何东西。

#### S2 之后仍然未知

- **旧 PWA / 旧 SW 在真机上对这个新源的实际行为** —— 这正是 S3
- **C（Edge Rule 重定向）的实际行为** —— §3.1 已更正推理，仍 UNVERIFIED
- 生产环境的主机名形态（本轮只定了 staging 用生成域名）

### S3 —— Service Worker / PWA 矩阵　🔶 **S3A 已完成 · S3B 未完成**

> **S3A（设备观察）已完成**，证据见 §10.5：设备基线、旧 PWA 在线与
> **离线**行为、新源根路径与深层路径，全部 OBSERVED。
> **S3 整体不能记 PASS** —— 矩阵里的 **M10 因缺测试载体而无法触发**
> （BLOCKED BY TEST HARNESS，不是观察到的失败），M6–M9 未做。

| | |
|---|---|
| **前置** | S2 通过（新源在线） |
| **动作** | **设备侧写**：在**已装旧 PWA** 的真机与干净浏览器配置上，按 §8 矩阵逐格验证；必要时 `unregister()` 旧 SW、删除 `zaoce-pwa-v4` 缓存 |
| **目标** | 真机浏览器与已安装的 PWA（**不改服务端**） |
| **期望证据** | §8 每一格的实际结果；iPhone / Safari 必须有**人工截图证据**（Safari 无远程调试时靠肉眼与截图） |
| **通过** | 新端在「旧 SW 仍活着」的环境下能拿到新版本、不吃旧缓存；且旧 SW 的退役方式确定 |
| **失败** | 触发 **O2** → 推荐拓扑作废 |
| **回滚** | 设备侧：重装 PWA / 清站点数据。**服务端无改动可回滚** |
| **授权** | **C5 浏览器/SW 变更** |

### S4 —— 灰度判定层　**设计已定案 / 实现与 staging 行为未验证**

> [S1] 上一版把它记成「RESOLVED」，不准确。准确说法是：
> **设计决策已定**（开关归 API、按认证后的学生 id、fail-closed），
> **但代码没写、staging 上没跑过，实际行为未经验证。**

| | |
|---|---|
| **前置** | 拓扑选定 |
| **动作** | **只读 + 设计**：确认 §5 的设计（API 拥有开关，登录/`me` 回执携带版本）在现有代码里可落地；**本阶段不写代码** |
| **目标** | 代码走查，无外部动作 |
| **期望证据** | 一份落点清单：哪个端点加哪个字段、旧端在哪里读、失败时的默认值 |
| **通过** | 设计能回答「首次导航时不知道学生是谁」这个约束（见 §5） |
| **回滚** | 无（纯设计） |
| **授权** | 无（本地） |

### S5 —— `STUDENT_APP_ORIGIN` 的注入方式　**设计已定案 / 实现未验证**

> [S1] 同上：**运行期由 API 下发**是已定的设计决策；
> **尚未实现，也未在 staging 上验证过。**

| | |
|---|---|
| **前置** | S4 |
| **动作** | **只读 + 设计**：确定构建期还是运行期注入（见 §5） |
| **期望证据** | 决定 + 理由 + 变更时的生效路径（要不要重新构建） |
| **通过** | 变更该值**不需要重新构建前端** |
| **授权** | 无（本地） |

### S6 —— API 调用形态与 CORS

| | |
|---|---|
| **前置** | 拓扑选定 |
| **动作** | **写（配置）**：把新源加入 API 的 `CORS_ORIGINS`；随后**只读**验证一次预检 |
| **目标** | `stg-api` 的环境变量 |
| **期望证据** | 从新源发起的 `OPTIONS` 预检返回允许 `Authorization`；带令牌的 `GET /api/lesson/today` 返回 200 |
| **通过** | 上述两条成立，且 `stg-api` 仍能正常启动（F13：配错会直接拒绝启动） |
| **失败** | 触发 **O3** |
| **回滚** | 还原环境变量并重启（**注意**：还原成空值会让生产模式的 API 拒绝启动 —— 还原的是**旧的白名单值**，不是空值） |
| **授权** | **C2 Railway 写/配置** |

### S7 —— 夹具的安全执行环境

| | |
|---|---|
| **前置** | S1 |
| **动作** | 见 §9。**本阶段只比较选项，不执行** |
| **目标** | 待定 |
| **期望证据** | 选定方案 + 四道闸门全部保持 + 通知已关闭的验证记录 |
| **通过** | 有一条不削弱任何闸门的执行路径 |
| **回滚** | 见 §9 各选项 |
| **授权** | 视选项而定：**C2 / C3 / C6 / C7** |

---

## 5. S4–S6 的设计结论

### 5.1 灰度判定层 —— 只能在**认证之后**

这是本节最重要的一条约束，值得单独说：

**学生 ID 只有在认证通过之后才知道。** 首次导航是一个匿名 HTTP 请求：
令牌在 `localStorage` 里（F17），**只有该源上的 JS 读得到**，请求头里
没有它，也没有 Cookie（F18 那一处是教师端）。因此：

> **边缘层（代理 / nginx / Railway 路由）在首次导航时不可能按学生 ID
> 分流。** 任何「在入口按学生 ID 路由」的设计都是错的。

**推荐设计 —— 开关归 API 所有**：

1. `STUDENT_APP_V2` 是 **API 服务**的环境变量，由 API **在启动时校验**
   （照抄 `all-day.ts` 的 `assertAllDayConfig`：显式 `student:` 前缀，
   生产环境非法值直接拒绝启动）。
2. `POST /api/student-auth/login` 与 `GET /api/student-auth/me` 的回执里
   **增加两个只读字段**：`appVersion: 'v1' | 'v2'` 与 `studentAppOrigin`。
   服务端按已认证的学生 id 计算。
3. **旧端**在登录成功 / `me` 返回后读 `appVersion`：是 `v2` → 跳转到
   `studentAppOrigin`；否则原地不动。
4. **新端**同样读：是 `v1` → 把学生送回旧端。两端都遵守同一个事实源。
5. **fail-closed**：字段缺失、解析失败、请求失败 → **一律按 `v1` 处理**
   （留在旧端）。新端只在**明确收到 `v2`** 时才接管。

**边界**：`STUDENT_APP_V2` 的解析与校验**只发生在 API 里**，前端永远
不解析这个变量，只消费 `appVersion` 这个已算好的结论。

**回滚**：改 API 的一个环境变量并重启 —— **两个前端都不用重新部署**，
学生下一次登录 / `me` 调用即生效。

### 5.2 `STUDENT_APP_ORIGIN` 的注入

现有前端把 `VITE_API_URL` 烧在构建期（F15，`Dockerfile` 的 `ARG`）。
若照此办理，改一次跳转目标就要重新构建一次旧端。

**推荐：运行期，由 API 下发**（即 5.1 的 `studentAppOrigin` 字段）。

- 一个事实源，与 `appVersion` 同一份回执，不可能对不上
- 改它不需要重新构建任何前端
- 旧端里**不出现**新端的地址常量 —— 与冻结清单「旧代码不再往前长」一致

**退路**：若某些跳转发生在拿到回执之前（例如 PWA 冷启动改道），那一处
只能用构建期变量。**这类点在阶段 3B 要单独列出来**，不要默认全用运行期。

### 5.3 API 请求形态与 CORS

**方案 A（跨源）下**：

- 新端构建时设 `VITE_API_URL=<API 源>` → `BASE` 非空（F15）→ 请求是
  **绝对 URL、跨源**
- 身份是 `Authorization: Bearer`（F17），**不带 Cookie** → 不需要
  `credentials: 'include'`，不涉及 SameSite / 第三方 Cookie
- `POST` / `PATCH` 带 `Content-Type: application/json` + `Authorization`
  → **会触发预检**。API 的 `enableCors` 已开 `credentials: true`（F14），
  但**必须**把新源加进 `CORS_ORIGINS`（F13：生产模式下白名单为空会
  直接拒绝启动 —— 这条既是保护也是脚枪，改的时候要给完整列表）

**需要的 CORS 条目**：`CORS_ORIGINS` 追加新学生端的源（完整 scheme +
host，逗号分隔，不带尾斜杠）。**具体取值在阶段 3B 执行时给，不写进
仓库。**

**方案 B（同源）下**：`VITE_API_URL` 留空 → `BASE=''` → 相对 `/api`
（F16）→ 无需任何 CORS 改动。

### 5.4 令牌存储与失败行为

- 令牌继续放 `localStorage.auth_token`，`Authorization: Bearer` 发送
  （沿用 F17，不改认证模型）
- **跨源不共享** —— 这是浏览器行为，不是设计选择。新端首次使用要登录一次
- **fail-closed**：新端拿不到 `appVersion=v2` → 不接管；令牌无效 →
  回新端的登录页，**不回旧端的姓名页**（契约要求）

---

## 6. 阶段 3B 授权矩阵

**七个类别，互不继承。** 批准其中一类**不等于**批准另一类；
每一类都要单独说「可以」。

| 类别 | 允许什么 | **不允许**什么 | 回滚 |
|---|---|---|---|
| **C1 Railway 读** | 面板 / CLI 只读：看服务列表、域名设置界面、环境变量名（**值一律脱敏**）、部署状态、日志 | 任何写操作；读取并记录密钥值 | 无（纯读） |
| **C2 Railway 写 / 配置** | 改 staging 服务的环境变量（如 `CORS_ORIGINS`、`STUDENT_APP_V2`） | 建服务、改域名、动生产项目 | 还原为**改动前的原值**（不是空值 —— 见 S6） |
| **C3 staging 部署** | 对 staging 项目执行部署（`railway up` / 重新部署），含新建 spike 服务 | 部署到生产项目；改域名 | 回滚到上一次部署 / 删除 spike 服务 |
| **C4 域名 / 代理变更** | 增删自定义域名、绑定端口、部署或配置反向代理服务 | 动生产域名；改 DNS 以外的东西 | 还原域名绑定；删除代理服务 |
| **C5 浏览器 / SW 变更** | 在真机上 `unregister()` SW、删除 `zaoce-pwa-v4` 缓存、重装 PWA、清站点数据 | 在**学生本人**的设备上操作（只能用测试设备） | 重装 PWA / 清站点数据后重新访问 |
| **C6 staging 数据库读** | 对 staging 库执行只读查询（对账、通知开关核验） | 任何写；连生产库 | 无（纯读） |
| **C7 staging 数据库写 / 执行夹具** | 在 staging 库上运行八账号夹具 | 连生产库；削弱任何一道闸门 | 重新播种回初始态（**注意**：会再次撤销令牌） |

**跨类提醒**：

- S2 需要 **C2 + C3**，若涉及域名再加 **C4**
- S6 只需要 **C2**，但改错会让 API 拒绝启动（F13）→ 改之前先记下原值
- S7 至少需要 **C6**（先验通知已关）再 **C7**（执行）——**顺序不能反**

---

## 7. S2 设计（只设计，不实施）

### 7.1 两个不会认错的空白页

| 服务 | 页面内容 | HTML 标记 | 响应头标记 |
|---|---|---|---|
| 旧端 `stg-web` | **不动**，保持现状 | 现有 SPA | — |
| spike 新服务 | 一个 `index.html`，正文只有一行大字 **`SPIKE-B / STUDENT-WEB PLACEHOLDER`** | `<!-- spike-marker: student-web -->` 与 `<title>SPIKE-B</title>` | `X-Spike-Service: student-web` |

**空白页必须不含**：SW 注册、manifest、任何产品代码、任何 API 调用。
它存在的唯一目的是回答「这个 URL 由哪个服务应答」。

### 7.2 路由矩阵（期望值）

**方案 A（独立源）下**：

| 请求 | 期望应答方 | 期望证据 |
|---|---|---|
| `https://<旧源>/` | 旧端 | 现有教师登录页 |
| `https://<旧源>/me` | 旧端 | 现有学生入口 |
| `https://<旧源>/my-lesson` | 旧端 | 现有课程页 |
| `https://<新源>/` | spike | `X-Spike-Service: student-web` + `SPIKE-B` 标记 |
| `https://<新源>/anything/deep` | spike | 同上（SPA 兜底行为待定，空白页阶段可 404，**记录即可**） |

**方案 B（同源分流）下**：

| 请求 | 期望应答方 | 期望证据 |
|---|---|---|
| `https://<源>/` | 旧端 | 现有教师登录页 |
| `https://<源>/me` | 旧端 | 现有学生入口 |
| `https://<源>/my-lesson` | 旧端 | 现有课程页 |
| `https://<源>/my-history` | 旧端 | 现有成绩页 |
| `https://<源>/app` | spike | `X-Spike-Service` |
| `https://<源>/app/` | spike | 同上 |
| `https://<源>/app/today` | spike | 同上（**深层路径必须也落到 spike**，否则 SPA 路由无法工作） |
| `https://<源>/api/health` | API | `{"ok":true,...}` |

### 7.3 旧路由回归检查（每次改动后都要跑）

| 检查 | 通过判据 |
|---|---|
| `/` | 仍是教师登录页 |
| `/me` | 仍能打开学生登录卡 |
| `/my-lesson`、`/my-history`、`/my-vocab`、`/my-mistakes` | 均正常渲染 |
| `/api/health` | 200 且 `ok:true` |
| 任意 hashed 静态资源（`/assets/index-*.js`） | 200，`Content-Type` 是 JS |
| `/sw.js` | 200，内容与仓库一致（**不得**被代理改写） |
| `/manifest.webmanifest` | 200 |

**任何一行退化 = S2 失败**，立即执行 §7.4。

### 7.4 拆除步骤

1. 若改过域名绑定：**先还原绑定**（回到「域名 → `stg-web`」）
2. 跑一遍 §7.3 回归检查，确认旧端恢复
3. 删除 spike 服务（及代理服务，若建过）
4. 记录：删除时间、删除前最后一次部署 id
5. **不动**任何环境变量（S2 不应改环境变量；若改过，按 C2 的回滚还原原值）

---

## 8. S3 设计 —— SW / PWA 测试矩阵（只设计，不实施）

**前提**：旧 SW 作用域 `/`（F6）、缓存 `zaoce-pwa-v4`（F7）、
导航 network-first / 同源静态 cache-first（F8）、离线兜底指向旧路由
（F10）。**方案 A 下 §8.2 的绝大多数格子应当「不适用」——
这本身就是要验证的结论。**

### 8.1 环境组合

| 维度 | 取值 |
|---|---|
| 客户端 | ① 已安装旧 PWA（主屏图标，standalone）② 普通浏览器标签页 |
| 控制器 | ① 旧 SW 处于 active 且已 claim ② 全新配置（无 SW） |
| 网络 | ① 在线 ② 离线 |
| 缓存 | ① 冷（首次）② 热（已有 `zaoce-pwa-v4` 条目） |
| 导航 | ① 首次导航 ② 刷新 |
| 资源 | ① 旧端 hashed 资源 ② 新端 hashed 资源 |

### 8.2 逐格观察项

| # | 场景 | 要看什么 | 通过判据 |
|---|---|---|---|
| M1 | 旧 PWA + 旧 SW active + 在线 + 打开**新端地址** | 谁应答了这次导航；`navigator.serviceWorker.controller` 是谁 | 拿到新端内容；未被旧缓存替换 |
| M2 | 同上 + **刷新** | 是否仍是新端 | 是 |
| M3 | 旧 PWA + 旧 SW active + **离线** + 打开新端地址 | 是否触发 F10 的兜底（回落到 `/my-lesson` 等旧路由） | **方案 A 下应完全不发生**；方案 B 下若发生 → 必须处理 |
| M4 | 干净配置 + 在线 + 新端 | 基线行为 | 正常 |
| M5 | 旧 SW active + 请求**新端的 hashed 资源** | 是否被 cache-first 存进 `zaoce-pwa-v4` | 方案 A：不可能（跨源）。方案 B：若发生 → 必须解决 |
| M6 | 旧端**更新**一次（改一个字）后重新打开 | 新版本是否生效（network-first 应保证） | 生效 |
| M7 | 执行 `unregister()` 旧 SW | 是否成功；之后导航是否正常 | 成功且正常 |
| M8 | 删除 `zaoce-pwa-v4` 缓存 | 之后首次加载是否正常（应只是慢一点） | 正常 |
| M9 | M7/M8 之后**回滚**（重新访问旧端） | 旧 SW 是否重新注册、行为是否恢复 | 恢复 |
| M10 | 旧 PWA 主屏图标 → 跨源跳转到新端 | standalone 模式下跳出 scope 会怎样（留在 app 壳里？弹到浏览器？） | **这就是 O2 的判据** |

### 8.3 iPhone / Safari 的特别要求

Safari 没有可用的远程 SW 调试面板（相对 Chrome DevTools 的
Application 面板），因此：

- **M1、M2、M3、M10 在 iPhone 上必须有人工截图证据**：地址栏 /
  页面标记 / 是否仍在 standalone 壳里，逐张记录
- iPad 走同一套（注意 iPadOS 的 Safari 默认报 Mac UA —— 仓库里
  `lib/pwa.ts` 已有这个坑的处理，测试时按真实设备记录，不按 UA）
- 记录 iOS 版本号

---

## 9. S7 —— 夹具安全执行环境的选项对比（不执行）

**必须保持不变的四条**（任何选项都不得削弱）：

1. `NODE_ENV=production` **无条件拒绝，没有覆盖开关**
2. 目标库是**隔离的 staging / 测试库**
3. **落任何数据之前**先验证外发通知已关闭
4. 凭据（`DATABASE_URL`、`STAGING_SEED_PIN`）**只在执行时提供**，
   不进仓库、不进文档
5. 执行会使 `studentAuthVersion` +1 → **撤销该八个账号的全部令牌**，
   在测设备会被踢回登录页（这一条是知情提醒，不是可选项）

| 选项 | 做法 | 代价 / 风险 | 授权类别 |
|---|---|---|---|
| ~~**P1 一次性任务容器**~~ **[S1] 已排除** | ~~用一个 `NODE_ENV` 非 production 的临时容器跑~~ | **U5 已定案：Railway 没有这种形态**（R13 —— `railway run` 在本机跑，`railway ssh` 进的是已部署服务的容器）。**此选项不存在** | — |
| **P2 临时外网通道 + 本机执行** | 给 staging 的 Postgres 临时开一条外网通道，从本机跑（本机 `NODE_ENV` 未设 → 闸门 1 通过；闸门 3 由命令行显式传 `DATABASE_URL` 满足） | 在开通期间**数据库暴露在公网**（有强随机口令，但仍是暴露）；用完必须立刻关闭 | C4（开通道）+ C6 + C7 |
| **P3 staging 改用非 production 的 `NODE_ENV`** | 把 `stg-api` 的 `NODE_ENV` 改成别的值 | **削弱 staging 的价值** —— staging 之所以有意义，就是它与生产同一套运行模式（F13 的 CORS 硬门也挂在这个变量上，改了会一并改变行为）。**不推荐** | C2 |

**[S1] 倾向已更新**：U5 已定案为「没有一次性任务形态」（R13），**P1 排除**。
于是只剩：

- **P2（临时外网通道 + 本机执行）** —— 现在是**首选**。本机 `NODE_ENV`
  未设 → 闸门 1 通过；`DATABASE_URL` 由命令行显式传 → 闸门 3 通过。
  代价是开通期间数据库暴露在公网，**用完必须立刻关闭**。
- **P3（改 staging 的 `NODE_ENV`）** —— **仍不推荐**。它会连带改变
  F13 的 CORS 硬门行为，并让 staging 不再与生产同一运行模式。

另有一个 **[S1] 新想到、尚未评估**的方向：给夹具做一个「本机跑、
经临时通道连库」之外的替代 —— 例如把它做成一个**只在需要时部署、
用完即删的一次性服务**（`NODE_ENV` 不设 production）。这在 Railway 上
是「建服务 + 部署 + 删服务」，属于 **C3**，不是 one-off job，
**成本与风险未评估**，列在这里供阶段 3B 讨论。

**执行前的强制核验（顺序不可颠倒）**：

1. **C6 只读**：确认 `NotificationConfig` 中 `enabled = true` 的行数为 **0**、
   `NotificationLog` 为 **0**、`TEACHER_DAILY_DIGEST` /
   `MORNING_QUIZ_ABSENCE_ALERTS` 等外发开关未设置
2. **C6 只读**：确认目标库里除八个虚构 id 外没有其他在读学生
   （这也是夹具第 4 道闸门会做的兜底，但**先手工确认一次**）
3. 上述两条都通过 → 才申请 **C7** 执行

---

## 10. [S1 后] 现状小结

### 已解决

- 二十条仓库级部署事实（§1）
- Railway 官方文档 **R1–R14**（§2.1），含 **Edge Rules 的路径匹配与
  五个动作**、多域名限额、私有 DNS 地址族与 egress、CLI 无 one-off job
- **U1 RESOLVED**（不支持路径级多服务转发；支持路径匹配 + 重定向）
- **U3 RESOLVED**、**U5 RESOLVED**、**U4 部分 RESOLVED**
- **S1 PASS** —— C1 只读勘察完成（§2.5），staging 状态未变更
- 三种拓扑的重算与推荐（§3）：A 为主、C 作迁移期加速器、B 为最后退路
- 灰度判定层的关键约束与设计（§5.1）、`STUDENT_APP_ORIGIN` 注入（§5.2）、
  CORS 与请求形态（§5.3）—— **均为设计定案，实现与 staging 行为未验证**
- S2 / S3 的完整设计（§7 / §8）、S7 选项对比（§9）、七类授权矩阵（§6）

### 仍然未知

| # | 未知 | 需要什么才能回答 |
|---|---|---|
| **U2** | 同一主机名能否挂两个服务 | **写操作（C4）**；**但不影响决策**（R8 已否定路径分流） |
| **U4 残余** | 应用是否必须绑定特定网卡；私有网络是否默认开启 | 官方文档未覆盖；实测需 C3 |
| **A4** | 本项目套餐是否含 edge-rule allowance（方案 C 的前提） | **面板只读** |
| — | Edge Rules 界面的实际动作列表 / 有无「转发到另一服务」选项 | **面板只读**（文档口径见 R7/R8） |

### 仍需产品决定

- **A3**：学生在新源重新登录一次是否可接受
- 新主机名形态：接受该服务自带的生成域名，还是申请自定义域名

### 阶段 3B 的下一步

**S1 / S2 已完成（PASS）；S3 部分完成（S3A）；S3B 与 S4–S7 未完成。**
最小的下一步授权见 §11。

---

## 10.5 S3A —— 真机设备观察（2026-08-27）

**授权**：C5，限用户本人确认的一台一次性测试 iPhone。
**所有设备操作由用户手动执行**，我一次只给一步、等结果再继续。
**未清除任何无关的浏览器数据。**

### 设备基线

| 项 | 值 |
|---|---|
| 机型 | iPhone 14 Pro Max |
| 系统 | iOS 26.6 |
| 旧 staging PWA 初始状态 | **未安装**（因此设备上原本**没有**旧 Service Worker） |
| 证据标识 | `S3A-EV-01` … `S3A-EV-05`（截图留在对话里，**不入库** —— 含设备名与序列号等个人信息） |

> 为取得「旧 SW 活着」的测试条件，在用户授权下**新装**了旧 staging PWA
> （用户已批准 staging PWA 的装/删）。**这是新装，不是对既有安装的改动** ——
> 基线如实记为「原本未装」。

### 观察结果

| # | 场景 | 结果 | 判定 |
|---|---|---|---|
| **EV-01** | 装旧 PWA 后主屏图标 | 名为「每日英语」，与 `manifest.webmanifest` 的 `short_name` 一致 | **OBSERVED** + CODE-PROVEN 吻合 |
| **EV-02** | **在线**打开旧 PWA | ① 全屏 standalone、**无 Safari 地址栏** ② 落点 `/my-lesson`（manifest `start_url`）③ 显示「请从个人主页进入」（`MyLesson.tsx:178`，因无 `name` 参数且本地无 `mq:history:name`）④ **未**自动跳 `/my-history`（`lesson-entry.ts` 要求本地存过姓名键） | **OBSERVED**，四条预测全中 |
| **EV-03** | **离线**（飞行模式 + 强杀 + 重开）打开旧 PWA | **照常打开，渲染缓存里的同一个旧壳**（同一句「请从个人主页进入」），iOS 只叠了系统的飞行模式提示。**没有出现浏览器错误页** | **OBSERVED** —— 关键格 |
| **EV-04** | Safari 打开新源 `/` | `STUDENT-WEB ORIGIN SPIKE`，「当前路径：`/`」 | **OBSERVED** |
| **EV-05** | Safari 打开新源 `/app/today` | 同一页面，「当前路径：`/app/today`」 | **OBSERVED** —— SPA 兜底在真实 iOS Safari 上成立 |

### EV-03 的意义 —— §3.1 从 INFERRED 升级为 OBSERVED

`sw.js` 的 network-first 在断网时**确实回落到了 `zaoce-pwa-v4` 缓存**，
请求**根本没有出网**。因此：

> **离线时，从旧 PWA 发出的导航到不了 Railway 的边缘，
> Edge Rule 重定向不可能触发。**

§3.1 那条更正（「边缘重定向并不能绕过旧 SW」）**已被真机实测证实**，
不再是推理。**方案 C 的适用边界由此钉死：它只在联网路径上成立。**

### 一次被识破的假证据

第一次让用户在 Safari 打开新源时，截图显示的是**旧端的学生登录卡**。
原因是两个主机名同后缀（`…production.up.railway.app`），Safari 把
之前访问过的旧端地址**自动补全**了。重新输入并核对后拿到的才是
EV-04。**这张作废，不计入证据** —— 记在这里是因为它差一点变成
「新源显示了旧应用」这条假结论。

### M10 —— **BLOCKED BY TEST HARNESS**

**M10 要验的是**：在**已安装的旧 PWA 内部**发起一次到新源的导航，
看 standalone 壳会怎样（留在壳里？弹回 Safari？）。

**做不了，原因是代码层面的**（CODE-PROVEN，非猜测）：

| 检查点 | 结论 |
|---|---|
| `MyLesson.tsx:213` 的 `window.location.href = next.href` | `next.href` 来自 `apps/api/src/lesson/next-action.ts`，取值**只有硬编码站内路径或 `null`** |
| `MorningQuizScan.tsx` 的 `window.location.replace(r.quizUrl)` | 服务端 `attendance.service.ts:757` 拼的是 `/morning-quiz/{id}#h=…`，**站内路径** |
| `MyMistakesPractice.tsx:66` 的 `then=` | **未校验**，但进的是 React Router 的 `navigate()` —— 按站内路径解析，**去不到外部源**（因此也不是开放重定向） |
| 全仓硬编码的外部 origin | **零** |
| standalone PWA 内是否有地址栏 | **没有**（EV-02 实测） |

**结论**：旧端**不存在**任何能导航到任意外部源的现成路径，
而 standalone 壳里也没有地址栏可以手输。

**按本轮规则，这记为「测试载体缺失」，不是 O2**：

- **不**据此触发 O2
- **不**据此否决拓扑 A
- **不**据此把 S3 记为 PASS 或 NO-GO
- **不**为了凑出 M10 而临时造重定向、隐藏路由、书签脚本或改服务端

### S3A 之后仍然 UNVERIFIED

| 项 | 状态 |
|---|---|
| M10（PWA 内部跨源导航的 standalone 行为） | **UNVERIFIED / BLOCKED** —— 缺载体 |
| 方案 C（Edge Rule 重定向）的端到端行为 | **UNVERIFIED** —— 离线边界已由 EV-03 证实，联网路径未测 |
| M5（旧 SW 是否会缓存新源的静态资源） | **N/A** —— 跨源，构造上不可能；EV-04/05 未见任何异常 |
| M6–M9（旧端更新、unregister、删缓存、回滚） | **未做** —— 本轮不需要，留给 S3B |

---

## 11. 下一步所需的最小授权

**S1 与 S2 已闭合，S3A 已完成。下一件事按代价从小到大：**

### 候选一（最小）：**面板只读**，回答 A4 与 §2.3 的三项

- **授权类别**：**C1 的扩展 —— Railway 面板只读**（本轮的 C1 是通过 CLI
  行使的，面板未开）
- **要看**：套餐是否含 edge-rule allowance；Edge Rules 界面的动作列表；
  界面上有无「转发到另一个服务」的选项
- **不做**：不新建规则、不保存、不改任何设置
- **回滚**：无（纯读）
- **价值**：决定方案 C 是否可用。**这是目前性价比最高的一步。**

### 候选二：**解除 M10 的测试载体封锁**（S3B 的前提）

M10 缺的是「从旧 PWA 内部发起一次到新源的导航」这一个动作。
要造出它，**最小**的改动是：在旧端加一个**仅 staging 可见、可逆、
不改任何产品行为**的临时跳转入口（例如一个只在特定 query 参数下渲染的
链接），部署到 `stg-web`，测完即回滚。

- **授权类别**：**C2 + C3**，且**必须动 `stg-web`** —— 这超出了迄今为止
  「不碰既有服务」的边界，需要**单独、明确**的批准
- **风险**：改的是学生每天在用的旧端（虽然只在 staging）
- **回滚**：`git revert` 那一个提交 + 重新部署 `stg-web`
- **替代方案**：也可以**不做 M10**，接受它作为 A 的已知残余风险 ——
  代价是「已装 PWA 的学生怎么被送到新端」这件事要到灰度时才第一次
  被真实检验

> **建议**：先批候选一（面板只读，零风险）。M10 是否值得为它动
> `stg-web`，等方案 C 的可用性明确之后再决定 —— 如果 C 可用，
> 迁移路径就多一条不依赖应用层的通道，M10 的权重会下降。
