import assert from "node:assert/strict";
import test from "node:test";
import { formatChartTime } from "./format";
import { CHART_RANGES, isChartRange, selectChartPoints, type PricePoint } from "./prices";

const HOUR = 60 * 60 * 1000;

function series(count: number, step: number, start = 1_700_000_000_000): PricePoint[] {
  return Array.from({ length: count }, (_, index) => ({
    time: start + index * step,
    price: 100 + index,
  }));
}

test("chart ranges are the six windows", () => {
  assert.deepEqual(CHART_RANGES, ["1h", "1d", "1w", "1m", "1y", "max"]);
  for (const range of CHART_RANGES) assert.equal(isChartRange(range), true);
  assert.equal(isChartRange("2d"), false);
  assert.equal(isChartRange(""), false);
});

test("1H keeps the last hour and the other windows keep the whole series", () => {
  const points = series(48, 5 * 60 * 1000);
  const hour = selectChartPoints(points, "1h");
  const end = points[points.length - 1].time;
  assert.ok(hour.length >= 2);
  assert.ok(hour.every((point) => point.time >= end - HOUR));
  assert.equal(hour[hour.length - 1].time, end);
  assert.equal(selectChartPoints(points, "1d").length, points.length);
  assert.equal(selectChartPoints(points, "max")[0].time, points[0].time);
});

test("1H still draws a line when the hour has a single point", () => {
  const points = [
    { time: 0, price: 10 },
    { time: 2 * HOUR, price: 12 },
  ];
  const hour = selectChartPoints(points, "1h");
  assert.equal(hour.length, 2);
  assert.equal(hour[1].price, 12);
});

test("long windows are capped and a year of daily prices stays intact", () => {
  const points = series(900, HOUR);
  const year = selectChartPoints(points, "1y");
  assert.ok(year.length <= 400);
  assert.equal(year[year.length - 1].time, points[points.length - 1].time);
  assert.equal(year[0].time, points[0].time);
  assert.equal(selectChartPoints(series(365, 24 * HOUR), "1y").length, 365);
});

test("chart timestamps drop the clock on yearly windows", () => {
  const iso = "2026-11-15T16:00:00.000Z";
  assert.match(formatChartTime(iso, "1h"), /9:00/);
  assert.match(formatChartTime(iso, "max"), /2026/);
  assert.doesNotMatch(formatChartTime(iso, "max"), /9:00/);
});
