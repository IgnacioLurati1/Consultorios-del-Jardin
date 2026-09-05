import { useEffect, useState } from "react";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../components/skeleton/Skeleton.tsx";
import { ProfessionalPicker } from "../scheduleProfessional/professionalPicker/ProfessionalPicker.tsx";
import { findAllActiveProfessionals } from "../adminCRUDS/adminUsers/usersService.ts";
import { findAppointmentsByProfessional, type AdminAppointment, type AppointmentKind } from "./controlService.ts";
import { DayAgenda } from "./DayAgenda.tsx";
import type { Person } from "../types.ts";
import "../adminCRUDS/adminPanel.css";
import "./controlPanel.css";

/** El estado del turno puede ser un ISO timestamp: eso significa cancelado. */
function describeState(state: string): { label: string; className: string } {
  switch (state) {
    case "pending":
      return { label: "Pendiente", className: "adm-badge adm-badge-amber" };
    case "accepted":
      return { label: "Confirmado", className: "adm-badge adm-badge-green" };
    case "assisted":
      return { label: "Asistido", className: "adm-badge adm-badge-grey" };
    default:
      return { label: "Cancelado", className: "adm-badge adm-badge-red" };
  }
}

/** El backend manda las horas como "09:00:00"; en la tabla alcanza con hh:mm. */
const hhmm = (hour: string) => hour?.slice(0, 5) ?? hour;

const KINDS: { key: AppointmentKind; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "normal", label: "Turnos" },
  { key: "overbooked", label: "Sobreturnos" },
];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Las dos preguntas que se le hacen a esta pantalla, que no se contestan igual. */
type ControlView = "professional" | "day";

const VIEWS: { key: ControlView; label: string }[] = [
  { key: "professional", label: "Por profesional" },
  { key: "day", label: "Por día" },
];

export function ControlPanel() {
  const [view, setView] = useState<ControlView>("professional");
  const [professionals, setProfessionals] = useState<Person[]>([]);
  const [professional, setProfessional] = useState<Person | undefined>(undefined);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [page, setPage] = useState(0);
  // Lo pasado no se controla: arranca mostrando solo los turnos de hoy en adelante.
  const [includePast, setIncludePast] = useState(false);
  const [kind, setKind] = useState<AppointmentKind>("all");

  // Cerrado al entrar. Antes se abría solo, que con una sola vista alcanzaba; ahora hay
  // dos, y una ventana encima al llegar tapa justamente el control que dice que existe
  // la otra. El panel vacío ya invita a buscar profesional con un botón bien grande.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingProfessionals, setLoadingProfessionals] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  useEffect(() => {
    findAllActiveProfessionals()
      .then(setProfessionals)
      .catch((err) => toast.error(`Error cargando profesionales: ${err.message}`))
      .finally(() => setLoadingProfessionals(false));
  }, []);

  useEffect(() => {
    if (!professional) return;

    setLoadingAppointments(true);
    findAppointmentsByProfessional(professional.email, page, includePast, kind)
      .then(setAppointments)
      .catch((err) => toast.error(`Error cargando turnos: ${err.message}`))
      .finally(() => setLoadingAppointments(false));
  }, [professional, page, includePast, kind]);

  function selectProfessional(selected: Person) {
    setProfessional(selected);
    setPage(0);
    setPickerOpen(false);
  }

  function changeKind(next: AppointmentKind) {
    setKind(next);
    setPage(0);
  }

  return (
    <div className="adm-page">
      <AdminHeader
        title="Control de turnos"
        subtitleIsData={view !== "day" && Boolean(professional)}
        subtitle={
          view === "day"
            ? "Todo lo que pasa en el consultorio un día"
            : professional
            ? `${professional.surname}, ${professional.name}${professional.speciality ? ` · ${professional.speciality}` : ""}`
            : "Elegí un profesional para ver sus turnos"
        }
        actions={
          view === "professional" ? (
            <>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setPickerOpen(true)}>
                {professional ? "Cambiar profesional" : "Buscar profesional"}
              </button>

              <button
                type="button"
                className={`adm-btn adm-btn-ghost ${includePast ? "active" : ""}`}
                disabled={!professional}
                onClick={() => {
                  setIncludePast((v) => !v);
                  setPage(0);
                }}
                title={includePast ? "Mostrar solo los turnos de hoy en adelante" : "Mostrar tambien los turnos ya pasados"}
              >
                {includePast ? <FaEyeSlash /> : <FaEye />}
                {includePast ? "Ocultar pasados" : "Ver pasados"}
              </button>
            </>
          ) : undefined
        }
      />

      <Toasts />

      {/* Las dos vistas miran los mismos turnos desde lugares distintos: una sigue a una
          persona a lo largo del tiempo y la otra congela un día y cuenta cuánta gente
          hay. Mezclarlas en una sola pantalla obligaba a elegir un orden que servía para
          una de las dos preguntas y estorbaba a la otra. */}
      <div className="adm-chips control-views" role="group" aria-label="Cómo mirar los turnos">
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={view === key ? "active" : ""}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="control-note">
        Vista de solo lectura. Se muestran los horarios, el paciente y el estado del turno; las observaciones clínicas no se
        incluyen, y desde acá no se cancela ni se modifica nada.
      </p>

      {view === "day" && <DayAgenda />}

      {view === "professional" && professional && (
        <div className="adm-filters">
          <div className="adm-chips" role="group" aria-label="Tipo de turno">
            {KINDS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={kind === key ? "active" : ""}
                aria-pressed={kind === key}
                onClick={() => changeKind(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "professional" && professional && (
        <p className="control-order">
          {includePast
            ? "Todos los turnos, del más reciente al más viejo."
            : "Turnos de hoy en adelante, del más cercano al más lejano."}
        </p>
      )}

      {view === "professional" && (
      <div className="adm-panel">
        {!professional ? (
          <div className="adm-empty">
            Todavía no elegiste un profesional.
            <br />
            <button type="button" className="adm-btn adm-btn-primary" style={{ marginTop: 16 }} onClick={() => setPickerOpen(true)}>
              Buscar profesional
            </button>
          </div>
        ) : loadingAppointments ? (
          <SkeletonList rows={6} />
        ) : appointments.length === 0 ? (
          <div className="adm-empty">
            {page > 0
              ? "No hay más turnos para mostrar."
              : includePast
              ? "Este profesional no tiene turnos registrados."
              : "Este profesional no tiene turnos de hoy en adelante. Probá viendo también los pasados."}
          </div>
        ) : (
          <table className="control-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Paciente</th>
                <th>Consultorio</th>
                <th>Tipo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => {
                const state = describeState(appointment.state);

                return (
                  <tr key={appointment.numAppointment}>
                    <td>{formatDate(appointment.date)}</td>
                    <td className="control-hours">
                      {hhmm(appointment.initialHour)} – {hhmm(appointment.finalHour)}
                    </td>
                    <td>
                      {appointment.patient ? (
                        `${appointment.patient.surname}, ${appointment.patient.name}`
                      ) : (
                        <span className="control-muted">Sin paciente asignado</span>
                      )}
                    </td>
                    <td>{appointment.room?.description ?? "—"}</td>
                    <td>{appointment.overbooked ? <span className="appt-tag-over">Sobreturno</span> : null}</td>
                    <td>
                      <span className={state.className}>{state.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}

      {view === "professional" && professional && (
        <div className="control-pagination">
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            disabled={page === 0 || loadingAppointments}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <span className="control-page">Página {page + 1}</span>
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            disabled={appointments.length < 15 || loadingAppointments}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      <ProfessionalPicker
        isOpen={view === "professional" && pickerOpen}
        professionals={professionals}
        loading={loadingProfessionals}
        onSelect={selectProfessional}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
