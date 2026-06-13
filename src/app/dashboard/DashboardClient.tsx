"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Plus,
  Clock,
  MessageSquare,
  ExternalLink,
  Copy,
  CheckCircle2,
  XCircle,
  LogOut,
  LayoutDashboard,
  Shield,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";

interface Session {
  id: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  customer_name: string | null;
  recording_status: string;
  messageCount: number;
  eventCount: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  user: User;
  initialSessions: Session[];
}

export default function DashboardClient({ user, initialSessions }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [creating, setCreating] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function createSession() {
    setCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName }),
      });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) => [
          {
            id: data.session.id,
            status: data.session.status,
            created_at: data.session.created_at,
            ended_at: null,
            customer_name: data.session.customer_name,
            recording_status: "idle",
            messageCount: 0,
            eventCount: 0,
          },
          ...prev,
        ]);
        setShowCreate(false);
        setCustomerName("");

        await copyInviteLink(data.session.id, data.inviteToken);
        router.push(`/call/${data.session.id}`);
      }
    } catch {
      console.error("Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  async function copyInviteLink(sessionId: string, token?: string) {
    let inviteToken = token;
    if (!inviteToken) {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      inviteToken = data.inviteToken;
    }
    const link = `${window.location.origin}/call/${sessionId}?token=${inviteToken}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function formatDuration(start: string, end: string | null) {
    const startMs = new Date(start).getTime();
    const endMs = end ? new Date(end).getTime() : Date.now();
    const diffMs = endMs - startMs;
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">ClearLine</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">{user.name}</span>
              {user.role === "admin" && (
                <Link href="/admin" className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-purple-400 text-xs">
                  <Shield className="w-3 h-3" />
                  Admin
                </Link>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Support Dashboard</h1>
            <p className="text-slate-400 mt-1">Manage your video support sessions</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
        </div>

        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-white mb-4">Create Support Session</h2>
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Customer Name (optional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full px-4 py-3 bg-slate-700 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-sm text-slate-400 mb-6">
                An invite link will be generated and copied to your clipboard.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createSession}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  {creating ? "Creating..." : "Create & Join"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {sessions.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Phone className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No sessions yet</p>
              <p className="text-sm mt-1">Create your first support session above</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center gap-4"
              >
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  session.status === "active" ? "bg-green-400 animate-pulse" : "bg-slate-500"
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">
                      {session.customer_name || "Customer"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      session.status === "active"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(session.created_at, session.ended_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {session.messageCount} msgs
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => copyInviteLink(session.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm transition-colors"
                  >
                    {copiedId === session.id ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedId === session.id ? "Copied!" : "Copy Link"}
                  </button>

                  {session.status === "active" && (
                    <Link
                      href={`/call/${session.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Rejoin
                    </Link>
                  )}

                  <Link
                    href={`/sessions/${session.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm transition-colors"
                  >
                    History
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
