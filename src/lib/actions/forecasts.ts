"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getForecasts() {
  return prisma.productionForecast.findMany({ include: { product: true }, orderBy: [{ referenceMonth: "desc" }, { product: { code: "asc" } }] });
}

export async function createProductionForecast(data: { productId: string; referenceMonth: Date; plannedQuantity: number }) {
  try {
    const forecast = await prisma.productionForecast.create({ data, include: { product: true } });
    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    return { success: true, data: forecast };
  } catch {
    return { success: false, error: "Erro ao criar previsão de volume." };
  }
}

export async function updateProductionForecast(id: string, data: { plannedQuantity: number }) {
  try {
    const forecast = await prisma.productionForecast.update({ where: { id }, data, include: { product: true } });
    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    return { success: true, data: forecast };
  } catch {
    return { success: false, error: "Erro ao atualizar previsão de volume." };
  }
}

export async function deleteProductionForecast(id: string) {
  try {
    await prisma.productionForecast.delete({ where: { id } });
    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao excluir previsão de volume." };
  }
}
