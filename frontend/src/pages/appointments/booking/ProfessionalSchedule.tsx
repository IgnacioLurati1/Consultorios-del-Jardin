import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FaBell, FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { SkeletonGrid } from "../../../components/skeleton/Skeleton.tsx";
import { createAppointment, getAvailableAppointmentsForPatient } from "../appointmentsService.ts";
import { addDays, appointmentDate, formatWeekRange, startOfWeek, toISODate } from "../appointmentTypes.ts";
import type { partialAppointment } from "../appointmentTypes.ts";
import type { Office, Person } from "../../types.ts";
import { AvailableWeekGrid } from "./AvailableWeekGrid.tsx";
import { ConfirmAppointmentModal } from "./ConfirmAppointmentModal.tsx";
import { WaitlistModal } from "../waitlist/WaitlistModal.tsx";

/** Hasta dónde se puede pedir turno: esta semana y la que viene. */
const WEEKS_AHEAD = 1;

interface ProfessionalScheduleProps {
  professional: Person;
  office: Office;
  /** Por qué quien mira no puede sacar turno. En null la agenda funciona como siempre. */
  blockedReason?: string | null;
}

/**
 * Horarios libres de un profesional. Va debajo del listado, en la misma pantalla:
 * elegir otro profesional cambia esta sección y nada más, así comparar agendas es
 * ir tocando nombres en vez de entrar y salir de una vista.
 */
export function ProfessionalSchedule({ professional, office, blockedReason }: ProfessionalScheduleProps) {
  const [slots, setSlots] = useState<partialAppointment[] | null>(null);
  // Aparte de la lista, porque una lista vacía y un error son dos cosas distintas y la
  // pantalla tiene que decirlas distinto. Antes las dos terminaban en "no tiene horarios".
  const [failed, setFailed] = useState(false);
  const [monday, setMonday] = useState<Date>(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<partialAppointment | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  /** Cambia al tocar "Probar de nuevo" y con eso se vuelve a pedir la agenda. */
  const [attempt, setAttempt] = useState(0);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const firstMonday = useMemo(() => startOfWeek(new Date()), []);
  const lastMonday = useMemo(() => addDays(firstMonday, WEEKS_AHEAD * 7), [firstMonday]);

  useEffect(() => {
    let cancelled = false;

    setSlots(null);
    setFailed(false);
    setMonday(startOfWeek(new Date())); // al cambiar de profesional se vuelve a esta semana

    getAvailableAppointmentsForPatient(professional.email, office.idOffice)
      .then((data) => {
        if (!cancelled) setSlots(data);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setSlots([]);
      });

    return () => {
      cancelled = true;
    };
  }, [professional.email, office.idOffice, attempt]);

  // El backend devuelve las próximas semanas completas; acá se recorta a lo que se
  // puede reservar, así la grilla no ofrece nada que después vaya a rechazar.
  const bookable = useMemo(() => {
    if (!slots) return [];
    const limit = addDays(lastMonday, 6);

    return slots.filter((slot) => {
      const date = appointmentDate(slot.date as unknown as string);
      return date >= firstMonday && date <= limit;
    });
  }, [slots, firstMonday, lastMonday]);

  const weekSlots = useMemo(() => {
    const from = toISODate(monday);
    const to = toISODate(addDays(monday, 6));

    return bookable.filter((slot) => {
      const key = toISODate(appointmentDate(slot.date as unknown as string));
      return key >= from && key <= to;
    });
  }, [bookable, monday]);

  async function handleCreate(newAppointment: {
    date: string;
    initialHour: string;
    professionalEmail: string;
    officeId: string;
  }) {
    try {
      await createAppointment(newAppointment);
      // El horario recién pedido ya no está libre.
      setSlots((prev) =>
        (prev ?? []).filter(
          (slot) =>
            !(
              toISODate(appointmentDate(slot.date as unknown as string)) === newAppointment.date &&
              slot.initialHour === newAppointment.initialHour
            )
        )
      );
    } catch (error: any) {
      toast.error(`Error al solicitar el turno: ${error.message}`);
      throw error;
    }
  }

  const canGoBack = monday > firstMonday;
  const canGoForward = monday < lastMonday;

  return (
    <section className="booking-schedule" aria-live="polite">
      <div className="booking-schedule-head">
        <div>
          <h2 className="booking-schedule-title">
            Horarios de {professional.surname}, {professional.name}
          </h2>
          <p className="booking-schedule-sub">
            {professional.speciality} · hasta dos semanas en adelante
          </p>
        </div>
      </div>

      <div className="booking-week-nav">
        <button type="button" className="adm-btn adm-btn-ghost" disabled={!canGoBack} onClick={() => setMonday(addDays(monday, -7))}>
          <FaChevronLeft />
          Semana anterior
        </button>
        <span className="booking-week">{formatWeekRange(monday)}</span>
        <button type="button" className="adm-btn adm-btn-ghost" disabled={!canGoForward} onClick={() => setMonday(addDays(monday, 7))}>
          Semana siguiente
          <FaChevronRight />
        </button>
      </div>

      {slots === null ? (
        <SkeletonGrid columns={7} />
      ) : failed ? (
        <div className="adm-panel">
          {/* "Error al consultar" y no "sin horarios": con el servidor caído, decir que no
              hay lugar manda al paciente a otro lado cuando lo que tiene que hacer es
              volver a intentar. */}
          <div className="adm-empty">
            Error al consultar la agenda de {professional.name}.
            <div className="booking-retry">
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => setAttempt((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      ) : bookable.length === 0 ? (
        <div className="adm-panel">
          <div className="adm-empty">Sin horarios libres en las próximas dos semanas.</div>
        </div>
      ) : (
        <>
          <AvailableWeekGrid
            // La key remonta la grilla al cambiar de semana o de profesional: es lo que
            // hace que los horarios vuelvan a entrar desde abajo.
            key={`${professional.email}-${toISODate(monday)}`}
            slots={weekSlots}
            monday={monday}
            onPick={(slot) => {
              setSelected(slot);
              setModalOpen(true);
            }}
          />

          {weekSlots.length === 0 && (
            <p className="booking-empty-week">Sin horarios libres esta semana.</p>
          )}
        </>
      )}

      {/* La salida para quien miró la agenda y no encontró nada que le sirva. Va también
          cuando no queda ningún horario, que es justo cuando más se la necesita. No va
          cuando no se pudo traer la agenda: ahí lo que hay que hacer es volver a probar, y
          tampoco para quien no puede sacar turnos. */}
      {slots !== null && !failed && !blockedReason && (
        <div className="booking-waitlist">
          <p className="booking-waitlist-text">Lista de espera, con aviso por mail cuando se libera un horario.</p>
          <button type="button" className="adm-btn adm-btn-ghost booking-waitlist-btn" onClick={() => setWaitlistOpen(true)}>
            <FaBell aria-hidden="true" />
            Anotarse en la lista de espera
          </button>
        </div>
      )}

      <WaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} professional={professional} />

      <ConfirmAppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        appointment={selected}
        professional={professional}
        office={office}
        onCreate={handleCreate}
        blockedReason={blockedReason}
      />
    </section>
  );
}
