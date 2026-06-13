"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Send, MessageSquare, Paperclip, FileText, Download, X } from "lucide-react";

interface FileMeta {
  name: string;
  size: number;
  type: string;
}

interface Message {
  id: string;
  sender_role: string;
  sender_name: string | null;
  content: string | null;
  file_url: string | null;
  file_meta: FileMeta | null;
  timestamp: string;
  type: string;
}

interface Props {
  sessionId: string;
  participantId: string;
  participantName: string;
  role: "agent" | "customer";
  inviteToken: string | null;
}

export default function ChatPanel({
  sessionId,
  participantId,
  participantName,
  role,
  inviteToken,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const authPayload =
      role === "agent"
        ? { agentUserId: participantId, sessionId, name: participantName }
        : { token: inviteToken, sessionId, name: participantName };

    const s = io("/chat", {
      auth: authPayload,
      transports: ["websocket"],
    });

    s.on("chat:history", (history: Message[]) => {
      setMessages(history);
    });

    s.on("chat:message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    if (!input.trim() || !socket) return;
    socket.emit("chat:message", { content: input.trim() });
    setInput("");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !socket) return;
    e.target.value = "";
    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const headers: Record<string, string> = {};
      if (inviteToken) headers["x-invite-token"] = inviteToken;
      const res = await fetch("/api/upload", { method: "POST", body: form, headers });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const { url, name, size, type } = await res.json();
      socket.emit("chat:file", { url, name, size, type });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-white">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_role === role;
          const isFile = msg.type === "file";
          const meta = msg.file_meta as FileMeta | null;
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
            >
              <span className="text-xs text-slate-500">
                {msg.sender_name || msg.sender_role}
              </span>
              {isFile && meta ? (
                <a
                  href={msg.file_url!}
                  download={meta.name}
                  target="_blank"
                  rel="noreferrer"
                  className={`max-w-[85%] flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-opacity hover:opacity-80 ${
                    isMine
                      ? "bg-blue-600/30 border-blue-500/40 text-blue-200 rounded-br-sm"
                      : "bg-white/10 border-white/10 text-white rounded-bl-sm"
                  }`}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{meta.name}</p>
                    <p className="text-xs opacity-60">{formatSize(meta.size)}</p>
                  </div>
                  <Download className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                </a>
              ) : (
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    isMine
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white/10 text-white rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              )}
              <span className="text-xs text-slate-600">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/10 space-y-2">
        {uploadError && (
          <div className="flex items-center justify-between text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError("")}><X className="w-3 h-3" /></button>
          </div>
        )}
        {uploading && (
          <div className="text-xs text-slate-400 text-center animate-pulse">Uploading file…</div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Share a file"
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-lg transition-colors disabled:opacity-40"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
