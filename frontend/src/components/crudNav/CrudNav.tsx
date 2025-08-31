import { Link } from "react-router-dom";
import "./CrudNav.css";
import { FaArrowUp } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function Translate(text: string){
  const Translation: { [key: string]: string } = {
    Provinces: "Provincias",
    Cities: "Localidades",
    Offices: "Oficinas",
    Users: "Usuarios",
    Rooms: "Salas"
  };
    return Translation[text];
}


export default function CrudNav() {
  const initialChilds = ["ProvincesAdmin", "CitiesAdmin", "OfficesAdmin", "RoomsAdmin", "UsersAdmin"];
  const location = useLocation().pathname.split("/")[2];
  const [childs, setChilds] = useState<string[]>(initialChilds);

  useEffect(() => {
    setChilds(initialChilds.filter((child) => child !== location));
  }, [location]);

  return (
  <section className="crud-nav">
    <div className="crud-nav-up"><FaArrowUp className="crud-nav-arrow" /></div>
    <nav className="crud-nav-items">

      {childs.map((child) => (
        <div className="crud-nav-item" key={child}>
          <Link className="crud-nav-link" to={`/AdminHome/${child}`}>
            <strong>{Translate(child.replace("Admin", ""))}</strong>
          </Link>
        </div>

      ))}
    </nav>
  </section>
  );
}
