import { useState } from "react";
import { Link } from "react-router-dom";
import { FaBars } from "react-icons/fa6";
import { Session } from "./session/Session";
import { ThemeToggle } from "./ThemeToggle";
import { LateralMenu } from "../defaultLayout/lateralMenu/LateralMenu";
import LogoHojas from "../../assets/LogoHojasRecortado.PNG";
import "./Header.css";

const menuItems = [
  { faviconName: "home", title: "Inicio", path: "/", userType: "all" },
  { faviconName: "user", title: "Iniciar sesión", path: "/Login", userType: "guest" },
  { faviconName: "database", title: "Panel de administración", path: "/AdminHome", userType: "admin" },
  { faviconName: "professional", title: "Panel del profesional", path: "/ProfessionalHome", userType: "professional" },
  { faviconName: "appointments", title: "Mis turnos", path: "/AppointmentsList", userType: "client" },
  { faviconName: "requestAppointments", title: "Pedir un turno", path: "/Appointment", userType: "client" },
  { faviconName: "appointments", title: "Turnos", path: "/AppointmentsList", userType: "professional" },
  // El profesional también se atiende: pide turno como cualquier otro paciente,
  // con la única diferencia de que no puede elegirse a sí mismo.
  { faviconName: "requestAppointments", title: "Pedir un turno", path: "/Appointment", userType: "professional" },
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
          <Session />
        </div>
      </header>

      {isMenuOpen && <div className="app-backdrop" onClick={toggleMenu} />}
      <LateralMenu isOpen={isMenuOpen} items={menuItems} onClose={toggleMenu} />
    </>
  );
}
