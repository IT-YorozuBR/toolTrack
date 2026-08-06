"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function addProductToProject(projectId: string, productId: string) {
  try {
    const link = await prisma.projectProduct.create({ data: { projectId, productId } });
    await logAudit({
      entity: "ProjectProduct",
      entityId: link.id,
      action: "CREATE",
      summary: `projeto ${projectId} ↔ produto ${productId}`,
      after: link,
    });
    revalidatePath("/projetos");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Produto já vinculado ao projeto ou erro ao vincular." };
  }
}

export async function removeProductFromProject(projectId: string, productId: string) {
  try {
    const before = await prisma.projectProduct.findFirst({ where: { projectId, productId } });
    await prisma.projectProduct.deleteMany({ where: { projectId, productId } });
    if (before) {
      await logAudit({
        entity: "ProjectProduct",
        entityId: before.id,
        action: "DELETE",
        summary: `projeto ${projectId} ↔ produto ${productId}`,
        before,
      });
    }
    revalidatePath("/projetos");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao remover produto do projeto." };
  }
}
