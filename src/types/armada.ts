export type ArmadaCapacity =
  | "ton2"
  | "ton4"
  | "ton6"
  | "ton8"
  | "ton10"
  | "ton16"
  | "ton24"
  | "ton32";

export type ArmadaCounts = Record<ArmadaCapacity, number>;

export type AdaPerubahan = "YA" | "TIDAK";
export type AdaPerubahanValue = AdaPerubahan | "";

export interface ArmadaFormValues {
  kodePilokArmada: string;
  adaPerubahan: AdaPerubahanValue;
  armada: {
    milik: ArmadaCounts;
    sewa: ArmadaCounts;
  };
}

export interface PilokArmadaMaster {
  kodePilokArmada: string;
  distributorGroup: string;
  districtName: string;
}

export interface ArmadaSubmission extends ArmadaFormValues {
  createdAt?: string;
  updatedAt?: string;
}

export interface ArmadaSubmissionRecord extends ArmadaFormValues {
  distributorGroup: string;
  districtName: string;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export type SubmissionMode = "new" | "edit";
