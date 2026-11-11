# CANDY Control Room: one Node 22 server (API + live stream + built web app) for hosting.
# Build:  docker build -t candy-control-room .
# Run:    see docs/DEPLOY.md (needs DATABASE_URL, WORKER_TOKEN, COOKIE_SECURE=true behind HTTPS, a volume at /data).

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile
COPY . .
RUN corepack pnpm build:web

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3100 \
    TRUST_PROXY=1 \
    COOKIE_SECURE=true \
    STORAGE_DIR=/data/storage \
    ASSETS_DIR=/data/assets \
    TZ_CLINIC=Asia/Kuala_Lumpur
WORKDIR /app
RUN corepack enable && mkdir -p /data/storage /data/assets && chown -R node:node /data
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3100
# The platform's own health check should call GET /api/health too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/api/health').then(r=>r.json()).then(j=>process.exit(j.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "src/server/index.ts"]
