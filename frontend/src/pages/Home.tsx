import { useState } from "react";
import { LeftArrow, RightArrow, PresentationCard } from "../components/homecomponents";


import carousel1 from "../assets/carouselPhotos/carousel1.jpg";
import carousel2 from "../assets/carouselPhotos/carousel2.jpg";
import carousel3 from "../assets/carouselPhotos/carousel3.jpg";
import carousel4 from "../assets/carouselPhotos/carousel4.jpg";
import carousel5 from "../assets/carouselPhotos/carousel5.jpg";

import presentationPhoto1 from "../assets/presentationPhotos/presentationPhoto1.jpg";
import presentationPhoto2 from "../assets/presentationPhotos/presentationPhoto2.jpg";
import presentationPhoto3 from "../assets/presentationPhotos/presentationPhoto3.jpg";

import "../styles/Home.css";

export function Home() {
  const images: string[] = [carousel1, carousel2, carousel3, carousel4, carousel5];
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div>
      {/* ======= Carousel ======= */}
      <div className="carousel-container">
        <img
          src={images[currentIndex]}
          alt={`Slide ${currentIndex + 1}`}
          className="carousel-image"
        />

        <div className="carousel-nav">
          <button onClick={goToPrevious} aria-label="Previous Slide" className="nav-button">
            <LeftArrow />
          </button>

          <div className="carousel-dots">
            {images.map((_, index) => (
              <span
                key={index}
                onClick={() => goToSlide(index)}
                className={`dot ${currentIndex === index ? "active" : ""}`}
                aria-label={`Go to slide ${index + 1}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") goToSlide(index);
                }}
              />
            ))}
          </div>

          <button onClick={goToNext} aria-label="Next Slide" className="nav-button">
            <RightArrow />
          </button>
        </div>
      </div>

      {/* ======= PRESENTATION CARDS ======= */}
      <section className="presentation-section">
        <h1>¿Quiénes Somos?</h1>
        <p>Texto de presentación</p>
        <p>Texto de presentación</p>
        <p>Texto de presentación</p>

        <div className="cards-container">
          <PresentationCard to="/turnos" image={presentationPhoto1} title="Quiero atenderme" />
          <PresentationCard to="/perfilProfesional" image={presentationPhoto2} title="Soy profesional" />
          <PresentationCard to="/contacto" image={presentationPhoto3} title="Contacto" />
        </div>
      </section>
    </div>
  );
}
