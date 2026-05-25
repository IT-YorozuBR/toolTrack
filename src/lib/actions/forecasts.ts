"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function upsertProductionForecast(data: {
  productId: string;
  referenceMonth: Date;
  plannedQuantity: number;
}) {
  try {
    const d = data.referenceMonth;
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    const existing = await prisma.productionForecast.findFirst({
      where: { productId: data.productId, referenceMonth: { gte: monthStart, lt: monthEnd } },
    });

    if (existing) {
      if (data.plannedQuantity <= 0) {
        await prisma.productionForecast.delete({ where: { id: existing.id } });
      } else {
        await prisma.productionForecast.update({
          where: { id: existing.id },
          data: { plannedQuantity: data.plannedQuantity },
        });
      }
    } else if (data.plannedQuantity > 0) {
      await prisma.productionForecast.create({
        data: { productId: data.productId, referenceMonth: monthStart, plannedQuantity: data.plannedQuantity },
      });
    }

    revalidatePath("/volumes");
    revalidatePath("/controle-50k");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao salvar volume." };
  }
}

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
