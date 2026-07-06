const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");
const pool = new pg.Pool({ connectionString: "postgresql://prensa:Lucas12!@localhost:5433/prensa50k", ssl: false });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
(async () => {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      forecasts: true,
      projectProducts: { include: { project: true } },
    },
  });
  const semProjeto = products.filter(p => p.projectProducts.length === 0);
  const comProjeto = products.filter(p => p.projectProducts.length > 0);
  console.log("Produtos ativos total:", products.length);
  console.log("Sem projeto (usam ProductionForecast de verdade):", semProjeto.length);
  console.log("Com projeto (ProductionForecast e dado morto):", comProjeto.length);
  console.log("\nProdutos SEM projeto:");
  for (const p of semProjeto) {
    const july = p.forecasts.find(f => {
      const d = new Date(f.referenceMonth);
      return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 6; // julho = mes index 6
    });
    console.log(" ", p.code, "modelo=" + p.modelo, "julho=", july ? july.plannedQuantity : "sem forecast", "totalForecasts=", p.forecasts.length);
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
