import { beginRequest, errorMessage, json } from "@/lib/http";
import { runScan } from "@/lib/scan";

export async function POST(request: Request) {
  await beginRequest();
  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return json({ error: "Request body must be JSON" }, 400);
    }
  }

  try {
    const result = await runScan(body);
    const saved = result.results.some((item) => item.signal);
    if (!saved && result.results.some((item) => item.error)) {
      return json({ error: result.results.map((item) => item.error).filter(Boolean).join(" "), results: result.results }, 502);
    }
    return json(result);
  } catch (error) {
    return json({ error: errorMessage(error) }, 400);
  }
}
