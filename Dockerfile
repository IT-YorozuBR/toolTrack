# syntax=docker/dockerfile:1

# Imagem para a aplicação Next.js 16 (App Router) + Prisma 7.
# Build multi-stage com output "standalone" para uma imagem final enxuta.
# O banco de dados NÃO faz parte desta imagem: a conexão vem de DATABASE_URL em runtime.

# ---- Base comum ----
FROM node:20-bookworm-slim AS base
# openssl: usado pelo Prisma. ca-certificates: TLS para o banco externo (ex.: Neon).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Dependências (inclui devDependencies: necessárias para o build) ----
FROM base AS deps
# O schema precisa existir antes do install: o postinstall roda `prisma generate`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- Build da aplicação ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` = `prisma generate && next build` (gera o Prisma Client + build standalone).
# DATABASE_URL não é necessária no build (o Prisma usa driver adapter em runtime).
RUN npm run build

# ---- Imagem final de execução ----
FROM base AS runner
ENV NODE_ENV=production
# Executa como usuário sem privilégios.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Arquivos estáticos e o servidor standalone (server.js + node_modules mínimos).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# server.js é emitido pelo output "standalone" e substitui o `next start`.
CMD ["node", "server.js"]
