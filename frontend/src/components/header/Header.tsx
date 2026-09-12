import { useState } from "react";
import { Link } from "react-router-dom";
import { FaBars } from "react-icons/fa6";
import { Session } from "./session/Session";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "../notifications/NotificationBell";
import { LateralMenu } from "../defaultLayout/lateralMenu/LateralMenu";
import LogoHojas from "../../assets/LogoHojasRecortado.PNG";
import "./Header.css";

const menuItems = [
  { faviconName: "home", title: "Inicio", path: "/", userType: "all" },
  // Sin sesión, "Iniciar sesión" no va en el menú: ya está siempre a la vista en la barra,
  // también en el celular, y repetido acá abajo se leía como dos cosas distintas.
  // Los dos que siguen son para profesionales. "Login profesional" lleva al mismo login
  // que el de la barra: la cuenta decide qué panel se abre, pero quien viene a trabajar
  // busca un acceso con su nombre y sin él se pierde en "Iniciar sesión".
  { faviconName: "professional", title: "Login profesional", path: "/Login", userType: "guest" },
  { faviconName: "work", title: "Quiero trabajar acá", path: "/contacto?motivo=profesional", userType: "guest" },
  { faviconName: "database", title: "Panel de administración", path: "/AdminHome", userType: "admin" },
  { faviconName: "professional", title: "Panel del profesional", path: "/ProfessionalHome", userType: "professional" },
  { faviconName: "appointments", title: "Mis turnos", path: "/AppointmentsList", userType: "client" },
  { faviconName: "requestAppointments", title: "Solicitar turno", path: "/Appointment", userType: "client" },
  { faviconName: "appointments", title: "Turnos", path: "/AppointmentsList", userType: "professional" },
  // El profesional también se atiende: pide turno como cualquier otro paciente, con la
  // única diferencia de que no puede elegirse a sí mismo. Dice "propio" y no "Solicitar
  // turno" a secas como el del paciente porque del lado del profesional el menú entero
  // habla de los turnos que da, y ahí se leería como dárselo a alguien.
  { faviconName: "requestAppointments", title: "Solicitar turno propio", path: "/Appointment", userType: "professional" },
  { faviconName: "calendar", title: "Horarios", path: "/scheduleProfessional", userType: "professional" },
  // Solo para quien viene a atenderse. Un profesional o un admin no necesitan que les
  // expliquen dónde queda el consultorio.
  { faviconName: "faq", title: "Preguntas frecuentes", path: "/preguntas", userType: "guest" },
  { faviconName: "faq", title: "Preguntas frecuentes", path: "/preguntas", userType: "client" },
  { faviconName: "phone", title: "Contacto", path: "/contacto", userType: "all" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((open) => !open);

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <button type="button" className="app-header-menu" onClick={toggleMenu} aria-label="Abrir menú">
            <FaBars />
          </button>

          <Link className="app-header-brand" to="/">
            <img src={LogoHojas} alt="" className="app-header-logo" />
            <span className="app-header-name">Consultorios del Jardín</span>
          </Link>

          <ThemeToggle />
          <NotificationBell />
          <Session />
        </div>
      </header>

      {isMenuOpen && <div className="app-backdrop" onClick={toggleMenu} />}
      <LateralMenu isOpen={isMenuOpen} items={menuItems} onClose={toggleMenu} />
    </>
  );
}
