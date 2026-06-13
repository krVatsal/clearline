import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      agent: { select: { name: true, email: true } },
      events: { orderBy: { timestamp: "asc" } },
      messages: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!callSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (callSession.agent_id !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: callSession.id,
    created_at: callSession.created_at.toISOString(),
    ended_at: callSession.ended_at?.toISOString() || null,
    status: callSession.status,
    customer_name: callSession.customer_name,
    agent: callSession.agent,
    events: callSession.events.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      participant_role: e.participant_role,
      timestamp: e.timestamp.toISOString(),
    })),
    messages: callSession.messages.map((m) => ({
      id: m.id,
      sender_name: m.sender_name,
      sender_role: m.sender_role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    })),
  });
}
