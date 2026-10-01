"use client";

import { useState, type ComponentProps } from "react";
import AccountFormField from "@/components/account/AccountFormField";

type PasswordFieldProps = Omit<ComponentProps<typeof AccountFormField>, "type" | "endAdornment">;

/**
 * Campo de contraseña con botón mostrar/ocultar. No bloquea el pegado (los
 * gestores de contraseñas lo necesitan); pasar `autoComplete="new-password"`
 * al crear/cambiar y `current-password` al verificar la actual.
 */
export default function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <AccountFormField
      {...props}
      type={visible ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-controls={props.name}
          aria-label="Mostrar contraseña"
          className="inline-flex min-h-10 cursor-pointer items-center rounded-full px-3 text-xs font-semibold text-brand-blue hover:text-brand-red"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      }
    />
  );
}
