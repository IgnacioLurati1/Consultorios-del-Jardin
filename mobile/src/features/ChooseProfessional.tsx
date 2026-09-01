import { FontAwesome6 } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { findActiveOffices } from "../api/catalog";
import { findProfessionalsAt } from "../api/people";
import { Person } from "../api/types";
import { ChipRow } from "../components/Chip";
import { DataState, EmptyState } from "../components/States";
import { Group, Note } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { initials } from "../lib/appointments";
import { matches, sameSpeciality, SPECIALITIES } from "../lib/specialities";
import { useAsync } from "../lib/useAsync";
import { useUser } from "../session/SessionProvider";
import { radius, SCREEN_PADDING, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/**
 * Elegir con quién atenderse. Es la misma pantalla para el paciente (que la tiene en la
 * barra de abajo) y para el profesional que se atiende con un colega.
 *
 * No se pregunta la sucursal: hay una sola y se resuelve sola. Y se piden los
 * profesionales de esa sucursal, no todos: el que no tiene horarios cargados no puede dar
 * turnos y solo ensucia la lista.
 */
export function ChooseProfessional({ standalone }: { standalone?: boolean }) {
  const { email, role } = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [speciality, setSpeciality] = useState<string>("");
  const [search, setSearch] = useState("");

  const state = useAsync(async () => {
    const offices = await findActiveOffices();
    const office = offices[0];
    if (!office) return { office: null, professionals: [] as Person[] };

    return { office, professionals: await findProfessionalsAt(String(office.idOffice)) };
  }, []);

  const bookingForSelf = role === "professional";

  const results = useMemo(() => {
    const term = search.trim();

    return (state.data?.professionals ?? []).filter((professional) => {
      // Un profesional no se da turno a sí mismo: ocuparía su propio módulo con un turno
      // que no atiende nadie.
      if (bookingForSelf && professional.email === email) return false;
      if (speciality && !sameSpeciality(professional.speciality, speciality)) return false;
      if (!term) return true;

      return (
        matches(professional.name, term) ||
        matches(professional.surname, term) ||
        matches(professional.speciality ?? "", term)
      );
    });
  }, [state.data, speciality, search, bookingForSelf, email]);

  const filters = [{ key: "", label: "Todas" }, ...SPECIALITIES.map((item) => ({ key: item, label: item }))];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.page,
        { paddingTop: standalone ? insets.top + space.lg : space.lg, paddingBottom: insets.bottom + space.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.green} colors={[colors.green]} />
      }
    >
      {standalone ? <AppText variant="display">Pedir un turno</AppText> : null}

      <AppText variant="small" tone="muted" style={styles.lead}>
        {bookingForSelf ? "Elegí con qué colega te querés atender." : "Elegí una especialidad o buscá por nombre."}
      </AppText>

      {bookingForSelf ? (
        <View style={styles.note}>
          <Note>Este turno es para vos como paciente. No aparecés en la lista porque no podés atenderte a vos mismo.</Note>
        </View>
      ) : null}

      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <FontAwesome6 name="magnifying-glass" size={15} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre"
          placeholderTextColor={colors.muted}
          selectionColor={colors.green}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Buscar un profesional por nombre"
          style={[styles.searchInput, { color: colors.text }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={12} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
            <FontAwesome6 name="xmark" size={15} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters}>
        <ChipRow options={filters} value={speciality} onChange={setSpeciality} />
      </View>

      <DataState
        loading={state.loading}
        error={state.error}
        empty={results.length === 0}
        onRetry={state.reload}
        emptyState={
          <EmptyState
            icon="user-doctor"
            title={speciality || search ? "No encontramos a nadie así" : "Todavía no hay profesionales"}
            description={
              speciality || search
                ? "Probá con otra especialidad o buscando de otra forma."
                : "Cuando haya profesionales con horarios cargados, van a aparecer acá."
            }
          />
        }
      >
        <Group>
          {results.map((professional, index) => (
            <ProfessionalCard
              key={professional.email}
              professional={professional}
              last={index === results.length - 1}
              onPress={() => router.push(`/(app)/pedir/${encodeURIComponent(professional.email)}`)}
            />
          ))}
        </Group>
      </DataState>
    </ScrollView>
  );
}

/**
 * La fila de un profesional. El círculo con las iniciales no es decoración: distingue a
 * dos personas de la misma especialidad de un vistazo, que es justo lo que cuesta cuando
 * la lista es toda del mismo rubro.
 */
function ProfessionalCard({
  professional,
  onPress,
  last,
}: {
  professional: Person;
  onPress: () => void;
  last: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${professional.name} ${professional.surname}, ${professional.speciality ?? "sin especialidad"}`}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.card,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && Platform.OS === "ios" && styles.pressed,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.greenSoft }]}>
        <AppText variant="bodyStrong" tone="green" chrome>
          {initials(professional)}
        </AppText>
      </View>

      <View style={styles.cardText}>
        <AppText variant="body" numberOfLines={1}>
          {professional.name} {professional.surname}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {professional.speciality || "Sin especialidad cargada"}
        </AppText>
      </View>

      <FontAwesome6 name="chevron-right" size={13} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SCREEN_PADDING },
  lead: { marginTop: space.xs },
  note: { marginTop: space.md },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.lg,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: TOUCH + 4,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: space.md },
  filters: { marginTop: space.md, marginBottom: space.lg, marginHorizontal: -SCREEN_PADDING, paddingHorizontal: SCREEN_PADDING },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 20,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
});
