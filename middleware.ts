import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith("/api/sessions") || pathname.startsWith("/api/goals");
  if (!isProtected) return NextResponse.next();
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/api/sessions/:path*", "/api/goals/:path*"],
};
