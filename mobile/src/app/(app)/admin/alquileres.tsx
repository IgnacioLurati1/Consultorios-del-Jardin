import { FontAwesome6 } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { errorMessage } from "../../../api/client";
import { findRentMonth, RentMonth, RentRow, setRentPayment } from "../../../api/rent";
import { Button } from "../../../components/Button";
import { ChipRow, Tag } from "../../../components/Chip";
import { useFeedback } from "../../../components/Feedback";
import { Screen } from "../../../components/Screen";
import { Sheet } from "../../../components/Sheet";
import { EmptyState, ErrorState, SkeletonList } from "../../../components/States";
import { Group, Note, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { Headline, Pair } from "../../../features/Numbers";
import {
  CalculateSheet,
  DueDaySheet,
  IncreaseSheet,
  RentAmountSheet,
  RentBreakdownView,
  RentPaymentSheet,
  RoomPricesSheet,
} from "../../../features/RentSheets";
import { money } from "../../../lib/dates";
import {
  capitalize,
  formatAdjust,
  isMonthKey,
  monthKeyOf,
  monthName,
  shiftMonth,
  STATUS_LABEL,
  STATUS_TONE,
  toLocalDate,
  todayISO,
} from "../../../lib/rent";
import { radius, space, TOUCH } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

type Filter = "all" | "pending" | "paid" | "late";
type Dialog = "prices" | "calculate" | "increase" | "dueDay" | null;

const FILTERS: { key: Filter; label: string; test: (row: RentRow) => boolean }[] = [
  { key: "all", label: "Todos", test: () => true },
  { key: "pending", label: "Con saldo", test: (row) => row.pending > 0 },
  { key: "paid", label: "Pagaron", test: (row) => row.status === "paid" },
  { key: "late", label: "Fuera de término", test: (row) => row.late },
];

/** Hasta cuántos meses para atrás se puede ir aunque no haya cuotas, para cargar historia vieja. */
const MONTHS_BACK = 36;

/** De dónde sale la cuota, en la línea chica de abajo del nombre. */
function kindText(row: RentRow): string {
  if (row.kind === "blocks") {
    const blocks = row.blocks === 1 ? "1 bloque en el mes" : `${row.blocks ?? 0} bloques en el mes`;
    const adjust = row.breakdown?.adjust ? ` · ${formatAdjust(row.breakdown.adjust)}` : "";
    return `${blocks}${adjust}`;
  }
  if (row.kind === "fixed") return "Cuota fija";
  if (row.hasSchedule === false) return "Sin horarios";
  return "";
}

/**
 * Los alquileres: cuánto paga cada profesional por mes, si pagó y cuándo. Es la misma
 * pantalla que la página, sin la planilla de Excel, que queda para la computadora.
 *
 * Arriba van los totales, que es lo que se mira primero. Tocar a un profesional abre lo que
 * se hace más seguido, que es marcar que pagó hoy, y un toque más adentro está lo demás.
 * Las reglas que cambian para todos (precios, calcular, aumento, vencimiento) van al final
 * y rigen desde este mes o el que viene, sin importar qué mes se esté mirando.
 */
export default function RentScreen() {
  const params = useLocalSearchParams<{ mes?: string; estado?: string }>();
  const feedback = useFeedback();
  const thisMonth = monthKeyOf();

  // Desde los números se llega con ?mes=2026-09&estado=pendientes, igual que en la página.
  const [month, setMonth] = useState(
    isMonthKey(params.mes) && params.mes <= shiftMonth(thisMonth, 1) ? params.mes : thisMonth
  );
  const [filter, setFilter] = useState<Filter>(params.estado === "pendientes" ? "pending" : "all");

  const [data, setData] = useState<RentMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [dialog, setDialog] = useState<Dialog>(null);
  const [open, setOpen] = useState<RentRow | null>(null);
  const [paying, setPaying] = useState<RentRow | null>(null);
  const [editing, setEditing] = useState<RentRow | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  // El mes que se está mirando ahora. Una respuesta que vuelve después de cambiar de mes
  // no puede pisar la pantalla con los números del mes anterior.
  const shown = useRef(month);
  shown.current = month;

  const reload = () => setReloadKey((key) => key + 1);

  function accept(result: RentMonth) {
    if (result.month === shown.current) setData(result);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(null);

    findRentMonth(month)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((problem) => {
        if (!cancelled) setFailed(errorMessage(problem));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [month, reloadKey]);

  async function markPaidToday(row: RentRow) {
    setBusyRow(row.email);

    try {
      accept(await setRentPayment(month, row.email, { status: "paid", paidOn: todayISO() }));
      feedback.done(`Pago de ${row.name} ${row.surname} registrado`);
      setOpen(null);
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    } finally {
      setBusyRow(null);
    }
  }

  const current = data?.current ?? thisMonth;
  const oldest = shiftMonth(current, -MONTHS_BACK);
  const minMonth = data && data.firstMonth < oldest ? data.firstMonth : oldest;
  const maxMonth = data?.next ?? shiftMonth(thisMonth, 1);
  const upcoming = month > current;

  // Mientras llega el mes nuevo se sigue viendo el anterior, apagado: cambiar de mes no
  // tiene por qué vaciar la pantalla.
  const rows = data?.rows ?? [];
  const activeFilter = FILTERS.find((item) => item.key === filter)!;
  const visible = rows.filter(activeFilter.test);
  const withoutAmount = rows.filter((row) => row.active && row.amount === null).length;
  const withWarnings = rows.filter((row) => row.warnings.length > 0).length;

  return (
    <>
      <Screen
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          reload();
        }}
      >
        <MonthSwitcher
          month={month}
          canBack={month > minMonth}
          canForward={month < maxMonth}
          onChange={setMonth}
          tag={month === current ? "En curso" : upcoming ? "Estimado" : null}
          onToday={month !== current ? () => setMonth(current) : undefined}
        />

        {failed && !data ? (
          <ErrorState message={failed} onRetry={reload} />
        ) : !data ? (
          <View style={styles.top}>
            <SkeletonList rows={4} height={70} />
          </View>
        ) : (
          <View style={loading ? styles.swapping : undefined}>
            <Headline
              label={`Cuotas de ${data.label}`}
              value={money(data.totals.due)}
              note={`${rows.filter((row) => row.amount !== null).length} profesionales${upcoming ? " · estimado" : ""}`}
            />

            <Pair
              items={[
                { label: "Cobrado", value: money(data.totals.collected) },
                { label: "Pendiente", value: money(data.totals.pending) },
              ]}
            />

            <View style={styles.spaced}>
              <Group>
                <Row
                  title="Con saldo"
                  subtitle="Ver las cuotas con saldo"
                  value={String(data.totals.partial + data.totals.unpaid)}
                  onPress={() => setFilter("pending")}
                />
                <Row
                  title="Fuera de término"
                  subtitle={`Vencimiento el día ${data.dueDay}`}
                  subtitleIsData
                  value={String(data.totals.late)}
                  tone={data.totals.late > 0 ? "danger" : undefined}
                  last
                  onPress={() => setDialog("dueDay")}
                />
              </Group>
            </View>

            {month >= current && withoutAmount > 0 ? (
              <View style={styles.spaced}>
                <Note tone="warn">
                  {withoutAmount === 1 ? "Un profesional sin cuota." : `${withoutAmount} profesionales sin cuota.`} «Calcular» la
                  arma con su agenda.
                </Note>
              </View>
            ) : null}

            {withWarnings > 0 ? (
              <View style={styles.spaced}>
                <Note tone="warn">{withWarnings === 1 ? "Una cuota tiene" : `${withWarnings} cuotas tienen`} bloques sin precio.</Note>
              </View>
            ) : null}

            <Section title="Profesionales">
              <View style={styles.filters}>
                <ChipRow
                  options={FILTERS.map((item) => ({ key: item.key, label: `${item.label} (${rows.filter(item.test).length})` }))}
                  value={filter}
                  onChange={setFilter}
                />
              </View>

              {visible.length === 0 ? (
                <EmptyState
                  compact
                  icon="money-bill-wave"
                  title={
                    rows.length === 0
                      ? month < current
                        ? `Sin cuotas registradas en ${data.label}`
                        : "Sin profesionales habilitados"
                      : "Ninguna cuota en este filtro"
                  }
                />
              ) : (
                <Group>
                  {visible.map((row, index) => (
                    <RentLine key={row.email} row={row} last={index === visible.length - 1} onPress={() => setOpen(row)} />
                  ))}
                </Group>
              )}
            </Section>

            <Section title="Reglas del alquiler">
              <Group>
                <Row
                  title="Precios de los consultorios"
                  subtitle="Por bloque, mañana y tarde"
                  icon="tags"
                  onPress={() => setDialog("prices")}
                />
                <Row
                  title="Calcular con los bloques"
                  subtitle="Según la agenda y los precios"
                  icon="calculator"
                  onPress={() => setDialog("calculate")}
                />
                <Row
                  title="Aumento de alquiler"
                  subtitle="En porcentaje, para todos o algunos"
                  icon="arrow-trend-up"
                  onPress={() => setDialog("increase")}
                />
                <Row
                  title="Vencimiento"
                  subtitle="Día del mes en que vence la cuota"
                  value={`Día ${data.dueDay}`}
                  icon="calendar-day"
                  last
                  onPress={() => setDialog("dueDay")}
                />
              </Group>

              <View style={styles.spaced}>
                <Note>Los cambios rigen desde este mes o el que viene.</Note>
              </View>
            </Section>
          </View>
        )}
      </Screen>

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open ? `${open.name} ${open.surname}` : ""}>
        {open && data ? (
          <RowDetail
            row={open}
            data={data}
            busy={busyRow === open.email}
            onPaidToday={() => markPaidToday(open)}
            onPayment={() => {
              setPaying(open);
              setOpen(null);
            }}
            onAmount={() => {
              setEditing(open);
              setOpen(null);
            }}
          />
        ) : null}
      </Sheet>

      {data ? (
        <>
          <RentPaymentSheet row={paying} data={data} onClose={() => setPaying(null)} onSaved={accept} />
          <RentAmountSheet row={editing} data={data} onClose={() => setEditing(null)} onSaved={accept} />
          <DueDaySheet visible={dialog === "dueDay"} dueDay={data.dueDay} onClose={() => setDialog(null)} onSaved={reload} />
        </>
      ) : null}

      <RoomPricesSheet visible={dialog === "prices"} onClose={() => setDialog(null)} onSaved={reload} />
      <CalculateSheet
        visible={dialog === "calculate"}
        onClose={() => setDialog(null)}
        onApplied={reload}
        onOpenPrices={() => setDialog("prices")}
      />
      <IncreaseSheet visible={dialog === "increase"} onClose={() => setDialog(null)} onApplied={reload} />
    </>
  );
}

function MonthSwitcher({
  month,
  canBack,
  canForward,
  onChange,
  tag,
  onToday,
}: {
  month: string;
  canBack: boolean;
  canForward: boolean;
  onChange: (month: string) => void;
  tag: string | null;
  onToday?: () => void;
}) {
  const { colors } = useTheme();

  const step = (direction: -1 | 1, enabled: boolean) => (
    <Pressable
      onPress={() => onChange(shiftMonth(month, direction))}
      disabled={!enabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={direction < 0 ? "Mes anterior" : "Mes siguiente"}
      android_ripple={{ color: colors.border, borderless: true }}
      style={({ pressed }) => [styles.step, !enabled && styles.disabled, pressed && Platform.OS === "ios" && styles.pressed]}
    >
      <FontAwesome6 name={direction < 0 ? "chevron-left" : "chevron-right"} size={16} color={colors.green} />
    </Pressable>
  );

  return (
    <View style={styles.top}>
      <View style={[styles.switcher, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {step(-1, canBack)}
        <AppText variant="subtitle" style={styles.monthName}>
          {capitalize(monthName(month))}
        </AppText>
        {step(1, canForward)}
      </View>

      {tag || onToday ? (
        <View style={styles.monthMeta}>
          {/* La etiqueta se pega arriba por su cuenta (alignSelf); envuelta, queda centrada
              con el botón de al lado. */}
          <View>{tag ? <Tag label={tag} tone={tag === "En curso" ? "green" : "neutral"} /> : null}</View>
          {onToday ? <Button label="Mes en curso" variant="ghost" onPress={onToday} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Un profesional en la lista del mes: quién, cuánto y cómo está. */
function RentLine({ row, last, onPress }: { row: RentRow; last: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const sub = [row.speciality, row.active ? null : "deshabilitado", kindText(row)].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.name} ${row.surname}, ${row.amount === null ? "sin cuota" : money(row.amount)}, ${STATUS_LABEL[row.status]}`}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.line,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        !row.active && styles.inactive,
        pressed && Platform.OS === "ios" && styles.pressed,
      ]}
    >
      <View style={styles.lineText}>
        <AppText variant="body" numberOfLines={1}>
          {row.surname}, {row.name}
        </AppText>
        {sub ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {sub}
          </AppText>
        ) : null}
        <View style={styles.tags}>
          <Tag label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />
          {row.late ? <Tag label="Fuera de término" tone="danger" /> : null}
          {row.warnings.length > 0 ? <Tag label="Falta un precio" tone="warn" /> : null}
        </View>
      </View>

      <View style={styles.lineMoney}>
        <AppText variant="bodyStrong" chrome tone={row.amount === null ? "muted" : "default"}>
          {row.amount === null ? "Sin cuota" : money(row.amount)}
        </AppText>
        {row.amount !== null && row.pending > 0 ? (
          <AppText variant="caption" tone={row.late ? "danger" : "muted"}>
            Saldo {money(row.pending)}
          </AppText>
        ) : null}
      </View>

      <FontAwesome6 name="chevron-right" size={13} color={colors.muted} />
    </Pressable>
  );
}

/** Lo que se ve y se hace con la cuota de un profesional. */
function RowDetail({
  row,
  data,
  busy,
  onPaidToday,
  onPayment,
  onAmount,
}: {
  row: RentRow;
  data: RentMonth;
  busy: boolean;
  onPaidToday: () => void;
  onPayment: () => void;
  onAmount: () => void;
}) {
  const payable = row.amount !== null && row.amount > 0;

  return (
    <View style={styles.detail}>
      <AppText variant="small" tone="muted">
        {capitalize(data.label)}
        {row.speciality ? ` · ${row.speciality}` : ""}
      </AppText>

      <Group>
        <Row title="Cuota" value={row.amount === null ? "Sin cuota" : money(row.amount)} subtitle={kindText(row) || undefined} />
        <Row title="Estado" right={<Tag label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />} />
        <Row
          title="Pagado"
          value={row.paidAmount > 0 ? money(row.paidAmount) : "Nada"}
          subtitle={row.paidOn ? `El ${toLocalDate(row.paidOn)}` : undefined}
          subtitleIsData
        />
        <Row title="Saldo" value={row.amount === null ? "Sin cuota" : money(row.pending)} tone={row.late && row.pending > 0 ? "danger" : undefined} last />
      </Group>

      {row.late ? <Note tone="danger">Fuera de término. La cuota vence el día {data.dueDay}.</Note> : null}

      {row.breakdown ? (
        <View style={styles.breakdown}>
          <AppText variant="caption" tone="muted" chrome>
            Detalle
          </AppText>
          <RentBreakdownView breakdown={row.breakdown} />
        </View>
      ) : null}

      {payable && row.status !== "paid" ? (
        <Button label="Pagó hoy" icon="check" block loading={busy} onPress={onPaidToday} />
      ) : null}
      {payable ? (
        <Button label={row.status === "unpaid" ? "Otro pago" : "Editar pago"} variant="secondary" block onPress={onPayment} />
      ) : null}
      <Button label="Cambiar la cuota" icon="pen" variant="ghost" block onPress={onAmount} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: space.lg },
  switcher: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: TOUCH + 4,
  },
  step: { width: TOUCH + 4, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  monthName: { flex: 1, textAlign: "center" },
  // Con wrap: si el botón no entra al lado de la etiqueta, baja de renglón en vez de
  // salirse de la pantalla.
  monthMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    marginTop: space.sm,
  },
  swapping: { opacity: 0.55 },
  spaced: { marginTop: space.md },
  filters: { marginBottom: space.md, marginHorizontal: -space.xl, paddingHorizontal: space.xl },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 20,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  lineText: { flex: 1, gap: 2 },
  lineMoney: { alignItems: "flex-end", gap: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: 2 },
  inactive: { opacity: 0.6 },
  detail: { gap: space.md, paddingBottom: space.md },
  breakdown: { gap: space.xs },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.6 },
});
