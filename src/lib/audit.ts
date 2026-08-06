import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

/**
 * Grava uma entrada na trilha de auditoria (`/painel-alteracoes-k7q2j9`).
 * Nunca lança: uma falha ao gravar o log não pode derrubar a ação de domínio
 * que já foi concluída no banco.
 */
export async function logAudit(params: {
  entity: string;
  entityId: string;
  action: AuditAction;
  summary?: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await prisma.auditLog.create({
      data: {
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        summary: params.summary,
        before: toJson(params.before),
        after: toJson(params.after),
        ip,
      },
    });
  } catch {
    // não propaga — log de auditoria é best-effort
  }
}

function toJson(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
