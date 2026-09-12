import { useMemo, useState } from "react";
import { FaCircleCheck, FaTriangleExclamation } from "react-icons/fa6";
import { Modal } from "../../../components/modal/Modal.tsx";
import { useSimpleText } from "../../../lib/textMode.ts";
import { PAYMENT_LABELS, previewCalendarImport, runCalendarImport, STATE_LABELS } from "../importService.ts";
import type {
  ImportOptions,
  ImportPlan,
  ImportResult,
  PaymentChoice,
  SkippedEvent,
  StateChoice,
} from "../importService.ts";
import "./importCalendar.css";

/**
 * Traer al sistema la agenda que el profesional venía llevando en Google Calendar.
 *
 * La pantalla está partida en dos pasos y el orden importa: primero se elige cómo entra
 * todo, después se ve la cuenta, y recién ahí aparece el botón que guarda. Importar no se
 * deshace con un botón —son cientos de turnos, y desarmarlos después es peor que no
 * haberlos traído— así que la previa no es una comodidad, es la parte que convierte una
 * decisión a ciegas en una decisión.
 *
 * Por eso también se muestra lo que **no** entra, con el motivo de cada uno. Una
 * importación que dice "entraron 40 de 120" y no explica los otros 80 obliga a comparar a
 * mano contra el calendario, que es justamente el trabajo que esto vino a evitar.
 */

interface ImportCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se llama cuando entró algo, para que la lista de turnos vuelva a leerse. */
  onImported: () => void;
}

/** Hace un año, que es de donde suele arrancar lo que a alguien le interesa traer. */
function aYearAgo(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return toISO(date);
}

/** Dentro de tres meses: alcanza para los turnos ya agendados sin traer el año que viene. */
function inThreeMonths(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return toISO(date);
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "2026-08-03" como "lun 3 ago". */
function dayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
}

const money = (value: number | null) => (value === null ? "sin valor" : `$${value.toLocaleString("es-AR")}`);

/** Concuerda el verbo con la cantidad. Un "1 entrarían" arruina un cartel entero. */
const plural = (count: number, uno: string, varios: string) => (count === 1 ? uno : varios);

/** Los salteados agrupados por motivo, del grupo más grande al más chico. */
function byReason(skipped: SkippedEvent[]): { reason: string; items: SkippedEvent[] }[] {
  const groups = new Map<string, SkippedEvent[]>();
  for (const item of skipped) groups.set(item.reason, [...(groups.get(item.reason) ?? []), item]);

  return [...groups.entries()]
    .map(([reason, items]) => ({ reason, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

export function ImportCalendarModal({ isOpen, onClose, onImported }: ImportCalendarModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ImportOptions>({
    from: aYearAgo(),
    to: inThreeMonths(),
    state: "past-assisted",
    payment: "past-paid",
    keepTitle: true,
    outsideSchedule: false,
  });

  const [simple] = useSimpleText();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openReason, setOpenReason] = useState("");

  const step: "form" | "preview" | "done" = result ? "done" : plan ? "preview" : "form";

  const sinValor = useMemo(() => plan?.planned.filter((item) => item.value === null).length ?? 0, [plan]);
  const fueraDeHorario = useMemo(() => plan?.planned.filter((item) => item.outsideSchedule) ?? [], [plan]);
  // Los corridos dentro de un módulo son otra cosa que los que ni siquiera caen en uno, y
  // se avisan por separado: el segundo caso lleva un consultorio que eligió el sistema.
  const fueraDeGrilla = useMemo(
    () => plan?.planned.filter((item) => item.offGrid && !item.outsideSchedule).length ?? 0,
    [plan]
  );
  const grupos = useMemo(() => byReason(plan?.skipped ?? []), [plan]);
  /*
   * Los que vuelven de una exportación de la app.
   *
   * Entran con todo lo que tenían —paciente, valor, cobro, consultorio, observaciones— y
   * las opciones de arriba no los tocan. Hay que decirlo en la previa: alguien que eligió
   * "todos confirmados" y ve entrar turnos como atendidos tiene que entender por qué.
   */
  const propios = useMemo(() => plan?.planned.filter((item) => item.fromExport) ?? [], [plan]);
  const conPaciente = useMemo(() => propios.filter((item) => item.patientEmail).length, [propios]);

  function reset() {
    setFile(null);
    setPlan(null);
    setResult(null);
    setError("");
    setOpenReason("");
  }

  function close() {
    reset();
    onClose();
  }

  async function preview() {
    if (!file) return setError("Falta el archivo exportado de Google Calendar");

    setBusy(true);
    setError("");

    try {
      setPlan(await previewCalendarImport(file, options));
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!file) return;

    setBusy(true);
    setError("");

    try {
      const done = await runCalendarImport(file, options);
      setResult(done);
      if (done.created > 0) onImported();
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  const footer =
    step === "done" ? (
      <button type="button" className="adm-btn adm-btn-primary" onClick={close}>
        Cerrar
      </button>
    ) : step === "preview" ? (
      <>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setPlan(null)} disabled={busy}>
          Cambiar las opciones
        </button>
        {plan!.planned.length > 0 && (
          <button type="button" className="adm-btn adm-btn-primary" onClick={confirm} disabled={busy}>
            {busy ? "Importando…" : `Importar ${plural(plan!.planned.length, "1 turno", `${plan!.planned.length} turnos`)}`}
          </button>
        )}
      </>
    ) : (
      <>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={close}>
          Cancelar
        </button>
        <button type="button" className="adm-btn adm-btn-primary" onClick={preview} disabled={busy}>
          {busy ? "Leyendo…" : "Ver vista previa"}
        </button>
      </>
    );

  return (
    <Modal
      open={isOpen}
      onClose={close}
      size="lg"
      title="Importar de Google Calendar"
      subtitle={
        step === "done"
          ? "Importación terminada"
          : step === "preview"
            ? // Que todavía no se guardó nada no se acorta nunca: es lo que deja mirar sin miedo.
              "Vista previa. Todavía sin guardar"
            : simple
              ? "Agenda de Google Calendar"
              : "Agenda de Google Calendar. Los turnos entran sin paciente y sin repetición"
      }
      footer={footer}
    >
      {error && <p className="imp-error">{error}</p>}

      {step === "form" && (
        <>
          <div className="ui-section">
            {/* El input va escondido pero no apagado: sigue recibiendo el foco y el Enter,
                y el label entero es lo que abre el buscador de archivos. El control del
                navegador se tapa porque escribe "Choose file" en inglés en una pantalla
                que está toda en castellano. */}
            <label className="ui-field imp-file">
              <span>Archivo</span>
              <input
                type="file"
                className="imp-file-input"
                accept=".ics,.zip,text/calendar,application/zip"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError("");
                }}
              />
              <span className="imp-file-box">
                <span className="imp-file-btn">Elegir archivo</span>
                <span className={file ? "imp-file-name" : "imp-file-none"}>{file ? file.name : "Sin archivo"}</span>
              </span>
              {/* Se acorta pero no se saca: es lo único que dice que el zip sirve sin abrir. */}
              <small>
                {simple ? (
                  <>
                    <strong>.ics</strong> o <strong>.zip</strong> de Takeout
                  </>
                ) : (
                  <>
                    El <strong>.ics</strong> de Google Calendar, o el <strong>.zip</strong> de Takeout sin abrir.
                  </>
                )}
              </small>
            </label>

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
            <small className="imp-note">Los turnos ya cargados se omiten, así que se puede importar por tramos.</small>
          </div>

          <div className="ui-section">
            <label className="ui-field">
              <span>Estado de los turnos</span>
              <select
                value={options.state}
                onChange={(event) => setOptions({ ...options, state: event.target.value as StateChoice })}
              >
                {STATE_LABELS.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
              {/* La opción elegida se lee entera ahí arriba; esto la reformula. */}
              {!simple && <small>{STATE_LABELS.find((choice) => choice.value === options.state)?.hint}</small>}
            </label>

            <label className="ui-field">
              <span>Cobro</span>
              <select
                value={options.payment}
                onChange={(event) => setOptions({ ...options, payment: event.target.value as PaymentChoice })}
              >
                {PAYMENT_LABELS.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
              {!simple && <small>{PAYMENT_LABELS.find((choice) => choice.value === options.payment)?.hint}</small>}
            </label>

            <label className="imp-check">
              <span>
                Guardar el título del evento en las observaciones
                {/* Lo que puede salir mal se queda; lo que explica para qué sirve, no. */}
                <small>
                  {simple
                    ? "Las observaciones son visibles para el paciente."
                    : "Permite reconocer cada turno. Las observaciones son visibles para el paciente."}
                </small>
              </span>
              <input
                type="checkbox"
                className="adm-switch"
                checked={options.keepTitle}
                onChange={(event) => setOptions({ ...options, keepTitle: event.target.checked })}
              />
            </label>

            <label className="imp-check">
              <span>
                Incluir turnos fuera del horario de atención
                {!simple && <small>Se asignan al consultorio más usado. Útil para agendas antiguas.</small>}
              </span>
              <input
                type="checkbox"
                className="adm-switch"
                checked={options.outsideSchedule}
                onChange={(event) => setOptions({ ...options, outsideSchedule: event.target.checked })}
              />
            </label>
          </div>

          {/*
            Con "menos texto" este bloque no se dibuja.
            ------------------------------------------
            Es el pedazo más largo de la pantalla y describe cómo se comporta la
            importación. Se puede sacar sin dejar a nadie a ciegas porque el paso
            siguiente muestra la cuenta de lo que entra y el motivo de cada uno que no,
            antes de guardar nada: lo que acá se cuenta, allá se ve.
          */}
          {!simple && (
          <div className="ui-section imp-rules">
            <h3>Funcionamiento</h3>
            <ul>
              <li>El consultorio se toma de los horarios de atención.</li>
              <li>Cada turno conserva su hora y su duración, aunque quede fuera de los módulos.</li>
              <li>Los eventos repetidos entran como turnos sueltos, sin repetición.</li>
              <li>El valor se toma de un número del texto. Sin número, el turno queda sin valor.</li>
            </ul>
          </div>
          )}
        </>
      )}

      {step === "preview" && plan && (
        <>
          {plan.planned.length === 0 ? (
            <div className="imp-summary imp-summary-empty">
              <strong>0</strong>
              <span>
                Ninguno de {plural(plan.read, "el evento leído", `los ${plan.read} eventos leídos`)} corresponde a un turno en
                ese tramo. Abajo figura el motivo de cada uno.
              </span>
            </div>
          ) : (
            <div className="imp-summary">
              <strong>{plan.planned.length}</strong>
              <span>
                {plural(plan.planned.length, "turno entraría", "turnos entrarían")}, de {plan.read}{" "}
                {plural(plan.read, "evento leído", "eventos leídos")}
                {plan.calendars > 1 ? ` en ${plan.calendars} calendarios` : ""}.
              </span>
            </div>
          )}

          <ul className="imp-flags">
            {propios.length > 0 && (
              <li>
                {propios.length} {plural(propios.length, "proviene", "provienen")} de una exportación de esta app y{" "}
                {plural(propios.length, "conserva", "conservan")} sus datos, sin cambios por las opciones.
                {conPaciente > 0 && ` ${conPaciente} ${plural(conPaciente, "trae su paciente", "traen su paciente")}.`}
              </li>
            )}
            {plan.outOfRange > 0 && (
              <li>
                {plan.outOfRange} fuera de las fechas elegidas.
              </li>
            )}
            {sinValor > 0 && (
              <li>
                {sinValor} {plural(sinValor, "entra", "entran")} sin valor, para completar después.
              </li>
            )}
            {fueraDeHorario.length > 0 && (
              <li>
                {fueraDeHorario.length} fuera del horario de atención.{" "}
                {plural(fueraDeHorario.length, "Se asigna", "Se asignan")} a <strong>{fueraDeHorario[0].room}</strong>, el
                consultorio más usado.
              </li>
            )}
            {fueraDeGrilla > 0 && (
              <li>
                {fueraDeGrilla} fuera de los módulos.{" "}
                {plural(fueraDeGrilla, "Entra", "Entran")} con su horario real.
              </li>
            )}
            {plan.truncated && (
              <li className="imp-flag-warn">
                <FaTriangleExclamation /> Archivo demasiado grande, leído en parte. Conviene importar un tramo más corto.
              </li>
            )}
          </ul>

          {plan.planned.length > 0 && (
            <div className="imp-table-wrap">
              <table className="imp-table">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Hora</th>
                    <th>Consultorio</th>
                    <th>Valor</th>
                    {conPaciente > 0 && <th>Paciente</th>}
                    <th>Del calendario</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.planned.map((item, index) => (
                    <tr key={`${item.date}-${item.initialHour}-${index}`}>
                      <td>{dayLabel(item.date)}</td>
                      {/* Una marca por fila y no dos: en los que caen fuera de horario lo
                          que hay que mirar es el consultorio, que lo elegimos nosotros. */}
                      <td
                        className={item.offGrid && !item.outsideSchedule ? "imp-offgrid" : ""}
                        title={
                          item.offGrid && !item.outsideSchedule
                            ? "Fuera de los módulos. Entra con este horario."
                            : undefined
                        }
                      >
                        {item.initialHour}–{item.finalHour}
                      </td>
                      <td
                        className={item.outsideSchedule ? "imp-offgrid" : ""}
                        title={item.outsideSchedule ? "Fuera del horario de atención. Consultorio asignado automáticamente." : undefined}
                      >
                        {item.room}
                      </td>
                      <td className={item.value === null ? "imp-empty" : ""}>{money(item.value)}</td>
                      {conPaciente > 0 && (
                        <td className={item.patientEmail ? "" : "imp-empty"}>{item.patientEmail ?? "sin asignar"}</td>
                      )}
                      <td className="imp-title">{item.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {grupos.length > 0 && (
            <div className="ui-section imp-skipped">
              <h3>Eventos omitidos</h3>
              {grupos.map((group) => (
                <div key={group.reason} className="imp-skip-group">
                  <button
                    type="button"
                    className="imp-skip-head"
                    onClick={() => setOpenReason(openReason === group.reason ? "" : group.reason)}
                    aria-expanded={openReason === group.reason}
                  >
                    <span className="imp-skip-count">{group.items.length}</span>
                    <span>{group.reason}</span>
                  </button>

                  {openReason === group.reason && (
                    <ul className="imp-skip-list">
                      {group.items.map((item, index) => (
                        <li key={`${item.when}-${index}`}>
                          <span className="imp-skip-when">{item.when}</span>
                          {item.summary}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {step === "done" && result && (
        <div className="imp-done">
          <FaCircleCheck className="imp-done-icon" />
          <p className="imp-done-count">
            {result.created === 0
              ? "Sin turnos importados."
              : `Se ${result.created === 1 ? "importó 1 turno" : `importaron ${result.created} turnos`}.`}
          </p>
          {result.failed > 0 && <p className="imp-error">{result.failed} sin guardar. Conviene repetir la importación.</p>}
          {result.created > 0 &&
            (result.planned.every((item) => item.fromExport) ? (
              <p className="imp-done-note">Cargados en la agenda con su paciente y su cobro.</p>
            ) : (
              <p className="imp-done-note">Cargados en la agenda sin paciente. El paciente se asigna desde cada turno.</p>
            ))}
        </div>
      )}
    </Modal>
  );
}
