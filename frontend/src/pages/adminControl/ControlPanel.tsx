import { useEffect, useState, type ComponentProps } from "react";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash, FaPlus } from "react-icons/fa6";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../components/skeleton/Skeleton.tsx";
import { ProfessionalPicker } from "../scheduleProfessional/professionalPicker/ProfessionalPicker.tsx";
import { findAllActiveClients, findAllActiveProfessionals } from "../adminCRUDS/adminUsers/usersService.ts";
import { findAllActiveRooms } from "../adminCRUDS/adminRooms/RoomService.ts";
import { findProfessionalSchedules } from "../scheduleProfessional/scheduleServices.ts";
import { NewAppointmentModal } from "../appointments/appointmentsList/NewAppointmentModal.tsx";
import {
  cancelAdminAppointment,
  createAdminAppointment,
  findAppointmentsByProfessional,
  moveAdminAppointment,
  type AdminAppointment,
  type AdminAppointmentChanges,
  type AppointmentKind,
} from "./controlService.ts";
import { DayAgenda } from "./DayAgenda.tsx";
import { MoveAppointmentModal } from "./MoveAppointmentModal.tsx";
import { CancelAppointmentConfirm } from "./CancelAppointmentConfirm.tsx";
import { currentWords, hasBranches, useInstallation, usePolicies, useWords } from "../../lib/installation.ts";
import { findBranch } from "../adminCRUDS/adminOffices/branches.ts";
import type { Person, Room, Schedule } from "../types.ts";
import "../adminCRUDS/adminPanel.css";
import "./controlPanel.css";

/** El estado del turno puede ser un ISO timestamp: eso significa cancelado. */
function describeState(state: string): { label: string; className: string } {
  const w = currentWords();
  switch (state) {
    case "pending":
      return { label: "Pendiente", className: "adm-badge adm-badge-amber" };
    case "accepted":
      return { label: `Confirmad${w.o("turno")}`, className: "adm-badge adm-badge-green" };
    case "assisted":
      return { label: `Asistid${w.o("turno")}`, className: "adm-badge adm-badge-grey" };
    case "missed":
      return { label: "No vino", className: "adm-badge adm-badge-amber" };
    default:
      return { label: `Cancelad${w.o("turno")}`, className: "adm-badge adm-badge-red" };
  }
}

/** El backend manda las horas como "09:00:00"; en la tabla alcanza con hh:mm. */
const hhmm = (hour: string) => hour?.slice(0, 5) ?? hour;

function kinds(): { key: AppointmentKind; label: string }[] {
  const w = currentWords();
  return [
    { key: "all", label: `Tod${w.os("turno")}` },
    { key: "normal", label: w.Turnos },
    { key: "overbooked", label: `${w.Turnos} especiales` },
  ];
}

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

/** Lo que entrega la ventana de alta al confirmar. */
type NewAppointmentData = Parameters<ComponentProps<typeof NewAppointmentModal>["onCreate"]>[0];

/** Lo que la recepción puede tocar: un turno vivo. Lo asistido o cancelado ya es historia. */
const isLive = (state: string) => state === "pending" || state === "accepted";

/** Las dos preguntas que se le hacen a esta pantalla, que no se contestan igual. */
type ControlView = "professional" | "day";

function views(): { key: ControlView; label: string }[] {
  const w = currentWords();
  return [
    { key: "professional", label: `Por ${w.profesional}` },
    { key: "day", label: "Por día" },
  ];
}

export function ControlPanel() {
  const w = useWords();
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

  /*
   * La recepción: con la regla adminBooking, desde acá se dan, se mueven y se cancelan
   * turnos en la agenda del profesional elegido. Apagada, la pantalla es la de siempre, de
   * solo lectura, y nada de lo que sigue pide ni dibuja nada.
   */
  const reception = usePolicies().adminBooking;
  const installation = useInstallation();
  const multi = hasBranches(installation);
  const [patients, setPatients] = useState<Person[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [moving, setMoving] = useState<AdminAppointment | undefined>(undefined);
  const [cancelling, setCancelling] = useState<AdminAppointment | undefined>(undefined);
  /** Se suma uno después de cada cambio, para volver a pedir la tabla con los mismos filtros. */
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((key) => key + 1);

  useEffect(() => {
    findAllActiveProfessionals()
      .then(setProfessionals)
      .catch((err) => toast.error(`Error cargando ${currentWords().profesionales}: ${err.message}`))
      .finally(() => setLoadingProfessionals(false));
  }, []);

  useEffect(() => {
    if (!professional) return;

    // Cambiar de profesional, de página o de filtro dispara un pedido nuevo sin esperar
    // al anterior, y nada garantiza que vuelvan en orden. Sin esto, el que llegaba último
    // ganaba y la pantalla mostraba los turnos de un profesional con el nombre de otro.
    let cancelled = false;

    setLoadingAppointments(true);
    findAppointmentsByProfessional(professional.email, page, includePast, kind)
      .then((turnos) => {
        if (!cancelled) setAppointments(turnos);
      })
      .catch((err) => {
        if (!cancelled) toast.error(`Error cargando ${currentWords().turnos}: ${err.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingAppointments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [professional, page, includePast, kind, reloadKey]);

  // Lo que necesita la ventana de alta: los pacientes, una sola vez.
  useEffect(() => {
    if (!reception) return;

    findAllActiveClients()
      .then(setPatients)
      .catch(() => setPatients([]));
  }, [reception]);

  // Las salas, para la ventana de alta y, con varias sucursales, para decir en cuál cae
  // cada turno: la lista trae la sala sola, y la sucursal sale de acá.
  useEffect(() => {
    if (!reception && !multi) return;

    findAllActiveRooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [reception, multi]);

  /** " · Norte", la sucursal de la sala de un turno. Con una sola sucursal, nada. */
  function branchSuffix(room: { idRoom: number } | null | undefined): string {
    if (!multi || !room) return "";
    const listed = rooms.find((item) => String(item.idRoom) === String(room.idRoom));
    const branch = listed ? findBranch(listed.office, installation) : null;
    return branch ? ` · ${branch.name}` : "";
  }

  // Y los horarios de atención del profesional elegido, que es de donde salen los turnos
  // normales. Con la misma guarda que la tabla: si se cambia de profesional antes de que
  // vuelva el pedido, los horarios del anterior no pueden quedar ofrecidos para este.
  useEffect(() => {
    if (!reception || !professional) return;

    let cancelled = false;
    setSchedules([]);
    findProfessionalSchedules(professional.email)
      .then((found) => {
        if (!cancelled) setSchedules(found);
      })
      .catch(() => {
        if (!cancelled) setSchedules([]);
      });

    return () => {
      cancelled = true;
    };
  }, [reception, professional]);

  /**
   * El alta desde la recepción.
   *
   * La ventana es la misma que usa el profesional, abierta en modo recepción: ofrece el
   * turno especial y no ofrece "Repetir", porque la repetición la arma el servidor a nombre
   * de quien la pide y la administración no tiene agenda propia.
   */
  async function handleCreate(data: NewAppointmentData) {
    if (!professional) throw new Error(`Falta ${w.el("profesional")}`);

    const message = await createAdminAppointment({
      professionalEmail: professional.email,
      date: data.date,
      initialHour: data.initialHour,
      finalHour: data.finalHour,
      room: Number(data.room),
      value: data.value,
      patientEmail: data.patientEmail,
      overbooked: data.overbooked,
    });
    toast.success(message || `${w.Turno} cread${w.o("turno")}`);
    reload();
  }

  async function handleMove(appointment: AdminAppointment, changes: AdminAppointmentChanges) {
    const message = await moveAdminAppointment(appointment.numAppointment, changes);
    toast.success(message || `${w.Turno} actualizad${w.o("turno")}`);
    setMoving(undefined);
    reload();
  }

  // Si falla, se cierra igual y se vuelve a pedir la tabla: lo más probable es que el
  // turno haya cambiado mientras tanto, y lo que hay que mirar es cómo quedó.
  async function handleCancel(appointment: AdminAppointment) {
    try {
      const message = await cancelAdminAppointment(appointment.numAppointment);
      toast.success(message || `${w.Turno} cancelad${w.o("turno")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    setCancelling(undefined);
    reload();
  }

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
        title={`Control de ${w.turnos}`}
        subtitleIsData={view !== "day" && Boolean(professional)}
        subtitle={
          view === "day"
            ? `Todo lo que pasa en ${w.el("lugar")} un día`
            : professional
            ? `${professional.surname}, ${professional.name}${professional.speciality ? ` · ${professional.speciality}` : ""}`
            : `Seleccionar ${w.un("profesional")} para ver sus ${w.turnos}`
        }
        actions={
          view === "professional" ? (
            <>
              {reception && professional && (
                <button type="button" className="adm-btn adm-btn-primary" onClick={() => setNewOpen(true)}>
                  <FaPlus />
                  {`Nuev${w.o("turno")} ${w.turno}`}
                </button>
              )}

              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setPickerOpen(true)}>
                {professional ? `Cambiar ${w.profesional}` : `Buscar ${w.profesional}`}
              </button>

              <button
                type="button"
                className={`adm-btn adm-btn-ghost ${includePast ? "active" : ""}`}
                disabled={!professional}
                onClick={() => {
                  setIncludePast((v) => !v);
                  setPage(0);
                }}
                title={
                  includePast
                    ? `Mostrar solo ${w.los("turno")} de hoy en adelante`
                    : `Mostrar tambien ${w.los("turno")} ya pasad${w.os("turno")}`
                }
              >
                {includePast ? <FaEyeSlash /> : <FaEye />}
                {includePast ? `Ocultar pasad${w.os("turno")}` : `Ver pasad${w.os("turno")}`}
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
      <div className="adm-chips control-views" role="group" aria-label={`Cómo mirar ${w.los("turno")}`}>
        {views().map(({ key, label }) => (
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

      {reception ? (
        <p className="control-note">
          Se muestran los horarios, {w.el("paciente")} y el estado {w.del("turno")}; las observaciones clínicas no se
          incluyen. En la vista por {w.profesional} se dan, se mueven y se cancelan {w.turnos}.
        </p>
      ) : (
        <p className="control-note">
          Vista de solo lectura. Se muestran los horarios, {w.el("paciente")} y el estado {w.del("turno")}; las observaciones
          clínicas no se incluyen, y desde acá no se cancela ni se modifica nada.
        </p>
      )}

      {view === "day" && <DayAgenda />}

      {view === "professional" && professional && (
        <div className="adm-filters">
          <div className="adm-chips" role="group" aria-label={`Tipo de ${w.turno}`}>
            {kinds().map(({ key, label }) => (
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
            ? `Tod${w.os("turno")} ${w.los("turno")}, ${
                w.o("turno") === "a" ? "de la más reciente a la más antigua" : "del más reciente al más antiguo"
              }.`
            : `${w.Turnos} de hoy en adelante, ${
                w.o("turno") === "a" ? "de la más cercana a la más lejana" : "del más cercano al más lejano"
              }.`}
        </p>
      )}

      {view === "professional" && (
      <div className="adm-panel control-scroll">
        {!professional ? (
          <div className="adm-empty">
            Sin {w.profesional} seleccionad{w.o("profesional")}.
            <br />
            <button type="button" className="adm-btn adm-btn-primary" style={{ marginTop: 16 }} onClick={() => setPickerOpen(true)}>
              Buscar {w.profesional}
            </button>
          </div>
        ) : loadingAppointments ? (
          <SkeletonList rows={6} />
        ) : appointments.length === 0 ? (
          <div className="adm-empty">
            {page > 0
              ? `Sin más ${w.turnos} para mostrar.`
              : includePast
              ? `Sin ${w.turnos} registrad${w.os("turno")}.`
              : `Sin ${w.turnos} de hoy en adelante. L${w.os("turno")} pasad${w.os("turno")} se ven con “Ver pasad${w.os("turno")}”.`}
          </div>
        ) : (
          <table className={reception ? "control-table control-table-reception" : "control-table"}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horario</th>
                <th>{w.Paciente}</th>
                <th>{w.Sala}</th>
                <th>Tipo</th>
                <th>Estado</th>
                {reception && <th aria-label="Acciones" />}
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
                        <span className="control-muted">Sin {w.paciente} asignad{w.o("paciente")}</span>
                      )}
                    </td>
                    <td>
                      {appointment.room?.description ?? "—"}
                      {branchSuffix(appointment.room)}
                    </td>
                    <td>{appointment.overbooked ? <span className="appt-tag-over">{w.Turno} especial</span> : w.Turno}</td>
                    <td>
                      <span className={state.className}>{state.label}</span>
                    </td>
                    {reception && (
                      <td>
                        {isLive(appointment.state) && (
                          <div className="control-actions">
                            <button
                              type="button"
                              className="adm-btn adm-btn-ghost adm-btn-sm"
                              onClick={() => setMoving(appointment)}
                            >
                              Mover
                            </button>
                            {/* Un turno pendiente no se cancela: se borra. Mismas palabras que la
                                ficha del turno del profesional. */}
                            <button
                              type="button"
                              className="adm-btn adm-btn-danger adm-btn-sm"
                              onClick={() => setCancelling(appointment)}
                            >
                              {appointment.state === "pending" ? "Eliminar" : "Cancelar"}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
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

      {reception && professional && (
        <NewAppointmentModal
          isOpen={newOpen}
          onClose={() => setNewOpen(false)}
          rooms={rooms}
          patients={patients}
          schedules={schedules}
          preset={null}
          reception={{ professionalName: `${professional.name} ${professional.surname}` }}
          onCreate={handleCreate}
        />
      )}

      {reception && (
        <MoveAppointmentModal appointment={moving} rooms={rooms} onClose={() => setMoving(undefined)} onSave={handleMove} />
      )}

      {reception && (
        <CancelAppointmentConfirm
          appointment={cancelling}
          onClose={() => setCancelling(undefined)}
          onConfirm={handleCancel}
        />
      )}
    </div>
  );
}
