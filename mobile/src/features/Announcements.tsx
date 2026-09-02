import { FontAwesome6 } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { Announcement, AnnouncementLevel, myAnnouncements } from "../api/announcements";
import { AppText } from "../components/Text";
import { markClosed, notifyNew, readClosed } from "../lib/announcements";
import { useSession } from "../session/SessionProvider";
import { radius, SCREEN_PADDING, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

const ICONS: Record<AnnouncementLevel, React.ComponentProps<typeof FontAwesome6>["name"]> = {
  error: "circle-exclamation",
  warning: "triangle-exclamation",
  news: "circle-info",
};

/**
 * Trae los avisos y hace sonar los que corresponda.
 *
 * Se pide al entrar y cada vez que la app vuelve al frente, que es el único momento en
 * que puede haber algo nuevo sin push. Devuelve los que van arriba del panel, ya sin los
 * que la persona cerró.
 */
function useAnnouncements() {
  const { session } = useSession();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [closed, setClosed] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!session) return;

    try {
      const data = await myAnnouncements();
      setAnnouncements(data);
      setClosed(await readClosed());
      await notifyNew(data);
    } catch {
      // Un aviso que no llegó no es motivo para romperle la pantalla a nadie.
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });

    return () => subscription.remove();
  }, [load]);

  const close = useCallback(async (id: number) => {
    setClosed(await markClosed(id));
  }, []);

  const visible = announcements.filter((item) => item.channel !== "notification" && !closed.includes(item.id));

  return { visible, close };
}

/**
 * Los avisos del consultorio, arriba del panel.
 *
 * Se cierran con la X y no vuelven: el aviso ya cumplió, y uno que reaparece en cada
 * visita deja de leerse a los dos días.
 */
export function AnnouncementBanner() {
  const { colors } = useTheme();
  const { visible, close } = useAnnouncements();

  if (visible.length === 0) return null;

  const skin = (level: AnnouncementLevel) =>
    ({
      error: { bg: colors.dangerSoft, accent: colors.danger },
      warning: { bg: colors.warnSoft, accent: colors.warn },
      news: { bg: colors.greenSoft, accent: colors.green },
    })[level];

  return (
    <View style={styles.stack}>
      {visible.map((announcement) => {
        const tone = skin(announcement.level);

        return (
          <View
            key={announcement.id}
            // La barra de color al costado dice de qué tipo es el aviso antes de leerlo,
            // que es lo único que se le puede pedir a un color.
            style={[styles.card, { backgroundColor: tone.bg, borderLeftColor: tone.accent }]}
          >
            <FontAwesome6 name={ICONS[announcement.level]} size={16} color={tone.accent} style={styles.icon} />

            <View style={styles.text}>
              <AppText variant="body" style={styles.title}>
                {announcement.title}
              </AppText>
              <AppText variant="small" style={{ color: colors.text }}>
                {announcement.body}
              </AppText>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar el aviso"
              hitSlop={space.md}
              onPress={() => void close(announcement.id)}
              style={styles.close}
            >
              <FontAwesome6 name="xmark" size={15} color={colors.muted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { paddingHorizontal: SCREEN_PADDING, marginTop: space.lg, gap: space.sm },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
  },
  icon: { marginTop: 2 },
  text: { flex: 1, gap: 2 },
  title: { fontWeight: "700" },
  close: { minWidth: TOUCH / 2, alignItems: "flex-end" },
});
