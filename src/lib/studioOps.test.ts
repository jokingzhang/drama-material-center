import { describe, expect, it } from "vitest";
import { formatDaysUntil } from "./studioOps";

describe("formatDaysUntil", () => {
  const fixedNow = new Date("2026-11-27T12:00:00+08:00");

  it("formats today, future, and overdue dates cleanly", () => {
    expect(formatDaysUntil("2026-11-27", fixedNow)).toEqual({ label: "就是今天", overdue: false });
    expect(formatDaysUntil("2026-12-02", fixedNow)).toEqual({ label: "还有 5 天", overdue: false });
    expect(formatDaysUntil("2026-12-19", fixedNow)).toEqual({ label: "还有 22 天", overdue: false });
    expect(formatDaysUntil("2026-11-25", fixedNow)).toEqual({ label: "已过 2 天", overdue: true });
  });

  it("ignores empty or invalid date strings", () => {
    expect(formatDaysUntil(undefined, fixedNow)).toBeUndefined();
    expect(formatDaysUntil("待定", fixedNow)).toBeUndefined();
  });
});
