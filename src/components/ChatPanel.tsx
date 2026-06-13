"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Send, MessageSquare } from "lucide-react";

interface Message {
  id: string;
  sender_role: string;
  sender_name: string | null;
  content: string | null;
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
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
            >
              <span className="text-xs text-slate-500">
                {msg.sender_name || msg.sender_role}
              </span>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  isMine
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white/10 text-white rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
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

      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
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
