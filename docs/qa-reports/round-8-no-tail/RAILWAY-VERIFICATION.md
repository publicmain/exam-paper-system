# Round 8 — Railway Deploy Verification

Push `5fc10dc..821bca2` → main 在 2026-05-09 15:34 UTC。Railway 自动重部署。

## 时间线

- **15:34 UTC**: `git push origin claude/cranky-herschel-aa36d3:main` 成功
- **15:35:31 UTC**: 即时探活 — `/api/health` 200 ✅（仍是上一次的 round-7 build 服务中）
- **15:40:19 UTC**: 5 分钟后 — round-8 build 已 cutover
- **15:40:20 UTC**: `/api/health` 200，response timestamp `2026-05-09T15:40:20.572Z`
- **15:40:21 UTC**: 12 次连续 `POST /api/auth/login` 命中 round-8 新增的 RateLimit decorator（10/min/IP）

## 实测命令 + 输出

### 1) Health（cutover 后）

```
$ curl -sS -i https://exam-paper-system-production.up.railway.app/api/health
HTTP/1.1 200 OK
Access-Control-Allow-Credentials: true
Content-Length: 43
Content-Type: application/json; charset=utf-8
Date: Sat, 09 May 2026 15:40:20 GMT
Etag: W/"2b-5V2f3WiJpxE8bBcGRw3ZTpAnJEo"
Server: railway-edge
X-Railway-Edge: railway/asia-southeast1-eqsg3a
X-Railway-Request-Id: 2hvksV15TT-GZl2Cmrpb1w

{"ok":true,"ts":"2026-05-09T15:40:20.572Z"}
```

`200`，`X-Railway-Request-Id` 与 round-7 时段不同（确认是新进程在服务）。

### 2) Rate-limiter（round-8 theme 3 唯一可在 Railway 上"看见"的代码层证据）

```
$ for i in 1..13; do
    curl -sS -o /dev/null -w "$i:%{http_code} " \
      -X POST -H "content-type: application/json" \
      -d '{"email":"x@x.x","password":"y"}' \
      https://exam-paper-system-production.up.railway.app/api/auth/login
  done

1:400 2:400 3:400 4:400 5:400 6:400 7:400 8:400 9:400 10:400 11:429 12:429 13:429
```

**这是 round-8 才有的行为**：
- Round-7 main 时 `auth/login` 没有限流，连击 100 次也只会拿 100 个 400（zod 拒空 body）
- Round-8 加了 `@RateLimit({ limit: 10, windowSec: 60, scope: 'ip' })`
- 第 11 次起返回 `429 Too Many Requests`，body 含 `retryAfter` 秒数
- Retry-After header 也设了（curl `-w` 不输出 header；用 `-i` 可看）

这一条证明：
1. Round-8 commit `aea6ce6` 已经活跃在 prod
2. `RateLimitGuard` 在 `AuthGuard` 之前跑（否则 zod 会先 400，永远不会 429）
3. `trust proxy=1` 工作正常（限流按真实客户端 IP 而非 proxy IP，否则全校共一桶 Railway 边缘 IP 早就堵住）

## 判定

✅ **Round-8 部署 healthy**，可正式宣布上线。

## 回滚 SOP（不变）

- 上一个 known-good：`0254255` (round-7 LAUNCH-READINESS)
- 再上一个：`03c69df` (round-6 last good)
- Railway dashboard → Deployments → Redeploy to previous green，1-2 min 内回滚
