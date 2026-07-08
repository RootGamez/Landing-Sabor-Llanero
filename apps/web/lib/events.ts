/**
 * Registro de eventos de analítica del catálogo (BLUEPRINT §2.6, patrón
 * OrderButton de Jaw). Fire-and-forget: nunca bloquea ni rompe la UI si la
 * API no responde — es telemetría, no una operación crítica del negocio.
 */
import { api } from "@/lib/api";

export function trackOrderClick(itemId: number): void {
  api.post("/events", { itemId, type: "order_click" }).catch(() => {
    // Silencioso a propósito: perder un evento de analítica no debe
    // interrumpir el flujo de pedido del usuario (el link de WhatsApp
    // ya se abrió independientemente de esta llamada).
  });
}
