export function formatExposure(exposure: number): string {
  if (exposure <= 0) {
    throw new Error("Exposure must be a positive number.");
  }

  const denominator = Math.round(1 / exposure);
  return `1/${denominator}`;
}