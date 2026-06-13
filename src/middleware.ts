import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (pathname.startsWith("/admin") && token.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/call/")) {
    const sessionId = pathname.split("/call/")[1]?.split("?")[0];
    const inviteToken = request.nextUrl.searchParams.get("token");
    const customerCookie = request.cookies.get(`customer_session_${sessionId}`);

    const agentToken = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (agentToken) {
      return NextResponse.next();
    }

    if (customerCookie) {
      return NextResponse.next();
    }

    if (inviteToken) {
      const response = NextResponse.next();
      response.cookies.set(`customer_session_${sessionId}`, inviteToken, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
      return response;
    }

    return NextResponse.redirect(new URL("/invalid-invite", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/call/:path*"],
};
