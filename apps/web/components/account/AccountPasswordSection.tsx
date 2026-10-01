"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordConfirmError,
  passwordError,
  WRONG_CURRENT_PASSWORD_MESSAGE,
  type ChangePasswordResponse,
} from "@sabor/shared";
import { ApiError, api, setCustomerToken } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerAuth";
import { useFieldErrors } from "@/lib/useFieldErrors";
import PasswordField from "@/components/account/PasswordField";

const SUCCESS_MESSAGE_MS = 6000;

interface AccountPasswordSectionProps {
  /** Refresca el perfil en el contexto tras cambiar la contraseña (GET /customers/me). */
  onChanged: () => Promise<void>;
}

/**
 * Cambio de contraseña del cliente: pide la actual y la nueva dos veces. La API
 * devuelve un token nuevo (cerró las demás sesiones al subir `token_version`);
 * se guarda para que ESTA sesión siga activa.
 */
export default function AccountPasswordSection({ onChanged }: AccountPasswordSectionProps) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justChanged, setJustChanged] = useState(false);

  const { logout } = useCustomerAuth();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(open);
  const changedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (changedTimerRef.current) clearTimeout(changedTimerRef.current);
    },
    [],
  );

  const fields = useFieldErrors({
    currentPassword: currentPassword ? null : "Ingresa tu contraseña actual",
    newPassword:
      passwordError(newPassword) ??
      (newPassword === currentPassword ? "La nueva contraseña debe ser distinta de la actual" : null),
    confirmPassword: passwordConfirmError(newPassword, confirmPassword),
  });

  // Al abrir/cerrar el formulario el botón que tenía el foco se desmonta: se mueve el foco
  // al primer campo o de vuelta al botón (no corre en el montaje inicial).
  useEffect(() => {
    if (wasOpenRef.current === open) return;
    wasOpenRef.current = open;
    if (open) document.getElementById("currentPassword")?.focus();
    else openButtonRef.current?.focus();
  }, [open]);

  const close = (): void => {
    setOpen(false);
    setError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    fields.reset();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!fields.validate()) return;
    setSaving(true);
    try {
      const response = await api.post<ChangePasswordResponse>("/customers/change-password", {
        currentPassword,
        newPassword,
      });
      // El token viejo ya quedó revocado: sin el nuevo la sesión moriría, así que no se continúa en silencio.
      if (!response) throw new ApiError(500, "Respuesta inesperada del servidor");
      setCustomerToken(response.token);
      await onChanged();
      close();
      setJustChanged(true);
      if (changedTimerRef.current) clearTimeout(changedTimerRef.current);
      changedTimerRef.current = setTimeout(() => setJustChanged(false), SUCCESS_MESSAGE_MS);
    } catch (err) {
      // 401 distinto de "contraseña actual incorrecta" = la sesión murió (ej. la contraseña se
      // cambió desde otro dispositivo): se cierra para volver al login en vez de quedar atascado.
      if (err instanceof ApiError && err.status === 401 && err.message !== WRONG_CURRENT_PASSWORD_MESSAGE) {
        logout();
        return;
      }
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl tracking-wide text-ink">Contraseña</h2>
        {!open && (
          <button
            ref={openButtonRef}
            type="button"
            onClick={() => {
              setJustChanged(false);
              setOpen(true);
            }}
            className="inline-flex min-h-11 cursor-pointer items-center px-2 text-sm font-semibold text-brand-blue hover:text-brand-red"
          >
            Cambiar
          </button>
        )}
      </div>

      {open ? (
        <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-4">
          <PasswordField
            label="Contraseña actual"
            name="currentPassword"
            autoComplete="current-password"
            required
            maxLength={PASSWORD_MAX}
            error={fields.error("currentPassword")}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            onBlur={() => fields.touch("currentPassword")}
          />
          <PasswordField
            label="Contraseña nueva"
            name="newPassword"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX}
            hint={`Mínimo ${PASSWORD_MIN} caracteres. Puedes usar una frase larga.`}
            error={fields.error("newPassword")}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            onBlur={() => fields.touch("newPassword")}
          />
          <PasswordField
            label="Repite la contraseña nueva"
            name="confirmPassword"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX}
            error={fields.error("confirmPassword")}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            onBlur={() => fields.touch("confirmPassword")}
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
              {saving ? "Guardando…" : "Cambiar contraseña"}
            </button>
            <button
              type="button"
              onClick={close}
              onMouseDown={(event) => event.preventDefault()}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-ink/10 px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink/30"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-ink/70">Cambiarla cierra tu sesión en otros dispositivos.</p>
      )}
      {/* Región en vivo siempre montada: una insertada junto con su texto no se anuncia. */}
      <p role="status" className={justChanged ? "mt-2 text-sm font-semibold text-brand-blue" : "sr-only"}>
        {justChanged ? "Contraseña actualizada." : ""}
      </p>
    </section>
  );
}
