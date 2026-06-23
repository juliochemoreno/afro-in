import type { APIRoute } from "astro";

export const prerender = false;

// Public image endpoint: streams an object from the R2 MEDIA bucket at
// /media/<key>. The immutable Cache-Control lets the browser (and Cloudflare's
// CDN) cache the bytes after the first request; keys are immutable so this is
// safe. Kept dependency-free (no Cache API) so it works the same in dev and prod.
export const GET: APIRoute = async ({ params, locals }) => {
  const env = (locals as any).runtime?.env;
  const key = params.key;

  if (!env?.MEDIA || !key) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.MEDIA.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (object.httpEtag) headers.set("ETag", object.httpEtag);

  const data = await object.arrayBuffer();
  return new Response(data, { headers });
};
