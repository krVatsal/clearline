import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyInviteToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";
import logger from "../../lib/logger";
import { v4 as uuidv4 } from "uuid";

export function registerChatNamespace(io: SocketIOServer) {
  const chat = io.of("/chat");

  chat.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string;
    const sessionId = socket.handshake.auth.sessionId as string;
    const agentUserId = socket.handshake.auth.agentUserId as string;

    if (!sessionId) return next(new Error("Missing sessionId"));

    if (agentUserId) {
      socket.data.participantId = agentUserId;
      socket.data.sessionId = sessionId;
      socket.data.role = "agent";
      socket.data.name = socket.handshake.auth.name || "Agent";
      return next();
    }

    if (token) {
      const payload = verifyInviteToken(token);
      if (!payload || payload.sessionId !== sessionId) {
        return next(new Error("Invalid invite token"));
      }
      socket.data.participantId = `customer_${socket.id}`;
      socket.data.sessionId = sessionId;
      socket.data.role = "customer";
      socket.data.name = socket.handshake.auth.name || "Customer";
      return next();
    }

    return next(new Error("Unauthorized"));
  });

  chat.on("connection", async (socket: Socket) => {
    const { participantId, sessionId, role, name } = socket.data as {
      participantId: string;
      sessionId: string;
      role: "agent" | "customer";
      name: string;
    };

    logger.info({ participantId, sessionId }, "Chat socket connected");
    socket.join(sessionId);

    const history = await prisma.chatMessage.findMany({
      where: { session_id: sessionId },
      orderBy: { timestamp: "asc" },
      take: 100,
    });

    socket.emit("chat:history", history);

    socket.on("chat:message", async (data: { content: string }, callback?: (res: unknown) => void) => {
      try {
        const message = await prisma.chatMessage.create({
          data: {
            id: uuidv4(),
            session_id: sessionId,
            sender_role: role,
            sender_id: participantId,
            sender_name: name,
            type: "text",
            content: data.content,
          },
        });

        chat.to(sessionId).emit("chat:message", message);
        callback?.({ ok: true, id: message.id });
      } catch (err) {
        logger.error({ err }, "Error saving chat message");
        callback?.({ error: "Failed to send message" });
      }
    });

    socket.on("disconnect", () => {
      logger.info({ participantId, sessionId }, "Chat socket disconnected");
    });
  });
}
