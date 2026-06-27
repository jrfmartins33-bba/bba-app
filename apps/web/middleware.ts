import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/tarefas", "/chat", "/onboarding", "/admin"];
const AUTH_ONLY = ["/login", "/cadastro"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = request.cookies.has("bba_auth");

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !authenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tarefas/:path*",
    "/chat/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
    "/login",
    "/cadastro"
  ]
};
