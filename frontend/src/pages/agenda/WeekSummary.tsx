import { useEffect, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { findAgendaWeek, type AgendaEdge, type AgendaWeekDay, type AgendaWeek } from "./agendaService.ts";
import "./weekSummary.css";

/** "2026-09-01" → "1 de septiembre". Las dos fechas del encabezado son del mismo año. */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
}

function dayNumber(iso: string): number {
  return Number(iso.slice(8));
}

/** Los apellidos de los que empatan en esa punta del día. Si son tres, van los tres. */
function names(edge: AgendaEdge): string {
  return edge.professionals.map((person) => `${person.name} ${person.surname}`).join(", ");
}

/**
 * Cómo viene la semana.
 *
 * Es lo que se pregunta el que abre y cierra el edificio: a qué hora hay que estar, qué
 * día se llena y cuánta gente va a pasar. Va en la portada del panel y no adentro de los
 * números porque no es un informe para leer: es la respuesta de todos los días.
 *
 * Si el pedido falla, el bloque no se dibuja. Es información de apoyo: dejar un cartel de
 * error arriba de todo el panel sería peor que no mostrar nada.
 */
export function WeekSummary() {
  const [weeksAhead, setWeeksAhead] = useState(0);
  const [data, setData] = useState<AgendaWeek | null>(null);
  const [failed, setFailed] = useState(false);
  const [openPeak, setOpenPeak] = useState<string | null>(null);

  useEffect(() => {
    let current = true;

    setData(null);
    findAgendaWeek(weeksAhead)
      .then((week) => current && setData(week))
      .catch(() => current && setFailed(true));

    return () => {
      current = false;
    };
  }, [weeksAhead]);

  if (failed) return null;

  return (
    <section className="wk">
      <div className="wk-head">
        <h2 className="wk-title">{weeksAhead === 0 ? "Cómo viene la semana" : "La semana que viene"}</h2>

        {data && (
          <span className="wk-range">
            del {shortDate(data.from)} al {shortDate(data.to)}
          </span>
        )}

        <div className="wk-nav">
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => setWeeksAhead(0)}
            disabled={weeksAhead === 0}
            aria-label="Semana en curso"
          >
            <FaChevronLeft />
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            onClick={() => setWeeksAhead(1)}
            disabled={weeksAhead === 1}
            aria-label="Semana que viene"
          >
            <FaChevronRight />
          </button>
        </div>
      </div>

      {!data ? (
        <div className="adm-panel">
          <SkeletonLine height={18} />
          <SkeletonLine width="70%" height={18} />
        </div>
      ) : (
        <div className="wk-days">
          {/* El domingo solo aparece si ese día pasa algo: en general es una tarjeta vacía. */}
          {data.days
            .filter((day) => day.day !== "domingo" || day.appointments > 0 || day.earliest)
            .map((day) => (
              <WeekDayCard
                key={day.date}
                day={day}
                open={openPeak === day.date}
                onTogglePeak={() => setOpenPeak(openPeak === day.date ? null : day.date)}
              />
            ))}
        </div>
      )}
    </section>
  );
}

function WeekDayCard({ day, open, onTogglePeak }: { day: AgendaWeekDay; open: boolean; onTogglePeak: () => void }) {
  const quiet = !day.earliest && day.appointments === 0;

  return (
    <article className={`wk-day ${day.isToday ? "wk-day-today" : ""} ${quiet ? "wk-day-quiet" : ""}`}>
      <h3 className="wk-day-title">
        {day.day} {dayNumber(day.date)}
        {day.isToday && <span className="wk-today">hoy</span>}
      </h3>

      {quiet ? (
        <p className="wk-quiet">Nadie atiende y no hay turnos.</p>
      ) : (
        <>
          {day.earliest && day.latest && (
            <dl className="wk-edges">
              <div>
                <dt>Abre</dt>
                <dd>
                  <strong>{day.earliest.hour}</strong>
                  <span className="wk-who">{names(day.earliest)}</span>
                </dd>
              </div>
              <div>
                <dt>Cierra</dt>
                <dd>
                  <strong>{day.latest.hour}</strong>
                  <span className="wk-who">{names(day.latest)}</span>
                </dd>
              </div>
            </dl>
          )}

          {day.peak ? (
            <>
              <button type="button" className="wk-peak" onClick={onTogglePeak} aria-expanded={open}>
                <span className="wk-peak-band">
                  {day.peak.from} a {day.peak.to}
                </span>
                <span className="wk-peak-note">
                  {day.peak.appointments} {day.peak.appointments === 1 ? "turno" : "turnos"} a la vez
                </span>
              </button>

              {open && (
                <ul className="wk-peak-list">
                  {day.peak.items.map((item) => (
                    <li key={item.numAppointment}>
                      <span className="wk-peak-hour">{item.initialHour}</span>
                      <span className="wk-peak-people">
                        <strong>{item.patient ? `${item.patient.name} ${item.patient.surname}` : "Sin paciente"}</strong>
                        <span className="wk-who">
                          con {item.professional.name} {item.professional.surname} · {item.room}
                          {item.overbooked ? " · sobreturno" : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="wk-quiet">Sin turnos cargados.</p>
          )}

          <p className="wk-counts">
            {day.patients} {day.patients === 1 ? "paciente" : "pacientes"} · {day.professionals}{" "}
            {day.professionals === 1 ? "profesional" : "profesionales"}
          </p>
        </>
      )}
    </article>
  );
}
