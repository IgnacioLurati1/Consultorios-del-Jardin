import { useState, useEffect } from "react";
import { LeftArrow, RightArrow, PresentationCard } from "../components/HomeComponents";


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

  useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      goToPrevious();
    } else if (e.key === "ArrowRight") {
      goToNext();
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, []);


  return (
    <div>
      {/* ======= Carousel (Profesional Slide) ======= */}
      <div className="carousel-container">
        <div
          className="carousel-track"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {images.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Slide ${index + 1}`}
              className="carousel-slide"
            />
          ))}
        </div>

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

      {/* ======= Presentation Cards ======= */}
      <section className="presentation-section">
        <h1>¿Quiénes Somos?</h1>
        <p>
          En Consultorios del Jardín ofrecemos espacios modernos y funcionales dedicados a la medicina y la salud, pensados para profesionales que buscan alquilar consultorios por módulo, día o mes. Además, contamos con áreas habilitadas para actividades grupales, brindando un entorno cómodo y adecuado para el desarrollo de diversas prácticas.
        </p>

        <div className="cards-container">
          <PresentationCard to="/turnos" image={presentationPhoto1} title="Quiero atenderme" />
          <PresentationCard to="/perfilProfesional" image={presentationPhoto2} title="Soy profesional" />
          <PresentationCard to="/contacto" image={presentationPhoto3} title="Contacto" />
        </div>
      </section>
    </div>
  );
}
