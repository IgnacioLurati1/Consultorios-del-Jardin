import "./AdminHome.css";
import {AdminCard} from ".//AdminCard";
import Logo from '../../assets/LogoRecortado.png';
import {NavZone} from "../../components/navZone/NavZone";

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
            link="./ProvincesAdmin"
          />
          <AdminCard
            title="Administrar localidades"
            description="Añadir, eliminar o modificar localidades."
            imageUrl={Logo}
            link="/CitiesAdmin"
          />

          <AdminCard
            title="Administrar consultorios"
            description="Añadir, eliminar o modificar consultorios."
            imageUrl={Logo}
            link="/OfficesAdmin"
            />

          <AdminCard
            title="Administrar usuarios"
            description="Añadir, eliminar o modificar usuarios."
            imageUrl={Logo}
            link="/PeopleAdmin"
          />
    
        </div>
    </div>

  );
}
