import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { PilokArmadaMaster } from "../types/armada";
import { FieldError } from "./FormLayout";

interface SearchableSelectProps {
  options: readonly PilokArmadaMaster[];
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  disabled?: boolean;
}

const getOptionLabel = (option: PilokArmadaMaster) =>
  `${option.kodePilokArmada} — ${option.distributorGroup} — ${option.districtName}`;

export function SearchableSelect({
  options,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
}: SearchableSelectProps) {
  const listboxId = useId();
  const inputId = "kodePilokArmada";
  const errorId = `${inputId}-error`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.kodePilokArmada === value);
  const [query, setQuery] = useState(selected ? getOptionLabel(selected) : "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(selected ? getOptionLabel(selected) : "");
  }, [selected]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery(selected ? getOptionLabel(selected) : "");
        onBlur();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onBlur, selected]);

  const filteredOptions = useMemo(() => {
    const selectedLabel = selected ? getOptionLabel(selected) : "";
    const effectiveQuery = query === selectedLabel ? "" : query.trim().toLocaleLowerCase("id-ID");
    if (!effectiveQuery) return options;
    return options.filter((option) =>
      [option.kodePilokArmada, option.distributorGroup, option.districtName].some((field) =>
        field.toLocaleLowerCase("id-ID").includes(effectiveQuery),
      ),
    );
  }, [options, query, selected]);

  const chooseOption = (option: PilokArmadaMaster) => {
    onChange(option.kodePilokArmada);
    setQuery(getOptionLabel(option));
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && isOpen && filteredOptions[activeIndex]) {
      event.preventDefault();
      chooseOption(filteredOptions[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setQuery(selected ? getOptionLabel(selected) : "");
    }
  };

  return (
    <div ref={rootRef} className="min-w-0">
      <label htmlFor={inputId} className="field-label">
        Kode Pilok Armada <span className="text-sig-dark" aria-hidden="true">*</span>
      </label>
      <div className="relative min-w-0">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          type="text"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={isOpen && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : "kodePilokArmada-helper"}
          className={`form-input pr-20 ${error ? "input-error" : ""}`}
          value={query}
          title={selected ? getOptionLabel(selected) : undefined}
          placeholder="Cari kode, distributor, atau district"
          disabled={disabled}
          onFocus={() => {
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(0);
            if (value) onChange("");
          }}
          onKeyDown={handleKeyDown}
        />
        {value ? (
          <button
            type="button"
            className="absolute right-10 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sig-red"
            aria-label="Hapus pilihan Kode Pilok Armada"
            onClick={() => {
              onChange("");
              setQuery("");
              setIsOpen(true);
              inputRef.current?.focus();
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          aria-label={isOpen ? "Tutup daftar Kode Pilok Armada" : "Buka daftar Kode Pilok Armada"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-slate-500"
          onClick={() => {
            setIsOpen((open) => !open);
            inputRef.current?.focus();
          }}
        >
          <span className={`block transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">⌄</span>
        </button>
        {isOpen ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Pilihan Kode Pilok Armada"
            className="absolute z-30 mt-1 max-h-72 w-full min-w-0 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => {
                const label = getOptionLabel(option);
                return (
                  <li
                    id={`${listboxId}-${index}`}
                    key={option.kodePilokArmada}
                    role="option"
                    aria-selected={option.kodePilokArmada === value}
                    title={label}
                    className={`cursor-pointer px-3 py-2.5 text-sm ${index === activeIndex ? "bg-red-50 text-sig-dark" : "text-slate-700 hover:bg-slate-50"}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => chooseOption(option)}
                  >
                    <span className="block truncate font-semibold">{option.kodePilokArmada} — {option.distributorGroup}</span>
                    <span className="block truncate text-xs text-slate-500">{option.districtName}</span>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-4 text-center text-sm text-slate-500">Data PILOK tidak ditemukan.</li>
            )}
          </ul>
        ) : null}
      </div>
      <p id="kodePilokArmada-helper" className="mt-1.5 text-sm text-slate-500">
        Cari berdasarkan kode, nama distributor, atau district.
      </p>
      <FieldError id={errorId} message={error} />
    </div>
  );
}
