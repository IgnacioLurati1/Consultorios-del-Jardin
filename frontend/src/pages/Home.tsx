import { useState } from "react";
import carousel1 from "../assets/carouselPhotos/carousel1.jpg";
import carousel2 from "../assets/carouselPhotos/carousel2.jpg";
import carousel3 from "../assets/carouselPhotos/carousel3.jpg";
import carousel4 from "../assets/carouselPhotos/carousel4.jpg";
import carousel5 from "../assets/carouselPhotos/carousel5.jpg";
import presentationPhoto1 from "../assets/presentationPhotos/presentationPhoto1.jpg";
import presentationPhoto2 from "../assets/presentationPhotos/presentationPhoto2.jpg";
import presentationPhoto3 from "../assets/presentationPhotos/presentationPhoto3.jpg";
import "../styles/Home.css";

const LeftArrow = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="black"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 20 8 12 16 4" />
  </svg>
);

const RightArrow = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="black"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="8 20 16 12 8 4" />
  </svg>
);

export function Home() {
  const images: string[] = [
    carousel1,
    carousel2,
    carousel3,
    carousel4,
    carousel5,
  ];
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

      <div className="carousel-container">
        <img
          src={images[currentIndex]}
          alt={`Slide ${currentIndex + 1}`}
          className="carousel-image"
        />

        <div className="carousel-nav">
          <button
            onClick={goToPrevious}
            aria-label="Previous Slide"
            className="nav-button"
          >
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

          <button
            onClick={goToNext}
            aria-label="Next Slide"
            className="nav-button"
          >
            <RightArrow />
          </button>
        </div>
      </div>

      <section className="presentation-section">
        <h1>¿Quienes Somos?</h1>
        <p>Texto de presentación</p>

        <div className="cards-container">
          <div className="card">
            <img src={presentationPhoto1} alt="Quiero atenderme" />
            <h3>Quiero atenderme</h3>
          </div>

          <div className="card">
            <img src={presentationPhoto2} alt="Soy profesional" />
            <h3>Soy profesional</h3>
          </div>

          <div className="card">
            <img src={presentationPhoto3} alt="Contacto" />
            <h3>Contacto</h3>
          </div>
        </div>
      </section>
    </div>
  );
}