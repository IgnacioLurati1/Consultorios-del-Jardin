import { useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../../components/modal/Modal.tsx";
import { useSimpleText } from "../../../lib/textMode.ts";
import { downloadCalendar, type ExportOptions } from "../importService.ts";
import "./importCalendar.css";

/**
 * Llevarse la agenda a otro calendario.
 *
 * La vuelta de importar, y mucho más corta: acá no hay nada que revisar antes, porque
 * exportar no cambia nada en el sistema. Se elige el tramo, se baja el archivo y listo.
 *
 * Las dos casillas existen por el mismo motivo que en la importación: el calendario
 * personal de alguien suele estar sincronizado con el teléfono y a veces compartido, así
 * que quién queda escrito en el título es una decisión de la persona y no del programa.
 */

interface ExportCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Desde el principio del mes pasado, que es el tramo que se suele querer mirar. */
function lastMonth(): string {
  const date = new Date();
  return toISO(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

/** Hasta dentro de tres meses, para que entren los turnos ya agendados. */
function inThreeMonths(): string {
  const date = new Date();
  return toISO(new Date(date.getFullYear(), date.getMonth() + 3, 0));
}

export function ExportCalendarModal({ isOpen, onClose }: ExportCalendarModalProps) {
  const [options, setOptions] = useState<ExportOptions>({
    from: lastMonth(),
    to: inThreeMonths(),
    includeCancelled: false,
    withPatientName: true,
  });

  const [simple] = useSimpleText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setError("");
    onClose();
  }

  async function download() {
    setBusy(true);
    setError("");

    try {
      const total = await downloadCalendar(options);

      toast.success(
        total === 0
          ? "No había ningún turno en esas fechas, así que el archivo salió vacío"
          : total === 1
            ? "Se bajó el archivo con 1 turno"
            : `Se bajó el archivo con ${total} turnos`
      );

      close();
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      title="Llevar la agenda a otro calendario"
      subtitle={simple ? "Un archivo para tu calendario" : "Un archivo para Google Calendar, Outlook o el calendario del teléfono"}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={close} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={download} disabled={busy}>
            {busy ? "Armando el archivo…" : "Bajar el archivo"}
          </button>
        </>
      }
    >
      {error && <p className="imp-error">{error}</p>}

      <div className="ui-section">
        <div className="ui-field-row">
          <label className="ui-field">
            <span>Desde</span>
            <input type="date" value={options.from} onChange={(event) => setOptions({ ...options, from: event.target.value })} />
          </label>
          <label className="ui-field">
            <span>Hasta</span>
            <input type="date" value={options.to} onChange={(event) => setOptions({ ...options, to: event.target.value })} />
          </label>
        </div>

        <label className="imp-check">
          <span>
            Poner el nombre del paciente en el título
            {!simple && <small>Sin esto, cada evento dice sólo «Turno».</small>}
          </span>
          <input
            type="checkbox"
            className="adm-switch"
            checked={options.withPatientName}
            onChange={(event) => setOptions({ ...options, withPatientName: event.target.checked })}
          />
        </label>

        <label className="imp-check">
          <span>
            Incluir los turnos cancelados
            {!simple && <small>Entran marcados como cancelados.</small>}
          </span>
          <input
            type="checkbox"
            className="adm-switch"
            checked={options.includeCancelled}
            onChange={(event) => setOptions({ ...options, includeCancelled: event.target.checked })}
          />
        </label>
      </div>

{!simple && (
      <div className="ui-section imp-rules">
        <h3>Cómo se usa el archivo</h3>
        <ul>
          <li>En Google Calendar, por Configuración → Importar y exportar.</li>
          <li>Volver a subirlo actualiza los eventos, no los duplica.</li>
          <li>Lo que cambies allá no vuelve.</li>
        </ul>
      </div>
      )}
    </Modal>
  );
}
