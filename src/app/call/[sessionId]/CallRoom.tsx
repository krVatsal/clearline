"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import PreJoinCheck from "@/components/PreJoinCheck";
import VideoTile from "@/components/VideoTile";
import ChatPanel from "@/components/ChatPanel";
import Controls from "@/components/Controls";
import ConnectionQuality from "@/components/ConnectionQuality";
import { useRouter } from "next/navigation";

interface Props {
  sessionId: string;
  role: "agent" | "customer";
  participantId: string;
  participantName: string;
  inviteToken: string | null;
}

interface RemoteStream {
  participantId: string;
  stream: MediaStream;
  kind: "audio" | "video";
  paused: boolean;
}

interface QualityStats {
  bitrate?: number;
  rtt?: number;
  packetLoss?: number;
}

export default function CallRoom({
  sessionId,
  role,
  participantId,
  participantName,
  inviteToken,
}: Props) {
  const router = useRouter();
  const [preJoinDone, setPreJoinDone] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerPaused, setPeerPaused] = useState<Map<string, { audio: boolean; video: boolean }>>(new Map());
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [qualityStats, setQualityStats] = useState<QualityStats>({});
  const [connected, setConnected] = useState(false);
  const [peerName, setPeerName] = useState<string | null>(null);

  const mediaSocketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const audioProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const videoProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const consumersRef = useRef<Map<string, mediasoupClient.types.Consumer>>(new Map());

  const authPayload = role === "agent"
    ? { agentUserId: participantId, sessionId, name: participantName }
    : { token: inviteToken, sessionId, name: participantName };

  const startMedia = useCallback(async (stream: MediaStream) => {
    setLocalStream(stream);
    const socket = io("/media", {
      auth: authPayload,
      transports: ["websocket"],
    });
    mediaSocketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("router:rtp-capabilities", async (rtpCapabilities) => {
      const device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      deviceRef.current = device;

      await createSendTransport(socket, device, stream);
      await createRecvTransport(socket, device);
    });

    socket.on("producer:new", async ({ producerId, participantId: peerId, kind }) => {
      if (peerId === participantId) return;
      await consumeProducer(socket, producerId, peerId, kind);
    });

    socket.on("peer:joined", ({ participantId: peerId, name }) => {
      setPeerName(name);
    });

    socket.on("peer:left", ({ participantId: peerId }) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    });

    socket.on("peer:producer:paused", ({ participantId: peerId, kind }) => {
      setPeerPaused((prev) => {
        const next = new Map(prev);
        const current = next.get(peerId) || { audio: false, video: false };
        next.set(peerId, { ...current, [kind]: true });
        return next;
      });
    });

    socket.on("peer:producer:resumed", ({ participantId: peerId, kind }) => {
      setPeerPaused((prev) => {
        const next = new Map(prev);
        const current = next.get(peerId) || { audio: false, video: false };
        next.set(peerId, { ...current, [kind]: false });
        return next;
      });
    });

    socket.on("recording:status", ({ status }) => {
      setRecording(status === "recording");
    });

    socket.on("session:ended", () => {
      setSessionEnded(true);
      setTimeout(() => router.push("/dashboard"), 3000);
    });

    socket.on("room:joined", async ({ existingProducers }) => {
      for (const { producerId, participantId: peerId, kind } of existingProducers) {
        if (peerId !== participantId) {
          await consumeProducer(socket, producerId, peerId, kind);
        }
      }
    });

    const statsInterval = setInterval(async () => {
      socket.emit("stats:request", {}, (stats: Record<string, unknown[]>) => {
        if (!stats) return;
        const values = Object.values(stats).flat() as Record<string, number>[];
        const rtt = values.find((s) => s.type === "remote-inbound-rtp")?.roundTripTime;
        const bitrate = values.find((s) => s.type === "outbound-rtp")?.bytesSent;
        if (rtt !== undefined || bitrate !== undefined) {
          setQualityStats({ rtt: rtt ? rtt * 1000 : undefined });
        }
      });
    }, 5000);

    return () => clearInterval(statsInterval);
  }, [sessionId, participantId, role]);

  async function createSendTransport(
    socket: Socket,
    device: mediasoupClient.Device,
    stream: MediaStream
  ) {
    socket.emit("transport:create", { direction: "send" }, async (params: mediasoupClient.types.TransportOptions & { transportId: string }) => {
      if ("error" in params) return;

      const transport = device.createSendTransport(params);
      sendTransportRef.current = transport;

      transport.on("connect", ({ dtlsParameters }, callback, errback) => {
        socket.emit("transport:connect", { transportId: params.transportId, dtlsParameters }, (res: { error?: string }) => {
          if (res?.error) errback(new Error(res.error));
          else callback();
        });
      });

      transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
        socket.emit("producer:create", { transportId: params.transportId, kind, rtpParameters, appData }, (res: { id?: string; error?: string }) => {
          if (res?.error) errback(new Error(res.error));
          else callback({ id: res.id! });
        });
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioProducerRef.current = await transport.produce({ track: audioTrack });
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoProducerRef.current = await transport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000 },
            { maxBitrate: 300000 },
            { maxBitrate: 900000 },
          ],
        });
      }
    });
  }

  async function createRecvTransport(socket: Socket, device: mediasoupClient.Device) {
    socket.emit("transport:create", { direction: "recv" }, (params: mediasoupClient.types.TransportOptions & { transportId: string }) => {
      if ("error" in params) return;

      const transport = device.createRecvTransport(params);
      recvTransportRef.current = transport;

      transport.on("connect", ({ dtlsParameters }, callback, errback) => {
        socket.emit("transport:connect", { transportId: params.transportId, dtlsParameters }, (res: { error?: string }) => {
          if (res?.error) errback(new Error(res.error));
          else callback();
        });
      });
    });
  }

  async function consumeProducer(socket: Socket, producerId: string, peerId: string, kind: string) {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!device || !recvTransport) return;

    socket.emit(
      "consumer:create",
      {
        transportId: (recvTransport as mediasoupClient.types.Transport & { id: string }).id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      },
      async (params: mediasoupClient.types.ConsumerOptions & { error?: string }) => {
        if (params.error) return;

        const consumer = await recvTransport.consume(params);
        consumersRef.current.set(`${peerId}_${producerId}`, consumer);

        const { track } = consumer;
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          const existing = next.get(peerId) || new MediaStream();
          existing.addTrack(track);
          next.set(peerId, existing);
          return next;
        });

        socket.emit("consumer:resume", { producerId }, () => {});
      }
    );
  }

  function toggleAudio() {
    const producer = audioProducerRef.current;
    const socket = mediaSocketRef.current;
    if (!producer || !socket) return;

    if (audioMuted) {
      producer.resume();
      socket.emit("producer:resume", { kind: "audio" });
    } else {
      producer.pause();
      socket.emit("producer:pause", { kind: "audio" });
    }
    setAudioMuted(!audioMuted);
  }

  function toggleVideo() {
    const producer = videoProducerRef.current;
    const socket = mediaSocketRef.current;
    if (!producer || !socket) return;

    if (videoOff) {
      producer.resume();
      socket.emit("producer:resume", { kind: "video" });
    } else {
      producer.pause();
      socket.emit("producer:pause", { kind: "video" });
    }
    setVideoOff(!videoOff);
  }

  function toggleRecording() {
    const socket = mediaSocketRef.current;
    if (!socket || role !== "agent") return;

    if (recording) {
      socket.emit("recording:stop", {}, () => {});
    } else {
      socket.emit("recording:start", {}, () => {});
    }
  }

  function endSession() {
    const socket = mediaSocketRef.current;
    if (!socket || role !== "agent") return;
    socket.emit("session:end", {}, () => {});
  }

  useEffect(() => {
    return () => {
      mediaSocketRef.current?.disconnect();
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📞</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Call Ended</h2>
          <p className="text-slate-400">Redirecting you back...</p>
        </div>
      </div>
    );
  }

  if (!preJoinDone) {
    return (
      <PreJoinCheck
        participantName={participantName}
        role={role}
        onJoin={(stream) => {
          setPreJoinDone(true);
          startMedia(stream);
        }}
      />
    );
  }

  const remoteEntries = Array.from(remoteStreams.entries());

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
          <span className="text-white font-medium text-sm">
            {peerName ? `Call with ${peerName}` : "Waiting for participant..."}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {recording && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              REC
            </div>
          )}
          <ConnectionQuality stats={qualityStats} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-4">
          <div className={`flex-1 grid gap-4 ${remoteEntries.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
            <VideoTile
              stream={localStream}
              name={participantName}
              isLocal={true}
              audioMuted={audioMuted}
              videoOff={videoOff}
            />
            {remoteEntries.map(([peerId, stream]) => {
              const paused = peerPaused.get(peerId);
              return (
                <VideoTile
                  key={peerId}
                  stream={stream}
                  name={peerName || "Participant"}
                  isLocal={false}
                  audioMuted={paused?.audio || false}
                  videoOff={paused?.video || false}
                />
              );
            })}
          </div>

          <Controls
            audioMuted={audioMuted}
            videoOff={videoOff}
            recording={recording}
            role={role}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleRecording={toggleRecording}
            onEndCall={endSession}
          />
        </div>

        <div className="w-80 border-l border-white/10">
          <ChatPanel
            sessionId={sessionId}
            participantId={participantId}
            participantName={participantName}
            role={role}
            inviteToken={inviteToken}
          />
        </div>
      </div>
    </div>
  );
}
