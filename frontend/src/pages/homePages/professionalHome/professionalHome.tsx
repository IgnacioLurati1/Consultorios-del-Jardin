import { FaCalendarAlt, FaUser, FaClipboardList } from "react-icons/fa";
import HomeCard from "../HomeCard";
import {NavZone} from "../../../components/navZone/NavZone";
import "./professionalHome.css";
import { useEffect, useState } from "react";
import { findPerson, getDecodedToken } from "../../commonServices";
import type { Person } from "../../types";
import { toast, ToastContainer } from "react-toastify";

export function ProfessionalHome() {
  const [professional, setProfessional] = useState<Person | undefined>(undefined);

  useEffect(() => {
  
      const decoded = getDecodedToken();
      if (!decoded) return;
        const email = decoded.email
        findPerson(email)
        .then(data => {
          if (!data) {
          toast.error("No se encontró el profesional");
          return;
          }
          setProfessional(data);
        })
        .catch(err => toast.error(`Error al cargar al profesional: ${err.message}`));
    }, []);
    
  return (
    <div className="professional-home-container-whole">
      <div className="professional-home-container-left">

        <div className="nav-zone-container">
          <NavZone title={`Bienvenido ${professional?.surname}, ${professional?.name}`} /> {/* capaz se consigue el nombre decodificando el token?? !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/}
        </div>
        
        <div className="professional-cards-container">
          <div className="professional-card"><HomeCard icon={FaCalendarAlt} title="Horarios" link="/scheduleProfessional" /></div>
          <div className="professional-card"><HomeCard icon={FaClipboardList} title="Turnos" link="/appointmentsList" /></div>
          <div className="professional-card"><HomeCard icon={FaUser} title="Pacientes" link="/pacientes" /></div>
          <div className="professional-card"><HomeCard icon={FaUser} title="Pacientes" link="/professionalHome" /></div>
        </div>
        
      </div>

      <div className="professional-home-container-right">
        <div className="notifications-section">
          <h2>Notificaciones</h2>

        </div>
      </div>
        <ToastContainer className = {`toast-container`} draggable={false}/>
    </div>
  );
}
