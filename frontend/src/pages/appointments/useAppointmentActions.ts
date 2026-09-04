import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { Appointment, PaymentState, Person, RecurrenceFrequency, Room } from "../types.ts";
import {
  acceptAppointment,
  addPatientToAppointment,
  cancelAppointmentService,
  updateAppointment,
  updateAppointmentRecord,
  updateAppointmentPayment,
} from "./appointmentsService.ts";
import { createRecurrence, stopRecurrence } from "./recurrencesService.ts";
import { findAllPatients } from "../patients/patientsService.ts";
import { findAllActiveRooms } from "../adminCRUDS/adminRooms/RoomService.ts";

/**
 * Todo lo que se puede hacer con un turno desde su ficha, en un solo lugar.
 *
 * Lo usan la lista de turnos y la agenda del día del menú del profesional: tocar un
 * turno tiene que hacer lo mismo en los dos lados, y hasta acá eso vivía escrito una
 * sola vez en la lista.
 *
 * `reload` es lo que cada pantalla hace para volver a pedir sus turnos.
 */
export function useAppointmentActions(user: Person | undefined, reload: () => void) {
  const isProfessional = user?.type === "professional";

  const [selected, setSelected] = useState<Appointment | undefined>(undefined);
  const [patients, setPatients] = useState<Person[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // El profesional necesita los pacientes para asignar uno a un turno vacío y los consultorios
  // para poder mover el turno de consultorio. El paciente no edita nada, así que no se piden.
  useEffect(() => {
    if (!isProfessional) return;

    findAllPatients()
      .then(setPatients)
      .catch(() => setPatients([]));

    findAllActiveRooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [isProfessional]);

  function refreshAfter(action: Promise<unknown>, successMessage: string) {
    action
      .then(() => {
        toast.success(successMessage);
        setSelected(undefined);
        reload();
      })
      .catch((err: any) => toast.error(err.message));
  }

  const onAccept = (appointment: Appointment) =>
    refreshAfter(acceptAppointment(appointment.numAppointment), "Turno aceptado");

  // Un turno pendiente se borra; uno confirmado queda cancelado y en el historial.
  const onCancel = (appointment: Appointment) =>
    refreshAfter(
      cancelAppointmentService(appointment.numAppointment),
      appointment.state === "pending" ? "Turno eliminado" : "Turno cancelado"
    );

  const onSaveRecord = (appointment: Appointment, data: { state?: string; observations?: string }) =>
    refreshAfter(
      updateAppointmentRecord(appointment.numAppointment, { ...data, patientEmail: appointment.patient?.email }),
      "Registro guardado"
    );

  const onSavePayment = (appointment: Appointment, paymentState: PaymentState, paidAmount: number | null) =>
    refreshAfter(
      updateAppointmentPayment(appointment.numAppointment, paymentState, paidAmount),
      paymentState === "paid" ? "Turno cobrado" : paymentState === "partial" ? "Pago parcial registrado" : "Turno marcado como impago"
    );

  const onAddPatient = (appointment: Appointment, patientEmail: string) =>
    refreshAfter(addPatientToAppointment(appointment.numAppointment, patientEmail), "Paciente asignado");

  const onUpdate = (
    appointment: Appointment,
    data: { date?: string; initialHour?: string; finalHour?: string; room?: string; value?: number }
  ) => refreshAfter(updateAppointment(appointment.numAppointment, data), "Turno actualizado");

  const onRepeat = (appointment: Appointment, frequency: RecurrenceFrequency, endDate: string | null) =>
    createRecurrence(appointment.numAppointment, frequency, endDate)
      .then(({ created }) => {
        toast.success(created > 0 ? `Turno repetible creado: ${created} turnos más agendados` : "Turno repetible creado");
        setSelected(undefined);
        reload();
      })
      .catch((err: any) => toast.error(err.message));

  const onStopRepeat = (appointment: Appointment) => {
    // Una repetición ya frenada sigue colgada del turno: frenarla de nuevo daría error.
    if (!appointment.recurrence?.active) return;

    stopRecurrence(appointment.recurrence.idRecurrence)
      .then(() => {
        toast.success("Se frenó la repetición. Los turnos ya creados siguen en pie.");
        setSelected(undefined);
        reload();
      })
      .catch((err: any) => toast.error(err.message));
  };

  return {
    /** El turno abierto, o undefined si la ficha está cerrada. */
    selected,
    /** Abre la ficha de un turno. */
    open: setSelected,
    patients,
    rooms,
    /** Todo lo que le hace falta a <AppointmentDetailModal>, menos `user`. */
    detailProps: {
      appointment: selected,
      patients,
      rooms,
      onClose: () => setSelected(undefined),
      onAccept,
      onCancel,
      onSaveRecord,
      onAddPatient,
      onUpdate,
      onRepeat,
      onStopRepeat,
      onSavePayment,
    },
  };
}
