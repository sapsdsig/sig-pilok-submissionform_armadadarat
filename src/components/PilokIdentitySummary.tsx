import type { PilokArmadaMaster, SubmissionMode } from "../types/armada";
import { SectionCard, SectionHeader, StatusBanner } from "./FormLayout";

interface PilokIdentitySummaryProps {
  master: PilokArmadaMaster;
  mode: SubmissionMode;
  onChangeCode: () => void;
}

export function PilokIdentitySummary({ master, mode, onChangeCode }: PilokIdentitySummaryProps) {
  return (
    <SectionCard>
      <SectionHeader
        step={1}
        title="Informasi PILOK"
        description="Identitas PILOK yang digunakan untuk submission ini."
        action={(
          <button type="button" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:text-sig-dark hover:underline" onClick={onChangeCode}>
            Ganti Kode PILOK
          </button>
        )}
      />
      <dl className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="readonly-field">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Kode PILOK</dt>
          <dd className="mt-1 break-words font-semibold text-slate-900">{master.kodePilokArmada}</dd>
        </div>
        <div className="readonly-field">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Distributor</dt>
          <dd className="mt-1 break-words font-semibold text-slate-900">{master.distributorGroup}</dd>
        </div>
        <div className="readonly-field">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">District</dt>
          <dd className="mt-1 break-words font-semibold text-slate-900">{master.districtName}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <StatusBanner
          variant={mode === "edit" ? "warning" : "info"}
          title={mode === "edit" ? "Edit Data" : "Submission Baru"}
        >
          {mode === "edit"
            ? "Data Armada Truk yang tersimpan telah dimuat. Perubahan akan memperbarui data untuk kode ini."
            : "Belum ada submission untuk kode ini. Semua jumlah Armada Truk dimulai dari nol."}
        </StatusBanner>
      </div>
    </SectionCard>
  );
}
