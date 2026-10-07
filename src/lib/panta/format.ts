export function formatProbability(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? `${Math.round(value * 100)}%`
    : "—";
}

export function formatUsdc(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1_000 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
});

export function formatDateTime(timestamp: number | string | null): string {
  if (timestamp === null) return "Not available";
  const date = typeof timestamp === "number" ? new Date(timestamp * 1_000) : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Not available" : `${dateTimeFormatter.format(date)} UTC`;
}
