import { NextResponse } from "next/server";
import client from "prom-client";
import { prisma } from "@/lib/prisma";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const activeSessions = new client.Gauge({
  name: "clearline_active_sessions",
  help: "Number of currently active sessions",
  registers: [register],
});

const totalSessions = new client.Counter({
  name: "clearline_total_sessions_created",
  help: "Total number of sessions created",
  registers: [register],
});

export async function GET() {
  try {
    const activeCount = await prisma.session.count({
      where: { status: "active" },
    });
    activeSessions.set(activeCount);

    const metrics = await register.metrics();

    return new NextResponse(metrics, {
      headers: {
        "Content-Type": register.contentType,
      },
    });
  } catch {
    return NextResponse.json({ error: "Metrics unavailable" }, { status: 500 });
  }
}
