import { ARMADA_CAPACITIES } from "../../src/constants/armada.js";
import type {
  ArmadaCounts,
  ArmadaSubmissionRecord,
  PilokArmadaMaster,
} from "../../src/types/armada.js";
import { createEmptyArmadaCounts } from "../../src/utils/armada.js";
import { AppError } from "../errors.js";
import {
  MASTER_HEADER_SPECS,
  SUBMISSION_HEADER_SPECS,
  validateHeaders,
  type HeaderIndex,
  type SubmissionField,
} from "./columns.js";

export interface LocatedSubmission {
  rowNumber: number;
  rawRow: unknown[];
  data: ArmadaSubmissionRecord;
}

export interface SubmissionSheetContext {
  headers: string[];
  index: HeaderIndex<SubmissionField>;
  match?: LocatedSubmission;
}

const requiredCell = (row: readonly unknown[], index: number, label: string, rowNumber: number) => {
  const value = String(row[index] ?? "").trim();
  if (!value) {
    throw new AppError(
      "SHEET_DATA_ERROR",
      503,
      `Nilai ${label} kosong pada row ${rowNumber}.`,
      "Data pada spreadsheet tidak lengkap. Hubungi administrator.",
    );
  }
  return value;
};

export function parseSheetQuantity(value: unknown, label = "jumlah Armada"): number {
  if (value === "" || value === undefined || value === null) return 0;
  const normalized = typeof value === "string" && /^\d+$/.test(value.trim())
    ? Number(value.trim())
    : value;
  if (typeof normalized !== "number" || !Number.isFinite(normalized) || !Number.isInteger(normalized) || normalized < 0) {
    throw new AppError(
      "SHEET_DATA_ERROR",
      503,
      `Nilai ${label} pada spreadsheet tidak valid: ${String(value)}.`,
      "Data jumlah Armada pada spreadsheet tidak valid. Hubungi administrator.",
    );
  }
  return normalized;
}

export function parseMasterSheet(values: readonly unknown[][], sheetName: string): PilokArmadaMaster[] {
  if (!values.length) {
    throw new AppError("SHEET_HEADER_ERROR", 503, `Sheet ${sheetName} kosong.`, `Sheet ${sheetName} belum memiliki header.`);
  }
  const index = validateHeaders(values[0], MASTER_HEADER_SPECS, sheetName);
  const records = values.slice(1).flatMap((row, offset) => {
    if (row.every((cell) => String(cell ?? "").trim() === "")) return [];
    const rowNumber = offset + 2;
    return [{
      kodePilokArmada: requiredCell(row, index.get("kodePilokArmada")!, "Kode Pilok Armada", rowNumber),
      distributorGroup: requiredCell(row, index.get("distributorGroup")!, "DISTRIBUTOR GROUP", rowNumber),
      districtName: requiredCell(row, index.get("districtName")!, "DISTRICT NAME", rowNumber),
    }];
  });

  const seen = new Set<string>();
  const duplicate = records.find((record) => {
    if (seen.has(record.kodePilokArmada)) return true;
    seen.add(record.kodePilokArmada);
    return false;
  });
  if (duplicate) {
    throw new AppError(
      "DUPLICATE_MASTER",
      409,
      `Kode ${duplicate.kodePilokArmada} muncul lebih dari sekali pada master.`,
      "Terdapat duplikasi Kode Pilok Armada pada master data. Hubungi administrator.",
    );
  }
  return records;
}

function parseCounts(
  row: readonly unknown[],
  index: HeaderIndex<SubmissionField>,
  category: "milik" | "sewa",
): ArmadaCounts {
  const counts = createEmptyArmadaCounts();
  ARMADA_CAPACITIES.forEach(({ key, label }) => {
    counts[key] = parseSheetQuantity(row[index.get(`${category}.${key}`)!], `${label} ${category}`);
  });
  return counts;
}

export function parseSubmissionSheet(
  values: readonly unknown[][],
  sheetName: string,
  kodePilokArmada: string,
): SubmissionSheetContext {
  if (!values.length) {
    throw new AppError("SHEET_HEADER_ERROR", 503, `Sheet ${sheetName} kosong.`, `Sheet ${sheetName} belum memiliki header.`);
  }
  const headers = values[0].map((value) => String(value ?? "").trim());
  const index = validateHeaders(headers, SUBMISSION_HEADER_SPECS, sheetName);
  const codeIndex = index.get("kodePilokArmada")!;
  const matches = values.slice(1)
    .map((row, offset) => ({ row, rowNumber: offset + 2 }))
    .filter(({ row }) => String(row[codeIndex] ?? "").trim() === kodePilokArmada);

  if (matches.length > 1) {
    throw new AppError(
      "DUPLICATE_SUBMISSION",
      409,
      `Kode ${kodePilokArmada} ditemukan pada ${matches.length} row submission.`,
      "Data Armada untuk kode ini terduplikasi. Hubungi administrator sebelum melanjutkan.",
    );
  }
  if (!matches.length) return { headers, index };

  const { row, rowNumber } = matches[0];
  const armada = {
    milik: parseCounts(row, index, "milik"),
    sewa: parseCounts(row, index, "sewa"),
  };
  const total = Object.values(armada.milik).reduce((sum, value) => sum + value, 0)
    + Object.values(armada.sewa).reduce((sum, value) => sum + value, 0);
  return {
    headers,
    index,
    match: {
      rowNumber,
      rawRow: [...row],
      data: {
        kodePilokArmada,
        distributorGroup: requiredCell(row, index.get("distributorGroup")!, "DISTRIBUTOR GROUP", rowNumber),
        districtName: requiredCell(row, index.get("districtName")!, "DISTRICT NAME", rowNumber),
        armada,
        total,
        createdAt: requiredCell(row, index.get("createdAt")!, "created_at", rowNumber),
        updatedAt: requiredCell(row, index.get("updatedAt")!, "updated_at", rowNumber),
      },
    },
  };
}

export function buildSubmissionRow(
  context: SubmissionSheetContext,
  record: ArmadaSubmissionRecord,
): unknown[] {
  const row: unknown[] = Array.from(
    { length: context.headers.length },
    (_, index): unknown => context.match?.rawRow[index] ?? "",
  );
  const set = (field: SubmissionField, value: unknown) => {
    row[context.index.get(field)!] = value;
  };

  set("kodePilokArmada", record.kodePilokArmada);
  set("distributorGroup", record.distributorGroup);
  set("districtName", record.districtName);
  ARMADA_CAPACITIES.forEach(({ key }) => {
    set(`milik.${key}`, record.armada.milik[key]);
    set(`sewa.${key}`, record.armada.sewa[key]);
  });
  set("total", record.total);
  set("createdAt", record.createdAt);
  set("updatedAt", record.updatedAt);
  return row;
}
