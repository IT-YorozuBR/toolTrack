import Link from "next/link";

export const metadata = {
  title: "Manual — Controle 50K",
};

/* ───────────────────────── Helpers de layout ───────────────────────── */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

function Callout({
  tone = "blue",
  title,
  children,
}: {
  tone?: "blue" | "yellow" | "green" | "red";
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
    green: "border-green-200 bg-green-50 text-green-900",
    red: "border-red-200 bg-red-50 text-red-900",
  } as const;
  return (
    <div className={`rounded-lg border p-4 text-sm ${tones[tone]}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 leading-relaxed opacity-90">{children}</div>
    </div>
  );
}

/* ───────────────────────── Dados estáticos ───────────────────────── */

const TOC = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "conceitos", label: "Conceitos fundamentais" },
  { id: "formula", label: "Como as batidas são calculadas" },
  { id: "estimado-real", label: "Estimado × Real" },
  { id: "status", label: "Status e cores" },
  { id: "controle-50k", label: "A tela Controle 50K" },
  { id: "recursos", label: "Sinais e ferramentas da tela" },
  { id: "telas", label: "Telas do sistema" },
  { id: "fluxo", label: "Fluxo de trabalho" },
];

const COLUMNS = [
  { name: "Ferramental", desc: "Código e descrição da ferramenta. O detalhamento por produto aparece ao passar o mouse sobre as células de cada mês." },
  { name: "Últ. manut.", desc: "Data da última manutenção com reset do contador (início do ciclo 50K atual)." },
  { name: "Acúmulo Estimado", desc: "Base viva da projeção: havendo leitura no ciclo, parte da leitura real e cresce pela estimativa diária; sem leitura, usa a previsão de volume pura. O marcador 🔧 indica ciclo reiniciado há pouco (acúmulo ainda parcial).", highlight: true },
  { name: "Acúmulo Real", desc: "Leitura física crua do contador no ciclo (checkpoint da última medição, sem crescimento diário). Mostra “—” quando não há leitura. O marcador ⚠ Nd indica leitura defasada há N dias.", highlight: true },
  { name: "Restante mês", desc: "Quanto ainda falta produzir no mês corrente (previsão do mês − o que já decorreu, rateado por dias)." },
  { name: "N-1 / N / N+1 / N+2", desc: "Previsão de batidas mês a mês (janela de 4 meses a partir do mês atual). Passe o mouse para ver de quais produtos vêm as batidas." },
  { name: "Projetado 4 Meses", desc: "Acúmulo Estimado atual somado ao que falta no mês e à previsão dos próximos meses da janela." },
  { name: "Saldo 50k Estimado 4 Meses", desc: "50.000 − Projetado 4 Meses. Quanto ainda “sobra” até o limite, considerando a projeção futura." },
  { name: "Saldo 50k Atual", desc: "50.000 − Acúmulo Estimado atual. O saldo do estado de hoje, sem somar previsão futura.", highlight: true },
  { name: "Status", desc: "Situação do ferramental. A setinha ⇄ no cabeçalho alterna entre Real (padrão) e Estimado.", highlight: true },
  { name: "Atinge", desc: "Mês em que a projeção (ancorada no real, quando existe) cruza o limite de 50.000." },
  { name: "Ação", desc: "Botão de registrar manutenção para itens em Programar Preventiva ou Vencido." },
];

const SCREENS = [
  { href: "/dashboard", icon: "📊", title: "Dashboard", desc: "Resumo geral: total de ferramentais e contagem por status." },
  { href: "/controle-50k", icon: "🎯", title: "Controle 50K", desc: "Tela principal. Projeção de batidas, saldo e status preventivo de cada ferramental.", primary: true },
  { href: "/leituras", icon: "📝", title: "Leituras de Batidas", desc: "Registre o acúmulo real do contador por ferramental e veja o histórico de leituras.", primary: true },
  { href: "/manutencoes", icon: "🔧", title: "Manutenções", desc: "Histórico de manutenções. Registrar com reset reinicia o ciclo 50K." },
  { href: "/ferramentais", icon: "🛠️", title: "Ferramentais", desc: "Cadastro das ferramentas: código, prensa, batidas por golpe (shots) e limites." },
  { href: "/produtos", icon: "📦", title: "Produtos", desc: "Cadastro dos produtos fabricados nas prensas." },
  { href: "/projetos", icon: "🗂️", title: "Projetos", desc: "Agrupam produtos. As previsões podem ser lançadas por projeto." },
  { href: "/bom", icon: "🧩", title: "BOM", desc: "Vínculo produto ↔ ferramenta com a quantidade usada por peça." },
  { href: "/volumes", icon: "📈", title: "Volumes Previstos", desc: "Previsão mensal de produção (volume) por produto/projeto." },
  { href: "/historico-demanda", icon: "📅", title: "Histórico Demanda", desc: "Demanda prevista (batidas) por ferramenta e mês." },
  { href: "/fechamento-mensal", icon: "🔒", title: "Fechamento Mensal", desc: "Congela o histórico do mês anterior em snapshots do ciclo 50K." },
];

/* ───────────────────────── Página ───────────────────────── */

export default function ManualPage() {
  return (
    <div className="mx-auto max-w-5xl pb-16">
      {/* Hero */}
      <div className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 ring-1 ring-blue-400/30">
            Manual do sistema
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Controle 50K — Guia completo</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Como o sistema acompanha as batidas das prensas, projeta quando cada ferramenta
          vai atingir o limite de <strong className="text-white">50.000 batidas</strong> e ajuda a
          programar a manutenção preventiva no momento certo.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Pill color="bg-white/10 text-white ring-1 ring-white/20">Limite preventivo: 50.000</Pill>
          <Pill color="bg-white/10 text-white ring-1 ring-white/20">Aviso: 40.000</Pill>
          <Pill color="bg-white/10 text-white ring-1 ring-white/20">Janela de projeção: 4 meses</Pill>
        </div>
      </div>

      {/* Índice */}
      <Card className="mb-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Neste manual</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {TOC.map((t, i) => (
            <a key={t.id} href={`#${t.id}`} className="group flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600">
                {i + 1}
              </span>
              {t.label}
            </a>
          ))}
        </div>
      </Card>

      <div className="space-y-14">
        {/* Visão geral */}
        <Section id="visao-geral" eyebrow="Para que serve" title="Visão geral">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <div className="text-2xl">🎯</div>
              <h3 className="mt-2 font-semibold text-gray-900">Controle preventivo</h3>
              <p className="mt-1 text-sm text-gray-600">
                Cada ferramental suporta cerca de 50.000 batidas até precisar de manutenção. O sistema
                acompanha quanto já foi batido e quanto falta.
              </p>
            </Card>
            <Card>
              <div className="text-2xl">🔮</div>
              <h3 className="mt-2 font-semibold text-gray-900">Projeção de demanda</h3>
              <p className="mt-1 text-sm text-gray-600">
                A partir do volume de produção previsto, o sistema calcula quantas batidas cada
                ferramenta vai acumular nos próximos meses.
              </p>
            </Card>
            <Card>
              <div className="text-2xl">📝</div>
              <h3 className="mt-2 font-semibold text-gray-900">Acúmulo real</h3>
              <p className="mt-1 text-sm text-gray-600">
                Você pode registrar a leitura real do contador da prensa para corrigir a estimativa
                e ter um saldo de 50K fiel à realidade.
              </p>
            </Card>
          </div>
        </Section>

        {/* Conceitos */}
        <Section id="conceitos" eyebrow="O básico" title="Conceitos fundamentais">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="font-semibold text-gray-900">Hierarquia do cadastro</h3>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Pill color="bg-indigo-100 text-indigo-700">Projeto</Pill>
                <span className="text-gray-400">→</span>
                <Pill color="bg-emerald-100 text-emerald-700">Produto</Pill>
                <span className="text-gray-400">→</span>
                <Pill color="bg-sky-100 text-sky-700">Ferramenta</Pill>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Um <strong>projeto</strong> agrupa <strong>produtos</strong>. Cada produto é fabricado
                por uma ou mais <strong>ferramentas</strong> (via BOM). A previsão de volume pode ser
                lançada no projeto ou no produto.
              </p>
            </Card>
            <Card>
              <h3 className="font-semibold text-gray-900">BOM (lista de materiais)</h3>
              <p className="mt-3 text-sm text-gray-600">
                Liga o produto à ferramenta e diz <strong>quantas peças</strong> daquele produto saem
                por golpe da ferramenta (campo <em>quantidade usada</em>). É o que conecta o volume de
                produção às batidas da ferramenta.
              </p>
            </Card>
            <Card>
              <h3 className="font-semibold text-gray-900">Batidas por golpe (shots)</h3>
              <p className="mt-3 text-sm text-gray-600">
                Cada ferramenta tem <code className="rounded bg-gray-100 px-1 text-xs">shotsPerStroke</code>:
                quantas peças são produzidas a cada batida. Quanto maior, menos batidas para o mesmo volume.
              </p>
            </Card>
            <Card>
              <h3 className="font-semibold text-gray-900">Ciclo 50K</h3>
              <p className="mt-3 text-sm text-gray-600">
                A contagem zera a cada manutenção com <strong>reset</strong>. Tudo que aconteceu antes
                da manutenção não conta para o ciclo atual. O limite preventivo é de 50.000 batidas.
              </p>
            </Card>
          </div>
        </Section>

        {/* Fórmula */}
        <Section id="formula" eyebrow="A conta" title="Como as batidas são calculadas">
          <Card>
            <p className="text-sm font-medium text-gray-500">Fórmula base, por produto e por mês:</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-sm text-gray-900">
              <span className="rounded-md bg-gray-900 px-3 py-2 font-semibold text-white">batidas</span>
              <span className="text-gray-500">=</span>
              <span className="rounded-md bg-emerald-100 px-3 py-2 font-semibold text-emerald-800">volume previsto</span>
              <span className="text-gray-500">×</span>
              <span className="rounded-md bg-sky-100 px-3 py-2 font-semibold text-sky-800">qtd. BOM</span>
              <span className="text-gray-500">÷</span>
              <span className="rounded-md bg-amber-100 px-3 py-2 font-semibold text-amber-800">shots por golpe</span>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              As batidas de todos os produtos que usam a ferramenta são somadas. O acúmulo do ciclo é
              a soma mês a mês desde a última manutenção.
            </p>
          </Card>
          <div className="mt-4">
            <Callout tone="blue" title="Exemplo rápido">
              Volume de 10.000 peças no mês, BOM de 1 peça por golpe e ferramenta com 2 shots por golpe →
              <strong> 10.000 × 1 ÷ 2 = 5.000 batidas</strong> naquele mês.
            </Callout>
          </div>
        </Section>

        {/* Estimado x Real */}
        <Section id="estimado-real" eyebrow="O coração do sistema" title="Estimado × Real">
          <p className="mb-4 max-w-3xl text-sm text-gray-600">
            O sistema trabalha com duas visões que convivem lado a lado. Entender a diferença é a chave
            para usar bem o Controle 50K.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-purple-300 ring-1 ring-purple-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">📐</span>
                <h3 className="font-semibold text-purple-700">Acúmulo Estimado (base da projeção)</h3>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                É a coluna que <strong>alimenta a projeção</strong>, o saldo e o status. Quando existe
                leitura no ciclo, ela <strong>parte da leitura real e cresce</strong> pela estimativa
                diária até hoje. Sem leitura, cai para a <strong>previsão de volume pura</strong>.
                Sempre existe.
              </p>
            </Card>
            <Card className="border-blue-300 ring-1 ring-blue-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <h3 className="font-semibold text-blue-700">Acúmulo Real (leitura do contador)</h3>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                É a <strong>leitura física crua</strong> registrada na tela de Leituras de Batidas,
                <strong> sem nenhum crescimento adicionado</strong>. Funciona como um checkpoint do
                estado real na última medição. Mostra <strong>“—”</strong> enquanto não houver leitura
                no ciclo.
              </p>
            </Card>
          </div>
          <div className="mt-4 space-y-3">
            <Callout tone="blue" title="O Estimado ancora no Real quando há leitura">
              Você registrou 30.000 batidas há 5 dias e a previsão é de ~300 batidas/dia: o
              <strong> Acúmulo Estimado</strong> hoje mostra ~31.500 (leitura + dias decorridos),
              enquanto o <strong>Acúmulo Real</strong> continua em 30.000 (a medição crua). Passe o
              mouse nas colunas para ver o detalhamento.
            </Callout>
            <Callout tone="green" title="Status e saldo usam o real quando existe">
              O <strong>Status</strong> (padrão Real), o <strong>Saldo 50k</strong> e a coluna
              <strong> “Atinge”</strong> partem da leitura real quando há medição no ciclo; sem leitura,
              caem para o estimado (com um marcador <em>est.</em>) — então o planejamento nunca fica sem base.
            </Callout>
            <Callout tone="yellow" title="Após uma manutenção com reset">
              O Acúmulo Real volta para “—” até você registrar uma nova leitura no ciclo novo. Nesse
              intervalo, status e projeção usam o estimado, que recomeça do zero a partir da data do reset.
            </Callout>
          </div>
        </Section>

        {/* Status */}
        <Section id="status" eyebrow="Semáforo da manutenção" title="Status e cores">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="flex items-start gap-3">
              <Pill color="bg-green-100 text-green-800 border border-green-200">OK</Pill>
              <p className="text-sm text-gray-600">Abaixo de 40.000. Tudo tranquilo.</p>
            </Card>
            <Card className="flex items-start gap-3">
              <Pill color="bg-yellow-100 text-yellow-800 border border-yellow-200">Atenção</Pill>
              <p className="text-sm text-gray-600">Acúmulo ≥ 40.000 <em>ou</em> a projeção chega aos 45.000.</p>
            </Card>
            <Card className="flex items-start gap-3">
              <Pill color="bg-orange-100 text-orange-800 border border-orange-200">Programar Preventiva</Pill>
              <p className="text-sm text-gray-600">Acúmulo ≥ 45.000 <em>ou</em> a projeção chega aos 50.000. Hora de agendar.</p>
            </Card>
            <Card className="flex items-start gap-3">
              <Pill color="bg-red-100 text-red-800 border border-red-200">Vencido</Pill>
              <p className="text-sm text-gray-600">O acúmulo <strong>atual</strong> já passou de 50.000. Precisa de manutenção agora.</p>
            </Card>
          </div>
          <div className="mt-4 space-y-3">
            <Callout tone="red" title="Vencido é só pelo estado atual">
              Uma ferramenta que está em 30.000 hoje mas que a projeção leva a 54.000 em 4 meses
              <strong> não aparece como Vencido</strong> — ela fica em <em>Programar Preventiva</em>.
              “Vencido” é reservado para quem realmente já estourou o limite.
            </Callout>
            <Callout tone="blue" title="Status Real é o padrão — alterne com ⇄">
              A coluna <strong>Status</strong> mostra por padrão o status <strong>Real</strong> (baseado
              na leitura crua do contador). A setinha <span className="font-mono">⇄</span> no cabeçalho
              alterna para o status <strong>Estimado</strong> (calculado pela projeção). A cor de fundo
              das linhas acompanha o modo selecionado.
            </Callout>
            <Callout tone="green" title="Sem leitura, o Real cai para o estimado">
              Quando um ferramental ainda não tem leitura no ciclo, a visão Real exibe o status
              estimado com um marcador <strong>est.</strong> ao lado — sinal de que aquele status veio
              da previsão, não de uma medição física.
            </Callout>
          </div>
        </Section>

        {/* Controle 50K */}
        <Section id="controle-50k" eyebrow="Tela a tela" title="A tela Controle 50K">
          <p className="mb-4 max-w-3xl text-sm text-gray-600">
            É a tela principal. Cada linha é uma ferramenta; cada coluna conta uma parte da história.
          </p>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Coluna</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">O que significa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {COLUMNS.map((c) => (
                  <tr key={c.name} className={c.highlight ? "bg-blue-50/40" : ""}>
                    <td className="whitespace-nowrap px-5 py-3 align-top font-medium text-gray-900">
                      {c.name}
                      {c.highlight && <span className="ml-2 align-middle text-[10px] font-semibold text-blue-600">CHAVE</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="font-semibold text-gray-900">Filtros e ordenação</h3>
              <p className="mt-2 text-sm text-gray-600">
                Filtre por status, por mês em que atinge o limite (mês único ou intervalo
                <strong> Atinge entre</strong> De/Até) e por busca de código. A ordenação é separada em
                grupos: <strong>Saldo 50k Estimado</strong>, <strong>Saldo 50k Real</strong> e
                <strong> Ferramental</strong> (A→Z/Z→A). Itens sem leitura real vão para o fim quando
                ordenado por real.
              </p>
            </Card>
            <Card>
              <h3 className="font-semibold text-gray-900">Detalhamento por produto</h3>
              <p className="mt-2 text-sm text-gray-600">
                Passe o mouse sobre as células de cada mês (e sobre o <strong>Acúmulo</strong>) para ver
                quanto cada produto contribui de batidas. O detalhamento agora aparece em tooltips, sem
                precisar expandir a linha.
              </p>
            </Card>
          </div>
        </Section>

        {/* Recursos da tela */}
        <Section id="recursos" eyebrow="Mão na massa" title="Sinais e ferramentas da tela">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="font-semibold text-gray-900">Marcadores na tabela</h3>
              <div className="mt-3 space-y-2 text-sm text-gray-600">
                <p className="flex items-start gap-2">
                  <span className="mt-0.5 rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-300">🔧</span>
                  Ciclo reiniciado nos <strong>últimos 30 dias</strong> — o Acúmulo Estimado ainda é
                  parcial (conta poucos dias do novo ciclo).
                </p>
                <p className="flex items-start gap-2">
                  <span className="mt-0.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-300">⚠ Nd</span>
                  Leitura física <strong>defasada há N dias</strong> (mais de 30): o Acúmulo Real pode
                  estar subcontando — registre uma nova leitura.
                </p>
              </div>
            </Card>
            <Card>
              <h3 className="font-semibold text-gray-900">Saldo: restante × excedente</h3>
              <p className="mt-3 text-sm text-gray-600">
                Por padrão o Saldo 50k aparece como <strong>restante</strong> (limite − uso, fica
                negativo quando passa). O seletor permite trocar para <strong>excedente</strong>
                (uso − limite, positivo quando passa). A cor (vermelho = ruim) não muda.
              </p>
            </Card>
            <Card>
              <h3 className="font-semibold text-gray-900">Simular data</h3>
              <p className="mt-3 text-sm text-gray-600">
                O campo <strong>Simular data</strong> (com atalhos <span className="font-mono">+1m / +3m / +6m</span>)
                recalcula projeção, status e a janela de meses como se hoje fosse a data escolhida —
                útil para antever quando os ferramentais estouram. Uma faixa amarela avisa que você está
                simulando; clique em <em>voltar para hoje</em> para sair.
              </p>
            </Card>
            <Card>
              <h3 className="font-semibold text-gray-900">Exportar Excel</h3>
              <p className="mt-3 text-sm text-gray-600">
                O botão <strong>Exportar Excel</strong> gera uma planilha (.xlsx) com o histórico de
                manutenções e a projeção de demanda num período De/Até. As abas de Status e Preventivas
                seguem os <strong>filtros atuais</strong> da tela.
              </p>
            </Card>
          </div>
        </Section>

        {/* Telas */}
        <Section id="telas" eyebrow="Mapa do sistema" title="Telas do sistema">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SCREENS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`group rounded-xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  s.primary ? "border-blue-200 ring-1 ring-blue-100" : "border-gray-200"
                }`}
              >
                <div className="text-2xl">{s.icon}</div>
                <h3 className="mt-2 font-semibold text-gray-900 group-hover:text-blue-600">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{s.desc}</p>
                <span className="mt-3 inline-block text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                  Abrir →
                </span>
              </Link>
            ))}
          </div>
        </Section>

        {/* Fluxo */}
        <Section id="fluxo" eyebrow="Passo a passo" title="Fluxo de trabalho recomendado">
          <ol className="space-y-3">
            {[
              { t: "Cadastre o básico", d: "Ferramentas (com shots por golpe), produtos e os vínculos no BOM." },
              { t: "Lance os volumes previstos", d: "Informe a previsão de produção mensal por produto ou projeto." },
              { t: "Acompanhe o Controle 50K", d: "Veja a projeção, o status e quando cada ferramenta atinge o limite." },
              { t: "Registre as leituras reais", d: "Periodicamente, lance o contador real na tela de Leituras para ancorar o saldo na realidade." },
              { t: "Programe a preventiva", d: "Use os status Programar Preventiva e Vencido para agendar a manutenção." },
              { t: "Registre a manutenção", d: "Ao concluir, registre com reset para reiniciar o ciclo 50K da ferramenta." },
            ].map((step, i) => (
              <li key={i} className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-gray-900">{step.t}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/controle-50k"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ir para o Controle 50K
            </Link>
            <Link
              href="/leituras"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Registrar uma leitura
            </Link>
          </div>
        </Section>
      </div>
    </div>
  );
}
