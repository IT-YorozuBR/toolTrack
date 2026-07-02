/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const { getToolProjection, calculateClosedMonthStrokes } = require("./strokes.ts");

function monthDate(year, month, day = 1) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function forecast(year, month, plannedQuantity) {
  return {
    referenceMonth: monthDate(year, month),
    plannedQuantity,
  };
}

function makeTool(overrides = {}) {
  const forecasts =
    overrides.forecasts ??
    [
      forecast(2026, 5, 10000),
      forecast(2026, 6, 10000),
      forecast(2026, 7, 10000),
      forecast(2026, 8, 10000),
    ];

  return {
    id: "tool-1",
    code: "F-001",
    description: "Ferramental teste",
    press: "P1",
    line: "L1",
    shotsPerStroke: 2,
    currentStrokes: 0,
    preventiveLimit: 50000,
    warningLimit: 45000,
    bomItems: [
      {
        quantityUsed: 1,
        product: {
          id: "product-1",
          code: "PROD-1",
          forecasts,
        },
      },
    ],
    maintenanceRecords: [],
    ...overrides,
  };
}

function projectionSnapshot(projection) {
  return {
    code: projection.code,
    currentStrokes: projection.currentStrokes,
    lastMaintenanceDate: projection.lastMaintenanceDate,
    hasMaintenanceInReferenceMonth: projection.hasMaintenanceInReferenceMonth,
    estimatedStrokes: projection.estimatedStrokes,
    forecastedStrokes: projection.forecastedStrokes,
    totalProjectedStrokes: projection.totalProjectedStrokes,
    remainingStrokes: projection.remainingStrokes,
    status: projection.status,
    reachesLimitInMonth: projection.reachesLimitInMonth,
    window: projection.window.map(({ key, label, strokes }) => ({ key, label, strokes })),
    productBreakdown: projection.productBreakdown,
    errors: projection.errors,
  };
}

function calculationSnapshot(projection) {
  const { productBreakdown, ...snapshot } = projectionSnapshot(projection);
  return snapshot;
}

describe("Controle 50K projection", () => {
  it("keeps manual current strokes when there is no maintenance record", () => {
    const projection = getToolProjection(makeTool({ currentStrokes: 1234 }), monthDate(2026, 5, 20));

    assert.deepStrictEqual(projectionSnapshot(projection), {
      code: "F-001",
      currentStrokes: 1234,
      lastMaintenanceDate: null,
      hasMaintenanceInReferenceMonth: false,
      estimatedStrokes: 1234,
      forecastedStrokes: 20000,
      totalProjectedStrokes: 21234,
      remainingStrokes: 28766,
      status: "OK",
      reachesLimitInMonth: undefined,
      window: [
        { key: "2026-05", label: "Mai/2026", strokes: 5000 },
        { key: "2026-06", label: "Jun/2026", strokes: 5000 },
        { key: "2026-07", label: "Jul/2026", strokes: 5000 },
        { key: "2026-08", label: "Ago/2026", strokes: 5000 },
      ],
      productBreakdown: [
        {
          productId: "product-1",
          productCode: "PROD-1",
          strokesByMonth: {
            "2026-05": 5000,
            "2026-06": 5000,
            "2026-07": 5000,
            "2026-08": 5000,
          },
          totalStrokes: 20000,
          projects: [],
        },
      ],
      errors: [],
    });
  });

  it("estimates only elapsed strokes after maintenance in the current month", () => {
    const projection = getToolProjection(
      makeTool({
        currentStrokes: 40000,
        maintenanceRecords: [{ maintenanceDate: monthDate(2026, 5, 10), resetCounter: true }],
      }),
      monthDate(2026, 5, 20),
    );

    assert.equal(projection.hasMaintenanceInReferenceMonth, true);
    assert.equal(projection.lastMaintenanceDate, "2026-05-10T12:00:00.000Z");
    assert.equal(projection.estimatedStrokes, 1613);
    assert.equal(projection.forecastedStrokes, 20000);
    // Projeção = acúmulo até hoje (1613) + o que falta do mês (1935) + meses futuros (15000).
    assert.equal(projection.totalProjectedStrokes, 18548);
    assert.equal(projection.remainingStrokes, 31452);
    assert.equal(projection.status, "OK");
  });

  it("snapshots the month rollover calculation after a previous-month maintenance", () => {
    const projection = getToolProjection(
      makeTool({
        forecasts: [
          forecast(2026, 5, 6200),
          forecast(2026, 6, 6000),
          forecast(2026, 7, 8000),
          forecast(2026, 8, 10000),
          forecast(2026, 9, 12000),
        ],
        maintenanceRecords: [{ maintenanceDate: monthDate(2026, 5, 20), resetCounter: true }],
      }),
      monthDate(2026, 6, 10),
    );

    assert.deepStrictEqual(projectionSnapshot(projection), {
      code: "F-001",
      currentStrokes: 0,
      lastMaintenanceDate: "2026-05-20T12:00:00.000Z",
      hasMaintenanceInReferenceMonth: false,
      estimatedStrokes: 2100,
      forecastedStrokes: 18000,
      totalProjectedStrokes: 19200,
      remainingStrokes: 30800,
      status: "OK",
      reachesLimitInMonth: undefined,
      window: [
        { key: "2026-06", label: "Jun/2026", strokes: 3000 },
        { key: "2026-07", label: "Jul/2026", strokes: 4000 },
        { key: "2026-08", label: "Ago/2026", strokes: 5000 },
        { key: "2026-09", label: "Set/2026", strokes: 6000 },
      ],
      productBreakdown: [
        {
          productId: "product-1",
          productCode: "PROD-1",
          strokesByMonth: {
            "2026-05": 3100,
            "2026-06": 3000,
            "2026-07": 4000,
            "2026-08": 5000,
            "2026-09": 6000,
          },
          totalStrokes: 21100,
          projects: [],
        },
      ],
      errors: [],
    });
  });

  it("does not change the projection snapshot when an old forecast before maintenance changes", () => {
    const referenceDate = monthDate(2026, 6, 15);
    const commonForecasts = [
      forecast(2026, 5, 6200),
      forecast(2026, 6, 6000),
      forecast(2026, 7, 8000),
      forecast(2026, 8, 10000),
      forecast(2026, 9, 12000),
    ];
    const commonTool = {
      maintenanceRecords: [{ maintenanceDate: monthDate(2026, 5, 20), resetCounter: true }],
    };
    const before = calculationSnapshot(
      getToolProjection(
        makeTool({
          ...commonTool,
          forecasts: [forecast(2026, 4, 2000), ...commonForecasts],
        }),
        referenceDate,
      ),
    );
    const after = calculationSnapshot(
      getToolProjection(
        makeTool({
          ...commonTool,
          forecasts: [forecast(2026, 4, 999999), ...commonForecasts],
        }),
        referenceDate,
      ),
    );

    assert.deepStrictEqual(after, before);
  });

  it("prorates strokes when maintenance happens in the middle of the month", () => {
    const projection = getToolProjection(
      makeTool({
        forecasts: [forecast(2026, 5, 31000), forecast(2026, 6, 0), forecast(2026, 7, 0), forecast(2026, 8, 0)],
        maintenanceRecords: [{ maintenanceDate: monthDate(2026, 5, 15), resetCounter: true, strokesAtMaintenance: 7000 }],
      }),
      monthDate(2026, 5, 31),
    );

    assert.equal(projection.estimatedStrokes, 8000);
    assert.equal(projection.hasMaintenanceInReferenceMonth, true);
    assert.equal(projection.forecastedStrokes, 15500);
    // Falta produzir no mês = previsão do mês (15500) menos o já decorrido desde o dia 1 (15000).
    assert.equal(projection.currentMonthRemainingStrokes, 500);
    assert.equal(projection.currentMonthRemainingToDo, 500);
    // Projeção = acúmulo até hoje (8000) + o que falta do mês (500) + futuros (0).
    assert.equal(projection.totalProjectedStrokes, 8500);
  });

  it("leaves real-cycle fields null when there is no stroke reading", () => {
    const projection = getToolProjection(makeTool(), monthDate(2026, 5, 20));

    assert.equal(projection.latestRealReadingDate, null);
    assert.equal(projection.realCycleStrokes, null);
    assert.equal(projection.realEstimatedStrokes, null);
    assert.equal(projection.realRemainingStrokes, null);
    assert.equal(projection.realStatus, null);
  });

  it("anchors the real balance on the latest reading and grows it by the daily estimate", () => {
    const projection = getToolProjection(
      makeTool({
        forecasts: [forecast(2026, 6, 6000)], // 6000 / 2 shots = 3000 batidas/mês
        strokeReadings: [{ readingDate: monthDate(2026, 6, 1), cycleStrokes: 20000 }],
      }),
      monthDate(2026, 6, 16), // 15 de 30 dias decorridos → +1500
    );

    assert.equal(projection.latestRealReadingDate, "2026-06-01T12:00:00.000Z");
    // Acúmulo Real = leitura crua (sem dias); Saldo Real = checkpoint da última medição.
    assert.equal(projection.realCycleStrokes, 20000);
    assert.equal(projection.realRemainingStrokes, 30000); // 50000 - 20000 (leitura crua)
    assert.equal(projection.realStatus, "OK");
    // O crescimento por dias agora vive no estimado: leitura (20000) + 1500 dias = 21500.
    assert.equal(projection.realEstimatedStrokes, 21500);
    assert.equal(projection.estimatedAccumulated, 21500);
    // Projeção ancorada no acúmulo estimado (21500) + o que FALTA do mês (1500);
    // os 1500 já decorridos do mês estão dentro dos 21500, não somam de novo.
    assert.equal(projection.totalProjectedStrokes, 23000);
    assert.equal(projection.remainingStrokes, 27000);
    assert.equal(projection.status, "OK");
    assert.equal(projection.reachesLimitInMonth, undefined);
  });

  it("falls back to estimated strokes for the projection when there is no real reading", () => {
    const withReal = getToolProjection(
      makeTool({
        forecasts: [forecast(2026, 6, 6000)],
        strokeReadings: [{ readingDate: monthDate(2026, 6, 1), cycleStrokes: 20000 }],
      }),
      monthDate(2026, 6, 16),
    );
    const withoutReal = getToolProjection(
      makeTool({ forecasts: [forecast(2026, 6, 6000)] }),
      monthDate(2026, 6, 16),
    );

    // Sem leitura, a projeção usa as batidas estimadas (base menor) → saldo maior.
    assert.equal(withoutReal.realEstimatedStrokes, null);
    assert.equal(withoutReal.remainingStrokes, 47000); // 50000 - (1500 decorrido + 1500 falta do mês)
    assert.ok(withReal.remainingStrokes < withoutReal.remainingStrokes);
  });

  it("ignores readings taken before the last reset and uses the in-cycle reading", () => {
    const projection = getToolProjection(
      makeTool({
        maintenanceRecords: [{ maintenanceDate: monthDate(2026, 5, 10), resetCounter: true }],
        strokeReadings: [
          { readingDate: monthDate(2026, 5, 5), cycleStrokes: 9999 }, // antes do reset → ignorada
          { readingDate: monthDate(2026, 5, 15), cycleStrokes: 25000 }, // no ciclo
        ],
      }),
      monthDate(2026, 5, 15),
    );

    assert.equal(projection.latestRealReadingDate, "2026-05-15T12:00:00.000Z");
    assert.equal(projection.realCycleStrokes, 25000);
    assert.equal(projection.realEstimatedStrokes, 25000);
    assert.equal(projection.realRemainingStrokes, 25000);
    assert.equal(projection.realStatus, "OK");
  });

  it("ignores a reading taken at the exact reset instant (treats maintenance as a fresh checkpoint)", () => {
    const projection = getToolProjection(
      makeTool({
        maintenanceRecords: [{ maintenanceDate: monthDate(2026, 5, 10), resetCounter: true }],
        strokeReadings: [
          // Mesma data/instante do reset → pertence ao ciclo anterior, deve ser ignorada.
          { readingDate: monthDate(2026, 5, 10), cycleStrokes: 32000 },
        ],
      }),
      monthDate(2026, 5, 10),
    );

    // Sem leitura posterior ao reset: o real fica indefinido e o status cai para o estimado.
    assert.equal(projection.realCycleStrokes, null);
    assert.equal(projection.realEstimatedStrokes, null);
    assert.equal(projection.realRemainingStrokes, null);
    assert.equal(projection.realStatus, null);
    assert.equal(projection.statusFromEstimate, true);
  });

  it("derives the real status from the real accumulated reading", () => {
    const projection = getToolProjection(
      makeTool({
        forecasts: [forecast(2026, 5, 0)], // sem crescimento: status vem só da leitura
        strokeReadings: [{ readingDate: monthDate(2026, 5, 20), cycleStrokes: 47000 }],
      }),
      monthDate(2026, 5, 20),
    );

    assert.equal(projection.realEstimatedStrokes, 47000);
    assert.equal(projection.realRemainingStrokes, 3000);
    assert.equal(projection.realStatus, "PROGRAMAR_PREVENTIVA"); // >= warningLimit (45000)
  });

  it("uses the estimated status as the effective status when there is no real reading", () => {
    const projection = getToolProjection(makeTool(), monthDate(2026, 5, 20));

    assert.equal(projection.realStatus, null);
    assert.equal(projection.statusFromEstimate, true);
    assert.equal(projection.effectiveStatus, projection.status);
  });

  it("falls back to the current-accumulation status (not the 4-month projection) when there is no real reading", () => {
    const projection = getToolProjection(
      makeTool({
        forecasts: [
          forecast(2026, 5, 40000),
          forecast(2026, 6, 40000),
          forecast(2026, 7, 40000),
          forecast(2026, 8, 40000),
        ],
      }),
      monthDate(2026, 5, 10),
    );

    assert.equal(projection.realStatus, null);
    assert.equal(projection.statusFromEstimate, true);
    // A projeção de 4 meses fura o limite → status projetado (visão Estimado) é PROGRAMAR...
    assert.equal(projection.status, "PROGRAMAR_PREVENTIVA");
    // ...mas o acúmulo atual estimado ainda está baixo, então o status efetivo (visão Real
    // sem leitura) cai para OK, casando com a coluna "Saldo 50k Atual".
    assert.ok(projection.estimatedAccumulated < 40000);
    assert.equal(projection.effectiveStatus, "OK");
  });

  it("uses the real status as the effective status when there is a reading", () => {
    const projection = getToolProjection(
      makeTool({
        forecasts: [forecast(2026, 5, 0)],
        strokeReadings: [{ readingDate: monthDate(2026, 5, 20), cycleStrokes: 47000 }],
      }),
      monthDate(2026, 5, 20),
    );

    assert.equal(projection.realStatus, "PROGRAMAR_PREVENTIVA");
    assert.equal(projection.statusFromEstimate, false);
    assert.equal(projection.effectiveStatus, "PROGRAMAR_PREVENTIVA");
  });

  it("drives the effective status from the live accumulation (reading + days), not the raw reading, so the badge matches Saldo 50k Atual", () => {
    const projection = getToolProjection(
      makeTool({
        forecasts: [forecast(2026, 6, 12000)], // 12000 / 2 = 6000 batidas/mês → +3000 em 15 dias
        strokeReadings: [{ readingDate: monthDate(2026, 6, 1), cycleStrokes: 44000 }],
      }),
      monthDate(2026, 6, 16),
    );

    assert.equal(projection.realCycleStrokes, 44000);
    assert.equal(projection.realStatus, "ATENCAO"); // leitura crua 44000 → 40k–45k
    assert.equal(projection.estimatedAccumulated, 47000); // leitura + dias
    // O badge segue o acúmulo vivo (47000 → 45k–50k), não a leitura crua.
    assert.equal(projection.effectiveStatus, "PROGRAMAR_PREVENTIVA");
  });

  it("marks VENCIDO in the effective status when the live estimate passes the limit, even if the raw reading is still below", () => {
    const projection = getToolProjection(
      makeTool({
        forecasts: [forecast(2026, 6, 12000)], // 12000 / 2 = 6000 batidas/mês → +3000 em 15 dias
        strokeReadings: [{ readingDate: monthDate(2026, 6, 1), cycleStrokes: 48000 }],
      }),
      monthDate(2026, 6, 16),
    );

    assert.equal(projection.realCycleStrokes, 48000);
    assert.equal(projection.realStatus, "PROGRAMAR_PREVENTIVA"); // leitura crua < 50000
    assert.equal(projection.estimatedAccumulated, 51000); // leitura + dias já passou do limite
    assert.ok(projection.currentRemainingStrokes < 0); // Saldo 50k Atual negativo
    assert.equal(projection.effectiveStatus, "VENCIDO"); // status efetivo escala para VENCIDO
  });

  it("does not mark VENCIDO from the projection alone — only programs the preventive", () => {
    const projection = getToolProjection(
      makeTool({
        currentStrokes: 30000, // acúmulo atual longe do limite
        forecasts: [
          forecast(2026, 5, 12000),
          forecast(2026, 6, 12000),
          forecast(2026, 7, 12000),
          forecast(2026, 8, 12000),
        ],
      }),
      monthDate(2026, 5, 20),
    );

    assert.equal(projection.estimatedStrokes, 30000);
    assert.ok(projection.totalProjectedStrokes >= 50000); // a projeção estoura o limite
    assert.equal(projection.status, "PROGRAMAR_PREVENTIVA"); // mas NÃO aparece como vencido
  });

  it("marks VENCIDO only when the current accumulation already reached the limit", () => {
    const projection = getToolProjection(
      makeTool({ currentStrokes: 51000 }),
      monthDate(2026, 5, 20),
    );

    assert.equal(projection.status, "VENCIDO");
  });

  it("prorates the maintenance month's closed strokes by days after the reset (not by the lifetime counter)", () => {
    // Mai = 10000 batidas (qty 10000 / 1 shot), reset dia 15 com contador de vida 48000.
    // Só a parte pós-reset conta: 10000 * (31-15)/31 = 5161. NÃO deve virar 0 por subtrair 48000.
    const tool = makeTool({
      shotsPerStroke: 1,
      forecasts: [forecast(2026, 5, 10000), forecast(2026, 6, 10000), forecast(2026, 7, 10000)],
      maintenanceRecords: [{ maintenanceDate: monthDate(2026, 5, 15), resetCounter: true, strokesAtMaintenance: 48000 }],
    });

    assert.equal(calculateClosedMonthStrokes(tool, monthDate(2026, 5)), 5161);
    assert.equal(calculateClosedMonthStrokes(tool, monthDate(2026, 6)), 10000);
  });

  it("agrees between snapshot and non-snapshot paths for the cycle accumulation", () => {
    const common = {
      shotsPerStroke: 1,
      forecasts: [forecast(2026, 5, 10000), forecast(2026, 6, 10000), forecast(2026, 7, 10000)],
      maintenanceRecords: [{ maintenanceDate: monthDate(2026, 5, 15), resetCounter: true, strokesAtMaintenance: 48000 }],
    };
    const today = monthDate(2026, 7, 15);
    const noSnap = getToolProjection(makeTool(common), today);
    const withSnap = getToolProjection(
      makeTool({
        ...common,
        monthlySnapshots: [
          { referenceMonth: monthDate(2026, 5), strokes: 5161, cycleStartedAt: monthDate(2026, 5, 15) },
          { referenceMonth: monthDate(2026, 6), strokes: 10000, cycleStartedAt: monthDate(2026, 5, 15) },
        ],
      }),
      today,
    );

    // Ambos os caminhos devem convergir (~20000), sem subcontar o mês da manutenção.
    // Diferem só por arredondamento (snapshot arredonda cada mês; o outro uma vez ao fim) —
    // o que importa é a proximidade e que não caiam para o ~14516 do bug antigo.
    assert.ok(noSnap.estimatedStrokes > 19000, `esperado > 19000, veio ${noSnap.estimatedStrokes}`);
    assert.ok(withSnap.estimatedStrokes > 19000, `esperado > 19000, veio ${withSnap.estimatedStrokes}`);
    assert.ok(
      Math.abs(withSnap.estimatedStrokes - noSnap.estimatedStrokes) < 400,
      `caminhos divergem: snap=${withSnap.estimatedStrokes} vs noSnap=${noSnap.estimatedStrokes}`,
    );
  });

  it("reports a registration error and zeroes calculated strokes for invalid shotsPerStroke", () => {
    const projection = getToolProjection(makeTool({ shotsPerStroke: 0, currentStrokes: 1200 }), monthDate(2026, 5, 20));

    assert.deepStrictEqual(projectionSnapshot(projection), {
      code: "F-001",
      currentStrokes: 1200,
      lastMaintenanceDate: null,
      hasMaintenanceInReferenceMonth: false,
      estimatedStrokes: 1200,
      forecastedStrokes: 0,
      totalProjectedStrokes: 1200,
      remainingStrokes: 48800,
      status: "ERRO_CADASTRO",
      reachesLimitInMonth: undefined,
      window: [
        { key: "2026-05", label: "Mai/2026", strokes: 0 },
        { key: "2026-06", label: "Jun/2026", strokes: 0 },
        { key: "2026-07", label: "Jul/2026", strokes: 0 },
        { key: "2026-08", label: "Ago/2026", strokes: 0 },
      ],
      productBreakdown: [],
      errors: ["Quantidade por shot invalida (deve ser maior que zero)"],
    });
  });
});
