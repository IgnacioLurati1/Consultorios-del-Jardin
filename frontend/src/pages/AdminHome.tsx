import "../styles/AdminHome.css";
import {AdminCard} from "../components/AdminCard";
import Logo from '../assets/LogoRecortado.png';


export function AdminHome() {
  return (
    <div className ="admin-home">
        <h1>Admin Home</h1>
        <div className="options-container">
          <AdminCard
            title="Administrar provincias"
            description="Añadir, eliminar o modificar provincias."
            imageUrl={Logo}
            link="/admin/provinces"
          />
          <AdminCard
            title="Administrar localidades"
            description="Añadir, eliminar o modificar localidades."
            imageUrl={Logo}
            link="/admin/cities"
          />
          <AdminCard
            title="Administrar usuarios"
            description="Añadir, eliminar o modificar usuarios."
            imageUrl={Logo}
            link="/admin/people"
          />
    
        </div>
    </div>
  );
}
