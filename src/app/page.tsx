import { LiveHomeDashboard } from "@/components/live-home-dashboard";
import { getCompetitionData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getCompetitionData();

  return <LiveHomeDashboard initialData={data} />;
}
