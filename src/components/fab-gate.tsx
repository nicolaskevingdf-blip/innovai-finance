"use client";
import { usePathname } from "next/navigation";

/** Oculta o botão flutuante onde ele cobriria ações da página (ex.: campo do assistente). */
export function FabGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.endsWith("/inteligencia")) return null;
  return <>{children}</>;
}
