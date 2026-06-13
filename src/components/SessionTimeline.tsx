"use client";

import { LogIn, LogOut, Mic, MicOff, Video, VideoOff, Circle, Square } from "lucide-react";

interface Event {
  id: string;
  event_type: string;
  participant_role: string;
  timestamp: string;
}

interface Props {
  events: Event[];
  sessionStart: string;
  sessionEnd: string | null;
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  join: { icon: <LogIn className="w-3.5 h-3.5" />, label: "Joined", color: "text-green-400 bg-green-400/10 border-green-400/20" },
  leave: { icon: <LogOut className="w-3.5 h-3.5" />, label: "Left", color: "text-red-400 bg-red-400/10 border-red-400/20" },
  mute: { icon: <MicOff className="w-3.5 h-3.5" />, label: "Muted", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  unmute: { icon: <Mic className="w-3.5 h-3.5" />, label: "Unmuted", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  video_off: { icon: <VideoOff className="w-3.5 h-3.5" />, label: "Video Off", color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  video_on: { icon: <Video className="w-3.5 h-3.5" />, label: "Video On", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  recording_start: { icon: <Circle className="w-3.5 h-3.5" />, label: "Recording Started", color: "text-red-400 bg-red-400/10 border-red-400/20" },
  recording_stop: { icon: <Square className="w-3.5 h-3.5" />, label: "Recording Stopped", color: "text-slate-400 bg-slate-400/10 border-slate-400/20" },
};

export default function SessionTimeline({ events, sessionStart, sessionEnd }: Props) {
  const startMs = new Date(sessionStart).getTime();

  function offsetLabel(ts: string) {
    const diff = new Date(ts).getTime() - startMs;
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `+${mins}m ${secs}s`;
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="relative">
        <div className="absolute left-2 top-0 bottom-0 w-px bg-white/10" />
        <div className="space-y-3">
          {events.map((event) => {
            const config = EVENT_CONFIG[event.event_type] || {
              icon: <Circle className="w-3.5 h-3.5" />,
              label: event.event_type,
              color: "text-slate-400 bg-slate-400/10 border-slate-400/20",
            };

            return (
              <div key={event.id} className="flex items-center gap-3 pl-6 relative">
                <div className={`absolute left-0 w-4 h-4 rounded-full border flex items-center justify-center ${config.color}`}>
                  {config.icon}
                </div>
                <div className="flex items-center justify-between w-full min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">
                      {event.participant_role}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 flex-shrink-0">
                    {offsetLabel(event.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}

          {sessionEnd && (
            <div className="flex items-center gap-3 pl-6 relative">
              <div className="absolute left-0 w-4 h-4 rounded-full border flex items-center justify-center text-slate-400 bg-slate-400/10 border-slate-400/20">
                <Square className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center justify-between w-full">
                <span className="text-xs px-1.5 py-0.5 rounded border text-slate-400 bg-slate-400/10 border-slate-400/20">
                  Session Ended
                </span>
                <span className="text-xs text-slate-600">{offsetLabel(sessionEnd)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {events.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-4">No events recorded</p>
      )}
    </div>
  );
}
