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

/** Hasta dónde se puede pedir turno: esta semana y la que viene. */
const WEEKS_AHEAD = 1;

interface ProfessionalScheduleProps {
  professional: Person;
  office: Office;
}

/**
 * Horarios libres de un profesional. Va debajo del listado, en la misma pantalla:
 * elegir otro profesional cambia esta sección y nada más, así comparar agendas es
 * ir tocando nombres en vez de entrar y salir de una vista.
 */
export function ProfessionalSchedule({ professional, office }: ProfessionalScheduleProps) {
  const [slots, setSlots] = useState<partialAppointment[] | null>(null);
  const [monday, setMonday] = useState<Date>(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<partialAppointment | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  const firstMonday = useMemo(() => startOfWeek(new Date()), []);
  const lastMonday = useMemo(() => addDays(firstMonday, WEEKS_AHEAD * 7), [firstMonday]);

  useEffect(() => {
    let cancelled = false;

    setSlots(null);
    setMonday(startOfWeek(new Date())); // al cambiar de profesional se vuelve a esta semana

    getAvailableAppointmentsForPatient(professional.email, office.idOffice)
      .then((data) => {
        if (!cancelled) setSlots(data);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(`No pudimos cargar los horarios: ${err.message}`);
        setSlots([]);
      });

    return () => {
      cancelled = true;
    };
  }, [professional.email, office.idOffice]);

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
      toast.error(`No pudimos pedir el turno: ${error.message}`);
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
            {professional.speciality} · se puede pedir turno hasta dos semanas para adelante
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
      ) : bookable.length === 0 ? (
        <div className="adm-panel">
          <div className="adm-empty">
            {professional.name} no tiene horarios libres en las próximas dos semanas.
            <br />
            Probá con otro profesional de la lista.
          </div>
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
            <p className="booking-empty-week">
              Esta semana no queda ningún horario libre. {canGoForward ? "Mirá la semana siguiente." : "Probá con otro profesional."}
            </p>
          )}
        </>
      )}

      <ConfirmAppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        appointment={selected}
        professional={professional}
        office={office}
        onCreate={handleCreate}
      />
    </section>
  );
}
