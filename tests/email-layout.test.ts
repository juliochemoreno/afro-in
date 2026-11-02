import { test } from "node:test";
import assert from "node:assert/strict";
import { BRAND, INSTAGRAM_URL, renderEmailLayout } from "../src/lib/emailLayout.ts";

const base = {
  lang: "es" as const,
  title: "Tus entradas · Festival",
  bodyHtml: "<p>CUERPO</p>",
  bodyText: "CUERPO",
  reason: "Recibes este correo porque compraste entradas en afroin.org.",
};

test("body, footer links, questions and reason in html and text", () => {
  const { html, text } = renderEmailLayout(base);
  assert.ok(html.includes("<p>CUERPO</p>"));
  assert.ok(html.includes('href="https://afroin.org"'));
  assert.ok(html.includes(`href="${INSTAGRAM_URL}"`));
  assert.ok(html.includes("¿Preguntas? Responde a este correo."));
  assert.ok(html.includes(base.reason));
  assert.ok(text.startsWith("CUERPO"));
  assert.ok(text.includes(INSTAGRAM_URL) && text.includes(base.reason));
});

test("footer in each language", () => {
  assert.ok(renderEmailLayout({ ...base, lang: "en" }).html.includes("Questions? Just reply to this email."));
  assert.ok(renderEmailLayout({ ...base, lang: "fr" }).html.includes("Réponds simplement"));
});

test("logo by cid when attached, text mark otherwise; dark scheme", () => {
  assert.ok(renderEmailLayout({ ...base, withLogo: true }).html.includes('src="cid:logo"'));
  const { html } = renderEmailLayout(base);
  assert.ok(!html.includes("cid:logo"));
  assert.ok(html.includes('<meta name="color-scheme" content="dark">'));
  assert.ok(html.includes(`<body bgcolor="${BRAND.dark}"`));
});

test("brand colors only; preheader and title escaped; no unsubscribe", () => {
  const { html } = renderEmailLayout({ ...base, title: "<b>x</b>", preheader: "a & b" });
  const colors = new Set(html.match(/#[0-9a-f]{6}\b/gi)!.map((c) => c.toLowerCase()));
  for (const c of colors) assert.ok((Object.values(BRAND) as string[]).includes(c), c);
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;") && html.includes("a &amp; b"));
  assert.ok(!/unsubscribe|darse de baja/i.test(html));
  assert.ok(!html.includes(`solid ${BRAND.gold}`));
});
