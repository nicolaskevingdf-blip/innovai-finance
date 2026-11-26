"use client";
/**
 * Gráficos carregados sob demanda: a biblioteca de gráficos (Recharts) é a dependência
 * mais pesada do app e só é baixada quando um gráfico aparece na tela.
 */
import dynamic from "next/dynamic";

const Placeholder = ({ h }: { h: number }) => <div className="skeleton w-full" style={{ height: h }} aria-hidden />;

export const MonthlyBars = dynamic(() => import("./charts").then((m) => m.MonthlyBars), { ssr: false, loading: () => <Placeholder h={220} /> });
export const BalanceArea = dynamic(() => import("./charts").then((m) => m.BalanceArea), { ssr: false, loading: () => <Placeholder h={220} /> });
