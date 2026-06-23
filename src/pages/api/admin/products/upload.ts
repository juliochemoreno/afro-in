import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized } from "@/lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const ALLOWED: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpeg",
  "image/png": "png",
};
const MAX_BYTES = 800 * 1024; // 800KB

// POST (multipart): store an image in R2 and return its key. The product row is
// updated separately (create/update) with the returned r2_key, so uploads work
// before a product exists. Orphaned uploads (never attached) are harmless.
export const POST: APIRoute = async (ctx) => {
  if (!(await requireAdmin(ctx))) return adminUnauthorized();
  const env = (ctx.locals as any).runtime.env;
  if (!env.MEDIA) return json({ error: "Almacenamiento no configurado" }, 500);

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return json({ error: "Formulario inválido" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Archivo requerido" }, 400);

  const ext = ALLOWED[file.type];
  if (!ext)
    return json({ error: "Formato no permitido (webp, jpeg o png)" }, 400);
  if (file.size > MAX_BYTES)
    return json({ error: "La imagen supera 800 KB. Comprímela primero." }, 400);

  const slugRaw = String(form.get("slug") || "misc");
  const slug = /^[a-z0-9-]+$/.test(slugRaw) ? slugRaw : "misc";
  const key = `products/${slug}/${crypto.randomUUID()}.${ext}`;

  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return json(
    { r2_key: key, content_type: file.type, url: `/media/${key}` },
    201
  );
};
