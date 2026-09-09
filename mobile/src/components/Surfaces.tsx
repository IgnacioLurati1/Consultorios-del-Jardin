import { FontAwesome6 } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { useSimpleText } from "../lib/textMode";
import { elevation, radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { AppText } from "./Text";

/**
 * Las tres formas de agrupar contenido, en orden de cuánto pesan.
 *
 * `Section` no dibuja nada: separa con aire y un título chico. Es lo que hay que usar
 * casi siempre. `Group` es una lista de filas con una línea fina entre medio, como las
 * listas agrupadas del sistema. `Card` es lo más pesado y se guarda para cuando el
 * bloque es una cosa en sí misma que se toca o se mira aparte.
 *
 * Una pantalla que es una pila de tarjetas blancas sobre fondo gris se lee como
 * cualquier otra app; agrupar con espacio se lee como esta.
 */

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {(title || action) && (
        <View style={styles.sectionHead}>
          {title ? (
            <AppText variant="caption" tone="muted" style={styles.sectionTitle}>
              {title.toUpperCase()}
            </AppText>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevation.card, style]}>
      {children}
    </View>
  );
}

/** Contenedor de filas. Redondea las puntas y pinta las líneas entre medio. */
export function Group({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  /** Dato corto alineado a la derecha: una hora, un importe, una cantidad. */
  value?: string;
  icon?: React.ComponentProps<typeof FontAwesome6>["name"];
  onPress?: () => void;
  /**
   * El subtítulo trae un dato y no una explicación, así que "menos texto" no lo saca.
   *
   * La diferencia es qué pasa si no está. Una explicación dice de nuevo, con otras
   * palabras, lo que el título ya dijo: sacarla no le quita nada a nadie. Un dato —un
   * importe, una fecha, un mail, en qué estado quedó algo— es la única forma de
   * enterarse, y sin él la fila deja de servir.
   */
  subtitleIsData?: boolean;
  /** Última fila del grupo: no lleva línea abajo. */
  last?: boolean;
  right?: ReactNode;
  destructive?: boolean;
  /**
   * De qué color va el ícono, cuando decir cuál es aporta algo.
   *
   * `green` es para la fila que lleva a una pantalla del consultorio: el ícono deja de ser
   * un adorno gris y pasa a ser la marca de "esto abre algo". `danger` es para un dato que
   * hay que atender, como plata sin cobrar.
   *
   * Sin esto el ícono va gris, que sigue siendo lo correcto para la mayoría: una columna
   * de cuadraditos de color delante de cada fila es decoración y no información.
   */
  tone?: "green" | "danger";
}

/**
 * Una fila de lista. Lleva ícono solo cuando el ícono dice algo que el texto no dice;
 * una columna de cuadraditos de color delante de cada fila es decoración, no información.
 */
export function Row({ title, subtitle, subtitleIsData, value, icon, onPress, last, right, destructive, tone }: RowProps) {
  const { colors } = useTheme();
  const [simple] = useSimpleText();
  const tint = destructive ? colors.danger : colors.text;

  /*
   * El ícono de una fila va en el verde de la marca.
   *
   * Sigue valiendo lo de siempre —una fila lleva ícono solo cuando el ícono dice algo que
   * el texto no dice, y la mayoría no lleva—, y justamente por eso el que está puesto se
   * pinta: si sobrevivió a esa regla es porque significa algo.
   *
   * Es una regla y no una decisión fila por fila, así que las listas de toda la app se ven
   * iguales sin que nadie tenga que acordarse. Se probó pintando solo las que llevaban a
   * otra pantalla y quedaba peor: en el mismo grupo convivían tres verdes y un gris, y la
   * diferencia no significaba nada para el que la mira.
   */
  const cual = tone ?? "green";

  const iconColor = destructive
    ? colors.danger
    : cual === "green"
      ? colors.greenDark
      : cual === "danger"
        ? colors.danger
        : colors.muted;

  const shown = subtitle && (!simple || subtitleIsData) ? subtitle : undefined;

  const body = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      {icon ? <FontAwesome6 name={icon} size={16} color={iconColor} style={styles.rowIcon} /> : null}

      <View style={styles.rowText}>
        <AppText variant="body" numberOfLines={1} style={{ color: tint }}>
          {title}
        </AppText>
        {shown ? (
          // El dato de una fila marcada va del color de la marca: en "Faltan $17.500" lo
          // que hay que ver es el numero, no la flecha de al lado.
          <AppText variant="caption" tone={tone === "danger" ? "danger" : "muted"} numberOfLines={2}>
            {shown}
          </AppText>
        ) : null}
      </View>

      {value ? (
        <AppText
          variant="caption"
          tone={tone === "danger" ? "danger" : "muted"}
          numberOfLines={1}
          style={styles.rowValue}
        >
          {value}
        </AppText>
      ) : null}

      {right}

      {/* La flecha promete "esto te lleva a otro lado". Una acción destructiva no
          lleva a ningún lado: abre una confirmación. Y cuando la fila ya trae algo a la
          derecha, esa cosa manda: la flecha la pone quien la armó, si hace falta. */}
      {onPress && !right && !destructive ? <FontAwesome6 name="chevron-right" size={13} color={colors.muted} /> : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown ? `${title}. ${shown}` : title}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => (pressed && Platform.OS === "ios" ? styles.pressed : undefined)}
    >
      {body}
    </Pressable>
  );
}

/** Aviso corto dentro del contenido: explica algo, no interrumpe. */
export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "danger" }) {
  const { colors } = useTheme();

  const skin = {
    info: { bg: colors.greenSoft, fg: colors.greenDark },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];

  return (
    <View style={[styles.note, { backgroundColor: skin.bg }]}>
      <AppText variant="small" style={{ color: skin.fg }}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xxl },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
    minHeight: 22,
  },
  sectionTitle: { letterSpacing: 0.8 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 8,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowIcon: { width: 20, textAlign: "center" },
  rowText: { flex: 1, gap: 2 },
  /* El dato de la derecha se lleva el ancho que necesita y el título cede.
     Estaba topeado en el 40%, y una comparación como "$ 78.000 → $ 110.000" no entraba:
     se cortaba justo en el número que se venía a comparar. Al revés funciona mejor porque
     el título de estas filas es corto ("Cobrado", "Turnos") y el dato no. El tope sigue,
     más arriba, para que un valor enorme no se coma el título del todo. */
  rowValue: { flexShrink: 0, maxWidth: "62%", textAlign: "right" },
  pressed: { opacity: 0.6 },
  note: {
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
