import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../components/modal/Modal.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { money } from "../analytics/analyticsService.ts";
import {
  applyIncrease,
  capitalize,
  errorText,
  findRentMonth,
  monthKeyOf,
  monthName,
  shiftMonth,
  type RentRow,
} from "./rentService.ts";

interface IncreaseModalProps {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

/**
 * Un aumento en porcentaje, para todos o para los elegidos, desde este mes o el que viene.
 *
 * Con todos elegidos se puede subir también el precio de los módulos: así la cuota de
 * quien calcula por módulos sube con los precios, y el que se sume después entra con el
 * precio nuevo. Con algunos, los precios quedan quietos (subirían también los de los
 * demás) y el aumento va a la cuota de cada elegido.
 */
export function IncreaseModal({ open, onClose, onApplied }: IncreaseModalProps) {
  const current = monthKeyOf();
  const next = shiftMonth(current, 1);

  const [from, setFrom] = useState(current);
  const [percent, setPercent] = useState("");
  const [rows, setRows] = useState<RentRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setRows(null);
    setError("");

    findRentMonth(from)
      .then((result) => {
        if (cancelled) return;
        const active = result.rows.filter((row) => row.active);
        setRows(active);
        setSelected(new Set(active.map((row) => row.email)));
      })
      .catch((problem) => {
        if (!cancelled) setError(problem.message);
      });

    return () => {
      cancelled = true;
    };
  }, [open, from]);

  const value = Number(percent.replace(",", "."));
  const valid = Number.isFinite(value) && value > 0 && value <= 300;
  const list = rows ?? [];
  const everyone = list.length > 0 && list.every((row) => selected.has(row.email));
  const chosen = list.filter((row) => selected.has(row.email));
  const before = chosen.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const after = chosen.reduce((sum, row) => sum + Math.round((row.amount ?? 0) * (1 + (valid ? value : 0) / 100)), 0);

  function toggle(email: string) {
    setSelected((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(email)) nextSet.delete(email);
      else nextSet.add(email);
      return nextSet;
    });
  }

  async function apply() {
    if (!valid) return setError("Falta el porcentaje del aumento");
    if (chosen.length === 0) return setError("Falta elegir a quién aplicarle el aumento");

    setBusy(true);
    setError("");

    try {
      const result = await applyIncrease({
        percent: value,
        fromMonth: from,
        emails: chosen.map((row) => row.email),
        prices: everyone && prices,
      });

      const applied = result.raised === 1 ? "Aumento aplicado a 1 profesional" : `Aumento aplicado a ${result.raised} profesionales`;
      toast.success(result.skipped.length ? `${applied}. Sin cuota, quedan igual ${result.skipped.join(", ")}` : applied);
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
      title="Aumento de alquiler"
      subtitle="En porcentaje, sobre la cuota de cada uno"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={apply} disabled={busy || !rows || chosen.length === 0}>
            {busy ? "Aplicando…" : "Aplicar aumento"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <div className="ui-field-row">
          <label className="ui-field rent-percent">
            <span>Aumento</span>
            <span className="rent-suffixed">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                autoFocus
              />
              <span aria-hidden="true">%</span>
            </span>
          </label>

          <div className="ui-field">
            <span>Desde</span>
            <div className="adm-chips" role="group" aria-label="Desde qué mes">
              {[current, next].map((month) => (
                <button
                  key={month}
                  type="button"
                  className={from === month ? "active" : ""}
                  aria-pressed={from === month}
                  onClick={() => setFrom(month)}
                >
                  {capitalize(monthName(month))}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="ui-section">
        <div className="ui-section-head">
          <h3 className="ui-section-title">Profesionales</h3>
          <div className="ui-section-actions">
            <button type="button" className="rent-link" onClick={() => setSelected(new Set(list.map((row) => row.email)))}>
              Todos
            </button>
            <button type="button" className="rent-link" onClick={() => setSelected(new Set())}>
              Ninguno
            </button>
          </div>
        </div>

        {!rows ? (
          error ? null : (
            <div className="rent-loading">
              <SkeletonLine height={18} />
              <SkeletonLine width="70%" height={18} />
            </div>
          )
        ) : list.length === 0 ? (
          <p className="adm-confirm-note">No hay profesionales habilitados.</p>
        ) : (
          <ul className="rent-check-list">
            {list.map((row) => (
              <li key={row.email}>
                <label className="rent-calc-head">
                  <input type="checkbox" checked={selected.has(row.email)} onChange={() => toggle(row.email)} />
                  <span className="rent-who">
                    <strong>
                      {row.surname}, {row.name}
                    </strong>
                    <span className="rent-sub">
                      {row.kind === "blocks" ? "Por módulos" : row.kind === "fixed" ? "Cuota fija" : "Sin cuota, queda igual"}
                    </span>
                  </span>
                  <span className="rent-calc-amounts">
                    {row.amount === null ? (
                      <span className="rent-muted">—</span>
                    ) : (
                      <>
                        {valid && selected.has(row.email) && <s className="rent-muted">{money(row.amount)}</s>}
                        <strong>
                          {money(valid && selected.has(row.email) ? Math.round(row.amount * (1 + value / 100)) : row.amount)}
                        </strong>
                      </>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ui-section">
        {everyone ? (
          <label className="rent-switch-row">
            <span>
              Subir también los precios de los consultorios
              <small>Las cuotas por módulos suben con los precios, y quien se sume después ya entra con el precio nuevo.</small>
            </span>
            <input type="checkbox" className="adm-switch" checked={prices} onChange={(event) => setPrices(event.target.checked)} />
          </label>
        ) : (
          <p className="adm-confirm-note">
            Con algunos profesionales, los precios de los consultorios quedan igual y el aumento va solo a sus cuotas.
          </p>
        )}

        {valid && chosen.length > 0 && (
          <p className="rent-summary">
            Las cuotas de {monthName(from)} pasan de {money(before)} a {money(after)}.
          </p>
        )}

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
