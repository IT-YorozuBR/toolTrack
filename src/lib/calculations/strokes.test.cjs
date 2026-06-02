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

const { getToolProjection } = require("./strokes.ts");

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
    assert.equal(projection.totalProjectedStrokes, 21613);
    assert.equal(projection.remainingStrokes, 28387);
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
      totalProjectedStrokes: 20100,
      remainingStrokes: 29900,
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
    assert.equal(projection.currentMonthRemainingStrokes, 8500);
    assert.equal(projection.totalProjectedStrokes, 16500);
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
