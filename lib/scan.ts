import { analyzeTicker } from "@/lib/grok";
import { getPortfolio, recordSignal } from "@/lib/repository";
import { parseStrategy, parseTickers } from "@/lib/trading";
import type { ScanResponse, ScanTickerResult, SentimentSource } from "@/types/database";

export async function runScan(input: unknown): Promise<ScanResponse> {
  const tickers = parseTickers(input);
  const strategy = parseStrategy(input);
  const results: ScanTickerResult[] = [];

  for (const ticker of tickers) {
    let source: SentimentSource = "grok";
    try {
      const analysis = await analyzeTicker(ticker);
      source = analysis.source;
      const saved = await recordSignal(analysis.draft, strategy);
      results.push({
        ticker,
        source,
        signal: saved.signal,
        trade: saved.trade,
        skippedReason: saved.skippedReason,
        error: null,
      });
    } catch (error) {
      results.push({
        ticker,
        source,
        signal: null,
        trade: null,
        skippedReason: null,
        error: error instanceof Error ? error.message : "Scan failed",
      });
    }
  }

  const portfolio = await getPortfolio();
  return { results, portfolio };
}
