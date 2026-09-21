import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { ARMADA_CAPACITIES } from "../constants/armada";
import type { ArmadaFormValues } from "../types/armada";
import { FieldError } from "./FormLayout";

interface ArmadaMatrixProps {
  register: UseFormRegister<ArmadaFormValues>;
  errors: FieldErrors<ArmadaFormValues>;
  disabled?: boolean;
}

export function ArmadaMatrix({ register, errors, disabled = false }: ArmadaMatrixProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200">
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 sm:grid">
        <span>Kapasitas</span>
        <span>Milik</span>
        <span>Sewa</span>
      </div>
      <div className="divide-y divide-slate-200">
        {ARMADA_CAPACITIES.map(({ key, label }) => (
          <div
            key={key}
            className="grid min-w-0 grid-cols-2 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)] sm:items-start"
          >
            <p className="col-span-2 font-semibold text-slate-800 sm:col-span-1 sm:pt-3">{label}</p>
            {(["milik", "sewa"] as const).map((category) => {
              const inputId = `armada-${category}-${key}`;
              const error = errors.armada?.[category]?.[key]?.message;
              return (
                <div key={category} className="min-w-0">
                  <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-slate-600 sm:sr-only">
                    {category === "milik" ? "Milik" : "Sewa"} {label}
                  </label>
                  <div className="relative">
                    <input
                      id={inputId}
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      disabled={disabled}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      className={`form-input pr-12 text-right tabular-nums ${error ? "input-error" : ""}`}
                      {...register(`armada.${category}.${key}`, {
                        setValueAs: (value: string) => value === "" ? 0 : Number(value),
                      })}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Unit</span>
                  </div>
                  <FieldError id={`${inputId}-error`} message={error} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
