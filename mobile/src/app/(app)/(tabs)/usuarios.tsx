import { FontAwesome6 } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "../../../api/client";
import { findAllUsers, toggleUserBookable, toggleUserState, toggleUserWaitlist } from "../../../api/people";
import { Person } from "../../../api/types";
import { Button } from "../../../components/Button";
import { behaviourReport, explainSuspicion, type FlaggedPatient } from "../../../api/security";
import { ChipRow, Tag } from "../../../components/Chip";
import { useFeedback } from "../../../components/Feedback";
import { Sheet } from "../../../components/Sheet";
import { DataState, EmptyState } from "../../../components/States";
import { Group, Note, Row } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { fullName, initials } from "../../../lib/appointments";
import { matches } from "../../../lib/specialities";
import { useAsync } from "../../../lib/useAsync";
import { radius, SCREEN_PADDING, space, TOUCH } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

type Filter = "pending" | "professionals" | "patients";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Esperando" },
  { key: "professionals", label: "Profesionales" },
  { key: "patients", label: "Pacientes" },
];

/**
 * Las cuentas del consultorio, menos las de administración.
 *
 * Arranca en "esperando" a propósito: un profesional que se registró y no fue aprobado
 * no puede trabajar, así que es lo único de esta pantalla que tiene a alguien del otro
 * lado esperando una respuesta.
 */
export default function UsersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();

  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const state = useAsync(findAllUsers, []);
  /** El profesional cuyas opciones están abiertas en el panel. */
  const [managing, setManaging] = useState<Person | null>(null);
  const [switching, setSwitching] = useState(false);

  // Los pacientes marcados por su asistencia. Van aparte porque no son un campo de la
  // persona sino una cuenta sobre sus turnos. Si falla, el listado funciona igual.
  const flagged = useAsync(async () => {
    const report = await behaviourReport().catch(() => null);
    return new Map((report?.suspicious ?? []).map((patient) => [patient.email, patient]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      state.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const all = state.data ?? [];
  const waiting = all.filter((person) => person.type === "professional" && !person.active);

  const results = useMemo(() => {
    const term = search.trim();

    const base =
      filter === "pending"
        ? waiting
        : filter === "professionals"
          ? all.filter((person) => person.type === "professional")
          : all.filter((person) => person.type === "client");

    if (!term) return base;
    return base.filter((person) => matches(fullName(person), term) || matches(person.email, term));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, filter, search]);

  async function toggle(person: Person) {
    const enabling = !person.active;

    const act = async () => {
      try {
        const estado = await toggleUserState(person.email);

        // Al deshabilitarlo también sale de la búsqueda de turnos, y no vuelve solo: si
        // no se dice acá, quien lo rehabilita se queda esperando que aparezca. Contra un
        // servidor que no lo cuenta no se dice nada, que es como era antes.
        feedback.done(
          !enabling
            ? `${fullName(person)} quedó deshabilitado`
            : estado?.bookable === false && person.type === "professional"
            ? `${fullName(person)} ya puede entrar. Para que aparezca cuando se busca turno hay que volver a ofrecerlo`
            : `${fullName(person)} ya puede entrar`
        );
        state.reload();
      } catch (problem) {
        feedback.problem(errorMessage(problem));
      }
    };

    if (enabling) return act();

    // Deshabilitar deja a alguien afuera de la app: eso se confirma.
    Alert.alert("Deshabilitar la cuenta", `${fullName(person)} no va a poder entrar hasta que se habilite de nuevo.`, [
      { text: "No", style: "cancel" },
      { text: "Deshabilitar", style: "destructive", onPress: act },
    ]);
  }

  /**
   * Esconderlo de la búsqueda de turnos, sin deshabilitarlo.
   *
   * No se confirma como el deshabilitar: acá no queda nadie afuera de la app, y volver
   * atrás es tocar el mismo botón.
   */
  async function toggleBookable(person: Person) {
    try {
      const bookable = await toggleUserBookable(person.email);
      feedback.done(
        bookable
          ? `${fullName(person)} vuelve a aparecer cuando se busca turno`
          : `${fullName(person)} deja de aparecer cuando se busca turno`
      );
      state.reload();
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    }
  }

  /**
   * Prender o apagar su lista de espera, como en la ficha de la página.
   *
   * Apagarla se pregunta: vacía la lista y les avisa a los que estaban, y eso no se
   * deshace volviéndola a prender. El mensaje de después lo arma el servidor, que sabe a
   * cuántos les avisó.
   */
  function askToggleWaitlist(person: Person) {
    const act = async () => {
      setSwitching(true);

      try {
        const { waitlistEnabled, message } = await toggleUserWaitlist(person.email);
        setManaging((current) => (current && current.email === person.email ? { ...current, waitlistEnabled } : current));
        feedback.done(message);
        state.reload();
      } catch (problem) {
        feedback.problem(errorMessage(problem));
      } finally {
        setSwitching(false);
      }
    };

    if (person.waitlistEnabled === false) return act();

    Alert.alert(
      "Apagar la lista de espera",
      "La lista se vacía y las personas anotadas reciben un aviso.",
      [
        { text: "Volver", style: "cancel" },
        { text: "Apagar", style: "destructive", onPress: act },
      ]
    );
  }

  const empty = {
    pending: { title: "No hay nadie esperando", description: "Acá aparecen los profesionales que se registran." },
    professionals: { title: "Todavía no hay profesionales", description: "Se dan de alta desde el botón de abajo." },
    patients: { title: "Todavía no hay pacientes", description: "Aparecen al registrarse." },
  }[filter];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.green} colors={[colors.green]} />
      }
    >
      <AppText variant="display">Usuarios</AppText>

      <View style={styles.filters}>
        <ChipRow
          options={FILTERS.map((item) =>
            item.key === "pending" && waiting.length > 0 ? { ...item, label: `Esperando (${waiting.length})` } : item
          )}
          value={filter}
          onChange={setFilter}
        />
      </View>

      {filter === "pending" && waiting.length > 0 ? (
        <View style={styles.note}>
          <Note tone="warn">Cuentas sin acceso todavía. Se habilitan al empezar a atender.</Note>
        </View>
      ) : null}

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
          accessibilityLabel="Buscar una cuenta"
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
              icon="users"
              title={search ? "Sin resultados" : empty.title}
              description={search ? "Buscar por apellido o email." : empty.description}
            />
          }
        >
          <Group>
            {results.map((person, index) => (
              <UserRow
                key={person.email}
                person={person}
                last={index === results.length - 1}
                suspicion={flagged.data?.get(person.email)}
                onToggle={() => toggle(person)}
                onToggleBookable={() => toggleBookable(person)}
                onOpen={person.type === "professional" && person.active ? () => setManaging(person) : undefined}
              />
            ))}
          </Group>
        </DataState>
      </View>

      <View style={styles.newButton}>
        <Button
          label="Dar de alta un profesional"
          icon="user-plus"
          variant="secondary"
          block
          onPress={() => router.push("/(app)/admin/alta-profesional")}
        />
      </View>

      <Sheet visible={!!managing} onClose={() => setManaging(null)} title={managing ? fullName(managing) : ""}>
        {managing ? (
          <View style={styles.sheet}>
            <Group>
              <Row
                title="Lista de espera"
                subtitle={
                  managing.waitlistEnabled === false
                    ? "Apagada. Nadie se puede anotar."
                    : "Los pacientes se anotan y reciben aviso cuando se libera un horario."
                }
                icon="bell"
                last
                right={
                  <Switch
                    value={managing.waitlistEnabled !== false}
                    disabled={switching}
                    onValueChange={() => askToggleWaitlist(managing)}
                  />
                }
              />
            </Group>
          </View>
        ) : null}
      </Sheet>
    </ScrollView>
  );
}

function UserRow({
  person,
  onToggle,
  onToggleBookable,
  onOpen,
  last,
  suspicion,
}: {
  person: Person;
  onToggle: () => void;
  /** Solo se ofrece para un profesional habilitado: es esconderlo, no darlo de baja. */
  onToggleBookable: () => void;
  /** Abre sus opciones, como la lista de espera. Solo para un profesional habilitado. */
  onOpen?: () => void;
  last: boolean;
  /** Presente si el paciente viene faltando más de lo que asiste. */
  suspicion?: FlaggedPatient;
}) {
  const { colors } = useTheme();
  const hidden = person.type === "professional" && person.active && person.bookable === false;

  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: person.active ? colors.greenSoft : colors.sunken }]}>
        <AppText variant="bodyStrong" tone={person.active ? "green" : "muted"} chrome>
          {initials(person)}
        </AppText>
      </View>

      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? "button" : undefined}
        accessibilityLabel={onOpen ? `Opciones de ${fullName(person)}` : undefined}
        style={({ pressed }) => [styles.rowText, pressed && Platform.OS === "ios" && styles.pressed]}
      >
        <AppText variant="body" numberOfLines={1} tone={person.active ? "default" : "muted"}>
          {fullName(person)}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {person.type === "professional" ? person.speciality || "Sin especialidad" : person.email}
        </AppText>
        {!person.active ? (
          <View style={styles.rowTag}>
            {/* Bajada a mano y bajada por una regla no son lo mismo para quien tiene que
                decidir si la vuelve a habilitar: a la segunda no la revisó nadie. */}
            {person.bannedBy === "system" ? (
              <Tag label="Baneado por el sistema" tone="danger" />
            ) : (
              <Tag label={person.type === "professional" ? "Esperando aprobación" : "Deshabilitado"} tone="warn" />
            )}
          </View>
        ) : hidden ? (
          <View style={styles.rowTag}>
            <Tag label="Fuera de la búsqueda" tone="warn" />
          </View>
        ) : suspicion ? (
          <View style={styles.rowTag}>
            <Tag label="Comportamiento sospechoso" tone="warn" />
          </View>
        ) : person.type === "professional" && person.waitlistEnabled === false ? (
          <View style={styles.rowTag}>
            <Tag label="Sin lista de espera" />
          </View>
        ) : null}

        {person.bannedBy === "system" && person.banReason ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {person.banReason}
          </AppText>
        ) : suspicion ? (
          <AppText variant="caption" tone="muted" numberOfLines={3}>
            {explainSuspicion(suspicion)}
          </AppText>
        ) : null}
      </Pressable>

      {person.type === "professional" && person.active ? (
        <Pressable
          onPress={onToggleBookable}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            hidden
              ? `Volver a ofrecer a ${fullName(person)} cuando se busca turno`
              : `Sacar a ${fullName(person)} de la búsqueda de turnos`
          }
          android_ripple={{ color: colors.border, borderless: true }}
          style={({ pressed }) => [styles.rowAction, pressed && Platform.OS === "ios" && styles.pressed]}
        >
          <FontAwesome6 name={hidden ? "eye-slash" : "eye"} size={19} color={hidden ? colors.warn : colors.muted} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={person.active ? `Deshabilitar a ${fullName(person)}` : `Habilitar a ${fullName(person)}`}
        android_ripple={{ color: colors.border, borderless: true }}
        style={({ pressed }) => [styles.rowAction, pressed && Platform.OS === "ios" && styles.pressed]}
      >
        <FontAwesome6
          name={person.active ? "circle-minus" : "circle-check"}
          size={20}
          color={person.active ? colors.danger : colors.green}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SCREEN_PADDING },
  filters: { marginTop: space.md, marginHorizontal: -SCREEN_PADDING, paddingHorizontal: SCREEN_PADDING },
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
  list: { marginTop: space.lg },
  newButton: { marginTop: space.xl },
  sheet: { paddingBottom: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 20,
    paddingLeft: space.lg,
    paddingVertical: space.md,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  rowTag: { flexDirection: "row", marginTop: 2 },
  rowAction: { width: TOUCH + 8, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
});
