import type { DaySchedule, OpenStatus } from "@/types";

/**
 * ÚNICA fuente de verdad de los horarios.
 * `open`/`close` en formato 24h "HH:mm". `null` = cerrado ese día.
 * Día 0 = domingo … 6 = sábado.
 * Atendemos TODOS los días de 5:00 pm a 10:30 pm.
 */
export const businessHours: DaySchedule[] = [
  { day: 1, label: "Lunes", open: "17:00", close: "22:30" },
  { day: 2, label: "Martes", open: "17:00", close: "22:30" },
  { day: 3, label: "Miércoles", open: "--", close: "--" },
  { day: 4, label: "Jueves", open: "17:00", close: "22:30" },
  { day: 5, label: "Viernes", open: "17:00", close: "22:30" },
  { day: 6, label: "Sábado", open: "17:00", close: "22:30" },
  { day: 0, label: "Domingo", open: "17:00", close: "22:30" },
];

const TIME_ZONE = "America/Lima";

/** Convierte "HH:mm" a minutos desde medianoche */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Día de semana (0–6) y minutos actuales en la zona horaria de Lima */
function nowInLima(date: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    day: dayMap[get("weekday")] ?? 0,
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

/**
 * Calcula si el local está abierto ahora (hora de Lima).
 * Función pura: recibe la fecha para facilitar testing.
 */
export function getOpenStatus(date: Date = new Date()): OpenStatus {
  const { day, minutes } = nowInLima(date);
  const today = businessHours.find((d) => d.day === day);

  if (today?.open && today.close) {
    const opens = toMinutes(today.open);
    const closes = toMinutes(today.close);
    if (minutes >= opens && minutes < closes) {
      return { isOpen: true, detail: `Hasta las ${today.close}` };
    }
    if (minutes < opens) {
      return { isOpen: false, detail: `Abre hoy a las ${today.open}` };
    }
  }

  // Cerrado: busca el próximo día con horario
  for (let i = 1; i <= 7; i++) {
    const next = businessHours.find((d) => d.day === (day + i) % 7);
    if (next?.open) {
      return {
        isOpen: false,
        detail: `Abre el ${next.label.toLowerCase()} a las ${next.open}`,
      };
    }
  }
  return { isOpen: false, detail: "Cerrado" };
}

/** Días en orden lunes → domingo para mostrar en el footer */
export const businessHoursOrdered: DaySchedule[] = [...businessHours].sort(
  (a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7),
);
