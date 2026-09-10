import { orm } from "../shared/db/orm.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { ACTIVE_APPOINTMENT_STATES, AppointmentService } from "../appointments/appointments.service.js";
import { AppError, badRequest, conflict, notFound } from "../shared/errors.js";
import { startOfDay, toISODate } from "../shared/dates.js";
import { readAttendance } from "./attendance.token.js";

const em = orm.em;

/** Lo que muestra la página del link: de qué turno se trata y cómo está. */
export interface AttendanceView {
  numAppointment: number;
  date: string;
  initialHour: string;
  finalHour: string;
  professional: { name: string; surname: string; speciality: string | null };
  room: string | null;
  status: "pending" | "accepted" | "assisted" | "missed" | "cancelled";
  confirmedAt: Date | null;
}

/**
 * La respuesta al mail del día anterior.
 *
 * "Sí" deja anotado que viene y nada más: el turno ya estaba confirmado. "No" es la misma
 * baja que haría el paciente desde sus turnos, con todo lo que trae —el aviso al
 * profesional, y a la lista de espera si llegó con tiempo—, y por eso pasa por el mismo
 * camino y no por uno propio.
 */
export class AttendanceService {
  private appointments = new AppointmentService();

  private async load(token: string): Promise<Appointment> {
    const read = readAttendance(token);
    if (!read) throw notFound("Este link no es válido. Puede que se haya cortado al copiarlo del mail");
    if (read.expired) throw new AppError("El turno ya empezó, así que este link dejó de servir", 410);

    const appointment = await em.findOne(
      Appointment,
      { numAppointment: read.numAppointment },
      { populate: ["professional", "patient", "room"] }
    );

    if (!appointment || !appointment.patient) throw notFound("Ese turno ya no existe");
    return appointment;
  }

  private viewOf(appointment: Appointment): AttendanceView {
    const cancelled = !ACTIVE_APPOINTMENT_STATES.includes(appointment.state);

    return {
      numAppointment: appointment.numAppointment!,
      date: toISODate(startOfDay(appointment.date)),
      initialHour: String(appointment.initialHour).slice(0, 5),
      finalHour: String(appointment.finalHour).slice(0, 5),
      professional: {
        name: appointment.professional.name,
        surname: appointment.professional.surname,
        speciality: appointment.professional.speciality ?? null,
      },
      room: appointment.room?.description ?? null,
      status: cancelled ? "cancelled" : (appointment.state as AttendanceView["status"]),
      confirmedAt: appointment.attendanceConfirmedAt ?? null,
    };
  }

  async view(token: string): Promise<AttendanceView> {
    return this.viewOf(await this.load(token));
  }

  async answer(token: string, answer: unknown): Promise<AttendanceView> {
    if (answer !== "yes" && answer !== "no") throw badRequest("La respuesta tiene que ser sí o no");

    const appointment = await this.load(token);

    if (!ACTIVE_APPOINTMENT_STATES.includes(appointment.state)) throw conflict("Este turno ya estaba cancelado");
    if (appointment.state === "assisted" || appointment.state === "missed") throw conflict("Este turno ya pasó");

    if (answer === "yes") {
      if (appointment.state !== "accepted") throw conflict("Este turno todavía no está confirmado por el profesional");

      // Contestar dos veces no cambia la hora: la que vale es la primera.
      if (!appointment.attendanceConfirmedAt) {
        appointment.attendanceConfirmedAt = new Date();
        await em.flush();
      }

      return this.viewOf(appointment);
    }

    await this.appointments.cancelAppointment(appointment.numAppointment!, appointment.patient!.email);
    return this.view(token);
  }
}
