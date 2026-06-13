import jwt from "jsonwebtoken";

const INVITE_SECRET = process.env.INVITE_JWT_SECRET || "invite-secret-fallback";

export interface InviteTokenPayload {
  sessionId: string;
  role: "customer";
  iat?: number;
  exp?: number;
}

export function signInviteToken(sessionId: string): string {
  return jwt.sign({ sessionId, role: "customer" }, INVITE_SECRET, {
    expiresIn: "24h",
  });
}

export function verifyInviteToken(token: string): InviteTokenPayload | null {
  try {
    const payload = jwt.verify(token, INVITE_SECRET) as InviteTokenPayload;
    return payload;
  } catch {
    return null;
  }
}
