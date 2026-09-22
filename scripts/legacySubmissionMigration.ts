import {
  SUBMISSION_HEADER_SPECS,
  type SubmissionField,
} from "../server/sheets/columns";

interface MigrationHeaderSpec {
  field: SubmissionField;
  header: string;
  caseInsensitive?: boolean;
  aliases?: readonly string[];
}

export interface HeaderAuditEntry {
  field: SubmissionField;
  canonicalHeader: string;
  actualHeader: string;
  columnIndex: number;
  isLegacyAlias: boolean;
}

export interface HeaderAddition {
  field: SubmissionField;
  header: string;
  columnIndex: number;
}

export interface MigrationCellUpdate {
  field: "createdAt" | "updatedAt";
  rowNumber: number;
  columnIndex: number;
  value: string;
}

export interface LegacySubmissionMigrationPlan {
  migrationTimestamp: string;
  headerAudit: HeaderAuditEntry[];
  headerAdditions: HeaderAddition[];
  unsafeMissingHeaders: string[];
  cellUpdates: MigrationCellUpdate[];
  totalLegacyRows: number;
  rowsNeedingCreatedAt: number;
  rowsNeedingUpdatedAt: number;
  rowsAlreadyComplete: number;
}

const headerSpecs = SUBMISSION_HEADER_SPECS as readonly MigrationHeaderSpec[];
const unsafeMissingFields = new Set<SubmissionField>([
  "kodePilokArmada",
  "distributorGroup",
  "districtName",
]);

const normalizeCell = (value: unknown) => String(value ?? "").trim();

const matchesHeader = (actual: string, spec: MigrationHeaderSpec) => {
  const candidates = [spec.header, ...(spec.aliases ?? [])];
  return candidates.some((candidate) => spec.caseInsensitive
    ? actual.toLocaleLowerCase("en-US") === candidate.toLocaleLowerCase("en-US")
    : actual === candidate);
};

export function planLegacySubmissionMigration(
  values: readonly unknown[][],
  migrationTimestamp: string,
): LegacySubmissionMigrationPlan {
  if (!values.length) throw new Error("Sheet submission tidak memiliki header.");

  const rawHeaders = [...values[0]];
  const normalizedHeaders = rawHeaders.map(normalizeCell);
  const headerAudit: HeaderAuditEntry[] = [];
  const headerAdditions: HeaderAddition[] = [];
  const index = new Map<SubmissionField, number>();

  for (const spec of headerSpecs) {
    const matches = normalizedHeaders
      .map((header, columnIndex) => ({ header, columnIndex }))
      .filter(({ header }) => matchesHeader(header, spec));

    if (matches.length > 1) {
      throw new Error(`Header ${spec.header} ambigu: canonical dan/atau alias muncul bersamaan.`);
    }

    const match = matches[0];
    if (match) {
      index.set(spec.field, match.columnIndex);
      headerAudit.push({
        field: spec.field,
        canonicalHeader: spec.header,
        actualHeader: normalizeCell(rawHeaders[match.columnIndex]),
        columnIndex: match.columnIndex,
        isLegacyAlias: normalizeCell(rawHeaders[match.columnIndex]) !== spec.header,
      });
      continue;
    }

    const columnIndex = rawHeaders.length + headerAdditions.length;
    index.set(spec.field, columnIndex);
    headerAdditions.push({ field: spec.field, header: spec.header, columnIndex });
  }

  const unsafeMissingHeaders = headerAdditions
    .filter(({ field }) => unsafeMissingFields.has(field))
    .map(({ header }) => header);
  const codeColumn = index.get("kodePilokArmada")!;
  const createdAtColumn = index.get("createdAt")!;
  const updatedAtColumn = index.get("updatedAt")!;
  const cellUpdates: MigrationCellUpdate[] = [];
  let totalLegacyRows = 0;
  let rowsNeedingCreatedAt = 0;
  let rowsNeedingUpdatedAt = 0;
  let rowsAlreadyComplete = 0;

  values.slice(1).forEach((row, offset) => {
    if (!normalizeCell(row[codeColumn])) return;
    totalLegacyRows += 1;
    const rowNumber = offset + 2;
    const needsCreatedAt = !normalizeCell(row[createdAtColumn]);
    const needsUpdatedAt = !normalizeCell(row[updatedAtColumn]);

    if (needsCreatedAt) {
      rowsNeedingCreatedAt += 1;
      cellUpdates.push({
        field: "createdAt",
        rowNumber,
        columnIndex: createdAtColumn,
        value: migrationTimestamp,
      });
    }
    if (needsUpdatedAt) {
      rowsNeedingUpdatedAt += 1;
      cellUpdates.push({
        field: "updatedAt",
        rowNumber,
        columnIndex: updatedAtColumn,
        value: migrationTimestamp,
      });
    }
    if (!needsCreatedAt && !needsUpdatedAt) rowsAlreadyComplete += 1;
  });

  return {
    migrationTimestamp,
    headerAudit,
    headerAdditions,
    unsafeMissingHeaders,
    cellUpdates,
    totalLegacyRows,
    rowsNeedingCreatedAt,
    rowsNeedingUpdatedAt,
    rowsAlreadyComplete,
  };
}

export function applyMigrationPlanToSnapshot(
  values: readonly unknown[][],
  plan: LegacySubmissionMigrationPlan,
): unknown[][] {
  const migrated = values.map((row) => [...row]);
  if (!migrated.length) migrated.push([]);

  for (const addition of plan.headerAdditions) {
    migrated[0][addition.columnIndex] = addition.header;
  }
  for (const update of plan.cellUpdates) {
    while (migrated.length < update.rowNumber) migrated.push([]);
    migrated[update.rowNumber - 1][update.columnIndex] = update.value;
  }

  return migrated;
}

export function assertMigrationPreservedLegacyData(
  before: readonly unknown[][],
  after: readonly unknown[][],
  plan: LegacySubmissionMigrationPlan,
) {
  const expected = applyMigrationPlanToSnapshot(before, plan);
  const rowCount = Math.max(expected.length, after.length);

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const columnCount = Math.max(expected[rowIndex]?.length ?? 0, after[rowIndex]?.length ?? 0);
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const actualValue = after[rowIndex]?.[columnIndex] ?? "";
      const expectedValue = expected[rowIndex]?.[columnIndex] ?? "";
      if (actualValue !== expectedValue) {
        throw new Error(
          `Data pascamigrasi tidak sesuai rencana pada row ${rowIndex + 1}, kolom ${columnIndex + 1}.`,
        );
      }
    }
  }
}
