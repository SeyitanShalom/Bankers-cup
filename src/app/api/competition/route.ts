import { getCompetitionData } from "@/lib/data";

export async function GET() {
  const data = await getCompetitionData();

  return Response.json(data);
}
