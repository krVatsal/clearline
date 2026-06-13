import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminDashboard from "./AdminDashboard";
import type { Prisma } from "@prisma/client";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/dashboard");

  const [activeSessions, totalSessions, totalMessages, recentSessions] = await Promise.all([
    prisma.session.count({ where: { status: "active" } }),
    prisma.session.count(),
    prisma.chatMessage.count(),
    prisma.session.findMany({
      orderBy: { created_at: "desc" },
      take: 50,
      include: {
        agent: { select: { name: true, email: true } },
        _count: { select: { messages: true, events: true } },
      },
    }),
  ]);

  return (
    <AdminDashboard
      initialStats={{ active: activeSessions, total: totalSessions, messages: totalMessages }}
      recentSessions={recentSessions.map((s: Prisma.SessionGetPayload<{ include: { agent: { select: { name: true; email: true } }; _count: { select: { messages: true; events: true } } } }>) => ({
        id: s.id,
        created_at: s.created_at.toISOString(),
        ended_at: s.ended_at?.toISOString() || null,
        status: s.status,
        customer_name: s.customer_name,
        agent: s.agent,
        _count: s._count,
      }))}
    />
  );
}
