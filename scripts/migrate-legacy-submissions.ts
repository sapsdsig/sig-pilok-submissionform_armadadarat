import "dotenv/config";
import { google } from "googleapis";
import { getServerConfig } from "../server/config/env";
import { createGoogleOAuthClient } from "../server/google/auth";
import { columnNumberToLetter, quoteSheetName } from "../server/sheets/columns";
import { parseSubmissionSheet } from "../server/sheets/parsers";
import { formatWibTimestamp } from "../server/time/wib";
import {
  assertMigrationPreservedLegacyData,
  planLegacySubmissionMigration,
  type LegacySubmissionMigrationPlan,
  type MigrationCellUpdate,
} from "./legacySubmissionMigration";

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");
const isApply = args.has("--apply");

if (isDryRun === isApply) {
  console.error("Gunakan tepat satu mode: --dry-run atau --apply.");
  process.exit(1);
}

const config = getServerConfig();
const sheets = google.sheets({ version: "v4", auth: createGoogleOAuthClient(config) });
const sourceRange = `${quoteSheetName(config.submissionSheetName)}!A:ZZZ`;

const getValues = async (range: string) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (response.data.values ?? []) as unknown[][];
};

const printPlan = (plan: LegacySubmissionMigrationPlan) => {
  const aliases = plan.headerAudit.filter(({ isLegacyAlias }) => isLegacyAlias);
  console.log(`[AUDIT] Existing required headers: ${plan.headerAudit.length}`);
  console.log(`[AUDIT] Legacy aliases in use: ${aliases.length}`);
  aliases.forEach(({ actualHeader, canonicalHeader }) => {
    console.log(`[AUDIT] Alias '${actualHeader}' resolves to '${canonicalHeader}'`);
  });
  console.log(`[AUDIT] Missing headers: ${plan.headerAdditions.length}`);
  plan.headerAdditions.forEach(({ header }) => console.log(`[AUDIT] Will append header: ${header}`));
  console.log(`[AUDIT] Total legacy rows: ${plan.totalLegacyRows}`);
  console.log(`[AUDIT] Rows needing created_at: ${plan.rowsNeedingCreatedAt}`);
  console.log(`[AUDIT] Rows needing updated_at: ${plan.rowsNeedingUpdatedAt}`);
  console.log(`[AUDIT] Rows already complete: ${plan.rowsAlreadyComplete}`);
  console.log(`[AUDIT] Migration timestamp: ${plan.migrationTimestamp}`);
};

const compactTimestamp = (timestamp: string) => {
  const match = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(timestamp);
  if (!match) throw new Error("Format timestamp migrasi tidak valid.");
  return `${match[3]}${match[2]}${match[1]}_${match[4]}${match[5]}${match[6]}`;
};

const buildBackupTitle = (existingTitles: ReadonlySet<string>, timestamp: string) => {
  const base = `${config.submissionSheetName}_backup_${compactTimestamp(timestamp)}`;
  let candidate = base;
  let suffix = 2;
  while (existingTitles.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const groupContiguousUpdates = (updates: MigrationCellUpdate[]) => {
  const result: Array<{ columnIndex: number; startRow: number; endRow: number; values: unknown[][] }> = [];
  const byColumn = new Map<number, MigrationCellUpdate[]>();
  updates.forEach((update) => {
    const items = byColumn.get(update.columnIndex) ?? [];
    items.push(update);
    byColumn.set(update.columnIndex, items);
  });

  for (const [columnIndex, items] of byColumn) {
    const sorted = [...items].sort((a, b) => a.rowNumber - b.rowNumber);
    let current: { columnIndex: number; startRow: number; endRow: number; values: unknown[][] } | undefined;
    sorted.forEach((item) => {
      if (!current || item.rowNumber !== current.endRow + 1) {
        current = {
          columnIndex,
          startRow: item.rowNumber,
          endRow: item.rowNumber,
          values: [[item.value]],
        };
        result.push(current);
      } else {
        current.endRow = item.rowNumber;
        current.values.push([item.value]);
      }
    });
  }
  return result;
};

const run = async () => {
  const migrationTimestamp = formatWibTimestamp();
  const before = await getValues(sourceRange);
  const plan = planLegacySubmissionMigration(before, migrationTimestamp);
  printPlan(plan);

  if (plan.unsafeMissingHeaders.length) {
    throw new Error(
      `Migrasi dihentikan: metadata wajib tidak memiliki header (${plan.unsafeMissingHeaders.join(", ")}).`,
    );
  }
  if (isDryRun) {
    console.log("[DRY RUN] Tidak ada perubahan yang ditulis ke Google Sheets.");
    return;
  }
  if (!plan.headerAdditions.length && !plan.cellUpdates.length) {
    console.log("[PASS] Tidak ada perubahan yang diperlukan; migration sudah idempotent.");
    return;
  }

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: config.spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheetProperties = (metadata.data.sheets ?? []).map((sheet) => sheet.properties);
  const source = sheetProperties.find((properties) => properties?.title === config.submissionSheetName);
  if (source?.sheetId === undefined) throw new Error("Tab submission sumber tidak ditemukan.");

  const existingTitles = new Set(sheetProperties
    .map((properties) => properties?.title)
    .filter((title): title is string => Boolean(title)));
  const backupTitle = buildBackupTitle(existingTitles, migrationTimestamp);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      requests: [{
        duplicateSheet: {
          sourceSheetId: source.sheetId,
          newSheetName: backupTitle,
        },
      }],
    },
  });

  const backup = await getValues(`${quoteSheetName(backupTitle)}!A:ZZZ`);
  if (JSON.stringify(backup) !== JSON.stringify(before)) {
    throw new Error("Verifikasi backup gagal: isi backup tidak identik dengan tab sumber.");
  }
  console.log(`[PASS] Backup verified: ${backupTitle} (${Math.max(backup.length - 1, 0)} data rows)`);

  const beforeWrite = await getValues(sourceRange);
  if (JSON.stringify(beforeWrite) !== JSON.stringify(before)) {
    throw new Error("Tab sumber berubah setelah backup; migration dibatalkan untuk mencegah overwrite.");
  }

  const data = [];
  if (plan.headerAdditions.length) {
    const first = plan.headerAdditions[0];
    const last = plan.headerAdditions[plan.headerAdditions.length - 1];
    data.push({
      range: `${quoteSheetName(config.submissionSheetName)}!${columnNumberToLetter(first.columnIndex + 1)}1:${columnNumberToLetter(last.columnIndex + 1)}1`,
      values: [plan.headerAdditions.map(({ header }) => header)],
    });
  }
  for (const group of groupContiguousUpdates(plan.cellUpdates)) {
    const column = columnNumberToLetter(group.columnIndex + 1);
    data.push({
      range: `${quoteSheetName(config.submissionSheetName)}!${column}${group.startRow}:${column}${group.endRow}`,
      values: group.values,
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: { valueInputOption: "RAW", data },
  });

  const after = await getValues(sourceRange);
  assertMigrationPreservedLegacyData(before, after, plan);
  const verificationPlan = planLegacySubmissionMigration(after, migrationTimestamp);
  if (verificationPlan.headerAdditions.length || verificationPlan.cellUpdates.length) {
    throw new Error("Verifikasi pascamigrasi gagal: masih ada field wajib yang perlu diisi.");
  }

  const codeAudit = plan.headerAudit.find(({ field }) => field === "kodePilokArmada");
  const codeAddition = plan.headerAdditions.find(({ field }) => field === "kodePilokArmada");
  const codeColumn = codeAudit?.columnIndex ?? codeAddition?.columnIndex;
  if (codeColumn === undefined) throw new Error("Kolom kode tidak dapat diverifikasi.");
  const codes = after.slice(1)
    .map((row) => String(row[codeColumn] ?? "").trim())
    .filter(Boolean);
  codes.forEach((code) => parseSubmissionSheet(after, config.submissionSheetName, code));

  console.log("[PASS] Migration completed without changing legacy values.");
  console.log(`[PASS] Parsed ${codes.length} legacy submission rows.`);
  console.log(`[PASS] Backup tab: ${backupTitle}`);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration error.";
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
});
