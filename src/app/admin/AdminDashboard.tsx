"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import {
  Activity, Users, BarChart3, MessageSquare, Clock, ChevronRight,
  X, LogIn, LogOut, Mic, MicOff, Video, VideoOff, Circle, Square,
  AlertTriangle, RefreshCw,
} from "lucide-react";
import SessionTimeline from "@/components/SessionTimeline";

interface LiveSession {
  id: string;
  created_at: string;
  customer_name: string | null;
  agent: { id: string; name: string | null; email: string };
  _count: { messages: number; events: number };
  participants: string[];
}

interface HistoricalSession {
  id: string;
  created_at: string;
  ended_at: string | null;
  status: string;
  customer_name: string | null;
  agent: { name: string | null; email: string };
  _count: { messages: number; events: number };
}

interface SessionDetail {
  id: string;
  created_at: string;
  ended_at: string | null;
  status: string;
  customer_name: string | null;
  agent: { name: string | null; email: string };
  events: { id: string; event_type: string; participant_role: string; timestamp: string }[];
  messages: { id: string; sender_name: string | null; sender_role: string; content: string | null; timestamp: string }[];
}

interface Props {
  initialStats: { active: number; total: number; messages: number };
  recentSessions: HistoricalSession[];
}

function useTicker() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return tick;
}

function duration(startIso: string, tick: number) {
  void tick;
  const secs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function staticDuration(startIso: string, endIso: string | null) {
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const secs = Math.floor((end - new Date(startIso).getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export default function AdminDashboard({ initialStats, recentSessions }: Props) {
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [stats, setStats] = useState(initialStats);
  const [drawerSession, setDrawerSession] = useState<SessionDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [forcingEnd, setForcingEnd] = useState<string | null>(null);
  const [forceEndError, setForceEndError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const tick = useTicker();

  useEffect(() => {
    const socket = io("/admin", { transports: ["websocket"] });
    socketRef.current = socket;

    function fetchLive() {
      socket.emit("admin:live-sessions", {}, (res: { sessions?: LiveSession[]; error?: string }) => {
        if (res?.sessions) {
          setLiveSessions(res.sessions);
          setStats((prev) => ({ ...prev, active: res.sessions!.length }));
        }
      });
    }

    socket.on("connect", fetchLive);
    socket.on("admin:session-changed", fetchLive);

    return () => { socket.disconnect(); };
  }, []);

  async function openDrawer(sessionId: string) {
    setDrawerLoading(true);
    setDrawerSession(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/detail`);
      if (res.ok) setDrawerSession(await res.json());
    } finally {
      setDrawerLoading(false);
    }
  }

  async function forceEnd(sessionId: string) {
    setForcingEnd(sessionId);
    setForceEndError(null);
    socketRef.current?.emit("admin:force-end", { sessionId }, (res: { ended?: boolean; error?: string }) => {
      setForcingEnd(null);
      if (res?.error) {
        setForceEndError(res.error);
      } else {
        setLiveSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setStats((prev) => ({ ...prev, active: Math.max(0, prev.active - 1) }));
        if (drawerSession?.id === sessionId) setDrawerSession(null);
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">Admin Dashboard</h1>
              <p className="text-slate-500 text-xs">ClearLine operations</p>
            </div>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">
            ← Agent Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Activity className="w-4 h-4" />
              Live Sessions
            </div>
            <p className="text-3xl font-bold text-white">{stats.active}</p>
            <div className={`flex items-center gap-1.5 mt-2 text-xs ${stats.active > 0 ? "text-green-400" : "text-slate-500"}`}>
              <div className={`w-2 h-2 rounded-full ${stats.active > 0 ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} />
              {stats.active > 0 ? `${stats.active} call${stats.active > 1 ? "s" : ""} in progress` : "No active calls"}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <BarChart3 className="w-4 h-4" />
              Total Sessions
            </div>
            <p className="text-3xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <MessageSquare className="w-4 h-4" />
              Total Messages
            </div>
            <p className="text-3xl font-bold text-white">{stats.messages}</p>
          </div>
        </div>

        {/* Live Sessions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live Sessions
            </h2>
            <button
              onClick={() => socketRef.current?.emit("admin:live-sessions", {}, (res: { sessions?: LiveSession[] }) => {
                if (res?.sessions) setLiveSessions(res.sessions);
              })}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {liveSessions.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">No active sessions right now</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {liveSessions.map((s) => (
                <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.07] transition-colors">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium text-sm truncate">
                        {s.customer_name || "Customer"}
                      </span>
                      <span className="text-slate-500 text-xs">with</span>
                      <span className="text-slate-300 text-sm truncate">{s.agent.name || s.agent.email}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {duration(s.created_at, tick)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {s._count.messages} msgs
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {s._count.events} events
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openDrawer(s.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg transition-colors"
                    >
                      View
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => forceEnd(s.id)}
                      disabled={forcingEnd === s.id}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {forcingEnd === s.id ? "Ending…" : "Force End"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {forceEndError && (
            <p className="text-red-400 text-xs mt-2">{forceEndError}</p>
          )}
        </section>

        {/* All Sessions History */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4">Session History</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Agent</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Messages</th>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white text-sm">{s.agent.name || s.agent.email}</td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{s.customer_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        s.status === "active"
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm tabular-nums">
                      {staticDuration(s.created_at, s.ended_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{s._count.messages}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDrawer(s.id)}
                        className="text-blue-400 hover:text-blue-300 transition-colors text-xs"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentSessions.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">No sessions yet</div>
            )}
          </div>
        </section>
      </main>

      {/* Session Detail Drawer */}
      {(drawerSession || drawerLoading) && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerSession(null)} />
          <div className="w-full max-w-xl bg-slate-900 border-l border-white/10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <div>
                <h2 className="text-white font-semibold text-sm">
                  {drawerLoading ? "Loading…" : `${drawerSession?.customer_name || "Customer"} — Session`}
                </h2>
                {drawerSession && (
                  <p className="text-slate-500 text-xs mt-0.5">{drawerSession.id}</p>
                )}
              </div>
              <button onClick={() => setDrawerSession(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {drawerLoading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {drawerSession && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Meta */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Duration</p>
                    <p className="text-white font-semibold text-sm">{staticDuration(drawerSession.created_at, drawerSession.ended_at)}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Messages</p>
                    <p className="text-white font-semibold text-sm">{drawerSession.messages.length}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1 flex items-center gap-1"><Activity className="w-3 h-3" /> Events</p>
                    <p className="text-white font-semibold text-sm">{drawerSession.events.length}</p>
                  </div>
                </div>

                {/* Status + Force End */}
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-full text-xs border ${
                    drawerSession.status === "active"
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }`}>
                    {drawerSession.status === "active" ? "● Live" : "Ended"}
                  </span>
                  {drawerSession.status === "active" && (
                    <button
                      onClick={() => forceEnd(drawerSession.id)}
                      disabled={forcingEnd === drawerSession.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {forcingEnd === drawerSession.id ? "Ending…" : "Force End Session"}
                    </button>
                  )}
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Event Timeline</h3>
                  <SessionTimeline
                    events={drawerSession.events}
                    sessionStart={drawerSession.created_at}
                    sessionEnd={drawerSession.ended_at}
                  />
                </div>

                {/* Chat Transcript */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Chat Transcript</h3>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 max-h-72 overflow-y-auto">
                    {drawerSession.messages.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-4">No messages</p>
                    ) : (
                      drawerSession.messages.map((msg) => (
                        <div key={msg.id} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-300">{msg.sender_name || msg.sender_role}</span>
                            <span className="text-xs text-slate-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-sm text-white bg-white/5 rounded-lg px-3 py-2">{msg.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
