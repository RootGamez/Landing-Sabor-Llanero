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
import LegacyMenuRedirect from "@/components/ui/LegacyMenuRedirect";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <DeliveryBar />
        <Features />
        <About />
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
      <LegacyMenuRedirect />
    </>
  );
}
