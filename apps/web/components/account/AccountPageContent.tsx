"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "@/components/ui/icons";
import AccountProfileSection from "@/components/account/AccountProfileSection";
import OrderHistoryList from "@/components/account/OrderHistoryList";
import RewardCard from "@/components/account/RewardCard";
import { fetchMyOrders, fetchRewards } from "@/lib/accountData";
import { useCustomerAuth } from "@/lib/customerAuth";
import { useAsync } from "@/lib/useAsync";

/**
 * Perfil de cliente (P2.8): saldo de puntos, datos propios, catálogo de
 * premios + canje, historial de pedidos. Guardia de sesión: mientras se
 * resuelve el token guardado se muestra un estado de carga; sin sesión,
 * redirige a /cuenta/login (nunca deja la ruta "vacía" ni la deja abierta a
 * clientes anónimos).
 */
export default function AccountPageContent() {
  const { customer, loading, logout, refresh } = useCustomerAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !customer) router.replace("/cuenta/login/");
  }, [loading, customer, router]);

  const ordersState = useAsync(fetchMyOrders, Boolean(customer));
  const rewardsState = useAsync(fetchRewards, Boolean(customer));

  // Override optimista tras un canje, para no esperar el round-trip de
  // `refresh()` antes de reflejar el nuevo saldo. Se computa en el render (no
  // vía `useEffect` + `useState(0)`) para no mostrar "0" un frame antes del
  // valor real al entrar a la página. Se limpia solo cuando `refresh()` ya
  // trajo un `customer.pointsBalance` que coincide, para no tapar para
  // siempre un cambio de saldo posterior por otra vía (ej. otra pestaña).
  const [pointsOverride, setPointsOverride] = useState<number | null>(null);
  useEffect(() => {
    if (pointsOverride !== null && customer?.pointsBalance === pointsOverride) {
      setPointsOverride(null);
    }
  }, [customer, pointsOverride]);

  if (loading || !customer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-ink/70" role="status">
        {loading ? "Cargando tu cuenta…" : "Redirigiendo…"}
      </div>
    );
  }

  const pointsBalance = pointsOverride ?? customer.pointsBalance;

  const handleRedeemed = (newBalance: number): void => {
    // Optimista con la respuesta del canje; `refresh()` reconcilia en segundo
    // plano (ej. si otra pestaña canjeó algo al mismo tiempo).
    setPointsOverride(newBalance);
    void refresh();
  };

  const handleLogout = (): void => {
    logout();
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-ink md:text-4xl">
            Hola, {customer.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink/70">{customer.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-ink/10 px-4 text-sm font-semibold text-ink transition-colors duration-200 hover:border-brand-red/40 hover:text-brand-red"
        >
          <LogOutIcon className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-brand-blue px-6 py-5 text-white">
        <p className="text-sm text-white/70">Tus puntos</p>
        <p className="font-display text-4xl tabular-nums">{pointsBalance}</p>
      </div>

      <AccountProfileSection customer={customer} onSaved={refresh} />

      <section className="mt-10">
        <h2 className="font-display text-xl tracking-wide text-ink">Premios</h2>
        <div className="mt-4">
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
                <RewardCard key={reward.id} reward={reward} pointsBalance={pointsBalance} onRedeemed={handleRedeemed} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl tracking-wide text-ink">Tus pedidos</h2>
        <div className="mt-4">
          {ordersState.loading && (
            <p className="text-sm text-ink/70" role="status">
              Cargando pedidos…
            </p>
          )}
          {ordersState.error && <p className="text-sm text-brand-red">No pudimos cargar tus pedidos.</p>}
          {ordersState.data && <OrderHistoryList orders={ordersState.data} />}
        </div>
      </section>
    </div>
  );
}
