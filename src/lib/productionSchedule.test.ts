import { describe, expect, it } from "vitest";
import type { ProductionSchedulePhase } from "../types/story";
import {
  compactScheduleDate,
  currentSchedulePhase,
  dateKeyInTimeZone,
  scheduleDateRange,
  schedulePhaseState,
  scheduleTodayLabel,
} from "./productionSchedule";

const phases: ProductionSchedulePhase[] = [
  { id: "phase-1", startDate: "2026-09-01", endDate: "2026-09-06", title: "第一阶段", items: ["准备"] },
  { id: "phase-2", startDate: "2026-09-07", endDate: "2026-09-16", title: "第二阶段", items: ["制作"] },
];

describe("production schedule helpers", () => {
  it("uses the configured timezone when resolving today", () => {
    expect(dateKeyInTimeZone(new Date("2026-09-02T16:30:00.000Z"), "Asia/Shanghai")).toBe("2026-09-03");
  });

  it("selects a phase inclusively on its start and end dates", () => {
    expect(currentSchedulePhase(phases, "2026-09-01")?.id).toBe("phase-1");
    expect(currentSchedulePhase(phases, "2026-09-06")?.id).toBe("phase-1");
    expect(currentSchedulePhase(phases, "2026-09-07")?.id).toBe("phase-2");
  });

  it("classifies and formats schedule dates for the overview", () => {
    expect(schedulePhaseState(phases[0], "2026-09-07")).toBe("past");
    expect(schedulePhaseState(phases[1], "2026-09-07")).toBe("current");
    expect(compactScheduleDate("2026-09-03")).toBe("9.03");
    expect(scheduleDateRange(phases[0])).toBe("9.01–9.06");
    expect(scheduleTodayLabel("2026-09-03")).toBe("9月3日");
  });
});
