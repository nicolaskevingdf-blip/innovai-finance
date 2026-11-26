/** Envia ao servidor um aviso técnico de erro ocorrido no navegador (sem dados do usuário). */
export function reportClientError(error: Error & { digest?: string }, where: string) {
  try {
    const body = JSON.stringify({ digest: error.digest, name: error.name, path: location.pathname, where });
    if (!navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" })))
      void fetch("/api/client-error", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  } catch { /* nunca quebra a tela de erro */ }
}
