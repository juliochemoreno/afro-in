// Public price format: "$20.000 COP". The currency is always spelled out so a
// visitor from abroad never reads the pesos as dollars. Pure, no "@/" imports
// so the tests can load it directly.
export function formatCopAmount(amount: number, locale: string): string {
  const digits = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
  return `$${digits} COP`;
}
