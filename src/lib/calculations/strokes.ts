// ─── Types ────────────────────────────────────────────────────────────────────

export type MaintenanceStatus =
  | "OK"
  | "ATENCAO"
  | "PROGRAMAR_PREVENTIVA"
  | "VENCIDO"
  | "ERRO_CADASTRO";

export type ToolProjection = {
  toolId: string;
  code: string;
  description?: string | null;
  press: string;
  line?: string | null;
  currentStrokes: number;
  forecastedStrokes: number;
  totalProjectedStrokes: number;
  remainingStrokes: number;
  preventiveLimit: number;
  warningLimit: number;
  status: MaintenanceStatus;
  reachesLimitInMonth?: string;
  errors: string[];
};

type BomItemWithProduct = {
  quantityUsed: number;
  product: {
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
};

// ─── Portuguese month names ───────────────────────────────────────────────────

const PT_MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

function formatMonthPt(date: Date): string {
  return `${PT_MONTHS[date.getMonth()]}/${date.getFullYear()}`;
}

// ─── Helper: normalise a Date to the first day of its month (UTC midnight) ────

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// ─── calculateForecastedStrokes ───────────────────────────────────────────────

/**
 * Sum of expected strokes from all BOM forecasts.
 * If referenceMonth is provided, only forecasts for that exact month are used.
 * Returns 0 when shotsPerStroke is invalid to avoid division-by-zero.
 */
export function calculateForecastedStrokes(
  tool: ToolWithRelations,
  referenceMonth?: Date,
): number {
  if (
    !tool.shotsPerStroke ||
    tool.shotsPerStroke <= 0 ||
    !isFinite(tool.shotsPerStroke)
  ) {
    return 0;
  }

  let total = 0;

  for (const bomItem of tool.bomItems) {
    const forecasts = referenceMonth
      ? bomItem.product.forecasts.filter((f) =>
          isSameMonth(new Date(f.referenceMonth), referenceMonth),
        )
      : bomItem.product.forecasts;

    for (const forecast of forecasts) {
      const strokes =
        (forecast.plannedQuantity * bomItem.quantityUsed) / tool.shotsPerStroke;
      if (isFinite(strokes)) {
        total += strokes;
      }
    }
  }

  return total;
}

// ─── getMaintenanceStatus ─────────────────────────────────────────────────────

/**
 * Derives the maintenance status based on projected total strokes.
 *
 * Status ladder (highest priority first):
 *   ERRO_CADASTRO         — invalid shotsPerStroke
 *   VENCIDO               — totalProjected >= preventiveLimit
 *   PROGRAMAR_PREVENTIVA  — totalProjected >= warningLimit
 *   ATENCAO               — totalProjected >= warningLimit - 5 000
 *   OK                    — otherwise
 */
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
 * Walks forward through forecast months (up to 24) and returns the first month
 * label (e.g. "Julho/2026") where cumulative strokes would reach preventiveLimit.
 * Returns undefined if the limit is never reached within the forecast horizon.
 */
export function getMonthWhenReachesLimit(
  tool: ToolWithRelations,
): string | undefined {
  if (
    !tool.shotsPerStroke ||
    tool.shotsPerStroke <= 0 ||
    !isFinite(tool.shotsPerStroke)
  ) {
    return undefined;
  }

  // Build a map: monthKey -> total strokes forecasted for that month
  const strokesByMonth = new Map<string, { date: Date; strokes: number }>();

  for (const bomItem of tool.bomItems) {
    for (const forecast of bomItem.product.forecasts) {
      const refDate = new Date(forecast.referenceMonth);
      const key = toMonthKey(refDate);
      const strokes =
        (forecast.plannedQuantity * bomItem.quantityUsed) / tool.shotsPerStroke;

      if (!isFinite(strokes)) continue;

      const existing = strokesByMonth.get(key);
      if (existing) {
        existing.strokes += strokes;
      } else {
        strokesByMonth.set(key, { date: refDate, strokes });
      }
    }
  }

  // Sort months ascending
  const sortedMonths = Array.from(strokesByMonth.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // Limit to 24 months
  const horizon = sortedMonths.slice(0, 24);

  let cumulative = tool.currentStrokes;

  for (const { date, strokes } of horizon) {
    cumulative += strokes;
    if (cumulative >= tool.preventiveLimit) {
      return formatMonthPt(date);
    }
  }

  return undefined;
}

// ─── getToolProjection ────────────────────────────────────────────────────────

/**
 * Builds a complete ToolProjection for a single tool.
 * Never throws — errors are surfaced in the `errors` array.
 */
export function getToolProjection(tool: ToolWithRelations): ToolProjection {
  const errors: string[] = [];

  if (
    !tool.shotsPerStroke ||
    tool.shotsPerStroke <= 0 ||
    !isFinite(tool.shotsPerStroke)
  ) {
    errors.push("Quantidade por shot inválida (deve ser maior que zero)");
  }

  const forecastedStrokes = calculateForecastedStrokes(tool);
  const totalProjectedStrokes = tool.currentStrokes + forecastedStrokes;
  const remainingStrokes = tool.preventiveLimit - totalProjectedStrokes;

  const status = getMaintenanceStatus(
    tool.currentStrokes,
    forecastedStrokes,
    tool.preventiveLimit,
    tool.warningLimit,
    tool.shotsPerStroke,
  );

  const reachesLimitInMonth = getMonthWhenReachesLimit(tool);

  return {
    toolId: tool.id,
    code: tool.code,
    description: tool.description,
    press: tool.press,
    line: tool.line,
    currentStrokes: tool.currentStrokes,
    forecastedStrokes,
    totalProjectedStrokes,
    remainingStrokes,
    preventiveLimit: tool.preventiveLimit,
    warningLimit: tool.warningLimit,
    status,
    reachesLimitInMonth,
    errors,
  };
}

// ─── getAllToolsProjection ────────────────────────────────────────────────────

/**
 * Returns a ToolProjection for every tool in the array.
 */
export function getAllToolsProjection(
  tools: ToolWithRelations[],
): ToolProjection[] {
  return tools.map(getToolProjection);
}
