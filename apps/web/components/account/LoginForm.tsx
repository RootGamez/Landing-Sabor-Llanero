"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customerAuth";
import AccountFormField from "@/components/account/AccountFormField";

export default function LoginForm() {
  const { login } = useCustomerAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/cuenta/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AccountFormField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <AccountFormField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
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
        {submitting ? "Ingresando…" : "Ingresar"}
      </button>

      <p className="text-center text-sm text-ink/70">
        ¿No tenés cuenta?{" "}
        <Link href="/cuenta/registro/" className="font-semibold text-brand-blue hover:text-brand-red">
          Creá una
        </Link>
      </p>
    </form>
  );
}
