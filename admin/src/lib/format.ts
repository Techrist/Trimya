/**
 * Number / currency / date formatters tailored for the FR locale.
 */

const numFr = new Intl.NumberFormat("fr-FR");
const currencyFcfa = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

export function formatNumber(n: number): string {
  return numFr.format(n);
}

export function formatPrice(n: number): string {
  return `${currencyFcfa.format(n)} FCFA`;
}

export function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
