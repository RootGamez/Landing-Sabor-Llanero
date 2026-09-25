"use client";

import Link from "next/link";
import { UserIcon } from "@/components/ui/icons";
import { useCustomerAuth } from "@/lib/customerAuth";

interface AccountNavLinkProps {
  /** Paleta: ink sobre navbar sólido, blanco sobre hero transparente (mismo criterio que CartButton). */
  solid?: boolean;
}

/**
 * Entrada de cuenta en el Navbar (P2.8): sin esto, /cuenta no sería
 * descubrible fuera del flujo de checkout del carrito. Mientras la sesión
 * hidrata (`loading`), apunta a login por default — mismo criterio de
 * "server siempre renderiza el estado sin sesión" que `CartButton`.
 */
export default function AccountNavLink({ solid = false }: AccountNavLinkProps) {
  const { customer } = useCustomerAuth();
  const href = customer ? "/cuenta/" : "/cuenta/login/";
  const label = customer ? `Mi cuenta: ${customer.name}` : "Iniciar sesión";

  return (
    <Link
      href={href}
      aria-label={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300 ${
        solid ? "text-ink hover:text-brand-red" : "text-white hover:text-brand-yellow"
      }`}
    >
      <UserIcon className="h-5 w-5" />
    </Link>
  );
}
