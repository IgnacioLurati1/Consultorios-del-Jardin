import { HolidayGarland } from "../../../components/decor/HolidayDecor";
import { useState } from "react";
import { Link } from "react-router-dom";
import { FaCalendarAlt, FaUser, FaCity, FaDoorOpen, FaPlus, FaClipboardList, FaMoneyBillWave } from "react-icons/fa";
import { FaArrowRight, FaChartColumn, FaHouse, FaMountainCity, FaSliders } from "react-icons/fa6";
import { WeekSummary } from "../../agenda/WeekSummary.tsx";
import { AnnouncementComposer } from "../../announcements/AnnouncementComposer.tsx";
import "../../adminCRUDS/adminPanel.css";
import { useSimpleText } from "../../../lib/textMode.ts";
import "./AdminHome.css";
import { useOfficeName, usePolicies, useWords } from "../../../lib/installation.ts";
import type { Words } from "../../../lib/vocabulary.ts";

interface MenuEntry {
  icon: React.ComponentType;
  title: string;
  description: string;
  link: string;
}

// Lo que el admin usa todos los días.
function mainEntries(w: Words, reception = false): MenuEntry[] {
  return [
    {
      icon: FaCalendarAlt,
      title: "Horarios",
      description: `Agenda semanal de cada ${w.profesional} y ocupación de ${w.los("sala")}.`,
      link: "/scheduleProfessional",
    },
    {
      icon: FaUser,
      title: "Usuarios",
      description: `${w.Pacientes} y ${w.profesionales}. Alta, edición y habilitación.`,
      link: "/AdminHome/UsersAdmin",
    },
    {
      icon: FaClipboardList,
      title: "Control",
      // Con recepción, Control deja de ser de solo lectura: ahí se trabaja la agenda.
      description: reception
        ? `Dar, mover y cancelar ${w.los("turno")} en la agenda de cada ${w.profesional}.`
        : `Consultar ${w.los("turno")} de ${w.un("profesional")}, solo lectura.`,
      link: "/AdminHome/Control",
    },
    {
      icon: FaChartColumn,
      title: "Números",
      description: `Facturación y carga ${w.del("lugar")}, y los números de cada ${w.profesional}.`,
      link: "/AdminHome/Analytics",
    },
    {
      icon: FaMoneyBillWave,
      title: "Alquileres",
      description: `Cuotas de cada ${w.profesional}, pagos, aumentos y precios de ${w.los("sala")}.`,
      link: "/AdminHome/Alquileres",
    },
  ];
}

// Datos de catálogo: se cargan una vez y casi no se tocan, así que quedan
// detrás del "+" para no competir con lo de arriba.
function catalogEntries(w: Words): MenuEntry[] {
  return [
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
      title: w.Sucursales,
      description: "Sedes, con su horario de apertura y cierre.",
      link: "/AdminHome/OfficesAdmin",
    },
    {
      icon: FaDoorOpen,
      title: w.Salas,
      description: `${w.Salas} de atención dentro de cada ${w.sucursal}.`,
      link: "/AdminHome/RoomsAdmin",
    },
  ];
}

function MenuCard({ entry }: { entry: MenuEntry }) {
  const Icon = entry.icon;
  const [simple] = useSimpleText();

  return (
    <Link className="adm-card adm-enter" to={entry.link}>
      <span className="adm-card-icon">
        <Icon />
      </span>
      <span className="adm-card-title">{entry.title}</span>
      {!simple && <span className="adm-card-desc">{entry.description}</span>}
    </Link>
  );
}

export function AdminHome() {
  const w = useWords();
  const policies = usePolicies();
  const officeName = useOfficeName();
  const [catalogOpen, setCatalogOpen] = useState(false);

  return (
    <>
      <HolidayGarland row />
      <div className="adm-page">
        <header className="adm-header">
          <div className="adm-header-titles">
            <h1 className="adm-title">Panel de administración</h1>
            <p className="adm-subtitle">{officeName}</p>
          </div>
        </header>

        <section className="adm-card-grid adm-card-grid-main adm-stagger">
          {mainEntries(w, policies.adminBooking)
            .filter((entry) => entry.link !== "/AdminHome/Alquileres" || policies.rentModule)
            .map((entry) => (
            <MenuCard key={entry.title} entry={entry} />
          ))}
        </section>

        <WeekSummary />

        {/* Entre cómo viene la semana y los datos generales: es lo que se hace después de
            mirar cómo viene el consultorio y antes de irse a tocar catálogos. */}
        <AnnouncementComposer />

        <button
          type="button"
          className={`adm-section-toggle adm-section-wide ${catalogOpen ? "open" : ""}`}
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
              {catalogEntries(w).map((entry) => (
                <MenuCard key={entry.title} entry={entry} />
              ))}
            </div>
          </div>
        </div>

        {/* La configuración se toca poco, como los datos generales: va con ellos, abajo, y
            no como una tarjeta más entre lo de todos los días. */}
        <Link className="adm-section-toggle adm-section-wide adm-section-link" to="/AdminHome/Configuracion">
          <span className="adm-plus">
            <FaSliders />
          </span>
          Configuración
          <FaArrowRight className="adm-section-arrow" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
