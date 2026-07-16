import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.path !== "string") {
    return new Response(null, { status: 400 });
  }

  await prisma.accessLog.create({
    data: {
      path: body.path.slice(0, 2048),
      ip: typeof body.ip === "string" ? body.ip.slice(0, 100) : null,
      userAgent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 500) : null,
      referer: typeof body.referer === "string" ? body.referer.slice(0, 2048) : null,
    },
  });

  return new Response(null, { status: 204 });
}
