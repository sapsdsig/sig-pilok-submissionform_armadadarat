import { useEffect, useId, useRef } from "react";

interface DiscardChangesDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DiscardChangesDialog({ isOpen, onCancel, onConfirm }: DiscardChangesDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      previousFocus?.focus();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-4" onMouseDown={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-xl sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-xl font-bold text-slate-900">Ganti Kode PILOK?</h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">
          Perubahan yang belum disimpan akan dihapus dan form akan kembali ke halaman awal.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="button-secondary" onClick={onCancel}>Tetap di Form</button>
          <button type="button" className="button-dark" onClick={onConfirm}>Ganti Kode</button>
        </div>
      </div>
    </div>
  );
}
