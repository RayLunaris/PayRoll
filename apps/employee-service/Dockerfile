FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/employee-service/package.json ./apps/employee-service/
RUN pnpm install --filter @payrollpro/employee-service...

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm --filter @payrollpro/employee-service build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

COPY --from=builder /app ./

USER fastify

EXPOSE 3011

CMD ["node", "apps/employee-service/dist/index.js"]
