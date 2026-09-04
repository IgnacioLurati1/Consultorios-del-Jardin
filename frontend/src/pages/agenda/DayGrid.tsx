import { useMemo } from "react";
import type { AgendaAppointment, AgendaDay, AgendaSchedule } from "./agendaService.ts";
import "./dayGrid.css";
import { roomLook } from "../../lib/roomLook.ts";
import { FaLeaf, FaRoad, FaStairs } from "react-icons/fa6";

/**
 * Alto de la grilla: dos píxeles por minuto. Con menos, un turno de media hora no da
 * para tres renglones legibles, y esta pantalla la usa gente que necesita leerla.
 */
const PX_PER_MINUTE = 2;

/**
 * Aire arriba y abajo de la primera y la última hora.
 *
 * Las etiquetas van centradas sobre su línea, así que sin este margen la de arriba queda
 * cortada al ras del borde y no se puede leer a qué hora empieza el día.
 */
const PAD = 14;

/**
 * Un color por profesional, estable entre las dos vistas y entre las salas.
 *
 * Es lo que deja seguir a una persona con la vista cuando atiende en dos salas el mismo
 * día, que es justamente lo que esta pantalla existe para mostrar. Sale del email y no
 * del orden en la lista: si mañana entra alguien nuevo, los demás conservan su color.
 */
const PALETTE = ["#3b7658", "#6c788e", "#b7791f", "#8c5b8f", "#2f6f8f", "#a45a44", "#5f7a3c", "#8a6d3b"];

function colorFor(email: string): string {
  let hash = 0;
  for (let index = 0; index < email.length; index++) hash = (hash * 31 + email.charCodeAt(index)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function minutes(hour: string): number {
  const [h, m] = hour.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

interface Span {
  initialHour: string;
  finalHour: string;
}

/**
 * Reparte en carriles lo que se pisa dentro de una misma sala.
 *
 * Dos módulos no deberían solaparse en la misma sala —el alta lo impide— pero dos turnos
 * sí pueden, y un dato viejo también. Cuando pasa, la grilla los pone lado a lado en vez
 * de dibujar uno encima del otro: un choque que no se ve es un choque que no se arregla.
 */
function pack<T extends Span>(items: T[]): { item: T; lane: number; lanes: number }[] {
  const sorted = [...items].sort(
    (a, b) => minutes(a.initialHour) - minutes(b.initialHour) || minutes(a.finalHour) - minutes(b.finalHour)
  );

  const lastOf: number[] = [];
  const placed = sorted.map((item) => {
    let lane = lastOf.findIndex((end) => end <= minutes(item.initialHour));
    if (lane === -1) {
      lastOf.push(minutes(item.finalHour));
      lane = lastOf.length - 1;
    } else {
      lastOf[lane] = minutes(item.finalHour);
    }
    return { item, lane };
  });

  return placed.map((entry) => ({ ...entry, lanes: lastOf.length }));
}

/** Qué clase de turno es, en una palabra. Los normales no dicen nada: son la mayoría. */
function kindOf(appointment: AgendaAppointment): string {
  if (appointment.overbooked) return "sobreturno";
  if (appointment.recurring) return "repetido";
  return "";
}

interface DayGridProps {
  data: AgendaDay;
  /** Qué se dibuja: los módulos de atención, o los turnos de ese día. */
  mode: "schedules" | "appointments";
  onPickAppointment?: (appointment: AgendaAppointment) => void;
}

/**
 * El día completo, con una columna por sala.
 *
 * Es la vuelta de la grilla habitual: la de siempre pregunta qué hace un profesional en
 * la semana, y esta qué pasa en el edificio un día. Por eso las columnas son salas: la
 * pregunta que contesta es "¿qué sala queda libre el martes a las diez?".
 */
/**
 * La marca de la sala al lado de su nombre: un punto de su color, o el dibujo del lugar.
 *
 * Acá no hay iniciales que pintar como en el selector, así que lo que identifica va
 * aparte del nombre y no encima.
 */
function RoomMark({ name }: { name?: string | null }) {
  const look = roomLook(name);
  if (!look) return null;

  if (look.icon) {
    const Pictogram = { leaf: FaLeaf, road: FaRoad, stairs: FaStairs }[look.icon];
    return <Pictogram className="dg-head-icon" aria-hidden="true" />;
  }

  return <span className="dg-head-dot" style={{ background: look.background }} />;
}

export function DayGrid({ data, mode, onPickAppointment }: DayGridProps) {
  const from = minutes(data.opening);
  const to = minutes(data.closing);
  const height = Math.max(to - from, 60) * PX_PER_MINUTE + PAD * 2;

  /** Dónde cae un minuto del día dentro de la columna. */
  const offsetOf = (value: number) => PAD + (value - from) * PX_PER_MINUTE;

  const hours = useMemo(() => {
    const marks: number[] = [];
    for (let mark = Math.ceil(from / 60) * 60; mark <= to; mark += 60) marks.push(mark);
    return marks;
  }, [from, to]);

  const byRoom = useMemo(() => {
    const map = new Map<number, { item: AgendaSchedule | AgendaAppointment; lane: number; lanes: number }[]>();
    const items: (AgendaSchedule | AgendaAppointment)[] = mode === "schedules" ? data.schedules : data.appointments;

    for (const room of data.rooms) {
      map.set(
        room.idRoom,
        pack(items.filter((item) => item.idRoom === room.idRoom))
      );
    }
    return map;
  }, [data, mode]);

  const total = mode === "schedules" ? data.schedules.length : data.appointments.length;

  if (data.rooms.length === 0) {
    return <div className="adm-panel adm-empty">No hay consultorios activos para dibujar la grilla.</div>;
  }

  return (
    <div className="dg-scroll">
      <div className="dg" style={{ gridTemplateColumns: `64px repeat(${data.rooms.length}, minmax(160px, 1fr))` }}>
        <div className="dg-corner" />
        {data.rooms.map((room) => (
          <div key={room.idRoom} className="dg-head">
            <span className="dg-head-name">
              <RoomMark name={room.description} />
              {room.description}
            </span>
            <span className="dg-head-office">{room.office.description}</span>
          </div>
        ))}

        <div className="dg-gutter" style={{ height }}>
          {hours.map((mark) => (
            <span key={mark} className="dg-hour" style={{ top: offsetOf(mark) }}>
              {String(Math.floor(mark / 60)).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {data.rooms.map((room) => (
          <div key={room.idRoom} className="dg-col" style={{ height }}>
            {hours.map((mark) => (
              <span key={mark} className="dg-line" style={{ top: offsetOf(mark) }} />
            ))}

            {(byRoom.get(room.idRoom) ?? []).map(({ item, lane, lanes }) => {
              const top = offsetOf(minutes(item.initialHour));
              const size = Math.max((minutes(item.finalHour) - minutes(item.initialHour)) * PX_PER_MINUTE, 30);
              const color = colorFor(item.professional.email);
              const width = `calc(${100 / lanes}% - 4px)`;
              const left = `calc(${(100 / lanes) * lane}% + 2px)`;

              const isAppointment = "numAppointment" in item;
              const key = isAppointment ? `t-${item.numAppointment}` : `h-${item.professional.email}-${item.initialHour}`;

              const pick = isAppointment && onPickAppointment ? () => onPickAppointment(item) : undefined;

              return (
                <div
                  key={key}
                  className={`dg-block ${pick ? "dg-block-pick" : ""}`}
                  style={{ top, height: size, left, width, borderLeftColor: color, background: `${color}14` }}
                  onClick={pick}
                  onKeyDown={pick ? (event) => (event.key === "Enter" || event.key === " ") && pick() : undefined}
                  role={pick ? "button" : undefined}
                  tabIndex={pick ? 0 : undefined}
                >
                  <span className="dg-block-top">
                    <span className="dg-block-hour">{item.initialHour}</span>
                    <span className="dg-block-meta">{isAppointment ? kindOf(item) : `${item.duration} min`}</span>
                  </span>

                  <span className="dg-block-name">
                    {item.professional.surname}, {item.professional.name}
                  </span>

                  {isAppointment ? (
                    <span className="dg-block-patient">
                      {item.patient ? `${item.patient.surname}, ${item.patient.name}` : "Sin paciente"}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {total === 0 && (
        <p className="dg-empty">
          {mode === "schedules"
            ? "Ningún profesional atiende este día."
            : "No hay turnos cargados para este día."}
        </p>
      )}
    </div>
  );
}
