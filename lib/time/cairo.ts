import { format } from "date-fns-tz";

const CAIRO_TZ = "Africa/Cairo";

export function todayInCairo(): string {
  return format(new Date(), "yyyy-MM-dd", { timeZone: CAIRO_TZ });
}

export function nowInCairoIso(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: CAIRO_TZ });
}

export function startOfMonthCairo(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function lastDayOfMonthCairo(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return format(d, "yyyy-MM-dd", { timeZone: "UTC" });
}

export function dateInCairo(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysFromCairo(date1: string, date2: string): number {
  const d1 = new Date(`${date1}T00:00:00Z`).getTime();
  const d2 = new Date(`${date2}T00:00:00Z`).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

export function addMonthsCairo(year: number, month: number, deltaMonths: number): { year: number; month: number } {
  const total = (year * 12 + (month - 1)) + deltaMonths;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function cairoYearMonth(date: string): { year: number; month: number } {
  const [yStr, mStr] = date.split("-");
  return { year: Number(yStr), month: Number(mStr) };
}

export function dayOfMonth(date: string): number {
  const parts = date.split("-");
  return Number(parts[2]);
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
