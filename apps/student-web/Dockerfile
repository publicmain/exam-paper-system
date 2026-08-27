# 学生端生产镜像 —— 多阶段：构建产物进 nginx，构建工具不进最终镜像。
#
# 构建上下文是 apps/student-web（Railway 用 --path-as-root 上传该目录），
# 所以下面的路径都是相对这个目录的。
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# 依赖用 npm ci 从**应用级 lockfile** 装 —— 可复现。
#
# 为什么这里要单独一份 lockfile：Railway 用 `--path-as-root` 上传的构建
# 上下文就是 apps/student-web 这个目录，仓库根的 package-lock.json
# **不在上下文里**，而 `npm ci` 要求当前目录有 lockfile。没有它就只能
# `npm install`，那意味着每次构建都可能解析到不同的补丁版本 ——
# 部署产物不可复现。
#
# 代价：这份 lockfile 与仓库根的那份是两份，改依赖时**两边都要更新**
# （在 apps/student-web 下跑 `npm install --package-lock-only`）。
# 有一条守卫会比对它和 package.json 的依赖集合，漂了就红。
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . ./
# API 的地址在**构建期**注入（Vite 把 import.meta.env 编进产物）。
#
# 注意区分两件事：
#   · VITE_API_URL —— API 在哪儿。跨源拓扑下必须给，编进产物。
#   · studentAppOrigin —— **新端自己**在哪儿。它由服务端在**运行期**下发，
#     **绝不编进这里** —— 换域名不该要求重新构建前端。
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
