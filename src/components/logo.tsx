/**
 * Marca Innovai.
 *
 * O monograma "N" reproduz a identidade oficial (N branco com facetas em verde-limão)
 * a partir das peças de apresentação da marca. Quando o arquivo vetorial oficial
 * estiver disponível, substitua apenas o conteúdo de <InnovaiMark /> — todo o app
 * (cabeçalhos, login, PWA) usa este componente.
 */
import clsx from "clsx";

export function InnovaiMark({ className, title = "Innovai" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <path d="M9 13h12v38H9z" fill="#FFFFFF" />
      <path d="M9 39l12 12H9z" fill="#A6FF00" />
      <path d="M9 13h12l26 38H35z" fill="#FFFFFF" />
      <path d="M35 26.5l12-7V51H35z" fill="#FFFFFF" />
      <path d="M35 21.5l12-12v8l-12 9z" fill="#A6FF00" />
    </svg>
  );
}

/** Versão compacta: monograma em quadrado arredondado com borda verde-limão (app/perfil). */
export function InnovaiBadge({ size = 36, className, shape = "square" }: { size?: number; className?: string; shape?: "square" | "circle" }) {
  return (
    <span className={clsx("inline-grid shrink-0 place-items-center border-[1.5px] border-lime bg-bg", shape === "circle" ? "rounded-full" : "rounded-[28%]", className)} style={{ width: size, height: size }}>
      <InnovaiMark className="h-[62%] w-[62%]" />
    </span>
  );
}

/** Logotipo: símbolo + INNOVAI (com "AI" em verde-limão) + nome do produto. */
export function Logo({ className, product = true, size = "md", symbol = true }: { className?: string; product?: boolean; size?: "sm" | "md" | "lg"; symbol?: boolean }) {
  const s = { sm: { mark: "h-6 w-6", word: "text-[15px]", sub: "text-[8.5px]" }, md: { mark: "h-8 w-8", word: "text-[19px]", sub: "text-[9.5px]" }, lg: { mark: "h-12 w-12", word: "text-[28px]", sub: "text-[11px]" } }[size];
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      {symbol && <InnovaiMark className={s.mark} />}
      <span className="flex flex-col leading-none">
        <span className={clsx("font-display font-semibold tracking-[0.06em]", s.word)}>INNOV<span className="text-lime">AI</span></span>
        {product && <span className={clsx("mt-1 font-display font-medium tracking-[0.32em] text-muted", s.sub)}>FINANCE</span>}
      </span>
    </span>
  );
}
