FROM node:22-alpine AS base

RUN apk add --no-cache python3 make g++ libc6-compat && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# ── deps: install all dependencies ───────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts && \
    npm rebuild mediasoup --build-from-source

# ── builder: compile Next.js + server TS ─────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npx tsc --project tsconfig.server.json

# ── runner: lean production image ────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat

ENV NODE_ENV=production

# Copy Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy compiled server
COPY --from=builder /app/dist ./dist

# Copy prisma schema + migrations + generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy full node_modules for mediasoup native binaries and other server deps
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Ensure uploads dir exists and is writable
RUN mkdir -p /app/public/uploads && chmod 777 /app/public/uploads

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/server/index.js"]
