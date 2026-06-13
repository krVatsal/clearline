import Redis from "ioredis";
import logger from "../lib/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = new Redis(REDIS_URL, {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
});

export const redisSub = new Redis(REDIS_URL, {
  lazyConnect: false,
});

redisClient.on("error", (err) => logger.error({ err }, "Redis client error"));
redisSub.on("error", (err) => logger.error({ err }, "Redis sub error"));

export async function addParticipant(sessionId: string, participantId: string) {
  await redisClient.sadd(`session:${sessionId}:participants`, participantId);
  await redisClient.set(
    `participant:${participantId}:session`,
    sessionId,
    "EX",
    86400
  );
}

export async function removeParticipant(
  sessionId: string,
  participantId: string
) {
  await redisClient.srem(`session:${sessionId}:participants`, participantId);
  await redisClient.del(`participant:${participantId}:session`);
}

export async function markDisconnected(
  sessionId: string,
  participantId: string,
  ttlSeconds = 30
) {
  await redisClient.set(
    `session:${sessionId}:disconnected:${participantId}`,
    "1",
    "EX",
    ttlSeconds
  );
}

export async function isWithinReconnectWindow(
  sessionId: string,
  participantId: string
): Promise<boolean> {
  const val = await redisClient.get(
    `session:${sessionId}:disconnected:${participantId}`
  );
  return val !== null;
}

export async function clearDisconnectMark(
  sessionId: string,
  participantId: string
) {
  await redisClient.del(
    `session:${sessionId}:disconnected:${participantId}`
  );
}

export async function getParticipants(sessionId: string): Promise<string[]> {
  return redisClient.smembers(`session:${sessionId}:participants`);
}

export async function setActiveSession(sessionId: string, data: object) {
  await redisClient.set(
    `active_session:${sessionId}`,
    JSON.stringify(data),
    "EX",
    86400
  );
}

export async function getActiveSession(
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const raw = await redisClient.get(`active_session:${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteActiveSession(sessionId: string) {
  await redisClient.del(`active_session:${sessionId}`);
}
