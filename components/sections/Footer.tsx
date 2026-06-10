import TricolorBar from "@/components/ui/TricolorBar";
import {
  ClockIcon,
  FacebookIcon,
  InstagramIcon,
  MapPinIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/ui/icons";
import { businessHoursOrdered } from "@/lib/businessHours";
import { siteConfig } from "@/lib/siteConfig";

const socialIcons = {
  Instagram: InstagramIcon,
  Facebook: FacebookIcon,
  WhatsApp: WhatsAppIcon,
} as const;

/**
 * Footer "Visítanos": horarios desde lib/businessHours.ts (única
 * fuente de verdad), contacto, mapa, redes y remate tricolor.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="ubicacion" className="bg-brand-blue-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-24">
        <div className="text-center">
          <span className="mb-3 inline-block rounded-full bg-brand-yellow/15 px-4 py-1 text-xs font-semibold tracking-[0.2em] text-brand-yellow uppercase">
            Ubicación y contacto
          </span>
          <h2 className="font-display text-5xl tracking-wide md:text-6xl">Visítanos</h2>
          <div
            className="mx-auto mt-4 flex h-1.5 w-28 overflow-hidden rounded-full"
            aria-hidden="true"
          >
            <span className="flex-1 bg-brand-yellow" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-brand-red" />
          </div>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-16">
          {/* Columna izquierda: horarios y contacto */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm md:p-9">
            <h3 className="flex items-center gap-2.5 font-display text-2xl tracking-wide text-brand-yellow">
              <ClockIcon className="h-5 w-5" />
              Horarios de atención
            </h3>
            <ul className="mt-5 divide-y divide-white/8">
              {businessHoursOrdered.map((d) => (
                <li
                  key={d.day}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="font-medium">{d.label}</span>
                  {d.open && d.close ? (
                    <span className="font-mono text-white/80 tabular-nums">
                      {d.open} – {d.close}
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-red/20 px-3 py-0.5 text-xs font-semibold text-red-300">
                      Cerrado
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-7 space-y-3.5 border-t border-white/10 pt-6 text-sm">
              <a
                href={siteConfig.phoneHref}
                className="flex items-center gap-3 font-semibold transition-colors hover:text-brand-yellow"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-yellow/15 text-brand-yellow">
                  <PhoneIcon className="h-4 w-4" />
                </span>
                {siteConfig.phone}
              </a>
              <p className="flex items-center gap-3 text-white/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-red/20 text-red-300">
                  <MapPinIcon className="h-4 w-4" />
                </span>
                {siteConfig.address.street}, {siteConfig.address.display}
              </p>
            </div>
          </div>

          {/* Columna derecha: mapa y redes */}
          <div className="flex flex-col justify-center gap-10 text-center md:text-left">
            <div>
              <h3 className="font-display text-2xl tracking-wide text-brand-yellow">
                ¿Cómo llegar?
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-white/70 md:mx-0">
                Estamos en {siteConfig.address.display}. Abre el mapa y déjate
                guiar hasta el sabor.
              </p>
              <a
                href={siteConfig.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shine mt-6 inline-flex items-center gap-2.5 rounded-full bg-brand-red px-9 py-4 font-semibold text-white shadow-glow-red transition-all duration-300 hover:scale-[1.04] hover:bg-brand-red-deep active:scale-95"
              >
                <MapPinIcon className="h-5 w-5" />
                Abrir en Google Maps
              </a>
            </div>

            <div>
              <h3 className="font-display text-2xl tracking-wide text-brand-yellow">
                Síguenos
              </h3>
              <div className="mt-4 flex justify-center gap-3 md:justify-start">
                {siteConfig.socials.map((social) => {
                  const Icon = socialIcons[social.name];
                  return (
                    <a
                      key={social.name}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.name}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 transition-all duration-300 hover:scale-110 hover:border-brand-yellow hover:bg-brand-yellow hover:text-brand-blue-ink"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/8 py-6 text-center text-xs text-white/50">
        © {year} {siteConfig.fullName} — {siteConfig.address.display}. Hecho con
        cariño por una familia venezolana-peruana.
      </div>

      {/* Franja tricolor: remate visual del footer */}
      <TricolorBar className="h-2" />
    </footer>
  );
}
