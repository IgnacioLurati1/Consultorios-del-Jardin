import { Link } from "react-router-dom";
import { FaClock, FaDoorOpen, FaEnvelope, FaInstagram, FaLocationDot, FaPhone, FaWhatsapp } from "react-icons/fa6";
import { applicationLabel, phoneHref, whatsappHref } from "../../../../lib/contentLists";
import LogoHojas from "../../../../assets/LogoHojasRecortado.PNG";
import { useDesktop } from "../../../../components/entrance/useDesktop";
import { fullAddress, useHomeVariant, useInstallation, useWords } from "../../../../lib/installation";

/**
 * El pie de la portada, en uno de tres diseños (ver HOME_VARIANTS en lib/installation):
 * completo, el de siempre; columnas, cada parte con su título; y centrado, todo al medio
 * en pocos renglones. Lo que dice es lo mismo en los tres.
 */
export function Footer() {
  const w = useWords();
  const variant = useHomeVariant("footer");
  const headed = variant === "columns";
  const desktop = useDesktop();
  const installation = useInstallation();
  const instagram = installation.instagram.replace(/^@/, "");
  // Con el motivo oculto en el formulario, el link no tiene a dónde llevar.
  const application = applicationLabel(installation.contactReasons, w);

  // Los datos de contacto salen de la configuración del consultorio. El que no está
  // cargado no aparece: un pie con un renglón vacío o un link a ninguna parte se ve roto.
  const contact = [
    { icon: FaLocationDot, text: fullAddress(installation) },
    { icon: FaClock, text: installation.publicHours },
    { icon: FaPhone, text: installation.phone, href: installation.phone ? phoneHref(installation.phone) : undefined },
    {
      icon: FaWhatsapp,
      text: installation.whatsapp ? "WhatsApp" : "",
      href: installation.whatsapp ? whatsappHref(installation.whatsapp) : undefined,
      external: true,
    },
    { icon: FaEnvelope, text: installation.email, href: installation.email ? `mailto:${installation.email}` : undefined },
    {
      icon: FaInstagram,
      text: instagram ? `@${instagram}` : "",
      href: instagram ? `https://instagram.com/${instagram}` : undefined,
      external: true,
    },
  ].filter((item) => item.text);

  return (
    <footer className={`home-footer home-footer--${variant}`}>
      <div className="home-footer-inner">
        <div className="home-footer-brand">
          <img src={LogoHojas} alt="" className="home-footer-logo" />
          <div>
            <p className="home-footer-name">{installation.name}</p>
            {/* De la misma lista que usa el pedido de turno: si se suma una especialidad,
                aparece acá sin tocar el pie. */}
            <p className="home-footer-claim">{installation.services.join(" · ")}</p>
            <p className="home-footer-credit">
              Powered by{" "}
              <a href="https://www.instagram.com/nacho_lurati/" target="_blank" rel="noreferrer">
                El Luta
              </a>
            </p>
          </div>
        </div>

        <div className="home-footer-col">
          {headed && <h3 className="home-footer-heading">Contacto</h3>}
          <ul className="home-footer-contact">
            {contact.map((item) => {
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
                computadora, y solo en el consultorio que lo tiene: está modelado a mano. */}
            {desktop && installation.spaceTour ? (
              <li>
                <FaDoorOpen aria-hidden="true" />
                <Link to="/espacio">Visualizar espacio</Link>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="home-footer-col">
          {headed && <h3 className="home-footer-heading">Accesos</h3>}
          <nav className="home-footer-links" aria-label="Accesos">
            {installation.policies.patientBooking ? <Link to="/Appointment">Solicitar {w.turno}</Link> : null}
            <Link to="/AppointmentsList">Mis {w.turnos}</Link>
            <Link to="/preguntas">Preguntas frecuentes</Link>
            <Link to="/contacto">Contacto</Link>
            {application ? <Link to="/contacto?motivo=profesional">{application}</Link> : null}
            <Link to="/Login">Iniciar sesión</Link>
            <Link to="/Register">Crear cuenta</Link>
          </nav>
        </div>
      </div>

      {/* El año sale del reloj: escrito a mano, el 1 de enero el pie pasaba a mentir. */}
      <p className="home-footer-legal">
        © {new Date().getFullYear()} {installation.name} · Todos los derechos reservados
      </p>
    </footer>
  );
}
