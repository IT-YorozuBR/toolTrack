import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone (server.js + apenas as deps usadas) para uma imagem Docker enxuta.
  output: "standalone",
  // Mantém o adapter do Prisma fora do bundle (require nativo do Node), igual o Next já faz
  // com @prisma/client. Assim ele é rastreado para o node_modules do standalone em runtime.
  serverExternalPackages: ["@prisma/adapter-pg"],
  // O Prisma Client é carregado dinamicamente; garante que os arquivos gerados sejam
  // incluídos no trace do standalone para todas as rotas (senão o runtime não acha o client).
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/**/*", "./node_modules/@prisma/client/**/*"],
  },
};

export default nextConfig;
