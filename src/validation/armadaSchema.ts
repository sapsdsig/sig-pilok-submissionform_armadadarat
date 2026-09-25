import { z } from "zod";
import { ARMADA_CAPACITIES } from "../constants/armada";
import type { ArmadaCapacity, ArmadaFormValues } from "../types/armada";

export const quantitySchema = z.preprocess(
  (value) => (value === "" || value === undefined || Number.isNaN(value) ? 0 : value),
  z
    .number({ invalid_type_error: "Jumlah armada harus berupa angka." })
    .int("Jumlah armada harus berupa bilangan bulat.")
    .min(0, "Jumlah armada tidak boleh negatif."),
);

export const createCountsSchema = () => {
  const shape = Object.fromEntries(
    ARMADA_CAPACITIES.map(({ key }) => [key, quantitySchema]),
  ) as Record<ArmadaCapacity, typeof quantitySchema>;
  return z.object(shape);
};

export const armadaFormSchema = z.object({
  kodePilokArmada: z
    .string()
    .min(1, "Kode Pilok Armada wajib dipilih.")
    .regex(/^\d+$/, "Kode Pilok Armada tidak valid."),
  adaPerubahan: z.string().refine(
    (value) => value === "YA" || value === "TIDAK",
    "Pilih apakah terdapat perubahan pada data Armada Truk.",
  ),
  armada: z.object({
    milik: createCountsSchema(),
    sewa: createCountsSchema(),
  }),
});

export type ArmadaFormInput = z.input<typeof armadaFormSchema>;

export const parseArmadaForm = (values: unknown): ArmadaFormValues =>
  armadaFormSchema.parse(values) as ArmadaFormValues;
