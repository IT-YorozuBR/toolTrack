"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createProject(data: { name: string; description?: string }) {
  try {
    const project = await prisma.project.create({ data });
    revalidatePath("/projetos");
    return { success: true, data: project };
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2002") return { success: false, error: "Já existe um projeto com este nome." };
    return { success: false, error: "Erro ao criar projeto." };
  }
}

export async function updateProject(
  id: string,
  data: { name?: string; description?: string },
) {
  try {
    const project = await prisma.project.update({ where: { id }, data });
    revalidatePath("/projetos");
    return { success: true, data: project };
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2002") return { success: false, error: "Já existe um projeto com este nome." };
    return { success: false, error: "Erro ao atualizar projeto." };
  }
}

export async function toggleProjectActive(id: string, active: boolean) {
  try {
    await prisma.project.update({ where: { id }, data: { active } });
    revalidatePath("/projetos");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao alterar status do projeto." };
  }
}
