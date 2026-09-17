import { Aurora } from "@/components/aurora";
import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Showcase } from "@/components/landing/showcase";
import { Marquee } from "@/components/landing/marquee";
import { Bento } from "@/components/landing/bento";
import { GraphSection } from "@/components/landing/graph-section";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <>
      <Aurora />
      <Nav />
      <main>
        <Hero />
        <Showcase />
        <Marquee />
        <Bento />
        <GraphSection />
      </main>
      <Footer />
    </>
  );
}
