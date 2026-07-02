import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import { ReadingToolGrid } from "./ReadingToolGrid";
import { ReadingForm } from "./ReadingForm";
import { ReadingList } from "./ReadingList";
import { IgnoreReadingsToggle } from "./IgnoreReadingsToggle";
import { BulkIgnoreReadingsToggle } from "./BulkIgnoreReadingsToggle";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function LeiturasPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; ferramenta?: string }>;
}) {
  const { search, page, ferramenta } = await searchParams;

  /* ── Vista de leituras de um ferramental ── */
  if (ferramenta) {
    const tool = await prisma.tool.findUnique({
      where: { id: ferramenta },
      select: {
        id: true,
        code: true,
        description: true,
        press: true,
        line: true,
        currentStrokes: true,
        ignoreManualReadings: true,
        strokeReadings: {
          orderBy: { readingDate: "desc" },
          select: {
            id: true,
            readingDate: true,
            cycleStrokes: true,
            notes: true,
          },
        },
      },
    });

    if (!tool) redirect("/leituras");

    const backParams = new URLSearchParams();
    if (page && page !== "1") backParams.set("page", page);
    if (search) backParams.set("search", search);
    const backUrl = `/leituras${backParams.size > 0 ? `?${backParams.toString()}` : ""}`;

    return (
      <div>
        <PageHeader
          title="Leituras de Batidas"
          description="Acúmulo real de batidas do ciclo atual deste ferramental"
        />
        <div className="mb-6 flex items-center gap-4">
          <a href={backUrl} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            ← Voltar
          </a>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{tool.code}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {[tool.description, tool.press, tool.line].filter(Boolean).join(" — ")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="max-w-xl space-y-6">
            <IgnoreReadingsToggle toolId={tool.id} initialIgnored={tool.ignoreManualReadings} />
            <ReadingForm
              defaultTool={{
                id: tool.id,
                code: tool.code,
                description: tool.description,
                currentStrokes: tool.currentStrokes,
              }}
            />
          </div>
          <ReadingList readings={tool.strokeReadings} />
        </div>
      </div>
    );
  }

  /* ── Vista de grade de ferramentais ── */
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const searchTerm = search?.trim() ?? "";

  const where = searchTerm
    ? {
        OR: [
          { code: { contains: searchTerm, mode: "insensitive" as const } },
          { description: { contains: searchTerm, mode: "insensitive" as const } },
        ],
      }
    : {};

  const allTools = await prisma.tool.findMany({
    where: { active: true, ...where },
    select: {
      id: true,
      code: true,
      description: true,
      press: true,
      _count: { select: { strokeReadings: true } },
      strokeReadings: {
        orderBy: { readingDate: "desc" },
        take: 1,
        select: { readingDate: true, cycleStrokes: true },
      },
    },
  });

  allTools.sort((a, b) => {
    const aDate = a.strokeReadings[0]?.readingDate ?? null;
    const bDate = b.strokeReadings[0]?.readingDate ?? null;
    if (aDate && bDate) return bDate.getTime() - aDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return a.code.localeCompare(b.code);
  });

  const total = allTools.length;
  const tools = allTools.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Contagens globais (independem da busca/paginação) para o controle "todos".
  const [activeTotal, ignoredCount] = await Promise.all([
    prisma.tool.count({ where: { active: true } }),
    prisma.tool.count({ where: { active: true, ignoreManualReadings: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Leituras de Batidas"
        description="Selecione um ferramental para registrar o acúmulo real de batidas e ver o histórico"
      />
      <BulkIgnoreReadingsToggle ignoredCount={ignoredCount} total={activeTotal} />
      <ReadingToolGrid
        tools={tools}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        search={searchTerm}
      />
    </div>
  );
}
