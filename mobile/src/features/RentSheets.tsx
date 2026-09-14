import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { errorMessage } from "../api/client";
import {
  applyCalculation,
  applyIncrease,
  Block,
  Breakdown,
  CalculationPreview,
  findRentMonth,
  findRoomPrices,
  OutsideLine,
  Payment,
  previewCalculation,
  PreviewRow,
  RentMonth,
  RentRow,
  RoomPrices,
  saveDueDay,
  saveRoomPrices,
  setRentAmount,
  setRentPayment,
} from "../api/rent";
import { Button } from "../components/Button";
import { ChipRow } from "../components/Chip";
import { Field } from "../components/Field";
import { useFeedback } from "../components/Feedback";
import { Sheet } from "../components/Sheet";
import { SkeletonList } from "../components/States";
import { Group, Note, Row } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { money } from "../lib/dates";
import { BLOCK_LABEL, capitalize, DAY_LABEL, formatAdjust, monthKeyOf, monthName, parseMoney, shiftMonth, todayISO, toLocalDate } from "../lib/rent";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { DateField } from "./DateField";

/**
 * Los paneles de alquileres. Son las mismas ventanas de la página, una por una, con los
 * mismos textos y las mismas validaciones: el servidor es el mismo y tiene que recibir lo
 * mismo venga de donde venga.
 */

/** El mes en curso y el que viene: desde cuándo rige un cambio de reglas. */
function useFromMonths() {
  const current = monthKeyOf();
  return [current, shiftMonth(current, 1)];
}

function FromChips({ value, onChange, label }: { value: string; onChange: (month: string) => void; label: string }) {
  const months = useFromMonths();

  return (
    <View style={styles.block}>
      <AppText variant="caption" tone="muted" chrome>
        {label}
      </AppText>
      <ChipRow options={months.map((month) => ({ key: month, label: capitalize(monthName(month)) }))} value={value} onChange={onChange} />
    </View>
  );
}

/* ============================================================
   Detalle de una cuota
   ============================================================ */

/**
 * De qué sale una cuota calculada con los bloques: cada bloque, cuántas veces cae en el
 * mes y a qué precio. Es lo que se mira cuando un número no cierra.
 */
export function RentBreakdownView({ breakdown }: { breakdown: Breakdown }) {
  const { colors } = useTheme();

  const line = (key: string, what: string, calc: string, subtotal: number) => (
    <View key={key} style={[styles.line, { borderBottomColor: colors.border }]}>
      <View style={styles.lineText}>
        <AppText variant="small">{what}</AppText>
        <AppText variant="caption" tone="muted">
          {calc}
        </AppText>
      </View>
      <AppText variant="bodyStrong" chrome>
        {money(subtotal)}
      </AppText>
    </View>
  );

  return (
    <View style={styles.breakdown}>
      {breakdown.blocks.map((item) =>
        line(
          `${item.roomId}-${item.day}-${item.block}`,
          `${item.room} · ${DAY_LABEL[item.day] ?? item.day} · ${BLOCK_LABEL[item.block].toLowerCase()}`,
          item.price === null ? "sin precio" : `${item.times} × ${money(item.price)}`,
          item.subtotal
        )
      )}

      {breakdown.outside.map((item) =>
        line(
          `${item.day}-${item.initialHour}`,
          `${item.room} · ${DAY_LABEL[item.day] ?? item.day} ${item.parts.map((part) => `de ${part.from} a ${part.to}`).join(" y ")}`,
          item.price === null ? "sin valor" : `${item.times} × ${money(item.price)}`,
          item.subtotal
        )
      )}

      {breakdown.adjust !== 0 ? (
        <AppText variant="caption" tone="muted">
          Aumento propio de {formatAdjust(breakdown.adjust)} sobre {money(breakdown.base)}
        </AppText>
      ) : null}

      {breakdown.missing.map((message) => (
        <AppText key={message} variant="caption" tone="danger">
          {message}
        </AppText>
      ))}
    </View>
  );
}

/* ============================================================
   Pago
   ============================================================ */

const CHOICES: { key: Payment["status"]; label: string }[] = [
  { key: "paid", label: "Pagó" },
  { key: "partial", label: "Pagó una parte" },
  { key: "unpaid", label: "No pagó" },
];

/**
 * Registrar el pago de una cuota con todo lo que "Pagó hoy" no cubre: otra fecha, un pago
 * parcial, o volver atrás un pago cargado por error.
 */
export function RentPaymentSheet({
  row,
  data,
  onClose,
  onSaved,
}: {
  row: RentRow | null;
  data: RentMonth;
  onClose: () => void;
  onSaved: (result: RentMonth) => void;
}) {
  const feedback = useFeedback();
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

  const fee = row?.amount ?? 0;
  const partial = parseMoney(amount);

  async function save() {
    if (!row || busy) return;
    const payment: Payment = { status };

    if (status === "partial") {
      if (partial === null || partial <= 0) return setError("Falta el monto pagado, en pesos y sin centavos");
      if (partial >= fee) return setError("Un pago parcial tiene que ser menor que la cuota");
      payment.paidAmount = partial;
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
      feedback.done(status === "unpaid" ? "Pago borrado" : "Pago registrado");
      onClose();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={!!row} onClose={onClose} title={row ? `Pago de ${row.name} ${row.surname}` : "Pago"}>
      {row ? (
        <View style={styles.body}>
          <AppText variant="small" tone="muted">
            {capitalize(data.label)} · cuota de {money(fee)}
          </AppText>

          <ChipRow
            options={CHOICES}
            value={status}
            onChange={(key) => {
              setStatus(key);
              setError("");
            }}
          />

          {status === "partial" ? (
            <Field
              label="Monto pagado"
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              hint={partial !== null && partial > 0 && partial < fee ? `Queda un saldo de ${money(fee - partial)}.` : undefined}
            />
          ) : null}

          {status !== "unpaid" ? (
            <DateField
              label="Fecha de pago"
              value={paidOn}
              onChange={(iso) => setPaidOn(iso.slice(0, 10))}
              maximumDate={new Date()}
              hint={`Pagar después del día ${data.dueDay} cuenta como fuera de término.`}
            />
          ) : null}

          {status === "unpaid" && row.paidAmount > 0 ? (
            <Note tone="warn">
              Se borra el pago de {money(row.paidAmount)}
              {row.paidOn ? ` del ${toLocalDate(row.paidOn)}` : ""}.
            </Note>
          ) : null}

          {error ? <Note tone="danger">{error}</Note> : null}

          <Button label="Guardar" block loading={busy} onPress={save} />
        </View>
      ) : null}
    </Sheet>
  );
}

/* ============================================================
   Cuota a mano
   ============================================================ */

/**
 * La cuota a mano. Desde el mes en curso en adelante queda fija los meses que siguen; en
 * un mes pasado corrige ese mes y nada más. El panel lo dice antes de guardar.
 */
export function RentAmountSheet({
  row,
  data,
  onClose,
  onSaved,
}: {
  row: RentRow | null;
  data: RentMonth;
  onClose: () => void;
  onSaved: (result: RentMonth) => void;
}) {
  const feedback = useFeedback();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!row) return;
    setValue(row.amount === null ? "" : String(row.amount));
    setError("");
  }, [row]);

  const past = data.month < data.current;

  async function save() {
    if (!row || busy) return;
    const amount = parseMoney(value);
    if (amount === null) return setError("Falta la cuota, en pesos y sin centavos");

    setBusy(true);
    setError("");

    try {
      onSaved(await setRentAmount(data.month, row.email, amount));
      feedback.done("Cuota guardada");
      onClose();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={!!row} onClose={onClose} title={row ? `Cuota de ${row.name} ${row.surname}` : "Cuota"}>
      {row ? (
        <View style={styles.body}>
          <AppText variant="small" tone="muted">
            {capitalize(data.label)}
          </AppText>

          <Field label="Cuota del mes" value={value} onChangeText={setValue} keyboardType="number-pad" />

          <AppText variant="caption" tone="muted">
            {past
              ? `Corrige solo ${data.label}. Los demás meses quedan como están.`
              : `Rige desde ${data.label} y se mantiene igual los meses siguientes, hasta el próximo cambio.`}
            {!past && row.kind === "blocks" ? " Deja de calcularse con los bloques de la agenda." : ""}
          </AppText>

          {row.paidAmount > 0 ? (
            <AppText variant="caption" tone="muted">
              Lo pagado ({money(row.paidAmount)}) se mantiene. Si la cuota queda más alta, la diferencia pasa a saldo.
            </AppText>
          ) : null}

          {error ? <Note tone="danger">{error}</Note> : null}

          <Button label="Guardar" block loading={busy} onPress={save} />
        </View>
      ) : null}
    </Sheet>
  );
}

/* ============================================================
   Vencimiento
   ============================================================ */

/** El día del mes en que vence la cuota. Del 1 al 28, que existe en todos los meses. */
export function DueDaySheet({
  visible,
  dueDay,
  onClose,
  onSaved,
}: {
  visible: boolean;
  dueDay: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const feedback = useFeedback();
  const [value, setValue] = useState(String(dueDay));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setValue(String(dueDay));
    setError("");
  }, [visible, dueDay]);

  async function save() {
    if (busy) return;
    const day = Number(value);
    if (!Number.isInteger(day) || day < 1 || day > 28) return setError("El vencimiento va del día 1 al 28");

    setBusy(true);
    setError("");

    try {
      await saveDueDay(day);
      feedback.done("Vencimiento guardado");
      onSaved();
      onClose();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Vencimiento de las cuotas">
      <View style={styles.body}>
        <Field
          label="Día del mes"
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          maxLength={2}
          hint="La cuota de cada mes vence ese día del mismo mes. Pagar después cuenta como fuera de término."
        />

        {error ? <Note tone="danger">{error}</Note> : null}

        <Button label="Guardar" block loading={busy} onPress={save} />
      </View>
    </Sheet>
  );
}

/* ============================================================
   Precios de los consultorios
   ============================================================ */

const priceKey = (idRoom: number, block: string) => `${idRoom}|${block}`;

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
export function RoomPricesSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const feedback = useFeedback();
  const [current, next] = useFromMonths();

  const [from, setFrom] = useState(current);
  const [data, setData] = useState<RoomPrices | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;

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
              result.blocks.map((block) => [
                priceKey(room.idRoom, block.key),
                room.prices[block.key] === null ? "" : String(room.prices[block.key]),
              ])
            )
          )
        );
      })
      .catch((problem) => {
        if (!cancelled) setError(errorMessage(problem));
      });

    return () => {
      cancelled = true;
    };
  }, [visible, from]);

  const changes = data
    ? data.rooms.flatMap((room) =>
        data.blocks.map((block) => {
          const raw = values[priceKey(room.idRoom, block.key)] ?? "";
          const price = raw.trim() === "" ? null : parseMoney(raw);
          return {
            idRoom: room.idRoom,
            block: block.key,
            price,
            invalid: raw.trim() !== "" && price === null,
            changed: price !== room.prices[block.key],
          };
        })
      )
    : [];

  const pending = changes.filter((change) => change.invalid || change.changed);

  async function save() {
    if (busy) return;
    if (pending.some((change) => change.invalid)) return setError("Los precios van en pesos, sin centavos");
    if (pending.length === 0) return onClose();

    setBusy(true);
    setError("");

    try {
      await saveRoomPrices(
        from,
        pending.map(({ idRoom, block, price }) => ({ idRoom, block, price }))
      );
      feedback.done(pending.length === 1 ? "Precio guardado" : "Precios guardados");
      onSaved();
      onClose();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Precios de los consultorios">
      <View style={styles.body}>
        <AppText variant="small" tone="muted">
          Por bloque entero, cada vez que se usa. Vacío es sin precio.
        </AppText>

        <FromChips label="Rige desde" value={from} onChange={setFrom} />

        {!data ? (
          error ? null : <SkeletonList rows={2} height={90} />
        ) : data.rooms.length === 0 ? (
          <AppText variant="small" tone="muted">
            No hay consultorios habilitados.
          </AppText>
        ) : (
          data.rooms.map((room) => (
            <View key={room.idRoom} style={styles.block}>
              <AppText variant="bodyStrong">{room.room}</AppText>
              <AppText variant="caption" tone="muted">
                {room.office}
              </AppText>

              <View style={styles.pair}>
                {data.blocks.map((block) => {
                  const key = priceKey(room.idRoom, block.key);
                  const scheduled = from === current && room.next[block.key] !== room.prices[block.key];

                  return (
                    <View key={block.key} style={styles.half}>
                      <Field
                        label={`${block.label} de ${hours(block)}`}
                        value={values[key] ?? ""}
                        onChangeText={(text) => setValues((prev) => ({ ...prev, [key]: text }))}
                        keyboardType="number-pad"
                        placeholder="Sin precio"
                        hint={
                          scheduled
                            ? `Desde ${monthName(next)} ${room.next[block.key] === null ? "sin precio" : money(room.next[block.key]!)}`
                            : undefined
                        }
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {error ? <Note tone="danger">{error}</Note> : null}

        <Button
          label={pending.length > 0 ? `Guardar ${pending.length === 1 ? "1 cambio" : `${pending.length} cambios`}` : "Guardar"}
          block
          loading={busy}
          disabled={!data}
          onPress={save}
        />
      </View>
    </Sheet>
  );
}

/* ============================================================
   Calcular con los bloques
   ============================================================ */

const extraKey = (email: string, line: OutsideLine) => `${email}|${line.day}|${line.initialHour}`;

/**
 * "Calcular": la cuota de cada profesional habilitado sale de los bloques que usa en su
 * agenda y del precio de cada bloque de cada consultorio.
 *
 * Primero se ve cuánto le toca a cada uno y recién después se aplica: pisa las cuotas de
 * todos los elegidos, así que no puede ser un botón que actúa sin mostrar nada. Acá también
 * se le pone valor a mano a lo que cae fuera de los bloques, que el cálculo no sabe cobrar.
 */
export function CalculateSheet({
  visible,
  onClose,
  onApplied,
  onOpenPrices,
}: {
  visible: boolean;
  onClose: () => void;
  onApplied: () => void;
  /** Lleva a los precios cuando falta alguno: sin precio, el bloque no suma. */
  onOpenPrices: () => void;
}) {
  const feedback = useFeedback();
  const { colors } = useTheme();
  const [current] = useFromMonths();

  const [from, setFrom] = useState(current);
  const [preview, setPreview] = useState<CalculationPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;

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
        if (!cancelled) setError(errorMessage(problem));
      });

    return () => {
      cancelled = true;
    };
  }, [visible, from]);

  /** La cuota con los valores a mano que se están escribiendo, antes de guardarlos. */
  function amountOf(row: PreviewRow): number {
    const blocks = row.breakdown.blocks.reduce((sum, line) => sum + line.subtotal, 0);
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
    if (busy) return;

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
      feedback.done(result.updated === 1 ? "Cuota calculada" : `${result.updated} cuotas calculadas`);
      onApplied();
      onClose();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Calcular con los bloques">
      <View style={styles.body}>
        <AppText variant="small" tone="muted">
          Cada bloque usado se paga entero, por cada vez en el mes.
        </AppText>

        <FromChips label="Desde" value={from} onChange={setFrom} />

        {unpriced ? (
          <View style={styles.block}>
            <Note tone="warn">Hay bloques sin precio y no suman.</Note>
            <View style={styles.inlineAction}>
              <Button label="Cargar precios" icon="tags" variant="ghost" onPress={onOpenPrices} />
            </View>
          </View>
        ) : null}

        {!preview ? (
          error ? null : <SkeletonList rows={3} height={70} />
        ) : rows.length === 0 ? (
          <AppText variant="small" tone="muted">
            Ningún profesional habilitado tiene horarios cargados.
          </AppText>
        ) : (
          rows.map((row) => {
            const amount = amountOf(row);
            const on = selected.has(row.email);
            const shared = row.breakdown.blocks.filter((line) => (line.sharedWith?.length ?? 0) > 0);

            return (
              <View key={row.email} style={[styles.card, { backgroundColor: colors.sunken }, !on && styles.off]}>
                <View style={styles.cardHead}>
                  <View style={styles.lineText}>
                    <AppText variant="bodyStrong">
                      {row.surname}, {row.name}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {row.blocks === 1 ? "1 bloque en el mes" : `${row.blocks} bloques en el mes`}
                      {row.speciality ? ` · ${row.speciality}` : ""}
                    </AppText>
                    <AppText variant="small" chrome>
                      {row.before !== null && row.before !== amount ? `${money(row.before)} → ` : ""}
                      {money(amount)}
                    </AppText>
                  </View>
                  <Switch value={on} onValueChange={() => toggle(row.email)} accessibilityLabel={`Calcular la cuota de ${row.name} ${row.surname}`} />
                </View>

                {row.breakdown.outside.map((line) => {
                  const key = extraKey(row.email, line);
                  return (
                    <Field
                      key={key}
                      label={`${capitalize(DAY_LABEL[line.day] ?? line.day)} ${line.parts
                        .map((part) => `de ${part.from} a ${part.to}`)
                        .join(" y ")} · ${line.room} · ${line.times === 1 ? "1 vez" : `${line.times} veces`}`}
                      value={extras[key] ?? ""}
                      onChangeText={(text) => setExtras((prev) => ({ ...prev, [key]: text }))}
                      keyboardType="number-pad"
                      placeholder="Valor por vez"
                    />
                  );
                })}

                {shared.map((line) => (
                  <AppText key={`${line.roomId}-${line.day}-${line.block}`} variant="caption" tone="muted">
                    Comparte la {BLOCK_LABEL[line.block].toLowerCase()} del {DAY_LABEL[line.day] ?? line.day} en {line.room} con{" "}
                    {line.sharedWith!.join(" y ")}. Cada uno paga el bloque entero.
                  </AppText>
                ))}

                <View style={styles.inlineAction}>
                  <Button
                    label={expanded === row.email ? "Ocultar detalle" : "Ver detalle"}
                    variant="ghost"
                    onPress={() => setExpanded((prev) => (prev === row.email ? null : row.email))}
                  />
                </View>

                {expanded === row.email ? <RentBreakdownView breakdown={row.breakdown} /> : null}
              </View>
            );
          })
        )}

        {preview && preview.withoutSchedule.length > 0 ? (
          <AppText variant="caption" tone="muted">
            {preview.withoutSchedule.map((person) => `${person.name} ${person.surname}`).join(", ")}{" "}
            {preview.withoutSchedule.length === 1 ? "no tiene horarios y queda como está." : "no tienen horarios y quedan como están."}
          </AppText>
        ) : null}

        {preview ? (
          <AppText variant="caption" tone="muted">
            Las cuotas de {preview.label} pasan a calcularse así, y los meses siguientes también.
          </AppText>
        ) : null}

        {error ? <Note tone="danger">{error}</Note> : null}

        {preview && chosen.length > 0 ? (
          <AppText variant="subtitle" chrome>
            Total {money(total)}
          </AppText>
        ) : null}

        <Button
          label={chosen.length === 1 ? "Aplicar a 1 profesional" : `Aplicar a ${chosen.length} profesionales`}
          icon="calculator"
          block
          loading={busy}
          disabled={!preview || chosen.length === 0}
          onPress={apply}
        />
      </View>
    </Sheet>
  );
}

/* ============================================================
   Aumento
   ============================================================ */

/**
 * Un aumento en porcentaje, para todos o para los elegidos, desde este mes o el que viene.
 *
 * Con todos elegidos se puede subir también el precio de los bloques: así la cuota de
 * quien calcula por bloques sube con los precios, y el que se sume después entra con el
 * precio nuevo. Con algunos, los precios quedan quietos (subirían también los de los
 * demás) y el aumento va a la cuota de cada elegido.
 */
export function IncreaseSheet({ visible, onClose, onApplied }: { visible: boolean; onClose: () => void; onApplied: () => void }) {
  const feedback = useFeedback();
  const [current] = useFromMonths();

  const [from, setFrom] = useState(current);
  const [percent, setPercent] = useState("");
  const [rows, setRows] = useState<RentRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;

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
        if (!cancelled) setError(errorMessage(problem));
      });

    return () => {
      cancelled = true;
    };
  }, [visible, from]);

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
    if (busy) return;
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
      feedback.done(result.skipped.length ? `${applied}. Sin cuota, quedan igual ${result.skipped.join(", ")}` : applied);
      onApplied();
      onClose();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Aumento de alquiler">
      <View style={styles.body}>
        <AppText variant="small" tone="muted">
          En porcentaje, sobre la cuota de cada uno.
        </AppText>

        <Field label="Aumento, en %" value={percent} onChangeText={setPercent} keyboardType="decimal-pad" placeholder="10" />

        <FromChips label="Desde" value={from} onChange={setFrom} />

        <View style={styles.block}>
          <View style={styles.listHead}>
            <AppText variant="caption" tone="muted" chrome style={styles.lineText}>
              Profesionales
            </AppText>
            <Button label="Todos" variant="ghost" onPress={() => setSelected(new Set(list.map((row) => row.email)))} />
            <Button label="Ninguno" variant="ghost" onPress={() => setSelected(new Set())} />
          </View>

          {!rows ? (
            error ? null : <SkeletonList rows={3} height={52} />
          ) : list.length === 0 ? (
            <AppText variant="small" tone="muted">
              No hay profesionales habilitados.
            </AppText>
          ) : (
            <Group>
              {list.map((row, index) => {
                const on = selected.has(row.email);
                const raised = row.amount !== null && valid && on ? Math.round(row.amount * (1 + value / 100)) : row.amount;

                return (
                  <Row
                    key={row.email}
                    title={`${row.surname}, ${row.name}`}
                    subtitle={`${row.kind === "blocks" ? "Por bloques" : row.kind === "fixed" ? "Cuota fija" : "Sin cuota, queda igual"}${
                      row.amount === null ? "" : ` · ${valid && on ? `${money(row.amount)} → ` : ""}${money(raised ?? 0)}`
                    }`}
                    subtitleIsData
                    last={index === list.length - 1}
                    right={<Switch value={on} onValueChange={() => toggle(row.email)} />}
                  />
                );
              })}
            </Group>
          )}
        </View>

        {everyone ? (
          <Group>
            <Row
              title="Subir también los precios de los consultorios"
              subtitle="Quien se sume después entra con el precio nuevo"
              last
              right={<Switch value={prices} onValueChange={setPrices} />}
            />
          </Group>
        ) : (
          <AppText variant="caption" tone="muted">
            El aumento va solo a sus cuotas.
          </AppText>
        )}

        {valid && chosen.length > 0 ? (
          <AppText variant="small">
            Las cuotas de {monthName(from)} pasan de {money(before)} a {money(after)}.
          </AppText>
        ) : null}

        {error ? <Note tone="danger">{error}</Note> : null}

        <Button label="Aplicar aumento" icon="arrow-trend-up" block loading={busy} disabled={!rows || chosen.length === 0} onPress={apply} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingBottom: space.md },
  block: { gap: space.xs },
  pair: { flexDirection: "row", gap: space.md, marginTop: space.xs },
  half: { flex: 1 },
  breakdown: { gap: space.xs },
  line: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  lineText: { flex: 1, gap: 2 },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  off: { opacity: 0.55 },
  inlineAction: { alignItems: "flex-start", marginLeft: -space.md },
  listHead: { flexDirection: "row", alignItems: "center" },
});
