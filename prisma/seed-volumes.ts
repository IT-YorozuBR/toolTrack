import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

// ─── Volumes Previstos seed ───────────────────────────────────────────────────
// Valores em unidades inteiras (notação BR: 6.220 → 6220, 1.936 → 1936)
// Atualiza APENAS os campos N-1, N, N+1, N+2 (plannedQuantity dos 4 meses).
// Produtos existentes não são alterados; apenas forecasts são upsertados.

const volumesPrevistosSeed = [
  { codigo: "540409LH0B",                   nome: "SEAT ASSY-FR SPR,UPR",         nMenos1: 6220,  n: 6080,  nMais1: 4640,  nMais2: 6560  },
  { codigo: "544019LH0B",                   nome: "MBR ASSY-FR SUSP",             nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "545009LH0F",                   nome: "LINK COMPL-TRANSV",            nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "545019LH0F",                   nome: "LINK COMPL-TRANSV",            nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "555019KE0C",                   nome: "BEAM COMPL-RR SUSP",           nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "555019LH0C",                   nome: "BEAM COMPL-RR SUSP",           nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "544015RA0A",                   nome: "MBR ASSY-FR SUSP",             nMenos1: 5160,  n: 3740,  nMais1: 3040,  nMais2: 4600  },
  { codigo: "545005RA0D",                   nome: "LINK COMPL-TRANSV",            nMenos1: 5460,  n: 5740,  nMais1: 6300,  nMais2: 5740  },
  { codigo: "545015RA0D",                   nome: "LINK COMPL-TRANSV",            nMenos1: 5460,  n: 5740,  nMais1: 6300,  nMais2: 5740  },
  { codigo: "555015RA0C",                   nome: "BEAM COMPL-RR SUSP",           nMenos1: 6220,  n: 6080,  nMais1: 4640,  nMais2: 6560  },
  { codigo: "554003665R",                   nome: "SUBFRAME ASSY-RR",             nMenos1: 1936,  n: 2040,  nMais1: 2244,  nMais2: 2040  },
  { codigo: "554012728R",                   nome: "SUBFRAME ASSY-RR",             nMenos1: 1936,  n: 2040,  nMais1: 2244,  nMais2: 2040  },
  { codigo: "554033820R",                   nome: "SUBFRAME ASSY-RR(4x4)",        nMenos1: 1936,  n: 2040,  nMais1: 2244,  nMais2: 2040  },
  { codigo: "555014222R",                   nome: "AXLE COMPL-RR",               nMenos1: 1700,  n: 1000,  nMais1: 1300,  nMais2: 2000  },
  { codigo: "AXLE COMPL-RR(for Colombia)",  nome: "AXLE COMPL-RR(for Colombia)", nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "555011238R",                   nome: "AXLE COMPL-RR",               nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "544013624R",                   nome: "SUBFRAME-FR",                  nMenos1: 12940, n: 13600, nMais1: 14070, nMais2: 10030 },
  { codigo: "555117489R",                   nome: "AXLE-ASSY-RR",                nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "555111736R",                   nome: "AXLE-ASSY-RR",                nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "555119718R",                   nome: "AXLE-ASSY-RR",                nMenos1: 8190,  n: 8400,  nMais1: 7770,  nMais2: 8600  },
  { codigo: "545005JL0A",                   nome: "LINK COMPL-FR SUSP,LWR",      nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "545015JL0A",                   nome: "LINK COMPL-FR SUSP,LWR",      nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "545245JL0A",                   nome: "LINK COMPL-FR SUSP,UPR",      nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "545255JL0A",                   nome: "LINK COMPL-FR SUSP,UPR",      nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "551105JL0A",                   nome: "LINK COMPL-LWR,RR SUSP",      nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "551205JL0A",                   nome: "LINK COMPL-UPR,RR SUSP",      nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "551305JL0A",                   nome: "ROD COMPL-PANHARD",            nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "551206KL0A",                   nome: "LINK COMPL-UPR,RR SUSP",      nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "51350TRY M020",                nome: "LWR ARM",                      nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "51360TRY M020",                nome: "LWR ARM",                      nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "50200TRY M012M1",              nome: "FR SUBFRAME",                  nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "50200T5N M011M1",              nome: "FR SUBFRAME",                  nMenos1: 0,     n: 0,     nMais1: 0,     nMais2: 0     },
  { codigo: "51350T14A M000",               nome: "LWR ARM",                      nMenos1: 3230,  n: 3230,  nMais1: 2210,  nMais2: 1700  },
  { codigo: "51360T14A M000",               nome: "LWR ARM",                      nMenos1: 3230,  n: 3230,  nMais1: 2210,  nMais2: 1700  },
  { codigo: "50200T14 M011M1",              nome: "FR SUBFRAME",                  nMenos1: 3230,  n: 3230,  nMais1: 2210,  nMais2: 1700  },
  { codigo: "51350-3M6A-M000",              nome: "LWR ARM",                      nMenos1: 5220,  n: 6480,  nMais1: 4500,  nMais2: 4680  },
  { codigo: "51360-3M6A-M000",              nome: "LWR ARM",                      nMenos1: 5220,  n: 6480,  nMais1: 4500,  nMais2: 4680  },
  { codigo: "50200-3N0A-J010-M1",           nome: "FR SUBFRAME",                  nMenos1: 4400,  n: 4500,  nMais1: 4100,  nMais2: 4500  },
  { codigo: "544010169R",                   nome: "SUBFRAME ASSY-FR",             nMenos1: 2400,  n: 1600,  nMais1: 3400,  nMais2: 4000  },
  { codigo: "545044765R",                   nome: "TV LINK RH",                   nMenos1: 2400,  n: 1600,  nMais1: 3400,  nMais2: 4000  },
  { codigo: "545059976R",                   nome: "TV LINK LH",                   nMenos1: 2400,  n: 1600,  nMais1: 3400,  nMais2: 4000  },
  { codigo: "548626112R",                   nome: "QQ LINK RH",                   nMenos1: 2400,  n: 1600,  nMais1: 3400,  nMais2: 4000  },
  { codigo: "548637695R",                   nome: "QQ LINK LH",                   nMenos1: 2400,  n: 1600,  nMais1: 3400,  nMais2: 4000  },
  { codigo: "555012708R",                   nome: "AXLE COMPL-RR (GEN1)",         nMenos1: 2400,  n: 1600,  nMais1: 3400,  nMais2: 4000  },
  { codigo: "555012027R",                   nome: "AXLE COMPL-RR (GEN3)",         nMenos1: 2400,  n: 1600,  nMais1: 3400,  nMais2: 4000  },
  { codigo: "544017LR0A",                   nome: "MBR ASSY-FR SUSP",             nMenos1: 4060,  n: 2660,  nMais1: 2660,  nMais2: 4200  },
  { codigo: "555017LR0A",                   nome: "BEAM COMPL-RR SUSP",           nMenos1: 4060,  n: 2660,  nMais1: 2660,  nMais2: 4200  },
  { codigo: "545247LR0A",                   nome: "QQ LINK RH",                   nMenos1: 4060,  n: 2660,  nMais1: 2660,  nMais2: 4200  },
  { codigo: "545257LR0A",                   nome: "QQ LINK LH",                   nMenos1: 4060,  n: 2660,  nMais1: 2660,  nMais2: 4200  },
  { codigo: "544018158R",                   nome: "SUBFRAME ASSY-FR",             nMenos1: 3040,  n: 2400,  nMais1: 2880,  nMais2: 4700  },
  { codigo: "555017974R",                   nome: "AXLE COMPL-RR",               nMenos1: 3040,  n: 2400,  nMais1: 2880,  nMais2: 4700  },
] as const;

async function main() {
  const now = new Date();
  const windowDates = [0, 1, 2, 3].map(
    (offset) => new Date(now.getFullYear(), now.getMonth() + offset, 1)
  );

  let created = 0;
  let updated = 0;

  for (const item of volumesPrevistosSeed) {
    // Localiza ou cria o produto pelo código; não altera dados existentes
    const product = await prisma.product.upsert({
      where: { code: item.codigo },
      update: {},
      create: { code: item.codigo, modelo: item.nome },
    });

    const quantities = [item.nMenos1, item.n, item.nMais1, item.nMais2];
    for (let i = 0; i < 4; i++) {
      const existing = await prisma.productionForecast.findUnique({
        where: { productId_referenceMonth: { productId: product.id, referenceMonth: windowDates[i] } },
      });

      await prisma.productionForecast.upsert({
        where: { productId_referenceMonth: { productId: product.id, referenceMonth: windowDates[i] } },
        update: { plannedQuantity: quantities[i] },
        create: { productId: product.id, referenceMonth: windowDates[i], plannedQuantity: quantities[i] },
      });

      existing ? updated++ : created++;
    }
  }

  console.log(`Volumes seed concluído: ${volumesPrevistosSeed.length} produtos, ${created} forecasts criados, ${updated} atualizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
