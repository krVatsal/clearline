"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Phone, AlertCircle } from "lucide-react";

interface Props {
  participantName: string;
  role: "agent" | "customer";
  onJoin: (stream: MediaStream) => void;
}

export default function PreJoinCheck({ participantName, role, onJoin }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"permission" | "busy" | "other" | null>(null);
  const [devices, setDevices] = useState<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({ cameras: [], mics: [] });

  useEffect(() => {
    requestMedia();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function requestMedia(audioOnly = false) {
    setError(null);
    setErrorKind(null);
    try {
      const constraints = audioOnly
        ? { video: false, audio: true }
        : { video: true, audio: true };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      if (audioOnly) setVideoEnabled(false);
      if (videoRef.current) videoRef.current.srcObject = s;

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        cameras: allDevices.filter((d) => d.kind === "videoinput"),
        mics: allDevices.filter((d) => d.kind === "audioinput"),
      });
    } catch (err: unknown) {
      const name = (err as { name?: string }).name;
      if (name === "NotReadableError" || name === "TrackStartError") {
        setErrorKind("busy");
        setError("Camera is in use by another app or browser tab.");
      } else if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setErrorKind("permission");
        setError("Camera/microphone permission denied. Allow access in browser settings.");
      } else {
        setErrorKind("other");
        setError("Could not access camera/microphone.");
      }
    }
  }

  function toggleAudio() {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !audioEnabled));
    setAudioEnabled(!audioEnabled);
  }

  function toggleVideo() {
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = !videoEnabled));
    setVideoEnabled(!videoEnabled);
  }

  function handleJoin() {
    if (!stream) return;
    onJoin(stream);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Ready to join?</h1>
          <p className="text-slate-400 mt-1">
            Check your camera and microphone before joining the call
          </p>
        </div>

        <div className="bg-slate-800 rounded-2xl overflow-hidden mb-6 aspect-video relative">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-red-400 text-sm max-w-xs">{error}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => requestMedia()}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                >
                  Retry
                </button>
                {errorKind === "busy" && (
                  <button
                    onClick={() => requestMedia(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                  >
                    Join audio-only
                  </button>
                )}
              </div>
              {errorKind === "busy" && (
                <p className="text-xs text-slate-500 max-w-xs">
                  Close the other browser tab using the camera, then retry.
                </p>
              )}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${!videoEnabled ? "opacity-0" : ""}`}
              />
              {!videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-700">
                  <div className="w-20 h-20 rounded-full bg-slate-600 flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {participantName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <button
                  onClick={toggleAudio}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    audioEnabled ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 text-white"
                  }`}
                >
                  {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    videoEnabled ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 text-white"
                  }`}
                >
                  {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">{participantName}</p>
            <p className="text-slate-400 text-sm capitalize">{role}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              {audioEnabled ? (
                <Mic className="w-4 h-4 text-green-400" />
              ) : (
                <MicOff className="w-4 h-4 text-red-400" />
              )}
              {videoEnabled ? (
                <Video className="w-4 h-4 text-green-400" />
              ) : (
                <VideoOff className="w-4 h-4 text-red-400" />
              )}
            </div>
            <button
              onClick={handleJoin}
              disabled={!stream}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
            >
              <Phone className="w-4 h-4" />
              Join Call
            </button>
          </div>
        </div>

        {devices.cameras.length > 0 && (
          <div className="mt-4 text-xs text-slate-500 text-center">
            {devices.cameras.length} camera{devices.cameras.length > 1 ? "s" : ""} · {devices.mics.length} microphone{devices.mics.length > 1 ? "s" : ""} detected
          </div>
        )}
      </div>
    </div>
  );
}
