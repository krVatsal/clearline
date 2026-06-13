import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signInviteToken } from "@/lib/jwt";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const customerName = body.customerName || null;

  const inviteToken = signInviteToken("placeholder");
  const tokenHash = crypto
    .createHash("sha256")
    .update(inviteToken)
    .digest("hex");

  const newSession = await prisma.session.create({
    data: {
      agent_id: session.user.id,
      invite_token_hash: tokenHash,
      customer_name: customerName,
      status: "active",
    },
  });

  const finalToken = signInviteToken(newSession.id);
  const finalHash = crypto
    .createHash("sha256")
    .update(finalToken)
    .digest("hex");

  await prisma.session.update({
    where: { id: newSession.id },
    data: { invite_token_hash: finalHash },
  });

  await prisma.sessionEvent.create({
    data: {
      session_id: newSession.id,
      participant_role: "agent",
      participant_id: session.user.id,
      event_type: "join",
    },
  });

  return NextResponse.json({
    session: {
      id: newSession.id,
      status: newSession.status,
      created_at: newSession.created_at.toISOString(),
      customer_name: newSession.customer_name,
    },
    inviteToken: finalToken,
    inviteLink: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/call/${newSession.id}?token=${finalToken}`,
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.session.findMany({
    where: { agent_id: session.user.id },
    orderBy: { created_at: "desc" },
    take: 50,
    include: {
      _count: { select: { messages: true, events: true } },
    },
  });

  return NextResponse.json({ sessions });
}
