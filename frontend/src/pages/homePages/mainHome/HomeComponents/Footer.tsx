import { Link } from "react-router-dom";
import { FaClock, FaDoorOpen, FaEnvelope, FaInstagram, FaLocationDot } from "react-icons/fa6";
import LogoHojas from "../../../../assets/LogoHojasRecortado.PNG";
import { useDesktop } from "../../../../components/entrance/useDesktop";
import { SPECIALITIES } from "../../../specialities";

const CONTACT = [
  { icon: FaLocationDot, text: "9 de Julio 3672, Rosario" },
  { icon: FaClock, text: "Lunes a viernes, de 9 a 20" },
  { icon: FaEnvelope, text: "consultoriosjardinok@gmail.com", href: "mailto:consultoriosjardinok@gmail.com" },
  { icon: FaInstagram, text: "@consultorios_jardin", href: "https://instagram.com/consultorios_jardin", external: true },
];

export function Footer() {
  const desktop = useDesktop();

  return (
    <footer className="home-footer">
      <div className="home-footer-inner">
        <div className="home-footer-brand">
          <img src={LogoHojas} alt="" className="home-footer-logo" />
          <div>
            <p className="home-footer-name">Consultorios del Jardín</p>
            {/* De la misma lista que usa el pedido de turno: si se suma una especialidad,
                aparece acá sin tocar el pie. */}
            <p className="home-footer-claim">{SPECIALITIES.join(" · ")}</p>
            <p className="home-footer-credit">
              Powered by{" "}
              <a href="https://www.instagram.com/nacho_lurati/" target="_blank" rel="noreferrer">
                El Luta
              </a>
            </p>
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
          {/* El hall en 3D, el mismo del fondo del ingreso pero sin la tarjeta. Solo en la
              computadora: en el celular no está. */}
          {desktop ? (
            <li>
              <FaDoorOpen aria-hidden="true" />
              <Link to="/espacio">Visualizar espacio</Link>
            </li>
          ) : null}
        </ul>

        <nav className="home-footer-links" aria-label="Accesos">
          <Link to="/Appointment">Solicitar turno</Link>
          <Link to="/AppointmentsList">Mis turnos</Link>
          <Link to="/preguntas">Preguntas frecuentes</Link>
          <Link to="/contacto">Contacto</Link>
          <Link to="/contacto?motivo=profesional">Quiero trabajar acá</Link>
          <Link to="/Login">Iniciar sesión</Link>
          <Link to="/Register">Crear cuenta</Link>
        </nav>
      </div>

      <p className="home-footer-legal">© 2026 Consultorios del Jardín · Todos los derechos reservados</p>
    </footer>
  );
}
