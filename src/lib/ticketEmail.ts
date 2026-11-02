// The ticket confirmation email (D19): subject, HTML, plain text and one
// inline QR image per ticket, in the order's language. Pure, no "@/" imports,
// so the tests can load it directly. Copy approved by Julio (es); en/fr follow
// the receipt page's wording. Event name, date and venue appear once.

import qrcode from "qrcode-generator";
import { eventTime, shortDateRange } from "./eventDisplay.ts";
import { routes } from "../i18n/routes.ts";
import type { EmailAttachment } from "./email.ts";

export type EmailLang = "es" | "en" | "fr";

const COPY = {
  es: {
    subject: "Tus entradas · {event}",
    hello: "Hola, {name}:",
    leadOne: "¡Ya eres parte! Aquí está tu entrada.",
    leadMany: "¡Ya eres parte! Aquí están tus {n} entradas.",
    zone: "(hora de Colombia)",
    button: "Ver mis entradas",
    ticket: "Entrada {i}",
    code: "Código",
    hint: "Muestra el QR en la entrada, desde el celular o impreso. Cada QR vale para una persona.",
    questions: "¿Preguntas? Responde a este correo.",
    bye: "Nos vemos en el festival.",
  },
  en: {
    subject: "Your tickets · {event}",
    hello: "Hi {name},",
    leadOne: "You're part of it! Here is your ticket.",
    leadMany: "You're part of it! Here are your {n} tickets.",
    zone: "(Colombia time)",
    button: "View my tickets",
    ticket: "Ticket {i}",
    code: "Code",
    hint: "Show the QR at the entrance, on your phone or printed. Each QR admits one person.",
    questions: "Questions? Just reply to this email.",
    bye: "See you at the festival.",
  },
  fr: {
    subject: "Vos billets · {event}",
    hello: "Bonjour {name},",
    leadOne: "Tu en fais partie ! Voici votre billet.",
    leadMany: "Tu en fais partie ! Voici vos {n} billets.",
    zone: "(heure de Colombie)",
    button: "Voir mes billets",
    ticket: "Billet {i}",
    code: "Code",
    hint: "Présentez le QR à l'entrée, sur votre téléphone ou imprimé. Chaque QR est valable pour une personne.",
    questions: "Des questions ? Répondez simplement à cet e-mail.",
    bye: "À bientôt au festival.",
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

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
  const lead = n === 1 ? c.leadOne : fill(c.leadMany, { n });
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

  const gold = "#b8862b";
  const ink = "#1f1a14";
  const muted = "#6b6156";
  const url = esc(input.ticketsUrl);

  const ticketCells = input.codes
    .map(
      (code, i) => `
          <td align="center" valign="top" style="padding:12px 8px;width:50%;">
            <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${muted};">${esc(fill(c.ticket, { i: i + 1 }))}</div>
            <img src="cid:qr-${i + 1}" width="180" height="180" alt="${esc(code)}" style="display:block;margin:8px auto;border:0;background:#ffffff;" />
            <div style="font-family:Menlo,Consolas,monospace;font-size:16px;font-weight:bold;letter-spacing:2px;color:${ink};">${esc(code)}</div>
          </td>`
    )
    .reduce<string[]>((rows, cell, i) => {
      if (i % 2 === 0) rows.push(cell);
      else rows[rows.length - 1] += cell;
      return rows;
    }, [])
    .map((cells) => `<tr>${cells}</tr>`)
    .join("");

  const html = `<!doctype html>
<html lang="${input.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6efe3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6efe3;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Helvetica,Arial,sans-serif;color:${ink};">
        <tr><td style="padding:0 8px 16px;font-size:14px;font-weight:bold;letter-spacing:3px;color:${gold};">AFRO IN</td></tr>
        <tr><td style="padding:0 8px;font-size:16px;line-height:1.5;">
          <p style="margin:0 0 12px;">${esc(fill(c.hello, { name: firstName }))}</p>
          <p style="margin:0 0 20px;">${esc(lead)}</p>
        </td></tr>
        <tr><td style="padding:16px 8px;border-top:1px solid ${gold};border-bottom:1px solid ${gold};">
          <div style="font-size:20px;font-weight:bold;line-height:1.3;">${esc(input.event.name)}</div>
          ${when ? `<div style="margin-top:6px;font-size:15px;color:${muted};">${esc(when)}</div>` : ""}
          ${where ? `<div style="margin-top:2px;font-size:15px;color:${muted};">${esc(where)}</div>` : ""}
        </td></tr>
        <tr><td align="center" style="padding:24px 8px;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;background:${ink};color:#f6efe3;text-decoration:none;font-weight:bold;font-size:15px;border-radius:999px;">${esc(c.button)}</a>
        </td></tr>
        <tr><td style="padding:0 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;">${ticketCells}</table>
        </td></tr>
        <tr><td style="padding:20px 8px 0;font-size:14px;line-height:1.5;color:${muted};">
          <p style="margin:0 0 12px;">${esc(c.hint)}</p>
          <p style="margin:0 0 12px;">${esc(c.questions)}</p>
          <p style="margin:0;color:${ink};">${esc(c.bye)}<br><strong>AFRO IN</strong></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    fill(c.hello, { name: firstName }),
    "",
    lead,
    "",
    input.event.name,
    ...(when ? [when] : []),
    ...(where ? [where] : []),
    "",
    `${c.button}: ${input.ticketsUrl}`,
    "",
    ...input.codes.map((code, i) => `${fill(c.ticket, { i: i + 1 })} · ${c.code}: ${code}`),
    "",
    c.hint,
    c.questions,
    "",
    c.bye,
    "AFRO IN",
  ].join("\n");

  return { subject, html, text, attachments };
}
