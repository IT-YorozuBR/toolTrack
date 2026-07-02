"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getStrokeReadings(toolId: string) {
  return prisma.toolStrokeReading.findMany({
    where: { toolId },
    orderBy: { readingDate: "desc" },
  });
}

export async function createStrokeReading(data: {
  toolId: string;
  readingDate: Date;
  cycleStrokes: number;
  notes?: string;
}) {
  try {
    if (!Number.isFinite(data.cycleStrokes) || data.cycleStrokes < 0) {
      return { success: false, error: "Acúmulo de batidas inválido." };
    }

    const record = await prisma.toolStrokeReading.create({
      data: {
        toolId: data.toolId,
        readingDate: data.readingDate,
        cycleStrokes: data.cycleStrokes,
        notes: data.notes,
      },
    });

    revalidatePath("/leituras");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true, data: record };
  } catch {
    return { success: false, error: "Erro ao registrar leitura de batidas." };
  }
}

// Liga/desliga o uso das leituras manuais deste ferramental no Controle 50K.
// Não exclui nenhuma leitura — apenas marca para serem desconsideradas na projeção.
export async function setIgnoreManualReadings(toolId: string, ignore: boolean) {
  try {
    await prisma.tool.update({
      where: { id: toolId },
      data: { ignoreManualReadings: ignore },
    });
    revalidatePath("/leituras");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao atualizar configuração das leituras." };
  }
}

// Aplica o "desconsiderar leituras" a TODOS os ferramentais ativos de uma vez.
// Não exclui nenhuma leitura — só liga/desliga o uso delas na projeção.
export async function setAllIgnoreManualReadings(ignore: boolean) {
  try {
    await prisma.tool.updateMany({
      where: { active: true },
      data: { ignoreManualReadings: ignore },
    });
    revalidatePath("/leituras");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao atualizar os ferramentais." };
  }
}

export async function deleteStrokeReading(id: string) {
  try {
    await prisma.toolStrokeReading.delete({ where: { id } });
    revalidatePath("/leituras");
    revalidatePath("/controle-50k");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao excluir leitura." };
  }
}
