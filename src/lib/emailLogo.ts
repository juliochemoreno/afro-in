// The AFRO IN logo for emails, as base64 PNG (pass it to logoAttachment()).
// Bundled as a data URL: Gmail shows no SVG, and an inline image works before
// and after a deploy, unlike a URL on the site. Kept apart from emailLayout.ts
// because the "?inline" import only resolves in the Vite build, not in tests.
import logoDataUrl from "@/assets/img/logos/afroin.png?inline";

const base64 = logoDataUrl.replace(/^data:image\/png;base64,/, "");

/** Undefined if the bundler did not inline a PNG (the layout falls back to text). */
export const LOGO_PNG: string | undefined = base64.startsWith("iVBOR") ? base64 : undefined;
