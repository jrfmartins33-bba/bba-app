import { NextResponse, type NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tarefas/:path*",
    "/chat/:path*",
    "/onboarding/:path*",
    "/admin/:path*"
  ]
};
