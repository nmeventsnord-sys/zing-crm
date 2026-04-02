import { format, parseISO } from "date-fns";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch (error) {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    return format(parseISO(dateString), "MMM d, yyyy h:mm a");
  } catch (error) {
    return dateString;
  }
}
