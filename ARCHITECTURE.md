# ClearLine — Architecture

## Overview

ClearLine is a single-process, self-hosted video support platform. One `npm run dev` command boots:
1. **Next.js** (HTTP + SSR)
2. **Socket.IO** (WebSocket upgrade on the same HTTP server)
3. **mediasoup workers** (WebRTC SFU in the same Node process)

## Why a Custom Server?

Next.js's built-in server cannot host Socket.IO or mediasoup — both require direct access to the HTTP/HTTPS server object. Instead, `src/server/index.ts` creates a raw `http.Server`, attaches Next.js as a request handler, and then mounts Socket.IO on the same server. mediasoup workers are spawned in the same process.

**Tradeoff accepted:** Hot-reload in dev resets mediasoup workers. For production this is not an issue.

## Media Architecture (SFU)

```
Agent Browser                    Server (mediasoup)                Customer Browser
    |                                    |                                |
    |-- WebRTC (send transport) -------->|                                |
    |                                    |-- WebRTC (send transport) -----|
    |<-- WebRTC (recv transport) --------|                                |
    |                                    |<-- WebRTC (recv transport) ----|
```

All media is **server-routed**. There is no browser-to-browser WebRTC connection. The server decrypts, optionally records (PlainTransport → ffmpeg), and re-encrypts for each receiver. This enables:
- Recording without browser extension
- Future server-side processing (transcription, AI insights)
- Firewall-friendly deployment (only UDP 40000-49999 outbound needed)

## Socket.IO Namespaces

| Namespace | Purpose |
|---|---|
| `/media` | WebRTC signaling (transport connect/produce/consume, mute, recording) |
| `/chat` | Real-time text messages with Prisma persistence |
| `/admin` | Live session monitoring, force-end capability |

## Authentication Flow

```
Agent → POST /api/auth/signin (NextAuth Credentials)
      → JWT session cookie
      → Dashboard

Agent → POST /api/sessions
      → Creates Session row in PostgreSQL
      → Signs JWT invite token (payload: { sessionId })
      → Returns invite link: /call/[sessionId]?token=<jwt>

Customer → GET /call/[sessionId]?token=<jwt>
         → Middleware verifies JWT
         → Renders CallRoom with role=customer
```

## Data Model

```
User (id, email, password_hash, role: agent|admin)
  └── Session (id, agent_id, status, invite_token_hash, customer_name)
        ├── SessionEvent (id, session_id, event_type, participant_role, timestamp)
        └── ChatMessage (id, session_id, sender_role, sender_name, content, type, timestamp)
```

## Redis Usage

- **Participant presence:** `session:{id}:participants` (SADD/SREM/SMEMBERS)
- **Reconnect grace window:** `session:{id}:reconnect:{participantId}` with 30s TTL
- **Room state:** active mediasoup room IDs

## Deployment

```
docker-compose up
├── postgres:5432
├── redis:6379
├── minio:9000 + 9001 (console)
└── app:3000 (multi-stage Dockerfile, non-root user)
```

mediasoup requires UDP port range exposure. In production, set `MEDIASOUP_ANNOUNCED_IP` to the server's public IP and expose ports 40000-49999/udp.

## Observability

- **Logging:** pino with JSON output (pretty in dev, structured JSON in prod)
- **Metrics:** Prometheus-compatible endpoint at `GET /api/metrics` (prom-client)
- **Key metrics:** active sessions gauge, total sessions counter
