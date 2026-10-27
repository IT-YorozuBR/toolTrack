/* eslint-disable @typescript-eslint/no-require-imports */
// Testes de updateMaintenanceRecord com prisma/audit/revalidatePath mockados.
// Foco: editar manutenções que NÃO são a mais recente do ferramental.
const assert = require("node:assert/strict");
const { describe, it, beforeEach } = require("node:test");
const Module = require("node:module");
const path = require("node:path");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});

const srcDir = path.resolve(__dirname, "..", "..");

// Estado e chamadas capturadas pelos mocks (resetado a cada teste).
let db;
let calls;

const prismaMock = {
  maintenanceRecord: {
    findUnique: async () => db.existing,
    findFirst: async () => db.latest,
    update: async (args) => {
      calls.recordUpdates.push(args);
      return { ...db.existing, ...args.data };
    },
  },
  tool: {
    findUnique: async () => db.tool,
    update: async (args) => {
      calls.toolUpdates.push(args);
    },
  },
  toolMonthlyStrokeSnapshot: {
    deleteMany: async (args) => {
      calls.snapshotDeletes.push(args);
    },
    upsert: async (args) => {
      calls.snapshotUpserts.push(args);
    },
  },
  $transaction: async (fn) => {
    calls.transactions++;
    return fn(prismaMock);
  },
};

const mocks = {
  "@/lib/prisma": { prisma: prismaMock },
  "next/cache": {
    revalidatePath: (p) => calls.revalidated.push(p),
  },
  "@/lib/audit": {
    logAudit: async (p) => calls.audits.push(p),
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  if (request.startsWith("@/")) {
    request = path.join(srcDir, request.slice(2));
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { updateMaintenanceRecord } = require("./maintenance.ts");

const OLD_DATE = new Date("2026-03-10T12:00:00.000Z");
const LATEST_DATE = new Date("2026-05-20T12:00:00.000Z");

function existingRecord(overrides = {}) {
  return {
    id: "old",
    toolId: "tool-1",
    maintenanceDate: OLD_DATE,
    strokesAtMaintenance: 40000,
    previousStrokes: 38000,
    resetCounter: true,
    ...overrides,
  };
}

function payload(overrides = {}) {
  return {
    maintenanceDate: OLD_DATE,
    strokesAtMaintenance: 40000,
    maintenanceType: "Corretiva",
    responsible: "João",
    notes: "troca de punção",
    resetCounter: true,
    ...overrides,
  };
}

beforeEach(() => {
  db = {
    existing: existingRecord(),
    latest: { id: "latest" }, // "old" NÃO é a mais recente
    tool: {
      id: "tool-1",
      currentStrokes: 12000,
      bomItems: [],
      maintenanceRecords: [],
    },
  };
  calls = {
    recordUpdates: [],
    toolUpdates: [],
    snapshotDeletes: [],
    snapshotUpserts: [],
    audits: [],
    revalidated: [],
    transactions: 0,
  };
});

function assertNoCycleWrites() {
  assert.equal(calls.transactions, 0);
  assert.equal(calls.toolUpdates.length, 0);
  assert.equal(calls.snapshotDeletes.length, 0);
  assert.equal(calls.snapshotUpserts.length, 0);
}

describe("updateMaintenanceRecord — registro que não é o mais recente", () => {
  it("altera só tipo/responsável/observação e não mexe no ciclo", async () => {
    const res = await updateMaintenanceRecord("old", payload());

    assert.equal(res.success, true);
    assert.equal(calls.recordUpdates.length, 1);
    assert.deepEqual(calls.recordUpdates[0], {
      where: { id: "old" },
      data: {
        maintenanceType: "Corretiva",
        responsible: "João",
        notes: "troca de punção",
      },
    });
    assertNoCycleWrites();
    assert.equal(calls.audits.length, 1);
    assert.equal(calls.audits[0].action, "UPDATE");
    assert.deepEqual(calls.revalidated, ["/manutencoes"]);
  });

  it("não reescreve data, batidas, previousStrokes nem resetCounter", async () => {
    await updateMaintenanceRecord("old", payload());
    const keys = Object.keys(calls.recordUpdates[0].data).sort();
    assert.deepEqual(keys, ["maintenanceType", "notes", "responsible"]);
  });

  it("responsável/observação ausentes viram null (limpa o campo)", async () => {
    const res = await updateMaintenanceRecord(
      "old",
      payload({ responsible: undefined, notes: undefined }),
    );
    assert.equal(res.success, true);
    assert.equal(calls.recordUpdates[0].data.responsible, null);
    assert.equal(calls.recordUpdates[0].data.notes, null);
  });

  it("aceita resetCounter=false quando o registro original já era false", async () => {
    db.existing = existingRecord({ resetCounter: false });
    const res = await updateMaintenanceRecord("old", payload({ resetCounter: false }));
    assert.equal(res.success, true);
    assertNoCycleWrites();
  });

  it("resetCounter omitido é tratado como true (igual ao registro)", async () => {
    const res = await updateMaintenanceRecord("old", payload({ resetCounter: undefined }));
    assert.equal(res.success, true);
    assertNoCycleWrites();
  });

  it("rejeita mudança de data", async () => {
    const res = await updateMaintenanceRecord(
      "old",
      payload({ maintenanceDate: new Date("2026-03-11T12:00:00.000Z") }),
    );
    assert.equal(res.success, false);
    assert.match(res.error, /mais recente/);
    assert.equal(calls.recordUpdates.length, 0);
    assertNoCycleWrites();
  });

  it("rejeita mudança de batidas", async () => {
    const res = await updateMaintenanceRecord("old", payload({ strokesAtMaintenance: 41000 }));
    assert.equal(res.success, false);
    assert.equal(calls.recordUpdates.length, 0);
    assertNoCycleWrites();
  });

  it("rejeita mudança de resetCounter", async () => {
    const res = await updateMaintenanceRecord("old", payload({ resetCounter: false }));
    assert.equal(res.success, false);
    assert.equal(calls.recordUpdates.length, 0);
    assertNoCycleWrites();
  });

  it("rejeita Invalid Date / NaN (regressão do bug dos inputs disabled)", async () => {
    const res = await updateMaintenanceRecord(
      "old",
      payload({ maintenanceDate: new Date("invalid"), strokesAtMaintenance: NaN }),
    );
    assert.equal(res.success, false);
    assert.equal(calls.recordUpdates.length, 0);
    assertNoCycleWrites();
  });

  it("registro inexistente", async () => {
    db.existing = null;
    const res = await updateMaintenanceRecord("nope", payload());
    assert.equal(res.success, false);
    assert.match(res.error, /não encontrada/);
  });
});

describe("updateMaintenanceRecord — registro mais recente", () => {
  beforeEach(() => {
    db.existing = existingRecord({ id: "latest", maintenanceDate: LATEST_DATE });
    db.latest = { id: "latest" };
  });

  it("só metadados: não recalcula ciclo", async () => {
    const res = await updateMaintenanceRecord(
      "latest",
      payload({ maintenanceDate: LATEST_DATE }),
    );
    assert.equal(res.success, true);
    assertNoCycleWrites();
    assert.equal(calls.recordUpdates.length, 1);
  });

  it("mudando as batidas dispara a transação de recálculo", async () => {
    const res = await updateMaintenanceRecord(
      "latest",
      payload({ maintenanceDate: LATEST_DATE, strokesAtMaintenance: 41000 }),
    );
    assert.equal(res.success, true);
    assert.equal(calls.transactions, 1);
    assert.equal(calls.snapshotDeletes.length, 1);
    assert.equal(calls.recordUpdates[0].data.strokesAtMaintenance, 41000);
  });
});
