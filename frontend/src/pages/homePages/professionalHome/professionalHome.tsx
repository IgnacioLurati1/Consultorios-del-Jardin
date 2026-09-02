import { FaCalendarAlt, FaClipboardList, FaUserInjured } from "react-icons/fa";
import { FaArrowRight, FaChartColumn, FaChevronLeft, FaChevronRight, FaRegClock } from "react-icons/fa6";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import { findPerson, getDecodedToken } from "../../commonServices";
import { findPendingAppointments, findProfessionalAppointmentsInRange } from "../../appointments/appointmentsService.ts";
import { useAppointmentActions } from "../../appointments/useAppointmentActions.ts";
import { AppointmentDetailModal } from "../../appointments/appointmentsList/AppointmentDetailModal.tsx";
import { appointmentDate, describeState, formatDayLabel, shortHour, toISODate } from "../../appointments/appointmentTypes.ts";
import type { Appointment, Person } from "../../types";
import { SkeletonLine } from "../../../components/skeleton/Skeleton";
import { ProfessionalSettings } from "./ProfessionalSettings.tsx";
import { AnnouncementBanner } from "../../announcements/AnnouncementBanner.tsx";
import "../../adminCRUDS/adminPanel.css";
import "./professionalHome.css";

interface MenuEntry {
  icon: React.ComponentType;
  title: string;
  description: string;
  link: string;
}

const entries: MenuEntry[] = [
  {
    icon: FaClipboardList,
    title: "Turnos",
    description: "Agenda de turnos en grilla o en lista, con su estado y su paciente.",
    link: "/AppointmentsList",
  },
  {
    icon: FaCalendarAlt,
    title: "Horarios",
    description: "Tu agenda semanal y la duración de los turnos de cada módulo.",
    link: "/scheduleProfessional",
  },
  {
    icon: FaUserInjured,
    title: "Pacientes",
    description: "Pacientes con cuenta y pacientes anónimos cargados por vos.",
    link: "/Patients",
  },
  {
    icon: FaChartColumn,
    title: "Números",
    description: "Facturación, pacientes y carga de la agenda, mes a mes.",
    link: "/Analytics",
  },
];

export function ProfessionalHome() {
  const [professional, setProfessional] = useState<Person | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<Appointment[] | null>(null);
  const [pending, setPending] = useState<Appointment[] | null>(null);
  const [pendingPage, setPendingPage] = useState(0);

  useEffect(() => {
    const decoded = getDecodedToken();
    if (!decoded) return;

    findPerson(decoded.email)
      .then((data) => {
        if (!data) {
          toast.error("No se encontró el profesional");
          return;
        }
        setProfessional(data);
      })
      .catch((err) => toast.error(`No pudimos cargar tus datos: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  // Agenda del día: se pide el rango de un solo día, sin los cancelados.
  function loadToday() {
    const iso = toISODate(new Date());

    findProfessionalAppointmentsInRange(iso, iso)
      .then((data) => setToday([...data].sort((a, b) => a.initialHour.localeCompare(b.initialHour))))
      .catch(() => setToday([]));
  }

  useEffect(loadToday, []);

  // Los pedidos que esperan respuesta. Se recargan junto con la agenda porque aceptar o
  // rechazar uno cambia las dos listas a la vez.
  function loadPending() {
    findPendingAppointments()
      .then(setPending)
      .catch(() => setPending([]));
  }

  useEffect(loadPending, []);

  function refresh() {
    loadToday();
    loadPending();
  }

  // Tocar un turno de hoy abre la misma ficha que en la lista de turnos: se acepta, se
  // cancela, se carga el registro y se repite igual que allá.
  const { open, detailProps } = useAppointmentActions(professional, refresh);

  const dayLabel = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  // De a cinco. Más que eso deja de ser un aviso arriba del panel y pasa a ser la
  // pantalla de turnos, que ya existe y está a un click.
  const PER_PAGE = 5;
  const pendingCount = pending?.length ?? 0;
  const pendingPages = Math.ceil(pendingCount / PER_PAGE);
  const page = Math.min(pendingPage, Math.max(0, pendingPages - 1));
  const pendingSlice = pending?.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE) ?? [];

  return (
    <div className="adm-page">
      {/* Arriba de todo, antes del saludo: si el consultorio tiene algo que decir, se
          lee antes de ponerse a trabajar y no después de haber hecho las cosas mal. */}
      <AnnouncementBanner />

      <header className="adm-header">
        <div className="adm-header-titles">
          {loading ? (
            <>
              <SkeletonLine width="320px" height={28} />
              <SkeletonLine width="180px" height={16} />
            </>
          ) : (
            <>
              <h1 className="adm-title">
                Hola, {professional?.name} {professional?.surname}
              </h1>
              <p className="adm-subtitle">{professional?.speciality || "Panel del profesional"}</p>
            </>
          )}
        </div>
      </header>

      <section className="adm-card-grid">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link className="adm-card" to={entry.link} key={entry.title}>
              <span className="adm-card-icon">
                <Icon />
              </span>
              <span className="adm-card-title">{entry.title}</span>
              <span className="adm-card-desc">{entry.description}</span>
            </Link>
          );
        })}
      </section>

      <section className="prof-today">
        <div className="prof-today-head">
          <div>
            <h2 className="prof-today-title">Hoy</h2>
            <p className="prof-today-date">{dayLabel}</p>
          </div>
          <Link className="adm-btn adm-btn-ghost" to="/AppointmentsList">
            Ver toda la agenda
            <FaArrowRight />
          </Link>
        </div>

        <div className="adm-panel">
          {today === null ? (
            <div className="prof-today-loading">
              <SkeletonLine height={18} />
              <SkeletonLine width="70%" height={18} />
              <SkeletonLine width="45%" height={18} />
            </div>
          ) : today.length === 0 ? (
            <div className="adm-empty">No tenés turnos para hoy.</div>
          ) : (
            <ul className="prof-today-list">
              {today.map((appointment) => {
                const state = describeState(appointment.state);

                return (
                  <li key={appointment.numAppointment}>
                    <button type="button" className="prof-today-item" onClick={() => open(appointment)}>
                      <span className="prof-today-hour">
                        <FaRegClock aria-hidden="true" />
                        {shortHour(appointment.initialHour)}
                      </span>
                      <span className="prof-today-person">
                        {appointment.patient ? (
                          `${appointment.patient.surname}, ${appointment.patient.name}`
                        ) : (
                          <span className="prof-today-free">Sin paciente asignado</span>
                        )}
                      </span>
                      <span className="prof-today-room">{appointment.room?.description}</span>
                      {appointment.overbooked && <span className="appt-tag-over">Sobreturno</span>}
                      <span className={state.className}>{state.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Debajo de la agenda del día y con la misma caja. Es lo que hay que contestar,
          y va después de lo que hay que hacer hoy: primero se mira con qué se arranca la
          jornada, después se despacha lo que quedó esperando.

          Sin pedidos pendientes la sección no se dibuja. Es una bandeja de entrada, no
          una agenda: el estado normal es que esté vacía, y una caja que dice "no hay
          nada" todos los días deja de leerse igual. */}
      {pendingCount > 0 && (
        <section className="prof-today prof-pending">
          <div className="prof-today-head">
            <div>
              <h2 className="prof-today-title">Pendientes de confirmación</h2>
              <p className="prof-today-date">
                {pendingCount === 1 ? "Un turno espera tu respuesta" : `${pendingCount} turnos esperan tu respuesta`}
              </p>
            </div>
            <Link className="adm-btn adm-btn-ghost" to="/AppointmentsList">
              Ver toda la agenda
              <FaArrowRight />
            </Link>
          </div>

          <div className="adm-panel">
            <ul className="prof-today-list">
              {pendingSlice.map((appointment) => (
                <li key={appointment.numAppointment}>
                  <button type="button" className="prof-today-item" onClick={() => open(appointment)}>
                    <span className="prof-today-hour">
                      <FaRegClock aria-hidden="true" />
                      {shortHour(appointment.initialHour)}
                    </span>
                    <span className="prof-today-person">
                      {appointment.patient ? (
                        `${appointment.patient.surname}, ${appointment.patient.name}`
                      ) : (
                        <span className="prof-today-free">Sin paciente asignado</span>
                      )}
                      {/* Un pendiente puede ser de cualquier día, así que la fecha va en la
                          fila. En la agenda de hoy sobraría. */}
                      <span className="prof-pending-day">{formatDayLabel(appointmentDate(appointment.date))}</span>
                    </span>
                    <span className="prof-today-room">{appointment.room?.description}</span>
                    {appointment.overbooked && <span className="appt-tag-over">Sobreturno</span>}
                    <span className={describeState(appointment.state).className}>
                      {describeState(appointment.state).label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {pendingPages > 1 && (
              <div className="prof-pager">
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost adm-btn-sm"
                  disabled={page === 0}
                  onClick={() => setPendingPage(page - 1)}
                >
                  <FaChevronLeft />
                  Anterior
                </button>
                <span className="prof-pager-page">
                  Página {page + 1} de {pendingPages}
                </span>
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost adm-btn-sm"
                  disabled={page >= pendingPages - 1}
                  onClick={() => setPendingPage(page + 1)}
                >
                  Siguiente
                  <FaChevronRight />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <ProfessionalSettings />

      {professional && <AppointmentDetailModal user={professional} {...detailProps} />}

      <Toasts />
    </div>
  );
}
