import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as XLSX from "xlsx";
import path from "path";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

function parseToolCode(code: string): { press: string; line: string | null } {
  const spaceIdx = code.indexOf(" ");
  if (spaceIdx !== -1) {
    return { press: code.slice(0, spaceIdx), line: code.slice(spaceIdx + 1) };
  }
  return { press: code, line: null };
}

async function main() {
  const filePath = path.resolve(__dirname, "../dadosferramental.xlsx");
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 });

  const headerRow = rows[2] as (string | null)[];
  const productCodes = headerRow.slice(3).filter((c): c is string => !!c);
  const dataRows = rows.slice(3) as (string | number | null)[][];

  const toolCodes = dataRows.map((r) => r[0]).filter((c): c is string => !!c);
  const toolIndexMap = new Map<string, number>();
  dataRows.forEach((r, i) => { if (r[0]) toolIndexMap.set(r[0] as string, i); });

  // Map product code → column index in headerRow
  const productColMap = new Map<string, number>();
  headerRow.forEach((code, idx) => { if (code && idx >= 3) productColMap.set(code, idx); });

  console.log(`Found ${toolCodes.length} tools, ${productCodes.length} products`);

  console.log("Cleaning up existing data...");
  await prisma.maintenanceRecord.deleteMany();
  await prisma.bomItem.deleteMany();
  await prisma.productionForecast.deleteMany();
  await prisma.tool.deleteMany();
  await prisma.product.deleteMany();

  console.log("Seeding tools...");
  const toolMap = new Map<string, string>(); // code → id

  for (const code of toolCodes) {
    if (toolMap.has(code)) continue; // skip duplicates
    const { press, line } = parseToolCode(code);
    const tool = await prisma.tool.upsert({
      where: { code },
      update: {},
      create: { code, press, line, shotsPerStroke: 1, currentStrokes: 0 },
    });
    toolMap.set(code, tool.id);
  }

  console.log("Seeding products...");
  const productMap = new Map<string, string>(); // code → id

  for (const code of productCodes) {
    const product = await prisma.product.upsert({
      where: { code },
      update: {},
      create: { code },
    });
    productMap.set(code, product.id);
  }

  console.log("Seeding BOM items...");
  let bomCount = 0;

  for (const [toolCode, rowIdx] of toolIndexMap) {
    const toolId = toolMap.get(toolCode);
    if (!toolId) continue;
    const row = dataRows[rowIdx];

    for (const [productCode, colIdx] of productColMap) {
      const qty = row[colIdx];
      if (qty && typeof qty === "number" && qty !== 0) {
        const productId = productMap.get(productCode);
        if (!productId) continue;
        await prisma.bomItem.upsert({
          where: { productId_toolId: { productId, toolId } },
          update: { quantityUsed: qty },
          create: { productId, toolId, quantityUsed: qty },
        });
        bomCount++;
      }
    }
  }

  console.log(`Seed completed: ${toolCodes.length} tools, ${productCodes.length} products, ${bomCount} BOM items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
