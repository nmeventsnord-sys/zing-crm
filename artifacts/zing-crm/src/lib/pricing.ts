export type ForfaitCode = "F100" | "F200" | "F400" | "F800";

export const FORFAITS = [
  { code: "F100" as ForfaitCode, label: "Location de borne photo + 100 tirages instantan\u00e9s", priceTTC: 199 },
  { code: "F200" as ForfaitCode, label: "Location de borne photo + 200 tirages instantan\u00e9s", priceTTC: 299 },
  { code: "F400" as ForfaitCode, label: "Location de borne photo + 400 tirages instantan\u00e9s", priceTTC: 399 },
  { code: "F800" as ForfaitCode, label: "Location de borne photo + 800 tirages instantan\u00e9s", priceTTC: 499 },
] as const;

export const LIVRAISON_OPTIONS = [
  { label: "0-10 km", priceTTC: 39 },
  { label: "10-15 km", priceTTC: 49 },
  { label: "15-30 km", priceTTC: 59 },
  { label: "30-40 km", priceTTC: 69 },
  { label: "40-50 km", priceTTC: 79 },
  { label: "50-60 km", priceTTC: 89 },
  { label: "60-80 km", priceTTC: 99 },
] as const;

export const SMILE40_PRICE_HT = -33.33;
export const SMILE40_ELIGIBLE: ForfaitCode[] = ["F200", "F400", "F800"];

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const ttcToHt = (ttc: number) => round2(ttc / 1.2);
