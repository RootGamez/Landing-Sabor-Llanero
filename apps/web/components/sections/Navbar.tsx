"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";
import TricolorBar from "@/components/ui/TricolorBar";
import { WhatsAppIcon } from "@/components/ui/icons";

interface NavbarProps {
  /** Fuerza el estado sólido desde el inicio (páginas sin hero oscuro, ej. /menu) */
  solid?: boolean;
}

/**
 * Navbar sticky: transparente sobre el hero, blanco con sombra al
 * hacer scroll. En móvil abre un drawer animado.
 */
export default function Navbar({ solid: alwaysSolid = false }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Sólido forzado: el estado scrolled nunca se consulta, no escuchamos scroll
    if (alwaysSolid) return;
    const onScroll = (): void => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [alwaysSolid]);

  // Bloquea el scroll del body mientras el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const solid = alwaysSolid || scrolled || menuOpen;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <nav
        className={`transition-all duration-300 ${
          solid ? "bg-white/90 shadow-lg shadow-brand-blue/5 backdrop-blur-md" : "bg-transparent"
        }`}
        aria-label="Navegación principal"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:h-[4.5rem] md:px-6">
          {/* Logo (placeholder de texto en Bangers) */}
          <Link
            href="/#inicio"
            className={`flex items-center gap-2.5 font-display text-2xl tracking-wider transition-colors md:text-3xl ${
              solid ? "text-brand-blue" : "text-white"
            }`}
            onClick={() => setMenuOpen(false)}
          >
            {/* Logo real de la marca */}
            <Image
              src={siteConfig.media.logo}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white/40"
            />
            Sabor <span className="text-brand-red">Llanero</span>
          </Link>

          {/* Links desktop */}
          <ul className="hidden items-center gap-7 md:flex">
            {siteConfig.navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`group relative text-sm font-medium transition-colors ${
                    solid ? "text-ink hover:text-brand-red" : "text-white hover:text-brand-yellow"
                  }`}
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-brand-red transition-all duration-300 group-hover:w-full" />
                </Link>
              </li>
            ))}
            <li>
              <a
                href={siteConfig.whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-105 hover:bg-brand-red-deep active:scale-95"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Pedir ahora
              </a>
            </li>
          </ul>

          {/* Botón hamburguesa (móvil) */}
          <button
            type="button"
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span
              className={`h-0.5 w-6 rounded transition-all duration-300 ${
                solid ? "bg-ink" : "bg-white"
              } ${menuOpen ? "translate-y-2 rotate-45" : ""}`}
            />
            <span
              className={`h-0.5 w-6 rounded transition-all duration-300 ${
                solid ? "bg-ink" : "bg-white"
              } ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`h-0.5 w-6 rounded transition-all duration-300 ${
                solid ? "bg-ink" : "bg-white"
              } ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </button>
        </div>

        {/* Línea tricolor de marca como borde inferior */}
        <TricolorBar className="h-1" />
      </nav>

      {/* Drawer móvil */}
      <div
        className={`fixed inset-x-0 top-[4.25rem] bottom-0 z-40 bg-white transition-all duration-300 md:hidden ${
          menuOpen ? "visible translate-x-0 opacity-100" : "invisible translate-x-full opacity-0"
        }`}
      >
        <ul className="flex flex-col gap-1 px-6 py-8">
          {siteConfig.navLinks.map((link, i) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-xl px-4 py-3.5 text-lg font-medium text-ink transition-colors hover:bg-surface hover:text-brand-red"
                style={{ transitionDelay: `${i * 30}ms` }}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="mt-4">
            <a
              href={siteConfig.whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl bg-brand-red px-4 py-3.5 text-center text-lg font-semibold text-white"
              onClick={() => setMenuOpen(false)}
            >
              Escríbenos por WhatsApp
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
