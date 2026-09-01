import "./scheduleProfessional.css";
import { Toasts } from "../../components/toast/Toasts.tsx";
import "../adminCRUDS/adminPanel.css";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";

import { SkeletonGrid } from "../../components/skeleton/Skeleton.tsx";
import { GridModule } from "./gridSchedule/gridModule.tsx";
import type { Person, Schedule, Room, Office, City } from "../types.ts";
import type { ScheduleViewMode } from "./scheduleTypes.ts";
import { GridFilter } from "./gridFilter/gridFilter.tsx";
import { ProfessionalPicker } from "./professionalPicker/ProfessionalPicker.tsx";
import { useEffect, useState } from "react";
import { ScheduleModal } from "./scheduleModal/scheduleModal.tsx";
import { findProfessionalSchedules, findRoomSchedules, createSchedule, removeSchedule, updateScheduleDuration } from "./scheduleServices.ts";
import { findAllActiveProfessionals } from "../adminCRUDS/adminUsers/usersService.ts";
import { toast } from "react-toastify";
import { findAllActiveRooms } from "../adminCRUDS/adminRooms/RoomService.ts";
import { findAllActiveCities } from "../adminCRUDS/adminCities/CityService.ts";
import { findAllActiveOffices } from "../adminCRUDS/adminOffices/OfficeService.ts";
import { daysSpanish } from "./scheduleTypes.ts";
import { findPerson, getDecodedToken } from "../commonServices.ts";
import { DayGrid } from "../agenda/DayGrid.tsx";
import { findAgendaDay, weekDays, type AgendaDay } from "../agenda/agendaService.ts";

const openingTime = "08:00";
const closingTime = "21:00";

export function ScheduleProfessional() {
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | undefined>(undefined);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();

  const [professionalsList, setProfessionalsList] = useState<Person[]>([]);
  const [professional, setProfessional] = useState<Person | undefined>(undefined);
  const [isProfessional, setIsProfessional] = useState(false); // el usuario logueado es el profesional dueño de la agenda

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [viewMode, setViewMode] = useState<ScheduleViewMode>("professional");
  const [roomToFilter, setRoomToFilter] = useState<Room | undefined>(undefined);

  // Modo día: la grilla se da vuelta y las columnas pasan a ser las salas.
  const [weeksAhead, setWeeksAhead] = useState(0);
  const [dayDate, setDayDate] = useState<string>("");
  const [dayShows, setDayShows] = useState<"schedules" | "appointments">("schedules");
  const [dayData, setDayData] = useState<AgendaDay | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Quién está mirando: si es un profesional ve su propia agenda y no hay selector.
  useEffect(() => {
    const decoded = getDecodedToken();
    if (!decoded) return;

    if (decoded.type === "professional") {
      setIsProfessional(true);
      findPerson(decoded.email)
        .then((data) => {
          if (!data) {
            toast.error("No se encontró el profesional");
            return;
          }
          setProfessional(data);
        })
        .catch((err) => toast.error(`Error al cargar al profesional: ${err.message}`));
      return;
    }

    // Admin: se abre la ventana previa de búsqueda
    setLoadingProfessionals(true);
    setPickerOpen(true);
    findAllActiveProfessionals()
      .then((data) => setProfessionalsList(data))
      .catch((err) => toast.error(`Error cargando profesionales: ${err.message}`))
      .finally(() => setLoadingProfessionals(false));
  }, []);

  // Agenda del profesional elegido
  useEffect(() => {
    if (viewMode !== "professional" || !professional) return;

    setLoadingSchedules(true);
    findProfessionalSchedules(professional.email)
      .then((data) => setSchedules(data))
      .catch((err) => toast.error(`Error al obtener horarios del profesional: ${err.message}`))
      .finally(() => setLoadingSchedules(false));
  }, [professional, viewMode]);

  // Ocupación del consultorio: todos los profesionales que la usan
  useEffect(() => {
    if (viewMode !== "room" || !roomToFilter) return;

    setLoadingSchedules(true);
    findRoomSchedules(roomToFilter.idRoom)
      .then((data) => setSchedules(data))
      .catch((err) => toast.error(`Error al obtener los horarios del consultorio: ${err.message}`))
      .finally(() => setLoadingSchedules(false));
  }, [roomToFilter, viewMode]);

  // El día elegido, con sus horarios y sus turnos. Vienen juntos: el botón que alterna
  // entre las dos vistas no tiene por qué disparar otra carga.
  useEffect(() => {
    if (viewMode !== "day" || !dayDate) return;

    setLoadingDay(true);
    findAgendaDay(dayDate)
      .then(setDayData)
      .catch((err) => {
        toast.error(`No pudimos traer ese día: ${err.message}`);
        setDayData(null);
      })
      .finally(() => setLoadingDay(false));
  }, [dayDate, viewMode]);

  useEffect(() => {
    findAllActiveRooms()
      .then(setRooms)
      .catch((err) => toast.error(`Error cargando consultorios: ${err.message}`));

    findAllActiveOffices()
      .then(setOffices)
      .catch((err) => toast.error(`Error cargando sucursales: ${err.message}`));

    findAllActiveCities()
      .then(setCities)
      .catch((err) => toast.error(`Error cargando ciudades: ${err.message}`));
  }, []);

  // En modo profesional el consultorio solo acota lo que ya se trajo.
  const visibleSchedules =
    viewMode === "professional" && roomToFilter
      ? schedules.filter((s) => String(s.room.idRoom) === String(roomToFilter.idRoom))
      : schedules;

  async function addSchedule(newSchedule: {
    day: string;
    initialHour: string;
    finalHour: string;
    room: string;
    personEmail: string;
    duration: number;
  }) {
    try {
      const createdSchedule = await createSchedule(newSchedule);
      if (createdSchedule) {
        setSchedules([createdSchedule, ...schedules]);
        toast.success(`Horario creado con éxito`);
        setScheduleModalOpen(false);
      }
    } catch (error: any) {
      toast.error(`Error al crear el horario: ${error.message}`);
    }
  }

  async function deleteSchedule(professionalEmail: string, day: string, initialHour: string) {
    try {
      if (await removeSchedule(professionalEmail, day, initialHour)) {
        setSchedules((prev) => prev.filter((s) => !(s.person.email === professionalEmail && s.day === day && s.initialHour === initialHour)));
        toast.success(`Horario eliminado con éxito`);
        setScheduleModalOpen(false);
      }
    } catch (error: any) {
      toast.error(`Error al eliminar el horario: ${error.message}`);
    }
  }

  // El profesional define la duración de los turnos de cada módulo sin pasar por el admin.
  async function changeDuration(day: string, initialHour: string, personEmail: string, duration: number) {
    try {
      await updateScheduleDuration(day, initialHour, personEmail, duration);
      setSchedules((prev) =>
        prev.map((s) => (s.day === day && s.initialHour === initialHour && s.person.email === personEmail ? { ...s, duration } : s))
      );
      toast.success(`Duración actualizada a ${duration} minutos`);
      setScheduleModalOpen(false);
    } catch (error: any) {
      toast.error(`No se pudo actualizar la duración: ${error.message}`);
    }
  }

  function selectProfessional(selected: Person) {
    setProfessional(selected);
    setViewMode("professional");
    setRoomToFilter(undefined);
    setPickerOpen(false);
  }

  function showRoomOccupancy() {
    if (!roomToFilter) return;
    setViewMode("room");
  }

  // Desde la ventana previa se puede arrancar por consultorio, sin profesional elegido.
  function selectRoomFromPicker(room: Room) {
    setRoomToFilter(room);
    setViewMode("room");
    setPickerOpen(false);
  }

  function backToProfessional() {
    setViewMode("professional");
    setRoomToFilter(undefined);
    setDayData(null);
    if (!professional) setPickerOpen(true);
  }

  const inRoomMode = viewMode === "room" && roomToFilter;
  const inDayMode = viewMode === "day";

  const days = weekDays(weeksAhead);

  /** Entra al modo día parado en el primero de la semana que se esté mirando. */
  function showDay(date?: string) {
    setViewMode("day");
    setDayDate(date ?? days.find((entry) => entry.isToday)?.date ?? days[0].date);
  }

  function pickWeek(next: number) {
    const upcoming = weekDays(next);
    setWeeksAhead(next);
    setDayDate(upcoming.find((entry) => entry.isToday)?.date ?? upcoming[0].date);
  }

  const title = inDayMode
    ? dayData
      ? `${dayData.day.charAt(0).toUpperCase() + dayData.day.slice(1)} ${Number(dayData.date.slice(8))}`
      : "El día completo"
    : inRoomMode
    ? `Ocupación de ${roomToFilter.description}`
    : professional
    ? `${professional.surname}, ${professional.name}`
    : "Horarios";

  const subtitle = inDayMode
    ? dayShows === "schedules"
      ? "Quién atiende ese día, consultorio por consultorio"
      : "Todos los turnos de ese día, consultorio por consultorio"
    : inRoomMode
    ? "Horarios de todos los profesionales en este consultorio. Solo lectura."
    : professional
    ? professional.speciality || "Agenda semanal"
    : "Elegí un profesional o un consultorio para empezar";

  const filter = (
    <GridFilter
      rooms={rooms}
      viewMode={viewMode}
      selectedRoom={roomToFilter}
      onSelectRoom={setRoomToFilter}
      onClearRoom={() => {
        setRoomToFilter(undefined);
        setViewMode("professional");
        if (!professional) setPickerOpen(true);
      }}
      onShowRoomOccupancy={showRoomOccupancy}
    />
  );

  // El profesional logueado ve su propia agenda: sin selector ni header de admin.
  if (isProfessional) {
    return (
      <div className="adm-page">
        <AdminHeader
          title="Mis horarios"
          subtitle={
            professional
              ? "Tocá un módulo para ver su detalle y definir la duración de los turnos"
              : "Cargando tu agenda…"
          }
          backTo="/ProfessionalHome"
          actions={filter}
        />
        <Toasts />
        <div className="schedule-subcontainer-full">
          <div className="schedule-container">
            {loadingSchedules || !professional ? (
              <SkeletonGrid />
            ) : (
              <GridModule
                schedules={visibleSchedules}
                daysSpanish={daysSpanish}
                openingTime={openingTime}
                closingTime={closingTime}
                setScheduleModalOpen={setScheduleModalOpen}
                setSelectedSchedule={setSelectedSchedule}
                setSelectedKey={setSelectedKey}
              />
            )}
          </div>
        </div>
        {professional && (
          <ScheduleModal
            isOpen={scheduleModalOpen}
            onClose={() => setScheduleModalOpen(false)}
            schedule={selectedSchedule}
            cellKey={selectedKey}
            daysSpanish={daysSpanish}
            professional={professional}
            rooms={rooms}
            offices={offices}
            cities={cities}
            onCreate={null}
            onDelete={null}
            isProfessional={true}
            onUpdateDuration={changeDuration}
          />
        )}
      </div>
    );
  }

  // Vista de admin
  return (
    <div className="adm-page">
      <AdminHeader
        title={title}
        subtitle={subtitle}
        actions={
          inDayMode ? (
            <>
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={() => setDayShows(dayShows === "schedules" ? "appointments" : "schedules")}
              >
                {dayShows === "schedules" ? "Ver los turnos" : "Ver los horarios"}
              </button>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={backToProfessional}>
                Volver
              </button>
            </>
          ) : (
            <>
              {inRoomMode && professional && (
                <button type="button" className="adm-btn adm-btn-ghost" onClick={backToProfessional}>
                  Volver a la agenda
                </button>
              )}
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => showDay()}>
                Ver un día completo
              </button>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setPickerOpen(true)}>
                {professional || inRoomMode ? "Cambiar" : "Elegir profesional o consultorio"}
              </button>
              {filter}
            </>
          )
        }
      />

      <Toasts />

      {inRoomMode && (
        <p className="schedule-mode-note">
          Estás viendo el consultorio completo. Las franjas muestran qué profesional lo ocupa; desde acá no se crean ni se borran horarios.
        </p>
      )}

      {inDayMode && (
        <>
          <p className="schedule-mode-note">
            {dayShows === "schedules"
              ? "Una columna por consultorio, y cada franja es un módulo de atención. El color es del profesional: el mismo en todos los consultorios donde atienda ese día."
              : "Los mismos consultorios, con los turnos que hay cargados. Los cancelados no se dibujan."}
          </p>

          <div className="dg-days">
            <div className="adm-chips">
              {days.map((entry) => (
                <button
                  key={entry.date}
                  type="button"
                  className={`${dayDate === entry.date ? "active" : ""} ${entry.isToday ? "dg-day-today" : ""}`}
                  aria-pressed={dayDate === entry.date}
                  onClick={() => setDayDate(entry.date)}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="dg-week">
              <button
                type="button"
                className="adm-btn adm-btn-ghost"
                onClick={() => pickWeek(0)}
                disabled={weeksAhead === 0}
              >
                Esta semana
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-ghost"
                onClick={() => pickWeek(1)}
                disabled={weeksAhead === 1}
              >
                La que viene
              </button>
            </div>
          </div>
        </>
      )}

      <div className="schedule-container">
        {inDayMode ? (
          loadingDay || !dayData ? (
            <SkeletonGrid />
          ) : (
            <>
              <DayGrid data={dayData} mode={dayShows} />
              {dayShows === "appointments" && dayData.cancelled > 0 && (
                <p className="schedule-mode-note">
                  Además hay {dayData.cancelled} {dayData.cancelled === 1 ? "turno cancelado" : "turnos cancelados"} ese día,
                  que no se dibujan.
                </p>
              )}
            </>
          )
        ) : loadingSchedules ? (
          <SkeletonGrid />
        ) : !professional && !inRoomMode ? (
          <div className="adm-panel">
            <div className="adm-empty">
              Elegí un profesional para ver su agenda, o un consultorio para ver su ocupación.
              <br />
              <button type="button" className="adm-btn adm-btn-primary" style={{ marginTop: 16 }} onClick={() => setPickerOpen(true)}>
                Elegir profesional o consultorio
              </button>
            </div>
          </div>
        ) : (
          <GridModule
            schedules={visibleSchedules}
            daysSpanish={daysSpanish}
            openingTime={openingTime}
            closingTime={closingTime}
            setScheduleModalOpen={setScheduleModalOpen}
            setSelectedSchedule={setSelectedSchedule}
            setSelectedKey={setSelectedKey}
            showProfessional={!!inRoomMode}
            readOnly={!!inRoomMode}
          />
        )}
      </div>

      <ProfessionalPicker
        isOpen={pickerOpen}
        professionals={professionalsList}
        loading={loadingProfessionals}
        onSelect={selectProfessional}
        rooms={rooms}
        onSelectRoom={selectRoomFromPicker}
        onClose={professional || inRoomMode ? () => setPickerOpen(false) : undefined}
      />

      {professional && !inRoomMode && (
        <ScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          schedule={selectedSchedule}
          cellKey={selectedKey}
          daysSpanish={daysSpanish}
          professional={professional}
          rooms={rooms}
          offices={offices}
          cities={cities}
          onCreate={addSchedule}
          onDelete={deleteSchedule}
          isProfessional={false}
        />
      )}
    </div>
  );
}
