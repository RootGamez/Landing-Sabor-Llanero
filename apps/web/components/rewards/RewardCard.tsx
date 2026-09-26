"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { RedeemRewardResponse, Reward } from "@sabor/shared";
import { GiftIcon } from "@/components/ui/icons";
import { ApiError, api, mediaUrl } from "@/lib/api";
import RewardPriceBadge from "@/components/rewards/RewardPriceBadge";

interface RewardCardProps {
  reward: Reward;
  /** false = invitado o sesión aún hidratando: el CTA invita a iniciar sesión en vez de intentar un canje que devolvería 401. */
  isLoggedIn: boolean;
  pointsBalance: number;
  onRedeemed: (pointsBalance: number) => void;
}

/**
 * Card de premio canjeable. Se usa tanto en /cuenta (cliente logueado) como
 * en /premios (catálogo público — P2.9). El guard real de saldo insuficiente
 * vive en la API (`UPDATE ... WHERE points_balance >= ?`, P2.4) — acá
 * `canRedeem` es solo UX (deshabilita el botón antes de gastar un round-trip,
 * y evita intentar un canje sin sesión).
 */
export default function RewardCard({ reward, isLoggedIn, pointsBalance, onRedeemed }: RewardCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Código del pedido real que generó el canje: es un hecho durable (el
  // pedido existe y espera aceptación del local), no una confirmación
  // transitoria — por eso no se auto-oculta como el viejo `justRedeemed`.
  const [redeemedOrderCode, setRedeemedOrderCode] = useState<string | null>(null);
  const canRedeem = isLoggedIn && pointsBalance >= reward.pointsCost;

  const handleRedeem = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<RedeemRewardResponse>(`/rewards/${reward.id}/redeem`);
      if (!res) throw new ApiError(500, "Respuesta inesperada del servidor");
      onRedeemed(res.pointsBalance);
      setRedeemedOrderCode(res.order.code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo canjear el premio");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-ink/10 bg-white">
      <div className="relative aspect-4/3 w-full bg-cream-deep">
        {reward.imageR2Key ? (
          <Image
            src={mediaUrl(reward.imageR2Key)}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-blue/20" aria-hidden="true">
            <GiftIcon className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-display text-lg tracking-wide text-ink">{reward.nameEs}</p>
        {reward.descriptionEs && <p className="line-clamp-2 text-sm text-ink/60">{reward.descriptionEs}</p>}
        <RewardPriceBadge price={reward.price} discountPrice={reward.discountPrice} />
        <p className="mt-auto font-display text-brand-red tabular-nums">{reward.pointsCost} pts</p>
        {isLoggedIn ? (
          <button
            type="button"
            onClick={handleRedeem}
            disabled={!canRedeem || submitting}
            aria-busy={submitting}
            className="mt-1 inline-flex min-h-11 items-center justify-center rounded-full bg-brand-blue px-4 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:bg-brand-blue-deep active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40 disabled:hover:scale-100"
          >
            {submitting ? "Canjeando…" : canRedeem ? "Canjear" : "Puntos insuficientes"}
          </button>
        ) : (
          <Link
            href="/cuenta/login/"
            className="mt-1 inline-flex min-h-11 items-center justify-center rounded-full border-2 border-brand-blue px-4 text-center text-sm font-semibold text-brand-blue transition-all duration-300 hover:scale-[1.02] hover:bg-brand-blue hover:text-white active:scale-95"
          >
            Iniciá sesión para canjear
          </Link>
        )}
        {error && (
          <p role="alert" className="text-xs text-brand-red">
            {error}
          </p>
        )}
        {redeemedOrderCode && (
          <p role="status" className="text-xs font-semibold text-brand-blue">
            Tu pedido #{redeemedOrderCode} fue creado y está pendiente de aceptación del local.
          </p>
        )}
      </div>
    </div>
  );
}
