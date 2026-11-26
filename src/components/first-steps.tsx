import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardHeader } from "./ui";

export interface Step { label: string; hint: string; done: boolean; href?: string; optional?: boolean }

/** Guia de primeiros passos: aparece até o essencial estar feito e some sozinho depois. */
export function FirstSteps({ steps }: { steps: Step[] }) {
  const required = steps.filter((s) => !s.optional);
  if (required.every((s) => s.done)) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <Card>
      <CardHeader title="Primeiros passos" subtitle={`${done} de ${steps.length} concluídos · leva cerca de 2 minutos`} />
      <ol className="px-4 pb-3 pt-1 sm:px-5">
        {steps.map((s) => {
          const body = (
            <span className="flex items-start gap-3 py-2.5">
              {s.done ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-lime" /> : <Circle size={19} className="mt-0.5 shrink-0 text-faint" />}
              <span className="min-w-0">
                <span className={s.done ? "block text-[14px] text-muted line-through decoration-line-strong" : "block text-[14px] font-medium"}>{s.label}{s.optional && <span className="font-normal text-faint"> (opcional)</span>}</span>
                {!s.done && <span className="block text-[12.5px] text-faint">{s.hint}</span>}
              </span>
            </span>
          );
          return <li key={s.label} className="border-t border-line first:border-t-0">{s.href && !s.done ? <Link href={s.href} className="block rounded-lg hover:bg-surface-2">{body}</Link> : body}</li>;
        })}
      </ol>
    </Card>
  );
}
