import { ARMADA_CAPACITIES } from "../constants/armada";
import type { ArmadaCounts, ArmadaFormValues } from "../types/armada";

export const createEmptyArmadaCounts = (): ArmadaCounts =>
  Object.fromEntries(ARMADA_CAPACITIES.map(({ key }) => [key, 0])) as ArmadaCounts;

export const createEmptyFormValues = (kodePilokArmada = ""): ArmadaFormValues => ({
  kodePilokArmada,
  armada: {
    milik: createEmptyArmadaCounts(),
    sewa: createEmptyArmadaCounts(),
  },
});

export const calculateArmadaTotal = (counts?: Partial<ArmadaCounts>): number =>
  ARMADA_CAPACITIES.reduce((total, { key }) => {
    const value = counts?.[key];
    return total + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);

export const calculateArmadaTotals = (values: ArmadaFormValues) => {
  const milik = calculateArmadaTotal(values.armada.milik);
  const sewa = calculateArmadaTotal(values.armada.sewa);
  return { milik, sewa, total: milik + sewa };
};
