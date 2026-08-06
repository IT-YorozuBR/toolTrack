"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function getBomItems() {
  return prisma.bomItem.findMany({ include: { product: true, tool: true }, orderBy: [{ product: { code: "asc" } }, { tool: { code: "asc" } }] });
}

export async function createBomItem(data: { productId: string; toolId: string; quantityUsed: number }) {
  try {
    const item = await prisma.bomItem.create({ data, include: { product: true, tool: true } });
    await logAudit({
      entity: "BomItem",
      entityId: item.id,
      action: "CREATE",
      summary: `${item.product.code} ↔ ${item.tool.code} (qtd ${item.quantityUsed})`,
      after: item,
    });
    revalidatePath("/bom");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: item };
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2002") return { success: false, error: "Este produto já possui este ferramental no BOM." };
    return { success: false, error: "Erro ao criar item do BOM." };
  }
}

export async function updateBomItem(id: string, data: { quantityUsed: number }) {
  try {
    const before = await prisma.bomItem.findUnique({ where: { id }, include: { product: true, tool: true } });
    const item = await prisma.bomItem.update({ where: { id }, data, include: { product: true, tool: true } });
    await logAudit({
      entity: "BomItem",
      entityId: id,
      action: "UPDATE",
      summary: `${item.product.code} ↔ ${item.tool.code} (qtd ${before?.quantityUsed} → ${item.quantityUsed})`,
      before,
      after: item,
    });
    revalidatePath("/bom");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: item };
  } catch {
    return { success: false, error: "Erro ao atualizar item do BOM." };
  }
}

export async function deleteBomItem(id: string) {
  try {
    const before = await prisma.bomItem.findUnique({ where: { id }, include: { product: true, tool: true } });
    await prisma.bomItem.delete({ where: { id } });
    await logAudit({
      entity: "BomItem",
      entityId: id,
      action: "DELETE",
      summary: before ? `${before.product.code} ↔ ${before.tool.code}` : undefined,
      before,
    });
    revalidatePath("/bom");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao excluir item do BOM." };
  }
}
