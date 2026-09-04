import type { ProductionSchedulePhase } from "../types/story";

export type ProductionSchedulePhaseState = "past" | "current" | "upcoming";

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error(`Invalid schedule date: ${dateKey}`);
  return { year: match[1], month: match[2], day: match[3] };
}

export function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function schedulePhaseState(phase: ProductionSchedulePhase, dateKey: string): ProductionSchedulePhaseState {
  if (dateKey < phase.startDate) return "upcoming";
  if (dateKey > phase.endDate) return "past";
  return "current";
}

export function currentSchedulePhase(phases: ProductionSchedulePhase[], dateKey: string) {
  return phases.find((phase) => schedulePhaseState(phase, dateKey) === "current");
}

export function compactScheduleDate(dateKey: string) {
  const { month, day } = parseDateKey(dateKey);
  return `${Number(month)}.${day}`;
}

export function scheduleDateRange(phase: ProductionSchedulePhase) {
  return `${compactScheduleDate(phase.startDate)}–${compactScheduleDate(phase.endDate)}`;
}

export function scheduleTodayLabel(dateKey: string) {
  const { month, day } = parseDateKey(dateKey);
  return `${Number(month)}月${Number(day)}日`;
}
