import { FaCalendarAlt, FaUser, FaCity, FaDoorOpen} from "react-icons/fa";
import HomeCard from "../HomeCard";
import {NavZone} from "../../../components/navZone/NavZone";
import "./AdminHome.css";
import { FaHouse, FaMountainCity } from "react-icons/fa6";

export function AdminHome() {
  return (
    <div className="admin-home-container-whole">

        <div className="nav-zone-container">
          <NavZone title="Menu Administrador" />
        </div>
        
        <div>
          <div className="admin-cards-container">
            <div className="admin-card">
                <HomeCard icon={FaMountainCity} title="Provincias" link="ProvincesAdmin" />
            </div>
            <div className="admin-card">
                <HomeCard icon={FaCity} title="Localidades" link="CitiesAdmin" />
            </div>
            <div className="admin-card">
            <HomeCard icon={FaHouse} title="Consultorios" link="OfficesAdmin" />
            </div>
            <div className="admin-card">
            <HomeCard icon={FaDoorOpen} title="Salas" link="RoomsAdmin" />
            </div>
            <div className="admin-card">
            <HomeCard icon={FaCalendarAlt} title="Horarios" link="/scheduleProfessional" />
            </div>
            <div className="admin-card">
            <HomeCard icon={FaUser} title="Usuarios" link="usersAdmin" />
            </div>
          </div>

        </div>
    
    </div>
  );
}
