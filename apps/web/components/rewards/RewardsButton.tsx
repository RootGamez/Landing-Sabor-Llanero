"use client";

import Link from "next/link";
import { GiftIcon } from "@/components/ui/icons";
import { useCustomerAuth } from "@/lib/customerAuth";

interface RewardsButtonProps {
  /** Paleta: ink sobre navbar sólido, blanco sobre hero transparente (mismo criterio que CartButton). */
  solid?: boolean;
  onClick?: () => void;
}

/**
 * Acceso directo a /premios desde el Navbar, mismo trato que CartButton
 * (ícono solo, sin badge numérico): a diferencia del carrito, el saldo de
 * puntos ya se ve en grande en FloatingRewardsButton dentro de /menu, así
 * que aquí alcanza con un ícono consistente con el resto de la fila.
 */
export default function RewardsButton({ solid = false, onClick }: RewardsButtonProps) {
  const { customer } = useCustomerAuth();
  const label = customer ? `Ver premios, tienes ${customer.pointsBalance} puntos` : "Ver premios";

  return (
    <Link
      href="/premios/"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300 ${
        solid ? "text-ink hover:text-brand-red" : "text-white hover:text-brand-yellow"
      }`}
    >
      <GiftIcon className="h-5 w-5" />
    </Link>
  );
}
