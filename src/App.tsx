import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArmadaMatrix } from "./components/ArmadaMatrix";
import { ArmadaSummary } from "./components/ArmadaSummary";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import {
  ActionBar,
  BrandHeader,
  FormShell,
  SectionCard,
  SectionHeader,
  StatusBanner,
} from "./components/FormLayout";
import { SearchableSelect } from "./components/SearchableSelect";
import { SuccessState } from "./components/SuccessState";
import {
  createSubmission,
  getExistingSubmission,
  searchPilokArmada,
  updateSubmission,
} from "./services/armadaRepository";
import type {
  ArmadaFormValues,
  ArmadaSubmissionRecord,
  PilokArmadaMaster,
  SubmissionMode,
} from "./types/armada";
import { calculateArmadaTotals, createEmptyFormValues } from "./utils/armada";
import { armadaFormSchema } from "./validation/armadaSchema";

export default function App() {
  const [masterData, setMasterData] = useState<PilokArmadaMaster[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);
  const [masterError, setMasterError] = useState<string>();
  const [selectedMaster, setSelectedMaster] = useState<PilokArmadaMaster>();
  const [mode, setMode] = useState<SubmissionMode>();
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);
  const [recordError, setRecordError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [confirmationValues, setConfirmationValues] = useState<ArmadaFormValues>();
  const [success, setSuccess] = useState<{
    master: PilokArmadaMaster;
    mode: SubmissionMode;
    submission: ArmadaSubmissionRecord;
  }>();
  const loadSequence = useRef(0);
  const recordAbortController = useRef<AbortController>();
  const masterAbortController = useRef<AbortController>();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ArmadaFormValues>({
    resolver: zodResolver(armadaFormSchema),
    defaultValues: createEmptyFormValues(),
    mode: "onChange",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });

  const watchedValues = useWatch({ control });
  const safeValues = useMemo(
    () => ({
      kodePilokArmada: watchedValues.kodePilokArmada ?? "",
      armada: {
        milik: { ...createEmptyFormValues().armada.milik, ...watchedValues.armada?.milik },
        sewa: { ...createEmptyFormValues().armada.sewa, ...watchedValues.armada?.sewa },
      },
    }),
    [watchedValues],
  );
  const totals = calculateArmadaTotals(safeValues);

  const loadMasterData = useCallback(async () => {
    masterAbortController.current?.abort();
    const controller = new AbortController();
    masterAbortController.current = controller;
    setIsLoadingMaster(true);
    setMasterError(undefined);
    try {
      const data = await searchPilokArmada("", controller.signal);
      if (!controller.signal.aborted) setMasterData(data);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Master data request failed.", error);
        setMasterData([]);
        setMasterError("Data master belum dapat dimuat. Silakan coba kembali.");
      }
    } finally {
      if (!controller.signal.aborted) setIsLoadingMaster(false);
    }
  }, []);

  useEffect(() => {
    void loadMasterData();
    return () => {
      masterAbortController.current?.abort();
      recordAbortController.current?.abort();
    };
  }, [loadMasterData]);

  const loadRecord = async (kodePilokArmada: string) => {
    const requestId = ++loadSequence.current;
    recordAbortController.current?.abort();
    setRecordError(undefined);
    setSaveError(undefined);
    if (!kodePilokArmada) {
      setSelectedMaster(undefined);
      setMode(undefined);
      setIsLoadingRecord(false);
      reset(createEmptyFormValues());
      return;
    }

    const master = masterData.find((record) => record.kodePilokArmada === kodePilokArmada);
    if (!master) {
      setSelectedMaster(undefined);
      setMode(undefined);
      setRecordError("Kode PILOK Armada tidak ditemukan pada master data.");
      reset(createEmptyFormValues());
      return;
    }

    const controller = new AbortController();
    recordAbortController.current = controller;
    setSelectedMaster(master);
    setMode(undefined);
    setIsLoadingRecord(true);
    try {
      const existing = await getExistingSubmission(kodePilokArmada, controller.signal);
      if (requestId !== loadSequence.current || controller.signal.aborted) return;
      setMode(existing ? "edit" : "new");
      reset(existing ?? createEmptyFormValues(kodePilokArmada));
    } catch (error) {
      if (requestId !== loadSequence.current || controller.signal.aborted) return;
      console.error("Submission request failed.", error);
      setMode(undefined);
      reset(createEmptyFormValues(kodePilokArmada));
      setRecordError("Data Armada untuk Kode PILOK ini tidak dapat dimuat. Silakan coba kembali.");
    } finally {
      if (requestId === loadSequence.current && !controller.signal.aborted) setIsLoadingRecord(false);
    }
  };

  const onValidSubmit = (values: ArmadaFormValues) => {
    if (!selectedMaster || !mode) return;
    setConfirmationValues(values);
  };

  const onInvalidSubmit = () => {
    window.requestAnimationFrame(() => {
      const firstInvalid = document.querySelector<HTMLElement>("[aria-invalid='true']");
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid?.focus();
    });
  };

  const confirmSave = async () => {
    if (!confirmationValues || !selectedMaster || !mode || isSaving) return;
    setIsSaving(true);
    setSaveError(undefined);
    try {
      const saved = mode === "new"
        ? await createSubmission(confirmationValues)
        : await updateSubmission(confirmationValues.kodePilokArmada, confirmationValues);
      const completedMaster: PilokArmadaMaster = {
        kodePilokArmada: saved.kodePilokArmada,
        distributorGroup: saved.distributorGroup,
        districtName: saved.districtName,
      };
      setConfirmationValues(undefined);
      setSuccess({ master: completedMaster, mode, submission: saved });
    } catch (error) {
      console.error("Save request failed.", error);
      setConfirmationValues(undefined);
      setSaveError("Data gagal disimpan. Nilai pada form tetap tersimpan. Silakan coba kembali.");
    } finally {
      setIsSaving(false);
    }
  };

  const returnToForm = () => {
    if (!success) return;
    setSelectedMaster(success.master);
    setMode("edit");
    reset(success.submission);
    setSuccess(undefined);
  };

  return (
    <FormShell>
      <BrandHeader />
      {success ? (
        <SuccessState master={success.master} mode={success.mode} onBack={returnToForm} />
      ) : (
        <form noValidate onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}>
          <div className="space-y-5">
            <SectionCard>
              <SectionHeader
                step={1}
                title="Informasi PILOK"
                description="Pilih kode PILOK untuk menampilkan informasi distributor dan district."
              />
              <Controller
                control={control}
                name="kodePilokArmada"
                render={({ field }) => (
                  <SearchableSelect
                    options={masterData}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      void loadRecord(value);
                    }}
                    onBlur={field.onBlur}
                    error={errors.kodePilokArmada?.message}
                    disabled={isLoadingMaster || Boolean(masterError)}
                  />
                )}
              />

              {isLoadingMaster ? (
                <p className="mt-4 text-sm text-slate-500" role="status">Memuat master data…</p>
              ) : masterError ? (
                <div className="mt-4">
                  <StatusBanner variant="error" title="Master data tidak tersedia">
                    <p>{masterError}</p>
                    <button type="button" className="button-secondary mt-3" onClick={() => void loadMasterData()}>
                      Coba Lagi
                    </button>
                  </StatusBanner>
                </div>
              ) : masterData.length === 0 ? (
                <div className="mt-4">
                  <StatusBanner variant="warning" title="Master data kosong">
                    Belum ada Kode Pilok Armada yang dapat dipilih.
                  </StatusBanner>
                </div>
              ) : null}

              {isLoadingRecord ? (
                <p className="mt-5 text-sm text-slate-500" role="status">Memuat data Armada…</p>
              ) : recordError ? (
                <div className="mt-5">
                  <StatusBanner variant="error" title="Data Armada tidak tersedia">
                    {recordError}
                  </StatusBanner>
                </div>
              ) : selectedMaster && mode ? (
                <div className="mt-5 space-y-4">
                  <StatusBanner
                    variant={mode === "edit" ? "warning" : "info"}
                    title={mode === "edit" ? "Edit Data" : "Submission Baru"}
                  >
                    {mode === "edit"
                      ? "Data yang tersimpan telah dimuat. Perubahan akan memperbarui data untuk kode ini."
                      : "Belum ada submission untuk kode ini. Semua jumlah armada dimulai dari nol."}
                  </StatusBanner>
                  <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <div className="readonly-field">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Distributor Group</dt>
                      <dd className="mt-1 break-words font-semibold text-slate-900">{selectedMaster.distributorGroup}</dd>
                    </div>
                    <div className="readonly-field">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">District Name</dt>
                      <dd className="mt-1 break-words font-semibold text-slate-900">{selectedMaster.districtName}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard>
              <SectionHeader
                step={2}
                title="Data Armada Darat"
                description="Masukkan jumlah unit berdasarkan kapasitas dan status kepemilikan."
              />
              {!selectedMaster || !mode ? (
                <StatusBanner variant="info" title="Pilih Kode Pilok Armada">
                  Data armada dapat diisi setelah Kode Pilok Armada dipilih.
                </StatusBanner>
              ) : (
                <ArmadaMatrix register={register} errors={errors} disabled={isLoadingRecord} />
              )}
            </SectionCard>

            <SectionCard>
              <SectionHeader
                step={3}
                title="Ringkasan Armada"
                description="Total dihitung otomatis dari seluruh kapasitas dan tidak dapat diedit."
              />
              <ArmadaSummary {...totals} />
            </SectionCard>
          </div>

          {saveError ? (
            <div className="mt-5">
              <StatusBanner variant="error" title="Penyimpanan gagal">{saveError}</StatusBanner>
            </div>
          ) : null}

          <ActionBar>
            <button
              type="submit"
              className="button-primary"
              disabled={isLoadingMaster || isLoadingRecord || isSaving}
            >
              {mode === "edit" ? "Simpan Perubahan" : "Simpan Data"}
            </button>
          </ActionBar>
        </form>
      )}

      {confirmationValues && selectedMaster && mode ? (
        <ConfirmationDialog
          isOpen
          master={selectedMaster}
          mode={mode}
          totals={calculateArmadaTotals(confirmationValues)}
          onCancel={() => setConfirmationValues(undefined)}
          onConfirm={() => void confirmSave()}
          isSaving={isSaving}
        />
      ) : null}
    </FormShell>
  );
}
