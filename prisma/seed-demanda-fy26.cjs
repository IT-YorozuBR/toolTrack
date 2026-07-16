// Seed de ajuste de demanda FY26 — alinha ProjectForecast (12 projetos com match seguro
// na aba ST da planilha) e cria BomItemForecastOverride para as 3 ferramentas de exceção
// com match 100% seguro (ver CONTEXTO_DEMANDA_FERRAMENTAS.md, seção 3.1).
//
// Não mexe em Tool nem em BomItem. Não cria/edita Project, Product ou vínculos.
// Roda contra DATABASE_URL do ambiente (padrão: local docker em localhost:5433).

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");

const connectionString =
  process.env.DATABASE_URL || "postgresql://prensa:Lucas12!@localhost:5433/prensa50k";
const pool = new pg.Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Meses FY26 (abril/2026 a março/2027), na mesma ordem das colunas 4月..3月 da aba ST.
const MONTHS = [
  [2026, 3], [2026, 4], [2026, 5], [2026, 6], [2026, 7], [2026, 8],
  [2026, 9], [2026, 10], [2026, 11], [2027, 0], [2027, 1], [2027, 2],
]; // mês 0-indexed (3 = abril)

// Valores da tabela agregada por projeto (linhas 10-21 da aba ST), extraídos da
// planilha "YAB操計FY2026圧造グラフRV  FY26  Julho .xls" nesta sessão.
const PROJECT_FORECASTS = {
  X1312: [3950, 3040, 3040, 200, 500, 1000, 2500, 2592, 4290, 2500, 4350, 3200],
  HJF: [2400, 2400, 2000, 4600, 6000, 4200, 4600, 3600, 2200, 450, 1600, 2400],
  "P02H RR": [5460, 6220, 6080, 3360, 4900, 6160, 7280, 4700, 1960, 3980, 4900, 6300],
  U79: [2760, 1936, 2040, 2244, 2040, 1947, 0, 0, 0, 0, 0, 0],
  H79: [1600, 1700, 2000, 1900, 1500, 1850, 1200, 1250, 700, 0, 1000, 800],
  "XBB RR": [8180, 8190, 8610, 8250, 8980, 9660, 11920, 9180, 6930, 2500, 6300, 8400],
  "XBB FR": [12940, 12940, 13600, 10120, 9820, 10750, 13530, 11430, 9850, 5540, 11610, 13490],
  "2LM/2GN": [4280, 4400, 6480, 3080, 4510, 4730, 5660, 3620, 2970, 3700, 3180, 4400],
  "2WF/2TG": [2890, 3230, 3800, 2380, 4300, 3740, 3570, 2210, 1870, 2460, 2550, 2720],
  "2GN LWA": [6300, 5220, 6480, 3420, 6300, 7380, 7740, 3240, 4140, 5960, 5220, 5400],
  "P02H FR": [3320, 5160, 4440, 2990, 4700, 6510, 7130, 5170, 2240, 2980, 3640, 4460],
  P13C: [2660, 4060, 3920, 3500, 4450, 5250, 3220, 5180, 3780, 4550, 4060, 2800],
};

// As 3 ferramentas de exceção (quantityUsed=2 / shotsPerStroke=1) com match 100% seguro
// (1 BomItem <-> 1 linha da aba ST, sem ambiguidade de sufixo). Valores = linha da
// ferramenta na planilha (já no formato "volume da ferramenta", D/E já aplicado pela
// própria planilha).
const TOOL_EXCEPTIONS = {
  "55537 7LR0A": [5320, 8120, 7840, 7000, 8900, 10500, 6440, 10360, 7560, 9100, 8120, 5600],
  "54414 5RA0A": [5460, 6220, 6080, 3360, 4900, 6160, 7280, 4700, 1960, 3980, 4900, 6300],
  "54850 9LH0C": [6640, 10320, 8880, 5980, 9400, 13020, 14260, 10340, 4480, 5960, 7280, 8920],
  // Encontrados no cruzamento amplo (295 linhas de ferramenta x 402 Tools) desta sessão:
  // mesmo critério (match de código sem ambiguidade, ratio D/E da planilha != quantityUsed/shotsPerStroke do banco).
  "55516 7082R": [2400, 2400, 2000, 4600, 6000, 4200, 4600, 3600, 2200, 450, 1600, 2400],
  // Mês de jul/2026 negativo na planilha (-480): sem sentido físico p/ demanda; zerado
  // (override=0 → 0 batidas nesse mês para esta ferramenta especificamente).
  "54408 4459 R": [1975, 1410, 620, 0, 250, 500, 1250, 1296, 2145, 1250, 2175, 1600],
  "54409 9039 R": [1975, 1410, 620, 0, 250, 500, 1250, 1296, 2145, 1250, 2175, 1600],
};

function monthAnchor(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex, 1, 12));
}
function monthRange(year, monthIndex) {
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

async function upsertProjectForecast(projectId, year, monthIndex, plannedQuantity, report) {
  const { start, end } = monthRange(year, monthIndex);
  const existing = await prisma.projectForecast.findFirst({
    where: { projectId, referenceMonth: { gte: start, lt: end } },
  });
  const before = existing?.plannedQuantity ?? null;
  if (existing) {
    if (existing.plannedQuantity !== plannedQuantity) {
      await prisma.projectForecast.update({ where: { id: existing.id }, data: { plannedQuantity } });
    }
  } else {
    await prisma.projectForecast.create({
      data: { projectId, referenceMonth: monthAnchor(year, monthIndex), plannedQuantity },
    });
  }
  report.push({ before, after: plannedQuantity, year, month: monthIndex + 1 });
}

async function upsertOverride(bomItemId, year, monthIndex, plannedQuantity, report) {
  const { start, end } = monthRange(year, monthIndex);
  const existing = await prisma.bomItemForecastOverride.findFirst({
    where: { bomItemId, referenceMonth: { gte: start, lt: end } },
  });
  const before = existing?.plannedQuantity ?? null;
  if (existing) {
    if (existing.plannedQuantity !== plannedQuantity) {
      await prisma.bomItemForecastOverride.update({ where: { id: existing.id }, data: { plannedQuantity } });
    }
  } else {
    await prisma.bomItemForecastOverride.create({
      data: { bomItemId, referenceMonth: monthAnchor(year, monthIndex), plannedQuantity },
    });
  }
  report.push({ before, after: plannedQuantity, year, month: monthIndex + 1 });
}

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const byName = new Map(projects.map((p) => [p.name, p.id]));

  const summary = { projects: {}, tools: {}, unmatchedProjects: [] };

  for (const [name, values] of Object.entries(PROJECT_FORECASTS)) {
    const projectId = byName.get(name);
    if (!projectId) {
      summary.unmatchedProjects.push(name);
      continue;
    }
    const report = [];
    for (let i = 0; i < MONTHS.length; i++) {
      const [year, monthIndex] = MONTHS[i];
      await upsertProjectForecast(projectId, year, monthIndex, values[i], report);
    }
    summary.projects[name] = report;
  }

  const tools = await prisma.tool.findMany({
    where: { code: { in: Object.keys(TOOL_EXCEPTIONS) } },
    include: { bomItems: true },
  });
  for (const tool of tools) {
    const values = TOOL_EXCEPTIONS[tool.code];
    const bomItem = tool.bomItems[0];
    if (!bomItem) continue;
    const overridePlannedQty = values.map((v) => (v * tool.shotsPerStroke) / bomItem.quantityUsed);
    const report = [];
    for (let i = 0; i < MONTHS.length; i++) {
      const [year, monthIndex] = MONTHS[i];
      const qty = Math.round(overridePlannedQty[i]);
      await upsertOverride(bomItem.id, year, monthIndex, qty, report);
    }
    summary.tools[tool.code] = report;
  }

  console.log(JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
