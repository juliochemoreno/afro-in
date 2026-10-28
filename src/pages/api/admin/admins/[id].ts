import type { APIRoute } from "astro";
import {
  requireAdmin,
  adminUnauthorized,
  hashPassword,
  createAdminSessionToken,
  setAdminSessionCookie,
  MIN_ADMIN_PASSWORD_LENGTH,
} from "@/lib/adminAuth";

export const prerender = false;

const MAX_PAYLOAD_BYTES = 4096;

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

  // Only superadmin can modify other admins, but any admin can update their own name/password.
  // The environment account (id 0) is never "self" of a D1 row.
  const isSelf = currentAdmin.id === targetId;
  if (currentAdmin.role !== "superadmin" && !isSelf) {
    return json({ error: "No tienes permisos para editar este administrador" }, 403);
  }

  const db = (ctx.locals as any).runtime?.env?.DB;
  if (!db) {
    return json({ error: "Base de datos D1 no disponible" }, 500);
  }

  const raw = await ctx.request.text();
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return json({ error: "Datos demasiado grandes" }, 413);
  }
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ error: "JSON inválido" }, 400);
  }

  const existing = await db
    .prepare("SELECT * FROM admins WHERE id = ?")
    .bind(targetId)
    .first();

  if (!existing) {
    return json({ error: "Administrador no encontrado" }, 404);
  }

  if (body.role !== undefined && body.role !== "admin" && body.role !== "superadmin") {
    return json({ error: "Rol inválido" }, 400);
  }
  if (body.is_active !== undefined && ![0, 1, true, false].includes(body.is_active)) {
    return json({ error: "Estado inválido" }, 400);
  }

  const name =
    body.name !== undefined ? String(body.name).trim().slice(0, 100) : existing.name;
  const email =
    body.email !== undefined
      ? String(body.email).trim().toLowerCase().slice(0, 120)
      : existing.email;
  // Non-superadmins cannot promote themselves or alter roles/status
  const role =
    currentAdmin.role === "superadmin" && body.role !== undefined ? body.role : existing.role;
  const isActive =
    currentAdmin.role === "superadmin" && body.is_active !== undefined
      ? body.is_active
        ? 1
        : 0
      : existing.is_active;

  // A superadmin cannot lock themselves out by demoting or deactivating their own account.
  if (isSelf && (role !== existing.role || isActive !== existing.is_active)) {
    return json(
      { error: "No puedes cambiar tu propio rol ni desactivar tu propia cuenta" },
      400
    );
  }

  if (!name) return json({ error: "El nombre no puede estar vacío" }, 400);
  if (!email || !email.includes("@"))
    return json({ error: "Correo electrónico inválido" }, 400);

  // Password update (optional). Not trimmed: login compares it as typed.
  let passwordHash = existing.password_hash;
  let salt = existing.salt;
  const passwordChanged = typeof body.password === "string" && body.password.length > 0;
  if (passwordChanged) {
    const newPass: string = body.password;
    if (newPass.length < MIN_ADMIN_PASSWORD_LENGTH || !newPass.trim()) {
      return json(
        { error: `La contraseña debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres` },
        400
      );
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

    // A password change ends every session of that account (see adminAuth).
    // Keep the admin who changed their own password logged in.
    if (isSelf && passwordChanged) {
      const env = (ctx.locals as any).runtime?.env ?? {};
      const token = await createAdminSessionToken(
        { id: targetId, email, role, credential: passwordHash },
        env
      );
      setAdminSessionCookie(ctx.cookies, token, ctx.request.url);
    }

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
