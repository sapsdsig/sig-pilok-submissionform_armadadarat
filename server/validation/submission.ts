import { z } from "zod";
import { ARMADA_CAPACITIES } from "../../src/constants/armada.js";
import type { ArmadaCapacity } from "../../src/types/armada.js";

const serverQuantitySchema = z.preprocess(
  (value) => value === "" || value === undefined ? 0 : value,
  z.number()
    .finite("Jumlah armada harus berupa angka terbatas.")
    .int("Jumlah armada harus berupa bilangan bulat.")
    .min(0, "Jumlah armada tidak boleh negatif."),
);

const createServerCountsSchema = () => {
  const shape = Object.fromEntries(
    ARMADA_CAPACITIES.map(({ key }) => [key, serverQuantitySchema]),
  ) as Record<ArmadaCapacity, typeof serverQuantitySchema>;
  return z.object(shape);
};

export const routeCodeSchema = z
  .string({ required_error: "Kode Pilok Armada wajib diisi." })
  .trim()
  .min(1, "Kode Pilok Armada wajib diisi.")
  .regex(/^\d+$/, "Kode Pilok Armada tidak valid.");

export const serverSubmissionSchema = z.object({
  kodePilokArmada: routeCodeSchema,
  adaPerubahan: z.enum(["YA", "TIDAK"], {
    invalid_type_error: "Status perubahan harus YA atau TIDAK.",
    required_error: "Status perubahan wajib dipilih.",
  }),
  armada: z.object({
    milik: createServerCountsSchema(),
    sewa: createServerCountsSchema(),
  }),
});

export type ServerSubmissionInput = z.infer<typeof serverSubmissionSchema>;
