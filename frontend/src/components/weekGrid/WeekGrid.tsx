import type { ReactNode } from "react";
import { addDays, formatShortDate, toISODate } from "../../pages/appointments/appointmentTypes.ts";
import "./weekGrid.css";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface WeekGridDay {
  date: Date;
  /** Lo que va dentro de la columna. */
  content: ReactNode;
  /** Sin nada que mostrar. Se dibuja el texto de columna vacía en su lugar. */
  empty: boolean;
  /**
   * Tiene algo, pero nada agendado.
   *
   * Es el día de la agenda del profesional donde solo hay ratos libres para ofrecer. En
   * pantalla grande se ve entero, porque los huecos al lado de los días ocupados son
   * justamente lo que se está mirando; en celular desaparece, igual que un día vacío. Ahí
   * las columnas se apilan y una tira de horarios que nadie pidió empuja fuera de la
   * pantalla los días donde sí hay gente.
   */
  minor?: boolean;
}

interface WeekGridProps {
  monday: Date;
  /** Qué poner en cada día. Si no viene, se arma la semana vacía. */
  days: WeekGridDay[];
  /** Texto de la columna sin contenido, en pantallas donde sí se muestra. */
  emptyLabel?: string;
  /**
   * Hace entrar las celdas desde abajo, escalonadas. Sirve donde el contenido cambia
   * seguido (cambiar de profesional o de semana): el movimiento avisa que lo que se
   * está mirando es otra cosa. Para que se repita, hay que remontar la grilla con
   * una `key` que dependa de lo que cambió.
   */
  animate?: boolean;
}

/**
 * Grilla de una semana: una columna por día, con el día de hoy resaltado.
 * La comparten la agenda del profesional y los horarios libres que ve el paciente.
 *
 * En celular las columnas se apilan y las que no tienen nada se esconden: con siete
 * días vacíos uno abajo del otro, encontrar los que sí tienen algo era un ejercicio
 * de paciencia.
 */
export function WeekGrid({ monday, days, emptyLabel = "—", animate = false }: WeekGridProps) {
  const todayISO = toISODate(new Date());

  return (
    <div className={`week-grid ${animate ? "animated" : ""}`}>
      {DAY_NAMES.map((dayName, index) => {
        const date = addDays(monday, index);
        const key = toISODate(date);
        const day = days.find((item) => toISODate(item.date) === key);
        const empty = !day || day.empty;
        // "is-empty" es lo que esconde la columna en celular, así que también se lleva a
        // los días que solo tienen algo para ofrecer.
        const oculto = empty || !!day?.minor;

        return (
          <div className={`week-grid-day ${key === todayISO ? "today" : ""} ${oculto ? "is-empty" : ""}`} key={key}>
            <div className="week-grid-head">
              <span className="week-grid-dayname">{dayName}</span>
              <span className="week-grid-date">{formatShortDate(date)}</span>
            </div>

            <div className="week-grid-cells">{empty ? <div className="week-grid-empty">{emptyLabel}</div> : day.content}</div>
          </div>
        );
      })}
    </div>
  );
}
