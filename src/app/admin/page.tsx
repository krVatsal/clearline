import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Activity, BarChart3 } from "lucide-react";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/dashboard");

  const [activeSessions, totalSessions, totalMessages] = await Promise.all([
    prisma.session.count({ where: { status: "active" } }),
    prisma.session.count(),
    prisma.chatMessage.count(),
  ]);

  const recentSessions = await prisma.session.findMany({
    orderBy: { created_at: "desc" },
    take: 20,
    include: {
      agent: { select: { name: true, email: true } },
      _count: { select: { messages: true, events: true } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <h1 className="text-white font-semibold">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Activity className="w-4 h-4" />
              Active Sessions
            </div>
            <p className="text-3xl font-bold text-white">{activeSessions}</p>
            <div className={`flex items-center gap-1.5 mt-2 text-xs ${activeSessions > 0 ? "text-green-400" : "text-slate-500"}`}>
              <div className={`w-2 h-2 rounded-full ${activeSessions > 0 ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} />
              {activeSessions > 0 ? "Live now" : "No active calls"}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <BarChart3 className="w-4 h-4" />
              Total Sessions
            </div>
            <p className="text-3xl font-bold text-white">{totalSessions}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Users className="w-4 h-4" />
              Total Messages
            </div>
            <p className="text-3xl font-bold text-white">{totalMessages}</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-white mb-4">All Sessions</h2>
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Messages</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white">{s.agent.name}</td>
                  <td className="px-4 py-3 text-slate-300">{s.customer_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      s.status === "active"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-slate-500/10 text-slate-400"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{s._count.messages}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/sessions/${s.id}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors text-xs"
                    >
                      View History
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentSessions.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">No sessions yet</div>
          )}
        </div>
      </main>
    </div>
  );
}
