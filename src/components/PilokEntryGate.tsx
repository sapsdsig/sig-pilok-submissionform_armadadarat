import type { FormEventHandler, RefObject } from "react";
import { FieldError, SectionCard, SectionHeader, StatusBanner } from "./FormLayout";

const MASTER_PILOK_URL =
  "https://docs.google.com/spreadsheets/d/14cPasMMoP4_XlfwZ4KT88VEAexAb7AdmF0ek7oGVuJw/edit?usp=sharing";

interface PilokEntryGateProps {
  code: string;
  inputRef: RefObject<HTMLInputElement>;
  inputError?: string;
  lookupError?: { title: string; message: string };
  isLoadingMaster: boolean;
  masterError?: string;
  isMasterEmpty: boolean;
  isContinuing: boolean;
  canContinue: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onRetryMaster: () => void;
}

export function PilokEntryGate({
  code,
  inputRef,
  inputError,
  lookupError,
  isLoadingMaster,
  masterError,
  isMasterEmpty,
  isContinuing,
  canContinue,
  onCodeChange,
  onSubmit,
  onRetryMaster,
}: PilokEntryGateProps) {
  const errorId = inputError ? "pilok-code-error" : undefined;

  return (
    <SectionCard>
      <SectionHeader
        step={1}
        title="Masukkan Kode PILOK"
        description="Kode digunakan untuk memuat distributor, district, dan data armada sebelumnya."
      />

      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">Belum tahu kode PILOK Anda?</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Cari kode distributor Anda pada daftar master PILOK.
          </p>
        </div>
        <a
          href={MASTER_PILOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Lihat Master PILOK di tab baru"
          className="button-secondary shrink-0"
        >
          Lihat Master PILOK <span className="ml-1" aria-hidden="true">↗</span>
        </a>
      </div>

      {isLoadingMaster ? (
        <p className="mb-5 text-sm text-slate-600" role="status">Memuat data master...</p>
      ) : masterError ? (
        <div className="mb-5">
          <StatusBanner variant="error" title="Master data tidak tersedia">
            <p>{masterError}</p>
            <button type="button" className="button-secondary mt-3" onClick={onRetryMaster}>
              Coba Lagi
            </button>
          </StatusBanner>
        </div>
      ) : isMasterEmpty ? (
        <div className="mb-5">
          <StatusBanner variant="warning" title="Master data kosong">
            Belum ada Kode PILOK yang dapat digunakan.
          </StatusBanner>
        </div>
      ) : null}

      {lookupError ? (
        <div className="mb-5">
          <StatusBanner variant="error" title={lookupError.title}>
            {lookupError.message}
          </StatusBanner>
        </div>
      ) : null}

      <form noValidate onSubmit={onSubmit} aria-busy={isContinuing}>
        <label htmlFor="pilok-code" className="field-label">Kode PILOK *</label>
        <input
          ref={inputRef}
          id="pilok-code"
          name="kodePilok"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="Contoh: 20001"
          aria-invalid={Boolean(inputError)}
          aria-describedby={errorId}
          disabled={isLoadingMaster || Boolean(masterError)}
          className={`form-input ${inputError ? "input-error" : ""}`}
        />
        <FieldError id="pilok-code-error" message={inputError} />
        <button type="submit" className="button-dark mt-5" disabled={!canContinue}>
          {isContinuing ? "Memuat data..." : "Lanjutkan"}
        </button>
      </form>
    </SectionCard>
  );
}

export { MASTER_PILOK_URL };
