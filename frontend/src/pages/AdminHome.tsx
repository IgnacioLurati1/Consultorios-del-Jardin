import "../styles/AdminHome.css";
import {AdminCard} from "../components/AdminCard";
import Logo from '../assets/LogoRecortado.png';
import {NavZone} from "../components/NavZone";

// FALTA VALIDACIONES DE SEGURIDAD EN EL ENRUTAMIENTO!!!!
export function AdminHome() {
  return (
     
    <div className ="admin-home"> 
        <NavZone title="Inicio de sesión" />

        <div className="options-container">
          <AdminCard
            title="Administrar provincias"
            description="Añadir, eliminar o modificar provincias."
            imageUrl={Logo}
            link="/provincesAdmin"
          />
          <AdminCard
            title="Administrar localidades"
            description="Añadir, eliminar o modificar localidades."
            imageUrl={Logo}
            link="/citiesAdmin"
          />
          <AdminCard
            title="Administrar usuarios"
            description="Añadir, eliminar o modificar usuarios."
            imageUrl={Logo}
            link="/peopleAdmin"
          />
    
        </div>
    </div>

  );
}
