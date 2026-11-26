"use client";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { reportClientError } from "@/lib/report-error";

export default function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error, "workspace"); }, [error]);
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <p className="text-[17px] font-semibold">Não foi possível carregar esta página</p>
      <p className="mt-2 max-w-sm text-[14px] text-muted">Verifique sua conexão e tente novamente. Seus dados estão seguros.</p>
      <button onClick={reset} className="btn-primary mt-6"><RefreshCw size={16} /> Tentar novamente</button>
      {error.digest && <p className="mt-4 text-[11.5px] text-faint">Código para o suporte: {error.digest}</p>}
    </div>
  );
}
