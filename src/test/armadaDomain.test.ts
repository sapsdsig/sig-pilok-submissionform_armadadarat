import { describe, expect, it } from "vitest";
import { getExistingSubmission, getPilokArmadaByCode, searchPilokArmada } from "../services/armadaRepository";
import { calculateArmadaTotals, createEmptyFormValues } from "../utils/armada";
import { armadaFormSchema } from "../validation/armadaSchema";

describe("repository master data", () => {
  it.each([
    ["20001", "20001"],
    ["abadi putera", "20001"],
    ["aceh barat", "20006"],
  ])("mencari master dengan query %s", async (query, expectedCode) => {
    const results = await searchPilokArmada(query);
    expect(results.some((result) => result.kodePilokArmada === expectedCode)).toBe(true);
  });

  it("menyelesaikan distributor dan district dari kode master", async () => {
    const master = await getPilokArmadaByCode("20001");
    expect(master).toMatchObject({
      distributorGroup: "ABADI PUTERA WIRAJAYA, PT",
      districtName: "MADIUN",
    });
  });

  it("memuat mock submission 20001 dengan nilai Milik yang tepat", async () => {
    const submission = await getExistingSubmission("20001");
    expect(submission?.armada.milik).toEqual({
      ton2: 0,
      ton4: 0,
      ton6: 0,
      ton8: 6,
      ton10: 0,
      ton16: 0,
      ton24: 0,
      ton32: 3,
    });
  });
});

describe("nilai dan kalkulasi Armada", () => {
  it("menginisialisasi kode baru dengan seluruh nilai nol", () => {
    const values = createEmptyFormValues("20002");
    expect(Object.values(values.armada.milik)).toEqual(Array(8).fill(0));
    expect(Object.values(values.armada.sewa)).toEqual(Array(8).fill(0));
  });

  it("menghitung Total Milik, Total Sewa, dan Total Armada", () => {
    const values = createEmptyFormValues("20002");
    values.armada.milik.ton8 = 6;
    values.armada.milik.ton32 = 3;
    values.armada.sewa.ton4 = 2;
    expect(calculateArmadaTotals(values)).toEqual({ milik: 9, sewa: 2, total: 11 });
  });
});

describe("schema form Armada", () => {
  it("menerima nilai nol dan menormalisasi field kosong menjadi nol", () => {
    const values = createEmptyFormValues("20002");
    const input = { ...values, armada: { ...values.armada, milik: { ...values.armada.milik, ton2: "" } } };
    const result = armadaFormSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.armada.milik.ton2).toBe(0);
  });

  it("menolak nilai negatif", () => {
    const values = createEmptyFormValues("20002");
    values.armada.milik.ton2 = -1;
    expect(armadaFormSchema.safeParse(values).success).toBe(false);
  });

  it("menolak nilai desimal", () => {
    const values = createEmptyFormValues("20002");
    values.armada.sewa.ton4 = 1.5;
    expect(armadaFormSchema.safeParse(values).success).toBe(false);
  });

  it("mewajibkan Kode Pilok Armada", () => {
    const result = armadaFormSchema.safeParse(createEmptyFormValues());
    expect(result.success).toBe(false);
  });

  it("menolak format kode yang tidak valid", () => {
    const result = armadaFormSchema.safeParse(createEmptyFormValues("kode-tidak-valid"));
    expect(result.success).toBe(false);
  });
});
