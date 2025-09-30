import { Link } from "react-router-dom";
import "./CrudNav.css";
import { FaArrowUp } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getDecodedToken } from "../../pages/commonServices";

function Translate(text: string){
  const Translation: { [key: string]: string } = {
    Provinces: "Provincias",
    Cities: "Localidades",
    Offices: "Oficinas",
    Users: "Usuarios",
    Rooms: "Salas",
    ScheduleProfessional:"Horarios"
  };
    return Translation[text];
}


export default function CrudNav() {
  const initialChilds = ["ProvincesAdmin", "CitiesAdmin", "OfficesAdmin", "RoomsAdmin", "UsersAdmin","ScheduleProfessional"];
  const pathSegments = useLocation().pathname.split("/").filter(Boolean); //separa por / ignorando espacios en blanco
  const location = pathSegments[pathSegments.length - 1];  //selecciona ultimo elemento del path dividido
  const [childs, setChilds] = useState<string[]>(initialChilds);
  const actualLocation = useLocation();
  const isRoot = actualLocation.pathname.toLowerCase() === "/adminhome";

  useEffect(() => {
    setChilds(initialChilds.filter((child) => child !== location));
  }, [location]);

  const decoded = getDecodedToken();
  if(decoded){
    if (decoded.type ==="admin" && !isRoot){
      return (
        <section className="crud-nav">
          <div className="crud-nav-up"><FaArrowUp className="crud-nav-arrow" /></div>
          <nav className="crud-nav-items">

          {childs.map((child) => (
            <div className="crud-nav-item" key={child}>
              <Link className="crud-nav-link" to={
              child ==="ScheduleProfessional" ? `/${child}` : `/AdminHome/${child}`}>
              <strong>{Translate(child.replace("Admin", ""))}</strong>
              </Link>
            </div>

          ))}
    </nav>
  </section>
  );
}
    }
  }

  
  
