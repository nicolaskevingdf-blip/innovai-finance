/** Esqueleto exibido enquanto os dados do ambiente carregam. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-5">
      <div className="space-y-2"><div className="skeleton h-3 w-28" /><div className="skeleton h-7 w-48" /></div>
      <div className="skeleton h-44 w-full rounded-[var(--radius-card)]" />
      <div className="grid grid-cols-2 gap-3"><div className="skeleton h-24 rounded-[var(--radius-card)]" /><div className="skeleton h-24 rounded-[var(--radius-card)]" /></div>
      <div className="skeleton h-64 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
