"use client";
import { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";

/** Último recurso: falha no layout raiz. Estilos inline porque o CSS pode não ter carregado. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error, "global"); }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0B0B0B", color: "#fff", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600 }}>A Innovai Finance encontrou um erro</p>
          <p style={{ color: "#a3a3a3", fontSize: 14 }}>Seus dados estão seguros. Tente novamente em instantes.</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#A6FF00", color: "#0B0B0B", border: 0, borderRadius: 12, padding: "10px 18px", fontWeight: 600 }}>Tentar novamente</button>
        </div>
      </body>
    </html>
  );
}
