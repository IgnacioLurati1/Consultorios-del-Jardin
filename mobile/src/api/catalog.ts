import api from "./client";
import { City, Office, Province, Room, Schedule } from "./types";

/**
 * El catálogo del consultorio: provincias, localidades, sucursales, consultorios y
 * horarios de atención. Todo lo que administra el admin, más lo que las pantallas de
 * turnos necesitan leer.
 *
 * Los ABM dan de baja en vez de borrar: nada se elimina de verdad, se marca inactivo,
 * porque hay turnos viejos que apuntan a esas filas.
 */

/* ---------- provincias ---------- */

export async function findProvinces(): Promise<Province[]> {
  const { data } = await api.get("/provinces");
  return data.data;
}

export async function findActiveProvinces(): Promise<Province[]> {
  const { data } = await api.get("/provinces/active");
  return data.data;
}

export async function createProvince(nameProvince: string): Promise<Province> {
  const { data } = await api.post("/provinces", { nameProvince, active: true });
  return data.data;
}

export async function renameProvince(id: string, nameProvince: string): Promise<Province> {
  const { data } = await api.put(`/provinces/${id}`, { nameProvince });
  return data.data;
}

export async function toggleProvince(id: string): Promise<void> {
  await api.patch(`/provinces/${id}/toggle-state`);
}

/* ---------- localidades ---------- */

export async function findCities(): Promise<City[]> {
  const { data } = await api.get("/cities");
  return data.data;
}

export async function findActiveCities(): Promise<City[]> {
  const { data } = await api.get("/cities/active");
  return data.data;
}

export async function createCity(nameCity: string, province: string): Promise<City> {
  const { data } = await api.post("/cities", { nameCity, province });
  return data.data;
}

export async function updateCity(idCity: string, nameCity: string, province: string): Promise<City> {
  const { data } = await api.put(`/cities/${idCity}`, { nameCity, province });
  return data.data;
}

export async function toggleCity(idCity: string): Promise<void> {
  await api.patch(`/cities/${idCity}/toggle-state`);
}

/* ---------- sucursales ---------- */

export async function findOffices(): Promise<Office[]> {
  const { data } = await api.get("/offices");
  return data.data;
}

export async function findActiveOffices(): Promise<Office[]> {
  const { data } = await api.get("/offices/active");
  return data.data;
}

export interface OfficeInput {
  description: string;
  openingTime: string;
  closingTime: string;
  city: string;
}

export async function createOffice(input: OfficeInput): Promise<Office> {
  const { data } = await api.post("/offices", { ...input, active: true });
  return data.data;
}

export async function updateOffice(idOffice: string, input: OfficeInput): Promise<Office> {
  const { data } = await api.put(`/offices/${idOffice}`, input);
  return data.data;
}

export async function toggleOffice(idOffice: string): Promise<void> {
  await api.patch(`/offices/${idOffice}/toggle`);
}

/* ---------- consultorios ---------- */

export async function findRooms(): Promise<Room[]> {
  const { data } = await api.get("/rooms");
  return data.data;
}

export async function findActiveRooms(): Promise<Room[]> {
  const { data } = await api.get("/rooms/active");
  return data.data;
}

export async function createRoom(description: string, office: string): Promise<Room> {
  const { data } = await api.post("/rooms", { description, office, active: true });
  return data.data;
}

export async function updateRoom(idRoom: string, description: string, office: string): Promise<Room> {
  const { data } = await api.put(`/rooms/${idRoom}`, { description, office });
  return data.data;
}

export async function toggleRoom(idRoom: string): Promise<void> {
  await api.patch(`/rooms/${idRoom}/toggle-state`);
}

/** Consultorios donde ese profesional atiende en esa sucursal. */
export async function roomsForProfessional(officeId: string, email: string): Promise<{ id_room: string; description: string }[]> {
  const { data } = await api.get(`/rooms/office/professional/${officeId}/${encodeURIComponent(email)}`);
  return data.data;
}

/* ---------- horarios de atención ---------- */

export async function schedulesOf(email: string): Promise<Schedule[]> {
  if (!email) return [];
  const { data } = await api.get(`/schedules/by-email/${encodeURIComponent(email)}`);
  return data.data;
}

/** Todos los horarios de un consultorio, de cualquier profesional: muestra dónde hay lugar. */
export async function schedulesOfRoom(idRoom: string | number): Promise<Schedule[]> {
  const { data } = await api.get(`/schedules/by-room/${idRoom}`);
  return data.data;
}

export interface ScheduleInput {
  day: string;
  initialHour: string;
  finalHour: string;
  room: string;
  personEmail: string;
  duration: number;
}

export async function createSchedule(input: ScheduleInput): Promise<Schedule> {
  const { data } = await api.post("/schedules", {
    day: input.day,
    initialHour: input.initialHour,
    finalHour: input.finalHour,
    room: input.room,
    person: input.personEmail,
    duration: input.duration,
    active: true,
  });
  return data.data;
}

/** Lo único editable de un módulo es cuánto dura cada turno: 30, 45 o 60 minutos. */
export async function updateScheduleDuration(
  day: string,
  initialHour: string,
  personEmail: string,
  duration: number
): Promise<Schedule> {
  const { data } = await api.patch("/schedules", { day, initialHour, person: personEmail, duration });
  return data.data;
}

export async function removeSchedule(personEmail: string, day: string, initialHour: string): Promise<void> {
  await api.delete(`/schedules/by-day-hour/${day}/${initialHour}/${encodeURIComponent(personEmail)}`);
}
