"use client";

import { useEffect, useRef, useState } from "react";
import { MicOff, VideoOff } from "lucide-react";

interface Props {
  stream: MediaStream | null;
  name: string;
  isLocal: boolean;
  audioMuted: boolean;
  videoOff: boolean;
}

export default function VideoTile({ stream, name, isLocal, audioMuted, videoOff }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [trackCount, setTrackCount] = useState(0);

  useEffect(() => {
    if (!stream) return;
    const update = () => setTrackCount(stream.getTracks().length);
    stream.addEventListener("addtrack", update);
    stream.addEventListener("removetrack", update);
    update();
    return () => {
      stream.removeEventListener("addtrack", update);
      stream.removeEventListener("removetrack", update);
    };
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, trackCount]);

  return (
    <div className="video-tile relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
      {stream && !videoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          {videoOff && (
            <div className="flex items-center gap-1.5 text-slate-400 text-sm">
              <VideoOff className="w-4 h-4" />
              Camera off
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span className="px-2 py-1 bg-black/50 backdrop-blur rounded text-white text-xs">
          {name} {isLocal ? "(You)" : ""}
        </span>
        {audioMuted && (
          <div className="p-1 bg-red-500/80 rounded">
            <MicOff className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {!stream && !videoOff && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-slate-500 text-sm">Connecting...</div>
        </div>
      )}
    </div>
  );
}
