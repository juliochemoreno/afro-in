// The purchase reference shown to buyers: the first 8 characters of the random
// UUID in the Bold order id (AFROIN-TIX-<uuid>), upper-case. Never the D1 row
// id, which is sequential and would reveal how many orders exist. Pure, so
// client components and tests can use it.
export function orderRef(boldOrderId: string): string {
  const uuid = boldOrderId.replace(/^AFROIN-(?:TIX-|ORD-)?/i, "");
  return uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
}
