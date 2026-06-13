import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyInviteToken } from "../../lib/jwt";
import {
  createRoom,
  getRoom,
  closeRoom,
  createWebRtcTransport,
} from "../mediasoup/worker";
import {
  addParticipant,
  removeParticipant,
  markDisconnected,
  isWithinReconnectWindow,
  clearDisconnectMark,
  getParticipants,
} from "../redis";
import { prisma } from "../../lib/prisma";
import logger from "../../lib/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import type { SessionEvent } from "@prisma/client";

interface ParticipantInfo {
  socketId: string;
  participantId: string;
  sessionId: string;
  role: "agent" | "customer";
  name: string;
}

const socketParticipants = new Map<string, ParticipantInfo>();

export function registerMediaNamespace(io: SocketIOServer) {
  const media = io.of("/media");

  media.use(async (socket, next) => {
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
      socket.data.participantId = payload.customerId || `cust_${socket.id}`;
      socket.data.sessionId = sessionId;
      socket.data.role = "customer";
      socket.data.name = socket.handshake.auth.name || "Customer";
      return next();
    }

    return next(new Error("Unauthorized"));
  });

  media.on("connection", async (socket: Socket) => {
    const { participantId, sessionId, role, name } = socket.data as {
      participantId: string;
      sessionId: string;
      role: "agent" | "customer";
      name: string;
    };

    logger.info({ participantId, sessionId, role }, "Media socket connected");

    const wasInGrace = await isWithinReconnectWindow(sessionId, participantId);
    if (wasInGrace) {
      await clearDisconnectMark(sessionId, participantId);
      logger.info({ participantId, sessionId }, "Participant reconnected within grace window");
    }

    socket.join(sessionId);

    socketParticipants.set(socket.id, {
      socketId: socket.id,
      participantId,
      sessionId,
      role,
      name,
    });

    try {
      await createRoom(sessionId);
      await addParticipant(sessionId, participantId);

      await prisma.sessionEvent.create({
        data: {
          session_id: sessionId,
          participant_role: role,
          participant_id: participantId,
          event_type: "join",
        },
      });

      const room = getRoom(sessionId)!;
      socket.emit("router:rtp-capabilities", room.router.rtpCapabilities);

      const participants = await getParticipants(sessionId);

      socket.to(sessionId).emit("peer:joined", {
        participantId,
        role,
        name,
      });

      const peerNames: Record<string, string> = {};
      socketParticipants.forEach((info) => {
        if (info.sessionId === sessionId && info.participantId !== participantId) {
          peerNames[info.participantId] = info.name;
        }
      });

      const existingProducers: { producerId: string; participantId: string; kind: string; name: string; appData: unknown }[] = [];
      room.producers.forEach((producer, pId) => {
        if (!pId.startsWith(participantId)) {
          const peerId = pId.slice(0, pId.lastIndexOf("_"));
          existingProducers.push({
            producerId: producer.id,
            participantId: peerId,
            kind: producer.kind,
            name: peerNames[peerId] || "Participant",
            appData: producer.appData,
          });
        }
      });

      socket.emit("room:joined", {
        participantId,
        participants,
        existingProducers,
      });
    } catch (err) {
      logger.error({ err, sessionId }, "Error joining media room");
    }

    socket.on("transport:create", async (data, callback) => {
      try {
        const room = getRoom(sessionId);
        if (!room) return callback({ error: "Room not found" });

        const transportId = `${participantId}_${data.direction}_${Date.now()}`;
        const transport = await createWebRtcTransport(room, transportId);

        const iceServers = [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:openrelay.metered.live:80" },
          {
            urls: "turn:openrelay.metered.live:80",
            username: "openrelayproject",
            credential: "openrelayprojectsecret",
          },
          {
            urls: "turn:openrelay.metered.live:443",
            username: "openrelayproject",
            credential: "openrelayprojectsecret",
          },
          {
            urls: "turns:openrelay.metered.live:443",
            username: "openrelayproject",
            credential: "openrelayprojectsecret",
          },
        ];

        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          transportId,
          iceServers,
        });
      } catch (err) {
        logger.error({ err }, "Error creating transport");
        callback({ error: "Failed to create transport" });
      }
    });

    socket.on("transport:connect", async (data, callback) => {
      try {
        const room = getRoom(sessionId);
        if (!room) return callback({ error: "Room not found" });

        const transport = room.transports.get(data.transportId);
        if (!transport) return callback({ error: "Transport not found" });

        await transport.connect({ dtlsParameters: data.dtlsParameters });
        callback({ connected: true });
      } catch (err) {
        logger.error({ err }, "Error connecting transport");
        callback({ error: "Failed to connect transport" });
      }
    });

    socket.on("producer:create", async (data, callback) => {
      try {
        const room = getRoom(sessionId);
        if (!room) return callback({ error: "Room not found" });

        const transport = room.transports.get(data.transportId);
        if (!transport) return callback({ error: "Transport not found" });

        const producer = await transport.produce({
          kind: data.kind,
          rtpParameters: data.rtpParameters,
          appData: { participantId, role, ...data.appData },
        });

        const producerKey = `${participantId}_${data.kind}`;
        room.producers.set(producerKey, producer);

        producer.on("transportclose", () => {
          producer.close();
          room.producers.delete(producerKey);
        });

        socket.to(sessionId).emit("producer:new", {
          producerId: producer.id,
          participantId,
          kind: data.kind,
          name,
          appData: producer.appData,
        });

        callback({ id: producer.id });
      } catch (err) {
        logger.error({ err }, "Error creating producer");
        callback({ error: "Failed to create producer" });
      }
    });

    socket.on("consumer:create", async (data, callback) => {
      try {
        const room = getRoom(sessionId);
        if (!room) return callback({ error: "Room not found" });

        const transport = room.transports.get(data.transportId);
        if (!transport) return callback({ error: "Transport not found" });

        if (!room.router.canConsume({ producerId: data.producerId, rtpCapabilities: data.rtpCapabilities })) {
          return callback({ error: "Cannot consume this producer" });
        }

        const consumer = await transport.consume({
          producerId: data.producerId,
          rtpCapabilities: data.rtpCapabilities,
          paused: true,
        });

        const consumerKey = `${participantId}_${data.producerId}`;
        room.consumers.set(consumerKey, consumer);

        consumer.on("transportclose", () => {
          consumer.close();
          room.consumers.delete(consumerKey);
        });

        consumer.on("producerclose", () => {
          consumer.close();
          room.consumers.delete(consumerKey);
          socket.emit("consumer:closed", { consumerId: consumer.id });
        });

        callback({
          id: consumer.id,
          producerId: data.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
      } catch (err) {
        logger.error({ err }, "Error creating consumer");
        callback({ error: "Failed to create consumer" });
      }
    });

    socket.on("consumer:resume", async (data, callback) => {
      try {
        const room = getRoom(sessionId);
        if (!room) return callback?.({ error: "Room not found" });

        const consumerKey = `${participantId}_${data.producerId}`;
        const consumer = room.consumers.get(consumerKey);
        if (!consumer) return callback?.({ error: "Consumer not found" });

        await consumer.resume();
        callback?.({ resumed: true });
      } catch (err) {
        logger.error({ err }, "Error resuming consumer");
        callback?.({ error: "Failed to resume consumer" });
      }
    });

    socket.on("producer:pause", async (data) => {
      const room = getRoom(sessionId);
      if (!room) return;

      const producerKey = `${participantId}_${data.kind}`;
      const producer = room.producers.get(producerKey);
      if (producer) {
        await producer.pause();
        socket.to(sessionId).emit("peer:producer:paused", {
          participantId,
          kind: data.kind,
        });
      }

      await prisma.sessionEvent.create({
        data: {
          session_id: sessionId,
          participant_role: role,
          participant_id: participantId,
          event_type: data.kind === "audio" ? "mute" : "video_off",
        },
      });
    });

    socket.on("producer:resume", async (data) => {
      const room = getRoom(sessionId);
      if (!room) return;

      const producerKey = `${participantId}_${data.kind}`;
      const producer = room.producers.get(producerKey);
      if (producer) {
        await producer.resume();
        socket.to(sessionId).emit("peer:producer:resumed", {
          participantId,
          kind: data.kind,
        });
      }

      await prisma.sessionEvent.create({
        data: {
          session_id: sessionId,
          participant_role: role,
          participant_id: participantId,
          event_type: data.kind === "audio" ? "unmute" : "video_on",
        },
      });
    });

    socket.on("stats:request", async (data, callback) => {
      try {
        const room = getRoom(sessionId);
        if (!room) return;

        const stats: Record<string, unknown> = {};

        for (const [key, transport] of room.transports) {
          if (key.startsWith(participantId)) {
            const transportStats = await transport.getStats();
            stats[key] = transportStats;
          }
        }

        callback?.(stats);
      } catch (err) {
        logger.error({ err }, "Error getting stats");
      }
    });

    socket.on("recording:start", async (_, callback) => {
      if (role !== "agent") return callback?.({ error: "Forbidden" });

      try {
        await prisma.session.update({
          where: { id: sessionId },
          data: { recording_status: "recording" },
        });

        await prisma.sessionEvent.create({
          data: {
            session_id: sessionId,
            participant_role: role,
            participant_id: participantId,
            event_type: "recording_start",
          },
        });

        media.to(sessionId).emit("recording:status", { status: "recording" });
        callback?.({ started: true });
      } catch (err) {
        logger.error({ err }, "Error starting recording");
        callback?.({ error: "Failed to start recording" });
      }
    });

    socket.on("recording:stop", async (_, callback) => {
      if (role !== "agent") return callback?.({ error: "Forbidden" });

      try {
        await prisma.session.update({
          where: { id: sessionId },
          data: { recording_status: "idle" },
        });

        await prisma.sessionEvent.create({
          data: {
            session_id: sessionId,
            participant_role: role,
            participant_id: participantId,
            event_type: "recording_stop",
          },
        });

        media.to(sessionId).emit("recording:status", { status: "idle" });
        callback?.({ stopped: true });
      } catch (err) {
        logger.error({ err }, "Error stopping recording");
        callback?.({ error: "Failed to stop recording" });
      }
    });

    socket.on("session:end", async (_, callback) => {
      if (role !== "agent") return callback?.({ error: "Forbidden" });

      try {
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: "ended", ended_at: new Date() },
        });

        media.to(sessionId).emit("session:ended", { endedBy: participantId });
        await closeRoom(sessionId);
        callback?.({ ended: true });
      } catch (err) {
        logger.error({ err }, "Error ending session");
        callback?.({ error: "Failed to end session" });
      }
    });

    socket.on("disconnect", async (reason) => {
      logger.info({ participantId, sessionId, reason }, "Media socket disconnected");
      socketParticipants.delete(socket.id);

      socket.to(sessionId).emit("peer:left", { participantId, role, name });

      await markDisconnected(sessionId, participantId, 30);

      setTimeout(async () => {
        const stillDisconnected = await isWithinReconnectWindow(sessionId, participantId);
        if (stillDisconnected) {
          await removeParticipant(sessionId, participantId);

          await prisma.sessionEvent.create({
            data: {
              session_id: sessionId,
              participant_role: role,
              participant_id: participantId,
              event_type: "leave",
            },
          }).catch(() => {});
        }
      }, 31000);
    });
  });
}
