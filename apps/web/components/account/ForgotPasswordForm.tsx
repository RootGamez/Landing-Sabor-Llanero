"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { EMAIL_MAX, emailError, normalizeEmail, type MessageResponse } from "@sabor/shared";
import { api, ApiError } from "@/lib/api";
import { useFieldErrors } from "@/lib/useFieldErrors";
import AccountFormField from "@/components/account/AccountFormField";
import AccountSubmitButton from "@/components/account/AccountSubmitButton";

const LINK_CLASS = "font-semibold text-brand-blue hover:text-brand-red";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const fields = useFieldErrors({ email: emailError(normalizeEmail(email)) });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  // El formulario (con el botón que tenía el foco) desaparece del DOM al
  // enviar: sin esto el foco cae a <body> y se pierde el lugar para teclado
  // y lectores de pantalla.
  useEffect(() => {
    if (sent) statusRef.current?.focus();
  }, [sent]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!fields.validate()) return;
    setSubmitting(true);
    try {
      // La API responde siempre lo mismo exista o no la cuenta (anti-enumeración):
      // aquí se muestra una confirmación fija, sin interpretar la respuesta.
      await api.post<MessageResponse>("/customers/forgot-password", { email: normalizeEmail(email) });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="space-y-4 text-center outline-none">
        <p className="text-sm text-ink">
          Si el email existe, vas a recibir un link para recuperar tu contraseña. Revisa tu bandeja de
          entrada (y el spam).
        </p>
        <Link href="/cuenta/login/" className={`inline-block py-2 text-sm ${LINK_CLASS}`}>
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <AccountFormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        maxLength={EMAIL_MAX}
        error={fields.error("email")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={() => fields.touch("email")}
      />

      {error && (
        <p role="alert" className="text-sm text-brand-red">
          {error}
        </p>
      )}

      <AccountSubmitButton submitting={submitting}>
        {submitting ? "Enviando…" : "Enviar link de recuperación"}
      </AccountSubmitButton>

      <p className="text-center text-sm text-ink/70">
        <Link href="/cuenta/login/" className={LINK_CLASS}>
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
