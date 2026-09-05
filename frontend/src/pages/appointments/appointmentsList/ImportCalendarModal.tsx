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
    if (!file) return setError("Elegí el archivo que exportaste de Google Calendar");

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
        Listo
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
          {busy ? "Leyendo…" : "Ver qué entra"}
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
          ? "Ya está"
          : step === "preview"
            ? // Que todavía no se guardó nada no se acorta nunca: es lo que deja mirar sin miedo.
              "Esto es lo que entraría. Todavía no se guardó nada"
            : simple
              ? "Traé tu agenda de siempre"
              : "Traé tu agenda de siempre. Los turnos entran sin paciente y ninguno queda repitiéndose solo"
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
              <span>El archivo</span>
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
                <span className={file ? "imp-file-name" : "imp-file-none"}>{file ? file.name : "Ninguno todavía"}</span>
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
            <small className="imp-note">Lo que ya está no vuelve a entrar, así que podés importar de a tramos.</small>
          </div>

          <div className="ui-section">
            <label className="ui-field">
              <span>Cómo quedan los turnos</span>
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
              <span>Y el cobro</span>
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
                    ? "Ojo, el paciente lee las observaciones."
                    : "Es lo único que queda para reconocer cada turno. Ojo, el paciente lee las observaciones."}
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
                Traer también los turnos fuera de tu horario de atención
                {!simple && <small>Van al consultorio donde más atendés. Sirve para agendas viejas.</small>}
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
            <h3>Qué hace y qué no</h3>
            <ul>
              <li>El consultorio sale de tus horarios de atención.</li>
              <li>Cada turno conserva su hora y su duración, aunque no encaje en tus módulos.</li>
              <li>Un evento que se repite entra como turnos sueltos. Ninguno queda repitiéndose.</li>
              <li>El valor sale de algún número del texto. Si no hay, queda sin valor.</li>
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
                De los {plan.read} {plural(plan.read, "evento leído", "eventos leídos")} no hay ninguno que pueda ser un turno en
                ese tramo. Abajo está el motivo de cada uno.
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
            {plan.outOfRange > 0 && (
              <li>
                {plan.outOfRange} {plural(plan.outOfRange, "quedó", "quedaron")} fuera de las fechas que elegiste.
              </li>
            )}
            {sinValor > 0 && (
              <li>
                {sinValor} {plural(sinValor, "entra", "entran")} sin valor. {plural(sinValor, "Lo", "Los")} podés completar
                después.
              </li>
            )}
            {fueraDeHorario.length > 0 && (
              <li>
                {fueraDeHorario.length} {plural(fueraDeHorario.length, "cae", "caen")} fuera de tu horario.{" "}
                {plural(fueraDeHorario.length, "Va", "Van")} a <strong>{fueraDeHorario[0].room}</strong>, donde más atendés.
              </li>
            )}
            {fueraDeGrilla > 0 && (
              <li>
                {fueraDeGrilla} no {plural(fueraDeGrilla, "encaja", "encajan")} en tus módulos.{" "}
                {plural(fueraDeGrilla, "Entra", "Entran")} con su horario real.
              </li>
            )}
            {plan.truncated && (
              <li className="imp-flag-warn">
                <FaTriangleExclamation /> El archivo era muy grande y no se leyó entero. Importá un tramo más corto.
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
                            ? "No arranca ni dura como un módulo tuyo. Entra igual, con este horario."
                            : undefined
                        }
                      >
                        {item.initialHour}–{item.finalHour}
                      </td>
                      <td
                        className={item.outsideSchedule ? "imp-offgrid" : ""}
                        title={item.outsideSchedule ? "Fuera de tu horario. Este consultorio lo elegimos nosotros." : undefined}
                      >
                        {item.room}
                      </td>
                      <td className={item.value === null ? "imp-empty" : ""}>{money(item.value)}</td>
                      <td className="imp-title">{item.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {grupos.length > 0 && (
            <div className="ui-section imp-skipped">
              <h3>Lo que se saltea</h3>
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
              ? "No entró ningún turno."
              : `Se ${result.created === 1 ? "importó 1 turno" : `importaron ${result.created} turnos`}.`}
          </p>
          {result.failed > 0 && <p className="imp-error">{result.failed} no se pudieron guardar. Probá importarlos de nuevo.</p>}
          {result.created > 0 && (
            <p className="imp-done-note">Quedaron en tu agenda, sin paciente. Abrí cada uno para asignarlo.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
