"use client";

import { Mic, MicOff, Video, VideoOff, PhoneOff, Circle, Square } from "lucide-react";

interface Props {
  audioMuted: boolean;
  videoOff: boolean;
  recording: boolean;
  role: "agent" | "customer";
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleRecording: () => void;
  onEndCall: () => void;
}

export default function Controls({
  audioMuted,
  videoOff,
  recording,
  role,
  onToggleAudio,
  onToggleVideo,
  onToggleRecording,
  onEndCall,
}: Props) {
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button
        onClick={onToggleAudio}
        title={audioMuted ? "Unmute" : "Mute"}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
          audioMuted
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-white/10 hover:bg-white/20 text-white"
        }`}
      >
        {audioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      <button
        onClick={onToggleVideo}
        title={videoOff ? "Turn on camera" : "Turn off camera"}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
          videoOff
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-white/10 hover:bg-white/20 text-white"
        }`}
      >
        {videoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
      </button>

      {role === "agent" && (
        <button
          onClick={onToggleRecording}
          title={recording ? "Stop recording" : "Start recording"}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            recording
              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
        >
          {recording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>
      )}

      <button
        onClick={onEndCall}
        title="End call"
        className="w-14 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors px-4"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}
