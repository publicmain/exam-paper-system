# ---- builder ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
RUN npm install --workspace @app/api --include=dev --ignore-scripts

COPY apps/api ./apps/api
RUN npx --workspace @app/api prisma generate
RUN npm run build -w @app/api

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
RUN npm install --workspace @app/api --omit=dev --ignore-scripts

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
# npm workspaces hoists @prisma to root node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

WORKDIR /app/apps/api
EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && node dist/main.js"]
