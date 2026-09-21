interface ArmadaSummaryProps {
  milik: number;
  sewa: number;
  total: number;
}

export function ArmadaSummary({ milik, sewa, total }: ArmadaSummaryProps) {
  const items = [
    { label: "Total Armada Milik", value: milik, accent: false },
    { label: "Total Armada Sewa", value: sewa, accent: false },
    { label: "Total Armada", value: total, accent: true },
  ];

  return (
    <dl className="grid min-w-0 gap-3 sm:grid-cols-3" aria-label="Ringkasan total armada">
      {items.map((item) => (
        <div
          key={item.label}
          className={`min-w-0 rounded-lg border p-4 ${item.accent ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}
        >
          <dt className="text-sm font-medium text-slate-600">{item.label}</dt>
          <dd className={`mt-1 text-2xl font-bold tabular-nums ${item.accent ? "text-sig-dark" : "text-slate-900"}`}>
            <output aria-label={item.label}>{item.value}</output>{" "}
            <span className="text-sm font-medium">Unit</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
