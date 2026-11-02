// Shared layout for every AFRO IN email (ticket confirmation today; sign-in
// codes, donations and store orders later): logo header, the email's own body,
// and a footer with the site, Instagram, "reply to this email" and why the
// person gets it. Pure, no "@/" imports, no ticket code, so tests and any
// sender can use it.
//
// Brand colors only. The dark background is set as bgcolor AND inline style,
// with color-scheme dark, so dark-mode clients do not tint it.
//
// Transactional mail only: no unsubscribe link. A marketing email (news of
// events, membership) needs recorded consent and an unsubscribe link
// (List-Unsubscribe header too) before it can use this layout.

import type { EmailAttachment } from "./email.ts";

export type EmailLang = "es" | "en" | "fr";

export const BRAND = {
  dark: "#161616",
  card: "#1f1f1f",
  cream: "#f3e9d2",
  gold: "#e6b84a",
  red: "#d0342c",
  white: "#ffffff",
  /** Separator lines: a subtle neutral, never gold (Julio). */
  line: "#2e2e2e",
} as const;

export const SITE_URL = "https://afroin.org";
export const INSTAGRAM_URL = "https://instagram.com/afro_in_";

const FOOTER = {
  es: { questions: "¿Preguntas? Responde a este correo." },
  en: { questions: "Questions? Just reply to this email." },
  fr: { questions: "Des questions ? Réponds simplement à cet e-mail." },
} satisfies Record<EmailLang, Record<string, string>>;

/**
 * The call-to-action button of every email: full width of the content column,
 * square corners, solid red, white bold text, like the site's buttons in the
 * 2027 design. "Bulletproof": the red is on the table cell (bgcolor + style)
 * and the link is a block filling it, so Outlook and Gmail keep the shape.
 */
export function emailButton(href: string, label: string): string {
  const { red, white } = BRAND;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
    <td align="center" bgcolor="${red}" style="background-color:${red};border-radius:0;">
      <a href="${esc(href)}" style="display:block;width:100%;padding:16px 0;background-color:${red};color:${white};text-decoration:none;font-weight:bold;font-size:16px;text-align:center;border-radius:0;font-family:Helvetica,Arial,sans-serif;">${esc(label)}</a>
    </td></tr></table>`;
}

/** The inline logo attachment: <img src="cid:logo"> in the header. */
export function logoAttachment(logoPng: string): EmailAttachment {
  return { filename: "afroin.png", content: logoPng, contentId: "logo" };
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailLayoutInput {
  lang: EmailLang;
  /** The subject, used as the HTML title. */
  title: string;
  /** Inbox preview line (hidden in the body). */
  preheader?: string;
  /** The email's own content, already escaped HTML. */
  bodyHtml: string;
  bodyText: string;
  /** Why the person gets this email, in their language. */
  reason: string;
  /** True when the caller attaches logoAttachment(); a text mark otherwise. */
  withLogo?: boolean;
}

export function renderEmailLayout(input: EmailLayoutInput): { html: string; text: string } {
  const { dark, cream, gold, red, line } = BRAND;
  const f = FOOTER[input.lang];
  // The logo file is 652×307.
  const header = input.withLogo
    ? `<img src="cid:logo" width="150" height="71" alt="AFRO IN" style="display:block;margin:0 auto;border:0;" />`
    : `<span style="font-size:22px;font-weight:bold;letter-spacing:3px;color:${red};">AFRO IN</span>`;
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(input.preheader)}</div>`
    : "";
  const link = (href: string, label: string) =>
    `<a href="${href}" style="color:${gold};text-decoration:none;">${label}</a>`;

  const html = `<!doctype html>
<html lang="${input.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><style>:root{color-scheme:dark;supported-color-schemes:dark;}</style><title>${esc(input.title)}</title></head>
<body bgcolor="${dark}" style="margin:0;padding:0;background-color:${dark};">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${dark}" style="background-color:${dark};">
    <tr><td align="center" bgcolor="${dark}" style="padding:24px 12px;background-color:${dark};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${dark}" style="background-color:${dark};max-width:560px;font-family:Helvetica,Arial,sans-serif;color:${cream};">
        <tr><td align="center" style="padding:0 8px 24px;">${header}</td></tr>
        <tr><td style="padding:0 8px;color:${cream};">${input.bodyHtml}</td></tr>
        <tr><td align="center" style="padding:32px 8px 0;font-size:13px;line-height:1.6;color:${cream};">
          <div style="border-top:1px solid ${line};padding-top:16px;">
            <p style="margin:0 0 8px;">${link(SITE_URL, "afroin.org")} &nbsp;·&nbsp; ${link(INSTAGRAM_URL, "Instagram")}</p>
            <p style="margin:0 0 8px;">${esc(f.questions)}</p>
            <p style="margin:0;font-size:12px;">${esc(input.reason)}</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    input.bodyText,
    "",
    "—",
    `afroin.org · Instagram: ${INSTAGRAM_URL}`,
    f.questions,
    input.reason,
  ].join("\n");

  return { html, text };
}
