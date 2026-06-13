import jwt from "jsonwebtoken";

const INVITE_SECRET = process.env.INVITE_JWT_SECRET || "invite-secret-fallback";

export interface InviteTokenPayload {
  sessionId: string;
  customerId: string;
  role: "customer";
  iat?: number;
  exp?: number;
}

export function signInviteToken(sessionId: string, customerId?: string): string {
  const id = customerId || `cust_${Math.random().toString(36).slice(2, 10)}`;
  return jwt.sign({ sessionId, customerId: id, role: "customer" }, INVITE_SECRET, {
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
