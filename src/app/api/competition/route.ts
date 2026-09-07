import { getCompetitionData } from "@/lib/data";
import {
  applyLocalCompetitionMutation,
  type LocalCompetitionMutation,
} from "@/lib/local-data";
import { hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isLocalWriteAllowed(request: Request) {
  if (process.env.BANKERS_CUP_LOCAL_MODE === "true") {
    return true;
  }

  const host = request.headers.get("host") ?? "";

  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host.startsWith("0.0.0.0:") ||
    host.startsWith("[::1]:")
  );
}

export async function GET() {
  const data = await getCompetitionData();

  return Response.json(data);
}

export async function POST(request: Request) {
  if (hasSupabaseConfig()) {
    return Response.json(
      { error: "Local data writes are disabled while Supabase is configured." },
      { status: 409 },
    );
  }

  if (!isLocalWriteAllowed(request)) {
    return Response.json(
      {
        error:
          "Local data writes are only available on localhost unless BANKERS_CUP_LOCAL_MODE=true is set.",
      },
      { status: 403 },
    );
  }

  try {
    const mutation = (await request.json()) as LocalCompetitionMutation;
    const data = await applyLocalCompetitionMutation(mutation);

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update local data" },
      { status: 400 },
    );
  }
}
