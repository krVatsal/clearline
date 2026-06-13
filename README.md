# ClearLine

A self-hosted, real-time video support platform. Agents create sessions, share invite links with customers, and conduct server-routed video calls via mediasoup SFU — no peer-to-peer, no third-party video APIs.

## Quick Start

```bash
# 1. Copy env file
cp .env.example .env

# 2. Start all services (app + postgres + redis + minio)
docker-compose up

# 3. Seed demo accounts (first time only)
docker-compose exec app npm run db:seed
```

Visit http://localhost:3000

**Demo credentials:**
- Agent: `agent@clearline.dev` / `agent123`
- Admin: `admin@clearline.dev` / `admin123`

## Local Dev (without Docker)

```bash
npm install
# Requires local postgres + redis
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## How It Works

1. Agent logs in → Dashboard → "New Session" → invite link copied to clipboard
2. Agent joins the call room, waits for customer
3. Customer opens invite link → PreJoin check → joins call
4. Media flows Agent ↔ mediasoup SFU ↔ Customer (server-routed, not P2P)
5. Agent can mute/unmute, toggle video, start/stop recording, end session
6. Chat panel on the right for text messages throughout the call
7. Session history with timeline + chat transcript available after call ends

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Auth | NextAuth v4 (Credentials provider) |
| Real-time | Socket.IO (namespaces: /media, /chat, /admin) |
| Media | mediasoup SFU (WebRTC, server-routed) |
| Database | PostgreSQL via Prisma ORM |
| Presence/Cache | Redis (ioredis) |
| Storage | MinIO (S3-compatible, recordings) |
| Observability | pino logging, prom-client metrics at /api/metrics |
| Deployment | Docker + docker-compose |

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    api/                  # REST API routes
    admin/                # Admin dashboard
    call/[sessionId]/     # Call room
    dashboard/            # Agent dashboard
    login/                # Auth page
    sessions/[sessionId]/ # Session history
  components/             # React UI components
    ui/                   # shadcn/ui primitives
  lib/                    # Shared utilities (auth, prisma, jwt, logger)
  server/                 # Custom Node server (NOT bundled by Next.js)
    mediasoup/            # Worker + room management
    socket/               # Socket.IO namespace handlers
    index.ts              # Server entrypoint
  types/                  # TypeScript augmentations
  middleware.ts           # Next.js route middleware
prisma/
  schema.prisma           # DB schema
  seed.ts                 # Demo seed data
```
