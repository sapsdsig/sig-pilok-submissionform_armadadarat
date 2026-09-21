import type { ArmadaSubmission } from "../types/armada";

export const INITIAL_MOCK_SUBMISSIONS: readonly ArmadaSubmission[] = [
  {
    kodePilokArmada: "20001",
    armada: {
      milik: { ton2: 0, ton4: 0, ton6: 0, ton8: 6, ton10: 0, ton16: 0, ton24: 0, ton32: 3 },
      sewa: { ton2: 0, ton4: 0, ton6: 0, ton8: 0, ton10: 0, ton16: 0, ton24: 0, ton32: 0 },
    },
    createdAt: "01-09-2026 08:00:00",
    updatedAt: "01-09-2026 08:00:00",
  },
] as const;
