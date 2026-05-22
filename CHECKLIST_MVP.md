# Checklist do MVP — Controle 50K Prensa RV

- [x] Projeto roda com npm run dev
- [x] Banco Neon conectado via DATABASE_URL
- [x] Prisma configurado (Prisma 7 + adapter PrismaPg)
- [x] Migrations criadas (prisma/migrations/..._init)
- [x] Seed criado e executado com sucesso
- [x] Dashboard funcionando
- [x] Ferramentais funcionando (listar, criar, editar, excluir, ativar/desativar)
- [x] Produtos funcionando (listar, criar, editar, excluir, ativar/desativar)
- [x] BOM funcionando (listar, criar, excluir)
- [x] Volumes previstos funcionando (listar, criar, excluir)
- [x] Controle 50K funcionando (filtros por status/prensa/busca, projeções, ação de manutenção)
- [x] Manutenções funcionando (histórico, registrar nova, zerar contador)
- [x] Sem API REST — apenas Server Actions e funções internas
- [x] Sem divisão por zero — guards em calculateForecastedStrokes e getMaintenanceStatus
- [x] Sem credenciais hardcoded — DATABASE_URL via .env
- [x] Português com acentuação correta (Manutenções, Ferramentais, Atenção, etc.)
- [x] Histórico de manutenção nunca apagado
- [x] Controle 50K é a tela principal (redirect em /)

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar banco (copiar e preencher)
cp .env.example .env
# Editar .env com a DATABASE_URL do Neon

# 3. Gerar cliente Prisma
npx prisma generate

# 4. Aplicar migrations
npx prisma migrate dev

# 5. Popular com dados de exemplo
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# 6. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: http://localhost:3000
