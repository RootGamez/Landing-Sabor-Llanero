"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Customer } from "@sabor/shared";
import { ApiError, api } from "@/lib/api";
import AccountFormField from "@/components/account/AccountFormField";

interface AccountProfileSectionProps {
  customer: Customer;
  /** Refresca el perfil en el contexto tras guardar (GET /customers/me). */
  onSaved: () => Promise<void>;
}

/** Nombre/teléfono del cliente, con edición inline vía PATCH /customers/me (P2.8). */
export default function AccountProfileSection({ customer, onSaved }: AccountProfileSectionProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Si el formulario está abierto, no pisar lo que el usuario ya tipeó: un
    // `refresh()` disparado por OTRA acción de la página (ej. canjear un
    // premio en la sección de Premios) actualiza `customer` en el contexto y
    // este efecto correría igual si no fuera por este guard.
    if (editing) return;
    setName(customer.name);
    setPhone(customer.phone);
  }, [customer.name, customer.phone, editing]);

  const handleCancel = (): void => {
    setEditing(false);
    setError(null);
    setName(customer.name);
    setPhone(customer.phone);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.patch<Customer>("/customers/me", { name, phone });
      await onSaved();
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl tracking-wide text-ink">Tus datos</h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="cursor-pointer text-sm font-semibold text-brand-blue hover:text-brand-red"
          >
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <AccountFormField label="Nombre" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <AccountFormField
            label="Celular"
            name="phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-brand-red">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-red px-5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-brand-red-deep disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-ink/10 px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink/30"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <dl className="mt-3 space-y-1 text-sm text-ink/70">
          <div className="flex gap-2">
            <dt className="font-semibold text-ink">Nombre:</dt>
            <dd>{customer.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-ink">Celular:</dt>
            <dd>{customer.phone}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
