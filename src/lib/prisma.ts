import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// The explicit `ssl` option below governs TLS behavior. The `sslmode` query
// param in the Neon URL is redundant and makes pg-connection-string emit a
// deprecation warning (require/prefer/verify-ca semantics change in pg v9),
// so we strip it before handing the string to the Pool.
function getConnectionString() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return raw;
  }
}

// `sslmode=disable` na URL desliga o TLS explicitamente. Necessário para um
// Postgres em container (ex.: docker-compose), cujo host não é localhost mas
// também não oferece SSL. Lido da URL crua, antes do strip em getConnectionString.
function sslExplicitlyDisabled(raw: string | undefined) {
  if (!raw) return false;
  try {
    return new URL(raw).searchParams.get("sslmode") === "disable";
  } catch {
    return false;
  }
}

// Local Postgres (localhost/127.0.0.1) typically has no TLS, while managed
// providers like Neon require it. Enable SSL only for non-local hosts so the
// same code works against both.
function needsSsl(connectionString: string | undefined) {
  if (!connectionString) return false;
  try {
    const host = new URL(connectionString).hostname;
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
  } catch {
    return true;
  }
}

function createPrismaClient() {
  const connectionString = getConnectionString();
  const useSsl = !sslExplicitlyDisabled(process.env.DATABASE_URL) && needsSsl(connectionString);
  const pool = new pg.Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
  const adapter = new PrismaPg(pool);
  // PrismaPg adapter type doesn't fully overlap with PrismaClientOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter, log: ["error"] } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
