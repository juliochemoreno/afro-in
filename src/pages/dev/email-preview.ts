import type { APIRoute } from "astro";
import { buildTicketEmail, ticketsPath, type EmailLang } from "@/lib/ticketEmail";
import { LOGO_PNG } from "@/lib/emailLogo";

export const prerender = false;

// DEV ONLY: renders the ticket email in the browser with sample data, without
// sending anything. 404 in any build (production, previews): the page never
// exists outside `astro dev`. Query: lang=es|en|fr, tickets=1..4, multi=1.
export const GET: APIRoute = ({ url }) => {
  if (!import.meta.env.DEV) return new Response("Not found", { status: 404 });

  const q = url.searchParams;
  const lang = (["en", "fr"].includes(q.get("lang") ?? "") ? q.get("lang") : "es") as EmailLang;
  const n = Math.min(4, Math.max(1, Number(q.get("tickets")) || 2));
  const multi = q.get("multi") === "1";
  const names = {
    es: "Festival AFRO IN 2027 – Santa Marta",
    en: "AFRO IN Festival 2027 – Santa Marta",
    fr: "Festival AFRO IN 2027 – Santa Marta",
  };

  const mail = buildTicketEmail({
    lang,
    buyerName: "María José Palacios",
    event: {
      name: names[lang],
      venue: "Parque de los Novios",
      city: "Santa Marta",
      eventDate: multi ? "2027-01-15T16:00" : "2027-01-10T20:00",
      endDate: multi ? "2027-01-17" : null,
    },
    codes: ["K7P29XQ4MA", "B3N8TV2K1Q", "H4J6R8T2WX", "M9P3Q5S7VZ"].slice(0, n),
    ticketsUrl: `${url.origin}${ticketsPath(lang, "preview-token")}`,
    subjectPrefix: "[PRUEBA] ",
    logoPng: LOGO_PNG,
  });

  // The browser cannot read cid: references: swap them for data URIs.
  let html = mail.html;
  for (const a of mail.attachments) {
    const type = a.filename.endsWith(".png") ? "image/png" : "image/gif";
    html = html.replaceAll(`cid:${a.contentId}`, `data:${type};base64,${a.content}`);
  }
  const banner = `<div style="font:13px/1.4 system-ui;padding:8px 12px;background:#000;color:#fff;">Asunto: ${mail.subject
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</div>`;
  return new Response(html.replace(/<body([^>]*)>/, `<body$1>${banner}`), {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
};
