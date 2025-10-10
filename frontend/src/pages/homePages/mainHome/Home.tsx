import "./Home.css";
import { Hero } from "./HomeComponents/Hero";
import { Marquee } from "./HomeComponents/Marquee";
import { Section } from "./HomeComponents/Section";
import { Cards } from "./HomeComponents/Cards";
import { Footer } from "./HomeComponents/Footer";
import { useFadeIn } from ".//useFadeIn";

export function Home() {
  const marqueeFade = useFadeIn();
  const sectionFade = useFadeIn();
  const cardsFade = useFadeIn();

  return (
    <div>
      <div>
        <Hero />
      </div>

      <div ref={marqueeFade.ref} className={`fade-in-section ${marqueeFade.isVisible ? "is-visible" : ""}`}>
        <Marquee />
      </div>

      <div ref={sectionFade.ref} className={`fade-in-section ${sectionFade.isVisible ? "is-visible" : ""}`}>
        <Section />
      </div>

      <div ref={cardsFade.ref} className={`fade-in-section ${cardsFade.isVisible ? "is-visible" : ""}`}>
        <Cards />
      </div>

      <div>
        <Footer />
      </div>
    </div>
  );
}