"use client";

import * as React from "react";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  UserCheck,
} from "lucide-react";
import type { ColDef } from "ag-grid-community";
import AdminGrid from "@/components/admin/AdminGrid";
import { MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/adminPolicy";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface AdminRecord {
  id: number;
  email: string;
  name: string;
  role: "superadmin" | "admin";
  is_active: number;
  created_at: string;
  updated_at?: string;
}

export default function AdminsDashboard() {
  const [admins, setAdmins] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Modal form state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingAdmin, setEditingAdmin] = React.useState<AdminRecord | null>(null);
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    password: "",
    role: "admin",
    is_active: true,
  });
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Delete modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [adminToDelete, setAdminToDelete] = React.useState<AdminRecord | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/admins");
      if (!res.ok) {
        throw new Error("No se pudo obtener la lista de administradores");
      }
      const data = (await res.json()) as any;
      setAdmins(data.admins || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar administradores");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAdmins();
  }, []);

  const openCreateModal = () => {
    setEditingAdmin(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "admin",
      is_active: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (admin: AdminRecord) => {
    setEditingAdmin(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      password: "",
      role: admin.role,
      is_active: admin.is_active === 1,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError("El nombre es requerido");
      return;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      setFormError("Ingresa un correo electrónico válido");
      return;
    }
    if (
      !editingAdmin &&
      (!formData.password || formData.password.length < MIN_ADMIN_PASSWORD_LENGTH)
    ) {
      setFormError(`La contraseña debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (
      editingAdmin &&
      formData.password &&
      formData.password.length < MIN_ADMIN_PASSWORD_LENGTH
    ) {
      setFormError(
        `La nueva contraseña debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres`
      );
      return;
    }

    setSaving(true);
    try {
      const url = editingAdmin
        ? `/api/admin/admins/${editingAdmin.id}`
        : "/api/admin/admins";
      const method = editingAdmin ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          is_active: formData.is_active ? 1 : 0,
          password: formData.password || undefined,
        }),
      });

      const resData = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(resData.error || "Error al guardar el administrador");
      }

      setModalOpen(false);
      await fetchAdmins();
    } catch (err: any) {
      setFormError(err.message || "Error al procesar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!adminToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/admins/${adminToDelete.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar el administrador");
      }
      setDeleteConfirmOpen(false);
      setAdminToDelete(null);
      await fetchAdmins();
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const columnDefs = React.useMemo<ColDef<AdminRecord>[]>(
    () => [
      {
        headerName: "Administrador",
        field: "name",
        flex: 2,
        minWidth: 220,
        cellRenderer: (p: any) => {
          const d = p.data as AdminRecord;
          return (
            <div className="flex h-full flex-col justify-center leading-tight">
              <span className="font-semibold text-foreground">{d.name}</span>
              <span className="text-xs text-muted-foreground truncate">{d.email}</span>
            </div>
          );
        },
      },
      {
        headerName: "Rol",
        field: "role",
        width: 140,
        cellRenderer: (p: any) => {
          const isSuper = p.value === "superadmin";
          return (
            <div className="flex h-full items-center">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isSuper
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                    : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                }`}
              >
                <ShieldCheck className="size-3" />
                {isSuper ? "Superadmin" : "Admin"}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "Estado",
        field: "is_active",
        width: 120,
        cellRenderer: (p: any) => {
          const active = p.value === 1;
          return (
            <div className="flex h-full items-center">
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                }`}
              >
                {active ? (
                  <>
                    <CheckCircle2 className="size-3.5" /> Activo
                  </>
                ) : (
                  <>
                    <XCircle className="size-3.5" /> Inactivo
                  </>
                )}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "Fecha Creación",
        field: "created_at",
        width: 170,
        cellRenderer: (p: any) => {
          if (!p.value) return "—";
          const d = new Date(p.value);
          return (
            <div className="flex h-full items-center text-xs text-muted-foreground">
              {d.toLocaleDateString("es-CO", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          );
        },
      },
      {
        headerName: "Acciones",
        width: 120,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => {
          const admin = p.data as AdminRecord;
          return (
            <div className="flex h-full items-center gap-1">
              <button
                type="button"
                onClick={() => openEditModal(admin)}
                title="Editar administrador"
                className="hover:bg-muted rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminToDelete(admin);
                  setDeleteConfirmOpen(true);
                }}
                title="Eliminar administrador"
                className="hover:bg-destructive/10 text-muted-foreground transition-colors hover:text-destructive rounded p-1.5"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6 lg:h-full lg:overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            Administradores
          </h1>
          <p className="text-sm text-muted-foreground">
            Control de usuarios con acceso al panel de administración de AFRO IN.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="size-4" />
          Nuevo Administrador
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Grid container */}
      <div className="bg-card border-border flex flex-col rounded-xl border shadow-sm lg:min-h-0 lg:flex-1">
        <AdminGrid<AdminRecord>
          rowData={admins}
          columnDefs={columnDefs}
          loading={loading}
          overlayNoRowsTemplate="<span>No hay administradores registrados en D1</span>"
        />
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingAdmin ? "Editar Administrador" : "Nuevo Administrador"}
              </DialogTitle>
              <DialogDescription>
                {editingAdmin
                  ? "Actualiza la información del administrador o cambia su contraseña."
                  : "Ingresa los datos para autorizar a un nuevo integrante al panel."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="admin-name">Nombre Completo</Label>
                <Input
                  id="admin-name"
                  placeholder="Ej. Julio Moreno"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Correo Electrónico</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@afroin.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-password">
                  {editingAdmin
                    ? "Nueva Contraseña (dejar en blanco para mantener la actual)"
                    : "Contraseña"}
                </Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder={`Mínimo ${MIN_ADMIN_PASSWORD_LENGTH} caracteres`}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, password: e.target.value }))
                    }
                    required={!editingAdmin}
                    className="pr-9"
                  />
                  <KeyRound className="absolute right-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-role">Rol</Label>
                  <select
                    id="admin-role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, role: e.target.value }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-status">Estado</Label>
                  <select
                    id="admin-status"
                    value={formData.is_active ? "1" : "0"}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, is_active: e.target.value === "1" }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="1">Activo</option>
                    <option value="0">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Guardando...
                  </>
                ) : editingAdmin ? (
                  "Guardar Cambios"
                ) : (
                  "Crear Administrador"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar Administrador?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar a{" "}
              <strong>{adminToDelete?.name}</strong> ({adminToDelete?.email})? Esta
              acción no se puede deshacer y el usuario perderá acceso inmediato al panel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Sí, Eliminar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
