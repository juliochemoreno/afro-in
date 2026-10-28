// Field rules shared by the checkout forms (client) and the checkout APIs
// (server). Pure functions with no path aliases, so `npm test` can import them.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DIAL_RE = /^\+\d{1,4}$/;

export const FIELD_MAX = {
  name: 100,
  email: 120,
  phone: 20,
  address: 200,
  city: 80,
  department: 80,
  country: 80,
  notes: 500,
} as const;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function normalizeDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

/** Colombian numbers (mobile 3xx, landline 60x) have 10 digits; elsewhere 4–14. */
export function isValidPhone(dialCode: string, national: string): boolean {
  if (!DIAL_RE.test(dialCode) || !/^\d+$/.test(national)) return false;
  if (dialCode === "+57") return national.length === 10;
  return national.length >= 4 && national.length <= 14;
}

/** Stored format: "+57 3001234567". */
export function formatPhone(dialCode: string, national: string): string {
  return `${dialCode} ${national}`;
}

/** Parses the stored format back into its parts; null when it is not one. */
export function parsePhone(
  stored: string | null | undefined
): { dialCode: string; national: string } | null {
  const m = /^(\+\d{1,4}) (\d+)$/.exec((stored || "").trim());
  return m ? { dialCode: m[1], national: m[2] } : null;
}

/** Returns the normalized stored phone, or null when it is missing or invalid. */
export function normalizeStoredPhone(
  stored: string | null | undefined
): string | null {
  const p = parsePhone(stored);
  if (!p || !isValidPhone(p.dialCode, p.national)) return null;
  return formatPhone(p.dialCode, p.national);
}
