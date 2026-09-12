import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { SkeletonGrid } from "../../../components/skeleton/Skeleton.tsx";
import { createAppointment, getAvailableAppointmentsForPatient } from "../appointmentsService.ts";
import { addDays, appointmentDate, formatWeekRange, startOfWeek, toISODate } from "../appointmentTypes.ts";
import type { partialAppointment } from "../appointmentTypes.ts";
import type { Office, Person } from "../../types.ts";
import { AvailableWeekGrid } from "./AvailableWeekGrid.tsx";
import { ConfirmAppointmentModal } from "./ConfirmAppointmentModal.tsx";

/** Hasta dónde se puede pedir turno: esta semana y la que viene, igual que en ProfessionalSchedule. */
const WEEKS_AHEAD = 1;

/** Un horario libre de la especialidad, con el profesional que lo atiende. */
type SpecialitySlot = partialAppointment & { professional: Person };

interface SpecialityScheduleProps {
  speciality: string;
  /** Los profesionales de la especialidad que muestra la lista, sin quien está mirando. */
  professionals: Person[];
  office: Office;
  /** Por qué quien mira no puede sacar turno. En null la agenda funciona como siempre. */
  blockedReason?: string | null;
}

/**
 * Todos los horarios libres de una especialidad, de todos sus profesionales a la vez.
 *
 * Es para quien busca un turno de la especialidad y elige por día y hora antes que por
 * nombre: en vez de abrir las agendas de a una y compararlas de memoria, las ve juntas y
 * cada horario dice con quién es.
 *
 * El backend da los horarios de a un profesional, así que se piden todos en paralelo y se
 * juntan acá. Si alguno falla se muestran los demás y se avisa de cuál falta: una agenda
 * que no se pudo consultar no es lo mismo que una agenda sin lugar.
 *
 * Sin lista de espera. La lista de espera es de un profesional —avisa cuando a esa persona
 * se le libera un horario— y acá no se eligió a nadie. Quien quiera anotarse abre la agenda
 * del profesional desde la lista.
 */
export function SpecialitySchedule({ speciality, professionals, office, blockedReason }: SpecialityScheduleProps) {
  const [slots, setSlots] = useState<SpecialitySlot[] | null>(null);
  const [failed, setFailed] = useState<Person[]>([]);
  const [monday, setMonday] = useState<Date>(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<SpecialitySlot | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  /** Cambia al tocar "Reintentar" y con eso se vuelven a pedir las agendas. */
  const [attempt, setAttempt] = useState(0);

  const firstMonday = useMemo(() => startOfWeek(new Date()), []);
  const lastMonday = useMemo(() => addDays(firstMonday, WEEKS_AHEAD * 7), [firstMonday]);

  // La lista llega como un arreglo nuevo en cada dibujo de la pantalla. Lo que dice si
  // cambió de verdad —y si hay que volver a pedir las agendas— son los profesionales.
  const who = professionals.map((professional) => professional.email).join("|");

  useEffect(() => {
    let cancelled = false;

    setSlots(null);
    setFailed([]);
    setMonday(startOfWeek(new Date()));

    Promise.allSettled(
      professionals.map((professional) =>
        getAvailableAppointmentsForPatient(professional.email, office.idOffice).then((data) =>
          data.map((slot) => ({ ...slot, professional }))
        )
      )
    ).then((results) => {
      if (cancelled) return;

      const merged: SpecialitySlot[] = [];
      const missing: Person[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") merged.push(...result.value);
        else missing.push(professionals[index]);
      });

      setSlots(merged);
      setFailed(missing);
    });

    return () => {
      cancelled = true;
    };
    // `professionals` queda afuera a propósito: `who` es la misma lista, dicha de forma
    // que no cambia en cada dibujo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, office.idOffice, attempt]);

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

  async function handleCreate(newAppointment: { date: string; initialHour: string; professionalEmail: string; officeId: string }) {
    try {
      await createAppointment(newAppointment);
      // El horario recién pedido ya no está libre. Solo el de ese profesional: otro puede
      // tener libre la misma hora.
      setSlots((prev) =>
        (prev ?? []).filter(
          (slot) =>
            !(
              slot.professional.email === newAppointment.professionalEmail &&
              toISODate(appointmentDate(slot.date as unknown as string)) === newAppointment.date &&
              slot.initialHour === newAppointment.initialHour
            )
        )
      );
    } catch (error) {
      toast.error(`Error al solicitar el turno: ${(error as Error).message}`);
      throw error;
    }
  }

  const canGoBack = monday > firstMonday;
  const canGoForward = monday < lastMonday;
  const allFailed = slots !== null && professionals.length > 0 && failed.length === professionals.length;

  return (
    <section className="booking-schedule" aria-live="polite">
      <div className="booking-schedule-head">
        <div>
          <h2 className="booking-schedule-title">Horarios de {speciality}</h2>
          <p className="booking-schedule-sub">Todos los profesionales · hasta dos semanas en adelante</p>
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
      ) : allFailed ? (
        <div className="adm-panel">
          <div className="adm-empty">
            Error al consultar las agendas de {speciality}.
            <div className="booking-retry">
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => setAttempt((n) => n + 1)}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      ) : bookable.length === 0 ? (
        <div className="adm-panel">
          <div className="adm-empty">Sin horarios libres de {speciality} en las próximas dos semanas.</div>
        </div>
      ) : (
        <>
          <AvailableWeekGrid
            // La key remonta la grilla al cambiar de semana o de especialidad: es lo que
            // hace que los horarios vuelvan a entrar desde abajo.
            key={`${speciality}-${toISODate(monday)}`}
            slots={weekSlots}
            monday={monday}
            onPick={(slot) => {
              setSelected(slot);
              setModalOpen(true);
            }}
          />

          {weekSlots.length === 0 && <p className="booking-empty-week">Sin horarios libres esta semana.</p>}
        </>
      )}

      {/* Algunas agendas sí llegaron: se muestran y se dice cuáles faltan. */}
      {!allFailed && failed.length > 0 && (
        <p className="ui-alert ui-alert-warn booking-partial">
          Agenda sin consultar de {failed.map((professional) => `${professional.name} ${professional.surname}`).join(", ")}.
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Reintentar
          </button>
        </p>
      )}

      {selected && (
        <ConfirmAppointmentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          appointment={selected}
          professional={selected.professional}
          office={office}
          onCreate={handleCreate}
          blockedReason={blockedReason}
        />
      )}
    </section>
  );
}
