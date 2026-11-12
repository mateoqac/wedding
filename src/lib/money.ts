/** "$9.990" — Chilean peso format without decimals. */
export function formatClp(amount: number): string {
  return `$${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}
