import { FontAwesome6 } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "../../api/client";
import { askAssistant, ChatLink, ChatMessage } from "../../api/misc";
import { AppText } from "../../components/Text";
import { useUser } from "../../session/SessionProvider";
import { radius, SCREEN_PADDING, space, TOUCH } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

const MAX_MESSAGE = 600;

/** Lo primero que dice, según con quién está hablando. */
const GREETINGS: Record<string, string> = {
  client: "Hola. Puedo contarte qué turnos tenés, buscarte uno nuevo o darte los datos del consultorio. ¿Qué necesitás?",
  professional: "Hola. Puedo mostrarte tu agenda, contarte cómo venís de números o llevarte a la pantalla que busques.",
  admin: "Hola. Puedo contarte cómo viene el consultorio, quién está haciendo sobreturnos o llevarte a cualquier pantalla del panel.",
};

/** Un turno en pantalla: lo que se dijo, más los botones que el asistente ofreció. */
interface Bubble {
  role: "user" | "assistant";
  content: string;
  links?: ChatLink[];
}

/**
 * El asistente. Es una conversación, así que la pantalla es una sola columna de
 * mensajes y un campo abajo; los botones que ofrece van pegados a la respuesta que los
 * propuso, no en una barra aparte, para que se entienda de qué son.
 */
export default function AssistantScreen() {
  const { role } = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);

  const [bubbles, setBubbles] = useState<Bubble[]>([
    { role: "assistant", content: GREETINGS[role] ?? GREETINGS.client },
  ]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);

  const canSend = draft.trim().length > 0 && !thinking;

  async function send() {
    if (!canSend) return;

    const text = draft.trim();
    setDraft("");
    setBubbles((current) => [...current, { role: "user", content: text }]);
    setThinking(true);

    try {
      const reply = await askAssistant(text, history, pendingAction);

      setHistory(reply.newHistory);
      setPendingAction(reply.pendingAction);
      setBubbles((current) => [...current, { role: "assistant", content: reply.answer, links: reply.links }]);
    } catch (problem) {
      setBubbles((current) => [
        ...current,
        { role: "assistant", content: errorMessage(problem, "No pude contestarte ahora. Probá de nuevo en un rato.") },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        ref={scroller}
        style={styles.fill}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {bubbles.map((bubble, index) => (
          <MessageBubble key={index} bubble={bubble} />
        ))}

        {thinking ? <Typing /> : null}
      </ScrollView>

      <View
        style={[
          styles.composer,
          { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + space.md },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={(value) => setDraft(value.slice(0, MAX_MESSAGE))}
          placeholder="Escribí lo que necesites"
          placeholderTextColor={colors.muted}
          selectionColor={colors.green}
          multiline
          accessibilityLabel="Tu mensaje para el asistente"
          style={[styles.input, { backgroundColor: colors.sunken, borderColor: colors.border, color: colors.text }]}
        />

        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: !canSend }}
          android_ripple={{ color: colors.border, borderless: true }}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: canSend ? colors.green : colors.border },
            pressed && Platform.OS === "ios" && styles.pressed,
          ]}
        >
          <FontAwesome6 name="paper-plane" size={16} color={canSend ? colors.onGreen : colors.muted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ bubble }: { bubble: Bubble }) {
  const { colors } = useTheme();
  const mine = bubble.role === "user";

  return (
    <View style={[styles.turn, mine ? styles.turnMine : styles.turnTheirs]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.green, borderBottomRightRadius: radius.sm }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: radius.sm },
        ]}
      >
        <AppText variant="body" style={{ color: mine ? colors.onGreen : colors.text }}>
          {bubble.content}
        </AppText>
      </View>

      {bubble.links?.length ? (
        <View style={styles.links}>
          {bubble.links.map((link) => (
            <Pressable
              key={link.path}
              onPress={() => router.push(toAppRoute(link.path) as never)}
              accessibilityRole="button"
              accessibilityLabel={link.label}
              android_ripple={{ color: colors.border }}
              style={({ pressed }) => [
                styles.link,
                { borderColor: colors.green, backgroundColor: colors.greenSoft },
                pressed && Platform.OS === "ios" && styles.pressed,
              ]}
            >
              <AppText variant="caption" tone="green" chrome>
                {link.label}
              </AppText>
              <FontAwesome6 name="arrow-right" size={12} color={colors.greenDark} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Los tres puntitos mientras piensa. Las respuestas del asistente tardan, así que sin
 * esto la pantalla parece colgada.
 */
function Typing() {
  const { colors } = useTheme();
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay((2 - index) * 160),
        ])
      )
    );

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      accessibilityLabel="El asistente está escribiendo"
      accessibilityLiveRegion="polite"
      style={[styles.turn, styles.turnTheirs]}
    >
      <View style={[styles.bubble, styles.typing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {dots.map((dot, index) => (
          <Animated.View key={index} style={[styles.dot, { backgroundColor: colors.muted, opacity: dot }]} />
        ))}
      </View>
    </View>
  );
}

/**
 * El asistente devuelve rutas de la web ("/AppointmentsList"). En la app las pantallas
 * se llaman distinto, así que se traducen acá; lo que no tiene equivalente cae en Inicio,
 * que es preferible a un botón que no lleva a ningún lado.
 */
const ROUTES: Record<string, string> = {
  "/": "/(app)/(tabs)",
  "/Appointment": "/(app)/(tabs)/pedir-turno",
  "/AppointmentsList": "/(app)/(tabs)/turnos",
  "/EditProfile": "/(app)/mis-datos",
  "/Patients": "/(app)/(tabs)/pacientes",
  "/Analytics": "/(app)/numeros",
  "/scheduleProfessional": "/(app)/horarios",
  "/contacto": "/(app)/contacto",
  "/ProfessionalHome": "/(app)/(tabs)",
  "/AdminHome": "/(app)/(tabs)",
  "/AdminHome/UsersAdmin": "/(app)/(tabs)/usuarios",
  "/AdminHome/Control": "/(app)/admin/control",
  "/AdminHome/Analytics": "/(app)/(tabs)/numeros",
  "/AdminHome/ProvincesAdmin": "/(app)/admin/provincias",
  "/AdminHome/CitiesAdmin": "/(app)/admin/localidades",
  "/AdminHome/OfficesAdmin": "/(app)/admin/sucursales",
  "/AdminHome/RoomsAdmin": "/(app)/admin/consultorios",
  "/AdminHome/RegisterProfAdmin": "/(app)/admin/alta-profesional",
};

function toAppRoute(path: string): string {
  return ROUTES[path] ?? "/(app)/(tabs)";
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  thread: { padding: SCREEN_PADDING, gap: space.md },
  turn: { maxWidth: "88%", gap: space.sm },
  turnMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  turnTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
  },
  typing: { flexDirection: "row", gap: 5, alignItems: "center", borderWidth: 1, paddingVertical: space.lg },
  dot: { width: 7, height: 7, borderRadius: radius.full },
  links: { gap: space.sm, alignItems: "flex-start" },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: TOUCH - 6,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.md,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: TOUCH,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: 16,
    lineHeight: 21,
  },
  send: { width: TOUCH, height: TOUCH, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
});
