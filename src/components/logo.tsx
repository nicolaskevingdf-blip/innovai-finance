export function Logo({ className = "", product = true }: { className?: string; product?: boolean }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 font-semibold tracking-tight ${className}`}>
      <span className="relative">innovai<span className="absolute -right-1.5 top-0.5 size-1.5 rounded-full bg-lime" /></span>
      {product && <span className="ml-1 font-normal text-muted">finance</span>}
    </span>
  );
}
