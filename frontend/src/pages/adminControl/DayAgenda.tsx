import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FaChevronLeft, FaChevronRight, FaUsers } from "react-icons/fa6";
import { SkeletonList } from "../../components/skeleton/Skeleton.tsx";
import { Hint } from "../../components/hint/Hint.tsx";
import { findDayAgenda, type CrowdedStretch, type DayAgenda as Agenda, type DayVisit } from "./dayAgendaService.ts";

/** El backend manda las horas como "09:00:00"; para leerlas alcanza con hh:mm. */
const hhmm = (hour: string) => hour?.slice(0, 5) ?? hour;

/** "2026-09-02" → "Miércoles 2 de septiembre". Sin año: se está mirando esta semana. */
function longDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const label = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(date);

  // Mayúscula solo en la primera letra, a mano. `text-transform: capitalize` se la pone
  // a cada palabra y deja "Martes 18 De Noviembre", que en castellano no se escribe así.
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftDay(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Cancelado no llega acá: el backend solo manda turnos vivos. */
function describeState(state: string): { label: string; className: string } {
  switch (state) {
    case "pending":
      return { label: "Pendiente", className: "adm-badge adm-badge-amber" };
    case "accepted":
      return { label: "Confirmado", className: "adm-badge adm-badge-green" };
    case "assisted":
      return { label: "Vino", className: "adm-badge adm-badge-grey" };
    case "missed":
      return { label: "No vino", className: "adm-badge adm-badge-red" };
    default:
      return { label: state, className: "adm-badge adm-badge-grey" };
  }
}

/** Los turnos que entran en algún tramo lleno, para poder marcarlos en la lista. */
function crowdedVisits(crowded: CrowdedStretch[]): Set<string> {
  const keys = new Set<string>();

  for (const stretch of crowded) {
    for (const patient of stretch.patients) keys.add(`${patient.email}|${patient.initialHour}`);
  }

  return keys;
}

/**
 * El día completo del consultorio.
 *
 * La pregunta que contesta no es "qué tiene fulano mañana" —eso ya lo contesta el
 * control por profesional— sino "cuánta gente va a haber y cuándo". Por eso está
 * ordenado por horario de ingreso y agrupado por ese horario: lo que se ve de un
 * vistazo es cuántas personas cruzan la puerta juntas.
 *
 * Los tramos llenos van arriba de todo y no al final: son lo único que se puede
 * anticipar el día anterior, y lo único por lo que alguien abre esta pantalla dos veces.
 */
export function DayAgenda() {
  const [date, setDate] = useState(today());
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    findDayAgenda(date)
      .then((data) => {
        if (!cancelled) setAgenda(data);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(`No pudimos cargar el día: ${err.message}`);
        setAgenda(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  // Agrupados por horario de ingreso: las cuatro personas que entran a las nueve son
  // una sola línea del día, no cuatro renglones sueltos que hay que sumar con la vista.
  const blocks = useMemo(() => {
    const byHour = new Map<string, DayVisit[]>();

    for (const visit of agenda?.visits ?? []) {
      const found = byHour.get(visit.initialHour);
      if (found) found.push(visit);
      else byHour.set(visit.initialHour, [visit]);
    }

    return Array.from(byHour.entries()).map(([hour, visits]) => ({
      hour,
      visits,
      people: new Set(visits.filter((visit) => visit.patient).map((visit) => visit.patient!.email)).size,
    }));
  }, [agenda]);

  const marked = useMemo(() => crowdedVisits(agenda?.crowded ?? []), [agenda]);

  return (
    <>
      <div className="day-picker">
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDate(shiftDay(date, -1))} aria-label="Día anterior">
          <FaChevronLeft />
        </button>

        <input
          type="date"
          className="day-picker-input"
          value={date}
          aria-label="Día que se está mirando"
          onChange={(event) => event.target.value && setDate(event.target.value)}
        />

        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDate(shiftDay(date, 1))} aria-label="Día siguiente">
          <FaChevronRight />
        </button>

        <button type="button" className="adm-btn adm-btn-ghost" disabled={date === today()} onClick={() => setDate(today())}>
          Hoy
        </button>

        <span className="day-picker-label">{longDay(date)}</span>
      </div>

      {loading ? (
        <div className="adm-panel">
          <SkeletonList rows={5} />
        </div>
      ) : !agenda || agenda.visits.length === 0 ? (
        <div className="adm-panel">
          <div className="adm-empty">Ese día no hay ningún turno cargado.</div>
        </div>
      ) : (
        <>
          <div className="day-counts">
            <Count value={agenda.patients} label={agenda.patients === 1 ? "paciente" : "pacientes"} />
            <Count value={agenda.visits.length} label={agenda.visits.length === 1 ? "turno" : "turnos"} />
            <Count
              value={agenda.professionals.length}
              label={agenda.professionals.length === 1 ? "profesional" : "profesionales"}
            />
            <Count value={hhmm(agenda.professionals[0]?.from ?? "")} label="abre" />
            <Count value={hhmm(agenda.professionals.reduce((last, one) => (one.to > last ? one.to : last), ""))} label="cierra" />
          </div>

          {agenda.crowded.length > 0 && (
            <section className="adm-panel day-crowd">
              <div className="adm-panel-head">
                <span className="day-crowd-heading">
                  <FaUsers aria-hidden="true" />
                  Cuándo se llena
                </span>
                <span className="day-crowd-rule">{agenda.crowdLimit} pacientes o más a la vez</span>
              </div>

              <ul className="day-crowd-list">
                {agenda.crowded.map((stretch) => (
                  <li key={`${stretch.from}-${stretch.to}`} className="day-crowd-item">
                    <span className="day-crowd-when">
                      {hhmm(stretch.from)} – {hhmm(stretch.to)}
                    </span>

                    <span className="day-crowd-peak">
                      <Hint
                        text={
                          `En el momento más cargado del tramo hay ${stretch.peak} pacientes distintos en el consultorio al mismo tiempo. ` +
                          `Abajo están los ${stretch.patients.length} que pasan en algún momento entre las ${hhmm(stretch.from)} y las ${hhmm(stretch.to)}, cada uno con su horario.`
                        }
                      >
                        <strong>hasta {stretch.peak} a la vez</strong>
                      </Hint>
                    </span>

                    <span className="day-crowd-who">
                      {/* Cada uno con su hora: el tramo puede durar más que un turno, y sin
                          el horario al lado la lista parece decir que están todos juntos. */}
                      <span className="day-crowd-names">
                        {stretch.patients.map((patient) => (
                          <span key={`${patient.email}-${patient.initialHour}`} className="day-crowd-name">
                            <span className="day-crowd-name-hour">{hhmm(patient.initialHour)}</span>
                            {patient.surname}, {patient.name}
                          </span>
                        ))}
                      </span>

                      <span className="day-crowd-profs">Atienden: {stretch.professionals.join(" · ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="adm-panel day-team">
            <div className="adm-panel-head">Quiénes atienden</div>

            <ul className="day-team-list">
              {agenda.professionals.map((professional) => (
                <li key={professional.email} className="day-team-item">
                  <span className="day-team-hours">
                    {hhmm(professional.from)} – {hhmm(professional.to)}
                  </span>

                  <span className="day-team-who">
                    <strong>
                      {professional.surname}, {professional.name}
                    </strong>
                    {professional.speciality ? <span className="day-muted">{professional.speciality}</span> : null}
                  </span>

                  <span className="day-team-count">
                    {professional.patients} {professional.patients === 1 ? "paciente" : "pacientes"}
                    {professional.visits > professional.patients ? (
                      <span className="day-muted"> · {professional.visits - professional.patients} sin asignar</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="adm-panel day-flow">
            <div className="adm-panel-head">Quiénes vienen, por horario de ingreso</div>

            <ol className="day-blocks">
              {blocks.map((block) => (
                <li key={block.hour} className="day-block">
                  <div className="day-block-hour">
                    <strong>{hhmm(block.hour)}</strong>
                    <span>
                      {block.visits.length} {block.visits.length === 1 ? "turno" : "turnos"}
                      {/* Turnos y personas no son lo mismo cuando alguien tiene dos seguidos,
                          y la regla de "se llena" cuenta personas: se aclara cuando difieren. */}
                      {block.people < block.visits.length ? ` · ${block.people} personas` : ""}
                    </span>
                  </div>

                  <ul className="day-block-visits">
                    {block.visits.map((visit) => {
                      const state = describeState(visit.state);
                      const busy = visit.patient && marked.has(`${visit.patient.email}|${visit.initialHour}`);

                      return (
                        <li key={visit.numAppointment} className={busy ? "day-visit crowded" : "day-visit"}>
                          <span className="day-visit-who">
                            {visit.patient ? (
                              <strong>
                                {visit.patient.surname}, {visit.patient.name}
                              </strong>
                            ) : (
                              <span className="day-muted">Sin paciente asignado</span>
                            )}
                            <span className="day-muted">
                              con {visit.professional.surname}, {visit.professional.name} · hasta {hhmm(visit.finalHour)}
                            </span>
                          </span>

                          <span className="day-visit-room">
                            {visit.room.description}
                            {visit.room.office ? <span className="day-muted"> · {visit.room.office}</span> : null}
                          </span>

                          <span className="day-visit-tags">
                            {visit.overbooked && <span className="appt-tag-over">Sobreturno</span>}
                            <span className={state.className}>{state.label}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </>
  );
}

function Count({ value, label }: { value: number | string; label: string }) {
  if (value === "") return null;

  return (
    <span className="day-count">
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}
