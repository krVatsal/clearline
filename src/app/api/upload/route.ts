import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyInviteToken } from "@/lib/jwt";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

// ── Allowlist: extension → allowed MIME prefixes ──────────────────────────────
const ALLOWED: Record<string, string[]> = {
  ".jpg":  ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png":  ["image/png"],
  ".gif":  ["image/gif"],
  ".webp": ["image/webp"],
  ".svg":  ["image/svg+xml"],
  ".pdf":  ["application/pdf"],
  ".txt":  ["text/plain"],
  ".csv":  ["text/csv", "text/plain", "application/csv"],
  ".md":   ["text/plain", "text/markdown"],
  ".doc":  ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls":  ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".ppt":  ["application/vnd.ms-powerpoint"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".zip":  ["application/zip", "application/x-zip-compressed"],
  ".mp4":  ["video/mp4"],
  ".mp3":  ["audio/mpeg"],
  ".webm": ["video/webm", "audio/webm"],
};

// ── Rate limiter: max 10 uploads per IP per 60s (in-memory) ──────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const agentSession = await getServerSession(authOptions);
  const inviteToken = req.headers.get("x-invite-token");
  const tokenValid = inviteToken ? verifyInviteToken(inviteToken) !== null : false;

  if (!agentSession && !tokenValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many uploads. Try again in a minute." },
      { status: 429 }
    );
  }

  // ── File validation ─────────────────────────────────────────────────────────
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
  if (file.size === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });

  // Extension check
  const safeName = path.basename(file.name);
  const ext = path.extname(safeName).toLowerCase();
  const allowedMimes = ALLOWED[ext];

  if (!ext || !allowedMimes) {
    return NextResponse.json(
      { error: `File type not allowed. Allowed: images, pdf, office docs, zip, mp4, mp3, webm` },
      { status: 415 }
    );
  }

  // MIME type cross-check (client-reported, belt-and-suspenders)
  const clientMime = file.type.split(";")[0].trim().toLowerCase();
  if (clientMime && !allowedMimes.some((m) => clientMime === m || clientMime.startsWith(m))) {
    return NextResponse.json(
      { error: `MIME type "${clientMime}" does not match extension "${ext}"` },
      { status: 415 }
    );
  }

  // ── Write file ──────────────────────────────────────────────────────────────
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${randomUUID()}${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    name: safeName,
    size: file.size,
    type: file.type,
  });
}
