import { beginRequest, errorMessage, json } from "@/lib/http";
import { getPrices } from "@/lib/prices";

export async function GET() {
  await beginRequest();
  try {
    return json(await getPrices());
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}
