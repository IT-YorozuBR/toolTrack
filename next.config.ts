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
  // Libera o bloqueio de cross-origin do servidor de DEV (`next dev`) para acesso pela
  // rede local — ex.: abrir http://192.168.x.x:3000 de outra máquina para testar.
  // Sem isso o Next responde 403 "Blocked cross-origin request to Next.js dev resource"
  // nos assets internos (/_next/*, HMR websocket).
  // NÃO tem efeito em produção: `allowedDevOrigins` só é lido pelo servidor de
  // desenvolvimento; `next build` / `next start` (a imagem Docker) ignoram esta opção.
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "*.local",
  ],
};

export default nextConfig;
