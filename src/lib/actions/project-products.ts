"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addProductToProject(projectId: string, productId: string) {
  try {
    await prisma.projectProduct.create({ data: { projectId, productId } });
    revalidatePath("/projetos");
    return { success: true };
  } catch {
    return { success: false, error: "Produto já vinculado ao projeto ou erro ao vincular." };
  }
}

export async function removeProductFromProject(projectId: string, productId: string) {
  try {
    await prisma.projectProduct.deleteMany({ where: { projectId, productId } });
    revalidatePath("/projetos");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao remover produto do projeto." };
  }
}
