import { beginRequest, errorMessage, json } from "@/lib/http";
import { resetDemo } from "@/lib/repository";

export async function POST() {
  await beginRequest();
  try {
    return json({ portfolio: await resetDemo() });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
