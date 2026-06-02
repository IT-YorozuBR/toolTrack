import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { BomManager } from "./BomManager";
import { ProductGrid } from "./ProductGrid";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function BomPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; produto?: string; back?: string }>;
}) {
  const { page, search, produto, back } = await searchParams;

  /* ── Vista de ferramentas de um produto ── */
  if (produto) {
    const [product, allTools] = await Promise.all([
      prisma.product.findUnique({
        where: { id: produto },
        include: {
          bomItems: {
            include: { tool: true },
            orderBy: { tool: { code: "asc" } },
          },
        },
      }),
      prisma.tool.findMany({
        where: { active: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, description: true, shotsPerStroke: true },
      }),
    ]);

    if (!product) redirect("/bom");

    let backUrl: string;
    if (back) {
      backUrl = decodeURIComponent(back);
    } else {
      const backParams = new URLSearchParams();
      if (page && page !== "1") backParams.set("page", page);
      if (search) backParams.set("search", search);
      backUrl = `/bom${backParams.size > 0 ? `?${backParams.toString()}` : ""}`;
    }

    return (
      <div>
        <PageHeader
          title="BOM — Lista de Materiais"
          description="Ferramentas do produto selecionado"
        />
        <BomManager product={product} allTools={allTools} backUrl={backUrl} />
      </div>
    );
  }

  /* ── Vista de grade de produtos ── */
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const searchTerm = search?.trim() ?? "";

  const where = {
    ...(searchTerm
      ? {
          OR: [
            { code: { contains: searchTerm, mode: "insensitive" as const } },
            { modelo: { contains: searchTerm, mode: "insensitive" as const } },
            { description: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { code: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { bomItems: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="BOM — Lista de Materiais"
        description="Selecione um produto para gerenciar suas ferramentas"
      />
      <ProductGrid
        products={products}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        search={searchTerm}
      />
    </div>
  );
}
