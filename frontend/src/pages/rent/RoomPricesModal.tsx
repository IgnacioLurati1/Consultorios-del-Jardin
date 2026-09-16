import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../components/modal/Modal.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { money } from "../analytics/analyticsService.ts";
import {
  errorText,
  findRoomPrices,
  monthKeyOf,
  monthName,
  parseMoney,
  saveRoomPrices,
  shiftMonth,
  type Block,
  type PriceKey,
  type RoomPrices,
} from "./rentService.ts";

interface RoomPricesModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const keyOf = (idRoom: number, block: PriceKey) => `${idRoom}|${block}`;

/** "09:00" a "13:00" → "9 a 13". */
function hours(block: Block): string {
  const hour = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return m ? `${h}:${String(m).padStart(2, "0")}` : String(h);
  };
  return `${hour(block.from)} a ${hour(block.to)}`;
}

/**
 * El precio de cada bloque de cada consultorio.
 *
 * Rige desde este mes o desde el que viene. Programarlo para el que viene deja la cuota de
 * este mes como estaba, que es lo que se quiere cuando el aumento se avisa con tiempo.
 */
export function RoomPricesModal({ open, onClose, onSaved }: RoomPricesModalProps) {
  const current = monthKeyOf();
  const next = shiftMonth(current, 1);

  const [from, setFrom] = useState(current);
  const [data, setData] = useState<RoomPrices | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setData(null);
    setError("");

    findRoomPrices(from)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setValues(
          Object.fromEntries(
            result.rooms.flatMap((room) =>
              result.blocks.map((block) => {
                const price = room.prices[block.key] ?? null;
                return [keyOf(room.idRoom, block.key), price === null ? "" : String(price)];
              })
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

  const changes = data
    ? data.rooms.flatMap((room) =>
        data.blocks.map((block) => {
          const raw = values[keyOf(room.idRoom, block.key)] ?? "";
          const price = raw.trim() === "" ? null : parseMoney(raw);
          return {
            idRoom: room.idRoom,
            block: block.key,
            price,
            invalid: raw.trim() !== "" && price === null,
            changed: price !== (room.prices[block.key] ?? null),
          };
        })
      )
    : [];

  const pending = changes.filter((change) => change.invalid || change.changed);

  async function save() {
    if (pending.some((change) => change.invalid)) return setError("Los precios van en pesos, sin centavos");
    if (pending.length === 0) return onClose();

    setBusy(true);
    setError("");

    try {
      await saveRoomPrices(
        from,
        pending.map(({ idRoom, block, price }) => ({ idRoom, block, price }))
      );
      toast.success(pending.length === 1 ? "Precio guardado" : "Precios guardados");
      onSaved();
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
      title="Precios de los consultorios"
      subtitle="Por bloque, por cada vez que se usa"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy || !data}>
            {busy ? "Guardando…" : pending.length > 0 ? `Guardar ${pending.length === 1 ? "1 cambio" : `${pending.length} cambios`}` : "Guardar"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <div className="rent-from">
          <span className="rent-from-label">Rige desde</span>
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
          Quien usa cualquier parte de un bloque paga el bloque entero, por cada vez que ese día cae en el mes. El día se
          cobra solo a quien usa el consultorio de 9 a 20 de corrido, y reemplaza a la mañana y la tarde. Un campo vacío
          deja el bloque sin precio.
        </p>
      </div>

      <div className="ui-section">
        {!data ? (
          error ? null : (
            <div className="rent-loading">
              <SkeletonLine height={18} />
              <SkeletonLine width="70%" height={18} />
            </div>
          )
        ) : data.rooms.length === 0 ? (
          <p className="adm-confirm-note">No hay consultorios habilitados.</p>
        ) : (
          <div className="rent-scroll">
            <table className="rent-table rent-price-table">
              <thead>
                <tr>
                  <th>Consultorio</th>
                  {data.blocks.map((block) => (
                    <th key={block.key}>
                      {block.label} <span className="rent-th-sub">de {hours(block)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((room) => (
                  <tr key={room.idRoom}>
                    <td>
                      <div className="rent-who">
                        <strong>{room.room}</strong>
                        <span className="rent-sub">{room.office}</span>
                      </div>
                    </td>
                    {data.blocks.map((block) => {
                      const key = keyOf(room.idRoom, block.key);
                      const scheduled = from === current && (room.next[block.key] ?? null) !== (room.prices[block.key] ?? null);

                      return (
                        <td key={block.key}>
                          <input
                            className="rent-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            placeholder="Sin precio"
                            aria-label={`${block.label} de ${room.room}`}
                            value={values[key] ?? ""}
                            onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
                          />
                          {scheduled && (
                            <span className="rent-sub">
                              Desde {monthName(next)} {(room.next[block.key] ?? null) === null ? "sin precio" : money(room.next[block.key]!)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
