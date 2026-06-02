import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { ProjectManager } from "./ProjectManager";
import { ProjectGrid } from "./ProjectGrid";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; projeto?: string }>;
}) {
  const { page, search, projeto } = await searchParams;

  if (projeto) {
    const [project, allProducts] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projeto },
        include: {
          projectProducts: {
            include: { product: true },
            orderBy: { product: { code: "asc" } },
          },
        },
      }),
      prisma.product.findMany({
        where: { active: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, modelo: true, description: true },
      }),
    ]);

    if (!project) redirect("/projetos");

    const backParams = new URLSearchParams();
    if (page && page !== "1") backParams.set("page", page);
    if (search) backParams.set("search", search);
    const backUrl = `/projetos${backParams.size > 0 ? `?${backParams.toString()}` : ""}`;

    return (
      <div>
        <PageHeader
          title="Projetos"
          description="Produtos vinculados ao projeto selecionado"
        />
        <ProjectManager project={project} allProducts={allProducts} backUrl={backUrl} />
      </div>
    );
  }

  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const searchTerm = search?.trim() ?? "";

  const where = searchTerm
    ? {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" as const } },
          { description: { contains: searchTerm, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { projectProducts: true } } },
    }),
    prisma.project.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Selecione um projeto para gerenciar seus produtos"
        action={
          <Link
            href="/projetos/novo"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Novo Projeto
          </Link>
        }
      />
      <ProjectGrid
        projects={projects}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        search={searchTerm}
      />
    </div>
  );
}
