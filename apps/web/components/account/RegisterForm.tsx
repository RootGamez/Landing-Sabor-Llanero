"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerAuth";
import AccountFormField from "@/components/account/AccountFormField";

export default function RegisterForm() {
  const { register } = useCustomerAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ name, email, phone, password });
      router.push("/cuenta/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AccountFormField
        label="Nombre"
        name="name"
        autoComplete="name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <AccountFormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <AccountFormField
        label="Celular"
        name="phone"
        type="tel"
        autoComplete="tel"
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <AccountFormField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Mínimo 8 caracteres"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      {error && (
        <p role="alert" className="text-sm text-brand-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="btn-shine inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-red px-6 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:bg-brand-red-deep active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
      >
        {submitting ? "Creando cuenta…" : "Crear cuenta"}
      </button>

      <p className="text-center text-sm text-ink/70">
        ¿Ya tenés cuenta?{" "}
        <Link href="/cuenta/login/" className="font-semibold text-brand-blue hover:text-brand-red">
          Iniciá sesión
        </Link>
      </p>
    </form>
  );
}
