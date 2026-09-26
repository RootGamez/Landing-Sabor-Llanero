"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RewardCard from "@/components/rewards/RewardCard";
import { fetchRewards } from "@/lib/accountData";
import { useCustomerAuth } from "@/lib/customerAuth";
import { useAsync } from "@/lib/useAsync";

/**
 * Catálogo público de premios (P2.9, export estático → out/premios/index.html).
 * A diferencia de /cuenta, esta ruta NO exige sesión: `GET /rewards` ya es
 * público, así que cualquier visitante puede curiosear el catálogo completo
 * — vitrina para sumar cuentas nuevas, mismo espíritu que
 * `RewardsReminderBubble` en /menu, pero como página completa.
 *
 * Logueado: ve su saldo de puntos arriba y puede canjear (mismo `RewardCard`
 * que /cuenta). Invitado o sesión aún hidratando: ve el catálogo igual, con
 * una invitación liviana a iniciar sesión / crear cuenta en vez de un botón
 * de canje que fallaría con 401 (ver `RewardCard.isLoggedIn`).
 */
export default function PremiosPageContent() {
  const { customer, loading, refresh } = useCustomerAuth();
  const rewardsState = useAsync(fetchRewards);

  // Mismo patrón optimista que AccountPageContent: tras un canje se refleja
  // el nuevo saldo de inmediato, sin esperar el round-trip de `refresh()`.
  // Se limpia solo cuando `refresh()` ya trajo un `customer.pointsBalance`
  // que coincide, para no tapar para siempre un cambio de saldo posterior.
  const [pointsOverride, setPointsOverride] = useState<number | null>(null);
  useEffect(() => {
    if (pointsOverride !== null && customer?.pointsBalance === pointsOverride) {
      setPointsOverride(null);
    }
  }, [customer, pointsOverride]);

  const isLoggedIn = Boolean(customer);
  const pointsBalance = pointsOverride ?? customer?.pointsBalance ?? 0;

  const handleRedeemed = (newBalance: number): void => {
    setPointsOverride(newBalance);
    void refresh();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <h1 className="font-display text-3xl tracking-wide text-ink md:text-4xl">Catálogo de premios</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/70">
        Canjeá tus puntos por premios reales: cada canje genera un pedido que el local prepara y acepta.
      </p>

      {!loading && isLoggedIn && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-blue px-6 py-5 text-white">
          <div>
            <p className="text-sm text-white/70">Tus puntos</p>
            <p className="font-display text-4xl tabular-nums">{pointsBalance}</p>
          </div>
          <Link
            href="/cuenta/"
            className="text-sm font-semibold text-white/90 underline-offset-2 hover:text-brand-yellow hover:underline"
          >
            Ir a mi cuenta →
          </Link>
        </div>
      )}

      {!loading && !isLoggedIn && (
        <div className="mt-6 rounded-2xl border-2 border-brand-blue/20 bg-white px-5 py-4">
          <p className="text-sm text-ink/70">
            <Link
              href="/cuenta/login/"
              className="font-semibold text-brand-blue hover:text-brand-red hover:underline"
            >
              Iniciá sesión
            </Link>{" "}
            o{" "}
            <Link
              href="/cuenta/registro/"
              className="font-semibold text-brand-blue hover:text-brand-red hover:underline"
            >
              creá una cuenta gratis
            </Link>{" "}
            para ver tu saldo de puntos y canjear estos premios.
          </p>
        </div>
      )}

      <div className="mt-8">
        {rewardsState.loading && (
          <p className="text-sm text-ink/70" role="status">
            Cargando premios…
          </p>
        )}
        {rewardsState.error && <p className="text-sm text-brand-red">No pudimos cargar los premios.</p>}
        {rewardsState.data && rewardsState.data.length === 0 && (
          <p className="text-sm text-ink/70">Todavía no hay premios disponibles.</p>
        )}
        {rewardsState.data && rewardsState.data.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {rewardsState.data.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                isLoggedIn={isLoggedIn}
                pointsBalance={pointsBalance}
                onRedeemed={handleRedeemed}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
