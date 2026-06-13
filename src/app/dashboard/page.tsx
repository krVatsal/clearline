import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const sessions = await prisma.session.findMany({
    where: { agent_id: session.user.id },
    orderBy: { created_at: "desc" },
    take: 20,
    include: {
      _count: { select: { messages: true, events: true } },
    },
  });

  return (
    <DashboardClient
      user={{
        id: session.user.id,
        name: session.user.name || "Agent",
        email: session.user.email || "",
        role: session.user.role,
      }}
      initialSessions={sessions.map((s) => ({
        id: s.id,
        status: s.status,
        created_at: s.created_at.toISOString(),
        ended_at: s.ended_at?.toISOString() || null,
        customer_name: s.customer_name,
        recording_status: s.recording_status,
        messageCount: s._count.messages,
        eventCount: s._count.events,
      }))}
    />
  );
}
