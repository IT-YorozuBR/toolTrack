"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
    const tool = await prisma.tool.update({ where: { id }, data });
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
    await prisma.tool.update({ where: { id }, data: { active: false } });
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
    await prisma.tool.update({ where: { id }, data: { active } });
    revalidatePath("/ferramentais");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao alterar status do ferramental." };
  }
}
