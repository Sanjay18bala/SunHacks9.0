import { beginRequest, errorMessage, json } from "@/lib/http";
import { getPriceHistory } from "@/lib/prices";
import { listWatchlist } from "@/lib/repository";

export async function GET(request: Request) {
  await beginRequest();
  const ticker = (new URL(request.url).searchParams.get("ticker") ?? "").toUpperCase();
  try {
    const asset = (await listWatchlist()).find((item) => item.symbol === ticker);
    if (!asset) return json({ error: `${ticker || "That coin"} is not on the watchlist` }, 400);
    return json({ ticker, points: await getPriceHistory(asset) });
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}
