// Builds the JSON strings the Bold checkout uses to prefill its payment form
// (developers.bold.co, "Botón de pagos": customerData / billingAddress).
import { parsePhone } from "./checkoutFields.ts";

export function buildCustomerData(input: {
  name: string;
  email: string;
  /** Stored format, e.g. "+57 3001234567". */
  phone?: string | null;
}): string {
  const data: Record<string, string> = {
    fullName: input.name.trim(),
    email: input.email.trim(),
  };
  const phone = parsePhone(input.phone);
  if (phone) {
    data.phone = phone.national;
    data.dialCode = phone.dialCode;
  }
  return JSON.stringify(data);
}

export function buildBillingAddress(input: {
  address: string;
  city: string;
  state?: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}): string | undefined {
  if (!/^[A-Z]{2}$/.test(input.country)) return undefined;
  const data: Record<string, string> = {
    address: input.address.trim(),
    city: input.city.trim(),
    country: input.country,
  };
  if (input.state?.trim()) data.state = input.state.trim();
  return JSON.stringify(data);
}
