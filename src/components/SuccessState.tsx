import type { PilokArmadaMaster, SubmissionMode } from "../types/armada";

interface SuccessStateProps {
  master: PilokArmadaMaster;
  mode: SubmissionMode;
  onBack: () => void;
}

export function SuccessState({ master, mode, onBack }: SuccessStateProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center shadow-card sm:px-8 sm:py-14" role="status">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700" aria-hidden="true">✓</span>
      <h2 className="mt-5 text-2xl font-bold text-slate-900">
        {mode === "new" ? "Data Armada Truk berhasil disimpan." : "Perubahan data Armada Truk berhasil disimpan."}
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
        Data untuk Kode Pilok Armada <strong>{master.kodePilokArmada}</strong> — {master.distributorGroup} — {master.districtName} telah tersimpan.
      </p>
      <button type="button" className="button-primary mt-7" onClick={onBack}>Kembali ke Form</button>
    </section>
  );
}
