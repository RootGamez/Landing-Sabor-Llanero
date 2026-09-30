"use client";

import type { ReactNode } from "react";

interface AccountSubmitButtonProps {
  submitting: boolean;
  children: ReactNode;
}

/** Botón principal de los formularios de cuenta (mismo estilo que login/registro). */
export default function AccountSubmitButton({ submitting, children }: AccountSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={submitting}
      aria-busy={submitting}
      className="btn-shine inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-red px-6 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:bg-brand-red-deep active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 md:text-base"
    >
      {children}
    </button>
  );
}
