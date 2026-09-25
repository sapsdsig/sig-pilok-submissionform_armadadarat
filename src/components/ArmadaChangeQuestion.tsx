import type { AdaPerubahan, AdaPerubahanValue } from "../types/armada";
import { FieldError } from "./FormLayout";

interface ArmadaChangeQuestionProps {
  value: AdaPerubahanValue;
  error?: string;
  onChange: (value: AdaPerubahan) => void;
}

const options: readonly { label: string; value: AdaPerubahan }[] = [
  { label: "Tidak", value: "TIDAK" },
  { label: "Ya", value: "YA" },
];

export function ArmadaChangeQuestion({ value, error, onChange }: ArmadaChangeQuestionProps) {
  const descriptionId = "ada-perubahan-description";
  const errorId = "ada-perubahan-error";

  return (
    <fieldset
      className={`mt-5 rounded-lg border p-4 sm:p-5 ${error ? "border-red-300 bg-red-50/40" : "border-slate-200 bg-slate-50"}`}
      aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
    >
      <legend className="px-1 text-sm font-semibold text-slate-900">Apakah Ada Perubahan?</legend>
      <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-600">
        Pilih Ya jika terdapat perubahan pada data Armada Truk yang ditampilkan.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-red-100 ${
              value === option.value
                ? "border-sig-red text-slate-900"
                : "border-slate-300 text-slate-700 hover:border-slate-400"
            }`}
          >
            <input
              type="radio"
              name="adaPerubahan"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-invalid={Boolean(error)}
              className="h-4 w-4 shrink-0 accent-sig-red"
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
