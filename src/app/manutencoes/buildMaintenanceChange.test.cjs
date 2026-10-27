/* eslint-disable @typescript-eslint/no-require-imports */
// Testes da montagem do payload do modal de edição de manutenção.
// Foco: registro que NÃO é o mais recente (inputs de data/batidas disabled).
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});

const { buildMaintenanceChange } = require("./buildMaintenanceChange.ts");

const record = {
  maintenanceDate: new Date("2026-03-10T15:42:11.123Z"), // timestamp "quebrado" de propósito
  strokesAtMaintenance: 40000,
  resetCounter: true,
};

function form(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("buildMaintenanceChange — não é a mais recente", () => {
  // Inputs disabled não vão no FormData: só tipo/responsável/obs.
  const fd = () => form({ maintenanceType: "Inspeção", responsible: "Ana", notes: "ok" });

  it("reenvia data/batidas/reset originais e não marca ciclo alterado", () => {
    const r = buildMaintenanceChange(record, false, false, fd());
    assert.equal(r.maintenanceDate.getTime(), record.maintenanceDate.getTime());
    assert.equal(r.strokesAtMaintenance, 40000);
    assert.equal(r.resetCounter, true);
    assert.equal(r.cycleFieldsChanged, false);
    assert.equal(r.maintenanceType, "Inspeção");
    assert.equal(r.responsible, "Ana");
    assert.equal(r.notes, "ok");
  });

  it("ignora o estado do checkbox (resetCounter local) e usa o do registro", () => {
    const r = buildMaintenanceChange({ ...record, resetCounter: false }, false, true, fd());
    assert.equal(r.resetCounter, false);
    assert.equal(r.cycleFieldsChanged, false);
  });

  it("ignora data/batidas mesmo que venham no FormData", () => {
    const r = buildMaintenanceChange(
      record,
      false,
      true,
      form({
        maintenanceDate: "2030-01-01",
        strokesAtMaintenance: "1",
        maintenanceType: "Ajuste",
      }),
    );
    assert.equal(r.maintenanceDate.getTime(), record.maintenanceDate.getTime());
    assert.equal(r.strokesAtMaintenance, 40000);
    assert.equal(r.cycleFieldsChanged, false);
  });

  it("nunca produz Invalid Date nem NaN", () => {
    const r = buildMaintenanceChange(record, false, true, fd());
    assert.ok(!Number.isNaN(r.maintenanceDate.getTime()));
    assert.ok(!Number.isNaN(r.strokesAtMaintenance));
  });

  it("responsável/observação vazios viram undefined", () => {
    const r = buildMaintenanceChange(
      record,
      false,
      true,
      form({ maintenanceType: "Preventiva", responsible: "", notes: "" }),
    );
    assert.equal(r.responsible, undefined);
    assert.equal(r.notes, undefined);
  });
});

describe("buildMaintenanceChange — é a mais recente", () => {
  const base = {
    maintenanceDate: "2026-03-10",
    strokesAtMaintenance: "40000",
    maintenanceType: "Corretiva",
  };

  it("data do mesmo dia mantém o timestamp exato e não conta como mudança", () => {
    const r = buildMaintenanceChange(record, true, true, form(base));
    assert.equal(r.maintenanceDate.getTime(), record.maintenanceDate.getTime());
    assert.equal(r.cycleFieldsChanged, false);
  });

  it("data diferente marca ciclo alterado", () => {
    const r = buildMaintenanceChange(record, true, true, form({ ...base, maintenanceDate: "2026-03-12" }));
    assert.equal(r.cycleFieldsChanged, true);
  });

  it("batidas diferentes marcam ciclo alterado", () => {
    const r = buildMaintenanceChange(record, true, true, form({ ...base, strokesAtMaintenance: "41000" }));
    assert.equal(r.strokesAtMaintenance, 41000);
    assert.equal(r.cycleFieldsChanged, true);
  });

  it("desmarcar zerar contador marca ciclo alterado", () => {
    const r = buildMaintenanceChange(record, true, false, form(base));
    assert.equal(r.resetCounter, false);
    assert.equal(r.cycleFieldsChanged, true);
  });
});
