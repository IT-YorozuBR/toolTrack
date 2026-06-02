/* eslint-disable */
// Seed de manutenções a partir de maintainData_seed_data_sem_vazios.json
require("dotenv/config");
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");
const data = require("../maintainData_seed_data_sem_vazios.json");

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const entries = data.maintainData;

  // Buscar todos os ferramentais de uma vez
  const tools = await prisma.tool.findMany({ select: { id: true, code: true } });
  const toolByCode = new Map(tools.map((t) => [t.code.trim().toLowerCase(), t]));

  let created = 0;
  let skipped = 0;
  const notFound = [];

  for (const entry of entries) {
    const code = entry.item.trim();
    const tool = toolByCode.get(code.toLowerCase());

    if (!tool) {
      notFound.push(code);
      skipped++;
      continue;
    }

    const [year, month, day] = entry.maintainDate.split("-").map(Number);
    const maintenanceDate = new Date(year, month - 1, day, 12, 0, 0);

    await prisma.maintenanceRecord.create({
      data: {
        toolId: tool.id,
        maintenanceDate,
        strokesAtMaintenance: 0,
        maintenanceType: "Preventiva",
        resetCounter: true,
        notes: "Importado via seed",
      },
    });

    created++;
    console.log(`  ✓ ${code} — ${entry.maintainDate}`);
  }

  await prisma.$disconnect();
  await pool.end();

  console.log(`\n✅ Criados: ${created} | Pulados (não encontrado): ${skipped}`);
  if (notFound.length > 0) {
    console.log(`\n⚠️  Ferramentais não encontrados no banco (${notFound.length}):`);
    notFound.forEach((c) => console.log(`   - ${c}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
