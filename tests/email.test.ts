import { test } from "node:test";
import assert from "node:assert/strict";
import { RESEND_API, resendBody, sendEmail, type EmailMessage } from "../src/lib/email.ts";

const msg: EmailMessage = {
  from: "AFRO IN <entradas@afroin.org>",
  to: "buyer@example.com",
  replyTo: "afroinsantamarta@gmail.com",
  subject: "Tus entradas",
  html: "<p>hola</p>",
  text: "hola",
  attachments: [{ filename: "qr-1.gif", content: "R0lG", contentId: "qr-1" }],
};

test("resendBody maps to Resend's snake_case fields", () => {
  assert.deepEqual(resendBody(msg), {
    from: msg.from,
    to: ["buyer@example.com"],
    subject: "Tus entradas",
    html: "<p>hola</p>",
    text: "hola",
    reply_to: "afroinsantamarta@gmail.com",
    attachments: [{ filename: "qr-1.gif", content: "R0lG", content_id: "qr-1" }],
  });
});

function withFetch(impl: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test("sendEmail: posts with auth and idempotency headers, returns the id", () =>
  withFetch(
    (async (url: string, init: RequestInit) => {
      assert.equal(url, RESEND_API);
      const h = init.headers as Record<string, string>;
      assert.equal(h.Authorization, "Bearer re_test");
      assert.equal(h["Idempotency-Key"], "ticket-email/AFROIN-TIX-1");
      return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
    }) as any,
    async () => {
      assert.deepEqual(await sendEmail("re_test", msg, { idempotencyKey: "ticket-email/AFROIN-TIX-1" }), {
        ok: true,
        id: "em_1",
      });
    }
  ));

test("sendEmail: API error → ok false with status and message", () =>
  withFetch(
    (async () =>
      new Response(JSON.stringify({ name: "validation_error", message: "domain not verified" }), {
        status: 403,
      })) as any,
    async () => {
      assert.deepEqual(await sendEmail("re_test", msg), {
        ok: false,
        status: 403,
        error: "domain not verified",
      });
    }
  ));

test("sendEmail: network failure never throws", () =>
  withFetch(
    (async () => {
      throw new Error("offline");
    }) as any,
    async () => {
      assert.deepEqual(await sendEmail("re_test", msg), { ok: false, status: 0, error: "offline" });
    }
  ));
