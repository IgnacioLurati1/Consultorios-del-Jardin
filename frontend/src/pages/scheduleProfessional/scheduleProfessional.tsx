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

  // Ocupación de la sala: todos los profesionales que la usan
  useEffect(() => {
    if (viewMode !== "room" || !roomToFilter) return;

    setLoadingSchedules(true);
    findRoomSchedules(roomToFilter.idRoom)
      .then((data) => setSchedules(data))
      .catch((err) => toast.error(`Error al obtener los horarios de la sala: ${err.message}`))
      .finally(() => setLoadingSchedules(false));
  }, [roomToFilter, viewMode]);

  useEffect(() => {
    findAllActiveRooms()
      .then(setRooms)
      .catch((err) => toast.error(`Error cargando salas: ${err.message}`));

    findAllActiveOffices()
      .then(setOffices)
      .catch((err) => toast.error(`Error cargando consultorios: ${err.message}`));

    findAllActiveCities()
      .then(setCities)
      .catch((err) => toast.error(`Error cargando ciudades: ${err.message}`));
  }, []);

  // En modo profesional la sala solo acota lo que ya se trajo.
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

  // Desde la ventana previa se puede arrancar por sala, sin profesional elegido.
  function selectRoomFromPicker(room: Room) {
    setRoomToFilter(room);
    setViewMode("room");
    setPickerOpen(false);
  }

  function backToProfessional() {
    setViewMode("professional");
    setRoomToFilter(undefined);
  }

  const inRoomMode = viewMode === "room" && roomToFilter;

  const title = inRoomMode
    ? `Ocupación de ${roomToFilter.description}`
    : professional
    ? `${professional.surname}, ${professional.name}`
    : "Horarios";

  const subtitle = inRoomMode
    ? "Horarios de todos los profesionales en esta sala. Solo lectura."
    : professional
    ? professional.speciality || "Agenda semanal"
    : "Elegí un profesional o una sala para empezar";

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
          <>
            {inRoomMode && professional && (
              <button type="button" className="adm-btn adm-btn-ghost" onClick={backToProfessional}>
                Volver a la agenda
              </button>
            )}
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setPickerOpen(true)}>
              {professional || inRoomMode ? "Cambiar" : "Elegir profesional o sala"}
            </button>
            {filter}
          </>
        }
      />

      <Toasts />

      {inRoomMode && (
        <p className="schedule-mode-note">
          Estás viendo la sala completa. Las franjas muestran qué profesional la ocupa; desde acá no se crean ni se borran horarios.
        </p>
      )}

      <div className="schedule-container">
        {loadingSchedules ? (
          <SkeletonGrid />
        ) : !professional && !inRoomMode ? (
          <div className="adm-panel">
            <div className="adm-empty">
              Elegí un profesional para ver su agenda, o una sala para ver su ocupación.
              <br />
              <button type="button" className="adm-btn adm-btn-primary" style={{ marginTop: 16 }} onClick={() => setPickerOpen(true)}>
                Elegir profesional o sala
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
