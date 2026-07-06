"use server";
import { prisma } from "@/lib/prisma";

export type ProjectDemandToolRow = {
  bomItemId: string;
  toolId: string;
  toolCode: string;
  quantityUsed: number;
  // Cavidade da ferramenta (Tool.shotsPerStroke) — quantas pecas ela produz por
  // batida. Campo DIFERENTE de quantityUsed (que fica no BomItem, nao no Tool):
  // quantityUsed MULTIPLICA o calculo, shotsPerStroke DIVIDE. Mostrar os dois juntos
  // aqui deixa visivel quando uma ferramenta tem os dois setados de forma suspeita
  // (ex.: quantityUsed=2 com shotsPerStroke ainda em 1).
  shotsPerStroke: number;
  // monthKey ("YYYY-MM") -> quantidade sobrescrita para este par Produto+Ferramenta
  overrides: Record<string, number>;
};

export type ProjectDemandProductRow = {
  productId: string;
  productCode: string;
  tools: ProjectDemandToolRow[];
};

// Projetos que tem, em algum produto do BOM, uma ferramenta cujo codigo bate com o
// termo buscado. Usado para abrir a arvore inteira (Projeto -> Produto -> Ferramenta)
// direto na ferramenta pesquisada, sem precisar expandir projeto por projeto.
export async function findProjectsWithTool(searchTerm: string): Promise<string[]> {
  const term = searchTerm.trim();
  if (!term) return [];

  const bomItems = await prisma.bomItem.findMany({
    where: { tool: { code: { contains: term, mode: "insensitive" } } },
    select: {
      product: {
        select: {
          projectProducts: { select: { projectId: true } },
        },
      },
    },
  });

  const projectIds = new Set<string>();
  for (const bomItem of bomItems) {
    for (const pp of bomItem.product.projectProducts) {
      projectIds.add(pp.projectId);
    }
  }
  return [...projectIds];
}

// Arvore Produto -> Ferramenta (BOM) de um Projeto, com os overrides existentes na
// janela de meses informada. Usada para abrir a linha do projeto em /volumes e
// mostrar/editar a demanda herdada por ferramenta.
export async function getProjectDemandTree(
  projectId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<ProjectDemandProductRow[]> {
  const products = await prisma.product.findMany({
    where: { active: true, projectProducts: { some: { projectId } } },
    include: {
      bomItems: {
        include: {
          tool: { select: { id: true, code: true, shotsPerStroke: true } },
          overrides: { where: { referenceMonth: { gte: windowStart, lt: windowEnd } } },
        },
        orderBy: { tool: { code: "asc" } },
      },
    },
    orderBy: { code: "asc" },
  });

  return products.map((p) => ({
    productId: p.id,
    productCode: p.code,
    tools: p.bomItems.map((bi) => ({
      bomItemId: bi.id,
      toolId: bi.tool.id,
      toolCode: bi.tool.code,
      quantityUsed: bi.quantityUsed,
      shotsPerStroke: bi.tool.shotsPerStroke,
      overrides: Object.fromEntries(
        bi.overrides.map((o) => [
          `${o.referenceMonth.getFullYear()}-${String(o.referenceMonth.getMonth() + 1).padStart(2, "0")}`,
          o.plannedQuantity,
        ]),
      ),
    })),
  }));
}
