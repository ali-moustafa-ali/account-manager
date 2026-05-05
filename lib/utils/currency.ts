const formatter = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatEGP(amount: number): string {
  return formatter.format(amount);
}
