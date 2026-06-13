"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  Plus,
  Clock,
  MessageSquare,
  ExternalLink,
  Copy,
  CheckCircle2,
  LogOut,
  Shield,
  X,
  User,
  Activity,
  History,
  Loader2,
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

interface UserType {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  user: UserType;
  initialSessions: Session[];
}

export default function DashboardClient({ user, initialSessions }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [creating, setCreating] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const endedSessions = sessions.filter((s) => s.status !== "active");

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
    const diff = endMs - startMs;
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface-base)" }}>

      {/* ── Top nav ── */}
      <header
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "var(--primary-500)" }}
          >
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base" style={{ color: "var(--neutral-100)" }}>ClearLine</span>
        </div>

        <div className="flex items-center gap-2">
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: "oklch(42% 0.20 280 / 0.12)",
                color: "oklch(72% 0.18 280)",
                border: "1px solid oklch(42% 0.20 280 / 0.25)",
              }}
            >
              <Shield className="w-3 h-3" />
              Admin
            </Link>
          )}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--primary-600)", color: "white" }}
            >
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm" style={{ color: "var(--neutral-300)" }}>{user.name}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="cl-btn-ghost p-2 rounded-xl"
            title="Sign out"
            style={{ padding: "8px" }}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8 animate-fade-in">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Active sessions",
              value: activeSessions.length,
              icon: <Activity className="w-4 h-4" />,
              accent: "oklch(55% 0.18 145)",
              bg: "oklch(55% 0.18 145 / 0.08)",
              live: activeSessions.length > 0,
            },
            {
              label: "Total sessions",
              value: sessions.length,
              icon: <Video className="w-4 h-4" />,
              accent: "var(--primary-400)",
              bg: "oklch(55% 0.22 250 / 0.08)",
              live: false,
            },
            {
              label: "Messages sent",
              value: sessions.reduce((a, s) => a + s.messageCount, 0),
              icon: <MessageSquare className="w-4 h-4" />,
              accent: "oklch(70% 0.16 85)",
              bg: "oklch(70% 0.16 85 / 0.08)",
              live: false,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-5"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--neutral-500)" }}>
                  {stat.label}
                </span>
                <div className="p-1.5 rounded-lg" style={{ background: stat.bg, color: stat.accent }}>
                  {stat.icon}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold" style={{ color: "var(--neutral-50)" }}>
                  {stat.value}
                </span>
                {stat.live && (
                  <span className="mb-1 flex items-center gap-1 text-xs" style={{ color: stat.accent }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: stat.accent }} />
                    live
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Sessions header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--neutral-50)" }}>Sessions</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--neutral-500)" }}>
              Your video support calls
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="cl-btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
        </div>

        {/* ── Session list ── */}
        {sessions.length === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--surface-overlay)" }}
            >
              <Video className="w-7 h-7" style={{ color: "var(--neutral-500)" }} />
            </div>
            <p className="font-semibold mb-1" style={{ color: "var(--neutral-300)" }}>No sessions yet</p>
            <p className="text-sm" style={{ color: "var(--neutral-500)" }}>
              Create your first session to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session, i) => (
              <div
                key={session.id}
                className="group flex items-center gap-4 rounded-xl px-5 py-4 transition-colors"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-subtle)",
                  animationDelay: `${i * 40}ms`,
                }}
              >
                {/* Status dot */}
                <div className="flex-shrink-0">
                  {session.status === "active" ? (
                    <div className="relative">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: "oklch(55% 0.18 145)" }}
                      />
                      <div
                        className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-60"
                        style={{ background: "oklch(55% 0.18 145)" }}
                      />
                    </div>
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--neutral-600)" }} />
                  )}
                </div>

                {/* Customer info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm truncate" style={{ color: "var(--neutral-100)" }}>
                      {session.customer_name || "Anonymous Customer"}
                    </span>
                    <span className={session.status === "active" ? "cl-badge-active" : "cl-badge-ended"}>
                      {session.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--neutral-500)" }}>
                      <Clock className="w-3 h-3" />
                      {formatDuration(session.created_at, session.ended_at)}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--neutral-500)" }}>
                      <MessageSquare className="w-3 h-3" />
                      {session.messageCount}
                    </span>
                    <span className="text-xs" style={{ color: "var(--neutral-600)" }}>
                      {formatTime(session.created_at)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => copyInviteLink(session.id)}
                    title="Copy invite link"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: copiedId === session.id ? "oklch(55% 0.18 145 / 0.12)" : "var(--surface-overlay)",
                      color: copiedId === session.id ? "oklch(70% 0.18 145)" : "var(--neutral-300)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {copiedId === session.id
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</>
                      : <><Copy className="w-3.5 h-3.5" /> Copy link</>
                    }
                  </button>

                  {session.status === "active" && (
                    <Link
                      href={`/call/${session.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cl-btn-primary"
                      style={{ padding: "6px 12px" }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Rejoin
                    </Link>
                  )}

                  <Link
                    href={`/sessions/${session.id}`}
                    title="Session history"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: "var(--surface-overlay)",
                      color: "var(--neutral-400)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <History className="w-3.5 h-3.5" />
                    History
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Create session modal ── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0% 0 0 / 0.7)" }}
          onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 animate-slide-up"
            style={{ background: "var(--surface-overlay)", border: "1px solid var(--border-default)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--neutral-50)" }}>
                  New support session
                </h2>
                <p className="text-sm mt-0.5" style={{ color: "var(--neutral-500)" }}>
                  Invite link will be copied to clipboard
                </p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="cl-btn-ghost p-1.5 rounded-lg"
                style={{ padding: "6px" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 mb-6">
              <label
                htmlFor="customerName"
                className="block text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--neutral-400)" }}
              >
                Customer name <span style={{ color: "var(--neutral-600)" }}>(optional)</span>
              </label>
              <input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createSession()}
                placeholder="e.g. Jane Smith"
                autoFocus
                className="cl-input"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="cl-btn-ghost flex-1"
                style={{ border: "1px solid var(--border-subtle)" }}
              >
                Cancel
              </button>
              <button
                onClick={createSession}
                disabled={creating}
                className="cl-btn-primary flex-1"
              >
                {creating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                ) : (
                  <><Video className="w-4 h-4" /> Create & Join</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
