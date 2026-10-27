import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized, hashPassword } from "@/lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// GET: list all administrators
export const GET: APIRoute = async (ctx) => {
  const currentAdmin = await requireAdmin(ctx);
  if (!currentAdmin) return adminUnauthorized();

  const db = (ctx.locals as any).runtime?.env?.DB;
  if (!db) {
    return json({ admins: [] });
  }

  try {
    const res = await db
      .prepare(
        "SELECT id, email, name, role, is_active, created_at, updated_at FROM admins ORDER BY id ASC"
      )
      .all();
    return json({ admins: res.results || [] });
  } catch (err: any) {
    console.error("Error fetching admins:", err);
    return json({ error: "Error al consultar administradores" }, 500);
  }
};

// POST: create a new administrator
export const POST: APIRoute = async (ctx) => {
  const currentAdmin = await requireAdmin(ctx);
  if (!currentAdmin) return adminUnauthorized();

  // Only superadmins or the main admin can create new admins
  if (currentAdmin.role !== "superadmin") {
    return json({ error: "Solo los superadministradores pueden crear nuevos administradores." }, 403);
  }

  const db = (ctx.locals as any).runtime?.env?.DB;
  if (!db) {
    return json({ error: "Base de datos D1 no disponible" }, 500);
  }

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const role = body.role === "superadmin" ? "superadmin" : "admin";
  const isActive = body.is_active === 0 ? 0 : 1;

  if (!email || !email.includes("@")) {
    return json({ error: "Correo electrónico inválido" }, 400);
  }
  if (!name) {
    return json({ error: "El nombre es obligatorio" }, 400);
  }
  if (!password || password.length < 6) {
    return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
  }

  try {
    const { hash, salt } = await hashPassword(password);
    const res = await db
      .prepare(
        `INSERT INTO admins (email, name, password_hash, salt, role, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(email, name, hash, salt, role, isActive)
      .run();

    return json({ ok: true, id: Number(res.meta.last_row_id) }, 201);
  } catch (err: any) {
    if (String(err?.message || err).includes("UNIQUE")) {
      return json({ error: "Ya existe un administrador con este correo electrónico" }, 409);
    }
    console.error("Error creating admin:", err);
    return json({ error: "No se pudo crear el administrador" }, 500);
  }
};
