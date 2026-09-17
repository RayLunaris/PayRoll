FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/attendance-service/package.json ./apps/attendance-service/
RUN pnpm install --filter @payrollpro/attendance-service...

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm --filter @payrollpro/attendance-service build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

COPY --from=builder /app ./

USER fastify

EXPOSE 3013

CMD ["node", "apps/attendance-service/dist/index.js"]
