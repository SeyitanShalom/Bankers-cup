import { LiveHomeDashboard } from "@/components/live-home-dashboard";
import { getCompetitionData } from "@/lib/data";

export const revalidate = 60;

export default async function Home() {
  const data = await getCompetitionData();

  return <LiveHomeDashboard initialData={data} />;
}
