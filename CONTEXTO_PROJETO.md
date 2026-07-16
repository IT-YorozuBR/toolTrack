# Contexto do Projeto — Controle 50K (prensa-stroke)

> Arquivo de continuidade entre sessões. Leia isto no início de qualquer conversa nova
> sobre este repositório — ele deve ser suficiente para entender o que o sistema faz,
> como está estruturado e o que foi feito recentemente, sem precisar reconstruir o
> contexto do zero. **Ver a seção "Como manter este arquivo atualizado" no final.**

## 1. O que é o sistema

Sistema industrial interno (Yorozu) para controlar o ciclo de vida de **ferramentais de
prensa** (moldes/dies) e prever quando cada um vai precisar de manutenção preventiva, com
base no acúmulo de **batidas** (strokes) estimado a partir da demanda de produção.

Nome do projeto no código/deploy: `prensa-stroke`. Nome do repositório no GitHub:
`toolTrack`. Ambos os nomes aparecem espalhados pelo código/infra — não são a mesma
coisa mudando, é histórico (ver `DEPLOY.md`, seção "Visão geral").

## 2. Stack técnica

- **Next.js 16** (App Router) — ver `AGENTS.md`: este projeto usa uma versão do Next.js
  com mudanças que quebram convenções conhecidas de treino; antes de mexer em
  roteamento/middleware/cache, checar `node_modules/next/dist/docs/`.
- **Prisma 7** com adapter `PrismaPg`, banco **PostgreSQL (Neon** em produção, container
  local `prensa-stroke-db` via Docker Compose).
- **Sem API REST tradicional.** Toda escrita/leitura de dados passa por **Server Actions**
  em `src/lib/actions/*.ts` (`"use server"`), chamadas direto dos client components via
  `useTransition`/`action={...}` de formulário. As únicas rotas em `src/app/api/` são
  `relatorios/50k/route.ts` (export de relatório) e `access-log/route.ts` (logging de
  acesso, ver seção 6).
- Testes: `npm test` roda `src/lib/calculations/strokes.test.cjs` (node --test, sem
  framework externo) — cobre a lógica de cálculo de batidas.
- Deploy: Docker Compose num servidor Proxmox, deploy por código-fonte (clona do GitHub e
  builda a imagem no servidor). Detalhes completos em `DEPLOY.md` (inclui rollback rápido
  por tag de imagem) e `DOCKER.md`.

## 3. Modelo de domínio

Hierarquia principal: **Projeto → Produto → Ferramenta**, com previsão de demanda em
cada nível e um mecanismo de exceção pontual.

- **`Project`** — programa/modelo (ex.: `HJF`, `P13C`, `X1312`). Tem `ProjectForecast`
  (previsão mensal de quantidade, por projeto).
- **`Product`** — part number final. Pertence a um `Project` via `ProjectProduct`
  (N:N; na prática cada produto tem no máximo um projeto ativo). Pode ter também
  `ProductionForecast` (previsão mensal própria) — **só é usada se o produto não
  pertencer a nenhum projeto**; quando pertence, `ProjectForecast` manda e a previsão do
  produto é ignorada.
- **`Tool`** — o ferramental físico (molde/die). Campos-chave:
  - `shotsPerStroke` — quantas peças saem **por batida** (cavidade). **Divide** a conta.
  - `currentStrokes` — acúmulo atual de batidas, zerado nas manutenções que marcam
    `resetCounter`.
  - `preventiveLimit` (padrão 50.000) / `warningLimit` (padrão 45.000) — limites do
    "Controle 50K".
  - `ignoreManualReadings` — quando `true`, ignora `ToolStrokeReading` no cálculo (volta a
    usar só a estimativa).
- **`BomItem`** — vínculo N:N Produto↔Ferramenta, com `quantityUsed` — quantas peças
  daquele produto **usam** essa ferramenta (multiplica). A fórmula geral de batidas de
  uma ferramenta num mês é:
  ```
  batidas = demanda_do_produto_no_mes × quantityUsed ÷ shotsPerStroke
  ```
  (ver "achado maior" no arquivo `CONTEXTO_DEMANDA_FERRAMENTAS.md`: por herança do seed
  original, **todas** as ferramentas tinham `shotsPerStroke = 1`, ou seja, cavidade nunca
  configurada — parcialmente investigado, não totalmente corrigido, ver seção 7).
- **`BomItemForecastOverride`** — sobrescreve, para um par Produto+Ferramenta e mês
  específico, o resultado final da fórmula acima (não mexe em `quantityUsed` nem
  `shotsPerStroke`). Usado quando uma ferramenta atende frações diferentes de demanda em
  contextos distintos que a fórmula padrão não capta. UI de edição: `/volumes`.
- **`MaintenanceRecord`** — histórico de manutenções de uma ferramenta. Nunca é apagado
  livremente: só a manutenção **mais recente** de uma ferramenta pode ser excluída ou ter
  data/batidas/contador alterados (ver seção 5), porque a reversão do contador só é
  bem-definida para o último evento do ciclo. Guarda `previousStrokes` (acúmulo exato
  antes do reset) para permitir reversão exata.
- **`ToolMonthlyStrokeSnapshot`** — snapshot mensal de batidas por ferramenta (fechado ou
  projetado), usado para reconstruir histórico e re-ancorar cálculos depois de uma
  manutenção que zera o contador.
- **`ToolStrokeReading`** — leitura manual de batidas no meio do ciclo (ajuste pontual,
  não confundir com manutenção).
- **`AccessLog`** — log de acesso simples (path, ip, user-agent, referer), ver seção 6.

## 4. Mapa de páginas (`src/app/`)

| Rota | O que faz |
|---|---|
| `/` | redireciona para `/controle-50k` (tela principal) |
| `/controle-50k` | tela principal: lista ferramentas com status (ok/atenção/preventiva), filtros por prensa/status/busca, projeção de batidas, ação rápida de registrar manutenção |
| `/dashboard` | visão geral/indicadores |
| `/ferramentais` | CRUD de `Tool` (listar, criar, editar, excluir, ativar/desativar) |
| `/produtos` | CRUD de `Product` |
| `/projetos` | CRUD de `Project` e vínculo com produtos |
| `/bom` | gerenciar `BomItem` (vínculo Produto↔Ferramenta) |
| `/volumes` | árvore expansível Projeto→Produto→Ferramenta com edição de `BomItemForecastOverride`, busca global de ferramenta (ver detalhes em `CONTEXTO_DEMANDA_FERRAMENTAS.md`) |
| `/manutencoes` | grade de ferramentais → histórico de manutenções por ferramenta (`MaintenanceList.tsx`), registrar nova (`nova/`), editar em modal (`EditMaintenanceModal.tsx`), excluir (só a mais recente) |
| `/leituras` | registrar `ToolStrokeReading` (leitura manual) |
| `/fechamento-mensal` | fechamento/consolidação mensal de snapshots |
| `/historico-demanda` | histórico de demanda |
| `/manual` | manual de uso do sistema |
| `/painel-x9k3m2` | painel oculto (nome ofuscado de propósito) de logs de acesso, protegido por `?key=` (`ACCESS_LOG_ADMIN_KEY`), com resolução de hostname reverso por IP |

> **Nota sobre `ManutencaoRow.tsx` e `ManutencaoFilters.tsx`** (em `src/app/manutencoes/`):
> são componentes **não usados** (código morto — `page.tsx` usa `ToolGrid` +
> `MaintenanceList`, não esses). Se for mexer em manutenções, confirmar que está editando
> o componente realmente renderizado antes de investir tempo.

## 5. Convenções importantes já estabelecidas

- **Histórico de manutenção nunca é apagado livremente**: exclusão e edição de campos
  que afetam o contador (`maintenanceDate`, `strokesAtMaintenance`, `resetCounter`) só
  são permitidas na manutenção **mais recente** de cada ferramenta
  (`src/lib/actions/maintenance.ts` — `deleteMaintenanceRecord`,
  `updateMaintenanceRecord`). Campos "seguros" (tipo, responsável, observação) podem ser
  editados em qualquer registro.
- **Edição de manutenção pede confirmação explícita** antes de gravar, com mensagem
  diferente conforme o impacto (mudança de ciclo vs. só metadados) —
  `EditMaintenanceModal.tsx`.
- **Sem API REST para CRUD de domínio** — sempre usar Server Actions seguindo o padrão
  `{ success, data }` / `{ success: false, error }` já usado em todo `src/lib/actions/`.
- **Sem divisão por zero** — guards em `calculateForecastedStrokes` e
  `getMaintenanceStatus` (ver `CHECKLIST_MVP.md`).
- **Português com acentuação correta** em toda a UI.
- **Rollback de deploy**: antes de cada build novo, a imagem atual é taggeada como backup
  (`docker tag prensa-stroke:latest prensa-stroke:backup-<data>`), permitindo reverter em
  segundos sem depender do `.tar` antigo — ver `DEPLOY.md`, seção "Rollback".

## 6. Sistema de log de acesso (recente)

Adicionado: `src/proxy.ts` (Routing Middleware) intercepta toda navegação (exceto
`api`/assets estáticos) e dispara (`event.waitUntil`, fire-and-forget) um POST para
`/api/access-log` com path/ip/user-agent/referer. A rota grava em `AccessLog`
(migration `20260706170524_add_access_log`). Consulta em `/painel-x9k3m2?key=...`
(chave em `ACCESS_LOG_ADMIN_KEY`, com fallback hardcoded `prensa50k-acessos` — **trocar
a env var em produção** se isso for levado a sério como controle de acesso).

## 7. Frentes em andamento / pendências conhecidas

- **Investigação de cavidade (`shotsPerStroke`)**: ver `CONTEXTO_DEMANDA_FERRAMENTAS.md`
  para o diagnóstico completo. Resumo: 100% das ferramentas nasceram com
  `shotsPerStroke = 1` (cavidade nunca aplicada) por limitação da planilha-fonte do seed;
  35 ferramentas (76 vínculos `BomItem`) têm `quantityUsed = 2` com `shotsPerStroke`
  ainda 1 — candidatas a correção via `BomItemForecastOverride`, mas **parado por decisão
  do usuário** (só 3 de 35 têm match seguro com a planilha; resto é ambíguo ou sem match).
  Não mexer em `Tool`/`BomItem` dessas exceções sem revisão manual de quem conhece a peça
  física.
- **Seed `prisma/seed-demanda-fy26.cjs`**: criado, ainda não confirmado como
  executado/versionado no fluxo padrão — checar se ainda está pendente antes de assumir
  que os dados de demanda FY26 já estão no banco.
- **Migração de automação de migrations**: `DEPLOY.md` observa que aplicar migrations
  ainda é manual a cada deploy; ideia futura (não implementada) é um serviço `migrate`
  no `docker-compose.yml`.

## 8. Como rodar / testar

Ver `README.md` (setup genérico Next.js) e `CHECKLIST_MVP.md` (passo a passo específico
deste projeto: `.env`, `prisma generate`, `prisma migrate dev`, seed, `npm run dev`).
Para deploy e rollback em produção, ver `DEPLOY.md`. Para detalhes de containers, ver
`DOCKER.md`.

---

## Como manter este arquivo atualizado

Este arquivo é o resumo de alto nível; ele não substitui arquivos de contexto específicos
de uma investigação/feature grande em andamento (ex.: `CONTEXTO_DEMANDA_FERRAMENTAS.md`)
— esses continuam existindo à parte e podem ser referenciados daqui.

**Regra a seguir em toda sessão que alterar o sistema (schema, server actions, rotas,
convenções, ou decisões de produto relevantes):**

1. Depois de qualquer mudança não-trivial (nova feature, mudança de schema, nova
   convenção, decisão de escopo, correção de bug com causa raiz não óbvia), atualizar a
   seção relevante deste arquivo (domínio, mapa de páginas, convenções ou pendências).
2. Se a mudança for parte de uma investigação/feature grande e ainda em andamento (várias
   sessões), preferir um arquivo de contexto dedicado (padrão
   `CONTEXTO_<ASSUNTO>.md`, como `CONTEXTO_DEMANDA_FERRAMENTAS.md`) e só deixar aqui um
   resumo de 2-3 linhas com o nome do arquivo — para não duplicar detalhe.
3. Manter a seção 7 ("Frentes em andamento") como a lista viva do que falta — remover
   itens concluídos, adicionar itens novos, nunca deixar desatualizada.
4. Não é necessário registrar mudanças triviais (ajuste de estilo, texto de label,
   refactor sem mudança de comportamento) — só o que muda o entendimento do sistema para
   quem retomar o trabalho depois.
