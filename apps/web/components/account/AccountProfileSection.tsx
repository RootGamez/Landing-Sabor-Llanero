"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  FULL_NAME_MAX,
  PHONE_MAX,
  fullNameError,
  normalizeFullName,
  phoneError,
  type Customer,
} from "@sabor/shared";
import { ApiError, api } from "@/lib/api";
import { useFieldErrors } from "@/lib/useFieldErrors";
import AccountFormField from "@/components/account/AccountFormField";

const SUCCESS_MESSAGE_MS = 4000;

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
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    [],
  );

  // Se compara normalizado en ambos lados (un dato antiguo con espacios sobrantes cuenta como "sin cambios").
  const nameChanged = normalizeFullName(name) !== normalizeFullName(customer.name);
  const phoneChanged = phone.trim() !== customer.phone.trim();

  // Los datos antiguos (ej. un nombre de una sola palabra, o un celular con otro formato)
  // no bloquean guardar el otro campo: cada regla solo aplica si ese campo se modificó.
  const fields = useFieldErrors({
    name: nameChanged ? fullNameError(name) : null,
    phone: phoneChanged ? phoneError(phone) : null,
  });

  const nameInputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  // Guarda el `editing` del render anterior (no un flag de "ya until pasó el
  // primer render"): con React Strict Mode, el efecto de abajo se invoca DOS
  // veces seguidas en el montaje con el mismo `editing`, y un flag booleano
  // que se apaga en la primera invocación ya no protege a la segunda —
  // comparar contra el valor anterior sí es a prueba de esa doble invocación.
  const previousEditingRef = useRef(editing);

  useEffect(() => {
    // Si el formulario está abierto, no pisar lo que el usuario ya tipeó: un
    // `refresh()` disparado por OTRA acción de la página (ej. canjear un
    // premio en la sección de Premios) actualiza `customer` en el contexto y
    // este efecto correría igual si no fuera por este guard.
    if (editing) return;
    setName(customer.name);
    setPhone(customer.phone);
  }, [customer.name, customer.phone, editing]);

  // Mueve el foco al abrir/cerrar el formulario: el botón "Editar" (o
  // "Cancelar"/"Guardar") que disparó el cambio se desmonta, y sin esto el
  // foco cae a <body> — mismo problema que ya se resolvió en CartPageContent
  // (headingRef) y en el modal de producto (focus-trap). No corre en el
  // montaje inicial (cuando `editing` no cambió respecto del render anterior)
  // para no robarle el foco a quien haya llegado a la página por otro camino
  // (ej. tabulando desde el header).
  useEffect(() => {
    if (previousEditingRef.current === editing) return;
    previousEditingRef.current = editing;
    if (editing) nameInputRef.current?.focus();
    else editButtonRef.current?.focus();
  }, [editing]);

  const handleCancel = (): void => {
    setEditing(false);
    setError(null);
    setName(customer.name);
    setPhone(customer.phone);
    fields.reset();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!fields.validate()) return;
    if (!nameChanged && !phoneChanged) {
      handleCancel(); // nada que guardar
      return;
    }
    setSaving(true);
    try {
      // Solo los campos modificados: un dato antiguo que ya no cumple las reglas actuales no bloquea el otro.
      await api.patch<Customer>("/customers/me", {
        ...(nameChanged ? { name: normalizeFullName(name) } : {}),
        ...(phoneChanged ? { phone: phone.trim() } : {}),
      });
      await onSaved();
      fields.reset();
      setEditing(false);
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), SUCCESS_MESSAGE_MS);
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
            ref={editButtonRef}
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-11 cursor-pointer items-center px-2 text-sm font-semibold text-brand-blue hover:text-brand-red"
          >
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-4">
          <AccountFormField
            ref={nameInputRef}
            label="Nombre y apellido"
            name="name"
            autoComplete="name"
            required
            maxLength={FULL_NAME_MAX}
            error={fields.error("name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => fields.touch("name")}
          />
          <AccountFormField
            label="Celular"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={PHONE_MAX}
            error={fields.error("phone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => fields.touch("phone")}
          />
          {error && (
            <p role="alert" className="text-sm text-brand-red">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {/* onMouseDown preventDefault: evita que el blur del campo muestre un error y mueva los botones
                antes de que se complete el clic (que se perdería). */}
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              onMouseDown={(event) => event.preventDefault()}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-red px-5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-brand-red-deep disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              onMouseDown={(event) => event.preventDefault()}
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
            <dt className="font-semibold text-ink">Email:</dt>
            <dd className="break-all">{customer.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-ink">Celular:</dt>
            <dd>{customer.phone}</dd>
          </div>
        </dl>
      )}
      {/* Región en vivo siempre montada: una insertada junto con su texto no se anuncia. */}
      <p role="status" className={justSaved ? "mt-2 text-sm font-semibold text-brand-blue" : "sr-only"}>
        {justSaved ? "Datos actualizados." : ""}
      </p>
    </section>
  );
}
