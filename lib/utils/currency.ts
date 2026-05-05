// Arabic locale + Latin digits — keeps the currency mark "ج.م.‏" but numbers stay Western (1,234,567)
const formatter = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  numberingSystem: "latn",
});

export function formatEGP(amount: number): string {
  return formatter.format(amount);
}
