import type { APIRoute } from "astro";
import { requireAdmin, adminUnauthorized, hashPassword } from "@/lib/adminAuth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// PUT / PATCH: update administrator
export const PUT: APIRoute = async (ctx) => {
  const currentAdmin = await requireAdmin(ctx);
  if (!currentAdmin) return adminUnauthorized();

  const targetId = Number(ctx.params.id);
  if (!targetId || isNaN(targetId)) {
    return json({ error: "ID inválido" }, 400);
  }

  // Only superadmin can modify other admins, but any admin can update their own name/password
  const isSelf = currentAdmin.id === targetId;
  if (currentAdmin.role !== "superadmin" && !isSelf) {
    return json({ error: "No tienes permisos para editar este administrador" }, 403);
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

  const existing = await db
    .prepare("SELECT * FROM admins WHERE id = ?")
    .bind(targetId)
    .first();

  if (!existing) {
    return json({ error: "Administrador no encontrado" }, 404);
  }

  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  const email =
    body.email !== undefined ? String(body.email).trim().toLowerCase() : existing.email;
  // Non-superadmins cannot promote themselves or alter roles/status
  const role =
    currentAdmin.role === "superadmin" && body.role !== undefined
      ? body.role === "superadmin"
        ? "superadmin"
        : "admin"
      : existing.role;
  const isActive =
    currentAdmin.role === "superadmin" && body.is_active !== undefined
      ? body.is_active
        ? 1
        : 0
      : existing.is_active;

  if (!name) return json({ error: "El nombre no puede estar vacío" }, 400);
  if (!email || !email.includes("@"))
    return json({ error: "Correo electrónico inválido" }, 400);

  // Password update (optional)
  let passwordHash = existing.password_hash;
  let salt = existing.salt;
  if (body.password && String(body.password).trim().length > 0) {
    const newPass = String(body.password).trim();
    if (newPass.length < 6) {
      return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
    }
    const derived = await hashPassword(newPass);
    passwordHash = derived.hash;
    salt = derived.salt;
  }

  try {
    await db
      .prepare(
        `UPDATE admins
         SET name = ?, email = ?, role = ?, is_active = ?, password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(name, email, role, isActive, passwordHash, salt, targetId)
      .run();

    return json({ ok: true });
  } catch (err: any) {
    if (String(err?.message || err).includes("UNIQUE")) {
      return json({ error: "El correo electrónico ya está en uso por otro administrador" }, 409);
    }
    console.error("Error updating admin:", err);
    return json({ error: "No se pudo actualizar el administrador" }, 500);
  }
};

// DELETE: remove an administrator
export const DELETE: APIRoute = async (ctx) => {
  const currentAdmin = await requireAdmin(ctx);
  if (!currentAdmin) return adminUnauthorized();

  if (currentAdmin.role !== "superadmin") {
    return json({ error: "Solo los superadministradores pueden eliminar administradores" }, 403);
  }

  const targetId = Number(ctx.params.id);
  if (!targetId || isNaN(targetId)) {
    return json({ error: "ID inválido" }, 400);
  }

  // Prevent superadmin from deleting themselves
  if (currentAdmin.id === targetId) {
    return json({ error: "No puedes eliminar tu propia cuenta de administrador" }, 400);
  }

  const db = (ctx.locals as any).runtime?.env?.DB;
  if (!db) {
    return json({ error: "Base de datos D1 no disponible" }, 500);
  }

  try {
    const res = await db.prepare("DELETE FROM admins WHERE id = ?").bind(targetId).run();
    if (res.meta.changes === 0) {
      return json({ error: "Administrador no encontrado" }, 404);
    }
    return json({ ok: true });
  } catch (err: any) {
    console.error("Error deleting admin:", err);
    return json({ error: "No se pudo eliminar el administrador" }, 500);
  }
};
