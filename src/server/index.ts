import "dotenv/config";
import http from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import logger from "../lib/logger";
import { initializeMediasoup } from "./mediasoup/worker";
import { registerMediaNamespace } from "./socket/media";
import { registerChatNamespace } from "./socket/chat";
import { registerAdminNamespace } from "./socket/admin";
import { redisClient } from "./redis";

const PORT = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";

async function main() {
  logger.info({ dev, port: PORT }, "🚀 Starting ClearLine server...");

  await redisClient.ping();
  logger.info("✅ Redis connected");

  await initializeMediasoup();
  logger.info("✅ mediasoup workers initialized");

  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();
  logger.info("✅ Next.js prepared");

  const httpServer = http.createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  registerMediaNamespace(io);
  registerChatNamespace(io);
  registerAdminNamespace(io);

  logger.info("✅ Socket.IO namespaces registered");

  httpServer.listen(PORT, () => {
    logger.info(`✅ ClearLine listening on http://localhost:${PORT}`);
    if (dev) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  🎯 ClearLine - Real-Time Video Support Platform");
      console.log(`  🌐 http://localhost:${PORT}`);
      console.log("  👤 agent@clearline.dev / agent123");
      console.log("  🔑 admin@clearline.dev  / admin123");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }
  });
}

main().catch((err) => {
  logger.error(err, "Fatal server error");
  process.exit(1);
});
