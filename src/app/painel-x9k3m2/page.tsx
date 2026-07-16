import { notFound } from "next/navigation";
import dns from "node:dns/promises";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ADMIN_KEY = process.env.ACCESS_LOG_ADMIN_KEY || "prensa50k-acessos";

async function resolveHostname(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 1500)
    );
    const [hostname] = await Promise.race([dns.reverse(ip), timeout]);
    return hostname ?? null;
  } catch {
    return null;
  }
}

export default async function AccessLogPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (key !== ADMIN_KEY) {
    notFound();
  }

  const logs = await prisma.accessLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const uniqueIps = Array.from(new Set(logs.map((l) => l.ip).filter((ip): ip is string => !!ip)));
  const hostnames = new Map<string, string | null>();
  await Promise.all(
    uniqueIps.map(async (ip) => {
      hostnames.set(ip, await resolveHostname(ip));
    })
  );

  return (
    <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13 }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>
        Registro de acessos (últimos {logs.length})
      </h1>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #888" }}>
            <th style={{ padding: "4px 8px" }}>Data/hora</th>
            <th style={{ padding: "4px 8px" }}>IP</th>
            <th style={{ padding: "4px 8px" }}>Host</th>
            <th style={{ padding: "4px 8px" }}>Página</th>
            <th style={{ padding: "4px 8px" }}>Navegador</th>
            <th style={{ padding: "4px 8px" }}>Referer</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} style={{ borderBottom: "1px solid #333" }}>
              <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                {log.createdAt.toLocaleString("pt-BR")}
              </td>
              <td style={{ padding: "4px 8px" }}>{log.ip ?? "-"}</td>
              <td style={{ padding: "4px 8px" }}>{(log.ip && hostnames.get(log.ip)) || "-"}</td>
              <td style={{ padding: "4px 8px" }}>{log.path}</td>
              <td style={{ padding: "4px 8px", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
                {log.userAgent ?? "-"}
              </td>
              <td style={{ padding: "4px 8px" }}>{log.referer ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
