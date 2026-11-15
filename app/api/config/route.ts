import { beginRequest, json } from "@/lib/http";
import { getRealtimeConfig, getServiceClient, sentimentMode } from "@/lib/supabase";
import type { RealtimeConfig } from "@/types/database";

export async function GET() {
  await beginRequest();
  const config: RealtimeConfig = {
    dataMode: getServiceClient() ? "supabase" : "memory",
    sentimentMode: sentimentMode(),
    supabase: getRealtimeConfig(),
  };
  return json(config);
}
