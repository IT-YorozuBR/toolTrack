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
  strokesAtLastMaintenance: number | null;
  estimatedStrokes: number;
  forecastedStrokes: number;
  closedHistoricalStrokes: number;
  currentMonthForecastedStrokes: number;
  currentMonthRemainingStrokes: number;
  currentMonthRemainingToDo: number;
  forecastedStrokesAfterMaintenance: number;
  totalProjectedStrokes: number;
  remainingStrokes: number;
  latestRealReadingDate: string | null;
  realCycleStrokes: number | null;
  realEstimatedStrokes: number | null;
  realRemainingStrokes: number | null;
  realStatus: MaintenanceStatus | null;
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
  bomItems: BomItemWithProduct[];
  maintenanceRecords: MaintenanceRecordForProjection[];
  monthlySnapshots?: MonthlySnapshotForProjection[];
  strokeReadings?: StrokeReadingForProjection[];
};

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
    return Math.max(
      0,
      Math.round(monthlyStrokes - (lastResetBeforeMonthEnd.strokesAtMaintenance ?? 0)),
    );
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
// anteriores ao último reset (manutenção) são ignoradas — pertencem a outro ciclo.
function getRealCycleEstimate(
  tool: ToolWithRelations,
  lastReset: MaintenanceRecordForProjection | undefined,
  today: Date,
): { reading: StrokeReadingForProjection; estimated: number } | null {
  if (!tool.strokeReadings?.length) return null;
  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) return null;

  const cycleStart = lastReset?.maintenanceDate ?? null;
  // Comparar por dia de calendário: leituras gravadas ao meio-dia de hoje não podem
  // ser descartadas só porque o instante atual ainda é de manhã.
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const reading = tool.strokeReadings
    .map((r) => ({ ...r, readingDate: new Date(r.readingDate) }))
    .filter((r) => r.readingDate <= todayEnd && (!cycleStart || r.readingDate >= cycleStart))
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

function getCurrentMonthRemainingStrokes(
  lastReset: MaintenanceRecordForProjection | undefined,
  currentMonthStrokes: number,
  today: Date,
): number {
  if (lastReset && isSameMonth(lastReset.maintenanceDate, today)) {
    return Math.max(0, Math.round(currentMonthStrokes - (lastReset.strokesAtMaintenance ?? 0)));
  }
  return Math.round(currentMonthStrokes);
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
  const hasMonthlySnapshots = !!tool.monthlySnapshots?.length;
  const closedHistoricalStrokes = hasMonthlySnapshots
    ? getClosedHistoricalStrokes(tool, lastReset, today)
    : getEstimatedHistoricalBeforeCurrentMonth(tool, lastReset, today);
  const currentMonthElapsedStrokes = getCurrentMonthElapsedStrokes(tool, lastReset, today);
  const currentMonthRemainingStrokes = getCurrentMonthRemainingStrokes(
    lastReset,
    currentMonthForecastedStrokes,
    today,
  );
  // O que ainda falta produzir no mês corrente: previsão do mês menos o que já decorreu até hoje.
  const currentMonthRemainingToDo = Math.max(
    0,
    Math.round(currentMonthRemainingStrokes - currentMonthElapsedStrokes),
  );
  const forecastedStrokesAfterMaintenance = getForecastedStrokesAfterMaintenance(
    window,
    currentMonthRemainingStrokes,
  );

  let estimatedStrokes: number;
  if (lastReset) {
    estimatedStrokes = hasMonthlySnapshots
      ? closedHistoricalStrokes + currentMonthElapsedStrokes
      : calculateEstimatedStrokes(lastReset.maintenanceDate, tool, today);
  } else if (tool.currentStrokes > 0) {
    estimatedStrokes = tool.currentStrokes;
  } else {
    estimatedStrokes = calculateEstimatedStrokes(startOfMonth(today), tool, today);
  }

  const realCycle = getRealCycleEstimate(tool, lastReset, today);
  const realCycleStrokes = realCycle?.reading.cycleStrokes ?? null;
  const realEstimatedStrokes = realCycle?.estimated ?? null;
  const latestRealReadingDate = realCycle ? realCycle.reading.readingDate.toISOString() : null;
  const realRemainingStrokes = realEstimatedStrokes !== null ? tool.preventiveLimit - realEstimatedStrokes : null;

  // Havendo leitura real do ciclo, a projeção (Saldo 50k Estimado e mês que atinge o limite) é
  // ancorada no acúmulo real em vez das batidas estimadas. Sem leitura, usa o estimado.
  const hasRealReading = realEstimatedStrokes !== null;
  const projectionBaseStrokes = realEstimatedStrokes ?? estimatedStrokes;

  const totalProjectedStrokes = lastReset
    ? projectionBaseStrokes + forecastedStrokesAfterMaintenance
    : projectionBaseStrokes + forecastedStrokes;
  const remainingStrokes = tool.preventiveLimit - totalProjectedStrokes;

  const status = getMaintenanceStatus(0, totalProjectedStrokes, tool.preventiveLimit, tool.warningLimit, tool.shotsPerStroke);
  // Status real: mesmos limiares, porém aplicados só ao acúmulo real (estado atual). Null sem leitura.
  const realStatus = realEstimatedStrokes !== null
    ? getMaintenanceStatus(0, realEstimatedStrokes, tool.preventiveLimit, tool.warningLimit, tool.shotsPerStroke)
    : null;
  const reachesLimitInMonth = (lastReset || hasRealReading)
    ? getMonthWhenReachesLimitFromCycle(tool, projectionBaseStrokes, currentMonthRemainingToDo, referenceDate)
    : getMonthWhenReachesLimit(tool, referenceDate);

  const productBreakdown: ProductContribution[] = [];
  if (tool.shotsPerStroke > 0 && isFinite(tool.shotsPerStroke)) {
    const byProduct = new Map<string, ProductContribution>();
    for (const bomItem of tool.bomItems) {
      const { id: productId, code: productCode } = bomItem.product;
      if (!byProduct.has(productId)) {
        byProduct.set(productId, { productId, productCode, strokesByMonth: {}, totalStrokes: 0 });
      }
      const entry = byProduct.get(productId)!;
      const projectProducts = bomItem.product.projectProducts;
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
    strokesAtLastMaintenance: lastReset?.strokesAtMaintenance ?? null,
    estimatedStrokes,
    forecastedStrokes,
    closedHistoricalStrokes,
    currentMonthForecastedStrokes,
    currentMonthRemainingStrokes,
    currentMonthRemainingToDo,
    forecastedStrokesAfterMaintenance,
    totalProjectedStrokes,
    remainingStrokes,
    latestRealReadingDate,
    realCycleStrokes,
    realEstimatedStrokes,
    realRemainingStrokes,
    realStatus,
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
