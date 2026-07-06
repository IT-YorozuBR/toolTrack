# Contexto: revisão de demanda/batidas por ferramenta

> Arquivo de continuidade — escrito para retomar exatamente de onde parou, sem precisar
> reexplicar tudo numa próxima conversa. Pode apagar quando o trabalho abaixo estiver
> concluído e você não precisar mais do histórico.

## 1. Como tudo começou

Pedido original: comparar a lógica de cadastro/importação de demanda das ferramentas com
a planilha `YAB操計FY2026圧造グラフRV  FY26  Julho .xls` (na raiz do projeto) e com os
dados já no banco, e dizer se a lógica atual está correta.

### Diagnóstico da planilha
- Aba `ST`: 4 blocos por grupo de prensa (`6A 800T BL`, `6C 250T BL`, `6E 200T TD`,
  `6F 1500T TRSF`). Cada bloco tem uma tabela agregada por "modelo"/projeto (linhas 3-20,
  colunas `F:Q` = meses `4月`(abril)…`3月`(março), fiscal year japonês) e depois uma
  tabela por ferramenta (`W/C`=projeto, `ITEM`=código da ferramenta, `D`=p/c,
  `E`=個採り/PCS, `F:Q`=mesmos meses).
- Descoberta: `volume_da_ferramenta = volume_do_produto × D ÷ E`. `D` (p/c) = quantas
  peças o produto consome dessa ferramenta (equivale a `BomItem.quantityUsed`). `E`
  (個採り, cavidade) = quantas peças a ferramenta produz por batida (equivale a
  `Tool.shotsPerStroke`).
- Aba `Summary`: capacidade de prensa por mês (bate com os totais por grupo de prensa
  da aba `ST`).

### Diagnóstico do banco
- `Project` (14) ≈ "modelo"/programa da planilha (`HJF`, `P13C`, `X1312`, etc.).
- `Product` (52) = part number final. `Tool` (402) = ferramental/die físico.
  `BomItem` (626) = vínculo N:N Produto↔Ferramenta com `quantityUsed`.
- `ProductionForecast` (nível Produto) e `ProjectForecast` (nível Projeto) — quando um
  produto pertence a um projeto, o cálculo usa `ProjectForecast` e **ignora**
  `ProductionForecast` daquele produto (achado: 31 produtos tinham os dois preenchidos
  com valores diferentes — dado morto).
- Comparação Julho/2026: banco gravado em 02/06/2026, planilha revisada (RV) em
  25/06/2026 — divergência em 11 de 12 projetos, explicada majoritariamente por
  desatualização, não por bug de fórmula.
- **Achado maior**: `Tool.shotsPerStroke = 1` em **100% das 402 ferramentas**. A
  cavidade nunca é aplicada (nunca divide). Causa: `prisma/seed.ts:148` grava
  `shotsPerStroke: 1` fixo, porque a fonte `dadosferramental.xlsx` só tem a matriz
  Ferramenta×Produto de `quantityUsed`, sem coluna de cavidade.
- 76 vínculos `BomItem` (35 ferramentas distintas) têm `quantityUsed = 2` com
  `shotsPerStroke` ainda em 1 — candidatos a "exceção" (pode ser uso duplo legítimo OU
  cavidade lançada no campo errado; não dá pra saber só olhando o banco).

## 2. O que já foi implementado (funcionando em produção/docker)

### Schema (`prisma/schema.prisma`)
- Novo model `BomItemForecastOverride` (migration `20260703131504_add_bom_item_forecast_override`):
  `bomItemId`, `referenceMonth`, `plannedQuantity`, único por `[bomItemId, referenceMonth]`.
  **Não mexe em `Tool` nem em `BomItem`** — só sobrescreve o resultado final da conta de
  batidas para aquele par Produto+Ferramenta naquele mês.

### Cálculo (`src/lib/calculations/strokes.ts`)
- `calculateStrokesForMonth`: agora checa `bomItem.overrides` **antes** de cair na regra
  Projeto→Produto. Se existir override pro mês, usa ele (com a mesma fórmula
  `× quantityUsed ÷ shotsPerStroke`) e pula o resto.
- `productBreakdown` (dentro de `getToolProjection`): mesma prioridade.
- `calculateForecastedStrokes` sem `referenceMonth`: ramo morto removido — agora delega
  pra `calculateStrokesForMonth` por mês da janela (antes ignorava `ProjectForecast`).
- Testes novos em `strokes.test.cjs` (23 passando): override substitui só o mês
  sobrescrito; override tem prioridade sobre `ProjectForecast`.

### Server actions
- `src/lib/actions/bom-item-forecast-overrides.ts`: `upsertBomItemForecastOverride`,
  `deleteBomItemForecastOverride` (mesmo padrão de `project-forecasts.ts`, upsert por
  faixa de mês UTC).
- `src/lib/actions/project-demand-tree.ts`: `getProjectDemandTree(projectId, from, to)`
  monta a árvore Produto→Ferramenta (com `quantityUsed`, `shotsPerStroke`, overrides do
  período); `findProjectsWithTool(termo)` acha projetos que têm uma ferramenta cujo
  código bate com o termo.

### Includes do Prisma atualizados (para trazer `overrides`)
Todos os lugares que montam `bomItems` para calcular projeção 50K agora incluem
`overrides`: `src/lib/actions/tool-projection.ts`, `src/app/controle-50k/page.tsx`,
`src/app/dashboard/dashboard-data.ts`, `src/app/api/relatorios/50k/route.ts`,
`src/app/ferramentais/page.tsx`, `src/lib/actions/monthly-stroke-snapshots.ts` (as duas
queries: `findToolsForMonthlyClosing` e `autoEnsureMonthlySnapshots`).

### UI — `/volumes` (`src/app/volumes/ProjectVolumeGrid.tsx`)
- Árvore expansível **Projeto → Produto → Ferramenta**, com toggle (▶/▼) próprio em
  cada nível (produto não abre mais junto quando o projeto abre — só na busca).
- Célula de ferramenta mostra o valor herdado do projeto (itálico/cinza) ou o override
  (laranja/negrito), editável clicando; salvar com `qty=0` remove o override (volta a
  herdar).
- Cada linha de ferramenta mostra **`uso ×N`** (`quantityUsed`, multiplica) e
  **`cav ÷N`** (`shotsPerStroke`, divide) lado a lado; fica destacado em laranja com
  `⚠` quando `quantityUsed > 1` e `shotsPerStroke === 1` (padrão suspeito de cavidade
  não configurada).
- **Busca global de ferramenta** (`Search`/`X` no topo): digita o código, acha em quais
  projetos ela aparece (`findProjectsWithTool`), abre a árvore inteira só nesses
  projetos e já filtra/realça a ferramenta. Ao limpar (apagar texto ou clicar no X),
  restaura exatamente o estado de antes da busca (snapshot em `useRef`) — não deixa
  projeto preso aberto.
- Botão **"Limpar filtros"**: aparece quando há algo expandido/filtrado; zera tudo
  (`expanded`, `expandedProducts`, `toolSearch`, busca global) de uma vez.
- Busca por ferramenta **dentro** de um projeto já aberto (por produto, já existia antes
  da busca global): filtra as ferramentas daquele projeto específico.

### UI — clareza de campos (evitar repetir a confusão uso×cavidade)
- `src/app/ferramentais/ToolForm.tsx`: campo renomeado para "Cavidades (peças por
  batida) *", com texto de ajuda explicando que ele **divide** e não é o mesmo que
  "quantidade usada" do BOM (que **multiplica**).
- `src/app/bom/BomManager.tsx`: label do campo de quantidade agora é "Qtd. usada/peça"
  com tooltip; o "cav/shot" da ferramenta também tem tooltip explicando a diferença.

### Correção pontual já aplicada
- Ferramenta de teste `teste 2`: tinha `quantityUsed=2` / `shotsPerStroke=1` (o padrão
  problemático). Corrigido para `quantityUsed=1` / `shotsPerStroke=2` (configuração
  fisicamente correta de "cavidade dupla, uso simples"). Confirmado no motor de
  cálculo: a mesma demanda que dava 1.000.000 de batidas passou a dar 250.000.

### Relatório entregue
- Artefato com a lista das 35 ferramentas/76 vínculos "de exceção" (quantityUsed=2,
  shotsPerStroke=1), agrupados por ferramenta, para revisão manual — **não foram
  alterados**, porque decidir se o "2" é cavidade ou uso duplo exige conhecimento físico
  da peça que não dá pra inferir do banco.

## 3. Onde paramos — próximo passo combinado

Decisão do usuário: **não vamos mexer no `Tool` nem no `BomItem`** dessas 35 ferramentas
de exceção. A correção deve acontecer só na **quantidade de batidas resultante**, via
`BomItemForecastOverride` — exatamente o mecanismo que já existe.

Abordagem combinada (ainda não implementada):

1. Cruzar as 35 ferramentas de exceção (lista do artefato, seção 1) com as linhas de
   ferramenta da aba `ST` da planilha (código bate).
2. Para cada match seguro, calcular o override por mês assim:
   ```
   override.plannedQuantity = valor_da_planilha_para_essa_ferramenta_no_mes
                               × shotsPerStroke_atual ÷ quantityUsed_atual
   ```
   (`shotsPerStroke_atual` e `quantityUsed_atual` ficam como estão — não mudam. Isso faz
   o resultado final da fórmula bater com o valor da planilha, sem reclassificar nada.)
3. **Dry-run primeiro**: mostrar a lista de overrides que seriam criados/atualizados,
   sem gravar nada.
4. Só rodar de verdade (commit) depois de aprovação explícita.
5. Ferramentas de exceção que não têm match seguro na planilha: reportar separado, não
   inventar valor.

**Isso ainda não foi escrito nem executado** — é o próximo passo pendente quando a
conversa retomar.

### 3.1 Tentativa de cruzamento (feita, resultado: parcial, parado por decisão do usuário)

Rodei o cruzamento automático (scripts descartáveis, não versionados — ficaram só na
sessão). Resultado:

- Das 35 ferramentas de exceção, **19 têm pelo menos 1 código batendo** na aba `ST`, mas
  a maioria com **múltiplas linhas candidatas** (ambíguo) ou **múltiplos `Tool` no banco
  com sufixo** (`BL`/`TF`/`TD`/`E`) pro mesmo código base — não dá pra saber qual linha
  da planilha corresponde a qual sufixo sem conhecimento físico da peça.
- **Só 3 ferramentas têm match 100% seguro** (1 `BomItem` ↔ 1 linha da planilha, sem
  ambiguidade de sufixo): `54850 9LH0C`, `55537 7LR0A`, `54414 5RA0A`.
- **16 ferramentas não têm nenhum match de código** na aba `ST` (notação bem diferente
  ou item descontinuado/renomeado).
- **Problema adicional descoberto**: vários `BomItem` das ferramentas de exceção apontam
  pra produtos com `Project` **e** `modelo` ambos `null` no banco (ex.: produto
  `554003665R`, ligado à ferramenta `55411 3665RAY`). A planilha organiza tudo por
  projeto/modelo (coluna `W/C`); sem esse vínculo no banco não dá pra saber qual bloco da
  planilha usar pra aquele `BomItem` específico, mesmo quando o código da ferramenta
  bate.

Perguntei ao usuário como prosseguir (aplicar só as 3 seguras / revisar ambíguas junto /
parar por aqui) — **decisão: parar por aqui**. Overrides não foram criados. Nada foi
gravado no banco.

**Próximo passo real, se retomar**: decidir se vale a pena (a) completar o cadastro de
`Project`/`modelo` nos produtos órfãos antes de tentar de novo, (b) revisar as
ambiguidades de sufixo manualmente com quem conhece a peça física, ou (c) aceitar aplicar
só as 3 seguras e deixar o resto de lado. Os scripts de extração/match não foram
versionados (eram só scratch); se for retomar, refazer é rápido (extrair aba `ST` com
`xlsx`, comparar com `BomItem` onde `quantityUsed=2` e `tool.shotsPerStroke=1`).

### 3.2 Relatório visual do cruzamento (entregue)

A pedido do usuário, o resultado da seção 3.1 foi publicado como artefato HTML (não
versionado no repo — vive só como link):
https://claude.ai/code/artifact/ff883877-d9d1-495f-b9ac-d2e1c6696396

Estrutura do relatório: 3 grupos expansíveis (**match seguro** / **ambíguo** / **sem
match**), cada ferramenta com os produtos vinculados, a(s) linha(s) candidata(s) da
planilha (bloco de prensa, projeto/modelo `W/C`, `D`/`E`, total anual) e a grade mês a
mês (`4月`…`3月`). Mesmos números da seção 3.1: 3 seguras / 16 ambíguas / 16 sem match.
Nenhum override foi criado a partir dele — é só material de revisão manual.

Se quiser regenerar ou ajustar o relatório depois, os dados-fonte usados (JSON com a
classificação, os matches candidatos por ferramenta e os totais mensais) não foram
versionados; refazer exige repetir o cruzamento da seção 3.1 e depois montar o HTML.

## 4. Ambiente / como testar

- App roda via `docker compose` (containers `prensa-stroke` e `prensa-stroke-db`,
  Postgres publicado em `localhost:5433`, app em `localhost:3000`).
- Pra rodar migration/build fora do container: `DATABASE_URL` apontando pra
  `localhost:5433` (dentro do container a app usa `db:5432`, que só resolve na rede
  docker).
- Fluxo usado nesta sessão pra aplicar mudanças: editar código → `rm -rf .next` →
  `npm run build` (com `DATABASE_URL=...localhost:5433...`) → `docker compose up -d
  --build app` (demora ~5-9 min, sem output intermediário — não é travamento).
- `npm test` roda `src/lib/calculations/strokes.test.cjs` (23 testes hoje).
