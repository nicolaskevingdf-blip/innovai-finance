import type { Instrumentation } from "next";

/** Toda exceção não tratada no servidor (páginas, server actions, rotas) vira um log estruturado. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logEvent, errorKind } = await import("./lib/log");
  const e = err as Error & { digest?: string };
  logEvent("error", "server.error", {
    ...errorKind(e),
    digest: e.digest,
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    kind: context.routeType,
  });
};
