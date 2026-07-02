export type MaintenanceStatus =
  | "OK"
  | "ATENCAO"
  | "PROGRAMAR_PREVENTIVA"
  | "VENCIDO"
  | "ERRO_CADASTRO";

export type WindowMonth = {
  key: string;
  label: string;
  offset: number;
  strokes: number;
};

export type ProductContribution = {
  productId: string;
  productCode: string;
  strokesByMonth: Record<string, number>;
  totalStrokes: number;
  // Projetos aos quais este produto pertence (rastreabilidade reversa
  // ferramenta → produto → projeto). Vazio quando o produto não está em projeto.
  projects: { id: string; name: string }[];
};

export type ToolProjection = {
  toolId: string;
  code: string;
  description?: string | null;
  press: string;
  line?: string | null;
  currentStrokes: number;
  lastMaintenanceDate: string | null;
  hasMaintenanceInReferenceMonth: boolean;
  // Dias desde o último reset (null sem reset). cycleRecentlyReset = reset há <= RECENT_RESET_DAYS.
  daysSinceReset: number | null;
  cycleRecentlyReset: boolean;
  strokesAtLastMaintenance: number | null;
  estimatedStrokes: number;
  // Acúmulo Estimado exibido: base da projeção = leitura+dias quando há leitura, senão previsão pura.
  estimatedAccumulated: number;
  forecastedStrokes: number;
  closedHistoricalStrokes: number;
  currentMonthForecastedStrokes: number;
  currentMonthRemainingStrokes: number;
  currentMonthRemainingToDo: number;
  forecastedStrokesAfterMaintenance: number;
  totalProjectedStrokes: number;
  remainingStrokes: number;
  latestRealReadingDate: string | null;
  // Dias desde a última leitura física no ciclo (null quando não há leitura).
  daysSinceLastReading: number | null;
  // true quando há leitura mas ela está velha demais (> STALE_READING_DAYS): o
  // "Real" pode estar subcontando porque a produção real pode superar a previsão.
  readingStale: boolean;
  realCycleStrokes: number | null;
  realEstimatedStrokes: number | null;
  realRemainingStrokes: number | null;
  // Saldo 50k "atual": limite − acúmulo efetivo (real ancorado quando há leitura,
  // senão estimado). Sempre definido — usado na coluna "Saldo 50k Atual".
  currentRemainingStrokes: number;
  realStatus: MaintenanceStatus | null;
  // Status efetivo = real quando há leitura, senão cai para o estimado (projeção).
  effectiveStatus: MaintenanceStatus;
  // true quando o effectiveStatus veio do estimado (não há leitura real no ciclo).
  statusFromEstimate: boolean;
  preventiveLimit: number;
  warningLimit: number;
  status: MaintenanceStatus;
  reachesLimitInMonth?: string;
  window: WindowMonth[];
  productBreakdown: ProductContribution[];
  errors: string[];
};

type BomItemWithProduct = {
  quantityUsed: number;
  product: {
    id: string;
    code: string;
    forecasts: {
      referenceMonth: Date;
      plannedQuantity: number;
    }[];
    projectProducts?: {
      project: {
        id: string;
        name: string;
        forecasts: {
          referenceMonth: Date;
          plannedQuantity: number;
        }[];
      };
    }[];
  };
};

type MaintenanceRecordForProjection = {
  maintenanceDate: Date;
  resetCounter: boolean;
  strokesAtMaintenance?: number | null;
};

type MonthlySnapshotForProjection = {
  referenceMonth: Date;
  strokes: number;
  actualStrokes?: number | null;
  cycleStartedAt?: Date | null;
};

type StrokeReadingForProjection = {
  readingDate: Date;
  cycleStrokes: number;
};

type ToolWithRelations = {
  id: string;
  code: string;
  description?: string | null;
  press: string;
  line?: string | null;
  shotsPerStroke: number;
  currentStrokes: number;
  preventiveLimit: number;
  warningLimit: number;
  // Quando true, as leituras manuais são desconsideradas na projeção (acúmulo cai
  // para o estimado). Os dados das leituras não são apagados — só ignorados aqui.
  ignoreManualReadings?: boolean;
  bomItems: BomItemWithProduct[];
  maintenanceRecords: MaintenanceRecordForProjection[];
  monthlySnapshots?: MonthlySnapshotForProjection[];
  strokeReadings?: StrokeReadingForProjection[];
};

// Acima deste número de dias sem nova leitura física, a leitura é considerada
// "defasada": o acúmulo Real deixa de ser confiável como checkpoint e o sistema
// passa a depender só da estimativa (que pode subcontar se a produção real >
// prevista). Usado para sinalizar na UI que é hora de uma nova medição.
export const STALE_READING_DAYS = 30;

// Dentro desta janela após o reset, o ciclo é considerado "recém-reiniciado": o
// Acúmulo Estimado ainda é parcial (conta poucos dias), então marcamos o número
// para não ser lido como "rodou pouco". Baseado na recência real do reset — não
// no mês civil — então o sinal sobrevive à virada de mês.
export const RECENT_RESET_DAYS = 30;

const PT_MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

function formatMonthPt(date: Date): string {
  return `${PT_MONTHS[date.getMonth()]}/${date.getFullYear()}`;
}

export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function getWindowDates(referenceDate?: Date): { offset: number; date: Date; key: string; label: string; planningLabel: string }[] {
  const now = referenceDate ?? new Date();
  return [0, 1, 2, 3].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const label = ["N-1", "N", "N+1", "N+2"][offset];
    return { offset, date, key: toMonthKey(date), planningLabel: label, label: formatMonthPt(date) };
  });
}

export function calculateStrokesForMonth(
  tool: ToolWithRelations,
  monthKey: string,
): number {
  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) {
    return 0;
  }

  let total = 0;
  for (const bomItem of tool.bomItems) {
    const projectProducts = bomItem.product.projectProducts;
    if (projectProducts && projectProducts.length > 0) {
      // Use project forecasts: sum over all projects this product belongs to
      for (const pp of projectProducts) {
        for (const forecast of pp.project.forecasts) {
          if (toMonthKey(new Date(forecast.referenceMonth)) !== monthKey) continue;
          const strokes = (forecast.plannedQuantity * bomItem.quantityUsed) / tool.shotsPerStroke;
          if (isFinite(strokes)) total += strokes;
        }
      }
    } else {
      // Fall back to product-level forecasts
      for (const forecast of bomItem.product.forecasts) {
        if (toMonthKey(new Date(forecast.referenceMonth)) !== monthKey) continue;
        const strokes = (forecast.plannedQuantity * bomItem.quantityUsed) / tool.shotsPerStroke;
        if (isFinite(strokes)) total += strokes;
      }
    }
  }
  return total;
}

export function calculateClosedMonthStrokes(tool: ToolWithRelations, monthDate: Date): number {
  const monthKey = toMonthKey(monthDate);
  const monthlyStrokes = calculateStrokesForMonth(tool, monthKey);
  const monthEnd = endOfMonth(monthDate);
  const lastResetBeforeMonthEnd = tool.maintenanceRecords
    .filter((m) => m.resetCounter && m.maintenanceDate <= monthEnd)
    .sort((a, b) => b.maintenanceDate.getTime() - a.maintenanceDate.getTime())[0];

  if (!lastResetBeforeMonthEnd) return Math.round(monthlyStrokes);

  if (isSameMonth(lastResetBeforeMonthEnd.maintenanceDate, monthDate)) {
    // Só a parte do mês APÓS o reset pertence ao novo ciclo. Rateia por dias (mesma
    // premissa de calculateEstimatedStrokes) em vez de subtrair strokesAtMaintenance —
    // que é o contador de vida (~50k) e zeraria o mês, subcontando o ciclo novo.
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const resetDay = lastResetBeforeMonthEnd.maintenanceDate.getDate();
    const daysAfterReset = Math.max(0, daysInMonth - resetDay);
    return Math.round((monthlyStrokes * daysAfterReset) / daysInMonth);
  }

  return Math.round(monthlyStrokes);
}

export function calculateForecastedStrokes(
  tool: ToolWithRelations,
  referenceMonth?: Date,
): number {
  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) {
    return 0;
  }

  if (referenceMonth) {
    return calculateStrokesForMonth(tool, toMonthKey(referenceMonth));
  }

  const windowKeys = new Set(getWindowDates().map((w) => w.key));
  let total = 0;
  for (const bomItem of tool.bomItems) {
    for (const forecast of bomItem.product.forecasts) {
      if (!windowKeys.has(toMonthKey(new Date(forecast.referenceMonth)))) continue;
      const strokes = (forecast.plannedQuantity * bomItem.quantityUsed) / tool.shotsPerStroke;
      if (isFinite(strokes)) total += strokes;
    }
  }
  return total;
}

export function getMaintenanceStatus(
  currentStrokes: number,
  forecastedStrokes: number,
  preventiveLimit: number,
  warningLimit: number,
  shotsPerStroke: number,
): MaintenanceStatus {
  if (!shotsPerStroke || shotsPerStroke <= 0 || !isFinite(shotsPerStroke)) {
    return "ERRO_CADASTRO";
  }

  const totalProjected = currentStrokes + forecastedStrokes;

  if (totalProjected >= preventiveLimit) return "VENCIDO";
  if (totalProjected >= warningLimit) return "PROGRAMAR_PREVENTIVA";
  if (totalProjected >= warningLimit - 5000) return "ATENCAO";
  return "OK";
}

// Status considerando estado atual e projeção separadamente:
// - VENCIDO só pelo acúmulo ATUAL (já passou do limite — precisa de manutenção agora).
// - PROGRAMAR_PREVENTIVA / ATENÇÃO podem disparar pela projeção (aviso antecipado para planejar).
export function getProjectedMaintenanceStatus(
  currentAccumulated: number,
  projectedTotal: number,
  preventiveLimit: number,
  warningLimit: number,
  shotsPerStroke: number,
): MaintenanceStatus {
  if (!shotsPerStroke || shotsPerStroke <= 0 || !isFinite(shotsPerStroke)) {
    return "ERRO_CADASTRO";
  }

  const attentionLimit = warningLimit - 5000;

  if (currentAccumulated >= preventiveLimit) return "VENCIDO";
  if (currentAccumulated >= warningLimit || projectedTotal >= preventiveLimit) return "PROGRAMAR_PREVENTIVA";
  if (currentAccumulated >= attentionLimit || projectedTotal >= warningLimit) return "ATENCAO";
  return "OK";
}

export function getMonthWhenReachesLimit(tool: ToolWithRelations, referenceDate?: Date): string | undefined {
  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) {
    return undefined;
  }

  const now = referenceDate ?? new Date();
  let cumulative = tool.currentStrokes;

  for (let offset = 0; offset <= 23; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    cumulative += calculateStrokesForMonth(tool, toMonthKey(date));
    if (cumulative >= tool.preventiveLimit) {
      return formatMonthPt(date);
    }
  }

  return undefined;
}

function calculateEstimatedStrokes(
  maintenanceDate: Date,
  tool: ToolWithRelations,
  today: Date = new Date(),
): number {
  let total = 0;
  let cursor = startOfMonth(maintenanceDate);
  const todayMonthStart = startOfMonth(today);

  while (cursor <= todayMonthStart) {
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const monthlyStrokes = calculateStrokesForMonth(tool, toMonthKey(cursor));

    const isMaintenanceMonth = isSameMonth(cursor, maintenanceDate);
    const isTodayMonth = isSameMonth(cursor, today);
    const dayFrom = isMaintenanceMonth ? maintenanceDate.getDate() : 0;
    const dayTo = isTodayMonth ? today.getDate() : daysInMonth;

    const daysElapsed = dayTo - dayFrom;
    if (daysElapsed > 0 && monthlyStrokes > 0) {
      total += monthlyStrokes * (daysElapsed / daysInMonth);
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return Math.round(total);
}

function getLastReset(tool: ToolWithRelations): MaintenanceRecordForProjection | undefined {
  return tool.maintenanceRecords
    .filter((m) => m.resetCounter)
    .sort((a, b) => b.maintenanceDate.getTime() - a.maintenanceDate.getTime())[0];
}

// Saldo 50K real: ancora na última leitura do contador do ciclo e cresce pela
// estimativa diária (calculateEstimatedStrokes) entre a leitura e hoje. Leituras
// no instante do reset ou anteriores (`<= maintenanceDate`) são ignoradas — pertencem
// ao ciclo anterior. Assim a manutenção funciona como checkpoint: o ciclo novo só
// passa a ter "real" quando há uma leitura posterior à manutenção; até lá, o status
// cai para o estimado (que já parte de zero a partir da data do reset).
function getRealCycleEstimate(
  tool: ToolWithRelations,
  lastReset: MaintenanceRecordForProjection | undefined,
  today: Date,
): { reading: StrokeReadingForProjection; estimated: number } | null {
  if (tool.ignoreManualReadings) return null;
  if (!tool.strokeReadings?.length) return null;
  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) return null;

  const cycleStart = lastReset?.maintenanceDate ?? null;
  // Comparar por dia de calendário: leituras gravadas ao meio-dia de hoje não podem
  // ser descartadas só porque o instante atual ainda é de manhã.
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const reading = tool.strokeReadings
    .map((r) => ({ ...r, readingDate: new Date(r.readingDate) }))
    .filter((r) => r.readingDate <= todayEnd && (!cycleStart || r.readingDate.getTime() > cycleStart.getTime()))
    .sort((a, b) => b.readingDate.getTime() - a.readingDate.getTime())[0];

  if (!reading) return null;

  const growth = calculateEstimatedStrokes(reading.readingDate, tool, today);
  return { reading, estimated: reading.cycleStrokes + growth };
}

function getClosedHistoricalStrokes(
  tool: ToolWithRelations,
  lastReset: MaintenanceRecordForProjection | undefined,
  today: Date,
): number {
  if (!lastReset || !tool.monthlySnapshots?.length) return 0;

  const currentMonthStart = startOfMonth(today);
  return tool.monthlySnapshots
    .filter((snapshot) => {
      const referenceMonth = startOfMonth(new Date(snapshot.referenceMonth));
      const cycleStartedAt = snapshot.cycleStartedAt ? new Date(snapshot.cycleStartedAt) : null;
      return (
        referenceMonth < currentMonthStart &&
        referenceMonth >= startOfMonth(lastReset.maintenanceDate) &&
        (!cycleStartedAt || cycleStartedAt.getTime() === lastReset.maintenanceDate.getTime())
      );
    })
    .reduce((sum, snapshot) => sum + (snapshot.actualStrokes ?? snapshot.strokes), 0);
}

function getEstimatedHistoricalBeforeCurrentMonth(
  tool: ToolWithRelations,
  lastReset: MaintenanceRecordForProjection | undefined,
  today: Date,
): number {
  if (!lastReset || isSameMonth(lastReset.maintenanceDate, today)) return 0;

  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  return calculateEstimatedStrokes(lastReset.maintenanceDate, tool, previousMonthEnd);
}

function getCurrentMonthElapsedStrokes(
  tool: ToolWithRelations,
  lastReset: MaintenanceRecordForProjection | undefined,
  today: Date,
): number {
  const currentMonthStart = startOfMonth(today);
  const estimateStart = lastReset && isSameMonth(lastReset.maintenanceDate, today)
    ? lastReset.maintenanceDate
    : currentMonthStart;
  return calculateEstimatedStrokes(estimateStart, tool, today);
}

function getForecastedStrokesAfterMaintenance(
  window: WindowMonth[],
  currentMonthRemainingStrokes: number,
): number {
  return currentMonthRemainingStrokes + window
    .filter((m) => m.offset > 0)
    .reduce((sum, m) => sum + m.strokes, 0);
}

function getMonthWhenReachesLimitFromCycle(
  tool: ToolWithRelations,
  initialClosedStrokes: number,
  currentMonthRemainingStrokes: number,
  referenceDate?: Date,
): string | undefined {
  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) {
    return undefined;
  }

  const now = referenceDate ?? new Date();
  let cumulative = initialClosedStrokes;

  for (let offset = 0; offset <= 23; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const strokes = offset === 0
      ? currentMonthRemainingStrokes
      : calculateStrokesForMonth(tool, toMonthKey(date));
    cumulative += strokes;
    if (cumulative >= tool.preventiveLimit) {
      return formatMonthPt(date);
    }
  }

  return undefined;
}

export function getToolProjection(tool: ToolWithRelations, referenceDate?: Date): ToolProjection {
  const errors: string[] = [];

  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) {
    errors.push("Quantidade por shot invalida (deve ser maior que zero)");
  }

  const today = referenceDate ?? new Date();
  const window: WindowMonth[] = getWindowDates(referenceDate).map(({ offset, key, label }) => ({
    key,
    label,
    offset,
    strokes: calculateStrokesForMonth(tool, key),
  }));

  const forecastedStrokes = window.reduce((sum, m) => sum + m.strokes, 0);
  const currentMonthForecastedStrokes = window.find((m) => m.offset === 0)?.strokes ?? 0;
  const lastReset = getLastReset(tool);
  const hasMaintenanceInReferenceMonth = lastReset ? isSameMonth(lastReset.maintenanceDate, today) : false;
  const daysSinceReset = lastReset
    ? Math.floor((today.getTime() - lastReset.maintenanceDate.getTime()) / 86_400_000)
    : null;
  const cycleRecentlyReset = daysSinceReset !== null && daysSinceReset >= 0 && daysSinceReset <= RECENT_RESET_DAYS;
  const hasMonthlySnapshots = !!tool.monthlySnapshots?.length;
  const closedHistoricalStrokes = hasMonthlySnapshots
    ? getClosedHistoricalStrokes(tool, lastReset, today)
    : getEstimatedHistoricalBeforeCurrentMonth(tool, lastReset, today);
  const currentMonthElapsedStrokes = getCurrentMonthElapsedStrokes(tool, lastReset, today);
  // O que ainda falta produzir no mês corrente = previsão do mês − parte já decorrida desde o
  // dia 1 (independe de manutenção). Corrige o mês com manutenção, que antes subtraía o contador
  // inteiro (strokesAtMaintenance) e zerava o restante.
  const currentMonthElapsedFromStart = calculateEstimatedStrokes(startOfMonth(today), tool, today);
  const currentMonthRemainingToDo = Math.max(
    0,
    Math.round(currentMonthForecastedStrokes - currentMonthElapsedFromStart),
  );
  // Mesmo conceito — exposto também como currentMonthRemainingStrokes (compatibilidade).
  const currentMonthRemainingStrokes = currentMonthRemainingToDo;
  // Projeção do ciclo: sobre o acúmulo até hoje soma o que falta do mês + os meses futuros.
  const forecastedStrokesAfterMaintenance = getForecastedStrokesAfterMaintenance(
    window,
    currentMonthRemainingToDo,
  );

  let estimatedStrokes: number;
  // true quando a base do acúmulo já inclui a parte JÁ DECORRIDA do mês corrente
  // (estimativa ancorada em "hoje"). Nesse caso a projeção deve somar só o que
  // FALTA do mês + meses futuros — somar a janela inteira contaria o mês atual 2x.
  // false só para o contador estático (currentStrokes sem reset), que representa
  // um instante indefinido e portanto recebe a janela completa.
  let estimatedBaseAnchoredToToday: boolean;
  if (lastReset) {
    estimatedStrokes = hasMonthlySnapshots
      ? closedHistoricalStrokes + currentMonthElapsedStrokes
      : calculateEstimatedStrokes(lastReset.maintenanceDate, tool, today);
    estimatedBaseAnchoredToToday = true;
  } else if (tool.currentStrokes > 0) {
    estimatedStrokes = tool.currentStrokes;
    estimatedBaseAnchoredToToday = false;
  } else {
    estimatedStrokes = calculateEstimatedStrokes(startOfMonth(today), tool, today);
    estimatedBaseAnchoredToToday = true;
  }

  const realCycle = getRealCycleEstimate(tool, lastReset, today);
  const realCycleStrokes = realCycle?.reading.cycleStrokes ?? null;
  const realEstimatedStrokes = realCycle?.estimated ?? null;
  const latestRealReadingDate = realCycle ? realCycle.reading.readingDate.toISOString() : null;
  const daysSinceLastReading = realCycle
    ? Math.max(0, Math.floor((today.getTime() - realCycle.reading.readingDate.getTime()) / 86_400_000))
    : null;
  const readingStale = daysSinceLastReading !== null && daysSinceLastReading > STALE_READING_DAYS;
  // Acúmulo Real = leitura física crua (sem estimativa de dias). Saldo/status reais são um
  // "checkpoint" do estado na última medição.
  const realRemainingStrokes = realCycleStrokes !== null ? tool.preventiveLimit - realCycleStrokes : null;

  // Havendo leitura real do ciclo, o ESTIMADO (acúmulo vivo, saldo 50k e mês que atinge o limite) é
  // ancorado na leitura + dias decorridos; sem leitura, usa as batidas estimadas pela previsão.
  const hasRealReading = realEstimatedStrokes !== null;
  const projectionBaseStrokes = realEstimatedStrokes ?? estimatedStrokes;
  // Acúmulo Estimado exibido = base da projeção (leitura+dias quando há leitura; previsão caso contrário).
  const estimatedAccumulated = projectionBaseStrokes;

  // A leitura real é ancorada em hoje (leitura + dias decorridos); a base estimada
  // é ancorada conforme calculado acima. Quando ancorada em hoje, projeta com o
  // "falta do mês + futuros"; senão (contador estático) usa a janela completa.
  const baseAnchoredToToday = hasRealReading || estimatedBaseAnchoredToToday;
  const totalProjectedStrokes = baseAnchoredToToday
    ? projectionBaseStrokes + forecastedStrokesAfterMaintenance
    : projectionBaseStrokes + forecastedStrokes;
  const remainingStrokes = tool.preventiveLimit - totalProjectedStrokes;
  // Saldo atual = limite − acúmulo efetivo de hoje (sem projeção dos meses futuros).
  const currentRemainingStrokes = tool.preventiveLimit - Math.round(estimatedAccumulated);

  // VENCIDO só quando o acúmulo atual (real ou estimado) já passou do limite; a projeção
  // pode no máximo disparar PROGRAMAR_PREVENTIVA / ATENÇÃO (aviso antecipado).
  const status = getProjectedMaintenanceStatus(
    projectionBaseStrokes,
    totalProjectedStrokes,
    tool.preventiveLimit,
    tool.warningLimit,
    tool.shotsPerStroke,
  );
  // Status real: mesmos limiares, aplicados à leitura crua (checkpoint da última medição). Null sem leitura.
  const realStatus = realCycleStrokes !== null
    ? getMaintenanceStatus(0, realCycleStrokes, tool.preventiveLimit, tool.warningLimit, tool.shotsPerStroke)
    : null;
  // Status efetivo (badge da coluna "Status Real"): SEMPRE derivado do acúmulo vivo
  // (projectionBaseStrokes = leitura + dias decorridos, ou o estimado quando não há leitura).
  // É exatamente o número da coluna "Saldo 50k Atual" e o mesmo usado na ordenação, então
  // badge + saldo + ordem contam a mesma história. NÃO usa a leitura crua (realStatus) nem a
  // projeção de 4 meses: a crua deixava o badge atrasado (ex.: saldo atual baixo mas badge OK,
  // porque os dias decorridos ainda não entravam), e a projeção inflava tudo para "Programar".
  // A projeção de 4 meses só aparece na coluna "Atinge" e no toggle "Status Estimado". Como o
  // acúmulo vivo é sempre ≥ a leitura crua, o badge nunca fica mais brando que a medição real.
  const effectiveStatus: MaintenanceStatus = getMaintenanceStatus(
    0,
    Math.round(projectionBaseStrokes),
    tool.preventiveLimit,
    tool.warningLimit,
    tool.shotsPerStroke,
  );
  const statusFromEstimate = realStatus === null;
  // Mesma lógica do Projetado: base ancorada em hoje soma a partir do acúmulo vivo
  // (acúmulo + falta do mês + futuros); contador estático parte do zero do ciclo.
  const reachesLimitInMonth = baseAnchoredToToday
    ? getMonthWhenReachesLimitFromCycle(tool, projectionBaseStrokes, currentMonthRemainingToDo, referenceDate)
    : getMonthWhenReachesLimit(tool, referenceDate);

  const productBreakdown: ProductContribution[] = [];
  if (tool.shotsPerStroke > 0 && isFinite(tool.shotsPerStroke)) {
    const byProduct = new Map<string, ProductContribution>();
    for (const bomItem of tool.bomItems) {
      const { id: productId, code: productCode } = bomItem.product;
      if (!byProduct.has(productId)) {
        byProduct.set(productId, { productId, productCode, strokesByMonth: {}, totalStrokes: 0, projects: [] });
      }
      const entry = byProduct.get(productId)!;
      const projectProducts = bomItem.product.projectProducts;
      if (projectProducts) {
        for (const pp of projectProducts) {
          if (!entry.projects.some((x) => x.id === pp.project.id)) {
            entry.projects.push({ id: pp.project.id, name: pp.project.name });
          }
        }
      }
      const forecastSources = projectProducts && projectProducts.length > 0
        ? projectProducts.flatMap((pp) => pp.project.forecasts)
        : bomItem.product.forecasts;
      for (const forecast of forecastSources) {
        const key = toMonthKey(new Date(forecast.referenceMonth));
        const strokes = (forecast.plannedQuantity * bomItem.quantityUsed) / tool.shotsPerStroke;
        if (!isFinite(strokes)) continue;
        entry.strokesByMonth[key] = (entry.strokesByMonth[key] ?? 0) + strokes;
        entry.totalStrokes += strokes;
      }
    }
    productBreakdown.push(...byProduct.values());
  }

  return {
    toolId: tool.id,
    code: tool.code,
    description: tool.description,
    press: tool.press,
    line: tool.line,
    currentStrokes: tool.currentStrokes,
    lastMaintenanceDate: lastReset?.maintenanceDate.toISOString() ?? null,
    hasMaintenanceInReferenceMonth,
    daysSinceReset,
    cycleRecentlyReset,
    strokesAtLastMaintenance: lastReset?.strokesAtMaintenance ?? null,
    estimatedStrokes,
    estimatedAccumulated,
    forecastedStrokes,
    closedHistoricalStrokes,
    currentMonthForecastedStrokes,
    currentMonthRemainingStrokes,
    currentMonthRemainingToDo,
    forecastedStrokesAfterMaintenance,
    totalProjectedStrokes,
    remainingStrokes,
    latestRealReadingDate,
    daysSinceLastReading,
    readingStale,
    realCycleStrokes,
    realEstimatedStrokes,
    realRemainingStrokes,
    currentRemainingStrokes,
    realStatus,
    effectiveStatus,
    statusFromEstimate,
    preventiveLimit: tool.preventiveLimit,
    warningLimit: tool.warningLimit,
    status,
    reachesLimitInMonth,
    window,
    productBreakdown,
    errors,
  };
}

export function getAllToolsProjection(tools: ToolWithRelations[], referenceDate?: Date): ToolProjection[] {
  return tools.map((t) => getToolProjection(t, referenceDate));
}
