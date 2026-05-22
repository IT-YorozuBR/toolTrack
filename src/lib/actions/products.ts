"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getProducts() {
  return prisma.product.findMany({ orderBy: { code: "asc" } });
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      bomItems: { include: { tool: true } },
      forecasts: { orderBy: { referenceMonth: "desc" } },
    },
  });
}

export async function upsertProductWithBom(
  productId: string | null,
  data: { code: string; modelo?: string; description?: string },
  items: Array<{ toolId: string; quantityUsed: number }>
) {
  if (items.length === 0) {
    return { success: false, error: "Adicione ao menos uma ferramenta ao produto." };
  }
  for (const item of items) {
    if (item.quantityUsed <= 0) {
      return { success: false, error: "A quantidade de cada ferramenta deve ser maior que zero." };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      let id = productId;
      if (id) {
        await tx.product.update({ where: { id }, data });
      } else {
        const created = await tx.product.create({ data });
        id = created.id;
      }
      await tx.bomItem.deleteMany({ where: { productId: id! } });
      await tx.bomItem.createMany({
        data: items.map((item) => ({
          productId: id!,
          toolId: item.toolId,
          quantityUsed: item.quantityUsed,
        })),
      });
    });

    revalidatePath("/produtos");
    revalidatePath("/bom");
    revalidatePath("/controle-50k");
    return { success: true };
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2002") return { success: false, error: "Já existe um produto com este código." };
    return { success: false, error: "Erro ao salvar produto." };
  }
}

export async function createProduct(data: { code: string; modelo?: string; description?: string }) {
  try {
    const product = await prisma.product.create({ data });
    revalidatePath("/produtos");
    return { success: true, data: product };
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2002") return { success: false, error: "Já existe um produto com este código." };
    return { success: false, error: "Erro ao criar produto." };
  }
}

export async function updateProduct(
  id: string,
  data: { code?: string; modelo?: string; description?: string }
) {
  try {
    const product = await prisma.product.update({ where: { id }, data });
    revalidatePath("/produtos");
    return { success: true, data: product };
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2002") return { success: false, error: "Já existe um produto com este código." };
    return { success: false, error: "Erro ao atualizar produto." };
  }
}

/** Soft delete: marca active=false. */
export async function deactivateProduct(id: string) {
  try {
    await prisma.product.update({ where: { id }, data: { active: false } });
    revalidatePath("/produtos");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao desativar produto." };
  }
}

export async function toggleProductActive(id: string, active: boolean) {
  try {
    await prisma.product.update({ where: { id }, data: { active } });
    revalidatePath("/produtos");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao alterar status do produto." };
  }
}
