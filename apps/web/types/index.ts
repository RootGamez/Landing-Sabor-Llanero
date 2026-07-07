/** Imagen del carrusel del hero o de la galería */
export interface SiteImage {
  src: string;
  alt: string;
}

/** Horario de un día. `open`/`close` en formato "HH:mm" (24h). */
export interface DaySchedule {
  /** 0 = domingo … 6 = sábado (igual que Date.getDay()) */
  day: number;
  label: string;
  open: string | null;
  close: string | null;
}

/** Estado calculado de apertura del local */
export interface OpenStatus {
  isOpen: boolean;
  /** Texto auxiliar, ej. "Abre a las 18:00" */
  detail: string;
}

export interface SocialLink {
  name: "Instagram" | "Facebook" | "WhatsApp";
  url: string;
}

export interface NavLink {
  label: string;
  href: string;
}
