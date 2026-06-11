import About from "@/components/sections/About";
import AlboradaFeature from "@/components/sections/AlboradaFeature";
import DeliveryBar from "@/components/sections/DeliveryBar";
import Features from "@/components/sections/Features";
import TequenosFeature from "@/components/sections/TequenosFeature";
import Footer from "@/components/sections/Footer";
import Gallery from "@/components/sections/Gallery";
import GoogleReviews from "@/components/sections/GoogleReviews";
import Hero from "@/components/sections/Hero";
import Navbar from "@/components/sections/Navbar";
import PizzaBuilder from "@/components/sections/PizzaBuilder";
import PizzaShowcase from "@/components/sections/PizzaShowcase";
import CursorGlow from "@/components/ui/CursorGlow";
import FloatingWhatsApp from "@/components/ui/FloatingWhatsApp";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <DeliveryBar />
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
        <AlboradaFeature />
        <TequenosFeature />
        <PizzaShowcase />
        <Gallery />
        <GoogleReviews />
      </main>
      <Footer />
      <CursorGlow />
      <FloatingWhatsApp />
    </>
  );
}
