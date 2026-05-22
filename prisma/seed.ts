import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Reference months: current, +1, +2
  const month0 = new Date(currentYear, currentMonth, 1);
  const month1 = new Date(currentYear, currentMonth + 1, 1);
  const month2 = new Date(currentYear, currentMonth + 2, 1);

  // Three months ago for historical maintenance record
  const threeMonthsAgo = new Date(currentYear, currentMonth - 3, 1);

  console.log("Cleaning up existing data...");

  await prisma.maintenanceRecord.deleteMany();
  await prisma.bomItem.deleteMany();
  await prisma.productionForecast.deleteMany();
  await prisma.tool.deleteMany();
  await prisma.product.deleteMany();

  console.log("Seeding tools...");

  const tool1 = await prisma.tool.upsert({
    where: { code: "54401 V206AY" },
    update: {},
    create: {
      code: "54401 V206AY",
      press: "54401",
      line: "V206AY",
      shotsPerStroke: 4,
      currentStrokes: 38000,
    },
  });

  const tool2 = await prisma.tool.upsert({
    where: { code: "55511 V629AY" },
    update: {},
    create: {
      code: "55511 V629AY",
      press: "55511",
      line: "V629AY",
      shotsPerStroke: 2,
      currentStrokes: 22000,
    },
  });

  const tool3 = await prisma.tool.upsert({
    where: { code: "54401 W956AY" },
    update: {},
    create: {
      code: "54401 W956AY",
      press: "54401",
      line: "W956AY",
      shotsPerStroke: 1,
      currentStrokes: 46500,
    },
  });

  const tool4 = await prisma.tool.upsert({
    where: { code: "54401 W955AY" },
    update: {},
    create: {
      code: "54401 W955AY",
      press: "54401",
      line: "W955AY",
      shotsPerStroke: 1,
      currentStrokes: 49200,
    },
  });

  const tool5 = await prisma.tool.upsert({
    where: { code: "555B1 3425R" },
    update: {},
    create: {
      code: "555B1 3425R",
      press: "555B1",
      line: "3425R",
      shotsPerStroke: 6,
      currentStrokes: 12000,
    },
  });

  const tool6 = await prisma.tool.upsert({
    where: { code: "6040 110 049" },
    update: {},
    create: {
      code: "6040 110 049",
      press: "6040",
      line: "110 049",
      shotsPerStroke: 3,
      currentStrokes: 5000,
    },
  });

  const tool7 = await prisma.tool.upsert({
    where: { code: "6040 100 836" },
    update: {},
    create: {
      code: "6040 100 836",
      press: "6040",
      line: "100 836",
      shotsPerStroke: 2,
      currentStrokes: 50100,
      description: "Ferramental vencido - necessita manutenção",
    },
  });

  console.log("Seeding products...");

  const prod1 = await prisma.product.upsert({
    where: { code: "PROD-001" },
    update: {},
    create: {
      code: "PROD-001",
      description: "Peça Estampada A",
    },
  });

  const prod2 = await prisma.product.upsert({
    where: { code: "PROD-002" },
    update: {},
    create: {
      code: "PROD-002",
      description: "Peça Estampada B",
    },
  });

  const prod3 = await prisma.product.upsert({
    where: { code: "PROD-003" },
    update: {},
    create: {
      code: "PROD-003",
      description: "Suporte Lateral C",
    },
  });

  const prod4 = await prisma.product.upsert({
    where: { code: "PROD-004" },
    update: {},
    create: {
      code: "PROD-004",
      description: "Tampa Inferior D",
    },
  });

  console.log("Seeding BOM items...");

  await prisma.bomItem.upsert({
    where: { productId_toolId: { productId: prod1.id, toolId: tool1.id } },
    update: {},
    create: { productId: prod1.id, toolId: tool1.id, quantityUsed: 1 },
  });

  await prisma.bomItem.upsert({
    where: { productId_toolId: { productId: prod1.id, toolId: tool3.id } },
    update: {},
    create: { productId: prod1.id, toolId: tool3.id, quantityUsed: 2 },
  });

  await prisma.bomItem.upsert({
    where: { productId_toolId: { productId: prod2.id, toolId: tool2.id } },
    update: {},
    create: { productId: prod2.id, toolId: tool2.id, quantityUsed: 1 },
  });

  await prisma.bomItem.upsert({
    where: { productId_toolId: { productId: prod2.id, toolId: tool5.id } },
    update: {},
    create: { productId: prod2.id, toolId: tool5.id, quantityUsed: 3 },
  });

  await prisma.bomItem.upsert({
    where: { productId_toolId: { productId: prod3.id, toolId: tool4.id } },
    update: {},
    create: { productId: prod3.id, toolId: tool4.id, quantityUsed: 1 },
  });

  await prisma.bomItem.upsert({
    where: { productId_toolId: { productId: prod3.id, toolId: tool6.id } },
    update: {},
    create: { productId: prod3.id, toolId: tool6.id, quantityUsed: 2 },
  });

  await prisma.bomItem.upsert({
    where: { productId_toolId: { productId: prod4.id, toolId: tool7.id } },
    update: {},
    create: { productId: prod4.id, toolId: tool7.id, quantityUsed: 1 },
  });

  console.log("Seeding production forecasts...");

  // PROD-001
  await prisma.productionForecast.create({
    data: { productId: prod1.id, referenceMonth: month0, plannedQuantity: 5000 },
  });
  await prisma.productionForecast.create({
    data: { productId: prod1.id, referenceMonth: month1, plannedQuantity: 6000 },
  });
  await prisma.productionForecast.create({
    data: { productId: prod1.id, referenceMonth: month2, plannedQuantity: 5500 },
  });

  // PROD-002
  await prisma.productionForecast.create({
    data: { productId: prod2.id, referenceMonth: month0, plannedQuantity: 3000 },
  });
  await prisma.productionForecast.create({
    data: { productId: prod2.id, referenceMonth: month1, plannedQuantity: 3500 },
  });
  await prisma.productionForecast.create({
    data: { productId: prod2.id, referenceMonth: month2, plannedQuantity: 4000 },
  });

  // PROD-003
  await prisma.productionForecast.create({
    data: { productId: prod3.id, referenceMonth: month0, plannedQuantity: 2000 },
  });
  await prisma.productionForecast.create({
    data: { productId: prod3.id, referenceMonth: month1, plannedQuantity: 2500 },
  });
  await prisma.productionForecast.create({
    data: { productId: prod3.id, referenceMonth: month2, plannedQuantity: 2000 },
  });

  // PROD-004
  await prisma.productionForecast.create({
    data: { productId: prod4.id, referenceMonth: month0, plannedQuantity: 1500 },
  });
  await prisma.productionForecast.create({
    data: { productId: prod4.id, referenceMonth: month1, plannedQuantity: 1800 },
  });
  await prisma.productionForecast.create({
    data: { productId: prod4.id, referenceMonth: month2, plannedQuantity: 1600 },
  });

  console.log("Seeding maintenance records...");

  await prisma.maintenanceRecord.create({
    data: {
      toolId: tool3.id,
      maintenanceDate: threeMonthsAgo,
      strokesAtMaintenance: 50000,
      maintenanceType: "Preventiva",
      responsible: "João Silva",
      notes: "Manutenção preventiva realizada conforme programado",
      resetCounter: true,
    },
  });

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
