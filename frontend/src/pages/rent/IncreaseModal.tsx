import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../components/modal/Modal.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { money } from "../analytics/analyticsService.ts";
import {
  capitalize,
  errorText,
  findRentMonth,
  findRoomPrices,
  monthKeyOf,
  monthName,
  parseMoney,
  saveRoomPrices,
  shiftMonth,
  type PriceKey,
  type RentRow,
  type RoomPrices,
} from "./rentService.ts";

interface IncreaseModalProps {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

const keyOf = (idRoom: number, block: PriceKey) => `${idRoom}|${block}`;

const raise = (price: number, percent: number) => Math.round(price * (1 + percent / 100));

/**
 * Un aumento en porcentaje sobre los precios de los consultorios, desde este mes o el que
 * viene.
 *
 * Sube los precios y no las cuotas de cada uno: las cuotas por módulos salen de esos
 * precios y suben con ellos, y quien se sume después ya entra con el precio nuevo. Cada
 * precio que sale del porcentaje se puede corregir a mano antes de aplicar, y un
 * consultorio sin tildar queda como estaba. Las cuotas fijas no se tocan: se cambian a mano
 * desde la fila de cada uno.
 *
 * Guarda con la misma ruta que la ventana de precios, así que no necesita nada nuevo del
 * servidor.
 */
export function IncreaseModal({ open, onClose, onApplied }: IncreaseModalProps) {
  const current = monthKeyOf();
  const next = shiftMonth(current, 1);

  const [from, setFrom] = useState(current);
  const [percent, setPercent] = useState("");
  const [data, setData] = useState<RoomPrices | null>(null);
  const [rows, setRows] = useState<RentRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  /** Los precios corregidos a mano. Mandan sobre el porcentaje. */
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setData(null);
    setEdited({});
    setError("");

    Promise.all([findRoomPrices(from), findRentMonth(from).catch(() => null)])
      .then(([prices, month]) => {
        if (cancelled) return;
        setData(prices);
        setSelected(new Set(prices.rooms.map((room) => room.idRoom)));
        setRows(month ? month.rows.filter((row) => row.active) : []);
      })
      .catch((problem) => {
        if (!cancelled) setError(problem.message);
      });

    return () => {
      cancelled = true;
    };
  }, [open, from]);

  const value = Number(percent.replace(",", "."));
  const valid = percent.trim() !== "" && Number.isFinite(value) && value > 0 && value <= 300;
  const rooms = data?.rooms ?? [];
  const blocks = data?.blocks ?? [];

  /** Lo que queda escrito en cada casilla: lo corregido, lo que da el porcentaje o el precio de hoy. */
  function shown(idRoom: number, block: PriceKey, price: number | null): string {
    const key = keyOf(idRoom, block);
    if (!selected.has(idRoom)) return price === null ? "" : String(price);
    if (key in edited) return edited[key];
    if (price === null) return "";
    return String(valid ? raise(price, value) : price);
  }

  const changes = rooms.flatMap((room) =>
    selected.has(room.idRoom)
      ? blocks.map((block) => {
          const before = room.prices[block.key] ?? null;
          const raw = shown(room.idRoom, block.key, before);
          const price = raw.trim() === "" ? null : parseMoney(raw);
          return {
            idRoom: room.idRoom,
            block: block.key,
            price,
            invalid: raw.trim() !== "" && price === null,
            changed: price !== before,
          };
        })
      : []
  );
  const pending = changes.filter((change) => change.invalid || change.changed);

  // Cómo quedan las cuotas por módulos con los precios nuevos, línea por línea de su detalle.
  const newPrice = new Map(changes.map((change) => [keyOf(change.idRoom, change.block), change.price]));
  const byModules = rows.filter((row) => row.kind === "blocks" && row.breakdown && row.amount !== null);
  const before = byModules.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const after = byModules.reduce((sum, row) => {
    const breakdown = row.breakdown!;
    const lines = [
      ...breakdown.blocks.map((line) => ({ ...line, key: line.block as PriceKey })),
      ...(breakdown.days ?? []).map((line) => ({ ...line, key: "day" as PriceKey })),
    ];
    const base =
      lines.reduce((acc, line) => {
        const id = keyOf(line.roomId, line.key);
        const price = newPrice.has(id) ? newPrice.get(id) ?? 0 : line.price ?? 0;
        return acc + price * line.times;
      }, 0) + breakdown.outside.reduce((acc, line) => acc + line.subtotal, 0);
    return sum + Math.round(base * (1 + (breakdown.adjust ?? 0) / 10000));
  }, 0);
  const fixed = rows.filter((row) => row.kind === "fixed").length;

  function toggle(idRoom: number) {
    setSelected((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(idRoom)) nextSet.delete(idRoom);
      else nextSet.add(idRoom);
      return nextSet;
    });
  }

  async function apply() {
    if (pending.some((change) => change.invalid)) return setError("Los precios van en pesos, sin centavos");
    if (selected.size === 0) return setError("Falta elegir los consultorios");
    if (pending.length === 0) return setError(valid ? "Los precios quedan iguales" : "Falta el porcentaje del aumento");

    setBusy(true);
    setError("");

    try {
      await saveRoomPrices(
        from,
        pending.map(({ idRoom, block, price }) => ({ idRoom, block, price }))
      );
      const count = new Set(pending.map((change) => change.idRoom)).size;
      toast.success(count === 1 ? "Aumento aplicado a 1 consultorio" : `Aumento aplicado a ${count} consultorios`);
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
      subtitle="En porcentaje, sobre el precio de cada consultorio"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={apply} disabled={busy || !data || selected.size === 0}>
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
          <h3 className="ui-section-title">Consultorios</h3>
          <div className="ui-section-actions">
            <button type="button" className="rent-link" onClick={() => setSelected(new Set(rooms.map((room) => room.idRoom)))}>
              Todos
            </button>
            <button type="button" className="rent-link" onClick={() => setSelected(new Set())}>
              Ninguno
            </button>
          </div>
        </div>

        <p className="adm-confirm-note">Cada precio se puede corregir antes de aplicar. Un consultorio sin tildar queda igual.</p>

        {!data ? (
          error ? null : (
            <div className="rent-loading">
              <SkeletonLine height={18} />
              <SkeletonLine width="70%" height={18} />
            </div>
          )
        ) : rooms.length === 0 ? (
          <p className="adm-confirm-note">No hay consultorios habilitados.</p>
        ) : (
          <div className="rent-scroll">
            <table className="rent-table rent-price-table rent-raise-table">
              <thead>
                <tr>
                  <th>Consultorio</th>
                  {blocks.map((block) => (
                    <th key={block.key}>{block.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const on = selected.has(room.idRoom);
                  return (
                    <tr key={room.idRoom} className={on ? "" : "off"}>
                      <td>
                        <label className="rent-calc-head">
                          <input type="checkbox" checked={on} onChange={() => toggle(room.idRoom)} />
                          <span className="rent-who">
                            <strong>{room.room}</strong>
                            <span className="rent-sub">{room.office}</span>
                          </span>
                        </label>
                      </td>
                      {blocks.map((block) => {
                        const key = keyOf(room.idRoom, block.key);
                        const price = room.prices[block.key] ?? null;
                        const text = shown(room.idRoom, block.key, price);
                        const moved = on && price !== null && text !== String(price);

                        return (
                          <td key={block.key}>
                            <input
                              className={`rent-input${key in edited && on ? " is-edited" : ""}`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1}
                              placeholder="Sin precio"
                              aria-label={`${block.label} de ${room.room}`}
                              value={text}
                              disabled={!on}
                              onChange={(event) => setEdited((prev) => ({ ...prev, [key]: event.target.value }))}
                            />
                            {moved && <s className="rent-sub">{money(price)}</s>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ui-section">
        {pending.length > 0 && byModules.length > 0 && after !== before && (
          <p className="rent-summary">
            Las cuotas por módulos de {monthName(from)} pasan de {money(before)} a {money(after)}.
          </p>
        )}

        {fixed > 0 && (
          <p className="adm-confirm-note">
            {fixed === 1
              ? "La cuota fija queda igual y se cambia desde la fila del profesional."
              : `Las ${fixed} cuotas fijas quedan iguales y se cambian desde la fila de cada profesional.`}
          </p>
        )}

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
