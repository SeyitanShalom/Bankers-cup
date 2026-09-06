import { AdminConsole } from "./admin-console";
import { getCompetitionData } from "@/lib/data";

export const revalidate = 0;

export default async function AdminPage() {
  const data = await getCompetitionData();

  return <AdminConsole initialData={data} />;
}
