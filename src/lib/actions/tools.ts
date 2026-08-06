"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function getTools() {
  return prisma.tool.findMany({ orderBy: { code: "asc" } });
}

export async function getTool(id: string) {
  return prisma.tool.findUnique({
    where: { id },
    include: {
      bomItems: { include: { product: true } },
      maintenanceRecords: { orderBy: { maintenanceDate: "desc" } },
    },
  });
}

export async function searchTools(query: string) {
  if (!query.trim()) return [];
  return prisma.tool.findMany({
    where: {
      active: true,
      OR: [
        { code: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { code: "asc" },
    take: 20,
  });
}

export async function createTool(data: {
  code: string;
  description?: string;
  press: string;
  line?: string;
  shotsPerStroke: number;
  currentStrokes?: number;
  preventiveLimit?: number;
  warningLimit?: number;
}) {
  try {
    const tool = await prisma.tool.create({ data });
    await logAudit({ entity: "Tool", entityId: tool.id, action: "CREATE", summary: tool.code, after: tool });
    revalidatePath("/ferramentais");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: tool };
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2002") return { success: false, error: "Já existe um ferramental com este código." };
    return { success: false, error: "Erro ao criar ferramental." };
  }
}

export async function updateTool(
  id: string,
  data: {
    code?: string;
    description?: string;
    press?: string;
    line?: string;
    shotsPerStroke?: number;
    currentStrokes?: number;
    preventiveLimit?: number;
    warningLimit?: number;
  }
) {
  try {
    const before = await prisma.tool.findUnique({ where: { id } });
    const tool = await prisma.tool.update({ where: { id }, data });
    await logAudit({ entity: "Tool", entityId: tool.id, action: "UPDATE", summary: tool.code, before, after: tool });
    revalidatePath("/ferramentais");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: tool };
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2002") return { success: false, error: "Já existe um ferramental com este código." };
    return { success: false, error: "Erro ao atualizar ferramental." };
  }
}

/** Soft delete: marks active=false. Ferramenta continua apontada nos BOM históricos. */
export async function deactivateTool(id: string) {
  try {
    const tool = await prisma.tool.update({ where: { id }, data: { active: false } });
    await logAudit({ entity: "Tool", entityId: id, action: "UPDATE", summary: `${tool.code}: desativado`, after: tool });
    revalidatePath("/ferramentais");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao desativar ferramental." };
  }
}

export async function toggleToolActive(id: string, active: boolean) {
  try {
    const tool = await prisma.tool.update({ where: { id }, data: { active } });
    await logAudit({
      entity: "Tool",
      entityId: id,
      action: "UPDATE",
      summary: `${tool.code}: ${active ? "ativado" : "desativado"}`,
      after: tool,
    });
    revalidatePath("/ferramentais");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao alterar status do ferramental." };
  }
}

/** Mesmo filtro usado na listagem de /ferramentais (código, prensa, linha, descrição). */
function buildToolSearchWhere(search: string) {
  const searchTerm = search.trim();
  return searchTerm
    ? {
        OR: [
          { code: { contains: searchTerm, mode: "insensitive" as const } },
          { press: { contains: searchTerm, mode: "insensitive" as const } },
          { line: { contains: searchTerm, mode: "insensitive" as const } },
          { description: { contains: searchTerm, mode: "insensitive" as const } },
        ],
      }
    : {};
}

/** Retorna todos os IDs que batem com a busca (sem paginação) — usado pelo "selecionar todos". */
export async function getToolIdsBySearch(search: string): Promise<string[]> {
  const tools = await prisma.tool.findMany({
    where: buildToolSearchWhere(search),
    select: { id: true },
  });
  return tools.map((t) => t.id);
}

export async function bulkSetToolsActive(ids: string[], active: boolean) {
  if (ids.length === 0) return { success: true };
  try {
    await prisma.tool.updateMany({ where: { id: { in: ids } }, data: { active } });
    await Promise.all(
      ids.map((id) =>
        logAudit({
          entity: "Tool",
          entityId: id,
          action: "UPDATE",
          summary: `alteração em massa: ${active ? "ativado" : "desativado"}`,
          after: { active },
        }),
      ),
    );
    revalidatePath("/ferramentais");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao alterar status dos ferramentais selecionados." };
  }
}
