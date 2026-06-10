import About from "@/components/sections/About";
import Features from "@/components/sections/Features";
import Footer from "@/components/sections/Footer";
import Gallery from "@/components/sections/Gallery";
import GoogleReviews from "@/components/sections/GoogleReviews";
import Hero from "@/components/sections/Hero";
import Navbar from "@/components/sections/Navbar";
import PizzaBuilder from "@/components/sections/PizzaBuilder";
import CursorGlow from "@/components/ui/CursorGlow";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <About />

        {/*
          ── FUTURO: sección Menú / Carta ──────────────────────────
          Cuando la carta esté lista, crea components/sections/Menu.tsx
          y móntala aquí. El anchor #menu ya queda reservado:
          <section id="menu"> ... </section>
          Recuerda añadir { label: "Menú", href: "#menu" } a
          siteConfig.navLinks.
          ──────────────────────────────────────────────────────────
        */}

        <PizzaBuilder />
        <Gallery />
        <GoogleReviews />
      </main>
      <Footer />
      <CursorGlow />
      <FloatingWhatsApp />
    </>
  );
}
