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
    logger.info({ data: socket.data }, "Chat socket raw connection");

    const participantId = socket.data.participantId as string;
    const sessionId = socket.data.sessionId as string;
    const role = socket.data.role as "agent" | "customer";
    const name = socket.data.name as string;

    if (!participantId || !sessionId || !role) {
      logger.error({ data: socket.data }, "Chat socket missing data, disconnecting");
      socket.disconnect(true);
      return;
    }

    logger.info({ participantId, sessionId }, "Chat socket connected");
    socket.join(sessionId);

    let history: unknown[] = [];
    try {
      history = await prisma.chatMessage.findMany({
        where: { session_id: sessionId },
        orderBy: { timestamp: "asc" },
        take: 100,
      });
    } catch (err) {
      logger.error({ err }, "Failed to fetch chat history");
    }

    socket.emit("chat:history", history);

    socket.on("chat:file", async (data: { url: string; name: string; size: number; type: string }, callback?: (res: unknown) => void) => {
      try {
        const message = await prisma.chatMessage.create({
          data: {
            id: uuidv4(),
            session_id: sessionId,
            sender_role: role,
            sender_id: participantId,
            sender_name: name,
            type: "file",
            file_url: data.url,
            file_meta: { name: data.name, size: data.size, type: data.type },
          },
        });
        chat.in(sessionId).emit("chat:message", message);
        callback?.({ ok: true, id: message.id });
      } catch (err) {
        logger.error({ err }, "Error saving file message");
        callback?.({ error: "Failed to send file" });
      }
    });

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

        chat.in(sessionId).emit("chat:message", message);
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
