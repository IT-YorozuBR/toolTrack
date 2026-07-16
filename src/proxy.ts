import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const payload = {
    path: request.nextUrl.pathname + request.nextUrl.search,
    ip,
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
  };

  event.waitUntil(
    fetch(new URL("/api/access-log", request.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {})
  );

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
