import "./Section.css";

import peopleImg from "../../../../assets/HomePhotos/HomeSectionsPhotos/people.jpg";
import professionalImg from "../../../../assets/HomePhotos/HomeSectionsPhotos/professional.jpg";
import informationImg from "../../../../assets/HomePhotos/HomeSectionsPhotos/information.jpg";

import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export function Section() {
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.18 }
    );

    const sections = document.querySelectorAll(".section");
    sections.forEach((s) => observer.observe(s));

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="section">
        <div className="section-image">
          <img src={peopleImg} alt="¿Quiénes somos?" />
        </div>
        <div className="section-content">
          <h2>¿Quiénes somos?</h2>
          <p>
            En Consultorios del Jardín ofrecemos consultorios modernos para profesionales 
            y espacios flexibles para actividades grupales.
          </p>
        </div>
      </div>

      <div className="section reverse">
        <div className="section-image">
          <img src={professionalImg} alt="¡Quiero Atenderme!" />
        </div>
        <div className="section-content">
          <h2>¡Quiero Atenderme!</h2>
          <button onClick={() => navigate("*")}>
            Turnos disponibles
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-image">
          <img src={informationImg} alt="¿Todavía no tenés cuenta?" />
        </div>
        <div className="section-content">
          <h2>¿Todavía no tenés cuenta?</h2>
          <button onClick={() => navigate("/register")}>
            Registrar cuenta
          </button>
        </div>
      </div>
    </>
  );
}