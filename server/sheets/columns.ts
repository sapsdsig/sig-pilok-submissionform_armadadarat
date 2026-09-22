import { ARMADA_CAPACITIES } from "../../src/constants/armada.js";
import type { ArmadaCapacity } from "../../src/types/armada.js";
import { AppError } from "../errors.js";

export type MasterField = "kodePilokArmada" | "distributorGroup" | "districtName";
export type SubmissionField =
  | MasterField
  | `milik.${ArmadaCapacity}`
  | `sewa.${ArmadaCapacity}`
  | "total"
  | "createdAt"
  | "updatedAt";

interface HeaderSpec<TField extends string> {
  field: TField;
  header: string;
  caseInsensitive?: boolean;
  aliases?: readonly string[];
}

export const MASTER_HEADER_SPECS: readonly HeaderSpec<MasterField>[] = [
  { field: "kodePilokArmada", header: "Kode Pilok Armada" },
  { field: "distributorGroup", header: "DISTRIBUTOR GROUP" },
  { field: "districtName", header: "DISTRICT NAME" },
];

export const SUBMISSION_HEADER_SPECS: readonly HeaderSpec<SubmissionField>[] = [
  {
    field: "kodePilokArmada",
    header: "kode_pilok_armada",
    caseInsensitive: true,
    aliases: ["Kode Pilok Armada"],
  },
  { field: "distributorGroup", header: "DISTRIBUTOR GROUP" },
  { field: "districtName", header: "DISTRICT NAME" },
  ...ARMADA_CAPACITIES.map(({ key, label }) => ({
    field: `milik.${key}` as const,
    header: `${label} Milik`,
  })),
  ...ARMADA_CAPACITIES.map(({ key, label }) => ({
    field: `sewa.${key}` as const,
    header: `${label} Sewa`,
  })),
  { field: "total", header: "Total" },
  { field: "createdAt", header: "created_at" },
  { field: "updatedAt", header: "updated_at" },
];

export type HeaderIndex<TField extends string> = Map<TField, number>;

const headerMatches = (actual: string, spec: HeaderSpec<string>) => {
  const candidates = [spec.header, ...(spec.aliases ?? [])];
  return candidates.some((candidate) => spec.caseInsensitive
    ? actual.toLocaleLowerCase("en-US") === candidate.toLocaleLowerCase("en-US")
    : actual === candidate);
};

export function validateHeaders<TField extends string>(
  rawHeaders: readonly unknown[],
  specs: readonly HeaderSpec<TField>[],
  sheetName: string,
): HeaderIndex<TField> {
  const headers = rawHeaders.map((header) => String(header ?? "").trim());
  const result = new Map<TField, number>();
  const duplicates: string[] = [];

  headers.forEach((header, index) => {
    const spec = specs.find((candidate) => headerMatches(header, candidate));
    if (!spec) return;
    if (result.has(spec.field)) duplicates.push(spec.header);
    else result.set(spec.field, index);
  });

  const missing = specs.filter((spec) => !result.has(spec.field)).map((spec) => spec.header);
  if (missing.length || duplicates.length) {
    const details = [
      missing.length ? `missing: ${missing.join(", ")}` : "",
      duplicates.length ? `duplicate: ${[...new Set(duplicates)].join(", ")}` : "",
    ].filter(Boolean).join("; ");
    throw new AppError(
      "SHEET_HEADER_ERROR",
      503,
      `Header sheet ${sheetName} tidak valid (${details}).`,
      `Struktur kolom sheet ${sheetName} tidak valid. Hubungi administrator.`,
    );
  }

  return result;
}

export function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replaceAll("'", "''")}'`;
}

export function columnNumberToLetter(columnNumber: number): string {
  let current = columnNumber;
  let result = "";
  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26);
  }
  return result;
}
