import type { RecurrenceFrequency } from "../../types.ts";
import { FREQUENCY_LABELS } from "../recurrencesService.ts";

interface RepeatFieldsProps {
  frequency: RecurrenceFrequency;
  onFrequency: (frequency: RecurrenceFrequency) => void;
  /** Sin fecha de corte: se repite hasta que la frenen a mano. */
  forever: boolean;
  onForever: (forever: boolean) => void;
  until: string;
  onUntil: (until: string) => void;
  /** El día del turno: antes de esa fecha no tiene sentido cortar. */
  minDate?: string;
  /** El `name` de los radios. Dos formularios abiertos a la vez no pueden compartirlo. */
  name?: string;
  label?: string;
}

/**
 * Las dos decisiones de un turno repetible: cada cuánto y hasta cuándo.
 *
 * Vive aparte porque se pregunta lo mismo en dos momentos —al crear el turno y al abrirlo
 * después desde su ficha— y son la misma pregunta. Cuando estaba escrito dos veces, la
 * segunda versión salió con otra pinta y sin la fecha de corte.
 */
export function RepeatFields({
  frequency,
  onFrequency,
  forever,
  onForever,
  until,
  onUntil,
  minDate,
  name = "repeat-end",
  label = "Repetir este turno",
}: RepeatFieldsProps) {
  return (
    <>
      <label className="ui-field">
        <span>{label}</span>
        <select value={frequency} onChange={(e) => onFrequency(e.target.value as RecurrenceFrequency)}>
          {(Object.keys(FREQUENCY_LABELS) as RecurrenceFrequency[]).map((key) => (
            <option key={key} value={key}>
              {FREQUENCY_LABELS[key]}
            </option>
          ))}
        </select>
        <small>Mismo horario, mismo consultorio y mismo paciente, hasta cuatro semanas para adelante.</small>
      </label>

      <div className="ui-field">
        <span>¿Hasta cuándo?</span>
        <div className="ui-choice-row">
          <label className="ui-choice">
            <input type="radio" name={name} checked={forever} onChange={() => onForever(true)} />
            <span>Sin fecha de corte</span>
          </label>
          <label className="ui-choice">
            <input type="radio" name={name} checked={!forever} onChange={() => onForever(false)} />
            <span>Hasta una fecha</span>
          </label>
        </div>

        {!forever && <input type="date" value={until} min={minDate} onChange={(e) => onUntil(e.target.value)} />}

        <small>
          {forever ? "Se repite hasta que la frenes a mano." : "Ese día es el último en el que se puede crear un turno."}
        </small>
      </div>
    </>
  );
}
