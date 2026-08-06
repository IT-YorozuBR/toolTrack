"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export async function createProject(data: { name: string; description?: string }) {
  try {
    const project = await prisma.project.create({ data });
    await logAudit({ entity: "Project", entityId: project.id, action: "CREATE", summary: project.name, after: project });
    revalidatePath("/projetos");
    revalidatePath("/dashboard");
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
    const before = await prisma.project.findUnique({ where: { id } });
    const project = await prisma.project.update({ where: { id }, data });
    await logAudit({ entity: "Project", entityId: id, action: "UPDATE", summary: project.name, before, after: project });
    revalidatePath("/projetos");
    revalidatePath("/dashboard");
    return { success: true, data: project };
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2002") return { success: false, error: "Já existe um projeto com este nome." };
    return { success: false, error: "Erro ao atualizar projeto." };
  }
}

export async function toggleProjectActive(id: string, active: boolean) {
  try {
    const project = await prisma.project.update({ where: { id }, data: { active } });
    await logAudit({
      entity: "Project",
      entityId: id,
      action: "UPDATE",
      summary: `${project.name}: ${active ? "ativado" : "desativado"}`,
      after: project,
    });
    revalidatePath("/projetos");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao alterar status do projeto." };
  }
}
