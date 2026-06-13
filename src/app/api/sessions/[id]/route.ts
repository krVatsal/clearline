import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signInviteToken } from "@/lib/jwt";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const callSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      agent: { select: { name: true, email: true } },
      _count: { select: { messages: true, events: true } },
    },
  });

  if (!callSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (callSession.agent_id !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inviteToken = signInviteToken(params.id);

  return NextResponse.json({
    session: {
      ...callSession,
      created_at: callSession.created_at.toISOString(),
      ended_at: callSession.ended_at?.toISOString() || null,
    },
    inviteToken,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (body.action === "end") {
    const callSession = await prisma.session.findUnique({
      where: { id: params.id },
    });

    if (!callSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (callSession.agent_id !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.session.update({
      where: { id: params.id },
      data: { status: "ended", ended_at: new Date() },
    });

    return NextResponse.json({ ended: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
