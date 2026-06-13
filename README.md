# ClearLine

> Real-Time Video Support Platform — AtomQuest Hackathon 1.0

A self-hosted video support platform where agents create sessions, share invite links with customers, and conduct server-routed video calls — no P2P, no third-party video APIs, no browser extensions.

---

## Features

- **WebRTC video & audio calls** via mediasoup SFU (server-routed, firewall-friendly)
- **Real-time chat** with text messages and file sharing (images, docs, video — up to 20 MB)
- **Composite recording** — all participants mixed into one `.webm`, downloaded locally
- **Admin dashboard** — live session monitoring, force-end sessions, session history
- **Role-based access** — `agent`, `customer`, `admin` with JWT-secured invite links
- **Duplicate tab detection** — kicks old connection, shows "Connected elsewhere" screen
- **Session timeline** — full event history (join, leave, mute, recording) per session
- **Security** — file type allowlist, MIME validation, rate limiting, no hardcoded secrets

---

## Quick Start (Docker)

```bash
# 1. Pull and run
docker pull krvatsal/clearline:latest

# 2. Set required environment variables
export NEXTAUTH_SECRET="$(openssl rand -base64 32)"
export INVITE_JWT_SECRET="$(openssl rand -base64 32)"

# 3. Start all services
docker-compose up

# 4. Seed demo accounts (first run only)
docker-compose exec app npm run db:seed
```

Visit **http://localhost:3000**

| Role | Email | Password |
|---|---|---|
| Agent | `agent@clearline.dev` | `agent123` |
| Admin | `admin@clearline.dev` | `admin123` |

---

## Local Dev (without Docker)

Requires: Node 22+, PostgreSQL, Redis

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, REDIS_URL, secrets
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Server starts at **http://localhost:3000** — Next.js + Socket.IO + mediasoup in one process.

---

## How It Works

```
1. Agent logs in → /dashboard → "New Session" → copies invite link
2. Agent joins call room → camera/mic captured → media sent to SFU
3. Customer opens invite link → pre-join check → joins call
4. Media: Agent ⟷ mediasoup SFU ⟷ Customer  (never direct P2P)
5. Chat: text + file attachments in real time, persisted to DB
6. Recording: canvas composite of all tiles + mixed audio → .webm download
7. Session ends → timeline + transcript saved → viewable in /sessions/[id]
8. Admin: /admin shows live sessions, can force-end any session
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui |
| Auth | NextAuth v4 — Credentials provider, JWT cookies |
| Real-time | Socket.IO — `/media`, `/chat`, `/admin` namespaces |
| Media | mediasoup 3.x SFU — WebRTC, server-routed |
| Database | PostgreSQL + Prisma ORM |
| Presence | Redis (ioredis) — participant sets + reconnect grace TTL |
| File Storage | Local filesystem (`public/uploads/`) |
| Recording | Client-side MediaRecorder + Canvas API + AudioContext |
| Observability | pino logging, prom-client metrics (`/api/metrics`), health (`/api/health`) |
| Runtime | Node.js 22, Docker + docker-compose |

---

## Project Structure

```
src/
  app/
    api/
      auth/           # NextAuth handler
      health/         # GET /api/health
      metrics/        # GET /api/metrics (Prometheus)
      sessions/       # Session CRUD + invite token
      upload/         # POST /api/upload (file sharing)
    admin/            # Admin dashboard (live sessions)
    call/[sessionId]/ # CallRoom — WebRTC + chat + controls
    dashboard/        # Agent dashboard (session list)
    login/            # Auth page
    sessions/[id]/    # Session history + timeline
  components/
    ChatPanel.tsx     # Real-time chat + file upload
    Controls.tsx      # Mute / video / record / end buttons
    VideoTile.tsx     # Single participant video tile
    SessionTimeline.tsx
    ui/               # shadcn/ui primitives
  lib/
    auth.ts           # NextAuth config
    jwt.ts            # Invite token sign/verify
    prisma.ts         # Prisma client singleton
    logger.ts         # pino logger
  server/             # Custom Node server (not bundled by Next.js)
    mediasoup/        # Worker init, room/transport management
    socket/
      media.ts        # WebRTC signaling namespace
      chat.ts         # Chat + file message namespace
      admin.ts        # Admin monitoring namespace
    redis.ts          # Participant presence helpers
    index.ts          # Server entrypoint
  middleware.ts       # Route auth + role enforcement
prisma/
  schema.prisma       # DB schema (User, Session, SessionEvent, ChatMessage)
  seed.ts             # Demo accounts seed
Dockerfile            # Multi-stage, Node 22, mediasoup native build
docker-compose.yml    # postgres + redis + minio + app
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `NEXTAUTH_SECRET` | ✅ | Random 32+ char secret |
| `NEXTAUTH_URL` | ✅ | Public URL of the app |
| `INVITE_JWT_SECRET` | ✅ | Random 32+ char secret for invite tokens |
| `MEDIASOUP_ANNOUNCED_IP` | production | Server's public IP for WebRTC |
| `MEDIASOUP_MIN_PORT` | optional | UDP range start (default 40000) |
| `MEDIASOUP_MAX_PORT` | optional | UDP range end (default 40099) |
| `PORT` | optional | HTTP port (default 3000) |

---

## Docker Image

```bash
docker pull krvatsal/clearline:latest
```

See `ARCHITECTURE.md` for full system design, sequence diagrams, and security details.
