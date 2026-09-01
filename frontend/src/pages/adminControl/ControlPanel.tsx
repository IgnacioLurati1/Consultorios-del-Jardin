import { useEffect, useState } from "react";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../components/skeleton/Skeleton.tsx";
import { ProfessionalPicker } from "../scheduleProfessional/professionalPicker/ProfessionalPicker.tsx";
import { findAllActiveProfessionals } from "../adminCRUDS/adminUsers/usersService.ts";
import { findAppointmentsByProfessional, type AdminAppointment, type AppointmentKind } from "./controlService.ts";
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

export function ControlPanel() {
  const [professionals, setProfessionals] = useState<Person[]>([]);
  const [professional, setProfessional] = useState<Person | undefined>(undefined);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [page, setPage] = useState(0);
  // Lo pasado no se controla: arranca mostrando solo los turnos de hoy en adelante.
  const [includePast, setIncludePast] = useState(false);
  const [kind, setKind] = useState<AppointmentKind>("all");

  const [pickerOpen, setPickerOpen] = useState(true);
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
        subtitle={
          professional
            ? `${professional.surname}, ${professional.name}${professional.speciality ? ` · ${professional.speciality}` : ""}`
            : "Elegí un profesional para ver sus turnos"
        }
        actions={
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
        }
      />

      <Toasts />

      <p className="control-note">
        Vista de solo lectura. Se muestran los horarios, el paciente y el estado del turno; las observaciones clínicas no se
        incluyen, y desde acá no se cancela ni se modifica nada.
      </p>

      {professional && (
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

      {professional && (
        <p className="control-order">
          {includePast
            ? "Todos los turnos, del más reciente al más viejo."
            : "Turnos de hoy en adelante, del más cercano al más lejano."}
        </p>
      )}

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
                <th>Sala</th>
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

      {professional && (
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
        isOpen={pickerOpen}
        professionals={professionals}
        loading={loadingProfessionals}
        onSelect={selectProfessional}
        onClose={professional ? () => setPickerOpen(false) : undefined}
      />
    </div>
  );
}
