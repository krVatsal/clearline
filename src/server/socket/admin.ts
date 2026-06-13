import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../../lib/prisma";
import logger from "../../lib/logger";

export function registerAdminNamespace(io: SocketIOServer) {
  const admin = io.of("/admin");

  admin.on("connection", async (socket) => {
    logger.info({ socketId: socket.id }, "Admin socket connected");

    socket.on("admin:live-sessions", async (_, callback) => {
      try {
        const sessions = await prisma.session.findMany({
          where: { status: "active" },
          include: {
            agent: { select: { id: true, name: true, email: true } },
            _count: { select: { messages: true, events: true } },
          },
          orderBy: { created_at: "desc" },
        });
        callback?.({ sessions });
      } catch (err) {
        logger.error({ err }, "Error fetching live sessions");
        callback?.({ error: "Failed to fetch sessions" });
      }
    });

    socket.on("admin:force-end", async (data: { sessionId: string }, callback) => {
      try {
        await prisma.session.update({
          where: { id: data.sessionId },
          data: { status: "ended", ended_at: new Date() },
        });

        io.of("/media").to(data.sessionId).emit("session:ended", {
          endedBy: "admin",
          forced: true,
        });

        callback?.({ ended: true });
      } catch (err) {
        logger.error({ err }, "Error force-ending session");
        callback?.({ error: "Failed to end session" });
      }
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Admin socket disconnected");
    });
  });

  return admin;
}
