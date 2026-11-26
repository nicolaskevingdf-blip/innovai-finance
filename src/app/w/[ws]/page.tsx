import { getWorkspace } from "@/lib/data/workspace";
import { PersonalDashboard } from "./_dash/personal";
import { BusinessDashboard } from "./_dash/business";

export default async function Home({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await getWorkspace(ws);
  return ctx.ws.kind === "business" ? <BusinessDashboard ctx={ctx} /> : <PersonalDashboard ctx={ctx} />;
}
