export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">{title}</h2>
      {children}
    </section>
  );
}

export function Badge({ value }: { value: string }) {
  const tone =
    value === 'error' || value === 'blocked'
      ? 'bg-rose-500/20 text-rose-200'
      : value === 'busy' || value === 'in_progress'
        ? 'bg-cyan-500/20 text-cyan-200'
        : value === 'offline' || value === 'warning'
          ? 'bg-amber-500/20 text-amber-200'
          : 'bg-slate-700 text-slate-200';

  return <span className={`rounded px-2 py-0.5 text-xs ${tone}`}>{value}</span>;
}
