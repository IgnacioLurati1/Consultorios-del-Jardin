import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/modal/Modal.tsx";
import { SkeletonList } from "../../components/skeleton/Skeleton.tsx";
import { describeState } from "../appointments/appointmentTypes.ts";
import {
  findAgendaDay,
  type AgendaAppointment,
  type AgendaDay,
  type AgendaPerson,
  type AgendaWeekDay,
} from "./agendaService.ts";

/** El backend manda las horas como "09:00:00"; para leerlas alcanza con hh:mm. */
const hhmm = (hour: string) => hour.slice(0, 5);

const fullName = (person: AgendaPerson) => `${person.name} ${person.surname}`;

/** "2026-09-16" → "Miércoles 16 de septiembre". Mayúscula solo en la primera letra. */
function longDay(iso: string): string {
  const label = new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  // En es-AR sale "martes, 15 de septiembre": la coma después del día no se escribe.
  const clean = label.replace(",", "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Qué clase de turno es, en una palabra. Los normales no dicen nada: son la mayoría. */
function kindOf(appointment: AgendaAppointment): string {
  if (appointment.overbooked) return "turno especial";
  if (appointment.imported) return "importado";
  if (appointment.recurring) return "repetido";
  return "";
}

interface Attending {
  person: AgendaPerson;
  modules: { room: string; from: string; to: string }[];
  appointments: number;
}

/**
 * Un día de la semana entero, al tocar su tarjeta.
 *
 * La tarjeta resume y corta los nombres a dos líneas para no empujar a las de al lado. Acá
 * entra todo: quién abre y quién cierra sin cortar, quién atiende en qué sala y a qué hora,
 * y cada turno con su paciente y su estado. Lo que resume la tarjeta ya vino con la semana;
 * el detalle se pide recién al abrir, que es cuando hace falta.
 */
export function WeekDayModal({ day, onClose }: { day: AgendaWeekDay | null; onClose: () => void }) {
  const [data, setData] = useState<AgendaDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!day) return;
    let current = true;

    setData(null);
    setError(null);
    findAgendaDay(day.date)
      .then((agenda) => current && setData(agenda))
      .catch((problem: Error) => current && setError(problem.message));

    return () => {
      current = false;
    };
  }, [day]);

  const roomName = useMemo(() => {
    const names = new Map<number, string>();
    const offices = new Set(data?.rooms.map((room) => room.office.idOffice));

    // La sede va solo si hay más de una: con una sola, repetirla en cada renglón es ruido.
    for (const room of data?.rooms ?? [])
      names.set(room.idRoom, offices.size > 1 ? `${room.description} · ${room.office.description}` : room.description);

    return (idRoom: number) => names.get(idRoom) ?? "Sin sala";
  }, [data]);

  // Quién atiende: los módulos de cada uno, y también quien solo tiene turnos sueltos.
  const attending = useMemo(() => {
    const byEmail = new Map<string, Attending>();
    const entry = (person: AgendaPerson) => {
      const found = byEmail.get(person.email) ?? { person, modules: [], appointments: 0 };
      byEmail.set(person.email, found);
      return found;
    };

    for (const schedule of data?.schedules ?? [])
      entry(schedule.professional).modules.push({
        room: roomName(schedule.idRoom),
        from: hhmm(schedule.initialHour),
        to: hhmm(schedule.finalHour),
      });

    for (const appointment of data?.appointments ?? []) entry(appointment.professional).appointments++;

    return [...byEmail.values()]
      .map((item) => ({ ...item, modules: item.modules.sort((a, b) => a.from.localeCompare(b.from)) }))
      .sort((a, b) => (a.modules[0]?.from ?? "99").localeCompare(b.modules[0]?.from ?? "99") || fullName(a.person).localeCompare(fullName(b.person)));
  }, [data, roomName]);

  const appointments = useMemo(
    () =>
      [...(data?.appointments ?? [])].sort(
        (a, b) => a.initialHour.localeCompare(b.initialHour) || roomName(a.idRoom).localeCompare(roomName(b.idRoom))
      ),
    [data, roomName]
  );

  if (!day) return null;

  const counts = [
    plural(day.appointments, "turno", "turnos"),
    plural(day.patients, "paciente", "pacientes"),
    plural(day.professionals, "profesional", "profesionales"),
  ];
  if (data && data.cancelled > 0) counts.push(plural(data.cancelled, "cancelado", "cancelados"));

  return (
    <Modal open onClose={onClose} size="lg" title={longDay(day.date)} subtitle={`${day.isToday ? "Hoy · " : ""}${counts.join(" · ")}`}>
      {(day.earliest || day.peak) && (
        <div className="ui-section">
          <dl className="wkm-summary">
            {day.earliest && (
              <div>
                <dt>Abre</dt>
                <dd>
                  <strong>{day.earliest.hour}</strong>
                  <span>{day.earliest.professionals.map(fullName).join(", ")}</span>
                </dd>
              </div>
            )}
            {day.latest && (
              <div>
                <dt>Cierra</dt>
                <dd>
                  <strong>{day.latest.hour}</strong>
                  <span>{day.latest.professionals.map(fullName).join(", ")}</span>
                </dd>
              </div>
            )}
            {day.peak && (
              <div>
                <dt>Más cargado</dt>
                <dd>
                  <strong>
                    {day.peak.from} a {day.peak.to}
                  </strong>
                  <span>{plural(day.peak.appointments, "turno a la vez", "turnos a la vez")}</span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {error ? (
        <p className="ui-alert ui-alert-error">{error}</p>
      ) : !data ? (
        <div className="ui-section">
          <SkeletonList rows={4} />
        </div>
      ) : (
        <>
          <div className="ui-section">
            <h3 className="ui-section-title">Quién atiende</h3>
            {attending.length === 0 ? (
              <p className="wk-quiet">Nadie atiende este día.</p>
            ) : (
              <ul className="wkm-list">
                {attending.map(({ person, modules, appointments: count }) => (
                  <li key={person.email} className="wkm-person">
                    <div>
                      <strong>{fullName(person)}</strong>
                      <span className="wkm-muted">
                        {[person.speciality, plural(count, "turno", "turnos")].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <div className="wkm-modules">
                      {modules.length === 0 ? (
                        <span className="wkm-muted">Sin horario fijo este día</span>
                      ) : (
                        modules.map((module) => (
                          <span key={`${module.room}-${module.from}`}>
                            <strong>
                              {module.from} a {module.to}
                            </strong>{" "}
                            <span className="wkm-muted">{module.room}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ui-section">
            <h3 className="ui-section-title">Turnos</h3>
            {appointments.length === 0 ? (
              <p className="wk-quiet">Sin turnos cargados.</p>
            ) : (
              <ul className="wkm-list">
                {appointments.map((appointment) => {
                  const state = describeState(appointment.state);
                  const kind = kindOf(appointment);

                  return (
                    <li key={appointment.numAppointment} className="wkm-appointment">
                      <span className="wkm-hour">
                        {hhmm(appointment.initialHour)}
                        <span className="wkm-muted">{hhmm(appointment.finalHour)}</span>
                      </span>
                      <span className="wkm-people">
                        <strong>{appointment.patient ? fullName(appointment.patient) : "Sin paciente"}</strong>
                        <span className="wkm-muted">
                          con {fullName(appointment.professional)} · {roomName(appointment.idRoom)}
                          {kind ? ` · ${kind}` : ""}
                        </span>
                      </span>
                      <span className={state.className}>{state.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
