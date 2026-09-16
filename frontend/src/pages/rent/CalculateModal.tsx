import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../components/modal/Modal.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { money } from "../analytics/analyticsService.ts";
import { RentBreakdown } from "./RentBreakdown.tsx";
import {
  applyCalculation,
  BLOCK_LABEL,
  capitalize,
  errorText,
  DAY_LABEL,
  monthKeyOf,
  monthName,
  parseMoney,
  previewCalculation,
  shiftMonth,
  type CalculationPreview,
  type OutsideLine,
  type PreviewRow,
} from "./rentService.ts";

interface CalculateModalProps {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
  /** Lleva a los precios cuando falta alguno: sin precio, el bloque no suma. */
  onOpenPrices: () => void;
}

const extraKey = (email: string, line: OutsideLine) => `${email}|${line.day}|${line.initialHour}`;

/**
 * "Calcular": la cuota de cada profesional habilitado sale de los bloques que usa en su
 * agenda y del precio de cada bloque de cada consultorio.
 *
 * Primero se ve cuánto le toca a cada uno y recién después se aplica: pisa las cuotas de
 * todos los elegidos, así que no puede ser un botón que actúa sin mostrar nada. Acá también
 * se le pone valor a mano a lo que cae fuera de los bloques, que el cálculo no sabe cobrar.
 */
export function CalculateModal({ open, onClose, onApplied, onOpenPrices }: CalculateModalProps) {
  const current = monthKeyOf();
  const next = shiftMonth(current, 1);

  const [from, setFrom] = useState(current);
  const [preview, setPreview] = useState<CalculationPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setPreview(null);
    setError("");

    previewCalculation(from)
      .then((result) => {
        if (cancelled) return;
        setPreview(result);
        setSelected(new Set(result.rows.map((row) => row.email)));
        setExtras(
          Object.fromEntries(
            result.rows.flatMap((row) =>
              row.breakdown.outside.map((line) => [extraKey(row.email, line), line.price === null ? "" : String(line.price)])
            )
          )
        );
      })
      .catch((problem) => {
        if (!cancelled) setError(problem.message);
      });

    return () => {
      cancelled = true;
    };
  }, [open, from]);

  /** La cuota con los valores a mano que se están escribiendo, antes de guardarlos. */
  function amountOf(row: PreviewRow): number {
    const blocks =
      row.breakdown.blocks.reduce((sum, line) => sum + line.subtotal, 0) +
      (row.breakdown.days ?? []).reduce((sum, line) => sum + line.subtotal, 0);
    const outside = row.breakdown.outside.reduce(
      (sum, line) => sum + line.times * (parseMoney(extras[extraKey(row.email, line)] ?? "") ?? 0),
      0
    );
    return blocks + outside;
  }

  function toggle(email: string) {
    setSelected((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(email)) nextSet.delete(email);
      else nextSet.add(email);
      return nextSet;
    });
  }

  const rows = preview?.rows ?? [];
  const chosen = rows.filter((row) => selected.has(row.email));
  const total = chosen.reduce((sum, row) => sum + amountOf(row), 0);
  const unpriced = rows.some((row) => row.breakdown.blocks.some((line) => line.price === null));

  async function apply() {
    const entries = chosen.flatMap((row) =>
      row.breakdown.outside.map((line) => {
        const raw = extras[extraKey(row.email, line)] ?? "";
        return { email: row.email, day: line.day, initialHour: line.initialHour, raw, price: raw.trim() === "" ? null : parseMoney(raw) };
      })
    );

    if (entries.some((entry) => entry.raw.trim() !== "" && entry.price === null))
      return setError("Los valores a mano van en pesos, sin centavos");
    if (chosen.length === 0) return setError("Falta elegir a quién calcularle la cuota");

    setBusy(true);
    setError("");

    try {
      const result = await applyCalculation({
        fromMonth: from,
        emails: chosen.map((row) => row.email),
        extras: entries.map(({ email, day, initialHour, price }) => ({ email, day, initialHour, price })),
      });
      toast.success(result.updated === 1 ? "Cuota calculada" : `${result.updated} cuotas calculadas`);
      onApplied();
      onClose();
    } catch (problem) {
      setError(errorText(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Calcular con los bloques"
      subtitle="Cuotas según la agenda y el precio de cada consultorio"
      footer={
        <>
          {preview && chosen.length > 0 && <span className="rent-foot-total">Total {money(total)}</span>}
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={apply} disabled={busy || !preview || chosen.length === 0}>
            {busy ? "Aplicando…" : chosen.length === 1 ? "Aplicar a 1 profesional" : `Aplicar a ${chosen.length} profesionales`}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <div className="rent-from">
          <span className="rent-from-label">Desde</span>
          <div className="adm-chips" role="group" aria-label="Desde qué mes">
            {[current, next].map((month) => (
              <button
                key={month}
                type="button"
                className={from === month ? "active" : ""}
                aria-pressed={from === month}
                onClick={() => setFrom(month)}
              >
                {monthName(month)}
              </button>
            ))}
          </div>
        </div>

        <p className="adm-confirm-note">
          Cada profesional paga entero cada bloque que usa, por cada vez que ese día cae en el mes. Quien usa el consultorio de
          9 a 20 de corrido paga el día, si tiene precio. Lo que queda fuera de los bloques lleva un valor a mano, por vez.
        </p>

        {unpriced && (
          <p className="ui-alert ui-alert-warn rent-inline-alert">
            Hay bloques sin precio y no suman.
            <button type="button" className="rent-link" onClick={onOpenPrices}>
              Cargar precios
            </button>
          </p>
        )}
      </div>

      <div className="ui-section">
        {!preview ? (
          error ? null : (
            <div className="rent-loading">
              <SkeletonLine height={18} />
              <SkeletonLine width="80%" height={18} />
              <SkeletonLine width="60%" height={18} />
            </div>
          )
        ) : rows.length === 0 ? (
          <p className="adm-confirm-note">Ningún profesional habilitado tiene horarios cargados.</p>
        ) : (
          <ul className="rent-calc-list">
            {rows.map((row) => {
              const amount = amountOf(row);
              const shared = row.breakdown.blocks.filter((line) => (line.sharedWith?.length ?? 0) > 0);
              const sharedDays = (row.breakdown.days ?? []).filter((line) => (line.sharedWith?.length ?? 0) > 0);

              return (
                <li key={row.email} className={`rent-calc-item ${selected.has(row.email) ? "" : "off"}`}>
                  <label className="rent-calc-head">
                    <input type="checkbox" checked={selected.has(row.email)} onChange={() => toggle(row.email)} />
                    <span className="rent-who">
                      <strong>
                        {row.surname}, {row.name}
                      </strong>
                      <span className="rent-sub">
                        {row.blocks === 1 ? "1 bloque en el mes" : `${row.blocks} bloques en el mes`}
                        {row.speciality ? ` · ${row.speciality}` : ""}
                      </span>
                    </span>
                    <span className="rent-calc-amounts">
                      {row.before !== null && row.before !== amount && <s className="rent-muted">{money(row.before)}</s>}
                      <strong>{money(amount)}</strong>
                    </span>
                  </label>

                  {row.breakdown.outside.length > 0 && (
                    <div className="rent-extras">
                      {row.breakdown.outside.map((line) => {
                        const key = extraKey(row.email, line);
                        return (
                          <label key={key} className="rent-extra">
                            <span>
                              {capitalize(DAY_LABEL[line.day] ?? line.day)}{" "}
                              {line.parts.map((part) => `de ${part.from} a ${part.to}`).join(" y ")} · {line.room} ·{" "}
                              {line.times === 1 ? "1 vez" : `${line.times} veces`}
                            </span>
                            <input
                              className="rent-input"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1}
                              placeholder="Valor por vez"
                              value={extras[key] ?? ""}
                              onChange={(event) => setExtras((prev) => ({ ...prev, [key]: event.target.value }))}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {shared.map((line) => (
                    <p key={`${line.roomId}-${line.day}-${line.block}`} className="rent-sub">
                      Comparte la {BLOCK_LABEL[line.block].toLowerCase()} del {DAY_LABEL[line.day] ?? line.day} en {line.room} con{" "}
                      {line.sharedWith!.join(" y ")}. Cada uno paga el bloque entero.
                    </p>
                  ))}

                  {sharedDays.map((line) => (
                    <p key={`${line.roomId}-${line.day}-day`} className="rent-sub">
                      Comparte {line.room} el {DAY_LABEL[line.day] ?? line.day} con {line.sharedWith!.join(" y ")}. Cada uno paga
                      lo suyo entero.
                    </p>
                  ))}

                  <button
                    type="button"
                    className="rent-link"
                    aria-expanded={expanded === row.email}
                    onClick={() => setExpanded((prev) => (prev === row.email ? null : row.email))}
                  >
                    {expanded === row.email ? "Ocultar detalle" : "Ver detalle"}
                  </button>

                  {expanded === row.email && <RentBreakdown breakdown={row.breakdown} />}
                </li>
              );
            })}
          </ul>
        )}

        {preview && preview.withoutSchedule.length > 0 && (
          <p className="adm-confirm-note">
            {preview.withoutSchedule.map((person) => `${person.name} ${person.surname}`).join(", ")}{" "}
            {preview.withoutSchedule.length === 1 ? "no tiene horarios y queda" : "no tienen horarios y quedan"} como está
            {preview.withoutSchedule.length === 1 ? "" : "n"}.
          </p>
        )}

        {preview && <p className="rent-sub">Las cuotas de {preview.label} pasan a calcularse así, y los meses siguientes también.</p>}

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
