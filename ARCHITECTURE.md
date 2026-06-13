# ClearLine — Architecture

## Overview

ClearLine is a real-time video support platform built for the AtomQuest Hackathon. A single Node.js process boots Next.js, Socket.IO, and mediasoup together — no microservices, no separate WebSocket server.

**Key capabilities:**
- WebRTC video/audio calls via mediasoup SFU (Selective Forwarding Unit)
- Real-time chat with file sharing (images, docs, video, audio — up to 20 MB)
- Client-side composite recording (all participants mixed into one `.webm`)
- Admin dashboard with live session monitoring and force-end
- Role-based access: `agent`, `customer`, `admin`
- Duplicate connection detection and automatic kick

## Why a Custom Server?

Next.js's built-in server cannot host Socket.IO or mediasoup — both need direct access to the raw `http.Server` object. `src/server/index.ts` creates an `http.Server`, attaches Next.js as the request handler, and mounts Socket.IO on the same port. mediasoup workers are spawned in-process.

**Tradeoff:** Hot-reload in dev resets mediasoup workers. Non-issue in production.

---

## Media Architecture (SFU)

All media is **server-routed** — no direct browser-to-browser connection:

```
Agent Browser                mediasoup Router              Customer Browser
     │                              │                              │
     │──── send transport ─────────▶│                              │
     │                              │──── recv transport ─────────▶│
     │◀─── recv transport ──────────│                              │
     │                              │◀─── send transport ──────────│
```

Each participant has:
- One **send transport** (publishes audio + video producers)
- One **recv transport** (subscribes to all remote producers as consumers)

Producer keys: `{participantId}_{kind}` — duplicate connections clean up stale producers before reconnecting.

---

## Socket.IO Namespaces

| Namespace | Auth | Purpose |
|---|---|---|
| `/media` | Agent cookie or invite JWT | WebRTC signaling, mute/video toggle, recording status, session end |
| `/chat` | Agent cookie or invite JWT | Text messages, file messages, chat history |
| `/admin` | Agent cookie (admin role) | Live session list, force-end, session-changed events |

---

## Authentication & Access Control

```
Agent login:
  POST /api/auth/signin → NextAuth credentials → JWT cookie
  Role check: agent → /dashboard, admin → /admin

Session invite:
  Agent: POST /api/sessions → signed JWT { sessionId } → invite URL
  Customer: GET /call/[id]?token=<jwt> → middleware verifies → CallRoom

Upload auth:
  Agent: NextAuth session cookie
  Customer: x-invite-token header (JWT verified server-side)
```

Middleware enforces:
- `/dashboard/*` — requires authenticated session
- `/admin/*` — requires `role === admin`
- `/call/*` — requires valid invite token (customers) or session (agents)

---

## File Sharing

- **Upload API:** `POST /api/upload` — max 20 MB, extension allowlist (images, pdf, office, zip, mp4, mp3, webm), MIME cross-check, rate-limited to 10 uploads/IP/min
- **Storage:** `public/uploads/{uuid}.ext` — served statically
- **Chat event:** `chat:file` socket event saves `file_url` + `file_meta` JSON to `ChatMessage` table, broadcast via `chat.in(sessionId)`
- **UI:** Download card rendered in chat for all participants

---

## Recording

Recording is fully **client-side** — no server storage:

1. An off-screen `<canvas>` is created with a grid layout of all video tiles
2. Hidden `<video>` elements for each stream (local + all remote) are drawn at 30fps via `requestAnimationFrame`
3. An `AudioContext` mixes all audio tracks into a single `MediaStreamDestination`
4. `MediaRecorder` records `canvas.captureStream(30)` + mixed audio
5. On stop: auto-downloads as `clearline-recording-{timestamp}.webm`

---

## Duplicate Connection Handling

`activeSocketByParticipant` map (`participantId → socket.id`) on the server:
- New connection for an existing participant → old socket gets `session:duplicate` event + forcibly disconnected
- Stale producers/transports/consumers from old socket are cleaned up before new ones are created
- `peer:joined` is suppressed for reconnects within the 30s grace window (no duplicate tile)
- Client shows "Connected elsewhere" screen on receiving `session:duplicate`

---

## Data Model

```
User
  id, email, password_hash, role (agent|admin|customer)
  └── Session
        id, agent_id, status (active|ended), invite_token_hash,
        customer_name, recording_status, created_at, ended_at
        ├── SessionEvent
        │     id, event_type (join|leave|mute|unmute|video_off|video_on|
        │                     recording_start|recording_stop),
        │     participant_role, participant_id, metadata, timestamp
        └── ChatMessage
              id, sender_role, sender_name, type (text|file),
              content, file_url, file_meta (JSON), timestamp
```

---

## Redis Keys

| Key | Type | Purpose |
|---|---|---|
| `session:{id}:participants` | Set | Active participant IDs (SADD/SREM) |
| `session:{id}:reconnect:{participantId}` | String | Grace window marker, 30s TTL |

---

## Security

| Layer | Control |
|---|---|
| Auth | NextAuth JWT cookies (agents), signed invite JWT (customers) |
| Upload | Token verified server-side, extension + MIME allowlist, rate limit |
| Role enforcement | Middleware + per-handler checks (`role !== "agent"` guards) |
| Secrets | `NEXTAUTH_SECRET`, `INVITE_JWT_SECRET` from env — never hardcoded |
| Path traversal | `path.basename()` + UUID filenames, no user input in file paths |

---

## Deployment

```
docker-compose up
├── postgres:16-alpine  :5432  (Prisma migrations run on app start)
├── redis:7-alpine      :6379
├── minio               :9000 / :9001 console
└── app (Node 22)       :3000
      └── UDP 40000-40099 (mediasoup WebRTC)
```

Set `MEDIASOUP_ANNOUNCED_IP` to the server's public IP in production. Docker image: `krvatsal/clearline:latest`.

---

## Observability

- **Logging:** pino — pretty in dev, structured JSON in prod
- **Metrics:** `GET /api/metrics` — Prometheus format via prom-client (active sessions gauge, total sessions counter)
- **Health:** `GET /api/health` — returns `{ ok: true }`
