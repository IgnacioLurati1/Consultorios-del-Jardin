import { useEffect, useMemo, useState } from "react";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import { toast } from "react-toastify";
import {
  FaBorderAll,
  FaList,
  FaChevronLeft,
  FaChevronRight,
  FaEye,
  FaEyeSlash,
  FaPlus,
  FaFileArrowUp,
  FaFileArrowDown,
} from "react-icons/fa6";
import { AdminHeader } from "../../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList, SkeletonGrid } from "../../../components/skeleton/Skeleton.tsx";
import { AppointmentCard } from "./AppointmentCard.tsx";
import { AppointmentWeekGrid } from "./AppointmentWeekGrid.tsx";
import { AppointmentDetailModal } from "./AppointmentDetailModal.tsx";
import { NewAppointmentModal } from "./NewAppointmentModal.tsx";
import { ImportCalendarModal } from "./ImportCalendarModal.tsx";
import { ExportCalendarModal } from "./ExportCalendarModal.tsx";
import type { Appointment, Person, RecurrenceFrequency, Schedule } from "../../types.ts";
import { createRecurrence } from "../recurrencesService.ts";
import {
  addDays,
  appointmentDate,
  formatDayLabel,
  formatWeekRange,
  startOfWeek,
  toISODate,
} from "../appointmentTypes.ts";
import {
  findPatientAppointments,
  findProfessionalAppointments,
  findProfessionalAppointmentsInRange,
  createProfessionalAppointment,
} from "../appointmentsService.ts";
import { useAppointmentActions } from "../useAppointmentActions.ts";
import { findProfessionalSchedules } from "../../scheduleProfessional/scheduleServices.ts";
import { findPerson, getDecodedToken } from "../../commonServices.ts";
import { AnnouncementBanner } from "../../announcements/AnnouncementBanner.tsx";
import "../../adminCRUDS/adminPanel.css";
import "./appointmentList.css";

type ViewMode = "list" | "grid";

export function AppointmentsList() {
  const [person, setPerson] = useState<Person | undefined>(undefined);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // La grilla es la vista por defecto. El paciente no la tiene (no hay endpoint de
  // rango para su lado), así que para él siempre se resuelve en lista.
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [page, setPage] = useState(0);
  const [monday, setMonday] = useState<Date>(() => startOfWeek(new Date()));

  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const isProfessional = person?.type === "professional";
  const effectiveMode: ViewMode = isProfessional ? viewMode : "list";

  useEffect(() => {
    const decoded = getDecodedToken();
    if (!decoded) return;

    findPerson(decoded.email)
      .then((data) => {
        if (!data) {
          toast.error("No se encontró a la persona");
          return;
        }
        setPerson(data);
      })
      .catch((err) => toast.error(`Error al cargar los datos: ${err.message}`));
  }, []);

  // Los horarios son para ofrecer turnos normales en el alta; los pacientes y los consultorios
  // los trae useAppointmentActions, que es quien los necesita.
  useEffect(() => {
    if (!isProfessional || !person) return;

    findProfessionalSchedules(person.email)
      .then(setSchedules)
      .catch(() => setSchedules([]));
  }, [isProfessional, person]);

  function loadAppointments() {
    if (!person) return;

    setLoading(true);

    const mode: ViewMode = person.type === "professional" ? viewMode : "list";

    const request =
      mode === "grid"
        ? findProfessionalAppointmentsInRange(toISODate(monday), toISODate(addDays(monday, 6)), includeCancelled)
        : person.type === "professional"
        ? findProfessionalAppointments(page, includeCancelled)
        : findPatientAppointments(page, includeCancelled);

    request
      .then((data) => {
        setAppointments(data);
        setHasMore(mode === "list" && data.length === 15);
      })
      .catch((err) => toast.error(`Error al obtener turnos: ${err.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(loadAppointments, [person, viewMode, includeCancelled, page, monday]);

  /* ---------- agrupado de la vista lista: por semana y, adentro, por día ----------
     Las semanas que vienen van primero (la más cercana arriba) y después las
     pasadas, de la más reciente a la más vieja. Dentro de cada semana los días
     van en orden de calendario. */
  const grouped = useMemo(() => {
    const weeks = new Map<string, { monday: Date; days: Map<string, { date: Date; items: Appointment[] }> }>();

    for (const appointment of appointments) {
      const date = appointmentDate(appointment.date);
      const weekStart = startOfWeek(date);
      const weekKey = toISODate(weekStart);
      const dayKey = toISODate(date);

      if (!weeks.has(weekKey)) weeks.set(weekKey, { monday: weekStart, days: new Map() });
      const week = weeks.get(weekKey)!;

      if (!week.days.has(dayKey)) week.days.set(dayKey, { date, items: [] });
      week.days.get(dayKey)!.items.push(appointment);
    }

    const currentWeek = startOfWeek(new Date()).getTime();

    const ordered = Array.from(weeks.values()).sort((a, b) => {
      const aUpcoming = a.monday.getTime() >= currentWeek;
      const bUpcoming = b.monday.getTime() >= currentWeek;

      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1; // lo que viene, arriba
      return aUpcoming
        ? a.monday.getTime() - b.monday.getTime() // próximas: la más cercana primero
        : b.monday.getTime() - a.monday.getTime(); // pasadas: la más reciente primero
    });

    for (const week of ordered) {
      const days = Array.from(week.days.entries()).sort((a, b) => a[1].date.getTime() - b[1].date.getTime());
      week.days = new Map(days);
      for (const [, day] of week.days) day.items.sort((a, b) => a.initialHour.localeCompare(b.initialHour));
    }

    return ordered;
  }, [appointments]);

  const { open, patients, rooms, detailProps } = useAppointmentActions(person, loadAppointments);

  /* ---------- acciones ---------- */

  async function handleCreate(data: {
    date: string;
    initialHour: string;
    finalHour: string;
    room: string;
    value: number;
    patientEmail?: string;
    overbooked: boolean;
    repeat: { frequency: RecurrenceFrequency; endDate: string | null } | null;
  }) {
    const created = await createProfessionalAppointment(data);
    const label = data.overbooked ? "Sobreturno" : "Turno";

    if (!data.repeat || !created?.numAppointment) {
      toast.success(`${label} creado`);
      loadAppointments();
      return;
    }

    // La repetición se pide aparte, con el mismo endpoint que usa la ficha del turno: las
    // reglas de qué se puede repetir viven en un solo lugar. Si falla, el turno ya está
    // creado y sigue siendo un turno común; hay que decirlo, no tragárselo.
    try {
      const { created: extra } = await createRecurrence(created.numAppointment, data.repeat.frequency, data.repeat.endDate);
      toast.success(extra > 0 ? `${label} creado, y ${extra} más agendados` : `${label} creado, se va a repetir`);
    } catch (err: any) {
      toast.warning(`${label} creado, pero no se pudo configurar la repetición: ${err.message}`);
    }

    loadAppointments();
  }

  /* ---------- render ---------- */

  const canUseGrid = isProfessional;

  return (
    <div className="adm-page">
      {/* Para el paciente esta es su pantalla principal, así que es acá donde tiene que
          enterarse de lo que pasa en el consultorio. */}
      <AnnouncementBanner />

      <AdminHeader
        title="Turnos"
        subtitleIsData={effectiveMode === "grid"}
        subtitle={
          effectiveMode === "grid"
            ? formatWeekRange(monday)
            : isProfessional
            ? "Tus turnos, del más reciente al más viejo"
            : "Tus turnos"
        }
        backTo={isProfessional ? "/ProfessionalHome" : "/"}
        actions={
          <>
            {isProfessional && (
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => setNewModalOpen(true)}>
                <FaPlus />
                Nuevo turno
              </button>
            )}
            {isProfessional && (
              <button
                type="button"
                className="adm-btn adm-btn-accent"
                onClick={() => setImportModalOpen(true)}
                title="Traer turnos desde un calendario exportado de Google"
              >
                <FaFileArrowUp />
                Importar
              </button>
            )}
            {isProfessional && (
              <button
                type="button"
                className="adm-btn adm-btn-accent"
                onClick={() => setExportModalOpen(true)}
                title="Bajar tu agenda como archivo de calendario"
              >
                <FaFileArrowDown />
                Exportar
              </button>
            )}
            <button
              type="button"
              className={`adm-btn adm-btn-ghost ${includeCancelled ? "active" : ""}`}
              onClick={() => {
                setIncludeCancelled((v) => !v);
                setPage(0);
              }}
              title={includeCancelled ? "Ocultar los turnos cancelados" : "Mostrar también los cancelados"}
            >
              {includeCancelled ? <FaEyeSlash /> : <FaEye />}
              {includeCancelled ? "Ocultar cancelados" : "Ver cancelados"}
            </button>

            {canUseGrid && (
              <div className="appt-view-toggle" role="group" aria-label="Modo de vista">
                <button
                  type="button"
                  className={viewMode === "list" ? "active" : ""}
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                >
                  <FaList />
                  Lista
                </button>
                <button
                  type="button"
                  className={viewMode === "grid" ? "active" : ""}
                  onClick={() => setViewMode("grid")}
                  aria-pressed={viewMode === "grid"}
                >
                  <FaBorderAll />
                  Grilla
                </button>
              </div>
            )}
          </>
        }
      />

      <Toasts />

      {/* ---------- navegación de semanas (solo grilla) ---------- */}
      {effectiveMode === "grid" && (
        <div className="appt-week-nav">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setMonday(addDays(monday, -7))}>
            <FaChevronLeft />
            Semana anterior
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setMonday(startOfWeek(new Date()))}>
            Esta semana
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setMonday(addDays(monday, 7))}>
            Semana siguiente
            <FaChevronRight />
          </button>
        </div>
      )}

      {/* ---------- contenido ---------- */}
      {loading || !person ? (
        effectiveMode === "grid" ? (
          <SkeletonGrid columns={7} />
        ) : (
          <div className="adm-panel">
            <SkeletonList rows={6} />
          </div>
        )
      ) : effectiveMode === "grid" && person ? (
        <AppointmentWeekGrid appointments={appointments} monday={monday} user={person} onOpen={open} />
      ) : appointments.length === 0 ? (
        <div className="adm-panel">
          <div className="adm-empty">
            {includeCancelled ? "No hay turnos para mostrar." : "No hay turnos activos. Probá mostrando también los cancelados."}
          </div>
        </div>
      ) : (
        <div className="appt-weeks">
          {grouped.map((week) => (
            <section className="appt-week-block" key={toISODate(week.monday)}>
              <h2 className="appt-week-title">{formatWeekRange(week.monday)}</h2>

              {Array.from(week.days.values()).map((day) => (
                <div className="appt-day-block" key={toISODate(day.date)}>
                  <h3 className="appt-day-title">{formatDayLabel(day.date)}</h3>
                  <div className="appt-day-items">
                    {day.items.map((appointment) => (
                      <AppointmentCard
                        key={appointment.numAppointment}
                        appointment={appointment}
                        user={person}
                        onOpen={open}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {/* ---------- paginado (solo lista) ---------- */}
      {effectiveMode === "list" && !loading && (page > 0 || hasMore) && (
        <div className="appt-pagination">
          <button type="button" className="adm-btn adm-btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <FaChevronLeft />
            Anteriores
          </button>
          <span className="appt-page">Página {page + 1}</span>
          <button type="button" className="adm-btn adm-btn-ghost" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
            Siguientes
            <FaChevronRight />
          </button>
        </div>
      )}

      {person && <AppointmentDetailModal user={person} {...detailProps} />}

      {isProfessional && (
        <NewAppointmentModal
          isOpen={newModalOpen}
          onClose={() => setNewModalOpen(false)}
          rooms={rooms}
          patients={patients}
          schedules={schedules}
          onCreate={handleCreate}
        />
      )}

      {isProfessional && (
        <ImportCalendarModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImported={loadAppointments}
        />
      )}

      {isProfessional && <ExportCalendarModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />}
    </div>
  );
}
