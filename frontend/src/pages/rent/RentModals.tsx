import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../components/modal/Modal.tsx";
import { money } from "../analytics/analyticsService.ts";
import {
  capitalize,
  errorText,
  parseMoney,
  saveDueDay,
  setRentAmount,
  setRentPayment,
  toLocalDate,
  todayISO,
  type Payment,
  type RentMonth,
  type RentRow,
} from "./rentService.ts";

const CHOICES: { value: Payment["status"]; label: string }[] = [
  { value: "paid", label: "Pagó" },
  { value: "partial", label: "Pagó una parte" },
  { value: "unpaid", label: "No pagó" },
];

interface PaymentModalProps {
  row: RentRow | null;
  data: RentMonth;
  onClose: () => void;
  onSaved: (result: RentMonth) => void;
}

/**
 * Registrar el pago de una cuota con todo lo que "Pagó hoy" no cubre: otra fecha, un pago
 * parcial, o volver atrás un pago cargado por error.
 */
export function PaymentModal({ row, data, onClose, onSaved }: PaymentModalProps) {
  const [status, setStatus] = useState<Payment["status"]>("paid");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!row) return;
    setStatus(row.status === "partial" ? "partial" : "paid");
    setAmount(row.status === "partial" ? String(row.paidAmount) : "");
    setPaidOn(row.paidOn ?? todayISO());
    setError("");
  }, [row]);

  if (!row) return null;

  const fee = row.amount ?? 0;

  async function save() {
    if (!row) return;
    const payment: Payment = { status };

    if (status === "partial") {
      const value = parseMoney(amount);
      if (value === null || value <= 0) return setError("Falta el monto pagado, en pesos y sin centavos");
      if (value >= fee) return setError("Un pago parcial tiene que ser menor que la cuota");
      payment.paidAmount = value;
    }

    if (status !== "unpaid") {
      if (!paidOn) return setError("Falta la fecha de pago");
      if (paidOn > todayISO()) return setError("La fecha de pago no puede ser posterior a hoy");
      payment.paidOn = paidOn;
    }

    setBusy(true);
    setError("");

    try {
      onSaved(await setRentPayment(data.month, row.email, payment));
      toast.success(status === "unpaid" ? "Pago borrado" : "Pago registrado");
      onClose();
    } catch (problem) {
      setError(errorText(problem));
    } finally {
      setBusy(false);
    }
  }

  const partial = parseMoney(amount);

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Pago de ${row.name} ${row.surname}`}
      subtitle={`${capitalize(data.label)} · cuota de ${money(fee)}`}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <div className="adm-chips" role="group" aria-label="Estado del pago">
          {CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className={status === choice.value ? "active" : ""}
              aria-pressed={status === choice.value}
              onClick={() => {
                setStatus(choice.value);
                setError("");
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>

        {status === "partial" && (
          <label className="ui-field">
            <span>Monto pagado</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
            />
            {partial !== null && partial > 0 && partial < fee && <small>Queda un saldo de {money(fee - partial)}.</small>}
          </label>
        )}

        {status !== "unpaid" && (
          <label className="ui-field">
            <span>Fecha de pago</span>
            <input type="date" max={todayISO()} value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
            <small>Pagar después del día {data.dueDay} cuenta como fuera de término.</small>
          </label>
        )}

        {status === "unpaid" && row.paidAmount > 0 && (
          <p className="ui-alert ui-alert-warn">
            Se borra el pago de {money(row.paidAmount)}
            {row.paidOn ? ` del ${toLocalDate(row.paidOn)}` : ""}.
          </p>
        )}

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}

interface AmountModalProps {
  row: RentRow | null;
  data: RentMonth;
  onClose: () => void;
  onSaved: (result: RentMonth) => void;
}

/**
 * La cuota a mano. Desde el mes en curso en adelante queda fija los meses que siguen; en
 * un mes pasado corrige ese mes y nada más. La ventana lo dice antes de guardar.
 */
export function AmountModal({ row, data, onClose, onSaved }: AmountModalProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!row) return;
    setValue(row.amount === null ? "" : String(row.amount));
    setError("");
  }, [row]);

  if (!row) return null;

  const past = data.month < data.current;

  async function save() {
    if (!row) return;
    const amount = parseMoney(value);
    if (amount === null) return setError("Falta la cuota, en pesos y sin centavos");

    setBusy(true);
    setError("");

    try {
      onSaved(await setRentAmount(data.month, row.email, amount));
      toast.success("Cuota guardada");
      onClose();
    } catch (problem) {
      setError(errorText(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Cuota de ${row.name} ${row.surname}`}
      subtitle={capitalize(data.label)}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <label className="ui-field">
          <span>Cuota del mes</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
            }}
            autoFocus
          />
        </label>

        <p className="adm-confirm-note">
          {past
            ? `Corrige solo ${data.label}. Los demás meses quedan como están.`
            : `Rige desde ${data.label} y se mantiene igual los meses siguientes, hasta el próximo cambio.`}
          {!past && row.kind === "blocks" ? " Deja de calcularse con los módulos de la agenda." : ""}
        </p>

        {row.paidAmount > 0 && (
          <p className="adm-confirm-note">
            Lo pagado ({money(row.paidAmount)}) se mantiene. Si la cuota queda más alta, la diferencia pasa a saldo.
          </p>
        )}

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}

interface DueDayModalProps {
  open: boolean;
  dueDay: number;
  onClose: () => void;
  onSaved: () => void;
}

/** El día del mes en que vence la cuota. Del 1 al 28, que existe en todos los meses. */
export function DueDayModal({ open, dueDay, onClose, onSaved }: DueDayModalProps) {
  const [value, setValue] = useState(String(dueDay));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(String(dueDay));
    setError("");
  }, [open, dueDay]);

  async function save() {
    const day = Number(value);
    if (!Number.isInteger(day) || day < 1 || day > 28) return setError("El vencimiento va del día 1 al 28");

    setBusy(true);
    setError("");

    try {
      await saveDueDay(day);
      toast.success("Vencimiento guardado");
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
      size="sm"
      title="Vencimiento de las cuotas"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <label className="ui-field">
          <span>Día del mes</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={28}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          <small>La cuota de cada mes vence ese día del mismo mes. Pagar después cuenta como fuera de término.</small>
        </label>

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
