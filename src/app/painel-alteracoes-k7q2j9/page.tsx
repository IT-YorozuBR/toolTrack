import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const ADMIN_KEY = process.env.AUDIT_LOG_ADMIN_KEY || "prensa50k-alteracoes";

const ACTION_LABEL: Record<string, string> = {
  CREATE: "criação",
  UPDATE: "edição",
  DELETE: "exclusão",
};

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value, null, 2);
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; entity?: string; action?: string }>;
}) {
  const { key, entity, action } = await searchParams;
  if (key !== ADMIN_KEY) {
    notFound();
  }

  const where: Prisma.AuditLogWhereInput = {};
  if (entity) where.entity = entity;
  if (action) where.action = action;

  const [logs, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.auditLog.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    }),
  ]);

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    params.set("key", key);
    const merged = { entity, action, ...overrides };
    if (merged.entity) params.set("entity", merged.entity);
    if (merged.action) params.set("action", merged.action);
    return `?${params.toString()}`;
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13 }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>
        Log de alterações do sistema (últimos {logs.length})
      </h1>

      <div style={{ marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div>
          Entidade:{" "}
          <a href={qs({ entity: undefined })} style={{ marginRight: 8, fontWeight: !entity ? "bold" : "normal" }}>
            todas
          </a>
          {entities.map((e) => (
            <a
              key={e.entity}
              href={qs({ entity: e.entity })}
              style={{ marginRight: 8, fontWeight: entity === e.entity ? "bold" : "normal" }}
            >
              {e.entity}
            </a>
          ))}
        </div>
        <div>
          Ação:{" "}
          <a href={qs({ action: undefined })} style={{ marginRight: 8, fontWeight: !action ? "bold" : "normal" }}>
            todas
          </a>
          {Object.entries(ACTION_LABEL).map(([value, label]) => (
            <a
              key={value}
              href={qs({ action: value })}
              style={{ marginRight: 8, fontWeight: action === value ? "bold" : "normal" }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #888" }}>
            <th style={{ padding: "4px 8px" }}>Data/hora</th>
            <th style={{ padding: "4px 8px" }}>Entidade</th>
            <th style={{ padding: "4px 8px" }}>Ação</th>
            <th style={{ padding: "4px 8px" }}>Resumo</th>
            <th style={{ padding: "4px 8px" }}>IP</th>
            <th style={{ padding: "4px 8px" }}>Antes → Depois</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} style={{ borderBottom: "1px solid #333", verticalAlign: "top" }}>
              <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                {log.createdAt.toLocaleString("pt-BR")}
              </td>
              <td style={{ padding: "4px 8px" }}>
                {log.entity}
                <br />
                <span style={{ opacity: 0.6, fontSize: 11 }}>{log.entityId}</span>
              </td>
              <td style={{ padding: "4px 8px" }}>{ACTION_LABEL[log.action] ?? log.action}</td>
              <td style={{ padding: "4px 8px", maxWidth: 260 }}>{log.summary ?? "-"}</td>
              <td style={{ padding: "4px 8px" }}>{log.ip ?? "-"}</td>
              <td style={{ padding: "4px 8px", maxWidth: 480 }}>
                <details>
                  <summary style={{ cursor: "pointer" }}>ver dados</summary>
                  <div style={{ display: "flex", gap: 8 }}>
                    <pre style={{ whiteSpace: "pre-wrap", maxWidth: 230, overflow: "auto", background: "#111", color: "#eee", padding: 4 }}>
                      {formatJson(log.before)}
                    </pre>
                    <pre style={{ whiteSpace: "pre-wrap", maxWidth: 230, overflow: "auto", background: "#111", color: "#eee", padding: 4 }}>
                      {formatJson(log.after)}
                    </pre>
                  </div>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
