import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { toast } from "react-toastify";
import { useUndo, type Undoable } from "../../context/UndoContext.tsx";
import { escribiendo } from "../../lib/shortcuts.ts";
import type { Appointment, PaymentState, Person, RecurrenceFrequency, Room } from "../types.ts";
import { describePayment, describeState, isCancelled, isOwnBooking, type AppointmentState } from "./appointmentTypes.ts";
import {
  acceptAppointment,
  addPatientToAppointment,
  cancelAppointmentService,
  updateAppointment,
  updateAppointmentRecord,
  updateAppointmentPayment,
} from "./appointmentsService.ts";
import { createRecurrence, stopRecurrence } from "./recurrencesService.ts";
import { countWaitlistMatches } from "./waitlist/waitlistService.ts";
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
  const { remember } = useUndo();

  const [selected, setSelected] = useState<Appointment | undefined>(undefined);
  /** El turno que el teclado quiere bajar y todavía no se confirmó. */
  const [cancelling, setCancelling] = useState<Appointment | undefined>(undefined);
  /**
   * Cuánta gente espera el horario del turno que se está por bajar. Va con el número de
   * turno porque la respuesta llega después de abrir la ventana, y si en el medio se abrió
   * otra, esa cuenta es de otro turno.
   */
  const [waitlist, setWaitlist] = useState<{ num: number; count: number } | null>(null);

  /*
   * El turno que la tecla va a agarrar: el que está debajo del mouse, y si no hay ninguno,
   * el que quedó con el foco.
   *
   * Antes esto era un `onKeyDown` colgado del botón del turno, y entonces la tecla solo
   * hacía algo si ese botón tenía el foco, o sea después de haberle abierto la ficha y
   * cerrarla. Apuntar con el mouse es la misma puntería que ya pide el click derecho.
   *
   * Van en `ref` y no en estado porque mover el mouse por una grilla de turnos volvería a
   * dibujar la pantalla entera en cada casillero.
   */
  const bajoElMouse = useRef<Appointment | undefined>(undefined);
  const conElFoco = useRef<Appointment | undefined>(undefined);
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

  /**
   * A qué estado pasa un turno con cada click derecho.
   *
   * Los dos primeros pasos son la vida normal de un turno, en orden. Los dos últimos van
   * y vienen entre sí porque son los dos finales posibles y equivocarse entre ellos es lo
   * que de verdad pasa: se marca "No vino" y el paciente estaba en la sala de espera.
   */
  const siguienteEstado: Record<AppointmentState, AppointmentState> = {
    pending: "accepted",
    accepted: "assisted",
    assisted: "missed",
    missed: "assisted",
  };

  /**
   * Deja un turno en un estado.
   *
   * Confirmar un pedido tiene endpoint propio porque además manda el mail al paciente; el
   * resto de los cambios son registro clínico y van por el otro. Volver a "accepted" desde
   * "assisted" usa el segundo a propósito: es una corrección, y no hay nada nuevo que
   * avisarle a nadie.
   */
  function ponerEstado(appointment: Appointment, state: AppointmentState) {
    return state === "accepted" && appointment.state === "pending"
      ? acceptAppointment(appointment.numAppointment)
      : updateAppointmentRecord(appointment.numAppointment, { state, patientEmail: appointment.patient?.email });
  }

  /** Avanza un turno al estado que sigue, y deja anotado cómo volver. */
  function cycleState(appointment: Appointment) {
    if (isCancelled(appointment.state)) {
      toast.info("Un turno cancelado ya no cambia de estado.");
      return;
    }

    const desde = appointment.state as AppointmentState;
    const hasta = siguienteEstado[desde];

    ponerEstado(appointment, hasta)
      .then(() => {
        toast.success(`Turno marcado como "${describeState(hasta).label}"`);

        remember({
          label: `El turno volvió a "${describeState(desde).label}"`,
          // El mail no se puede desenviar. Decirlo es la diferencia entre creer que no
          // pasó nada y saber que hay que llamar al paciente.
          note:
            desde === "pending"
              ? "El mail de confirmación ya había salido. Al paciente le llegó igual."
              : undefined,
          undo: () =>
            updateAppointmentRecord(appointment.numAppointment, {
              state: desde,
              patientEmail: appointment.patient?.email,
            }).then(reload),
        });

        reload();
      })
      .catch((err: any) => {
        remember(null);
        toast.error(err.message);
      });
  }

  /**
   * Lo que se puede intentar bajar con el teclado, y lo que no.
   *
   * Son las mismas reglas que tiene el botón rojo de la ficha, dichas antes de abrir la
   * ventana: preguntar "¿lo cancelás?" para después contestar que no se podía es hacer
   * perder dos clicks y dejar la duda de si se canceló o no.
   */
  function askCancel(appointment: Appointment) {
    if (isCancelled(appointment.state)) {
      toast.info("Ese turno ya está cancelado.");
      return;
    }
    if (appointment.state === "assisted") {
      toast.info("Un turno que ya figura como asistido no se puede cancelar.");
      return;
    }
    if (appointment.state === "missed") {
      toast.info('Un turno marcado como "No vino" no se puede cancelar.');
      return;
    }

    setWaitlist(null);
    setCancelling(appointment);
    waitingFor(appointment).then((count) => setWaitlist({ num: appointment.numAppointment, count }));
  }

  /**
   * Cuánta gente de la lista de espera recibiría el aviso si este turno se da de baja.
   *
   * Solo del lado de quien atiende: cuando baja el paciente el aviso sale solo. Y nunca en
   * el turno que el profesional sacó para atenderse él, que ahí es el paciente. Si no se
   * puede preguntar, es cero y la baja es la de siempre: la lista de espera no puede frenar
   * una cancelación.
   */
  function waitingFor(appointment: Appointment): Promise<number> {
    if (!isProfessional || (user && isOwnBooking(appointment, user))) return Promise.resolve(0);
    return countWaitlistMatches(appointment.numAppointment).catch(() => 0);
  }

  /**
   * Retroceso y Supr, escuchados en toda la ventana.
   *
   * Tiene que ser acá arriba y no en el botón del turno: al que apunta con el mouse no le
   * pasa el foco por ningún lado, y sin foco un `onKeyDown` del botón no se entera de
   * nada. El turno sobre el que actúa lo dicen las dos referencias de más arriba.
   *
   * Con una ventana abierta no hace nada. Estando adentro de la ficha de un turno,
   * Retroceso es borrar lo que se está escribiendo en las observaciones, y encima abrir
   * un cartel arriba de otro no se entiende.
   */
  useEffect(() => {
    if (!isProfessional) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (escribiendo(event.target) || document.body.classList.contains("ui-modal-open")) return;

      const appointment = bajoElMouse.current ?? conElFoco.current;
      if (!appointment) return;

      event.preventDefault();
      askCancel(appointment);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // Sin lista de dependencias a propósito: se vuelve a colgar en cada dibujo para que
    // `askCancel` sea siempre el de ahora. Apuntar con el mouse no dibuja nada —para eso
    // están las referencias— así que esto pasa cuando cambia algo de verdad.
  });

  /**
   * Lo que hay que ponerle a un turno para que responda al teclado y al click derecho.
   *
   * Se entrega como props y no como un componente porque un turno se dibuja de tres
   * maneras distintas —tarjeta de la lista, celda de la grilla, renglón del panel— y las
   * tres son botones: alcanza con esparcirlas encima. Para el paciente vuelve vacío, que
   * es lo que hace que la misma tarjeta sirva para los dos.
   */
  function quickActions(appointment: Appointment): HTMLAttributes<HTMLElement> {
    if (!isProfessional) return {};

    // En el turno que el profesional sacó para atenderse él no hay nada que marcar: el
    // estado lo maneja el colega que lo atiende, y el servidor lo rechazaría igual.
    // También lo saca del alcance de Retroceso, que es lo que hace bajar un turno.
    if (user && isOwnBooking(appointment, user)) return {};

    /* Al soltarlo se limpia solo si el que quedó anotado sigue siendo este: entrando de un
       turno al de al lado, el `enter` del nuevo llega antes que el `leave` del viejo. */
    const soltar = (donde: React.MutableRefObject<Appointment | undefined>) => () => {
      if (donde.current?.numAppointment === appointment.numAppointment) donde.current = undefined;
    };

    return {
      onContextMenu: (event) => {
        event.preventDefault();
        cycleState(appointment);
      },
      onMouseEnter: () => {
        bajoElMouse.current = appointment;
      },
      onMouseLeave: soltar(bajoElMouse),
      onFocus: () => {
        conElFoco.current = appointment;
      },
      onBlur: soltar(conElFoco),
    };
  }

  /**
   * Lo que pasa después de tocar un turno: el aviso, cerrar la ficha y volver a pedir la
   * lista.
   *
   * `undoable` es cómo se vuelve atrás, y no pasarlo significa que no se puede: eso borra
   * lo que hubiera anotado la acción anterior, que es justo lo que tiene que pasar. Sin
   * eso, cancelar un turno y apretar Ctrl+Z revertiría el cambio de estado de antes,
   * creyendo uno que está deshaciendo la cancelación.
   */
  function refreshAfter(action: Promise<unknown>, successMessage: string, undoable?: Undoable) {
    action
      .then(() => {
        remember(undoable ?? null);
        toast.success(successMessage);
        setSelected(undefined);
        reload();
      })
      .catch((err: any) => {
        remember(null);
        toast.error(err.message);
      });
  }

  const onAccept = (appointment: Appointment) =>
    refreshAfter(acceptAppointment(appointment.numAppointment), "Turno aceptado", {
      label: 'El turno volvió a "Pendiente"',
      note: "El mail de confirmación ya había salido. Al paciente le llegó igual.",
      undo: () =>
        updateAppointmentRecord(appointment.numAppointment, {
          state: "pending",
          patientEmail: appointment.patient?.email,
        }).then(reload),
    });

  // Un turno pendiente se borra; uno confirmado queda cancelado y en el historial.
  const doCancel = (appointment: Appointment, notifyWaitlist: boolean) =>
    refreshAfter(
      cancelAppointmentService(appointment.numAppointment, isProfessional ? notifyWaitlist : undefined),
      appointment.state === "pending"
        ? "Turno eliminado"
        : notifyWaitlist
          ? "Turno cancelado. Aviso enviado a quienes esperaban ese horario"
          : "Turno cancelado"
    );

  /*
   * El botón rojo de la ficha. Cancela directo, como siempre, salvo que haya gente
   * esperando ese horario: ahí hay algo que decidir y se abre la ventana que pregunta.
   */
  const onCancel = (appointment: Appointment) => {
    waitingFor(appointment).then((count) => {
      if (count === 0) {
        doCancel(appointment, false);
        return;
      }

      setWaitlist({ num: appointment.numAppointment, count });
      setCancelling(appointment);
    });
  };

  const onSaveRecord = (appointment: Appointment, data: { state?: string; observations?: string }) =>
    refreshAfter(
      updateAppointmentRecord(appointment.numAppointment, { ...data, patientEmail: appointment.patient?.email }),
      "Registro guardado",
      {
        label: "Volvió el registro anterior del turno",
        undo: () =>
          updateAppointmentRecord(appointment.numAppointment, {
            state: appointment.state,
            observations: appointment.observations ?? "",
            patientEmail: appointment.patient?.email,
          }).then(reload),
      }
    );

  const onSavePayment = (appointment: Appointment, paymentState: PaymentState, paidAmount: number | null) => {
    // Un turno viejo puede no tener cobro registrado, y "sin registrar" no es un estado
    // que se pueda volver a poner: ahí no hay a dónde volver y no se ofrece deshacer.
    const antes = appointment.paymentState;

    refreshAfter(
      updateAppointmentPayment(appointment.numAppointment, paymentState, paidAmount),
      paymentState === "paid" ? "Turno cobrado" : paymentState === "partial" ? "Cobro parcial registrado" : "Turno marcado sin cobrar",
      antes
        ? {
            label: `El cobro volvió a "${describePayment({ ...appointment, paymentState: antes })?.label ?? antes}"`,
            undo: () => updateAppointmentPayment(appointment.numAppointment, antes, appointment.paidAmount ?? null).then(reload),
          }
        : undefined
    );
  };

  const onAddPatient = (appointment: Appointment, patientEmail: string) =>
    refreshAfter(addPatientToAppointment(appointment.numAppointment, patientEmail), "Paciente asignado");

  const onUpdate = (
    appointment: Appointment,
    data: { date?: string; initialHour?: string; finalHour?: string; room?: string; value?: number }
  ) =>
    refreshAfter(updateAppointment(appointment.numAppointment, data), "Turno actualizado", {
      label: "Volvieron los datos anteriores del turno",
      undo: () =>
        updateAppointment(appointment.numAppointment, {
          date: appointment.date?.slice(0, 10),
          initialHour: appointment.initialHour,
          finalHour: appointment.finalHour,
          room: String(appointment.room.idRoom),
          value: appointment.value ?? 0,
        }).then(reload),
    });

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
    /** Lo que se le pone a un turno para que responda al click derecho y al teclado. */
    quickActions,
    /** Todo lo que le hace falta a <CancelAppointmentModal>. */
    cancelProps: {
      appointment: cancelling,
      waitlistCount: waitlist && cancelling && waitlist.num === cancelling.numAppointment ? waitlist.count : 0,
      onClose: () => setCancelling(undefined),
      onConfirm: (appointment: Appointment, notifyWaitlist: boolean) => {
        setCancelling(undefined);
        doCancel(appointment, notifyWaitlist);
      },
    },
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
