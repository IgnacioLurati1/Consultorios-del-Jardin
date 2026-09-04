import { FontAwesome6 } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { myPatients } from "../../../api/appointments";
import { findActiveByType } from "../../../api/people";
import { Person } from "../../../api/types";
import { Button } from "../../../components/Button";
import { ChipRow, Tag } from "../../../components/Chip";
import { DataState, EmptyState } from "../../../components/States";
import { Group } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { ContactPatientSheet } from "../../../features/ContactPatient";
import { initials } from "../../../lib/appointments";
import { matches } from "../../../lib/specialities";
import { useAsync } from "../../../lib/useAsync";
import { useUser } from "../../../session/SessionProvider";
import { radius, SCREEN_PADDING, space, TOUCH } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

type Scope = "mine" | "all";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "mine", label: "Mis pacientes" },
  { key: "all", label: "Todos" },
];

/**
 * Los pacientes. Arranca por los propios, que son los que el profesional busca casi
 * siempre; los del consultorio entero quedan a un toque, para cuando hay que darle turno
 * a alguien que todavia no atendio.
 *
 * "Mis pacientes" son los que alguna vez tuvieron turno con el: no es una lista que se
 * arme a mano, sale de la agenda.
 *
 * Incluye a los que no tienen cuenta: los carga el profesional para poder darles turno, y
 * se marcan como tales porque con ellos no se puede contar con que les llegue un mail.
 */
export default function PatientsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("mine");
  // Filtrar por deuda es un recorte de lo que ya se está mirando, no otra lista, y por
  // eso vive aparte del alcance y no como una opción más de la fila de arriba.
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [contacting, setContacting] = useState<Person | null>(null);
  const me = useUser();

  const state = useAsync(() => (scope === "mine" ? myPatients() : findActiveByType("client")), [scope]);

  useFocusEffect(
    useCallback(() => {
      state.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope])
  );

  // Cuántos le quedaron debiendo. Solo tiene sentido en los propios: la deuda es con
  // este profesional, y el listado de todos ni siquiera la trae.
  const debtors = useMemo(() => (state.data ?? []).filter((person) => person.owesPayment).length, [state.data]);

  const results = useMemo(() => {
    const term = search.trim();
    const list = state.data ?? [];

    return list.filter((person) => {
      if (onlyDebtors && !person.owesPayment) return false;
      if (!term) return true;

      return matches(person.name, term) || matches(person.surname, term) || matches(person.email, term);
    });
  }, [state.data, search, onlyDebtors]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.green} colors={[colors.green]} />
      }
    >
      <AppText variant="display">Pacientes</AppText>

      <View style={styles.filters}>
        <View style={styles.scopes}>
          <ChipRow
            options={SCOPES}
            value={scope}
            onChange={(key) => {
              // Ver a todos no trae la deuda: dejar el filtro puesto vaciaría la lista
              // sin que se entienda por qué.
              if (key === "all") setOnlyDebtors(false);
              setScope(key);
            }}
          />
        </View>

        {scope === "mine" && debtors > 0 ? (
          <Pressable
            onPress={() => setOnlyDebtors(!onlyDebtors)}
            accessibilityRole="button"
            accessibilityState={{ selected: onlyDebtors }}
            accessibilityLabel="Ver solo los que te quedaron debiendo"
            hitSlop={8}
            style={[
              styles.debtFilter,
              {
                backgroundColor: onlyDebtors ? colors.dangerSoft : colors.surface,
                borderColor: onlyDebtors ? colors.danger : colors.border,
              },
            ]}
          >
            <FontAwesome6 name="money-bill-wave" size={13} color={onlyDebtors ? colors.danger : colors.muted} />
            <AppText variant="caption" tone={onlyDebtors ? "danger" : "muted"} chrome>
              Adeudan {debtors}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <FontAwesome6 name="magnifying-glass" size={15} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o email"
          placeholderTextColor={colors.muted}
          selectionColor={colors.green}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Buscar un paciente"
          style={[styles.searchInput, { color: colors.text }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={12} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
            <FontAwesome6 name="xmark" size={15} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.list}>
        <DataState
          loading={state.loading}
          error={state.error}
          empty={results.length === 0}
          onRetry={state.reload}
          emptyState={
            <EmptyState
              icon="user-injured"
              title={
                search
                  ? "No encontramos a nadie así"
                  : scope === "mine"
                    ? "Todavía no atendiste a nadie"
                    : "Todavía no hay pacientes"
              }
              description={
                search
                  ? "Probá con el apellido o con el email."
                  : scope === "mine"
                    ? "Acá van a aparecer las personas a las que les des turno. Mientras tanto, podés mirar los del consultorio."
                    : "Podés cargar a alguien que no tiene cuenta para darle turno igual."
              }
              action={
                search
                  ? undefined
                  : scope === "mine"
                    ? { label: "Ver todos los pacientes", onPress: () => setScope("all") }
                    : { label: "Cargar un paciente", onPress: () => router.push("/(app)/nuevo-paciente") }
              }
            />
          }
        >
          <Group>
            {results.map((person, index) => (
              <PatientRow
                key={person.email}
                person={person}
                last={index === results.length - 1}
                onPress={() => router.push(`/(app)/paciente/${encodeURIComponent(person.email)}`)}
                // Solo en los propios: contactar a alguien que nunca atendiste no es una
                // acción que la pantalla tenga por qué ofrecer.
                onContact={scope === "mine" ? () => setContacting(person) : undefined}
              />
            ))}
          </Group>
        </DataState>
      </View>

      {/* La sesión guarda el email y el rol, nada más. Alcanza: el mail sale de la
          cuenta de Gmail del profesional, así que del otro lado ya saben quién escribe. */}
      <ContactPatientSheet
        patient={contacting}
        professional={{ email: me.email }}
        onClose={() => setContacting(null)}
      />

      <View style={styles.newButton}>
        <Button
          label="Cargar un paciente sin cuenta"
          icon="user-plus"
          variant="secondary"
          block
          onPress={() => router.push("/(app)/nuevo-paciente")}
        />
      </View>
    </ScrollView>
  );
}

function PatientRow({
  person,
  onPress,
  last,
  onContact,
}: {
  person: Person;
  onPress: () => void;
  last: boolean;
  /** Sin esto la fila no muestra el botón de contacto. */
  onContact?: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${person.name} ${person.surname}`}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && Platform.OS === "ios" && styles.pressed,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.greenSoft }]}>
        <AppText variant="bodyStrong" tone="green" chrome>
          {initials(person)}
        </AppText>
      </View>

      <View style={styles.rowText}>
        <AppText variant="body" numberOfLines={1}>
          {person.name} {person.surname}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {person.phoneNumber || person.email}
        </AppText>
      </View>

      {person.anonymous ? <Tag label="Sin cuenta" /> : null}
      {/* Un pago a medias también es una deuda: lo que se mira es si quedó algo sin
          cobrar, no si no pagó nada. */}
      {person.owesPayment ? (
        <Tag
          label={(person.owedAppointments ?? 0) === 1 ? "Adeuda un pago" : `Adeuda ${person.owedAppointments}`}
          tone="danger"
        />
      ) : null}

      {/* Va por fuera del Pressable de la fila en cuanto a intención, aunque esté
          adentro: el hitSlop y el stopPropagation del onPress alcanzan para que tocar el
          teléfono no abra la ficha. */}
      {onContact ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Contactar a ${person.name} ${person.surname}`}
          hitSlop={10}
          onPress={onContact}
          style={[styles.contact, { borderColor: colors.border }]}
        >
          <FontAwesome6 name="address-book" size={14} color={colors.greenDark} />
        </Pressable>
      ) : (
        <FontAwesome6 name="chevron-right" size={13} color={colors.muted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SCREEN_PADDING },
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
  filters: {
    marginTop: space.md,
    marginHorizontal: -SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  scopes: { flex: 1 },
  debtFilter: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderRadius: 999,
  },
  list: { marginTop: space.lg },
  newButton: { marginTop: space.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 20,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  contact: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
});
