import { useEffect, useId, useRef } from "react";
import type { PilokArmadaMaster, SubmissionMode } from "../types/armada";

interface ConfirmationDialogProps {
  isOpen: boolean;
  master: PilokArmadaMaster;
  mode: SubmissionMode;
  totals: { milik: number; sewa: number; total: number };
  onCancel: () => void;
  onConfirm: () => void;
  isSaving?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  master,
  mode,
  totals,
  onCancel,
  onConfirm,
  isSaving = false,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onCancel();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, isSaving, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" onMouseDown={() => { if (!isSaving) onCancel(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-xl sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-xl text-sig-dark" aria-hidden="true">✓</span>
          <div>
            <h2 id={titleId} className="text-xl font-bold text-slate-900">Konfirmasi Penyimpanan</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-600">
              Periksa kembali ringkasan sebelum {mode === "new" ? "menyimpan data baru" : "menyimpan perubahan"}.
            </p>
          </div>
        </div>
        <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {[
            ["Kode Pilok Armada", master.kodePilokArmada],
            ["Distributor Group", master.distributorGroup],
            ["District Name", master.districtName],
            ["Total Armada Milik", `${totals.milik} Unit`],
            ["Total Armada Sewa", `${totals.sewa} Unit`],
            ["Total Armada", `${totals.total} Unit`],
          ].map(([label, value]) => (
            <div key={label} className="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="min-w-0 break-words text-sm font-semibold text-slate-900 sm:text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="button-secondary" onClick={onCancel} disabled={isSaving}>Kembali</button>
          <button type="button" className="button-primary" onClick={onConfirm} disabled={isSaving}>
            {isSaving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
