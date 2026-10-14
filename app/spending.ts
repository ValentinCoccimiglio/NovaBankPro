import { DEMO_REFERENCE_DATE, type Movement } from "./demo-data";

export const periodLabel = (month: string) =>
  new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T12:00:00Z`));

export function spendingSummary(movements: Movement[], month: string, throughDay = 31) {
  const completed = movements.filter((item) => item.status === "completed" &&
    item.date.slice(0, 7) === month && Number(item.date.slice(8, 10)) <= throughDay);
  let incomeCents = 0;
  let expenseCents = 0;
  const categories = new Map<string, number>();
  for (const item of completed) {
    if (item.type === "income") { incomeCents += item.amountCents; continue; }
    expenseCents += item.amountCents;
    const category = item.category.trim() || "Otros";
    categories.set(category, (categories.get(category) ?? 0) + item.amountCents);
  }
  return {
    count: completed.length, incomeCents, expenseCents, balanceCents: incomeCents - expenseCents,
    categories: [...categories].map(([category, amountCents]) => ({
      category, amountCents, percentage: expenseCents ? amountCents / expenseCents * 100 : 0,
    })).sort((a, b) => b.amountCents - a.amountCents || a.category.localeCompare(b.category, "es")),
  };
}

export function availablePeriods(movements: Movement[]) {
  return [...new Set([DEMO_REFERENCE_DATE.slice(0, 7), ...movements.map((item) => item.date.slice(0, 7))])]
    .filter((month) => month <= DEMO_REFERENCE_DATE.slice(0, 7)).sort().reverse();
}

export function previousPeriod(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
}
