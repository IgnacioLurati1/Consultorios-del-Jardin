import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import { Choice } from "../components/Choice";
import { Group, Note, Row } from "../components/Surfaces";
import { Sheet } from "../components/Sheet";
import { AppText } from "../components/Text";
import { ModeChoice, useApariencia } from "../lib/apariencia";
import { hsl, Season, SEASON_TINT, SEASONS } from "../theme/season";
import { radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/** Las tres respuestas al claro y al oscuro, dichas como se leen. */
const MODES: { key: ModeChoice; label: string; description: string }[] = [
  { key: "auto", label: "Como el teléfono", description: "Sigue el claro y el oscuro que tengas puesto en el celular." },
  { key: "light", label: "Siempre claro", description: "Aunque el teléfono esté en oscuro." },
  { key: "dark", label: "Siempre oscuro", description: "Aunque el teléfono esté en claro." },
];

/**
 * Cómo se ve la app. Se abre desde el encabezado de Inicio, al lado de la campana.
 *
 * Son las dos únicas preguntas que hay sobre esto y por eso entran en un panel y no en
 * una pantalla: se contestan de un toque y se vuelve a lo que uno estaba haciendo.
 */
export function AppearanceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [apariencia, guardar] = useApariencia();
  const { season } = useTheme();

  const automatic = apariencia.season === "auto";
  const showing = SEASONS.find((option) => option.key === season);

  return (
    <Sheet visible={visible} onClose={onClose} title="Cómo se ve">
      <View style={styles.body}>
        <Choice
          label="Claro y oscuro"
          options={MODES}
          value={apariencia.mode}
          onChange={(key) => guardar({ ...apariencia, mode: key as ModeChoice })}
        />

        <View style={styles.color}>
          <AppText variant="caption" tone="muted" chrome>
            Color
          </AppText>

          <Group>
            <Row
              title="Que cambie con la estación"
              subtitle={automatic ? `Ahora estamos en ${showing?.label.toLowerCase()}` : "La elegís vos"}
              subtitleIsData={automatic}
              icon="leaf"
              tone="green"
              last
              right={
                <Switch
                  value={automatic}
                  // Igual que en la web, apagarlo deja puesta la que se está viendo:
                  // dejar de seguir al calendario no tiene por qué cambiar nada en
                  // pantalla, solo dejar de moverlo solo.
                  onValueChange={(value) => guardar({ ...apariencia, season: value ? "auto" : season })}
                />
              }
            />
          </Group>

          <Seasons
            value={season}
            locked={automatic}
            onChange={(key) => guardar({ ...apariencia, season: key })}
          />

          <Note>
            {automatic
              ? "Cambia sola cuatro veces al año, con el calendario de acá."
              : "Va a quedar así hasta que la vuelvas a mover."}
          </Note>
        </View>
      </View>
    </Sheet>
  );
}

/**
 * Las cuatro estaciones, con una muestra de su color al lado del nombre.
 *
 * La muestra es el encabezado de Inicio en chiquito: el mismo degradado que va a quedar
 * arriba de la app. Arranca más claro que el de verdad porque a la luminosidad con la que
 * va a pantalla completa las cuatro se parecen demasiado en un cuadradito, y lo que tiene
 * que hacer la muestra es justamente distinguirlas de un vistazo.
 */
function Seasons({
  value,
  locked,
  onChange,
}: {
  value: Season;
  locked: boolean;
  onChange: (key: Season) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.grid, locked && styles.locked]}>
      {SEASONS.map((option) => {
        const active = option.key === value;
        const { h, s, h2, s2 } = SEASON_TINT[option.key];

        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            disabled={locked}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled: locked }}
            accessibilityLabel={option.label}
            android_ripple={{ color: colors.border }}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: active ? colors.greenSoft : colors.surface,
                borderColor: active ? colors.green : colors.border,
              },
              pressed && Platform.OS === "ios" && styles.pressed,
            ]}
          >
            {/* Dos mitades y no un degradado de verdad: para veintidós píxeles no vale
                traer el dibujante de vectores, y el corte al medio dice lo mismo. */}
            <View style={[styles.swatch, { backgroundColor: hsl(h2, s2, 26) }]}>
              <View style={[styles.swatchTop, { backgroundColor: hsl(h, s, 50) }]} />
            </View>

            <AppText variant="small" tone={active ? "green" : "default"} numberOfLines={1} style={styles.name}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl, paddingBottom: space.md },
  color: { gap: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  /* Apagado se sigue viendo, pero desteñido: así se entiende qué se va a poder elegir sin
     que el panel salte de alto al prender y apagar. Destiñe poco porque lo que hay que
     seguir distinguiendo acá es un color. */
  locked: { opacity: 0.6 },
  option: {
    flexGrow: 1,
    flexBasis: "45%",
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  swatch: { width: 22, height: 22, borderRadius: 7, overflow: "hidden" },
  swatchTop: { height: 11 },
  name: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
});
