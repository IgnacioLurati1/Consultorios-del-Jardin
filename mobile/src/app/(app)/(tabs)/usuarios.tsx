import { FontAwesome6 } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "../../../api/client";
import { findAllUsers, toggleUserBookable, toggleUserState } from "../../../api/people";
import { Person } from "../../../api/types";
import { Button } from "../../../components/Button";
import { ChipRow, Tag } from "../../../components/Chip";
import { useFeedback } from "../../../components/Feedback";
import { DataState, EmptyState } from "../../../components/States";
import { Group, Note } from "../../../components/Surfaces";
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
        await toggleUserState(person.email);
        feedback.done(enabling ? `${fullName(person)} ya puede entrar` : `${fullName(person)} quedó deshabilitado`);
        state.reload();
      } catch (problem) {
        feedback.problem(errorMessage(problem));
      }
    };

    if (enabling) return act();

    // Deshabilitar deja a alguien afuera de la app: eso se confirma.
    Alert.alert("Deshabilitar la cuenta", `${fullName(person)} no va a poder entrar hasta que la habilites de nuevo.`, [
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

  const empty = {
    pending: { title: "No hay nadie esperando", description: "Cuando un profesional se registre, va a aparecer acá para que lo apruebes." },
    professionals: { title: "Todavía no hay profesionales", description: "Podés darlos de alta vos desde el botón de abajo." },
    patients: { title: "Todavía no hay pacientes", description: "Las cuentas de los pacientes se crean solas cuando se registran." },
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
          <Note tone="warn">
            Estas cuentas están creadas pero no pueden entrar. Habilitalas si efectivamente van a atender acá.
          </Note>
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
              title={search ? "No encontramos a nadie así" : empty.title}
              description={search ? "Probá con el apellido o el email." : empty.description}
            />
          }
        >
          <Group>
            {results.map((person, index) => (
              <UserRow
                key={person.email}
                person={person}
                last={index === results.length - 1}
                onToggle={() => toggle(person)}
                onToggleBookable={() => toggleBookable(person)}
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
    </ScrollView>
  );
}

function UserRow({
  person,
  onToggle,
  onToggleBookable,
  last,
}: {
  person: Person;
  onToggle: () => void;
  /** Solo se ofrece para un profesional habilitado: es esconderlo, no darlo de baja. */
  onToggleBookable: () => void;
  last: boolean;
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

      <View style={styles.rowText}>
        <AppText variant="body" numberOfLines={1} tone={person.active ? "default" : "muted"}>
          {fullName(person)}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {person.type === "professional" ? person.speciality || "Sin especialidad" : person.email}
        </AppText>
        {!person.active ? (
          <View style={styles.rowTag}>
            <Tag label={person.type === "professional" ? "Esperando aprobación" : "Deshabilitado"} tone="warn" />
          </View>
        ) : hidden ? (
          <View style={styles.rowTag}>
            <Tag label="Fuera de la búsqueda" tone="warn" />
          </View>
        ) : null}
      </View>

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
