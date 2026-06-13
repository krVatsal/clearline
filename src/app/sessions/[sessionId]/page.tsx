import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, MessageSquare, Activity } from "lucide-react";
import SessionTimeline from "@/components/SessionTimeline";

export default async function SessionHistoryPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const callSession = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: {
      agent: { select: { name: true, email: true } },
      events: { orderBy: { timestamp: "asc" } },
      messages: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!callSession) notFound();

  if (callSession.agent_id !== session.user.id && session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const durationMs = callSession.ended_at
    ? callSession.ended_at.getTime() - callSession.created_at.getTime()
    : Date.now() - callSession.created_at.getTime();

  const mins = Math.floor(durationMs / 60000);
  const secs = Math.floor((durationMs % 60000) / 1000);

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white">
              {callSession.customer_name || "Customer"} — Session History
            </h1>
            <span className={`px-3 py-1 rounded-full text-sm ${
              callSession.status === "active"
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
            }`}>
              {callSession.status}
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Session ID: <code className="text-blue-400">{callSession.id}</code>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Duration
            </div>
            <p className="text-xl font-bold text-white">{mins}m {secs}s</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <MessageSquare className="w-4 h-4" />
              Messages
            </div>
            <p className="text-xl font-bold text-white">{callSession.messages.length}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Activity className="w-4 h-4" />
              Events
            </div>
            <p className="text-xl font-bold text-white">{callSession.events.length}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Session Timeline</h2>
            <SessionTimeline
              events={callSession.events.map((e) => ({
                id: e.id,
                event_type: e.event_type,
                participant_role: e.participant_role,
                timestamp: e.timestamp.toISOString(),
              }))}
              sessionStart={callSession.created_at.toISOString()}
              sessionEnd={callSession.ended_at?.toISOString() || null}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Chat Transcript</h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 max-h-96 overflow-y-auto">
              {callSession.messages.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No messages in this session</p>
              ) : (
                callSession.messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300">
                        {msg.sender_name || msg.sender_role}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-white bg-white/5 rounded-lg px-3 py-2">
                      {msg.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
