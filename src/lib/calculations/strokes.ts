// ─── Types ────────────────────────────────────────────────────────────────────

export type MaintenanceStatus =
  | "OK"
  | "ATENCAO"
  | "PROGRAMAR_PREVENTIVA"
  | "VENCIDO"
  | "ERRO_CADASTRO";

export type WindowMonth = {
  key: string;       // "YYYY-MM"
  label: string;     // "Mai/2026"
  offset: number;    // -1 | 0 | 1 | 2
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
  estimatedStrokes: number;        // calculado a partir da última manutenção + forecasts proporcionais
  forecastedStrokes: number;       // soma dos 4 meses da janela
  totalProjectedStrokes: number;
  remainingStrokes: number;
  preventiveLimit: number;
  warningLimit: number;
  status: MaintenanceStatus;
  reachesLimitInMonth?: string;
  window: WindowMonth[];           // N-1, N, N+1, N+2 individualmente
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
  };
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
  maintenanceRecords: { maintenanceDate: Date; resetCounter: boolean }[];
};

// ─── Portuguese month names ───────────────────────────────────────────────────

const PT_MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

function formatMonthPt(date: Date): string {
  return `${PT_MONTHS[date.getMonth()]}/${date.getFullYear()}`;
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// ─── Rolling window N-1, N, N+1, N+2 ─────────────────────────────────────────

export function getWindowDates(referenceDate?: Date): { offset: number; date: Date; key: string; label: string; planningLabel: string }[] {
  const now = referenceDate ?? new Date();
  return [0, 1, 2, 3].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    // offset 0 = mês atual = N-1 na nomenclatura de planejamento
    const label = ["N-1", "N", "N+1", "N+2"][offset];
    return { offset, date, key: toMonthKey(date), planningLabel: label, label: formatMonthPt(date) };
  });
}

// ─── calculateStrokesForMonth ─────────────────────────────────────────────────

function calculateStrokesForMonth(
  tool: ToolWithRelations,
  monthKey: string,
): number {
  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) {
    return 0;
  }

  let total = 0;
  for (const bomItem of tool.bomItems) {
    for (const forecast of bomItem.product.forecasts) {
      if (toMonthKey(new Date(forecast.referenceMonth)) !== monthKey) continue;
      const strokes = (forecast.plannedQuantity * bomItem.quantityUsed) / tool.shotsPerStroke;
      if (isFinite(strokes)) total += strokes;
    }
  }
  return total;
}

// ─── calculateForecastedStrokes ───────────────────────────────────────────────

/**
 * Soma de batidas previstas dentro da janela N-1, N, N+1, N+2.
 * Se referenceMonth for passado, usa apenas aquele mês (para chamadas pontuais).
 */
export function calculateForecastedStrokes(
  tool: ToolWithRelations,
  referenceMonth?: Date,
): number {
  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) {
    return 0;
  }

  if (referenceMonth) {
    // chamada pontual — mantém compatibilidade
    let total = 0;
    for (const bomItem of tool.bomItems) {
      for (const forecast of bomItem.product.forecasts) {
        if (!isSameMonth(new Date(forecast.referenceMonth), referenceMonth)) continue;
        const strokes = (forecast.plannedQuantity * bomItem.quantityUsed) / tool.shotsPerStroke;
        if (isFinite(strokes)) total += strokes;
      }
    }
    return total;
  }

  // janela rolante N-1..N+2
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

// ─── getMaintenanceStatus ─────────────────────────────────────────────────────

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

// ─── getMonthWhenReachesLimit ─────────────────────────────────────────────────

/**
 * Caminha pelos meses de N em diante (até 24) e retorna o primeiro em que
 * o acumulado cruzaria o preventiveLimit.
 * Usa apenas meses futuros (offset >= 0) pois N-1 já está no passado.
 */
export function getMonthWhenReachesLimit(tool: ToolWithRelations, referenceDate?: Date): string | undefined {
  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) {
    return undefined;
  }

  const now = referenceDate ?? new Date();
  let cumulative = tool.currentStrokes;

  for (let offset = 0; offset <= 23; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const key = toMonthKey(date);
    const strokes = calculateStrokesForMonth(tool, key);
    cumulative += strokes;
    if (cumulative >= tool.preventiveLimit) {
      return formatMonthPt(date);
    }
  }

  return undefined;
}

// ─── calculateEstimatedStrokes ────────────────────────────────────────────────
// Acumula batidas desde a data da última manutenção até hoje usando os forecasts
// proporcionalmente aos dias corridos em cada mês.

function calculateEstimatedStrokes(
  maintenanceDate: Date,
  tool: ToolWithRelations,
  today: Date = new Date(),
): number {
  let total = 0;

  // Caminha mês a mês desde o mês da manutenção até o mês atual
  let cursor = new Date(maintenanceDate.getFullYear(), maintenanceDate.getMonth(), 1);
  const todayMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  while (cursor <= todayMonthStart) {
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const monthKey = toMonthKey(cursor);
    const monthlyStrokes = calculateStrokesForMonth(tool, monthKey);

    const isMaintenanceMonth =
      cursor.getFullYear() === maintenanceDate.getFullYear() &&
      cursor.getMonth() === maintenanceDate.getMonth();
    const isTodayMonth =
      cursor.getFullYear() === today.getFullYear() &&
      cursor.getMonth() === today.getMonth();

    // dayFrom = exclusivo (conta a partir do dia seguinte ao evento)
    // dayTo   = inclusivo
    const dayFrom = isMaintenanceMonth ? maintenanceDate.getDate() : 0;
    const dayTo   = isTodayMonth       ? today.getDate()           : daysInMonth;

    const daysElapsed = dayTo - dayFrom;
    if (daysElapsed > 0 && monthlyStrokes > 0) {
      total += monthlyStrokes * (daysElapsed / daysInMonth);
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return Math.round(total);
}

// ─── getToolProjection ────────────────────────────────────────────────────────

export function getToolProjection(tool: ToolWithRelations, referenceDate?: Date): ToolProjection {
  const errors: string[] = [];

  if (!tool.shotsPerStroke || tool.shotsPerStroke <= 0 || !isFinite(tool.shotsPerStroke)) {
    errors.push("Quantidade por shot inválida (deve ser maior que zero)");
  }

  const today = referenceDate ?? new Date();
  const windowDates = getWindowDates(referenceDate);

  const window: WindowMonth[] = windowDates.map(({ offset, key, label }) => ({
    key,
    label,
    offset,
    strokes: calculateStrokesForMonth(tool, key),
  }));

  const forecastedStrokes = window.reduce((sum, m) => sum + m.strokes, 0);

  // Usa batidas estimadas (calculadas por dia desde a última manutenção) se disponível,
  // caso contrário usa o contador manual currentStrokes como fallback.
  const lastReset = tool.maintenanceRecords
    .filter((m) => m.resetCounter)
    .sort((a, b) => b.maintenanceDate.getTime() - a.maintenanceDate.getTime())[0];
  const hasMaintenanceInReferenceMonth = lastReset
    ? isSameMonth(lastReset.maintenanceDate, today)
    : false;

  let estimatedStrokes: number;
  if (lastReset) {
    // Calcula proporcionalmente desde a última manutenção
    estimatedStrokes = calculateEstimatedStrokes(lastReset.maintenanceDate, tool, today);
  } else if (tool.currentStrokes > 0) {
    // Sem manutenção registrada mas com valor manual: respeita o que foi digitado
    estimatedStrokes = tool.currentStrokes;
  } else {
    // Sem manutenção e sem valor manual: estima a partir do início do mês atual (N-1)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    estimatedStrokes = calculateEstimatedStrokes(startOfMonth, tool, today);
  }

  const totalProjectedStrokes = estimatedStrokes + forecastedStrokes;
  const remainingStrokes = tool.preventiveLimit - totalProjectedStrokes;

  const status = getMaintenanceStatus(
    estimatedStrokes,
    forecastedStrokes,
    tool.preventiveLimit,
    tool.warningLimit,
    tool.shotsPerStroke,
  );

  const reachesLimitInMonth = getMonthWhenReachesLimit(tool, referenceDate);

  const productBreakdown: ProductContribution[] = [];
  if (tool.shotsPerStroke > 0 && isFinite(tool.shotsPerStroke)) {
    const byProduct = new Map<string, ProductContribution>();
    for (const bomItem of tool.bomItems) {
      const { id: productId, code: productCode } = bomItem.product;
      if (!byProduct.has(productId)) {
        byProduct.set(productId, { productId, productCode, strokesByMonth: {}, totalStrokes: 0 });
      }
      const entry = byProduct.get(productId)!;
      for (const forecast of bomItem.product.forecasts) {
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
    estimatedStrokes,
    forecastedStrokes,
    totalProjectedStrokes,
    remainingStrokes,
    preventiveLimit: tool.preventiveLimit,
    warningLimit: tool.warningLimit,
    status,
    reachesLimitInMonth,
    window,
    productBreakdown,
    errors,
  };
}

// ─── getAllToolsProjection ────────────────────────────────────────────────────

export function getAllToolsProjection(tools: ToolWithRelations[], referenceDate?: Date): ToolProjection[] {
  return tools.map((t) => getToolProjection(t, referenceDate));
}
