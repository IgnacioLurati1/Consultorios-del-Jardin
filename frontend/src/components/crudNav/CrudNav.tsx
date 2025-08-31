import { Link } from "react-router-dom";
import "./CrudNav.css";

export default function CrudNav() {
  return (
  
  <section className="crud-nav">
    <nav className="crud-nav-items">
        <div className="crud-nav-item"><Link className="crud-nav-link" to="/AdminHome/ProvincesAdmin">Provinces</Link></div>
        <div className="crud-nav-item"><Link className="crud-nav-link" to="/AdminHome/CitiesAdmin">Cities</Link></div>
        <div className="crud-nav-item"><Link className="crud-nav-link" to="/AdminHome/OfficesAdmin">Offices</Link></div>
        <div className="crud-nav-item"><Link className="crud-nav-link" to="/AdminHome/RoomsAdmin">Rooms</Link></div>
    </nav>
  </section>
  );
}
