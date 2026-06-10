import TricolorBar from "@/components/ui/TricolorBar";
import { businessHoursOrdered } from "@/lib/businessHours";
import { siteConfig } from "@/lib/siteConfig";

/** Iconos SVG inline de redes sociales (sin librerías) */
function SocialIcon({ name }: { name: string }) {
  switch (name) {
    case "Instagram":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
          <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.4 2.2 8.8 2.2 12 2.2m0 1.8c-3.15 0-3.52 0-4.76.07-1.08.05-1.66.23-2.05.38-.51.2-.88.44-1.26.82-.38.38-.62.75-.82 1.26-.15.39-.33.97-.38 2.05-.06 1.24-.07 1.61-.07 4.76s0 3.52.07 4.76c.05 1.08.23 1.66.38 2.05.2.51.44.88.82 1.26.38.38.75.62 1.26.82.39.15.97.33 2.05.38 1.24.06 1.61.07 4.76.07s3.52 0 4.76-.07c1.08-.05 1.66-.23 2.05-.38.51-.2.88-.44 1.26-.82.38-.38.62-.75.82-1.26.15-.39.33-.97.38-2.05.06-1.24.07-1.61.07-4.76s0-3.52-.07-4.76c-.05-1.08-.23-1.66-.38-2.05-.2-.51-.44-.88-.82-1.26a3.4 3.4 0 0 0-1.26-.82c-.39-.15-.97-.33-2.05-.38C15.52 4 15.15 4 12 4m0 3.06a4.94 4.94 0 1 1 0 9.88 4.94 4.94 0 0 1 0-9.88M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4m6.3-8.36a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0" />
        </svg>
      );
    case "Facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07" />
        </svg>
      );
    case "WhatsApp":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
          <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.1 4.5.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.84 9.84 0 0 1 9.88 9.89c0 5.45-4.43 9.88-9.89 9.88m8.41-18.29A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.94L.07 24l6.31-1.65a11.88 11.88 0 0 0 5.67 1.44h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.49-8.4" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Footer con ubicación, horarios (desde lib/businessHours.ts),
 * contacto, redes y la franja tricolor como remate de marca.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="ubicacion" className="bg-brand-blue text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="text-center">
          <h2 className="font-display text-4xl tracking-wide md:text-5xl">
            Visítanos
          </h2>
          <div className="mx-auto mt-3 flex h-1.5 w-24 overflow-hidden rounded-full" aria-hidden="true">
            <span className="flex-1 bg-brand-yellow" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-brand-red" />
          </div>
        </div>

        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
          {/* Columna izquierda: horarios y contacto */}
          <div>
            <h3 className="font-display text-2xl tracking-wide text-brand-yellow">
              Horarios de atención
            </h3>
            <ul className="mt-4 divide-y divide-white/10">
              {businessHoursOrdered.map((d) => (
                <li key={d.day} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium">{d.label}</span>
                  {d.open && d.close ? (
                    <span className="text-white/85">
                      {d.open} – {d.close}
                    </span>
                  ) : (
                    <span className="font-medium text-brand-red brightness-150">Cerrado</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-8 space-y-3 text-sm">
              <p className="flex items-center gap-3">
                <span aria-hidden="true">📞</span>
                <a
                  href={siteConfig.phoneHref}
                  className="font-semibold underline-offset-4 transition-colors hover:text-brand-yellow hover:underline"
                >
                  {siteConfig.phone}
                </a>
              </p>
              <p className="flex items-center gap-3">
                <span aria-hidden="true">📍</span>
                <span className="text-white/85">
                  {siteConfig.address.street}, {siteConfig.address.display}
                </span>
              </p>
            </div>
          </div>

          {/* Columna derecha: mapa y redes */}
          <div className="flex flex-col items-center justify-center gap-8 text-center md:items-start md:text-left">
            <div>
              <h3 className="font-display text-2xl tracking-wide text-brand-yellow">
                ¿Cómo llegar?
              </h3>
              <p className="mt-2 max-w-sm text-sm text-white/80">
                Estamos en {siteConfig.address.display}. Abre el mapa y déjate
                guiar hasta el sabor.
              </p>
              <a
                href={siteConfig.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-block rounded-full bg-brand-red px-8 py-3.5 font-semibold text-white shadow-lg shadow-black/20 transition-all duration-300 hover:scale-105 hover:bg-[#b51226]"
              >
                Abrir en Google Maps
              </a>
            </div>

            <div>
              <h3 className="font-display text-2xl tracking-wide text-brand-yellow">
                Síguenos
              </h3>
              <div className="mt-4 flex gap-3">
                {siteConfig.socials.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-all duration-300 hover:scale-110 hover:bg-brand-yellow hover:text-brand-blue"
                  >
                    <SocialIcon name={social.name} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/60">
        © {year} {siteConfig.fullName} — {siteConfig.address.display}. Hecho
        con ❤️ por una familia venezolana-peruana.
      </div>

      {/* Franja tricolor: remate visual del footer */}
      <TricolorBar className="h-2" />
    </footer>
  );
}
