# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM node:20-alpine AS deps

WORKDIR /app

# 安装构建工具（Prisma 需要 OpenSSL）
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# 安装所有依赖（包含 devDependencies，供构建使用）
RUN npm ci

# ============================================================
# Stage 2: Build the application
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# 复制 node_modules（包含 devDeps）
COPY --from=deps /app/node_modules ./node_modules

# 复制所有源码
COPY . .

# 生成 Prisma Client 并构建 Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && \
    npm run build

# ============================================================
# Stage 3: Production image
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制 standalone 构建产物（Next.js 自动裁剪出的最小运行目录）
COPY --from=builder /app/.next/standalone ./

# 复制静态资源
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 复制 Prisma schema（用于运行时 migrate deploy）
COPY --from=builder /app/prisma ./prisma

# 复制 Prisma Client 生成产物（引擎二进制 + 生成的 client）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 复制 Prisma CLI（用于 migrate deploy）
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 解决 Prisma 在 standalone 中的路径问题：确保 exports 能正确找到 client
RUN npx prisma generate

# 设置权限
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动时自动运行迁移，然后启动服务
CMD ["sh", "-c", "npx prisma migrate deploy 2>/dev/null; node server.js"]
