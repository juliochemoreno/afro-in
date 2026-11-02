import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTicketEmail, dateLine, qrGifBase64, ticketsPath } from "../src/lib/ticketEmail.ts";

const base = {
  lang: "es" as const,
  buyerName: "María José Palacios",
  event: {
    name: "Festival AFRO IN 2027 – Santa Marta",
    venue: "Parque de los Novios",
    city: "Santa Marta",
    eventDate: "2027-01-15T20:00",
    endDate: "2027-01-17",
  },
  codes: ["K7P29XQ4MA", "B3N8TV2K1Q"],
  ticketsUrl: "https://afroin.org/entradas/abc-123",
};

const count = (s: string, part: string) => s.split(part).length - 1;

test("ticketsPath: localized permanent link", () => {
  assert.equal(ticketsPath("es", "abc"), "/entradas/abc");
  assert.equal(ticketsPath("en", "abc"), "/en/tickets/abc");
  assert.equal(ticketsPath("fr", "abc"), "/fr/billets/abc");
});

test("subject per language, with the non-production prefix", () => {
  assert.equal(buildTicketEmail(base).subject, "Tus entradas · Festival AFRO IN 2027 – Santa Marta");
  assert.equal(buildTicketEmail({ ...base, lang: "en" }).subject, "Your tickets · Festival AFRO IN 2027 – Santa Marta");
  assert.equal(buildTicketEmail({ ...base, lang: "fr" }).subject, "Tes billets · Festival AFRO IN 2027 – Santa Marta");
  assert.equal(
    buildTicketEmail({ ...base, subjectPrefix: "[PRUEBA] " }).subject,
    "[PRUEBA] Tus entradas · Festival AFRO IN 2027 – Santa Marta"
  );
});

test("one inline QR per ticket, referenced by cid", () => {
  const mail = buildTicketEmail(base);
  assert.equal(mail.attachments.length, 2);
  mail.attachments.forEach((a, i) => {
    assert.equal(a.contentId, `qr-${i + 1}`);
    assert.ok(mail.html.includes(`src="cid:qr-${i + 1}"`));
    assert.equal(Buffer.from(a.content, "base64").subarray(0, 4).toString(), "GIF8");
  });
  for (const code of base.codes) {
    assert.ok(mail.html.includes(code));
    assert.ok(mail.text.includes(code));
  }
});

test("logo as an inline image when given; brand colors only", () => {
  const mail = buildTicketEmail({ ...base, logoPng: "iVBORw0KGgo=" });
  assert.equal(mail.attachments[0].contentId, "logo");
  assert.equal(mail.attachments.length, 3);
  assert.ok(mail.html.includes('src="cid:logo"'));
  const colors = new Set(mail.html.match(/#[0-9a-f]{6}\b/gi)!.map((c) => c.toLowerCase()));
  assert.deepEqual([...colors].sort(), ["#161616", "#1f1f1f", "#2e2e2e", "#d0342c", "#e6b84a", "#f3e9d2", "#ffffff"]);
});

test("French uses tu", () => {
  const mail = buildTicketEmail({ ...base, lang: "fr" });
  assert.ok(!/\b(votre|vos|Répondez|Présentez)\b/.test(mail.text));
});

test("the QR encodes something for any code and is a GIF", () => {
  assert.equal(Buffer.from(qrGifBase64("0123456789"), "base64").subarray(0, 3).toString(), "GIF");
});

test("link in html and text; event name, date and venue once", () => {
  const mail = buildTicketEmail(base);
  assert.ok(mail.html.includes(`href="${base.ticketsUrl}"`));
  assert.ok(mail.text.includes(base.ticketsUrl));
  assert.equal(count(mail.html, "Parque de los Novios, Santa Marta"), 1);
  assert.equal(count(mail.html, "15–17 ene 2027"), 1);
  // Name: once in the lead, plus <title> (the subject) and the hidden
  // inbox preheader (the lead); the date/venue block does not repeat it.
  assert.equal(count(mail.html, base.event.name), 3);
  assert.equal(count(mail.text, base.event.name), 1);
});

test("greets by first name; singular and plural lead", () => {
  const many = buildTicketEmail(base);
  assert.ok(many.text.startsWith("Hola, María:"));
  assert.ok(many.text.includes(`Tu compra está confirmada. Aquí están tus 2 entradas para ${base.event.name}.`));
  const one = buildTicketEmail({ ...base, codes: ["K7P29XQ4MA"] });
  assert.ok(one.text.includes(`Aquí está tu entrada para ${base.event.name}.`));
  assert.ok(buildTicketEmail({ ...base, lang: "en", codes: ["X"] }).text.includes("Here is your ticket for"));
  assert.ok(buildTicketEmail({ ...base, lang: "fr" }).text.includes("Ton achat est confirmé. Voici tes 2 billets pour"));
});

test("square red button; one ticket per row", () => {
  const mail = buildTicketEmail(base);
  assert.match(mail.html, /<td align="center" bgcolor="#d0342c"[^>]*>\s*<a href="https:\/\/afroin\.org\/entradas\/abc-123" style="display:block;width:100%;[^"]*background-color:#d0342c;[^"]*border-radius:0;/);
  assert.ok(!/border-radius:(?!0)/.test(mail.html));
  assert.ok(!mail.html.includes("width:50%"));
  assert.equal(count(mail.html, 'role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1f1f1f"'), 2);
});

test("date line: range + time + zone; no time or venue → left out", () => {
  assert.equal(dateLine("es", "2027-01-15T20:00", "2027-01-17")!, "15–17 ene 2027 · 8:00 p. m. (hora de Colombia)");
  assert.equal(dateLine("en", "2027-01-15", null), "Jan 15, 2027");
  const mail = buildTicketEmail({
    ...base,
    event: { name: "Taller", venue: null, city: " ", eventDate: "2027-02-03", endDate: null },
  });
  assert.ok(!mail.html.includes("hora de Colombia"));
  assert.ok(!mail.text.includes(", ,"));
  assert.match(mail.text, /\n3 (de )?feb\.? (de )?2027\n/);
});

test("escapes buyer and event text in the HTML", () => {
  const mail = buildTicketEmail({
    ...base,
    buyerName: "<script>alert(1)</script>",
    event: { ...base.event, name: 'Fiesta "A&B"' },
  });
  assert.ok(!mail.html.includes("<script>alert"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
  assert.ok(mail.html.includes("Fiesta &quot;A&amp;B&quot;"));
});
