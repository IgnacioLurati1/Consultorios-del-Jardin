import { FaCalendarAlt, FaUser, FaClipboardList } from "react-icons/fa";
import HomeCard from "../HomeCard";
import {NavZone} from "../../../components/navZone/NavZone";
import "./professionalHome.css";

export function ProfessionalHome() {
  return (
    <div className="professional-home-container-whole">
      <div className="professional-home-container-left">

        <div className="nav-zone-container">
          <NavZone title="Bienvenido -Nombre del profesional-" /> {/* capaz se consigue el nombre decodificando el token?? !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/}
        </div>
        
        <div className="professional-cards-container">
          <div className="professional-card"><HomeCard icon={FaCalendarAlt} title="Horarios" link="/scheduleProfessional" /></div>
          <div className="professional-card"><HomeCard icon={FaClipboardList} title="Turnos" link="/turnos" /></div>
          <div className="professional-card"><HomeCard icon={FaUser} title="Pacientes" link="/pacientes" /></div>
          <div className="professional-card"><HomeCard icon={FaUser} title="Pacientes" link="/professionalHome" /></div>
        </div>
        
      </div>

      <div className="professional-home-container-right">
        <div className="notifications-section">
          <h2>Notificaciones</h2>

        </div>
      </div>
    </div>
  );
}
