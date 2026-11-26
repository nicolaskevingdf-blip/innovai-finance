"use client";
import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { reportClientError } from "@/lib/report-error";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error, "root"); }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[18px] font-semibold">Algo deu errado</p>
      <p className="mt-2 max-w-sm text-[14px] text-muted">Já registramos o problema. Tente novamente; seus dados estão seguros.</p>
      <div className="mt-6 flex gap-3"><button onClick={reset} className="btn-primary"><RefreshCw size={16} /> Tentar novamente</button><Link href="/inicio" className="btn-secondary">Ir para o início</Link></div>
      {error.digest && <p className="mt-4 text-[11.5px] text-faint">Código para o suporte: {error.digest}</p>}
    </main>
  );
}
