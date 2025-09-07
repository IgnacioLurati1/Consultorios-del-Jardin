import { FaCalendarAlt, FaUser, FaClipboardList } from "react-icons/fa";
import ProfessionalCard from "./professionalCard";
import {NavZone} from "../../components/navZone/NavZone";
import "./professionalHome.css";

export function ProfessionalHome() {
  return (
    <div className="professional-home-container-whole">
      <div className="professional-home-container-left">

        <div className="nav-zone-container">
          <NavZone title="Bienvenido -Nombre del profesional-" /> {/* capaz se consigue el nombre decodificando el token?? !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/}
        </div>
        
        <div>
          <div className="professional-cards-container">
            <ProfessionalCard icon={FaCalendarAlt} title="Horarios" link="/scheduleProfessional" /> {/*CHEQUEAR SI ESTO ES SEGURO !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/}
            <ProfessionalCard icon={FaClipboardList} title="Turnos" link="/turnos" />
            <ProfessionalCard icon={FaUser} title="Pacientes" link="/pacientes" />
            <ProfessionalCard icon={FaUser} title="Pacientes" link="/professionalHome" />
          </div>
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
