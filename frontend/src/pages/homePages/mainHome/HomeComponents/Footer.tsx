import { Link } from "react-router-dom";
import { FaClock, FaEnvelope, FaInstagram, FaLocationDot } from "react-icons/fa6";
import LogoHojas from "../../../../assets/LogoHojasRecortado.PNG";

const CONTACT = [
  { icon: FaLocationDot, text: "9 de Julio 3672" },
  { icon: FaClock, text: "Lunes a viernes, de 9 a 20" },
  { icon: FaEnvelope, text: "consultoriosjardinok@gmail.com", href: "mailto:consultoriosjardinok@gmail.com" },
  { icon: FaInstagram, text: "@consultorios_jardin", href: "https://instagram.com/consultorios_jardin", external: true },
];

export function Footer() {
  return (
    <footer className="home-footer">
      <div className="home-footer-inner">
        <div className="home-footer-brand">
          <img src={LogoHojas} alt="" className="home-footer-logo" />
          <div>
            <p className="home-footer-name">Consultorios del Jardín</p>
            <p className="home-footer-claim">Psicopedagogía, Psicología, Nutrición y Fonoaudiología.</p>
          </div>
        </div>

        <ul className="home-footer-contact">
          {CONTACT.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.text}>
                <Icon aria-hidden="true" />
                {item.href ? (
                  <a href={item.href} {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                    {item.text}
                  </a>
                ) : (
                  item.text
                )}
              </li>
            );
          })}
        </ul>

        <nav className="home-footer-links" aria-label="Accesos">
          <Link to="/Appointment">Pedir un turno</Link>
          <Link to="/AppointmentsList">Mis turnos</Link>
          <Link to="/preguntas">Preguntas frecuentes</Link>
          <Link to="/contacto">Escribinos</Link>
          <Link to="/Login">Iniciar sesión</Link>
          <Link to="/Register">Crear cuenta</Link>
        </nav>
      </div>

      <p className="home-footer-legal">© 2026 Consultorios del Jardín · Todos los derechos reservados</p>
    </footer>
  );
}
