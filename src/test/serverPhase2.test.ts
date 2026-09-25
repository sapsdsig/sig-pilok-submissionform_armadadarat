import { describe, expect, it, vi } from "vitest";
import { ARMADA_CAPACITIES } from "../constants/armada";
import type { ArmadaFormValues, ArmadaSubmissionRecord, PilokArmadaMaster } from "../types/armada";
import { createEmptyFormValues } from "../utils/armada";
import { getServerConfig } from "../../server/config/env";
import { AppError, toPublicApiError } from "../../server/errors";
import { GoogleSheetsArmadaRepository, type ArmadaPersistence } from "../../server/sheets/armadaRepository";
import { SUBMISSION_HEADER_SPECS, validateHeaders } from "../../server/sheets/columns";
import type { SheetsGateway } from "../../server/sheets/gateway";
import {
  buildSubmissionRow,
  parseSheetQuantity,
  parseSubmissionSheet,
  type SubmissionSheetContext,
} from "../../server/sheets/parsers";
import { ArmadaService } from "../../server/services/armadaService";
import { formatWibTimestamp } from "../../server/time/wib";
import { serverSubmissionSchema } from "../../server/validation/submission";

const master: PilokArmadaMaster = {
  kodePilokArmada: "20002",
  distributorGroup: "DISTRIBUTOR MASTER TERBARU, PT",
  districtName: "MAGETAN",
};

const headers = SUBMISSION_HEADER_SPECS.map((spec) => spec.header);
const emptyContext = (): SubmissionSheetContext => ({
  headers: [...headers],
  index: validateHeaders(headers, SUBMISSION_HEADER_SPECS, "submission_test"),
});

const makeRecord = (overrides: Partial<ArmadaSubmissionRecord> = {}): ArmadaSubmissionRecord => ({
  ...createEmptyFormValues("20002"),
  distributorGroup: master.distributorGroup,
  districtName: master.districtName,
  total: 0,
  createdAt: "20-09-2026 08:00:00",
  updatedAt: "20-09-2026 08:00:00",
  ...overrides,
});

class FakePersistence implements ArmadaPersistence {
  masterRecord: PilokArmadaMaster | undefined = master;
  context: SubmissionSheetContext = emptyContext();
  appended?: ArmadaSubmissionRecord;
  updated?: ArmadaSubmissionRecord;

  async listMaster() { return this.masterRecord ? [this.masterRecord] : []; }
  async getMasterByCode() { return this.masterRecord; }
  async lookupSubmission() { return this.context; }
  async appendSubmission(record: ArmadaSubmissionRecord) { this.appended = record; }
  async updateSubmission(record: ArmadaSubmissionRecord) { this.updated = record; }
}

const validPayload = (): ArmadaFormValues => {
  const values = createEmptyFormValues("20002");
  values.adaPerubahan = "YA";
  values.armada.milik.ton2 = 1;
  values.armada.milik.ton6 = 2;
  values.armada.sewa.ton4 = 1;
  return values;
};

const contextWithRecord = (record = makeRecord()): SubmissionSheetContext => {
  const context = emptyContext();
  return {
    ...context,
    match: { rowNumber: 3, rawRow: buildSubmissionRow(context, record), data: record },
  };
};

describe("server-side submission validation and service", () => {
  it("menerima payload Armada yang valid", () => {
    expect(serverSubmissionSchema.safeParse(validPayload()).success).toBe(true);
  });

  it.each([
    ["negatif", -1],
    ["desimal", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["string bebas", "abc"],
  ])("menolak kuantitas %s", (_label, invalidValue) => {
    const payload = validPayload() as unknown as Record<string, unknown>;
    const armada = payload.armada as { milik: Record<string, unknown> };
    armada.milik.ton2 = invalidValue;
    expect(serverSubmissionSchema.safeParse(payload).success).toBe(false);
  });

  it("menolak kode yang tidak ada pada master", async () => {
    const persistence = new FakePersistence();
    persistence.masterRecord = undefined;
    await expect(new ArmadaService(persistence).createSubmission(validPayload()))
      .rejects.toMatchObject({ code: "MASTER_NOT_FOUND", status: 404 });
  });

  it("menghitung ulang Total dan mengabaikan Total dari client", async () => {
    const persistence = new FakePersistence();
    const payload = { ...validPayload(), total: 999_999 };
    const result = await new ArmadaService(persistence, () => "21-09-2026 11:45:30")
      .createSubmission(payload);
    expect(result.total).toBe(4);
    expect(persistence.appended?.total).toBe(4);
  });

  it("menggunakan Distributor Group dan District Name dari master", async () => {
    const persistence = new FakePersistence();
    const payload = {
      ...validPayload(),
      distributorGroup: "DATA CLIENT PALSU",
      districtName: "DATA CLIENT PALSU",
    };
    const result = await new ArmadaService(persistence).createSubmission(payload);
    expect(result.distributorGroup).toBe(master.distributorGroup);
    expect(result.districtName).toBe(master.districtName);
  });

  it("create menolak submission yang sudah ada", async () => {
    const persistence = new FakePersistence();
    persistence.context = contextWithRecord();
    await expect(new ArmadaService(persistence).createSubmission(validPayload()))
      .rejects.toMatchObject({ code: "SUBMISSION_ALREADY_EXISTS", status: 409 });
  });

  it("update menolak submission yang belum ada", async () => {
    const persistence = new FakePersistence();
    await expect(new ArmadaService(persistence).updateSubmission("20002", validPayload()))
      .rejects.toMatchObject({ code: "SUBMISSION_NOT_FOUND", status: 404 });
  });

  it("update mempertahankan created_at dan mengganti updated_at", async () => {
    const persistence = new FakePersistence();
    persistence.context = contextWithRecord();
    const result = await new ArmadaService(persistence, () => "21-09-2026 11:45:30")
      .updateSubmission("20002", validPayload());
    expect(result.createdAt).toBe("20-09-2026 08:00:00");
    expect(result.updatedAt).toBe("21-09-2026 11:45:30");
    expect(persistence.updated).toEqual(result);
  });

  it("update TIDAK mempertahankan kuantitas baseline", async () => {
    const persistence = new FakePersistence();
    const baseline = makeRecord({
      adaPerubahan: "YA",
      armada: {
        milik: { ...createEmptyFormValues().armada.milik, ton8: 6 },
        sewa: createEmptyFormValues().armada.sewa,
      },
      total: 6,
    });
    persistence.context = contextWithRecord(baseline);
    const payload = validPayload();
    payload.adaPerubahan = "TIDAK";
    payload.armada.milik.ton8 = 99;

    const result = await new ArmadaService(persistence, () => "21-09-2026 11:45:30")
      .updateSubmission("20002", payload);

    expect(result.adaPerubahan).toBe("TIDAK");
    expect(result.armada).toEqual(baseline.armada);
    expect(result.total).toBe(6);
  });
});

describe("WIB and Google Sheet parsing", () => {
  it("memformat timestamp eksplisit dalam WIB", () => {
    expect(formatWibTimestamp(new Date("2026-09-21T04:45:30.000Z")))
      .toBe("21-09-2026 11:45:30");
  });

  it.each([
    ["", 0],
    ["0", 0],
    ["6", 6],
    [6, 6],
  ])("menormalisasi nilai sheet %j menjadi %d", (input, expected) => {
    expect(parseSheetQuantity(input)).toBe(expected);
  });

  it.each([-1, 1.5, "-1", "1.5", "abc", Number.NaN])(
    "mendeteksi nilai sheet rusak %j",
    (input) => expect(() => parseSheetQuantity(input)).toThrowError(AppError),
  );

  it("mendeteksi header wajib yang hilang", () => {
    expect(() => validateHeaders(headers.filter((header) => header !== "Total"), SUBMISSION_HEADER_SPECS, "submission"))
      .toThrowError(/missing: Total/);
  });

  it("mendeteksi header wajib yang terduplikasi", () => {
    expect(() => validateHeaders([...headers, "Total"], SUBMISSION_HEADER_SPECS, "submission"))
      .toThrowError(/duplicate: Total/);
  });

  it("menerima alias legacy Kode Pilok Armada tanpa menerima header ambigu", () => {
    const legacyHeaders = headers.map((header) =>
      header === "kode_pilok_armada" ? "Kode Pilok Armada" : header,
    );
    const index = validateHeaders(legacyHeaders, SUBMISSION_HEADER_SPECS, "submission");
    expect(index.get("kodePilokArmada")).toBe(0);
    expect(() => validateHeaders([...legacyHeaders, "kode_pilok_armada"], SUBMISSION_HEADER_SPECS, "submission"))
      .toThrowError(/duplicate: kode_pilok_armada/);
  });

  it("mendeteksi row submission duplikat", () => {
    const context = emptyContext();
    const row = buildSubmissionRow(context, makeRecord());
    expect(() => parseSubmissionSheet([headers, row, row], "submission", "20002"))
      .toThrowError(/ditemukan pada 2 row/);
  });

  it.each([
    ["", ""],
    [" ya ", "YA"],
    ["tidak", "TIDAK"],
  ])("membaca ada_perubahan %j sebagai %j", (input, expected) => {
    const context = emptyContext();
    const record = makeRecord();
    const row = buildSubmissionRow(context, record);
    row[context.index.get("adaPerubahan")!] = input;
    const parsed = parseSubmissionSheet([headers, row], "submission", "20002");
    expect(parsed.match?.data.adaPerubahan).toBe(expected);
  });

  it("menolak ada_perubahan nonblank yang tidak valid saat read", () => {
    const context = emptyContext();
    const row = buildSubmissionRow(context, makeRecord());
    row[context.index.get("adaPerubahan")!] = "MUNGKIN";
    expect(() => parseSubmissionSheet([headers, row], "submission", "20002"))
      .toThrowError(/ada_perubahan/);
  });

  it("mewajibkan status canonical saat write", () => {
    const blank = validPayload();
    blank.adaPerubahan = "";
    expect(serverSubmissionSchema.safeParse(blank).success).toBe(false);
    expect(serverSubmissionSchema.safeParse({ ...validPayload(), adaPerubahan: "ya" }).success)
      .toBe(false);
    expect(serverSubmissionSchema.safeParse({ ...validPayload(), adaPerubahan: "TIDAK" }).success)
      .toBe(true);
  });
});

describe("targeted update and safe errors", () => {
  it("mengupdate hanya range row yang ditemukan dan tidak melakukan append", async () => {
    const updateValues = vi.fn<SheetsGateway["updateValues"]>();
    const appendValues = vi.fn<SheetsGateway["appendValues"]>();
    const gateway: SheetsGateway = {
      getValues: vi.fn(),
      getSheetTitles: vi.fn(),
      updateValues,
      appendValues,
    };
    const config = {
      googleClientId: "id",
      googleClientSecret: "secret",
      googleRefreshToken: "refresh",
      spreadsheetId: "sheet",
      masterSheetName: "master_data",
      submissionSheetName: "submission_pilok_armada_darat",
    };
    const repository = new GoogleSheetsArmadaRepository(gateway, config);
    await repository.updateSubmission(makeRecord(), contextWithRecord());
    expect(updateValues).toHaveBeenCalledWith(
      "'submission_pilok_armada_darat'!A3:W3",
      expect.any(Array),
    );
    expect(appendValues).not.toHaveBeenCalled();
  });

  it("error publik tidak mengekspos credential atau stack internal", () => {
    const result = toPublicApiError(new Error("refresh_token=SECRET_VALUE"));
    expect(JSON.stringify(result.body)).not.toContain("SECRET_VALUE");
    expect(result.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("konfigurasi yang tidak lengkap menghasilkan CONFIG_ERROR terkendali", () => {
    expect(() => getServerConfig({})).toThrowError(AppError);
    try {
      getServerConfig({});
    } catch (error) {
      expect(error).toMatchObject({ code: "CONFIG_ERROR", status: 503 });
    }
  });

  it("seluruh 16 field kapasitas ditulis pada row", () => {
    const context = emptyContext();
    const values = validPayload();
    const record = makeRecord({
      adaPerubahan: values.adaPerubahan,
      armada: values.armada,
      total: 4,
    });
    const row = buildSubmissionRow(context, record);
    const capacityValues = ARMADA_CAPACITIES.flatMap(({ key }) => [
      row[context.index.get(`milik.${key}`)!],
      row[context.index.get(`sewa.${key}`)!],
    ]);
    expect(capacityValues).toHaveLength(16);
    expect(capacityValues.reduce<number>((sum, value) => sum + Number(value), 0)).toBe(4);
    expect(row[context.index.get("adaPerubahan")!]).toBe("YA");
  });

  it("menulis ada_perubahan berdasarkan header dan mempertahankan extra column", () => {
    const reorderedHeaders = [
      ...headers.filter((header) => header !== "ada_perubahan"),
      "Catatan Extra",
      "ada_perubahan",
    ];
    const index = validateHeaders(reorderedHeaders, SUBMISSION_HEADER_SPECS, "submission");
    const rawRow = Array.from({ length: reorderedHeaders.length }, () => "");
    rawRow[reorderedHeaders.indexOf("Catatan Extra")] = "KEEP ME";
    const record = makeRecord({ adaPerubahan: "TIDAK" });
    const context: SubmissionSheetContext = {
      headers: reorderedHeaders,
      index,
      match: { rowNumber: 3, rawRow, data: record },
    };

    const row = buildSubmissionRow(context, record);

    expect(row[index.get("adaPerubahan")!]).toBe("TIDAK");
    expect(row[reorderedHeaders.indexOf("Catatan Extra")]).toBe("KEEP ME");
  });
});
