import { FontAwesome6 } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Screen } from "../../components/Screen";
import { EmptyState } from "../../components/States";
import { AppText } from "../../components/Text";
import {
  Aviso,
  borrarAviso,
  borrarTodos,
  marcarLeidos,
  useAvisos,
  type NotificationTone,
} from "../../lib/avisos";
import { radius, space, TOUCH } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

const ICONO: Record<NotificationTone, string> = {
  urgent: "circle-exclamation",
  warn: "triangle-exclamation",
  good: "check",
  info: "circle-info",
};

/**
 * Los avisos, en una pantalla propia.
 *
 * En la web esto es un panel que cuelga de la campana; en el teléfono no: un panel
 * flotante sobre una pantalla angosta se toca mal y tapa lo que está atrás. Es una
 * pantalla y se cierra como cualquier otra.
 *
 * Se dan por leídos al entrar, que es el momento en el que efectivamente se leyeron. Lo
 * que ya estaba en pantalla no cambia de aspecto por eso: esconder lo recién leído sería
 * vaciar la lista en la cara de quien la está por leer.
 */
export default function NovedadesScreen() {
  const { colors } = useTheme();
  const { avisos, refrescar } = useAvisos();

  useFocusEffect(
    useCallback(() => {
      // Se pide de nuevo al entrar, no solo al pasar por Inicio: se llega acá desde
      // cualquier pantalla y lo que se viene a ver es qué hay ahora.
      //
      // Y recién después se dan por leídos. Al revés los dos salen juntos, y la respuesta
      // del pedido —armada antes de que el servidor procesara el visto— pisa lo marcado
      // y el número vuelve a prenderse solo.
      void refrescar().then(() => marcarLeidos());
    }, [refrescar])
  );

  const acento: Record<NotificationTone, string> = {
    info: colors.muted,
    good: colors.green,
    warn: colors.warn,
    urgent: colors.danger,
  };

  if (avisos.length === 0) {
    return (
      <Screen scroll={false}>
        <EmptyState icon="bell" title="No hay novedades por el momento" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.barra}>
        <AppText variant="caption" tone="muted">
          {avisos.length === 1 ? "1 aviso" : `${avisos.length} avisos`}
        </AppText>

        <Pressable onPress={() => borrarTodos()} accessibilityRole="button" hitSlop={8}>
          <AppText variant="caption" tone="danger" chrome>
            Borrar todo
          </AppText>
        </Pressable>
      </View>

      <View style={styles.lista}>
        {avisos.map((aviso) => (
          <Fila key={aviso.id} aviso={aviso} acento={acento[aviso.tone]} />
        ))}
      </View>
    </Screen>
  );
}

function Fila({ aviso, acento }: { aviso: Aviso; acento: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.fila, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: acento }]}>
      <Pressable
        onPress={() => aviso.to && router.push(aviso.to as never)}
        disabled={!aviso.to}
        accessibilityRole={aviso.to ? "button" : undefined}
        android_ripple={aviso.to ? { color: colors.border } : undefined}
        style={({ pressed }) => [styles.cuerpo, pressed && aviso.to && Platform.OS === "ios" && styles.pressed]}
      >
        <View style={[styles.icono, { backgroundColor: colors.sunken }]}>
          <FontAwesome6 name={ICONO[aviso.tone] as never} size={13} color={acento} />
        </View>

        <View style={styles.texto}>
          <AppText variant="bodyStrong">{aviso.title}</AppText>
          {aviso.body ? (
            <AppText variant="small" tone="muted">
              {aviso.body}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="muted" style={styles.cuando}>
            {haceCuanto(aviso.at)}
          </AppText>
        </View>
      </Pressable>

      <Pressable
        onPress={() => borrarAviso(aviso.id)}
        accessibilityRole="button"
        accessibilityLabel={`Borrar el aviso ${aviso.title}`}
        hitSlop={6}
        style={styles.tacho}
      >
        <FontAwesome6 name="trash" size={13} color={colors.muted} />
      </Pressable>
    </View>
  );
}

/** "recién", "hace 2 h", "ayer". Lo que importa es qué tan reciente es, no la hora. */
function haceCuanto(at: number): string {
  const minutos = Math.floor((Date.now() - at) / 60000);

  if (minutos < 2) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  lista: { gap: space.sm },
  /* El color va en el borde de la izquierda: deja recorrer la lista de un vistazo sin
     leerla entera, y no compite con el fondo de la tarjeta. */
  fila: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  cuerpo: { flex: 1, flexDirection: "row", gap: space.md, padding: space.md },
  icono: { width: 28, height: 28, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  texto: { flex: 1, gap: 2 },
  cuando: { marginTop: 2 },
  tacho: { width: TOUCH, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
});
