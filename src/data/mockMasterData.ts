import type { PilokArmadaMaster } from "../types/armada";

export const MOCK_MASTER_DATA: readonly PilokArmadaMaster[] = [
  { kodePilokArmada: "20001", distributorGroup: "ABADI PUTERA WIRAJAYA, PT", districtName: "MADIUN" },
  { kodePilokArmada: "20002", distributorGroup: "ABADI PUTERA WIRAJAYA, PT", districtName: "MAGETAN" },
  { kodePilokArmada: "20003", distributorGroup: "ABADI PUTERA WIRAJAYA, PT", districtName: "NGAWI" },
  { kodePilokArmada: "20004", distributorGroup: "ABADI PUTERA WIRAJAYA, PT", districtName: "PACITAN" },
  { kodePilokArmada: "20005", distributorGroup: "ABADI PUTERA WIRAJAYA, PT", districtName: "PONOROGO" },
  { kodePilokArmada: "20006", distributorGroup: "ADE LESTARI SEJATI, PT", districtName: "KAB. ACEH BARAT" },
] as const;
