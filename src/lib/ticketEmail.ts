// The ticket confirmation email (D19): subject, HTML, plain text and one
// inline QR image per ticket, in the order's language. Pure, no "@/" imports,
// so the tests can load it directly. Copy approved by Julio (es); en/fr follow
// the receipt page's wording (French uses "tu", like the site). Event name,
// date and venue appear once. Header, footer and colors come from the shared
// layout (emailLayout.ts); this module only writes the tickets body.

import qrcode from "qrcode-generator";
import { eventTime, shortDateRange } from "./eventDisplay.ts";
import { routes } from "../i18n/routes.ts";
import type { EmailAttachment } from "./email.ts";
import {
  BRAND,
  emailButton,
  esc,
  logoAttachment,
  renderEmailLayout,
  type EmailLang,
} from "./emailLayout.ts";

export type { EmailLang };

const COPY = {
  es: {
    subject: "Tus entradas · {event}",
    hello: "Hola, {name}:",
    leadOne: "Tu compra está confirmada. Aquí está tu entrada para {event}.",
    leadMany: "Tu compra está confirmada. Aquí están tus {n} entradas para {event}.",
    zone: "(hora de Colombia)",
    button: "Ver mis entradas",
    ticket: "Entrada {i}",
    code: "Código",
    hint: "Muestra el QR en la entrada, desde el celular o impreso. Cada QR vale para una persona.",
    reason: "Recibes este correo porque compraste entradas en afroin.org.",
    bye: "Nos vemos allá.",
  },
  en: {
    subject: "Your tickets · {event}",
    hello: "Hi {name},",
    leadOne: "Your purchase is confirmed. Here is your ticket for {event}.",
    leadMany: "Your purchase is confirmed. Here are your {n} tickets for {event}.",
    zone: "(Colombia time)",
    button: "View my tickets",
    ticket: "Ticket {i}",
    code: "Code",
    hint: "Show the QR at the entrance, on your phone or printed. Each QR admits one person.",
    reason: "You are receiving this email because you bought tickets on afroin.org.",
    bye: "See you there.",
  },
  fr: {
    subject: "Tes billets · {event}",
    hello: "Bonjour {name},",
    leadOne: "Ton achat est confirmé. Voici ton billet pour {event}.",
    leadMany: "Ton achat est confirmé. Voici tes {n} billets pour {event}.",
    zone: "(heure de Colombie)",
    button: "Voir mes billets",
    ticket: "Billet {i}",
    code: "Code",
    hint: "Présente le QR à l'entrée, sur ton téléphone ou imprimé. Chaque QR est valable pour une personne.",
    reason: "Tu reçois cet e-mail parce que tu as acheté des billets sur afroin.org.",
    bye: "À bientôt là-bas.",
  },
} satisfies Record<EmailLang, Record<string, string>>;

export interface TicketEmailInput {
  lang: EmailLang;
  buyerName: string;
  event: {
    name: string;
    venue?: string | null;
    city?: string | null;
    eventDate: string;
    endDate?: string | null;
  };
  codes: string[];
  ticketsUrl: string;
  /** "[PRUEBA] " outside production, "" in production. */
  subjectPrefix?: string;
  /** The AFRO IN logo (PNG, base64), sent as an inline image; text without it. */
  logoPng?: string;
}

export interface TicketEmail {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

/** Path of the permanent tickets page in a language: /entradas/<t>, /en/tickets/<t>, /fr/billets/<t>. */
export function ticketsPath(lang: EmailLang, token: string): string {
  return `${lang === "es" ? "" : `/${lang}`}${routes[lang].tickets}/${encodeURIComponent(token)}`;
}

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** The QR the door scanner reads: the plain ticket code, like TicketQR.tsx. GIF, base64. */
export function qrGifBase64(code: string): string {
  const qr = qrcode(0, "M");
  qr.addData(code);
  qr.make();
  return qr.createDataURL(6, 4).replace(/^data:image\/gif;base64,/, "");
}

/** "15–17 ene 2027 · 8:00 p. m. (hora de Colombia)": date range, start time when set. */
export function dateLine(lang: EmailLang, eventDate: string, endDate?: string | null): string | null {
  const day = shortDateRange(eventDate, lang, endDate);
  if (!day) return null;
  const time = eventTime(eventDate, lang);
  return time ? `${day} · ${time} ${COPY[lang].zone}` : day;
}

export function buildTicketEmail(input: TicketEmailInput): TicketEmail {
  const c = COPY[input.lang];
  const firstName = input.buyerName.trim().split(/\s+/)[0] || input.buyerName.trim();
  const n = input.codes.length;
  // The lead names the event, so the block below shows only date and venue.
  const lead = fill(n === 1 ? c.leadOne : c.leadMany, { n, event: input.event.name });
  const when = dateLine(input.lang, input.event.eventDate, input.event.endDate);
  const where = [input.event.venue, input.event.city]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");

  const subject = `${input.subjectPrefix ?? ""}${fill(c.subject, { event: input.event.name })}`;

  const attachments: EmailAttachment[] = input.codes.map((code, i) => ({
    filename: `qr-${i + 1}.gif`,
    content: qrGifBase64(code),
    contentId: `qr-${i + 1}`,
  }));
  if (input.logoPng) attachments.unshift(logoAttachment(input.logoPng));

  const { card, cream, gold, white, line } = BRAND;

  const ticketCells = input.codes
    .map(
      (code, i) => `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${card}" style="background-color:${card};margin:0 0 16px;"><tr>
          <td align="center" valign="top" bgcolor="${card}" style="padding:20px 8px;background-color:${card};">
            <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${gold};">${esc(fill(c.ticket, { i: i + 1 }))}</div>
            <img src="cid:qr-${i + 1}" width="180" height="180" alt="${esc(code)}" style="display:block;margin:8px auto;border:0;background:${white};" />
            <div style="font-family:Menlo,Consolas,monospace;font-size:16px;font-weight:bold;letter-spacing:2px;color:${cream};">${esc(code)}</div>
          </td></tr></table>`
    )
    .join("");

  const bodyHtml = `
          <div style="font-size:16px;line-height:1.5;">
            <p style="margin:0 0 12px;">${esc(fill(c.hello, { name: firstName }))}</p>
            <p style="margin:0 0 20px;">${esc(lead)}</p>
          </div>
          ${
            when || where
              ? `<div style="padding:16px 0;border-top:1px solid ${line};border-bottom:1px solid ${line};font-size:15px;">
            ${when ? `<div>${esc(when)}</div>` : ""}
            ${where ? `<div style="margin-top:2px;">${esc(where)}</div>` : ""}
          </div>`
              : ""
          }
          <div style="padding:24px 0;">
            ${emailButton(input.ticketsUrl, c.button)}
          </div>
          ${ticketCells}
          <div style="padding-top:20px;font-size:14px;line-height:1.5;">
            <p style="margin:0 0 12px;">${esc(c.hint)}</p>
            <p style="margin:0;">${esc(c.bye)}</p>
          </div>`;

  const bodyText = [
    fill(c.hello, { name: firstName }),
    "",
    lead,
    "",
    ...(when ? [when] : []),
    ...(where ? [where] : []),
    "",
    `${c.button}: ${input.ticketsUrl}`,
    "",
    ...input.codes.map((code, i) => `${fill(c.ticket, { i: i + 1 })} · ${c.code}: ${code}`),
    "",
    c.hint,
    "",
    c.bye,
    "AFRO IN",
  ].join("\n");

  const { html, text } = renderEmailLayout({
    lang: input.lang,
    title: subject,
    preheader: lead,
    bodyHtml,
    bodyText,
    reason: c.reason,
    withLogo: Boolean(input.logoPng),
  });

  return { subject, html, text, attachments };
}
