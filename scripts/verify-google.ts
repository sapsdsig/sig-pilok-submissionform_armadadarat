import "dotenv/config";
import { getServerConfig } from "../server/config/env";
import { createGoogleOAuthClient } from "../server/google/auth";
import {
  quoteSheetName,
  SUBMISSION_HEADER_SPECS,
  validateHeaders,
} from "../server/sheets/columns";
import { createSheetsGateway } from "../server/sheets/gateway";
import { parseAdaPerubahan, parseMasterSheet, parseSubmissionSheet } from "../server/sheets/parsers";

async function verifyGoogleIntegration() {
  const config = getServerConfig();
  console.log("[PASS] Environment variables loaded");

  const auth = createGoogleOAuthClient(config);
  await auth.getAccessToken();
  console.log("[PASS] Google OAuth");

  const gateway = createSheetsGateway(config);
  const titles = await gateway.getSheetTitles();
  console.log("[PASS] Spreadsheet access");

  if (!titles.includes(config.masterSheetName)) {
    throw new Error(`Master sheet '${config.masterSheetName}' tidak ditemukan.`);
  }
  if (!titles.includes(config.submissionSheetName)) {
    throw new Error(`Submission sheet '${config.submissionSheetName}' tidak ditemukan.`);
  }
  console.log(`[PASS] Required sheets exist`);

  const masterValues = await gateway.getValues(`${quoteSheetName(config.masterSheetName)}!A:ZZZ`);
  const master = parseMasterSheet(masterValues, config.masterSheetName);
  console.log(`[PASS] ${config.masterSheetName} headers`);
  if (!master.length) throw new Error(`Master sheet '${config.masterSheetName}' tidak memiliki data.`);
  console.log(`[PASS] Master row parsing (${master.length} rows)`);

  const submissionValues = await gateway.getValues(`${quoteSheetName(config.submissionSheetName)}!A:ZZZ`);
  parseSubmissionSheet(submissionValues, config.submissionSheetName, "__verification_only__");
  console.log(`[PASS] ${config.submissionSheetName} headers`);
  const submissionIndex = validateHeaders(
    submissionValues[0] ?? [],
    SUBMISSION_HEADER_SPECS,
    config.submissionSheetName,
  );
  const codeColumn = submissionIndex.get("kodePilokArmada")!;
  const statusColumn = submissionIndex.get("adaPerubahan")!;
  let legacyBlankStatuses = 0;
  let canonicalStatuses = 0;
  submissionValues.slice(1).forEach((row, offset) => {
    if (!String(row[codeColumn] ?? "").trim()) return;
    const status = parseAdaPerubahan(row[statusColumn], offset + 2);
    if (status) canonicalStatuses += 1;
    else legacyBlankStatuses += 1;
  });
  console.log(`[PASS] ada_perubahan values (${canonicalStatuses} canonical, ${legacyBlankStatuses} blank legacy)`);
  const sampleCode = submissionValues.slice(1)
    .map((row) => String(row[codeColumn] ?? "").trim())
    .find(Boolean);
  if (sampleCode) {
    parseSubmissionSheet(submissionValues, config.submissionSheetName, sampleCode);
    console.log("[PASS] Existing submission row parsing");
  } else {
    console.log("[PASS] Submission sheet is empty; row parsing skipped");
  }

  console.log("\nGoogle verification completed successfully.");
}

verifyGoogleIntegration().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown verification error.";
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
});
