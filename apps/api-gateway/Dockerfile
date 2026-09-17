FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/api-gateway/package.json ./apps/api-gateway/
RUN pnpm install --filter @payrollpro/api-gateway...

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm --filter @payrollpro/api-gateway build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

COPY --from=builder /app ./

USER fastify

EXPOSE 3001

CMD ["node", "apps/api-gateway/dist/index.js"]
