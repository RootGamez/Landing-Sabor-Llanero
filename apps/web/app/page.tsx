import About from "@/components/sections/About";
import AlboradaFeature from "@/components/sections/AlboradaFeature";
import DeliveryBar from "@/components/sections/DeliveryBar";
import Features from "@/components/sections/Features";
import TequenosFeature from "@/components/sections/TequenosFeature";
import Footer from "@/components/sections/Footer";
import Gallery from "@/components/sections/Gallery";
import GoogleReviews from "@/components/sections/GoogleReviews";
import Hero from "@/components/sections/Hero";
import Menu from "@/components/sections/Menu";
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

        {/* Carta / catálogo dinámico (anchor #menu) — hidrata client-side desde apps/api */}
        <Menu />

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
