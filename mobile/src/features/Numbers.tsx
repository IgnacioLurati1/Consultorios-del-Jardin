import { StyleSheet, View } from "react-native";
import { MonthPoint } from "../api/analytics";
import { AppText } from "../components/Text";
import { compactNumber, money } from "../lib/dates";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/**
 * Piezas para las pantallas de números.
 *
 * No hay librería de gráficos a propósito: en un teléfono, doce meses en una grilla con
 * ejes no se leen. Una fila por mes con una barra proporcional dice lo mismo, entra en el
 * ancho y se puede tocar.
 */

/** El dato grande de la pantalla. Uno solo por pantalla: si hay tres, no hay ninguno. */
export function Headline({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.headline}>
      <AppText variant="caption" tone="muted" chrome>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="display">{value}</AppText>
      {note ? (
        <AppText variant="small" tone="muted">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

/** Un par de números que se leen juntos, uno al lado del otro. */
export function Pair({ items }: { items: { label: string; value: string }[] }) {
  const { colors } = useTheme();

  return (
    <View style={styles.pair}>
      {items.map((item) => (
        <View key={item.label} style={[styles.pairCell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="figure">{item.value}</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/**
 * Los meses, uno por fila, con una barra proporcional al mes más alto. Se compara de un
 * vistazo sin tener que leer los números.
 */
export function MonthBars({
  months,
  pick = (month) => month.appointments,
  format = (value) => String(value),
  emptyLabel = "Todavía no hay meses cerrados",
}: {
  months: MonthPoint[];
  pick?: (month: MonthPoint) => number;
  format?: (value: number) => string;
  emptyLabel?: string;
}) {
  const { colors } = useTheme();

  const values = months.map(pick);
  const top = Math.max(...values, 1);

  if (months.length === 0) {
    return (
      <AppText variant="small" tone="muted">
        {emptyLabel}
      </AppText>
    );
  }

  return (
    <View style={[styles.bars, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {months.map((month, index) => {
        const value = values[index];

        return (
          <View
            key={month.key}
            accessible
            accessibilityLabel={`${month.label}: ${format(value)}`}
            style={styles.barRow}
          >
            <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.barLabel}>
              {month.label}
            </AppText>

            <View style={[styles.barTrack, { backgroundColor: colors.sunken }]}>
              <View
                style={[
                  styles.barFill,
                  { backgroundColor: colors.green, width: `${Math.max((value / top) * 100, value > 0 ? 3 : 0)}%` },
                ]}
              />
            </View>

            <AppText variant="caption" numberOfLines={1} style={styles.barValue}>
              {format(value)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

/** Ranking simple: una fila por cosa, con barra y cantidad. */
export function Ranking({ items }: { items: { key: string; label: string; count: number }[] }) {
  const { colors } = useTheme();
  const top = Math.max(...items.map((item) => item.count), 1);

  return (
    <View style={[styles.bars, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.map((item) => (
        <View key={item.key} accessible accessibilityLabel={`${item.label}: ${item.count}`} style={styles.barRow}>
          <AppText variant="caption" numberOfLines={1} style={styles.rankLabel}>
            {item.label}
          </AppText>

          <View style={[styles.barTrack, { backgroundColor: colors.sunken }]}>
            <View style={[styles.barFill, { backgroundColor: colors.green, width: `${Math.max((item.count / top) * 100, 3)}%` }]} />
          </View>

          <AppText variant="caption" tone="muted" style={styles.barValue}>
            {compactNumber(item.count)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export { money };

const styles = StyleSheet.create({
  headline: { gap: space.xs, paddingTop: space.lg },
  pair: { flexDirection: "row", gap: space.md },
  pairCell: {
    flex: 1,
    gap: space.xs,
    padding: space.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  bars: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  barRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  barLabel: { width: 64 },
  rankLabel: { width: 110 },
  barTrack: { flex: 1, height: 8, borderRadius: radius.full, overflow: "hidden" },
  barFill: { height: 8, borderRadius: radius.full },
  barValue: { minWidth: 56, textAlign: "right", fontVariant: ["tabular-nums"] },
});
