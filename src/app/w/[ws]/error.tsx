"use client";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error.digest ?? error.message); }, [error]);
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <p className="text-[17px] font-semibold">Não foi possível carregar esta página</p>
      <p className="mt-2 max-w-sm text-[14px] text-muted">Verifique sua conexão e tente novamente. Seus dados estão seguros.</p>
      <button onClick={reset} className="btn-primary mt-6"><RefreshCw size={16} /> Tentar novamente</button>
    </div>
  );
}
