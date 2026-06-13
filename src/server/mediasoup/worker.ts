import * as mediasoup from "mediasoup";
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
} from "mediasoup/node/lib/types";
import logger from "../../lib/logger";

const MIN_PORT = parseInt(process.env.MEDIASOUP_MIN_PORT || "40000", 10);
const MAX_PORT = parseInt(process.env.MEDIASOUP_MAX_PORT || "49999", 10);
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1";

const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    preferredPayloadType: 111,
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    preferredPayloadType: 96,
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
  {
    kind: "video",
    mimeType: "video/H264",
    preferredPayloadType: 97,
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "4d0032",
      "level-asymmetry-allowed": 1,
    },
  },
];

let workers: Worker[] = [];
let workerIndex = 0;

export interface SessionRoom {
  router: Router;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

const rooms = new Map<string, SessionRoom>();

export async function initializeMediasoup(): Promise<void> {
  const numWorkers = Math.max(1, require("os").cpus().length);

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: "warn",
      logTags: ["rtp", "srtp", "rtcp"],
      rtcMinPort: MIN_PORT,
      rtcMaxPort: MAX_PORT,
    });

    worker.on("died", (error) => {
      logger.error({ error }, `mediasoup worker died, restarting...`);
      workers = workers.filter((w) => w !== worker);
      setTimeout(() => spawnWorker(), 2000);
    });

    workers.push(worker);
    logger.info({ pid: worker.pid }, `mediasoup worker spawned`);
  }
}

async function spawnWorker(): Promise<void> {
  const worker = await mediasoup.createWorker({
    logLevel: "warn",
    rtcMinPort: MIN_PORT,
    rtcMaxPort: MAX_PORT,
  });
  worker.on("died", (error) => {
    logger.error({ error }, "mediasoup worker died");
    workers = workers.filter((w) => w !== worker);
    setTimeout(() => spawnWorker(), 2000);
  });
  workers.push(worker);
}

function getNextWorker(): Worker {
  const worker = workers[workerIndex % workers.length];
  workerIndex++;
  return worker;
}

export async function createRoom(sessionId: string): Promise<SessionRoom> {
  if (rooms.has(sessionId)) return rooms.get(sessionId)!;

  const worker = getNextWorker();
  const router = await worker.createRouter({ mediaCodecs });

  const room: SessionRoom = {
    router,
    transports: new Map(),
    producers: new Map(),
    consumers: new Map(),
  };

  rooms.set(sessionId, room);
  logger.info({ sessionId }, "Room created");
  return room;
}

export function getRoom(sessionId: string): SessionRoom | undefined {
  return rooms.get(sessionId);
}

export async function closeRoom(sessionId: string): Promise<void> {
  const room = rooms.get(sessionId);
  if (!room) return;

  room.transports.forEach((t) => t.close());
  room.router.close();
  rooms.delete(sessionId);

  logger.info({ sessionId }, "Room closed");
}

export async function createWebRtcTransport(
  room: SessionRoom,
  transportId: string
): Promise<WebRtcTransport> {
  const transport = await room.router.createWebRtcTransport({
    listenIps: [
      {
        ip: "0.0.0.0",
        announcedIp: ANNOUNCED_IP,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  });

  transport.on("dtlsstatechange", (dtlsState) => {
    if (dtlsState === "closed") {
      transport.close();
    }
  });

  room.transports.set(transportId, transport);
  return transport;
}
