import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArmadaMatrix } from "./components/ArmadaMatrix";
import { ArmadaChangeQuestion } from "./components/ArmadaChangeQuestion";
import { ArmadaSummary } from "./components/ArmadaSummary";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { DiscardChangesDialog } from "./components/DiscardChangesDialog";
import {
  ActionBar,
  BrandHeader,
  FormShell,
  SectionCard,
  SectionHeader,
  StatusBanner,
} from "./components/FormLayout";
import { PilokEntryGate } from "./components/PilokEntryGate";
import { PilokIdentitySummary } from "./components/PilokIdentitySummary";
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

interface LookupError {
  title: string;
  message: string;
}

export default function App() {
  const [masterData, setMasterData] = useState<PilokArmadaMaster[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);
  const [masterError, setMasterError] = useState<string>();
  const [entryCode, setEntryCode] = useState("");
  const [entryInputError, setEntryInputError] = useState<string>();
  const [lookupError, setLookupError] = useState<LookupError>();
  const [pendingCode, setPendingCode] = useState<string>();
  const [selectedMaster, setSelectedMaster] = useState<PilokArmadaMaster>();
  const [mode, setMode] = useState<SubmissionMode>();
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [confirmationValues, setConfirmationValues] = useState<ArmadaFormValues>();
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [success, setSuccess] = useState<{
    master: PilokArmadaMaster;
    mode: SubmissionMode;
    submission: ArmadaSubmissionRecord;
  }>();
  const loadSequence = useRef(0);
  const entryInputRef = useRef<HTMLInputElement>(null);
  const recordAbortController = useRef<AbortController>();
  const masterAbortController = useRef<AbortController>();
  const loadedArmadaValues = useRef(createEmptyFormValues().armada);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
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
      adaPerubahan: watchedValues.adaPerubahan ?? "",
      armada: {
        milik: { ...createEmptyFormValues().armada.milik, ...watchedValues.armada?.milik },
        sewa: { ...createEmptyFormValues().armada.sewa, ...watchedValues.armada?.sewa },
      },
    }),
    [watchedValues],
  );
  const totals = calculateArmadaTotals(safeValues);

  const focusEntryInput = () => {
    window.requestAnimationFrame(() => entryInputRef.current?.focus());
  };

  const cancelRecordLookup = () => {
    loadSequence.current += 1;
    recordAbortController.current?.abort();
    recordAbortController.current = undefined;
    setPendingCode(undefined);
    setIsLoadingRecord(false);
  };

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

  const loadRecord = async (master: PilokArmadaMaster) => {
    const { kodePilokArmada } = master;
    const requestId = ++loadSequence.current;
    recordAbortController.current?.abort();
    const controller = new AbortController();
    recordAbortController.current = controller;
    setEntryInputError(undefined);
    setLookupError(undefined);
    setSaveError(undefined);
    setPendingCode(kodePilokArmada);
    setIsLoadingRecord(true);

    try {
      const existing = await getExistingSubmission(kodePilokArmada, controller.signal);
      if (requestId !== loadSequence.current || controller.signal.aborted) return;
      const loadedValues = existing ?? createEmptyFormValues(kodePilokArmada);
      loadedArmadaValues.current = structuredClone(loadedValues.armada);
      setSelectedMaster(master);
      setMode(existing ? "edit" : "new");
      reset(loadedValues);
    } catch (error) {
      if (requestId !== loadSequence.current || controller.signal.aborted) return;
      console.error("Submission request failed.", error);
      setSelectedMaster(undefined);
      setMode(undefined);
      loadedArmadaValues.current = createEmptyFormValues().armada;
      reset(createEmptyFormValues());
      setLookupError({
        title: "Data Armada Truk tidak tersedia",
        message: "Data Armada Truk untuk Kode PILOK ini tidak dapat dimuat. Silakan coba kembali.",
      });
      focusEntryInput();
    } finally {
      if (requestId === loadSequence.current && !controller.signal.aborted) {
        setPendingCode(undefined);
        setIsLoadingRecord(false);
      }
    }
  };

  const handleEntryCodeChange = (value: string) => {
    if (isLoadingRecord && value.trim() !== pendingCode) cancelRecordLookup();
    setEntryCode(value);
    setEntryInputError(undefined);
    setLookupError(undefined);
  };

  const handleEntrySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = entryCode.trim();
    setEntryCode(normalizedCode);
    setEntryInputError(undefined);
    setLookupError(undefined);

    if (isLoadingRecord && normalizedCode === pendingCode) return;
    if (!normalizedCode) {
      cancelRecordLookup();
      setEntryInputError("Kode PILOK wajib diisi.");
      focusEntryInput();
      return;
    }

    const master = masterData.find((record) => record.kodePilokArmada === normalizedCode);
    if (!master) {
      cancelRecordLookup();
      setEntryInputError("Kode PILOK tidak ditemukan.");
      setLookupError({
        title: "Kode PILOK tidak ditemukan",
        message: "Periksa kembali kode atau lihat daftar Master PILOK.",
      });
      focusEntryInput();
      return;
    }

    void loadRecord(master);
  };

  const resetToEntryGate = () => {
    cancelRecordLookup();
    setSelectedMaster(undefined);
    setMode(undefined);
    setEntryCode("");
    setEntryInputError(undefined);
    setLookupError(undefined);
    setSaveError(undefined);
    setConfirmationValues(undefined);
    setSuccess(undefined);
    setIsDiscardDialogOpen(false);
    loadedArmadaValues.current = createEmptyFormValues().armada;
    reset(createEmptyFormValues());
    focusEntryInput();
  };

  const requestCodeChange = () => {
    if (isDirty) {
      setIsDiscardDialogOpen(true);
      return;
    }
    resetToEntryGate();
  };

  const onValidSubmit = (values: ArmadaFormValues) => {
    if (!selectedMaster || !mode) return;
    setConfirmationValues(values);
  };

  const handleAdaPerubahanChange = (value: "YA" | "TIDAK") => {
    if (value === "TIDAK") {
      setValue("armada", structuredClone(loadedArmadaValues.current), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
    setValue("adaPerubahan", value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
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
      loadedArmadaValues.current = structuredClone(saved.armada);
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
    setEntryCode(success.master.kodePilokArmada);
    loadedArmadaValues.current = structuredClone(success.submission.armada);
    reset(success.submission);
    setSuccess(undefined);
  };

  const isGateVisible = !success && (!selectedMaster || !mode);
  const isSameCodeLoading = isLoadingRecord && entryCode.trim() === pendingCode;
  const canContinue = !isLoadingMaster
    && !masterError
    && masterData.length > 0
    && !isSameCodeLoading;

  return (
    <FormShell>
      <BrandHeader />
      <main
        className={`mx-auto w-full px-4 py-6 transition-[max-width] sm:px-6 sm:py-8 lg:px-8 ${
          isGateVisible ? "max-w-2xl" : "max-w-5xl"
        }`}
      >
        {success ? (
          <SuccessState master={success.master} mode={success.mode} onBack={returnToForm} />
        ) : isGateVisible ? (
          <PilokEntryGate
            code={entryCode}
            inputRef={entryInputRef}
            inputError={entryInputError}
            lookupError={lookupError}
            isLoadingMaster={isLoadingMaster}
            masterError={masterError}
            isMasterEmpty={!isLoadingMaster && !masterError && masterData.length === 0}
            isContinuing={isSameCodeLoading}
            canContinue={canContinue}
            onCodeChange={handleEntryCodeChange}
            onSubmit={handleEntrySubmit}
            onRetryMaster={() => void loadMasterData()}
          />
        ) : (
          <form noValidate onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}>
            <div className="space-y-5">
              <PilokIdentitySummary
                master={selectedMaster!}
                mode={mode!}
                onChangeCode={requestCodeChange}
              />

              <SectionCard>
                <SectionHeader
                  step={2}
                  title="Data Armada Truk"
                  description="Masukkan jumlah unit berdasarkan kapasitas dan status kepemilikan."
                  supportingText="Data yang ditampilkan pada menu ini merupakan data yang telah digunakan di Evaluasi HY 2026"
                />
                <ArmadaMatrix
                  register={register}
                  errors={errors}
                  disabled={safeValues.adaPerubahan !== "YA"}
                />
                <ArmadaChangeQuestion
                  value={safeValues.adaPerubahan}
                  error={errors.adaPerubahan?.message}
                  onChange={handleAdaPerubahanChange}
                />
              </SectionCard>

              <SectionCard>
                <SectionHeader
                  step={3}
                  title="Ringkasan Armada Truk"
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
              <button type="submit" className="button-primary" disabled={isSaving}>
                {mode === "edit" ? "Simpan Perubahan" : "Simpan Data"}
              </button>
            </ActionBar>
          </form>
        )}
      </main>

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

      <DiscardChangesDialog
        isOpen={isDiscardDialogOpen}
        onCancel={() => setIsDiscardDialogOpen(false)}
        onConfirm={resetToEntryGate}
      />
    </FormShell>
  );
}
