import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyInviteToken } from "@/lib/jwt";
import CallRoom from "./CallRoom";

export default async function CallPage({
  params,
  searchParams,
}: {
  params: { sessionId: string };
  searchParams: { token?: string };
}) {
  const { sessionId } = params;

  const agentSession = await getServerSession(authOptions);

  if (agentSession) {
    const callSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!callSession || callSession.status === "ended") {
      redirect("/dashboard");
    }

    return (
      <CallRoom
        sessionId={sessionId}
        role="agent"
        participantId={agentSession.user.id}
        participantName={agentSession.user.name || "Agent"}
        inviteToken={null}
      />
    );
  }

  const cookieStore = cookies();
  const customerCookie = cookieStore.get(`customer_session_${sessionId}`);
  const token = customerCookie?.value || searchParams.token;

  if (!token) {
    redirect("/invalid-invite");
  }

  const payload = verifyInviteToken(token);
  if (!payload || payload.sessionId !== sessionId) {
    redirect("/invalid-invite");
  }

  const callSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { agent: { select: { name: true } } },
  });

  if (!callSession || callSession.status === "ended") {
    redirect("/invalid-invite");
  }

  return (
    <CallRoom
      sessionId={sessionId}
      role="customer"
      participantId={`customer_${Date.now()}`}
      participantName={callSession.customer_name || "Customer"}
      inviteToken={token}
    />
  );
}
