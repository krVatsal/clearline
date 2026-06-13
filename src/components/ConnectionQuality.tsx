"use client";

import { Wifi } from "lucide-react";

interface Props {
  stats: {
    bitrate?: number;
    rtt?: number;
    packetLoss?: number;
  };
}

export default function ConnectionQuality({ stats }: Props) {
  const rtt = stats.rtt;

  let quality: "good" | "fair" | "poor" = "good";
  let color = "text-green-400";
  let label = "Good";

  if (rtt !== undefined) {
    if (rtt > 200) {
      quality = "poor";
      color = "text-red-400";
      label = "Poor";
    } else if (rtt > 100) {
      quality = "fair";
      color = "text-yellow-400";
      label = "Fair";
    }
  }

  const bars = [1, 2, 3];

  return (
    <div className={`flex items-center gap-1.5 text-xs ${color}`} title={rtt ? `RTT: ${Math.round(rtt)}ms` : "Connection quality"}>
      <div className="flex items-end gap-0.5 h-4">
        {bars.map((bar) => {
          const active =
            (quality === "good") ||
            (quality === "fair" && bar <= 2) ||
            (quality === "poor" && bar <= 1);
          return (
            <div
              key={bar}
              className={`w-1 rounded-sm transition-colors ${
                active ? color.replace("text-", "bg-") : "bg-slate-600"
              }`}
              style={{ height: `${bar * 4 + 4}px` }}
            />
          );
        })}
      </div>
      <span className="hidden md:inline">{label}</span>
      {rtt !== undefined && (
        <span className="text-slate-500 hidden md:inline">{Math.round(rtt)}ms</span>
      )}
    </div>
  );
}
