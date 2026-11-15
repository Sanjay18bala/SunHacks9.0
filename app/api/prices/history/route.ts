import { beginRequest, errorMessage, json } from "@/lib/http";
import { getPriceHistory, parseHistoryTicker } from "@/lib/prices";

export async function GET(request: Request) {
  await beginRequest();
  try {
    const ticker = parseHistoryTicker(new URL(request.url).searchParams.get("ticker"));
    return json({ ticker, points: await getPriceHistory(ticker) });
  } catch (error) {
    const message = errorMessage(error);
    const status = message.startsWith("ticker must") ? 400 : 502;
    return json({ error: message }, status);
  }
}
