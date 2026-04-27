# Self-contained build (Railway uses apps/web as build context)
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --include=dev

COPY . ./
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Template is processed by envsubst at container start (built-in nginx:alpine feature)
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV PORT=8080
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
