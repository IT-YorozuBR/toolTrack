import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import fs from "fs";
import path from "path";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

// ─── Seed de leituras de batidas (Acúmulo Real) a partir de MAI26_seed_data.json ───
// Para cada ferramenta (casada pelo code), grava uma ToolStrokeReading com o acúmulo real:
//   - qtySumReal quando preenchido; senão, qtySum.
// A data de manutenção do arquivo NÃO é usada (manutenções já estão cadastradas);
// a leitura é registrada com a data de hoje.
// Idempotente: remove leituras anteriores deste seed (notes = SEED_TAG) antes de recriar.

const SEED_TAG = "seed:MAI26";

type SeedRow = {
  item: string;
  maintainDate: string | null;
  qtySum: number | null;
  qtySumReal: number | null;
  nMinus1: number;
  n: number;
  nPlus1: number;
};

async function main() {
  const filePath = path.resolve(__dirname, "../MAI26_seed_data.json");
  const rows = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SeedRow[];

  const now = new Date();
  const readingDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  // Limpa leituras criadas por este seed para tornar a reexecução idempotente.
  const removed = await prisma.toolStrokeReading.deleteMany({ where: { notes: SEED_TAG } });

  let created = 0;
  const notFound: string[] = [];
  const skippedNoValue: string[] = [];

  for (const row of rows) {
    const code = row.item?.trim();
    if (!code) continue;

    const value = row.qtySumReal ?? row.qtySum;
    if (value == null || !Number.isFinite(value)) {
      skippedNoValue.push(code);
      continue;
    }

    const tool = await prisma.tool.findUnique({ where: { code }, select: { id: true } });
    if (!tool) {
      notFound.push(code);
      continue;
    }

    await prisma.toolStrokeReading.create({
      data: {
        toolId: tool.id,
        readingDate,
        cycleStrokes: Math.round(value),
        notes: SEED_TAG,
      },
    });
    created++;
  }

  console.log(`\nSeed MAI26 (leituras de batidas) concluído:`);
  console.log(`  Leituras anteriores removidas (${SEED_TAG}): ${removed.count}`);
  console.log(`  Leituras criadas: ${created} de ${rows.length} itens`);
  console.log(`  Data da leitura: ${readingDate.toLocaleDateString("pt-BR")}`);
  if (skippedNoValue.length) {
    console.log(`  Sem valor (qtySum e qtySumReal nulos) — ignorados: ${skippedNoValue.length}`);
    console.log(`    ${skippedNoValue.join(", ")}`);
  }
  if (notFound.length) {
    console.log(`  Ferramentas não encontradas pelo code: ${notFound.length}`);
    console.log(`    ${notFound.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
