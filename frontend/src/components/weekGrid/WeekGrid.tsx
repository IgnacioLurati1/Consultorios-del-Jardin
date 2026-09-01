import type { ReactNode } from "react";
import { addDays, formatShortDate, toISODate } from "../../pages/appointments/appointmentTypes.ts";
import "./weekGrid.css";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface WeekGridDay {
  date: Date;
  /** Lo que va dentro de la columna. */
  content: ReactNode;
  /** Sin nada que mostrar: en celular la columna directamente no aparece. */
  empty: boolean;
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

        return (
          <div className={`week-grid-day ${key === todayISO ? "today" : ""} ${empty ? "is-empty" : ""}`} key={key}>
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
