"use client";
import { Printer } from "lucide-react";
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn-secondary btn-sm"><Printer size={15} /> Exportar PDF</button>;
}
