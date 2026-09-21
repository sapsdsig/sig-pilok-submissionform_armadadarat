import type { PropsWithChildren, ReactNode } from "react";

export function FormShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-100 text-ink">
      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export function BrandHeader() {
  return (
    <header className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="h-1.5 bg-sig-red" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex min-w-0 items-center gap-5">
          <img className="h-9 w-auto sm:h-11" src="/branding/sig-logo-red.svg" alt="SIG" />
          <div className="h-9 w-px bg-slate-200" aria-hidden="true" />
          <img className="h-8 w-auto sm:h-9" src="/branding/pilok-logo-red.svg" alt="PILOK" />
        </div>
        <div className="min-w-0 sm:text-right">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            PILOK - Armada Darat
          </h1>
          <p className="mt-1 text-sm text-slate-600">Pendataan Armada Darat PILOK</p>
        </div>
      </div>
    </header>
  );
}

interface SectionCardProps extends PropsWithChildren {
  className?: string;
}

export function SectionCard({ children, className = "" }: SectionCardProps) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

interface SectionHeaderProps {
  step: number;
  title: string;
  description?: string;
}

export function SectionHeader({ step, title, description }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex min-w-0 items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-sig-dark">
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
    </div>
  );
}

interface FieldErrorProps {
  id: string;
  message?: string;
}

export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-red-700">
      {message}
    </p>
  );
}

interface StatusBannerProps {
  variant: "info" | "success" | "warning" | "error";
  title: string;
  children: ReactNode;
}

const bannerStyles = {
  info: "border-blue-200 bg-blue-50 text-blue-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-red-200 bg-red-50 text-red-950",
};

export function StatusBanner({ variant, title, children }: StatusBannerProps) {
  return (
    <div className={`rounded-lg border p-4 ${bannerStyles[variant]}`} role="status">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-sm leading-6 opacity-90">{children}</div>
    </div>
  );
}

export function ActionBar({ children }: PropsWithChildren) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-4 shadow-[0_-5px_20px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border sm:px-6 sm:shadow-card">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{children}</div>
    </div>
  );
}
