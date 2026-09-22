import { describe, expect, it } from "vitest";
import {
  applyMigrationPlanToSnapshot,
  assertMigrationPreservedLegacyData,
  planLegacySubmissionMigration,
} from "../../scripts/legacySubmissionMigration";
import { SUBMISSION_HEADER_SPECS } from "../../server/sheets/columns";
import { parseSubmissionSheet } from "../../server/sheets/parsers";

const migrationTimestamp = "22-09-2026 09:30:00";
const canonicalHeaders = SUBMISSION_HEADER_SPECS.map(({ header }) => header);
const withLegacyCodeAlias = canonicalHeaders.map((header) =>
  header === "kode_pilok_armada" ? "Kode Pilok Armada" : header,
);

const buildLegacyRow = ({
  createdAt = "",
  updatedAt = "",
  extra = "KEEP ME",
}: {
  createdAt?: string;
  updatedAt?: string;
  extra?: string;
} = {}) => {
  const row = withLegacyCodeAlias.map((header) => {
    if (header === "Kode Pilok Armada") return "20001";
    if (header === "DISTRIBUTOR GROUP") return "LEGACY DISTRIBUTOR";
    if (header === "DISTRICT NAME") return "LEGACY DISTRICT";
    if (header === "Total") return 5;
    if (header === "created_at") return createdAt;
    if (header === "updated_at") return updatedAt;
    if (header === "8 Ton Milik") return 5;
    return "";
  });
  row.push(extra);
  return row;
};

describe("legacy submission migration", () => {
  it("mendeteksi dan mengisi timestamp kosong tanpa mengubah nilai legacy", () => {
    const before = [[...withLegacyCodeAlias, "Catatan Legacy"], buildLegacyRow()];
    const plan = planLegacySubmissionMigration(before, migrationTimestamp);

    expect(plan.totalLegacyRows).toBe(1);
    expect(plan.rowsNeedingCreatedAt).toBe(1);
    expect(plan.rowsNeedingUpdatedAt).toBe(1);
    expect(plan.headerAdditions).toHaveLength(0);
    expect(plan.headerAudit.find(({ field }) => field === "kodePilokArmada")?.isLegacyAlias).toBe(true);

    const after = applyMigrationPlanToSnapshot(before, plan);
    assertMigrationPreservedLegacyData(before, after, plan);
    expect(after[1].at(-1)).toBe("KEEP ME");

    const parsed = parseSubmissionSheet(after, "submission_pilok_armada_darat", "20001");
    expect(parsed.match?.data.createdAt).toBe(migrationTimestamp);
    expect(parsed.match?.data.updatedAt).toBe(migrationTimestamp);
    expect(parsed.match?.data.armada.milik.ton8).toBe(5);
  });

  it("tidak menimpa timestamp existing", () => {
    const originalCreatedAt = "01-01-2025 08:00:00";
    const originalUpdatedAt = "02-01-2025 09:00:00";
    const before = [
      [...withLegacyCodeAlias, "Catatan Legacy"],
      buildLegacyRow({ createdAt: originalCreatedAt, updatedAt: originalUpdatedAt }),
    ];
    const plan = planLegacySubmissionMigration(before, migrationTimestamp);

    expect(plan.rowsAlreadyComplete).toBe(1);
    expect(plan.cellUpdates).toHaveLength(0);
    const after = applyMigrationPlanToSnapshot(before, plan);
    expect(after).toEqual(before);
  });

  it("menambahkan header timestamp yang hilang hanya di kolom paling kanan", () => {
    const headersWithoutTimestamps = withLegacyCodeAlias.filter(
      (header) => header !== "created_at" && header !== "updated_at",
    );
    const legacyValues = headersWithoutTimestamps.map((header) => {
      if (header === "Kode Pilok Armada") return "20001";
      if (header === "DISTRIBUTOR GROUP") return "LEGACY DISTRIBUTOR";
      if (header === "DISTRICT NAME") return "LEGACY DISTRICT";
      return "";
    });
    const before = [[...headersWithoutTimestamps, "Kolom Extra"], [...legacyValues, "PRESERVED"]];
    const plan = planLegacySubmissionMigration(before, migrationTimestamp);

    expect(plan.headerAdditions.map(({ header }) => header)).toEqual(["created_at", "updated_at"]);
    expect(plan.headerAdditions[0].columnIndex).toBe(before[0].length);
    const after = applyMigrationPlanToSnapshot(before, plan);
    expect(after[0].slice(-2)).toEqual(["created_at", "updated_at"]);
    expect(after[1][headersWithoutTimestamps.length]).toBe("PRESERVED");
  });

  it("idempotent pada rerun dan mempertahankan extra columns", () => {
    const before = [[...withLegacyCodeAlias, "Catatan Legacy"], buildLegacyRow()];
    const firstPlan = planLegacySubmissionMigration(before, migrationTimestamp);
    const migrated = applyMigrationPlanToSnapshot(before, firstPlan);
    const secondPlan = planLegacySubmissionMigration(migrated, "23-09-2026 10:00:00");

    expect(secondPlan.headerAdditions).toHaveLength(0);
    expect(secondPlan.cellUpdates).toHaveLength(0);
    expect(secondPlan.rowsAlreadyComplete).toBe(1);
    expect(migrated[1].at(-1)).toBe("KEEP ME");
  });

  it("menolak canonical dan legacy identifier header yang muncul bersamaan", () => {
    const ambiguousHeaders = ["kode_pilok_armada", ...withLegacyCodeAlias];
    expect(() => planLegacySubmissionMigration([ambiguousHeaders], migrationTimestamp))
      .toThrow(/ambigu/);
  });
});
