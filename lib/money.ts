export function formatLkr(minorUnits: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minorUnits / 100);
}
