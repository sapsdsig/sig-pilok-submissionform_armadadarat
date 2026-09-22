import type { ArmadaCapacity } from "../types/armada.js";

export const ARMADA_CAPACITIES = [
  { key: "ton2", label: "2 Ton" },
  { key: "ton4", label: "4 Ton" },
  { key: "ton6", label: "6 Ton" },
  { key: "ton8", label: "8 Ton" },
  { key: "ton10", label: "10 Ton" },
  { key: "ton16", label: "16 Ton" },
  { key: "ton24", label: "24 Ton" },
  { key: "ton32", label: "32 Ton" },
] as const satisfies ReadonlyArray<{ key: ArmadaCapacity; label: string }>;
