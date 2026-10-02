"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  EMAIL_MAX,
  FULL_NAME_MAX,
  LEGAL_VERSION,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PHONE_MAX,
  PRIVACY_PATH,
  TERMS_PATH,
  emailError,
  fullNameError,
  normalizeEmail,
  normalizeFullName,
  passwordConfirmError,
  passwordError,
  phoneError,
  termsAcceptedError,
} from "@sabor/shared";
import { ApiError } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerAuth";
import { useFieldErrors } from "@/lib/useFieldErrors";
import AccountCheckboxField from "@/components/account/AccountCheckboxField";
import AccountFormField from "@/components/account/AccountFormField";
import AccountSubmitButton from "@/components/account/AccountSubmitButton";
import PasswordField from "@/components/account/PasswordField";

export default function RegisterForm() {
  const { register } = useCustomerAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fields = useFieldErrors({
    name: fullNameError(name),
    email: emailError(normalizeEmail(email)),
    phone: phoneError(phone),
    password: passwordError(password),
    confirmPassword: passwordConfirmError(password, confirmPassword),
    acceptedTerms: termsAcceptedError(acceptedTerms),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!fields.validate()) return;
    setSubmitting(true);
    try {
      await register({
        name: normalizeFullName(name),
        email: normalizeEmail(email),
        phone: phone.trim(),
        password,
        acceptedTerms: true,
        termsVersion: LEGAL_VERSION,
      });
      router.push("/cuenta/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <AccountFormField
        label="Nombre y apellido"
        name="name"
        autoComplete="name"
        required
        maxLength={FULL_NAME_MAX}
        placeholder="Ej. María Pérez"
        error={fields.error("name")}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => fields.touch("name")}
      />
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
      <AccountFormField
        label="Celular"
        name="phone"
        type="tel"
        autoComplete="tel"
        required
        maxLength={PHONE_MAX}
        error={fields.error("phone")}
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        onBlur={() => fields.touch("phone")}
      />
      <PasswordField
        label="Contraseña"
        name="password"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
        hint={`Mínimo ${PASSWORD_MIN} caracteres. Puedes usar una frase larga.`}
        error={fields.error("password")}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onBlur={() => fields.touch("password")}
      />
      <PasswordField
        label="Repite la contraseña"
        name="confirmPassword"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
        error={fields.error("confirmPassword")}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        onBlur={() => fields.touch("confirmPassword")}
      />

      <AccountCheckboxField
        name="acceptedTerms"
        required
        checked={acceptedTerms}
        onChange={(event) => {
          setAcceptedTerms(event.target.checked);
          fields.touch("acceptedTerms");
        }}
        error={fields.error("acceptedTerms")}
      >
        Acepto los{" "}
        <Link
          href={TERMS_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-blue underline hover:text-brand-red"
        >
          Términos y Condiciones
        </Link>{" "}
        y la{" "}
        <Link
          href={PRIVACY_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-blue underline hover:text-brand-red"
        >
          Política de Privacidad
        </Link>
        .
      </AccountCheckboxField>

      {error && (
        <p role="alert" className="text-sm text-brand-red">
          {error}
        </p>
      )}

      <AccountSubmitButton submitting={submitting}>
        {submitting ? "Creando cuenta…" : "Crear cuenta"}
      </AccountSubmitButton>

      <p className="text-center text-sm text-ink/70">
        ¿Ya tienes cuenta?{" "}
        <Link href="/cuenta/login/" className="font-semibold text-brand-blue hover:text-brand-red">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
