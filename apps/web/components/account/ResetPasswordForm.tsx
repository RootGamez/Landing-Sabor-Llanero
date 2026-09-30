"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { MessageResponse } from "@sabor/shared";
import { api, ApiError } from "@/lib/api";
import AccountFormField from "@/components/account/AccountFormField";
import AccountSubmitButton from "@/components/account/AccountSubmitButton";

const LINK_CLASS = "font-semibold text-brand-blue hover:text-brand-red";
const MIN_PASSWORD_LENGTH = 8;

/**
 * El token viaja en el fragment del link del email (`#token=...`), no en query
 * string: así nunca llega al servidor ni queda en un header Referer. Se lee
 * después de montar porque el sitio es export estático (no hay `window` al prerenderizar).
 */
function readTokenFromHash(): string | null {
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
}

export default function ResetPasswordForm() {
  // undefined = todavía no se leyó el fragment; null = no había token.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  // En desarrollo React (Strict Mode) ejecuta los efectos dos veces: la segunda
  // ya no encontraría el fragment (se borró de la URL), así que el token se lee una sola vez.
  const tokenReadRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (tokenReadRef.current === undefined) {
      tokenReadRef.current = readTokenFromHash();
      // El token ya está en memoria: se saca de la barra de direcciones y del historial.
      if (tokenReadRef.current) window.history.replaceState(null, "", window.location.pathname);
    }
    setToken(tokenReadRef.current);
  }, []);

  // Sin token o ya listo, el formulario no está en el DOM: se mueve el foco al mensaje.
  useEffect(() => {
    if (token === null || done) messageRef.current?.focus();
  }, [token, done]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post<MessageResponse>("/customers/reset-password", { token, newPassword });
      setDone(true);
    } catch (err) {
      // La API da el mismo mensaje genérico para token inválido, vencido o ya
      // usado: se muestra tal cual, sin intentar distinguir el motivo.
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar la contraseña");
    } finally {
      setSubmitting(false);
    }
  };

  if (token === undefined) return null;

  if (token === null) {
    return (
      <div ref={messageRef} tabIndex={-1} role="alert" className="space-y-4 text-center outline-none">
        <p className="text-sm text-brand-red">
          Este link de recuperación es inválido. Pide uno nuevo para continuar.
        </p>
        <Link href="/cuenta/recuperar/" className={`inline-block py-2 text-sm ${LINK_CLASS}`}>
          Pedir un nuevo link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div ref={messageRef} tabIndex={-1} role="status" className="space-y-4 text-center outline-none">
        <p className="text-sm text-ink">Tu contraseña se actualizó correctamente.</p>
        <Link href="/cuenta/login/" className={`inline-block py-2 text-sm ${LINK_CLASS}`}>
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AccountFormField
        label="Contraseña nueva"
        name="new-password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />

      {error && (
        <div role="alert" className="space-y-1">
          <p className="text-sm text-brand-red">{error}</p>
          <Link href="/cuenta/recuperar/" className={`inline-block py-2 text-sm ${LINK_CLASS}`}>
            Pedir un nuevo link
          </Link>
        </div>
      )}

      <AccountSubmitButton submitting={submitting}>
        {submitting ? "Guardando…" : "Actualizar contraseña"}
      </AccountSubmitButton>
    </form>
  );
}
