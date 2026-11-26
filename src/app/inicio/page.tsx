import { redirect } from "next/navigation";
import { getUser, listWorkspaces } from "@/lib/data/workspace";

/** Rota de entrada: leva ao primeiro ambiente ou ao onboarding. */
export default async function Inicio() {
  if (!(await getUser())) redirect("/entrar");
  const all = await listWorkspaces();
  if (!all.length) redirect("/onboarding");
  redirect(`/w/${(all.find((w) => w.kind === "personal") ?? all[0]).id}`);
}
