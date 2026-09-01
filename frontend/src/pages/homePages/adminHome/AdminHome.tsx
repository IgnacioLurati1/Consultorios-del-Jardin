import { useState } from "react";
import { Link } from "react-router-dom";
import { FaCalendarAlt, FaUser, FaCity, FaDoorOpen, FaPlus, FaClipboardList } from "react-icons/fa";
import { FaChartColumn, FaHouse, FaMountainCity } from "react-icons/fa6";
import { WeekSummary } from "../../agenda/WeekSummary.tsx";
import "../../adminCRUDS/adminPanel.css";
import "./AdminHome.css";

interface MenuEntry {
  icon: React.ComponentType;
  title: string;
  description: string;
  link: string;
}

// Lo que el admin usa todos los días.
const mainEntries: MenuEntry[] = [
  {
    icon: FaCalendarAlt,
    title: "Horarios",
    description: "Agenda semanal de cada profesional y ocupación de los consultorios.",
    link: "/scheduleProfessional",
  },
  {
    icon: FaUser,
    title: "Usuarios",
    description: "Pacientes y profesionales: alta, edición y habilitación.",
    link: "/AdminHome/UsersAdmin",
  },
  {
    icon: FaClipboardList,
    title: "Control",
    description: "Consultar los turnos de un profesional, solo lectura.",
    link: "/AdminHome/Control",
  },
  {
    icon: FaChartColumn,
    title: "Números",
    description: "Facturación y carga del consultorio, y los números de cada profesional.",
    link: "/AdminHome/Analytics",
  },
];

// Datos de catálogo: se cargan una vez y casi no se tocan, así que quedan
// detrás del "+" para no competir con lo de arriba.
const catalogEntries: MenuEntry[] = [
  {
    icon: FaMountainCity,
    title: "Provincias",
    description: "Provincias disponibles en el sistema.",
    link: "/AdminHome/ProvincesAdmin",
  },
  {
    icon: FaCity,
    title: "Localidades",
    description: "Localidades asociadas a cada provincia.",
    link: "/AdminHome/CitiesAdmin",
  },
  {
    icon: FaHouse,
    title: "Sucursales",
    description: "Sedes, con su horario de apertura y cierre.",
    link: "/AdminHome/OfficesAdmin",
  },
  {
    icon: FaDoorOpen,
    title: "Consultorios",
    description: "Consultorios de atención dentro de cada sucursal.",
    link: "/AdminHome/RoomsAdmin",
  },
];

function MenuCard({ entry }: { entry: MenuEntry }) {
  const Icon = entry.icon;

  return (
    <Link className="adm-card adm-enter" to={entry.link}>
      <span className="adm-card-icon">
        <Icon />
      </span>
      <span className="adm-card-title">{entry.title}</span>
      <span className="adm-card-desc">{entry.description}</span>
    </Link>
  );
}

export function AdminHome() {
  const [catalogOpen, setCatalogOpen] = useState(false);

  return (
    <div className="adm-page">
      <header className="adm-header">
        <div className="adm-header-titles">
          <h1 className="adm-title">Panel de administración</h1>
          <p className="adm-subtitle">Consultorios Jardín</p>
        </div>
      </header>

      <section className="adm-card-grid adm-stagger">
        {mainEntries.map((entry) => (
          <MenuCard key={entry.title} entry={entry} />
        ))}
      </section>

      <WeekSummary />

      <button
        type="button"
        className={`adm-section-toggle ${catalogOpen ? "open" : ""}`}
        onClick={() => setCatalogOpen((open) => !open)}
        aria-expanded={catalogOpen}
        aria-controls="adm-catalog"
      >
        <span className="adm-plus">
          <FaPlus />
        </span>
        {catalogOpen ? "Ocultar datos generales" : "Datos generales"}
      </button>

      <div id="adm-catalog" className={`adm-collapsible ${catalogOpen ? "open" : ""}`}>
        <div>
          <div className="adm-collapsible-inner adm-card-grid adm-stagger">
            {catalogEntries.map((entry) => (
              <MenuCard key={entry.title} entry={entry} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
